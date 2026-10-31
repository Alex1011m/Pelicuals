// api/channels.js
// Vercel Serverless Function & Local Router para Canales de TV en Vivo
// Integra canales oficiales de Pluto TV (HLS 1080p legal) + listas abiertas de IPTV por país y temática
var https = require('https');
var fs = require('fs');
var path = require('path');
var pluto = require('../lib/pluto');

var BUNDLED_CACHE_FILE = path.join(__dirname, '../lib/channels-cache.json');
var TMP_CACHE_FILE = path.join('/tmp', 'channels-cache.json');
var CACHE_TTL_MS = 24 * 60 * 60 * 1000; // 24 horas de caché en disco

var memoryCache = null;
var memoryCacheTime = 0;
var isRefreshing = false;

var THUMBS = {
  espana: 'https://images.unsplash.com/photo-1543783207-ec64e4d95325?w=400&q=80',
  mexico: 'https://images.unsplash.com/photo-1518638150340-f706e86654de?w=400&q=80',
  argentina: 'https://images.unsplash.com/photo-1589553416260-f586c8f1514f?w=400&q=80',
  latam: 'https://images.unsplash.com/photo-1522869635100-9f4c5e86aa37?w=400&q=80',
  cine: 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80',
  deportes: 'https://images.unsplash.com/photo-1461896836934-ffe607ba8211?w=400&q=80',
  noticias: 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=400&q=80',
  infantil: 'https://images.unsplash.com/photo-1534447677768-be436bb09401?w=400&q=80',
  musica: 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=400&q=80',
  documental: 'https://images.unsplash.com/photo-1451187580459-43490279c0fa?w=400&q=80'
};

// Carga directa bundled con require para garantizar empaquetado en Vercel
var defaultBundledChannels = null;
try {
  defaultBundledChannels = require('../lib/channels-cache.json');
} catch (eBundled) {
  defaultBundledChannels = null;
}

function normalizeCategories(raw) {
  if (!raw) return null;
  if (Array.isArray(raw)) return raw;
  if (raw.categories && Array.isArray(raw.categories)) return raw.categories;
  return null;
}

// Cargar caché local desde disco al iniciar para disponibilidad instantánea (0ms)
try {
  var readDiskPath = fs.existsSync(TMP_CACHE_FILE) ? TMP_CACHE_FILE : (fs.existsSync(BUNDLED_CACHE_FILE) ? BUNDLED_CACHE_FILE : null);
  if (readDiskPath) {
    var rawDisk = fs.readFileSync(readDiskPath, 'utf8');
    var parsed = normalizeCategories(JSON.parse(rawDisk));
    if (parsed && parsed.length >= 4) {
      memoryCache = parsed;
      memoryCacheTime = fs.statSync(readDiskPath).mtimeMs || Date.now();
    }
  }
} catch (eInit) {
  memoryCache = null;
}

if (!memoryCache) {
  var normBundled = normalizeCategories(defaultBundledChannels);
  if (normBundled && normBundled.length > 0) {
    memoryCache = normBundled;
    memoryCacheTime = Date.now();
  }
}

function fetchText(url, callback) {
  var called = false;
  function done(err, res) {
    if (called) return;
    called = true;
    callback(err, res);
  }

  try {
    var req = https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0 (SmartTV Hub)' } }, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        return fetchText(res.headers.location, done);
      }
      if (res.statusCode !== 200) {
        return done(new Error('Status: ' + res.statusCode));
      }
      var data = '';
      res.on('data', function (c) { data += c; });
      res.on('end', function () { done(null, data); });
    });

    req.on('error', function (err) { done(err); });
    req.setTimeout(8000, function () {
      try { req.destroy(); } catch (e) { }
      done(new Error('Timeout'));
    });
  } catch (e) {
    done(e);
  }
}

