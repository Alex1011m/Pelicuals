// api/movies.js
// Vercel Serverless Function & Local Router para Catálogo y Búsqueda Multi-Proveedor
var scraperManager = require('../lib/scrapers');

module.exports = function (req, res) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');

  var action = req.query && req.query.action ? req.query.action : 'catalog';
  var providerId = req.query && req.query.provider ? req.query.provider : null;

  // 1. Listar proveedores disponibles
  if (action === 'providers') {
    return res.status(200).json({
      status: 'ok',
      providers: scraperManager.getProviders()
    });
  }

  // 2. Catálogo principal de películas y series
  if (action === 'catalog') {
    scraperManager.getCatalog(providerId, function (err, rows) {
      if (err || !rows) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener catálogo' });
      }
      res.status(200).json({ status: 'ok', rows: rows });
    });
    return;
  }

  // 3. Búsqueda unificada en todos los proveedores
  if (action === 'search') {
    var q = req.query.q;
    if (!q || !q.trim()) {
      return res.status(400).json({ status: 'error', message: 'Falta término de búsqueda' });
    }

    scraperManager.search(q.trim(), providerId, function (err, items) {
      if (err || !items) {
        return res.status(500).json({ status: 'error', message: 'Error en búsqueda' });
      }
      res.status(200).json({
        status: 'ok',
        query: q,
        total: items.length,
        items: items
      });
    });
    return;
  }

  // 4. Detalle de película o serie
  if (action === 'detail') {
    var kind = req.query.kind || 'movie';
    var slug = req.query.slug;
    var titleQuery = req.query.title;
    if (!slug && !titleQuery) return res.status(400).json({ status: 'error', message: 'Falta slug o título' });

    function tryGetDetail(targetSlug, cb) {
      scraperManager.getDetail(providerId, kind, targetSlug, function (err, data) {
        if (!err && data) {
          data.slug = data.slug || targetSlug;
          return cb(null, data);
        }
        cb(err || new Error('No detail'));
      });
    }

    var isNumericSlug = slug && /^\d+$/.test(String(slug).trim());

    if (slug && !isNumericSlug) {
      tryGetDetail(slug, function (err, data) {
        if (!err && data) {
          return res.status(200).json(Object.assign({ status: 'ok' }, data));
        }
        if (titleQuery) {
          fallbackSearch(titleQuery);
        } else {
          res.status(500).json({ status: 'error', message: 'Error al obtener detalles' });
        }
      });
    } else if (titleQuery || slug) {
      fallbackSearch(titleQuery || slug);
    } else {
      res.status(400).json({ status: 'error', message: 'Falta slug o título' });
    }

    function fallbackSearch(queryStr) {
      var cleanTitle = String(queryStr).replace(/\s*-\s*(?:piloto|temp\w*|ep\w*|episodio\w*|\d+).*$/i, '').trim();
      scraperManager.search(cleanTitle, providerId, function (errSearch, searchResults) {
        if (errSearch || !searchResults || searchResults.length === 0) {
          return res.status(500).json({ status: 'error', message: 'Error al obtener detalles' });
        }
        var match = null;
        if (isNumericSlug) {
          for (var s = 0; s < searchResults.length; s++) {
            if (String(searchResults[s].id) === String(slug)) {
              match = searchResults[s];
              break;
            }
          }
        }
        if (!match) {
          match = searchResults[0];
        }

        tryGetDetail(match.slug, function (err2, data2) {
          if (!err2 && data2) {
            return res.status(200).json(Object.assign({ status: 'ok' }, data2));
          }
          res.status(500).json({ status: 'error', message: 'Error al obtener detalles' });
        });
      });
    }
    return;
  }

  // 5. Lista de episodios de una serie
  if (action === 'episodes') {
    var itemId = req.query.item_id;
    var season = req.query.season || 1;
    if (!itemId) return res.status(400).json({ status: 'error', message: 'Falta item_id' });

    scraperManager.getEpisodes(providerId, itemId, season, function (err, episodes) {
      if (err || !episodes) {
        return res.status(500).json({ status: 'error', message: 'Error al obtener episodios' });
      }
      res.status(200).json({ status: 'ok', season: season, episodes: episodes });
    });
    return;
  }

  // 6. Extracción de stream directo para el reproductor de la TV
  if (action === 'resolve') {
    var playerUrl = req.query.player_url;
    if (!playerUrl) return res.status(400).json({ status: 'error', message: 'Falta player_url' });

    scraperManager.resolve(providerId, playerUrl, function (err, result) {
      if (err || !result) {
        return res.status(500).json({ status: 'error', message: err ? err.message : 'Fallo en extracción' });
      }
      res.status(200).json({
        status: 'ok',
        streamUrl: result.streamUrl,
        backupUrl: result.backupUrl || null,
        backups: result.backups || [],
        type: result.type || 'hls'
      });
    });
    return;
  }

  // 7. Búsqueda y extracción de tráiler oficial para el Banner Hero
  if (action === 'trailer') {
    var trailerQuery = req.query.q || req.query.title || req.query.slug;
    if (!trailerQuery) return res.status(400).json({ status: 'error', message: 'Falta parámetro q o title' });

    var youtubeModule = require('./youtube');
    youtubeModule.searchTrailer(trailerQuery, function (err, key) {
      if (err || !key) {
        return res.status(404).json({ status: 'error', message: err ? err.message : 'No encontrado' });
      }
      res.status(200).json({
        status: 'ok',
        key: key,
        embedUrl: 'https://www.youtube-nocookie.com/embed/' + key + '?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0&loop=1&playlist=' + key
      });
    });
    return;
  }

  res.status(400).json({ status: 'error', message: 'Acción no válida' });
};
