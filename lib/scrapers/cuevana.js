// lib/scrapers/cuevana.js
// Proveedor de Scraping: Cuevana 3 (cuevana3.fi)
var https = require('https');
var cheerio = require('cheerio');

var BASE_URL = 'https://cuevana3.fi';
var TMDB_IMG_BASE = 'https://image.tmdb.org/t/p/w342';

function fetchJson(url, referer, callback) {
  var called = false;
  function done(err, result) {
    if (called) return;
    called = true;
    callback(err, result);
  }

  var options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': referer || (BASE_URL + '/'),
      'Accept': 'application/json'
    }
  };

  var req = https.get(url, options, function (res) {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return fetchJson(res.headers.location, referer, done);
    }
    if (res.statusCode !== 200) {
      return done(new Error('Status: ' + res.statusCode));
    }
    var data = '';
    res.on('data', function (c) { data += c; });
    res.on('end', function () {
      try {
        var parsed = JSON.parse(data);
        done(null, parsed);
      } catch (e) {
        done(e);
      }
    });
  });

  req.on('error', function (err) { done(err); });
  req.setTimeout(8000, function () {
    try { req.destroy(); } catch (e) {}
    done(new Error('Timeout'));
  });
}

function fetchText(url, referer, callback) {
  var called = false;
  function done(err, result) {
    if (called) return;
    called = true;
    callback(err, result);
  }

  var options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Referer': referer || BASE_URL
    }
  };

  var req = https.get(url, options, function (res) {
    if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
      return fetchText(res.headers.location, referer, done);
    }
    var data = '';
    res.on('data', function (c) { data += c; });
    res.on('end', function () { done(null, data); });
  });

  req.on('error', function (err) { done(err); });
  req.setTimeout(8000, function () {
    try { req.destroy(); } catch (e) {}
    done(new Error('Timeout'));
  });
}

function unpack(code) {
  var match = code.match(/}\('([\s\S]*?)',(\d+),(\d+),'([\s\S]*?)'\.split\('\|'\)/);
  if (!match) return null;
  var p = match[1];
  var a = parseInt(match[2], 10);
  var c = parseInt(match[3], 10);
  var kArr = match[4].split('|');

  while (c--) {
    if (kArr[c]) {
      var reg = new RegExp('\\b' + c.toString(a) + '\\b', 'g');
      p = p.replace(reg, kArr[c]);
    }
  }
  return p;
}

function normalizeStreamUrl(u) {
  if (!u) return u;
  var srvMatch = u.match(/[?&]srv=(s\d+)/i);
  if (srvMatch && srvMatch[1]) {
    return u.replace(/https?:\/\/[a-zA-Z0-9_.-]+\.vimeos\.(?:zip|net)/i, 'https://' + srvMatch[1].toLowerCase() + '.vimeos.net');
  }
  return u.replace(/https?:\/\/[a-zA-Z0-9_.-]+\.vimeos\.zip/i, 'https://vimeos.net');
}

function getVimeosVariants(masterUrl) {
  if (!masterUrl) return null;
  var match = masterUrl.match(/^(https?:\/\/[^\/]+\/hls2\/[^\/]+\/[^\/]+\/)([a-zA-Z0-9_]+)_,([^.]+)\.urlset\/master\.m3u8(\?.*)?$/);
  if (!match) return null;
  var prefix = match[1];
  var mediaId = match[2];
  var query = match[4] || '';
  return {
    hd: prefix + mediaId + '_h/index-v1-a1.m3u8' + query,
    sd: prefix + mediaId + '_n/index-v1-a1.m3u8' + query
  };
}

