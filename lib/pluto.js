// lib/pluto.js
// Proveedor oficial de Canales de Pluto TV para Smart TV Hub
// Obtiene la lista completa de canales oficiales en formato HLS (.m3u8) organizados por categorías
var https = require('https');
var fs = require('fs');
var path = require('path');

var BUNDLED_PLUTO_FILE = path.join(__dirname, 'pluto-cache.json');
var TMP_PLUTO_FILE = path.join('/tmp', 'pluto-cache.json');
var CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas

var memoryPlutoCache = null;
var memoryPlutoTime = 0;
var isRefreshingPluto = false;

// Carga bundled directa con require para compatibilidad 100% serverless en Vercel
var defaultBundledPluto = null;
try {
  defaultBundledPluto = require('./pluto-cache.json');
} catch (eBundled) {
  defaultBundledPluto = null;
}

// Cargar desde disco al iniciar si existe
try {
  var readPath = fs.existsSync(TMP_PLUTO_FILE) ? TMP_PLUTO_FILE : (fs.existsSync(BUNDLED_PLUTO_FILE) ? BUNDLED_PLUTO_FILE : null);
  if (readPath) {
    var raw = fs.readFileSync(readPath, 'utf8');
    var parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed) && parsed.length >= 5) {
      memoryPlutoCache = parsed;
      memoryPlutoTime = fs.statSync(readPath).mtimeMs || Date.now();
    }
  }
} catch (eDisk) {
  memoryPlutoCache = null;
}

if (!memoryPlutoCache && defaultBundledPluto && defaultBundledPluto.length > 0) {
  memoryPlutoCache = defaultBundledPluto;
  memoryPlutoTime = Date.now();
}

