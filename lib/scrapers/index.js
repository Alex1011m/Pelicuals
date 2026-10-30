// lib/scrapers/index.js
// Administrador y Orquestador Multi-Proveedor Completo
// Extrae y organiza la totalidad del catálogo (PelisPedia, Cuevana 3, TYanime y Archive.org)
var fs = require('fs');
var path = require('path');
var pelispedia = require('./pelispedia');
var cuevana = require('./cuevana');
var archive = require('./archive');
var tyanime = require('./tyanime');

var BUNDLED_CACHE_FILE = path.join(__dirname, '..', 'movies-cache.json');
var TMP_CACHE_FILE = path.join('/tmp', 'movies-cache.json');
var CACHE_FILE = fs.existsSync(TMP_CACHE_FILE) ? TMP_CACHE_FILE : BUNDLED_CACHE_FILE;
var CACHE_TTL_MS = 60 * 60 * 1000; // 1 hora de caché fresca en disco

var providers = {
  pelispedia: pelispedia,
  cuevana: cuevana,
  archive: archive,
  tyanime: tyanime
};

function normalizeKey(str) {
  if (!str) return '';
  return String(str).toLowerCase().trim().replace(/[^a-z0-9]/g, '');
}

// Detector inteligente de calidad: Identifica grabaciones de cine con anuncios de apuestas (EpicBet / 1xBet)
function evaluateQuality(item) {
  // 1. Series, Anime y Cine Clásico de Archivo -> 100% Calidad digital limpia oficial
  if (item.kind === 'serie' || item.kind === 'anime' || item.kind === 'novela' || item.kind === 'wee' || item.provider === 'archive' || item.provider === 'tyanime') {
    return {
      code: 'HD',
      badge: 'HD 1080p',
      color: '#00e5ff',
      isCam: false,
      notice: 'Calidad digital oficial (Web / Streaming). Imagen nítida y audio limpio sin marcas de apuestas.'
    };
  }

  var fullText = ((item.title || '') + ' ' + (item.slug || '') + ' ' + (item.overview || '') + ' ' + (item.quality || '')).toLowerCase();
  var isCam = false;

  // 2. Detección por palabras clave en título, slug o metadatos
  if (/\b(cam|camrip|hdcam|ts|telesync|screener|scr|cine|sala|1xbet|epicbet|apuestas)\b/i.test(fullText)) {
    isCam = true;
  }

  // 3. Regla Temporal Universal de Estrenos de Cine:
  // Cualquier película del año en curso (>= 2026) en cartelera de cines
  var yearNum = parseInt(item.year, 10);
  if (!isNaN(yearNum) && yearNum >= 2026) {
    if (!/\b(web-dl|webrip|bluray|bdrip)\b/i.test(fullText)) {
      isCam = true;
    }
  }

  // 4. Lista complementaria de títulos de cartelera de cine conocidos
  var theatricalKeywords = [
    'street fighter', 'un nuevo dia', 'spider-man', 'scary movie', 'supergirl',
    'toy story 5', 'mandalorian', 'mario galaxy', 'la odisea', 'demon', 'bad boys',
    'carnage', 'venom', 'entrega al limite', 'el hombre que desafio al rey',
    'la noche del demonio', 'jackie the stripper', 'tenzing', 'mayday', 'carrera contra',
    'la captura', 'minions', 'wrestlemania', 'masterplan', 'obsesion', 'sunrise', 'hechizo de amor'
  ];
  for (var i = 0; i < theatricalKeywords.length; i++) {
    if (fullText.indexOf(theatricalKeywords[i]) !== -1) {
      isCam = true;
      break;
    }
  }

  if (isCam) {
    return {
      code: 'CAM',
      badge: 'CINE (CAM)',
      color: '#ff9800',
      isCam: true,
      notice: 'Grabada en sala de cine. Contiene audio de sala y marcas de agua/anuncios de apuestas.'
    };
  }

  return {
    code: 'HD',
    badge: 'HD 1080p',
    color: '#00e5ff',
    isCam: false,
    notice: 'Calidad digital oficial (WEB-DL / Bluray). Imagen nítida y audio limpio sin marcas de agua.'
  };
}

