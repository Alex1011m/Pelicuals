// api/pluto-stream.js
// Vercel Serverless Function & Local HLS Stream Proxy para Pluto TV
// Elimina restricciones de CORS permitiendo que Smart TVs y navegadores reproduzcan streams oficiales HLS
var https = require('https');
var http = require('http');
var url = require('url');

var STITCHER_BASE = 'https://cfd-v4-service-channel-stitcher-use1-1.prd.pluto.tv';

function getRandomSessionId() {
  return 'smarttv_' + Math.random().toString(36).substring(2, 12);
}

module.exports = function (req, res) {
  // Manejo de preflight CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  var reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  var channelId = req.query ? req.query.id : reqUrl.searchParams.get('id');
  var targetUrl = req.query ? req.query.url : reqUrl.searchParams.get('url');

  if (!targetUrl && channelId) {
    var sid = getRandomSessionId();
    var stitcherParams = 'appName=web&appVersion=unknown&deviceVersion=unknown&deviceModel=web&deviceMake=unknown&deviceType=web&clientID=0&deviceDNT=0&clientModelNumber=unknown&sid=' + sid;
    targetUrl = STITCHER_BASE + '/stitch/hls/channel/' + channelId + '/master.m3u8?' + stitcherParams;
  }

  if (!targetUrl) {
    res.statusCode = 400;
    res.setHeader('Content-Type', 'application/json');
    return res.end(JSON.stringify({ error: 'Falta parametro ?id= o ?url=' }));
  }

  var targetObj;
  try {
    targetObj = new URL(targetUrl);
  } catch (eUrl) {
    res.statusCode = 400;
    return res.end('URL de destino invalida');
  }

  var client = targetObj.protocol === 'http:' ? http : https;
  var opts = {
    hostname: targetObj.hostname,
    port: targetObj.port || (targetObj.protocol === 'http:' ? 80 : 443),
    path: targetObj.pathname + targetObj.search,
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SmartTVHub/2.0'
    }
  };

  var remoteReq = client.get(opts, function (remoteRes) {
    // Seguir redirecciones
    if (remoteRes.statusCode >= 300 && remoteRes.statusCode < 400 && remoteRes.headers.location) {
      var nextUrl = new URL(remoteRes.headers.location, targetUrl).href;
      res.writeHead(302, {
        'Location': '/api/pluto-stream?url=' + encodeURIComponent(nextUrl),
        'Access-Control-Allow-Origin': '*'
      });
      return res.end();
    }

    if (remoteRes.statusCode !== 200) {
      res.statusCode = remoteRes.statusCode;
      return res.end('Error upstream de Pluto TV: HTTP ' + remoteRes.statusCode);
    }

    var chunks = [];
    remoteRes.on('data', function (c) { chunks.push(c); });
    remoteRes.on('end', function () {
      var body = Buffer.concat(chunks).toString('utf8');

      // Reescritura selectiva de M3U8 para forzar CORS en playlists
      var lines = body.split('\n');
      var rewritten = lines.map(function (line) {
        var trimmed = line.trim();
        if (!trimmed) return line;

        // Reescribir URIs en etiquetas como #EXT-X-MEDIA
        if (trimmed.indexOf('#EXT-X-MEDIA') === 0 && trimmed.indexOf('URI="') !== -1) {
          return trimmed.replace(/URI="([^"]+)"/, function (match, uri) {
            var fullUri = new URL(uri, targetUrl).href;
            return 'URI="/api/pluto-stream?url=' + encodeURIComponent(fullUri) + '"';
          });
        }

        // Dejar comentarios y directivas intactas
        if (trimmed.indexOf('#') === 0) {
          return line;
        }

        // Segmentos de video .ts o claves .key (los servidores siloh-ns1.plutotv.net ya tienen ACAO: *)
        if (trimmed.indexOf('.ts') !== -1 || trimmed.indexOf('.key') !== -1) {
          if (trimmed.indexOf('http') === 0) {
            return line; // Ya es absoluto y con CORS abierto en CDN
          }
          return new URL(trimmed, targetUrl).href;
        }

        // Sub-listas .m3u8 (deben ser enrutadas por este proxy para eludir el bloqueo CORS de stitcher)
        if (trimmed.indexOf('.m3u8') !== -1) {
          var fullSub = new URL(trimmed, targetUrl).href;
          return '/api/pluto-stream?url=' + encodeURIComponent(fullSub);
        }

        return line;
      }).join('\n');

      res.writeHead(200, {
        'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      });
      res.end(rewritten);
    });
  });

  remoteReq.on('error', function (err) {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Error al conectar con Pluto TV Stitcher: ' + err.message);
    }
  });

  remoteReq.setTimeout(8000, function () {
    try { remoteReq.destroy(); } catch (e) {}
    if (!res.headersSent) {
      res.statusCode = 504;
      res.end('Timeout al conectar con Pluto TV Stitcher');
    }
  });
};

