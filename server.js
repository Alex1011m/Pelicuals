// server.js
// Servidor de desarrollo local compatible con Vercel Functions (Cero dependencias externas)
var http = require('http');
var fs = require('fs');
var path = require('path');
var url = require('url');
var os = require('os');

// Evitar caídas inesperadas del proceso por sockets cerrados o timeouts
process.on('uncaughtException', function (err) {
  console.error('[UNCAUGHT EXCEPTION]', err && err.message ? err.message : err);
});

var channelsHandler = require('./api/channels');
var moviesHandler = require('./api/movies');
var plutoStreamHandler = require('./api/pluto-stream');

var PORT = process.env.PORT || 3000;
var PUBLIC_DIR = path.join(__dirname, 'public');

var MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml'
};

function getLocalIp() {
  var interfaces = os.networkInterfaces();
  var fallbackIp = 'localhost';
  for (var name in interfaces) {
    var iface = interfaces[name];
    for (var i = 0; i < iface.length; i++) {
      var alias = iface[i];
      if (alias.family === 'IPv4' && !alias.internal) {
        // Priorizar IPs típicas de red doméstica (192.168.x.x o 10.x.x.x) sobre VPNs
        if (alias.address.indexOf('192.168.') === 0 || alias.address.indexOf('10.') === 0) {
          return alias.address;
        }
        if (fallbackIp === 'localhost') {
          fallbackIp = alias.address;
        }
      }
    }
  }
  return fallbackIp;
}

var server = http.createServer(function (req, res) {
  var reqUrl = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  var pathname = reqUrl.pathname;
  var query = {};
  reqUrl.searchParams.forEach(function (val, key) {
    query[key] = val;
  });

  // Mock de req.query y res.status/res.json para compatibilidad con Vercel
  req.query = query;
  res.status = function (code) {
    if (res.headersSent) return res;
    res.statusCode = code;
    return res;
  };
  res.json = function (data) {
    if (res.headersSent) return;
    try {
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify(data));
    } catch (e) {
      // Headers already flushed
    }
  };

  // Enrutamiento de Funciones Serverless (/api/...)
  if (pathname === '/api/channels') {
    return channelsHandler(req, res);
  }
  if (pathname === '/api/movies') {
    return moviesHandler(req, res);
  }
  if (pathname === '/api/pluto-stream') {
    return plutoStreamHandler(req, res);
  }
  if (pathname === '/favicon.ico') {
    res.writeHead(204);
    return res.end();
  }

  // Servicio de archivos estáticos (/public)
  var safePath = path.normalize(pathname).replace(/^(\.\.[\/\\])+/, '');
  if (safePath === '/' || safePath === '\\') {
    safePath = '/index.html';
  }

  var filePath = path.join(PUBLIC_DIR, safePath);
  var ext = path.extname(filePath).toLowerCase();
  var contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, function (err, content) {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
      } else {
        res.writeHead(500);
        res.end('500 Server Error: ' + err.code);
      }
    } else {
      res.writeHead(200, {
        'Content-Type': contentType,
        'Access-Control-Allow-Origin': '*'
      });
      res.end(content, 'utf-8');
    }
  });
});

server.listen(PORT, '0.0.0.0', function () {
  var localIp = getLocalIp();
  console.log('========================================================');
  console.log('  SMART TV HUB - SERVIDOR ACTIVO');
  console.log('========================================================');
  console.log('  En tu PC:      http://localhost:' + PORT);
  console.log('  En tu TV LAN:  http://' + localIp + ':' + PORT);
  console.log('========================================================');
  console.log('  Listo para desplegar en Vercel con "vercel" o GitHub.');
  console.log('========================================================\n');

  // Pre-calentar catálogo e IPTV en segundo plano
  setTimeout(function () {
    channelsHandler({ query: {} }, { setHeader: function () {}, status: function () { return { json: function () {} }; } });
    moviesHandler({ query: { action: 'catalog' } }, { setHeader: function () {}, status: function () { return { json: function () {} }; } });
  }, 1000);
});