function deduplicate(items) {
  var seen = {};
  var result = [];
  for (var i = 0; i < (items || []).length; i++) {
    var it = items[i];
    var key = normalizeKey(it.title);
    if (key && !seen[key]) {
      seen[key] = true;
      it.qualityInfo = evaluateQuality(it);
      result.push(it);
    }
  }
  return result;
}

var catalogCache = null;
var catalogCacheTime = 0;
var isRefreshing = false;

// Cargar caché previa de disco al arrancar para disponibilidad inmediata (0ms)
try {
  if (fs.existsSync(CACHE_FILE)) {
    var rawCache = fs.readFileSync(CACHE_FILE, 'utf8');
    catalogCache = JSON.parse(rawCache);
    catalogCacheTime = fs.statSync(CACHE_FILE).mtimeMs || Date.now();
    console.log('[Scrapers] Caché de catálogo en disco cargada:', catalogCache.length, 'secciones.');
  }
} catch (e) {
  console.error('[Scrapers] No se pudo leer caché en disco previa:', e.message);
  catalogCache = null;
}

function runMultiPageScrape(onFinished) {
  var pRows = [], cRows = [], aRows = [], tyRows = [];
  var pMovies = [], cMovies = [];
  var pSeries = [], cSeries = [];
  var pNovelas = [], cNovelas = [];
  var pWee = [];
  var tyShounen = [], tyAccion = [], tyComedia = [];

  // PelisPedia géneros
  var accionItems = [], aventuraItems = [], scifiItems = [];
  var terrorItems = [], comediaItems = [], animacionItems = [];
  var dramaItems = [], crimenItems = [], documentalItems = [];

  // Cuevana 3 géneros
  var cAccion = [], cAventura = [], cScifi = [];
  var cTerror = [], cComedia = [], cAnimacion = [];
  var cDrama = [], cCrimen = [], cDocumental = [];

  var tasks = [];

  // 1. Catálogos Home de proveedores
  tasks.push(function (cb) { pelispedia.getCatalog(function (err, res) { if (!err && res) pRows = res; cb(); }); });
  tasks.push(function (cb) { cuevana.getCatalog(function (err, res) { if (!err && res) cRows = res; cb(); }); });
  tasks.push(function (cb) { archive.getCatalog(function (err, res) { if (!err && res) aRows = res; cb(); }); });
  tasks.push(function (cb) { tyanime.getCatalog(function (err, res) { if (!err && res) tyRows = res; cb(); }); });

  // 2. Múltiples páginas de Películas (PelisPedia 5 páginas + Cuevana 3 páginas = ~192 películas adicionales)
  [1, 2, 3, 4, 5].forEach(function (page) {
    tasks.push(function (cb) { pelispedia.getByListing('movie', page, function (err, res) { if (!err && res) pMovies = pMovies.concat(res); cb(); }); });
  });
  [1, 2, 3].forEach(function (page) {
    tasks.push(function (cb) { cuevana.getByListing('movie', page, function (err, res) { if (!err && res) cMovies = cMovies.concat(res); cb(); }); });
  });

  // 3. Múltiples páginas de Series de TV (PelisPedia 3 páginas + Cuevana 2 páginas = ~120 series)
  [1, 2, 3].forEach(function (page) {
    tasks.push(function (cb) { pelispedia.getByListing('tv', page, function (err, res) { if (!err && res) pSeries = pSeries.concat(res); cb(); }); });
  });
  [1, 2].forEach(function (page) {
    tasks.push(function (cb) { cuevana.getByListing('tv', page, function (err, res) { if (!err && res) cSeries = cSeries.concat(res); cb(); }); });
  });

  // 4. Múltiples páginas de Telenovelas y Doramas
  [1, 2].forEach(function (page) {
    tasks.push(function (cb) { pelispedia.getByListing('novela', page, function (err, res) { if (!err && res) pNovelas = pNovelas.concat(res); cb(); }); });
  });

  // 5. Múltiples páginas de WWE y Lucha Libre
  [1, 2].forEach(function (page) {
    tasks.push(function (cb) { pelispedia.getByListing('wee', page, function (err, res) { if (!err && res) pWee = pWee.concat(res); cb(); }); });
  });

  // 6. TYanime géneros Shounen y Acción
  [1, 2].forEach(function (page) {
    tasks.push(function (cb) { tyanime.getByGenre('shounen', page, function (err, res) { if (!err && res) tyShounen = tyShounen.concat(res); cb(); }); });
    tasks.push(function (cb) { tyanime.getByGenre('accion', page, function (err, res) { if (!err && res) tyAccion = tyAccion.concat(res); cb(); }); });
  });
  tasks.push(function (cb) { tyanime.getByGenre('comedia', 1, function (err, res) { if (!err && res) tyComedia = tyComedia.concat(res); cb(); }); });

  // 7. PelisPedia y Cuevana por Géneros (páginas 1 y 2 para cada categoría)
  [1, 2].forEach(function (page) {
    tasks.push(function (cb) { pelispedia.getByGenre('accion', page, function (err, res) { if (!err && res) accionItems = accionItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('accion', page, function (err, res) { if (!err && res) cAccion = cAccion.concat(res); cb(); }); });

    tasks.push(function (cb) { pelispedia.getByGenre('aventura', page, function (err, res) { if (!err && res) aventuraItems = aventuraItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('aventura', page, function (err, res) { if (!err && res) cAventura = cAventura.concat(res); cb(); }); });

    tasks.push(function (cb) { pelispedia.getByGenre('ciencia-ficcion', page, function (err, res) { if (!err && res) scifiItems = scifiItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('ciencia-ficcion', page, function (err, res) { if (!err && res) cScifi = cScifi.concat(res); cb(); }); });

    tasks.push(function (cb) { pelispedia.getByGenre('terror', page, function (err, res) { if (!err && res) terrorItems = terrorItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('terror', page, function (err, res) { if (!err && res) cTerror = cTerror.concat(res); cb(); }); });

    tasks.push(function (cb) { pelispedia.getByGenre('comedia', page, function (err, res) { if (!err && res) comediaItems = comediaItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('comedia', page, function (err, res) { if (!err && res) cComedia = cComedia.concat(res); cb(); }); });

    tasks.push(function (cb) { pelispedia.getByGenre('animacion', page, function (err, res) { if (!err && res) animacionItems = animacionItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('animacion', page, function (err, res) { if (!err && res) cAnimacion = cAnimacion.concat(res); cb(); }); });

    tasks.push(function (cb) { pelispedia.getByGenre('drama', page, function (err, res) { if (!err && res) dramaItems = dramaItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('drama', page, function (err, res) { if (!err && res) cDrama = cDrama.concat(res); cb(); }); });

    tasks.push(function (cb) { pelispedia.getByGenre('crimen', page, function (err, res) { if (!err && res) crimenItems = crimenItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('crimen', page, function (err, res) { if (!err && res) cCrimen = cCrimen.concat(res); cb(); }); });

    tasks.push(function (cb) { pelispedia.getByGenre('documental', page, function (err, res) { if (!err && res) documentalItems = documentalItems.concat(res); cb(); }); });
    tasks.push(function (cb) { cuevana.getByGenre('documental', page, function (err, res) { if (!err && res) cDocumental = cDocumental.concat(res); cb(); }); });
  });

  var pending = tasks.length;
  var finished = false;

  function finalize() {
    if (finished) return;
    finished = true;
    clearTimeout(safetyTimer);

    // 1. Estrenos y Cartelera Recién Añadidos
    var estrenosItems = [].concat(
      (cRows[0] && cRows[0].items) ? cRows[0].items : [],
      (pRows[0] && pRows[0].items) ? pRows[0].items : [],
      (cRows[1] && cRows[1].items) ? cRows[1].items : []
    );

    // 2. Películas Populares y Tendencias
    var peliculasPopulares = [].concat(
      (pRows[1] && pRows[1].items) ? pRows[1].items : [],
      pMovies,
      cMovies
    );

    // 3. Series de TV: Recién Añadidas
    var seriesRecientes = [].concat(
      (pRows[2] && pRows[2].items) ? pRows[2].items : [],
      pSeries,
      (cRows[2] && cRows[2].items) ? cRows[2].items : []
    );

    // 4. Series de TV Populares
    var seriesPopulares = [].concat(
      (pRows[3] && pRows[3].items) ? pRows[3].items : [],
      cSeries,
      (cRows[2] && cRows[2].items) ? cRows[2].items.slice(10) : []
    );

    // 5. Anime Colección Completa
    var animeTotal = [].concat(
      (tyRows[0] && tyRows[0].items) ? tyRows[0].items : [],
      (tyRows[1] && tyRows[1].items) ? tyRows[1].items : [],
      tyShounen,
      tyAccion,
      (pRows[4] && pRows[4].items) ? pRows[4].items : [],
      (pRows[5] && pRows[5].items) ? pRows[5].items : [],
      (cRows[3] && cRows[3].items) ? cRows[3].items : []
    );

    // 6. Telenovelas y Doramas
    var novelasTotal = [].concat(
      pNovelas,
      (pRows[6] && pRows[6].items) ? pRows[6].items : [],
      (cRows[4] && cRows[4].items) ? cRows[4].items : []
    );

    // 7. WWE, Lucha Libre y Deportes de Combate
    var weeTotal = [].concat(
      pWee,
      (pRows[7] && pRows[7].items) ? pRows[7].items : [],
      (cRows[5] && cRows[5].items) ? cRows[5].items : []
    );

    // 8. Acción y Aventura
    var accionTotal = [].concat(cAccion, accionItems, cAventura, aventuraItems);

    // 9. Ciencia Ficción y Fantasía
    var scifiTotal = [].concat(cScifi, scifiItems);

    // 10. Terror, Misterio y Suspenso
    var terrorTotal = [].concat(cTerror, terrorItems);

    // 11. Comedia y Cine Familiar
    var comediaTotal = [].concat(cComedia, comediaItems, tyComedia);

    // 12. Animación e Infantil
    var animacionTotal = [].concat(cAnimacion, animacionItems);

    // 13. Drama y Cine Romántico
    var dramaTotal = [].concat(cDrama, dramaItems);

    // 14. Crimen, Policíaco y Suspense
    var crimenTotal = [].concat(cCrimen, crimenItems);

    // 15. Documentales y Vida Real
    var documentalTotal = [].concat(cDocumental, documentalItems);

    // 16. Cine Clásico & Dominio Público
    var clasicosItems = [];
    if (aRows[0] && aRows[0].items) {
      clasicosItems = clasicosItems.concat(aRows[0].items);
    }

    var categories = [
      {
        title: "Estrenos de Cine y Cartelera",
        items: deduplicate(estrenosItems)
      },
      {
        title: "Películas Populares y Tendencias",
        items: deduplicate(peliculasPopulares)
      },
      {
        title: "Series de TV: Recién Añadidas",
        items: deduplicate(seriesRecientes)
      },
      {
        title: "Series de TV Más Populares",
        items: deduplicate(seriesPopulares)
      },
      {
        title: "Anime: Colección Completa",
        items: deduplicate(animeTotal)
      },
      {
        title: "Anime: En Emisión y Nuevos Episodios",
        items: deduplicate((tyRows[1] && tyRows[1].items) ? tyRows[1].items : [])
      },
      {
        title: "Anime: Directorio y Novedades",
        items: deduplicate((tyRows[0] && tyRows[0].items) ? tyRows[0].items : [])
      },
      {
        title: "Telenovelas y Doramas",
        items: deduplicate(novelasTotal)
      },
      {
        title: "WWE y Deportes de Combate",
        items: deduplicate(weeTotal)
      },
      {
        title: "Acción y Aventura",
        items: deduplicate(accionTotal)
      },
      {
        title: "Ciencia Ficción y Fantasía",
        items: deduplicate(scifiTotal)
      },
      {
        title: "Terror, Misterio y Suspenso",
        items: deduplicate(terrorTotal)
      },
      {
        title: "Comedia y Humor",
        items: deduplicate(comediaTotal)
      },
      {
        title: "Películas de Animación e Infantiles",
        items: deduplicate(animacionTotal)
      },
      {
        title: "Drama y Cine Romántico",
        items: deduplicate(dramaTotal)
      },
      {
        title: "Crimen, Policíaco y Suspense",
        items: deduplicate(crimenTotal)
      },
      {
        title: "Documentales y Vida Real",
        items: deduplicate(documentalTotal)
      },
      {
        title: "Cine Clásico & Dominio Público",
        items: deduplicate(clasicosItems)
      }
    ];

    var finalCategories = categories.filter(function (cat) {
      return cat.items && cat.items.length > 0;
    });

    catalogCache = finalCategories;
    catalogCacheTime = Date.now();
    isRefreshing = false;

    // Guardar en caché permanente de disco
    try {
      var writePath = (process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME) ? TMP_CACHE_FILE : BUNDLED_CACHE_FILE;
      fs.writeFileSync(writePath, JSON.stringify(finalCategories, null, 2), 'utf8');
      console.log('[Scrapers] Catálogo completo guardado con éxito:', finalCategories.length, 'secciones.');
    } catch (errSave) {
      console.error('[Scrapers] Error al persistir catálogo:', errSave.message);
    }

    if (onFinished) onFinished(null, finalCategories);
  }

  var safetyTimer = setTimeout(finalize, 8000);

  for (var i = 0; i < tasks.length; i++) {
    (function (task) {
      try {
        task(function () {
          pending--;
          if (pending <= 0) finalize();
        });
      } catch (err) {
        pending--;
        if (pending <= 0) finalize();
      }
    })(tasks[i]);
  }
}

module.exports = {
  getProviders: function () {
    return Object.keys(providers).map(function (key) {
      return { id: providers[key].id, name: providers[key].name };
    });
  },

  getCatalog: function (providerId, callback) {
    if (providerId && providers[providerId]) {
      return providers[providerId].getCatalog(function (err, rows) {
        if (!err && rows) {
          for (var r = 0; r < rows.length; r++) {
            var items = rows[r].items || [];
            for (var i = 0; i < items.length; i++) {
              items[i].qualityInfo = evaluateQuality(items[i]);
            }
          }
        }
        callback(err, rows);
      });
    }

    // Si ya disponemos de catálogo en memoria/disco, responder de inmediato
    if (catalogCache && catalogCache.length > 0) {
      callback(null, catalogCache);

      // Si la caché está vencida o no se ha refrescado recientemente, actualizar en segundo plano
      if (!isRefreshing && (Date.now() - catalogCacheTime > CACHE_TTL_MS)) {
        isRefreshing = true;
        console.log('[Scrapers] Refrescando catálogo multi-página en segundo plano...');
        runMultiPageScrape(function () {});
      }
      return;
    }

    // Si es primera ejecución sin caché en disco, ejecutar scrape inicial
    isRefreshing = true;
    runMultiPageScrape(callback);
  },

  search: function (query, providerId, callback) {
    if (providerId && providers[providerId]) {
      return providers[providerId].search(query, callback);
    }

    var allResults = [];
    var pending = 4;

    function finish() {
      pending--;
      if (pending <= 0) {
        callback(null, deduplicate(allResults));
      }
    }

    pelispedia.search(query, function (err, items) {
      if (!err && items) allResults = allResults.concat(items);
      finish();
    });

    cuevana.search(query, function (err, items) {
      if (!err && items) allResults = allResults.concat(items);
      finish();
    });

    archive.search(query, function (err, items) {
      if (!err && items) allResults = allResults.concat(items);
      finish();
    });

    tyanime.search(query, function (err, items) {
      if (!err && items) allResults = allResults.concat(items);
      finish();
    });
  },

  getDetail: function (providerId, kind, slug, callback) {
    var p = providers[providerId] || pelispedia;
    p.getDetail(kind, slug, function (err, data) {
      if (!err && data) {
        data.qualityInfo = evaluateQuality(data);
      }
      callback(err, data);
    });
  },

  getEpisodes: function (providerId, itemId, season, callback) {
    if (typeof season === 'function') {
      callback = season;
      season = itemId;
      itemId = providerId;
      providerId = null;
    }
    var p = providers[providerId] || pelispedia;
    p.getEpisodes(itemId, season, callback);
  },

  resolve: function (providerId, playerUrl, callback) {
    if (typeof playerUrl === 'function') {
      callback = playerUrl;
      playerUrl = providerId;
      providerId = null;
    }
    var p = providers[providerId] || pelispedia;
    p.resolve(playerUrl, callback);
  }
};