function fetchPlutoRemote(callback) {
  var url = 'https://api.pluto.tv/v2/channels';
  var opts = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36 SmartTVHub/2.0'
    }
  };

  var req = https.get(url, opts, function (res) {
    if (res.statusCode !== 200) {
      return callback(new Error('Pluto API HTTP ' + res.statusCode));
    }

    var data = '';
    res.on('data', function (c) { data += c; });
    res.on('end', function () {
      try {
        var raw = JSON.parse(data);
        var channels = raw.filter(function (c) {
          return c && c._id && c.name && !c.plutoOfficeOnly && c.visibility !== 'hidden';
        });

        var catMap = [
          {
            name: 'Pluto TV: Películas y Cine 24/7',
            match: function (c) { return c.category === 'Películas'; }
          },
          {
            name: 'Pluto TV: Series y Retro',
            match: function (c) { return c.category === 'Series' || c.category === 'Retro'; }
          },
          {
            name: 'Pluto TV: Animé y Gaming',
            match: function (c) { return c.category === 'Animé & Gaming' || c.category === 'Anime'; }
          },
          {
            name: 'Pluto TV: Dibujos Animados e Infantil',
            match: function (c) { return c.category === 'Kids' || c.category === 'Teen'; }
          },
          {
            name: 'Pluto TV: Deportes y Competencia',
            match: function (c) { return c.category === 'Deportes' || c.category === 'Competencia'; }
          },
          {
            name: 'Pluto TV: Comedia y South Park',
            match: function (c) {
              return c.category === 'Comedia' || (c.category && c.category.toLowerCase().indexOf('south park') !== -1);
            }
          },
          {
            name: 'Pluto TV: Documentales, Ciencia y Misterio',
            match: function (c) { return c.category === 'Curiosidad'; }
          },
          {
            name: 'Pluto TV: Noticias e Investigación',
            match: function (c) { return c.category === 'Noticias' || c.category === 'Investigación'; }
          },
          {
            name: 'Pluto TV: Música y Conciertos',
            match: function (c) {
              return c.category && (c.category.toLowerCase().indexOf('músic') !== -1 || c.category.toLowerCase().indexOf('music') !== -1);
            }
          },
          {
            name: 'Pluto TV: Entretenimiento, Reality y Novelas',
            match: function (c) {
              return c.category === 'Reality' || c.category === 'Novelas' || c.category === 'Estilo de Vida' || c.category === 'Entretenimiento';
            }
          }
        ];

        var result = [];
        var assigned = {};

        for (var g = 0; g < catMap.length; g++) {
          var group = catMap[g];
          var items = [];

          for (var i = 0; i < channels.length; i++) {
            var ch = channels[i];
            if (group.match(ch)) {
              assigned[ch._id] = true;
              var logo = (ch.colorLogoPNG && ch.colorLogoPNG.path) ||
                         (ch.featuredImage && ch.featuredImage.path) ||
                         (ch.thumbnail && ch.thumbnail.path) || '';

              var cleanSummary = ch.summary ? ch.summary.trim() : ch.name;

              items.push({
                id: ch._id,
                number: ch.number || 0,
                title: ch.name,
                subtitle: (ch.category || 'Pluto TV') + ' • Señal Oficial HD',
                overview: cleanSummary,
                category: group.name,
                thumb: logo,
                streamUrl: '/api/pluto-stream?id=' + ch._id + '&ext=.m3u8',
                type: 'hls',
                provider: 'pluto'
              });
            }
          }

          items.sort(function (a, b) {
            return (a.number || 9999) - (b.number || 9999);
          });

          if (items.length > 0) {
            result.push({
              category: group.name,
              items: items
            });
          }
        }

        // Otros canales no asignados
        var others = [];
        for (var k = 0; k < channels.length; k++) {
          var otherCh = channels[k];
          if (!assigned[otherCh._id]) {
            var otherLogo = (otherCh.colorLogoPNG && otherCh.colorLogoPNG.path) ||
                            (otherCh.featuredImage && otherCh.featuredImage.path) ||
                            (otherCh.thumbnail && otherCh.thumbnail.path) || '';
            others.push({
              id: otherCh._id,
              number: otherCh.number || 0,
              title: otherCh.name,
              subtitle: (otherCh.category || 'Pluto TV') + ' • Señal Oficial HD',
              overview: otherCh.summary || otherCh.name,
              category: 'Pluto TV: Más Canales',
              thumb: otherLogo,
              streamUrl: '/api/pluto-stream?id=' + otherCh._id + '&ext=.m3u8',
              type: 'hls',
              provider: 'pluto'
            });
          }
        }

        if (others.length > 0) {
          result.push({
            category: 'Pluto TV: Más Canales Exclusivos',
            items: others
          });
        }

        if (result.length >= 5) {
          memoryPlutoCache = result;
          memoryPlutoTime = Date.now();

          // Persistir en disco
          try {
            var writePath = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) ? TMP_PLUTO_FILE : BUNDLED_PLUTO_FILE;
            fs.writeFileSync(writePath, JSON.stringify(result, null, 2), 'utf8');
          } catch (eSave) {}
        }

        callback(null, memoryPlutoCache || result);
      } catch (parseErr) {
        callback(parseErr);
      }
    });
  });

  req.on('error', function (err) {
    callback(err);
  });

  req.setTimeout(9000, function () {
    try { req.destroy(); } catch (e) {}
    callback(new Error('Timeout fetching Pluto TV channels'));
  });
}

function getPlutoCategories(callback) {
  // 1. Respuesta instantánea si está en memoria o bundled (0ms)
  if (memoryPlutoCache && memoryPlutoCache.length >= 5) {
    callback(null, memoryPlutoCache);

    // Revalidación en segundo plano tras 24h
    if (!isRefreshingPluto && (Date.now() - memoryPlutoTime > CACHE_TTL_MS)) {
      isRefreshingPluto = true;
      fetchPlutoRemote(function () {
        isRefreshingPluto = false;
      });
    }
    return;
  }

  // 2. Primera carga remota con fallback asegurado
  fetchPlutoRemote(function (err, data) {
    if (err) {
      if (defaultBundledPluto && defaultBundledPluto.length > 0) {
        return callback(null, defaultBundledPluto);
      }
      return callback(err);
    }
    callback(null, data);
  });
}

module.exports = {
  getPlutoCategories: getPlutoCategories,
  fetchPlutoRemote: fetchPlutoRemote
};