module.exports = {
  id: 'cuevana',
  name: 'Cuevana 3',

  getCatalog: function (callback) {
    fetchJson(BASE_URL + '/api/rest/v1/home', BASE_URL + '/', function (err, data) {
      if (err || !data || !data.rows) {
        return callback(err || new Error('Error al cargar catálogo de Cuevana 3'));
      }

      var rows = data.rows.map(function (row) {
        var items = (row.items || []).map(function (it) {
          var poster = it.poster_path ? (TMDB_IMG_BASE + it.poster_path) : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80';
          return {
            id: it.catalog_item_id || it.id || it.slug,
            title: it.title || it.name,
            kind: it.kind || 'movie',
            slug: it.slug,
            year: it.year || '',
            rating: it.vote_average ? it.vote_average.toFixed(1) : '7.5',
            poster: poster,
            overview: it.overview || '',
            provider: 'cuevana'
          };
        });

        return {
          title: 'Cuevana 3: ' + (row.title || row.label || 'Estrenos'),
          items: items
        };
      });

      callback(null, rows);
    });
  },

  getByGenre: function (genreSlug, page, callback) {
    var url = BASE_URL + '/api/rest/v1/taxonomies/genre/' + encodeURIComponent(genreSlug) + '?page=' + (page || 1);
    fetchJson(url, BASE_URL + '/', function (err, data) {
      if (err || !data || !data.items) {
        return callback(null, []);
      }
      var items = data.items.map(function (it) {
        var poster = it.poster_path ? (TMDB_IMG_BASE + it.poster_path) : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80';
        return {
          id: it.catalog_item_id || it.id || it.slug,
          title: it.title || it.name,
          kind: it.kind || 'movie',
          slug: it.slug,
          year: it.year || '',
          rating: it.vote_average ? it.vote_average.toFixed(1) : '7.5',
          poster: poster,
          overview: it.overview || '',
          provider: 'cuevana'
        };
      });
      callback(null, items);
    });
  },

  getByListing: function (kind, page, callback) {
    var url = BASE_URL + '/api/rest/v1/listing?kind=' + encodeURIComponent(kind) + '&page=' + (page || 1);
    fetchJson(url, BASE_URL + '/', function (err, data) {
      if (err || !data || !data.items) {
        return callback(null, []);
      }
      var items = data.items.map(function (it) {
        var poster = it.poster_path ? (TMDB_IMG_BASE + it.poster_path) : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80';
        return {
          id: it.catalog_item_id || it.id || it.slug,
          title: it.title || it.name,
          kind: it.kind || kind,
          slug: it.slug,
          year: it.year || '',
          rating: it.vote_average ? it.vote_average.toFixed(1) : '7.5',
          poster: poster,
          overview: it.overview || '',
          provider: 'cuevana'
        };
      });
      callback(null, items);
    });
  },

  search: function (query, callback) {
    var searchUrl = BASE_URL + '/api/rest/v1/search?q=' + encodeURIComponent(query);
    fetchJson(searchUrl, BASE_URL + '/', function (err, data) {
      if (err || !data || !data.items) {
        return callback(err || new Error('Error al buscar en Cuevana 3'));
      }

      var results = data.items.map(function (it) {
        var poster = it.poster_path ? (TMDB_IMG_BASE + it.poster_path) : 'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=400&q=80';
        return {
          id: it.catalog_item_id || it.id || it.slug,
          title: it.title || it.name,
          kind: it.kind || 'movie',
          slug: it.slug,
          year: it.year || '',
          rating: it.vote_average ? it.vote_average.toFixed(1) : '7.5',
          poster: poster,
          overview: it.overview || '',
          provider: 'cuevana'
        };
      });

      callback(null, results);
    });
  },

  getDetail: function (kind, slug, callback) {
    var detailUrl = BASE_URL + '/api/rest/v1/content/' + encodeURIComponent(kind) + '/' + encodeURIComponent(slug);
    fetchJson(detailUrl, BASE_URL + '/', function (err, data) {
      if (err || !data || !data.item) {
        return callback(err || new Error('Error al obtener detalle en Cuevana 3'));
      }

      var it = data.item;
      var poster = it.poster_path ? (TMDB_IMG_BASE + it.poster_path) : '';
      var backdrop = it.backdrop_path ? ('https://image.tmdb.org/t/p/w780' + it.backdrop_path) : '';

      callback(null, {
        id: it.catalog_item_id || it.id,
        title: it.title || it.name,
        overview: it.overview || '',
        year: it.year || '',
        kind: it.kind || kind,
        poster: poster,
        backdrop: backdrop,
        player_url: it.player_url || null,
        seasons_count: it.number_of_seasons || (data.episode_seasons ? data.episode_seasons.length : 0),
        episodes_count: it.number_of_episodes || 0,
        provider: 'cuevana'
      });
    });
  },

  getEpisodes: function (itemId, season, callback) {
    var epUrl = BASE_URL + '/api/rest/v1/episodes?item_id=' + encodeURIComponent(itemId) + '&season=' + encodeURIComponent(season) + '&limit=40&page=1';
    fetchJson(epUrl, BASE_URL + '/', function (err, data) {
      if (err || !data || !data.episodes) {
        return callback(err || new Error('Error al obtener episodios en Cuevana 3'));
      }

      var episodes = data.episodes.map(function (ep) {
        var still = ep.still_path ? ('https://image.tmdb.org/t/p/w300' + ep.still_path) : '';
        return {
          season: ep.season,
          episode: ep.episode,
          title: ep.title || ('Episodio ' + ep.episode),
          overview: ep.overview || '',
          player_url: ep.player_url,
          thumb: still,
          provider: 'cuevana'
        };
      });

      callback(null, episodes);
    });
  },

  resolve: function (playerUrl, callback) {
    fetchText(playerUrl, BASE_URL, function (err, videoAppHtml) {
      if (err || !videoAppHtml) {
        return callback(err || new Error('No se pudo cargar el reproductor'));
      }

      var $ = cheerio.load(videoAppHtml);
      var iframeSrc = $('iframe').attr('src');
      if (!iframeSrc) {
        return callback(new Error('No se encontró iframe en el reproductor'));
      }

      fetchText(iframeSrc, 'https://videoapp.mov/', function (err2, iframeHtml) {
        if (err2 || !iframeHtml) {
          return callback(err2 || new Error('No se pudo cargar el iframe del servidor'));
        }

        var m3u8Direct = iframeHtml.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>?]*(?:\?[^\s"'<>]*)?/);
        if (m3u8Direct) {
          var cleanDirect = normalizeStreamUrl(m3u8Direct[0]);
          var variantsDirect = getVimeosVariants(cleanDirect);
          var bDirect = [];
          if (variantsDirect) {
            bDirect.push(variantsDirect.hd);
            bDirect.push(variantsDirect.sd);
          }
          return callback(null, {
            streamUrl: cleanDirect,
            backups: bDirect,
            type: 'hls'
          });
        }

        var $iframe = cheerio.load(iframeHtml);
        var resolvedUrl = null;

        $iframe('script').each(function (_, el) {
          var t = $iframe(el).html() || '';
          if (t.indexOf('eval(function(p,a,c,k,e,d)') !== -1) {
            var unp = unpack(t);
            if (unp) {
              var fileMatch = unp.match(/file:\s*["']([^"']+\.m3u8[^"']*)["']/) ||
                              unp.match(/https?:\/\/[^\s"'<>]+\.m3u8[^\s"'<>?]*(?:\?[^\s"'<>]*)?/);
              if (fileMatch) {
                resolvedUrl = fileMatch[1] || fileMatch[0];
              }
            }
          }
        });

        if (resolvedUrl) {
          var cleanUrl = normalizeStreamUrl(resolvedUrl);
          var variants = getVimeosVariants(cleanUrl);
          var backups = [];
          if (variants) {
            backups.push(variants.hd);
            backups.push(variants.sd);
          }
          return callback(null, {
            streamUrl: cleanUrl,
            backups: backups,
            type: 'hls'
          });
        }

        callback(new Error('No se pudo extraer el stream m3u8 de Cuevana'));
      });
    });
  }
};