function parseM3U(m3uText, defaultSubtitle, fallbackThumb) {
  if (!m3uText) return [];
  var lines = m3uText.split('\n');
  var list = [];
  var cur = null;

  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (line.indexOf('#EXTINF:') === 0) {
      var lastComma = line.lastIndexOf(',');
      var rawTitle = lastComma !== -1 ? line.substring(lastComma + 1).trim() : '';
      var logoMatch = line.match(/tvg-logo="([^"]*)"/);
      var groupMatch = line.match(/group-title="([^"]*)"/);
      var idMatch = line.match(/tvg-id="([^"]*)"/);

      // Limpiar etiquetas técnicas y emojis
      var cleanTitle = rawTitle
        .replace(/\[Geo-blocked\]/gi, '')
        .replace(/\s*\[[^\]]+\]/g, '')
        .replace(/\s*\(\d+p\)/gi, '')
        .replace(/[\uD800-\uDFFF]|\u200D|[\u2600-\u27BF]/g, '')
        .trim();

      var logo = logoMatch ? logoMatch[1] : '';
      if (/enhd\.ar|fmcosmos\.com|chikitoonz\.com|aparatchi\.com|paste\.pics/.test(logo)) {
        logo = fallbackThumb;
      }
      if (!logo) logo = fallbackThumb;

      cur = {
        id: (idMatch ? idMatch[1] : cleanTitle).replace(/[^a-zA-Z0-9_-]/g, '_'),
        title: cleanTitle,
        subtitle: (groupMatch && groupMatch[1] && groupMatch[1] !== 'Undefined') ? groupMatch[1] : defaultSubtitle,
        thumb: logo,
        rawTitle: rawTitle,
        provider: 'iptv'
      };
    } else if (line.indexOf('http') === 0 && cur) {
      if (line.indexOf('127.0.0.1') === -1 &&
          line.indexOf('192.168.') === -1 &&
          line.indexOf('10.0.') === -1 &&
          line.indexOf('nimblesessionid') === -1 &&
          line.indexOf('gpcdn.net') === -1 &&
          cur.rawTitle.toLowerCase().indexOf('[geo-blocked]') === -1) {
        cur.streamUrl = line;
        cur.type = 'hls';
        list.push(cur);
      }
      cur = null;
    }
  }
  return list;
}

function deduplicateChannels(items, maxCount) {
  var seen = {};
  var result = [];
  for (var i = 0; i < items.length; i++) {
    var it = items[i];
    var key = it.streamUrl;
    if (key && !seen[key]) {
      seen[key] = true;
      result.push(it);
      if (maxCount && result.length >= maxCount) break;
    }
  }
  return result;
}

