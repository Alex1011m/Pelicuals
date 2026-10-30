// lib/scrapers/archive.js
// Proveedor de Scraping: Internet Archive Movies & Open Cinema (archive.org)
var https = require('https');

function fetchJson(url, callback) {
  var options = {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
    }
  };

  var req = https.get(url, options, function (res) {
    var data = '';
    res.on('data', function (c) { data += c; });
    res.on('end', function () {
      try {
        var parsed = JSON.parse(data);
        callback(null, parsed);
      } catch (e) {
        callback(e);
      }
    });
  });

  req.on('error', function (err) { callback(err); });
  req.setTimeout(6000, function () {
    req.destroy();
    callback(new Error('Timeout'));
  });
}

var CURATED_CLASSICS = [
  {
    id: "night_of_living_dead",
    title: "La Noche de los Muertos Vivientes",
    kind: "movie",
    slug: "night_of_living_dead",
    year: "1968",
    rating: "7.8",
    poster: "https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&q=80",
    overview: "Los muertos regresan a la vida en una zona rural de Pensilvania atrapando a un grupo de sobrevivientes en una granja abandonada.",
    player_url: "https://archive.org/download/night_of_the_living_dead/night_of_the_living_dead_512kb.mp4",
    provider: "archive"
  },
  {
    id: "nosferatu_classic",
    title: "Nosferatu: Una Sinfonía del Horror",
    kind: "movie",
    slug: "nosferatu_classic",
    year: "1922",
    rating: "7.9",
    poster: "https://images.unsplash.com/photo-1518709268805-4e9042af9f23?w=400&q=80",
    overview: "El misterioso conde Orlok convoca al agente inmobiliario Thomas Hutter a su remoto castillo en Transilvania.",
    player_url: "https://archive.org/download/Nosferatu_1922_Silent/Nosferatu_1922_512kb.mp4",
    provider: "archive"
  },
  {
    id: "charles_chaplin_the_kid",
    title: "El Chico (The Kid) - Charles Chaplin",
    kind: "movie",
    slug: "the_kid_chaplin",
    year: "1921",
    rating: "8.3",
    poster: "https://archive.org/services/img/TheKid_201605",
    overview: "Una madre soltera abandona a su bebé en un automóvil de lujo, pero termina en manos del caritativo vagabundo Charlot.",
    player_url: "https://archive.org/download/TheKid_201605/The%20Kid.mp4",
    provider: "archive"
  },
  {
    id: "house_on_haunted_hill",
    title: "House on Haunted Hill (Vincent Price)",
    kind: "movie",
    slug: "house_on_haunted_hill",
    year: "1959",
    rating: "7.3",
    poster: "https://archive.org/services/img/house_on_haunted_hill_ipod",
    overview: "Un excéntrico millonario ofrece 10,000 dólares a cinco personas si logran pasar toda la noche en una mansión embrujada.",
    player_url: "https://archive.org/download/house_on_haunted_hill_ipod/house_on_haunted_hill_512kb.mp4",
    provider: "archive"
  },
  {
    id: "his_girl_friday",
    title: "Luna Nueva (His Girl Friday) - Cary Grant",
    kind: "movie",
    slug: "his_girl_friday",
    year: "1940",
    rating: "7.9",
    poster: "https://archive.org/services/img/his_girl_friday",
    overview: "El editor de un periódico usa todas las artimañas para evitar que su exesposa y mejor reportera se case y se retire del periodismo.",
    player_url: "https://archive.org/download/his_girl_friday/his_girl_friday_512kb.mp4",
    provider: "archive"
  },
  {
    id: "gullivers_travels_1939",
    title: "Los Viajes de Gulliver (Animación Clásica)",
    kind: "movie",
    slug: "gullivers_travels_1939",
    year: "1939",
    rating: "7.4",
    poster: "https://archive.org/services/img/gullivers_travels1939",
    overview: "Gulliver naufraga en una isla habitada por personas minúsculas y se ve envuelto en una guerra cómica entre reinos.",
    player_url: "https://archive.org/download/gullivers_travels1939/gullivers_travels1939_512kb.mp4",
    provider: "archive"
  },
  {
    id: "white_zombie_1932",
    title: "White Zombie (Bela Lugosi)",
    kind: "movie",
    slug: "white_zombie",
    year: "1932",
    rating: "7.1",
    poster: "https://archive.org/services/img/white_zombie",
    overview: "Un joven acude a un siniestro brujo de vudú para que convierta a la mujer que ama en un zombi bajo su dominio.",
    player_url: "https://archive.org/download/white_zombie/white_zombie_512kb.mp4",
    provider: "archive"
  }
];

module.exports = {
  id: 'archive',
  name: 'Cine Clásico Abierto',

  getCatalog: function (callback) {
    callback(null, [
      {
        title: "🏛️ Cine Clásico & Dominio Público",
        items: CURATED_CLASSICS
      }
    ]);
  },

  search: function (query, callback) {
    var searchUrl = 'https://archive.org/advancedsearch.php?q=mediatype%3Amovies+AND+title%3A(' + encodeURIComponent(query) + ')&fl[]=identifier,title,year,description&rows=6&output=json';
    fetchJson(searchUrl, function (err, data) {
      if (err || !data || !data.response || !data.response.docs) {
        return callback(null, []);
      }

      var items = data.response.docs.map(function (doc) {
        return {
          id: doc.identifier,
          title: doc.title,
          kind: 'movie',
          slug: doc.identifier,
          year: doc.year || '1970',
          rating: '7.5',
          poster: 'https://archive.org/services/img/' + doc.identifier,
          overview: doc.description ? (doc.description.replace(/<[^>]*>?/gm, '').substring(0, 200) + '...') : '',
          player_url: 'https://archive.org/download/' + doc.identifier + '/' + doc.identifier + '_512kb.mp4',
          provider: 'archive'
        };
      });

      callback(null, items);
    });
  },

  getDetail: function (kind, slug, callback) {
    for (var i = 0; i < CURATED_CLASSICS.length; i++) {
      if (CURATED_CLASSICS[i].id === slug || CURATED_CLASSICS[i].slug === slug) {
        return callback(null, CURATED_CLASSICS[i]);
      }
    }

    callback(null, {
      id: slug,
      title: slug.replace(/_/g, ' '),
      overview: 'Película clásica disponible en dominio público.',
      year: 'Clásico',
      kind: 'movie',
      poster: 'https://archive.org/services/img/' + slug,
      player_url: slug.indexOf('http') === 0 ? slug : ('https://archive.org/download/' + slug + '/' + slug + '_512kb.mp4'),
      provider: 'archive'
    });
  },

  getEpisodes: function (itemId, season, callback) {
    callback(null, []);
  },

  resolve: function (playerUrl, callback) {
    callback(null, {
      streamUrl: playerUrl,
      type: 'mp4'
    });
  }
};
