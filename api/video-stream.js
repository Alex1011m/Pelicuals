// api/video-stream.js
// Vercel Serverless Function & Local HTTP Range Streaming Proxy
// Resuelve bloqueos de CORS, IP-binding y cabeceras Referer en servidores de Anime (MP4Upload, YourUpload, Streamtape)
var https = require('https');
var http = require('http');
var url = require('url');

var MAX_REDIRECTS = 5;

function pipeStream(targetUrl, referer, req, res, redirectCount) {
  if (redirectCount > MAX_REDIRECTS) {
    res.statusCode = 502;
    return res.end('Demasiadas redirecciones upstream');
  }

  var parsed;
  try {
    parsed = new URL(targetUrl);
  } catch (e) {
    res.statusCode = 400;
    return res.end('URL de video invalida');
  }

  var isHttps = parsed.protocol === 'https:';
  var client = isHttps ? https : http;

  var upstreamHeaders = {
    'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': '*/*'
  };

  if (referer) {
    upstreamHeaders['Referer'] = referer;
  } else {
    upstreamHeaders['Referer'] = parsed.origin + '/';
  }

  // Transmitir solicitud de rango (para reproducción fluida y adelantar/retroceder en Smart TV)
  if (req.headers.range) {
    upstreamHeaders['Range'] = req.headers.range;
  }

  var opts = {
    hostname: parsed.hostname,
    port: parsed.port || (isHttps ? 443 : 80),
    path: parsed.pathname + parsed.search,
    method: req.method === 'HEAD' ? 'HEAD' : 'GET',
    headers: upstreamHeaders,
    timeout: 15000
  };

  var upstreamReq = client.request(opts, function (upstreamRes) {
    // Seguir redirecciones 301, 302, 303, 307, 308 (común en YourUpload / CDN)
    if (upstreamRes.statusCode >= 300 && upstreamRes.statusCode < 400 && upstreamRes.headers.location) {
      var nextLoc = upstreamRes.headers.location;
      var nextUrl = nextLoc.indexOf('http') === 0 ? nextLoc : new URL(nextLoc, targetUrl).href;
      return pipeStream(nextUrl, referer, req, res, (redirectCount || 0) + 1);
    }

    var statusCode = upstreamRes.statusCode;
    // Si upstream responde 200 o 206
    var responseHeaders = {
      'Content-Type': 'video/mp4',
      'Accept-Ranges': 'bytes',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Accept, Origin, User-Agent',
      'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges'
    };

    if (upstreamRes.headers['content-range']) {
      responseHeaders['Content-Range'] = upstreamRes.headers['content-range'];
    }
    if (upstreamRes.headers['content-length']) {
      responseHeaders['Content-Length'] = upstreamRes.headers['content-length'];
    }
    if (upstreamRes.headers['last-modified']) {
      responseHeaders['Last-Modified'] = upstreamRes.headers['last-modified'];
    }
    if (upstreamRes.headers['etag']) {
      responseHeaders['ETag'] = upstreamRes.headers['etag'];
    }

    res.writeHead(statusCode, responseHeaders);

    if (req.method === 'HEAD') {
      return res.end();
    }

    upstreamRes.pipe(res);

    // Cancelar la conexión upstream si el usuario cierra el reproductor o cambia de video
    res.on('close', function () {
      try {
        upstreamRes.destroy();
        upstreamReq.destroy();
      } catch (eClose) { }
    });
  });

  upstreamReq.on('timeout', function () {
    try { upstreamReq.destroy(); } catch (eT) { }
    if (!res.headersSent) {
      res.statusCode = 504;
      res.end('Timeout conectando al servidor de video');
    }
  });

  upstreamReq.on('error', function (err) {
    if (!res.headersSent) {
      res.statusCode = 502;
      res.end('Error de conexion upstream: ' + (err ? err.message : 'desconocido'));
    }
  });

  upstreamReq.end();
}

module.exports = function (req, res) {
  // Manejo de CORS Preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Max-Age': '86400'
    });
    return res.end();
  }

  var targetUrl = req.query && req.query.url ? req.query.url : null;
  var referer = req.query && req.query.ref ? req.query.ref : null;

  if (!targetUrl) {
    res.statusCode = 400;
    return res.end('Parametro "url" requerido');
  }

  pipeStream(targetUrl, referer, req, res, 0);
};