function refreshChannelsFromRemote(onComplete) {
  var sources = [
    { key: 'es', url: 'https://iptv-org.github.io/iptv/countries/es.m3u' },
    { key: 'mx', url: 'https://iptv-org.github.io/iptv/countries/mx.m3u' },
    { key: 'ar', url: 'https://iptv-org.github.io/iptv/countries/ar.m3u' },
    { key: 'co', url: 'https://iptv-org.github.io/iptv/countries/co.m3u' },
    { key: 'cl', url: 'https://iptv-org.github.io/iptv/countries/cl.m3u' },
    { key: 'pe', url: 'https://iptv-org.github.io/iptv/countries/pe.m3u' },
    { key: 'movies', url: 'https://iptv-org.github.io/iptv/categories/movies.m3u' },
    { key: 'sports', url: 'https://iptv-org.github.io/iptv/categories/sports.m3u' },
    { key: 'news', url: 'https://iptv-org.github.io/iptv/categories/news.m3u' },
    { key: 'kids', url: 'https://iptv-org.github.io/iptv/categories/kids.m3u' },
    { key: 'animation', url: 'https://iptv-org.github.io/iptv/categories/animation.m3u' },
    { key: 'music', url: 'https://iptv-org.github.io/iptv/categories/music.m3u' },
    { key: 'documentary', url: 'https://iptv-org.github.io/iptv/categories/documentary.m3u' }
  ];

  var rawData = {};
  var pending = sources.length;

  sources.forEach(function (src) {
    fetchText(src.url, function (err, text) {
      if (!err && text) rawData[src.key] = text;
      pending--;
      if (pending === 0) {
        var esChannels = parseM3U(rawData['es'], 'España', THUMBS.espana);
        var mxChannels = parseM3U(rawData['mx'], 'México', THUMBS.mexico);
        var arChannels = parseM3U(rawData['ar'], 'Argentina', THUMBS.argentina);

        var latamChannels = [].concat(
          parseM3U(rawData['co'], 'Colombia', THUMBS.latam),
          parseM3U(rawData['cl'], 'Chile', THUMBS.latam),
          parseM3U(rawData['pe'], 'Perú', THUMBS.latam)
        );

        var movieChannels = parseM3U(rawData['movies'], 'Cine', THUMBS.cine);
        var sportChannels = parseM3U(rawData['sports'], 'Deportes', THUMBS.deportes);
        var newsChannels = parseM3U(rawData['news'], 'Noticias', THUMBS.noticias);
        var kidsChannels = [].concat(
          parseM3U(rawData['kids'], 'Infantil', THUMBS.infantil),
          parseM3U(rawData['animation'], 'Animación', THUMBS.infantil)
        );
        var musicChannels = parseM3U(rawData['music'], 'Música', THUMBS.musica);
        var docChannels = parseM3U(rawData['documentary'], 'Documentales', THUMBS.documental);

        var categories = [
          {
            category: 'Televisión de España',
            items: deduplicateChannels(esChannels, 45)
          },
          {
            category: 'Televisión de México',
            items: deduplicateChannels(mxChannels, 45)
          },
          {
            category: 'Televisión de Argentina',
            items: deduplicateChannels(arChannels, 45)
          },
          {
            category: 'Latinoamérica en Vivo (Colombia, Chile, Perú)',
            items: deduplicateChannels(latamChannels, 50)
          },
          {
            category: 'Cine y Películas 24/7',
            items: deduplicateChannels(movieChannels, 45)
          },
          {
            category: 'Deportes en Vivo',
            items: deduplicateChannels(sportChannels, 45)
          },
          {
            category: 'Noticias en Vivo e Internacionales',
            items: deduplicateChannels(newsChannels, 45)
          },
          {
            category: 'Dibujos Animados e Infantil',
            items: deduplicateChannels(kidsChannels, 45)
          },
          {
            category: 'Música y Conciertos en Vivo',
            items: deduplicateChannels(musicChannels, 45)
          },
          {
            category: 'Documentales, Ciencia y Naturaleza',
            items: deduplicateChannels(docChannels, 45)
          }
        ];

        categories = categories.filter(function (c) {
          return c.items && c.items.length > 0;
        });

        if (categories.length >= 4) {
          memoryCache = categories;
          memoryCacheTime = Date.now();
          isRefreshing = false;

          try {
            var writePath = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) ? TMP_CACHE_FILE : BUNDLED_CACHE_FILE;
            fs.writeFileSync(writePath, JSON.stringify(categories, null, 2), 'utf8');
          } catch (eSave) { }
        }

        if (onComplete) onComplete(null, categories);
      }
    });
  });
}

function loadIptvChannels(callback) {
  if (memoryCache && memoryCache.length > 0) {
    callback(null, memoryCache);
    if (!isRefreshing && (Date.now() - memoryCacheTime > CACHE_TTL_MS)) {
      isRefreshing = true;
      refreshChannelsFromRemote(function () {
        isRefreshing = false;
      });
    }
    return;
  }

  isRefreshing = true;
  refreshChannelsFromRemote(function (err, cats) {
    if (err && normBundled) {
      return callback(null, normBundled);
    }
    callback(err, cats);
  });
}

function loadChannels(provider, callback) {
  loadIptvChannels(function (errIptv, iptvCats) {
    pluto.getPlutoCategories(function (errPluto, plutoCats) {
      var safePluto = (plutoCats && Array.isArray(plutoCats)) ? plutoCats : [];
      var safeIptv = (iptvCats && Array.isArray(iptvCats)) ? iptvCats : [];

      if (provider === 'pluto') {
        return callback(null, safePluto);
      }
      if (provider === 'iptv') {
        return callback(null, safeIptv);
      }

      // Por defecto: Señales oficiales de Pluto TV al inicio + Canales Abiertos de IPTV
      var combined = [].concat(safePluto, safeIptv);
      callback(null, combined);
    });
  });
}

module.exports = function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  var provider = (req.query && req.query.provider) ? req.query.provider.toLowerCase() : 'all';

  loadChannels(provider, function (err, categories) {
    if (err || !categories || categories.length === 0) {
      return res.status(500).json({
        status: 'error',
        message: 'Error al cargar canales de TV'
      });
    }

    res.status(200).json({
      status: 'ok',
      source: 'Pluto TV Oficial + IPTV Internacional',
      provider: provider,
      totalCategories: categories.length,
      categories: categories
    });
  });
};
