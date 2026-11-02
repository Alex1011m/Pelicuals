// lib/scrapers/tyanime.js
// Proveedor de Scraping: TYanime (tyanime.net)
// Especializado en Anime en Emisión, Directorio y Episodios completos (Sub y Latino)
var https = require('https');
var cheerio = require('cheerio');

var BASE_URL = 'https://tyanime.net';

function fetchLocation(url, referer, callback) {
  var called = false;
  function done(err, result) {
    if (called) return;
    called = true;
    callback(err, result);
  }

  try {
    var u = new URL(url);
    var options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer || 'https://streamtape.com/',
        'Accept': '*/*'
      }
    };
    var req = https.get(options, function (res) {
      if (res.headers.location) {
        return done(null, res.headers.location);
      }
      done(null, url);
    });
    req.on('error', function () { done(null, url); });
    req.setTimeout(4000, function () {
      try { req.destroy(); } catch (e) {}
      done(null, url);
    });
  } catch (e) {
    done(null, url);
  }
}

function fetchText(url, referer, callback) {
  var called = false;
  function done(err, result) {
    if (called) return;
    called = true;
    callback(err, result);
  }

  try {
    var u = new URL(url);
    var options = {
      hostname: u.hostname,
      port: u.port || 443,
      path: u.pathname + u.search,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': referer || (BASE_URL + '/directorio'),
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    };

    var req = https.get(options, function (res) {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        var nextUrl = res.headers.location.indexOf('http') === 0 ? res.headers.location : new URL(res.headers.location, url).href;
        return fetchText(nextUrl, referer, done);
      }
      if (res.statusCode !== 200) {
        return done(new Error('HTTP Status ' + res.statusCode));
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
  } catch (e) {
    done(e);
  }
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

function parseCards(html) {
  var $ = cheerio.load(html);
  var items = [];
  $('a[href*="/anime/"]').each(function (_, a) {
    var href = $(a).attr('href') || '';
    var match = href.match(/\/anime\/(\d+\/[^/?#]+)/);
    if (!match) return;

    var slug = match[1];
    var title = $(a).find('.title').text().trim() || $(a).text().trim();
    title = title.replace(/^(Anime|Ova|Película)\s+/i, '').replace(/\s+/g, ' ').trim();
    if (!title) return;

    var img = $(a).find('img').attr('src') || $(a).find('img').attr('data-src') || '';
    if (img && img.indexOf('//') === 0) img = 'https:' + img;
    else if (img && img.indexOf('/') === 0) img = BASE_URL + img;

    items.push({
      id: slug,
      title: title,
      kind: 'serie',
      slug: slug,
      year: 'Anime',
      rating: '8.5',
      poster: img || 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80',
      overview: 'Serie de Anime en TYanime con episodios completos en HD.',
      provider: 'tyanime'
    });
  });
  return items;
}

module.exports = {
  id: 'tyanime',
  name: 'TYanime',

  getCatalog: function (callback) {
    var allDirectorio = [];
    var allEmision = [];
    var tasks = [];

    // 1. Obtener 5 páginas completas del directorio general de anime (100 títulos)
    [1, 2, 3, 4, 5].forEach(function (page) {
      tasks.push(function (next) {
        fetchText(BASE_URL + '/directorio?page=' + page, null, function (err, html) {
          if (!err && html) {
            allDirectorio = allDirectorio.concat(parseCards(html));
          }
          next();
        });
      });
    });

    // 2. Obtener 3 páginas de animes en emisión activa (60 títulos)
    [1, 2, 3].forEach(function (page) {
      tasks.push(function (next) {
        fetchText(BASE_URL + '/directorio?status=En+emisi%C3%B3n&page=' + page, null, function (err, html) {
          if (!err && html) {
            allEmision = allEmision.concat(parseCards(html));
          }
          next();
        });
      });
    });

    var pending = tasks.length;
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      var rows = [
        {
          title: "Anime: Directorio y Novedades",
          items: allDirectorio
        }
      ];
      if (allEmision.length > 0) {
        rows.push({
          title: "Anime: En Emisión y Nuevos Episodios",
          items: allEmision
        });
      }
      callback(null, rows);
    }

    var timeout = setTimeout(finish, 5000);

    for (var i = 0; i < tasks.length; i++) {
      tasks[i](function () {
        pending--;
        if (pending <= 0) {
          clearTimeout(timeout);
          finish();
        }
      });
    }
  },

  getByGenre: function (genreSlug, page, callback) {
    var url = BASE_URL + '/directorio?genero%5B%5D=' + encodeURIComponent(genreSlug) + '&page=' + (page || 1);
    fetchText(url, null, function (err, html) {
      if (err || !html) {
        return callback(null, []);
      }
      callback(null, parseCards(html));
    });
  },

  search: function (query, callback) {
    var searchUrl = BASE_URL + '/directorio?q=' + encodeURIComponent(query);
    fetchText(searchUrl, null, function (err, html) {
      if (err || !html) {
        return callback(err || new Error('Error al buscar en TYanime'));
      }
      callback(null, parseCards(html));
    });
  },

  getDetail: function (kind, slug, callback) {
    var detailUrl = BASE_URL + '/anime/' + slug;
    fetchText(detailUrl, null, function (err, html) {
      if (err || !html) {
        return callback(err || new Error('Error al obtener detalle en TYanime'));
      }

      var $ = cheerio.load(html);
      var title = $('h1.title, h1').first().text().trim() || slug.replace(/^\d+\//, '').replace(/-/g, ' ');
      var synopsis = $('.sinopsis, .overview, p.text-muted, p.text-justify').first().text().trim() || 'Sinopsis disponible en TYanime.';
      var cover = $('.thumb img, .cover img, img[src*="covers"]').first().attr('src') || '';
      if (cover && cover.indexOf('//') === 0) cover = 'https:' + cover;
      else if (cover && cover.indexOf('/') === 0) cover = BASE_URL + cover;

      var epCount = 0;
      $('a[href*="/episodio/"]').each(function () {
        epCount++;
      });

      callback(null, {
        id: slug,
        title: title,
        overview: synopsis,
        year: 'Anime HD',
        kind: 'serie',
        poster: cover,
        backdrop: cover,
        player_url: null,
        seasons_count: 1,
        episodes_count: epCount,
        provider: 'tyanime'
      });
    });
  },

  getEpisodes: function (itemId, season, callback) {
    var detailUrl = BASE_URL + '/anime/' + itemId;
    fetchText(detailUrl, null, function (err, html) {
      if (err || !html) {
        return callback(err || new Error('Error al obtener episodios en TYanime'));
      }

      var $ = cheerio.load(html);
      var cover = $('.thumb img, .cover img, img[src*="covers"]').first().attr('src') || '';
      if (cover && cover.indexOf('//') === 0) cover = 'https:' + cover;
      else if (cover && cover.indexOf('/') === 0) cover = BASE_URL + cover;

      var rawEpisodes = [];
      $('a[href*="/episodio/"]').each(function (_, a) {
        var href = $(a).attr('href') || '';
        if (href.indexOf('//') === 0) href = 'https:' + href;
        else if (href.indexOf('/') === 0) href = BASE_URL + href;

        var fullText = $(a).text().trim().replace(/\s+/g, ' ');
        var epMatch = href.match(/[-_](\d+)$/) || fullText.match(/Episodio\s+(\d+)/i) || fullText.match(/(\d+)/);
        var epNum = epMatch ? parseInt(epMatch[1], 10) : (rawEpisodes.length + 1);

        rawEpisodes.push({
          season: 1,
          episode: epNum,
          title: 'Episodio ' + epNum,
          overview: fullText,
          player_url: href,
          thumb: cover,
          provider: 'tyanime'
        });
      });

      // Ordenar episodios de 1 a N
      rawEpisodes.sort(function (a, b) {
        return a.episode - b.episode;
      });

      callback(null, rawEpisodes);
    });
  },

  resolve: function (playerUrl, callback) {
    var called = false;
    function done(err, result) {
      if (called) return;
      called = true;
      callback(err, result);
    }

    fetchText(playerUrl, BASE_URL, function (err, epHtml) {
      if (err || !epHtml) {
        return done(err || new Error('No se pudo cargar el episodio de TYanime'));
      }

      // 1. Extraer el array de videos (servidores) embebido en el script
      var match = epHtml.match(/var\s+videos\s*=\s*(\[[^;]+\]);/);
      if (!match) {
        var $ = cheerio.load(epHtml);
        var directIframe = $('iframe').attr('src');
        if (directIframe) {
          if (directIframe.indexOf('//') === 0) directIframe = 'https:' + directIframe;
          return done(null, { streamUrl: directIframe, type: 'mp4' });
        }
        return done(new Error('No se encontraron reproductores en el episodio'));
      }

      var videosArr = [];
      try {
        videosArr = JSON.parse(match[1]);
      } catch (e) {
        try {
          eval('videosArr = ' + match[1]);
        } catch (e2) {
          return done(new Error('Error al parsear servidores de TYanime'));
        }
      }

      if (!videosArr || videosArr.length === 0) {
        return done(new Error('Lista de servidores vacía'));
      }

      // Priorizar servidores universales y confiables: F1S-TAPE (streamtape directo con CORS y puerto 443), FYUP (yourupload), F6 (mp4upload)
      var priorityMap = {
        'F1S-TAPE': 1, // streamtape (HTTPS 443, directo con CORS *)
        'FYUP': 2,     // yourupload (Rápido, universal vía proxy)
        'F6': 3,       // mp4upload
        'FMM-SB': 4,   // streamwish HLS
        'F1S-DOD': 5,  // doodstream
        'F0': 6,
        'F0L': 7
      };

      videosArr.sort(function (a, b) {
        var pA = (a && a[0] && priorityMap[a[0]]) ? priorityMap[a[0]] : 99;
        var pB = (b && b[0] && priorityMap[b[0]]) ? priorityMap[b[0]] : 99;
        return pA - pB;
      });

      var index = 0;

      function tryNextServer() {
        if (index >= videosArr.length) {
          return done(new Error('No se pudo extraer stream reproducible de ningún servidor de TYanime'));
        }

        var s = videosArr[index++];
        var embedUrl = s[1];
        if (!embedUrl) return tryNextServer();
        if (embedUrl.indexOf('//') === 0) embedUrl = 'https:' + embedUrl;

        fetchText(embedUrl, playerUrl, function (err2, wrapperHtml) {
          if (err2 || !wrapperHtml) {
            return tryNextServer();
          }

          var targetMatch = wrapperHtml.match(/window\.location\.href\s*=\s*['"]([^'"]+)['"]/i) ||
                            wrapperHtml.match(/<iframe[^>]+src=['"]([^'"]+)['"]/i);
          var targetUrl = targetMatch ? targetMatch[1] : null;

          if (!targetUrl) {
            return tryNextServer();
          }

          // A. Si el servidor es mp4upload
          if (targetUrl.indexOf('mp4upload.com') !== -1) {
            fetchText(targetUrl, embedUrl, function (err3, mp4Html) {
              if (!err3 && mp4Html) {
                var mp4Match = mp4Html.match(/src:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i) ||
                               mp4Html.match(/(https?:\/\/[^'"\s<>]+\.mp4(?:\?[^'"\s<>]*)?)/i);
                if (mp4Match) {
                  var rawMp4 = mp4Match[1] || mp4Match[0];
                  var proxyMp4 = '/api/video-stream?url=' + encodeURIComponent(rawMp4) + '&ref=' + encodeURIComponent('https://www.mp4upload.com/');
                  return done(null, {
                    streamUrl: proxyMp4,
                    backupUrl: rawMp4,
                    backups: [rawMp4],
                    type: 'mp4'
                  });
                }
              }
              tryNextServer();
            });
            return;
          }

          // B. Si el servidor es uqload
          if (targetUrl.indexOf('uqload') !== -1) {
            fetchText(targetUrl, embedUrl, function (err4, uqHtml) {
              if (!err4 && uqHtml) {
                var unp = unpack(uqHtml) || uqHtml;
                var uqMatch = unp.match(/(https?:\/\/[^'"\s<>]+\.(?:m3u8|mp4)[^'"\s<>?]*)/i);
                if (uqMatch) {
                  var isHls = uqMatch[1].indexOf('.m3u8') !== -1;
                  var uqStream = uqMatch[1];
                  if (!isHls) {
                    uqStream = '/api/video-stream?url=' + encodeURIComponent(uqStream) + '&ref=' + encodeURIComponent('https://uqload.to/');
                  }
                  return done(null, {
                    streamUrl: uqStream,
                    type: isHls ? 'hls' : 'mp4'
                  });
                }
              }
              tryNextServer();
            });
            return;
          }

          // C. Si el servidor es streamtape
          if (targetUrl.indexOf('streamtape.com') !== -1) {
            fetchText(targetUrl, embedUrl, function (err5, stHtml) {
              if (!err5 && stHtml) {
                var stMatch = stHtml.match(/getElementById\('robotlink'\)\.innerHTML\s*=\s*([^;]+);/);
                if (stMatch) {
                  try {
                    var finalLink = eval(stMatch[1]);
                    if (finalLink) {
                      if (finalLink.indexOf('//') === 0) finalLink = 'https:' + finalLink;
                      fetchLocation(finalLink, targetUrl, function (errLoc, cdnUrl) {
                        var tapeStream = cdnUrl || finalLink;
                        var proxyTape = '/api/video-stream?url=' + encodeURIComponent(tapeStream) + '&ref=' + encodeURIComponent('https://streamtape.com/');
                        // Priorizar conexión directa HTTPS 443 con CORS nativo (*), con fallback a proxy
                        return done(null, {
                          streamUrl: tapeStream,
                          backupUrl: proxyTape,
                          backups: [proxyTape],
                          type: 'mp4'
                        });
                      });
                      return;
                    }
                  } catch (eEval) {}
                }
              }
              tryNextServer();
            });
            return;
          }

          // D. Si el servidor es yourupload
          if (targetUrl.indexOf('yourupload') !== -1) {
            fetchText(targetUrl, embedUrl, function (err6, yuHtml) {
              if (!err6 && yuHtml) {
                var yuMatch = yuHtml.match(/file:\s*['"](https?:\/\/[^'"]+\.mp4[^'"]*)['"]/i);
                if (yuMatch) {
                  var rawYu = yuMatch[1];
                  var proxyYu = '/api/video-stream?url=' + encodeURIComponent(rawYu) + '&ref=' + encodeURIComponent('https://www.yourupload.com/');
                  return done(null, {
                    streamUrl: proxyYu,
                    backupUrl: rawYu,
                    backups: [rawYu],
                    type: 'mp4'
                  });
                }
              }
              tryNextServer();
            });
            return;
          }

          // E. Servidores HLS genéricos (streamwish, filemoon, dood, etc.)
          if (targetUrl.indexOf('streamwish') !== -1 || targetUrl.indexOf('filemoon') !== -1 || targetUrl.indexOf('dood') !== -1) {
            fetchText(targetUrl, embedUrl, function (err7, genHtml) {
              if (!err7 && genHtml) {
                var unp = unpack(genHtml) || genHtml;
                var hlsMatch = unp.match(/(https?:\/\/[^'"\s<>]+\.m3u8[^'"\s<>?]*)/i) ||
                               unp.match(/file:\s*['"](https?:\/\/[^'"]+\.(?:m3u8|mp4)[^'"]*)['"]/i);
                if (hlsMatch) {
                  var stUrl = hlsMatch[1] || hlsMatch[0];
                  return done(null, {
                    streamUrl: stUrl,
                    type: stUrl.indexOf('.m3u8') !== -1 ? 'hls' : 'mp4'
                  });
                }
              }
              tryNextServer();
            });
            return;
          }

          // F. Si es un stream directo m3u8 o mp4 en la URL (excluyendo páginas /e/ o /embed/)
          if (targetUrl.indexOf('/e/') === -1 && targetUrl.indexOf('/embed') === -1) {
            var directStream = targetUrl.match(/https?:\/\/[^\s"'<>]+\.(?:m3u8|mp4)[^\s"'<>?]*(?:\?[^\s"'<>]*)?/i);
            if (directStream) {
              var isHlsDirect = directStream[0].indexOf('.m3u8') !== -1;
              return done(null, {
                streamUrl: directStream[0],
                type: isHlsDirect ? 'hls' : 'mp4'
              });
            }
          }

          // Probar siguiente servidor disponible
          tryNextServer();
        });
      }

      tryNextServer();
    });
  }
};
