// api/youtube.js
// Extractor ligero y ultra-rápido de tráilers de YouTube para Smart TVs (sin API keys de pago)
var https = require('https');
var url = require('url');

var trailerCache = {};

function searchYouTubeTrailer(query, callback) {
  var cleanQ = (query || '').trim();
  if (!cleanQ) return callback(new Error('Falta término de búsqueda'));

  var cacheKey = cleanQ.toLowerCase();
  if (trailerCache[cacheKey]) {
    return callback(null, trailerCache[cacheKey]);
  }

  var searchUrl = 'https://www.youtube.com/results?search_query=' + encodeURIComponent(cleanQ + ' trailer oficial');

  var options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept-Language': 'es-ES,es;q=0.9',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
    }
  };

  var called = false;
  function finish(err, key) {
    if (called) return;
    called = true;
    callback(err, key);
  }

  var req = https.get(searchUrl, options, function (res) {
    var data = '';
    res.on('data', function (c) {
      data += c;
      // Optimización: si ya encontramos el primer ID de video en el chunk inicial de HTML, abortar temprano
      var quickMatch = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (quickMatch && quickMatch[1]) {
        try { req.destroy(); } catch (e) {}
        trailerCache[cacheKey] = quickMatch[1];
        return finish(null, quickMatch[1]);
      }
    });
    res.on('end', function () {
      var match = data.match(/\/watch\?v=([a-zA-Z0-9_-]{11})/);
      if (match && match[1]) {
        trailerCache[cacheKey] = match[1];
        finish(null, match[1]);
      } else {
        finish(new Error('No se encontró tráiler en YouTube'));
      }
    });
  });

  req.on('error', function (err) {
    finish(err);
  });

  req.setTimeout(4500, function () {
    try { req.destroy(); } catch (e) {}
    finish(new Error('Timeout buscando tráiler'));
  });
}

module.exports = function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  var parsed = url.parse(req.url, true);
  var q = (req.query && req.query.q) || (parsed.query && parsed.query.q);

  if (!q) {
    var errBad = { status: 'error', message: 'Falta parámetro q' };
    if (res.status) {
      return res.status(400).json(errBad);
    }
    res.writeHead(400);
    return res.end(JSON.stringify(errBad));
  }

  searchYouTubeTrailer(q, function (err, key) {
    if (err || !key) {
      var errObj = { status: 'error', message: err ? err.message : 'No encontrado' };
      if (res.status) {
        return res.status(404).json(errObj);
      }
      res.writeHead(404);
      return res.end(JSON.stringify(errObj));
    }

    var successObj = {
      status: 'ok',
      key: key,
      embedUrl: 'https://www.youtube-nocookie.com/embed/' + key + '?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=' + key
    };

    if (res.status) {
      res.status(200).json(successObj);
    } else {
      res.writeHead(200);
      res.end(JSON.stringify(successObj));
    }
  });
};

module.exports.searchTrailer = searchYouTubeTrailer;

