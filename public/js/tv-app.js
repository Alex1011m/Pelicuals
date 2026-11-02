// public/js/tv-app.js
// Lógica de la aplicación TV en ES5 Puro (Cero librerías externas)
// Soporta Canales de TV en Vivo, Películas y Series (PelisPedia/Multi-Proveedor) y Buscador

(function (window) {
  'use strict';

  var TVApp = {
    currentCategory: 'channels',
    sectionsWrapper: null,
    searchContainer: null,
    detailModal: null,
    onboardingModal: null,
    sidebar: null,
    sidebarExpanded: false,
    currentMovieFilter: 'all',
    cachedMovieRows: null,
    lastFocusedGridItem: null,
    currentSerieDetail: null,
    currentPreviewItem: null,
    searchEventsBound: false,
    sidebarEventsBound: false,

    curatedOnboardingList: [
      {
        title: 'Spider-Man: Un nuevo día',
        slug: 'spider-man-un-nuevo-dia',
        genres: ['accion', 'marvel', 'scifi', 'aventura'],
        kind: 'movie',
        rating: '8.8',
        year: '2026',
        tag: 'Acción / Marvel',
        poster: 'https://image.tmdb.org/t/p/w342/fBFjaDWfNslvrs6bJjknmG27wOS.jpg'
      },
      {
        title: 'Street Fighter',
        slug: 'street-fighter',
        genres: ['accion', 'aventura', 'videojuegos'],
        kind: 'movie',
        rating: '7.6',
        year: '2026',
        tag: 'Acción / Peleas',
        poster: 'https://image.tmdb.org/t/p/w342/j9Ukn1hRqSyv5qhHgDHd1s1Dhsg.jpg'
      },
      {
        title: 'Cyberpunk Edgerunners 2',
        slug: '6435/cyberpunk-edgerunners-2',
        genres: ['anime', 'scifi', 'accion'],
        kind: 'serie',
        provider: 'tyanime',
        rating: '8.9',
        year: 'Anime',
        tag: 'Anime HD',
        poster: 'https://tyanime.net/covers/6435.jpg'
      },
      {
        title: 'Los Simpson',
        slug: 'los-simpson',
        genres: ['comedia', 'animacion', 'humor'],
        kind: 'serie',
        rating: '8.7',
        year: 'Series',
        tag: 'Comedia / Animación',
        poster: 'https://image.tmdb.org/t/p/w342/mpizUstxJmMbgMwc8MDEXQ6kXTP.jpg'
      },
      {
        title: 'Los Expedientes Secretos X',
        slug: 'los-expedientes-secretos-x',
        genres: ['scifi', 'misterio', 'terror', 'series'],
        kind: 'serie',
        rating: '8.6',
        year: 'Series',
        tag: 'Misterio / Ciencia Ficción',
        poster: 'https://image.tmdb.org/t/p/w342/73FcOklRmfmf76WflkeVTO1MAwJ.jpg'
      },
      {
        title: 'Obsesión',
        slug: 'obsesion',
        genres: ['terror', 'suspenso', 'misterio'],
        kind: 'movie',
        rating: '7.8',
        year: '2026',
        tag: 'Terror / Suspenso',
        poster: 'https://image.tmdb.org/t/p/w342/rmCkNtzYR2xTOO3ZXmIqB5zgYdE.jpg'
      },
      {
        title: 'Padre de Familia',
        slug: 'padre-de-familia',
        genres: ['comedia', 'humor', 'animacion'],
        kind: 'serie',
        rating: '8.2',
        year: 'Series',
        tag: 'Humor / Adultos',
        poster: 'https://image.tmdb.org/t/p/w342/oalgdH3vglKvg1SB4OaMyoJ29sx.jpg'
      },
      {
        title: 'Anatomía según Grey',
        slug: 'anatomia-segun-grey',
        genres: ['drama', 'romance', 'series'],
        kind: 'serie',
        rating: '8.1',
        year: 'Series',
        tag: 'Drama / Romance',
        poster: 'https://image.tmdb.org/t/p/w342/zOHJKejyjmfu32PdMlXGZKyy3fq.jpg'
      },
      {
        title: 'Scorpion',
        slug: 'scorpion',
        genres: ['crimen', 'accion', 'suspenso'],
        kind: 'serie',
        rating: '7.9',
        year: 'Series',
        tag: 'Crimen / Suspenso',
        poster: 'https://image.tmdb.org/t/p/w342/k1Edm68SE8JeOzyTafZnTOOuLTx.jpg'
      },
      {
        title: 'Jackass: La última y nos vamos',
        slug: 'jackass-la-ultima-y-nos-vamos',
        genres: ['comedia', 'humor', 'documental'],
        kind: 'movie',
        rating: '7.4',
        year: '2022',
        tag: 'Comedia / Locuras',
        poster: 'https://image.tmdb.org/t/p/w342/15Hs6RG2V4zOEJKi8zRazYqQ5PQ.jpg'
      },
      {
        title: 'La Noche de los Muertos Vivientes',
        slug: 'la-noche-de-los-muertos-vivientes',
        genres: ['terror', 'clasicos', 'cine clasico'],
        kind: 'movie',
        rating: '8.0',
        year: '1968',
        tag: 'Cine Clásico / Culto',
        poster: 'https://images.unsplash.com/photo-1509281373149-e957c6296406?w=400&q=80'
      },
      {
        title: 'La 8ª Noche (WWE & Combate)',
        slug: 'la-8-noche',
        genres: ['wwe', 'deportes', 'accion'],
        kind: 'movie',
        rating: '7.5',
        year: '2026',
        tag: 'Deportes / Combate',
        poster: 'https://image.tmdb.org/t/p/w342/dPR5pAL8LjoO8q4rQ7knhzu0TjO.jpg'
      }
    ],

    init: function () {
      this.sectionsWrapper = document.getElementById('tv-sections-wrapper');
      this.searchContainer = document.getElementById('tv-search-container');
      this.detailModal = document.getElementById('tv-detail-modal');
      this.onboardingModal = document.getElementById('tv-onboarding-modal');
      this.sidebar = document.getElementById('tv-sidebar');

      // Inicializar submódulos
      window.SpatialNav.init();
      window.TVPlayer.init();

      var self = this;
      window.SpatialNav.onFocusChange = function (elem) {
        self.updatePreviewBanner(elem);
        self.handleFocusSidebar(elem);
      };

      window.onBackKey = function () {
        if (self.onboardingModal && self.onboardingModal.style.display !== 'none') {
          self.closeOnboardingModal();
        } else if (self.detailModal && self.detailModal.style.display === 'block') {
          self.closeDetailModal();
        } else if (self.sidebarExpanded) {
          self.collapseSidebar();
        }
      };

      // Controles de navegación y desplazamiento para mouse y control remoto de Smart TV
      this.setupPageScrollControls();
      this.setupEdgeAndDragScroll();

      this.setupTabs();
      this.setupSidebar();
      this.setupBannerActions();
      this.updateFavoritesBadge();
      this.loadCategory('channels');

      // Si es la primera vez que entra, desplegar el onboarding estilo Netflix para elegir 3 títulos
      var onboardingDone = false;
      try {
        onboardingDone = localStorage.getItem('tv_onboarding_done') === 'true';
      } catch (e) {}

      if (!onboardingDone) {
        setTimeout(function () {
          self.showOnboardingModal();
        }, 350);
      }
    },

    setupPageScrollControls: function () {
      var self = this;
      var btnUp = document.getElementById('btn-page-scroll-up');
      var btnDown = document.getElementById('btn-page-scroll-down');
      var viewport = document.querySelector('.tv-content-viewport');

      function getActiveScrollable() {
        if (self.searchContainer && self.searchContainer.style.display !== 'none') {
          return self.searchContainer;
        }
        return viewport;
      }

      function updateScrollButtonsVisibility() {
        var el = getActiveScrollable();
        if (!el || !btnUp) return;
        if (el.scrollTop <= 10) {
          btnUp.style.opacity = '0.35';
        } else {
          btnUp.style.opacity = '1';
        }
      }

      if (btnDown) {
        btnDown.addEventListener('click', function (e) {
          e.stopPropagation();
          var el = getActiveScrollable();
          if (el) {
            if (typeof el.scrollBy === 'function') {
              el.scrollBy({ top: 480, behavior: 'smooth' });
            } else {
              el.scrollTop += 480;
            }
            setTimeout(updateScrollButtonsVisibility, 350);
          }
        }, false);
      }

      if (btnUp) {
        btnUp.addEventListener('click', function (e) {
          e.stopPropagation();
          var el = getActiveScrollable();
          if (el) {
            if (typeof el.scrollBy === 'function') {
              el.scrollBy({ top: -480, behavior: 'smooth' });
            } else {
              el.scrollTop -= 480;
            }
            setTimeout(updateScrollButtonsVisibility, 350);
          }
        }, false);
      }

      if (viewport) {
        viewport.addEventListener('scroll', updateScrollButtonsVisibility, false);
      }
      if (this.searchContainer) {
        this.searchContainer.addEventListener('scroll', updateScrollButtonsVisibility, false);
      }
      updateScrollButtonsVisibility();
    },

    setupEdgeAndDragScroll: function () {
      var self = this;
      var viewport = document.querySelector('.tv-content-viewport');
      if (!viewport) return;

      function getActiveScrollable() {
        if (self.searchContainer && self.searchContainer.style.display !== 'none') {
          return self.searchContainer;
        }
        return viewport;
      }

      // 1. Soporte universal para rueda del mouse (wheel)
      viewport.addEventListener('wheel', function (e) {
        var target = getActiveScrollable();
        if (target) {
          target.scrollTop += (e.deltaY > 0 ? 180 : -180);
        }
      }, false);

      // 2. Auto-desplazamiento al acercar el puntero/mouse a los bordes de la pantalla (Edge Scrolling)
      var edgeScrollTimer = null;
      var edgeDirection = 0; // 1 = abajo, -1 = arriba

      function startEdgeScroll(dir) {
        if (edgeDirection === dir && edgeScrollTimer) return;
        edgeDirection = dir;
        clearInterval(edgeScrollTimer);
        edgeScrollTimer = setInterval(function () {
          var target = getActiveScrollable();
          if (target) {
            target.scrollTop += (edgeDirection * 16);
          }
        }, 22);
      }

      function stopEdgeScroll() {
        if (edgeDirection !== 0 || edgeScrollTimer) {
          edgeDirection = 0;
          clearInterval(edgeScrollTimer);
          edgeScrollTimer = null;
        }
      }

      window.addEventListener('mousemove', function (e) {
        var playerModal = document.getElementById('tv-player-modal');
        var detailModal = document.getElementById('tv-detail-modal');
        if ((playerModal && playerModal.style.display !== 'none') || (detailModal && detailModal.style.display !== 'none')) {
          stopEdgeScroll();
          return;
        }

        var h = window.innerHeight;
        var y = e.clientY;

        // Borde inferior (último 12% de la pantalla) -> Desplazar hacia abajo
        if (y > h * 0.88) {
          startEdgeScroll(1);
        }
        // Borde superior (entre 10% y 22% de la pantalla, justo debajo del banner) -> Desplazar hacia arriba
        else if (y < h * 0.22 && y > 75) {
          startEdgeScroll(-1);
        }
        else {
          stopEdgeScroll();
        }
      }, false);

      window.addEventListener('mouseleave', stopEdgeScroll, false);

      // 3. Arrastre vertical con clic sostenido (Swipe vertical para mouse de TV)
      var isMouseDown = false;
      var startY = 0;
      var startScrollTop = 0;

      viewport.addEventListener('mousedown', function (e) {
        if (e.target && e.target.closest && e.target.closest('.tv-card, .btn-page-scroll, .sidebar-item, .nav-tab, button, input')) {
          return;
        }
        isMouseDown = true;
        startY = e.clientY;
        var target = getActiveScrollable();
        startScrollTop = target ? target.scrollTop : 0;
      }, false);

      window.addEventListener('mousemove', function (e) {
        if (!isMouseDown) return;
        var target = getActiveScrollable();
        if (target) {
          var delta = e.clientY - startY;
          if (Math.abs(delta) > 4) {
            target.scrollTop = startScrollTop - delta;
          }
        }
      }, false);

      window.addEventListener('mouseup', function () {
        isMouseDown = false;
      }, false);
    },

    handleFocusSidebar: function (elem) {
      if (!this.sidebar) return;
      if (elem && window.SpatialNav.hasClass(elem, 'sidebar-item')) {
        this.expandSidebar();
      } else if (this.sidebarExpanded) {
        this.collapseSidebar();
      }
    },

    expandSidebar: function () {
      if (!this.sidebar) return;
      window.SpatialNav.addClass(this.sidebar, 'tv-sidebar-expanded');
      this.sidebarExpanded = true;
    },

    collapseSidebar: function () {
      if (!this.sidebar) return;
      window.SpatialNav.removeClass(this.sidebar, 'tv-sidebar-expanded');
      this.sidebarExpanded = false;
    },

    setupSidebar: function () {
      if (this.sidebarEventsBound || !this.sidebar) return;
      this.sidebarEventsBound = true;

      var self = this;
      var toggleBtn = document.getElementById('btn-sidebar-toggle');
      if (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
          if (self.sidebarExpanded) {
            self.collapseSidebar();
          } else {
            self.expandSidebar();
          }
        }, false);
      }

      var items = this.sidebar.querySelectorAll('.sidebar-item[data-filter]');
      for (var i = 0; i < items.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            var filter = btn.getAttribute('data-filter');
            self.applyMovieFilter(filter, btn);
          }, false);
        })(items[i]);
      }

      this.sidebar.addEventListener('mouseenter', function () {
        self.expandSidebar();
      }, false);

      this.sidebar.addEventListener('mouseleave', function () {
        var cur = window.SpatialNav.currentFocused;
        if (!cur || !self.sidebar.contains(cur)) {
          self.collapseSidebar();
        }
      }, false);
    },

    applyMovieFilter: function (filter, activeBtn) {
      this.currentMovieFilter = filter || 'all';

      // Actualizar botón activo en el sidebar
      var items = this.sidebar.querySelectorAll('.sidebar-item[data-filter]');
      for (var i = 0; i < items.length; i++) {
        window.SpatialNav.removeClass(items[i], 'active-filter');
      }
      if (activeBtn) {
        window.SpatialNav.addClass(activeBtn, 'active-filter');
      }

      // Si no estamos en la categoría películas, cambiar a ella
      if (this.currentCategory !== 'movies') {
        var tabs = document.querySelectorAll('.nav-tab');
        for (var j = 0; j < tabs.length; j++) {
          if (tabs[j].getAttribute('data-category') === 'movies') {
            window.SpatialNav.addClass(tabs[j], 'active-tab');
          } else {
            window.SpatialNav.removeClass(tabs[j], 'active-tab');
          }
        }
        this.loadCategory('movies');
        return;
      }

      if (this.cachedMovieRows) {
        this.renderMovieRows(this.cachedMovieRows, this.currentMovieFilter);
      }

      this.collapseSidebar();

      // Enfocar primer elemento de la sección filtrada
      var firstCard = this.sectionsWrapper.querySelector('.tv-card.focusable');
      if (firstCard) {
        window.SpatialNav.focusElement(firstCard);
      }
    },

    setupBannerActions: function () {
      var self = this;
      var btnPlay = document.getElementById('btn-banner-play');
      var btnInfo = document.getElementById('btn-banner-info');
      var btnFav = document.getElementById('btn-banner-fav');

      if (btnPlay) {
        btnPlay.addEventListener('click', function () {
          if (!self.currentPreviewItem) return;
          if (self.currentPreviewItem.type === 'pelispedia') {
            self.openDetailModal(self.currentPreviewItem.kind, self.currentPreviewItem.slug, self.currentPreviewItem.provider);
          } else if (self.currentPreviewItem.url) {
            var isLiveBanner = (self.currentPreviewItem.kind === 'canal') || (self.currentPreviewItem.provider === 'pluto') || (self.currentPreviewItem.provider === 'channels') || (self.currentPreviewItem.provider === 'iptv') || (self.currentCategory === 'channels');
            var bannerPlayInfo = {
              title: self.currentPreviewItem.title,
              url: self.currentPreviewItem.url,
              type: self.currentPreviewItem.type,
              kind: isLiveBanner ? 'canal' : (self.currentPreviewItem.kind || 'movie'),
              isLive: isLiveBanner,
              provider: self.currentPreviewItem.provider || (isLiveBanner ? 'channels' : 'pelispedia')
            };
            window.TVPlayer.play(self.currentPreviewItem.title, self.currentPreviewItem.url, self.currentPreviewItem.type, 0, bannerPlayInfo);
          }
        }, false);
      }

      if (btnInfo) {
        btnInfo.addEventListener('click', function () {
          if (!self.currentPreviewItem) return;
          if (self.currentPreviewItem.type === 'pelispedia') {
            self.openDetailModal(self.currentPreviewItem.kind, self.currentPreviewItem.slug, self.currentPreviewItem.provider);
          }
        }, false);
      }

      if (btnFav) {
        btnFav.addEventListener('click', function () {
          if (!self.currentPreviewItem) return;
          var isFav = self.toggleFavorite(self.currentPreviewItem);
          btnFav.innerHTML = isFav ? '★ EN MI LISTA' : '☆ MI LISTA';
        }, false);
      }
    },

    updatePreviewBanner: function (elem) {
      if (!elem) return;
      var titleEl = document.getElementById('preview-banner-title');
      var metaEl = document.getElementById('preview-banner-meta');
      var descEl = document.getElementById('preview-banner-desc');
      var thumbEl = document.getElementById('preview-banner-thumb');
      var favBtn = document.getElementById('btn-banner-fav');
      var qualityEl = document.getElementById('preview-banner-quality');
      if (!titleEl || !metaEl || !descEl) return;

      if (window.SpatialNav.hasClass(elem, 'sidebar-item')) {
        var labelEl = elem.querySelector('.sidebar-label');
        var labelText = labelEl ? labelEl.innerText : 'Menú Lateral';
        titleEl.innerText = 'Filtro: ' + labelText;
        metaEl.innerText = 'Menú Lateral • Películas, Series y Anime';
        descEl.innerText = 'Presiona OK o la Flecha Derecha para ver y explorar los títulos de esta categoría.';
        if (thumbEl) thumbEl.style.display = 'none';
      } else if (window.SpatialNav.hasClass(elem, 'tv-card')) {
        var title = elem.getAttribute('data-title') || '';
        var meta = elem.getAttribute('data-meta') || '';
        var overview = elem.getAttribute('data-overview') || '';
        var slug = elem.getAttribute('data-slug') || '';
        var kind = elem.getAttribute('data-kind') || '';
        var provider = elem.getAttribute('data-provider') || '';
        var url = elem.getAttribute('data-url') || '';
        var type = elem.getAttribute('data-type') || '';

        var thumbUrl = '';
        var cardThumb = elem.querySelector('.card-thumb');
        if (cardThumb && cardThumb.style.backgroundImage) {
          var bgMatch = cardThumb.style.backgroundImage.match(/url\(["']?([^"']+)["']?\)/);
          if (bgMatch && bgMatch[1]) thumbUrl = bgMatch[1];
        }

        titleEl.innerText = title;
        metaEl.innerText = meta;
        descEl.innerText = overview || 'Presiona OK para ver detalles y reproducir a pantalla completa.';

        if (thumbEl) {
          if (thumbUrl) {
            thumbEl.style.display = 'block';
            thumbEl.style.backgroundImage = 'url("' + thumbUrl + '")';
          } else {
            thumbEl.style.display = 'none';
          }
        }

        var isCam = meta.indexOf('CINE') !== -1 || meta.indexOf('CAM') !== -1;
        if (qualityEl) {
          qualityEl.innerText = isCam ? 'CINE (CAM)' : 'HD 1080p';
          qualityEl.style.color = isCam ? '#ff9800' : '#e0e8ff';
          qualityEl.style.borderColor = isCam ? '#ff9800' : 'rgba(13, 52, 186, 0.7)';
        }

        this.currentPreviewItem = {
          title: title,
          meta: meta,
          overview: overview,
          slug: slug,
          kind: kind,
          provider: provider,
          url: url,
          type: type,
          poster: thumbUrl,
          thumb: thumbUrl
        };

        if (favBtn && slug) {
          var isFav = this.isFavorite(slug);
          favBtn.innerHTML = isFav ? '★ EN MI LISTA' : '☆ MI LISTA';
        }
      } else if (window.SpatialNav.hasClass(elem, 'nav-tab')) {
        titleEl.innerText = 'Smart TV Hub';
        metaEl.innerText = 'Sección: ' + elem.innerText;
        descEl.innerText = 'Usa las flechas Abajo y Derecha en el mando a distancia para explorar los contenidos.';
        if (thumbEl) thumbEl.style.display = 'none';
      }
    },

    getFavorites: function () {
      try {
        var raw = localStorage.getItem('tv_favorites');
        return raw ? JSON.parse(raw) : [];
      } catch (e) {
        return [];
      }
    },

    isFavorite: function (slug) {
      if (!slug) return false;
      var favs = this.getFavorites();
      for (var i = 0; i < favs.length; i++) {
        if (favs[i].slug === slug) return true;
      }
      return false;
    },

    toggleFavorite: function (item) {
      if (!item || !item.slug) return false;
      var favs = this.getFavorites();
      var foundIdx = -1;
      for (var i = 0; i < favs.length; i++) {
        if (favs[i].slug === item.slug) {
          foundIdx = i;
          break;
        }
      }
      var isFavNow = false;
      if (foundIdx !== -1) {
        favs.splice(foundIdx, 1);
        isFavNow = false;
      } else {
        favs.unshift(item);
        isFavNow = true;
      }
      try {
        localStorage.setItem('tv_favorites', JSON.stringify(favs));
      } catch (e) {}
      this.updateFavoritesBadge();
      return isFavNow;
    },

    updateFavoritesBadge: function () {
      var badge = document.getElementById('favorites-badge');
      if (badge) {
        var count = this.getFavorites().length;
        badge.innerText = count;
      }
    },

    getWatchProgressMap: function () {
      try {
        var raw = localStorage.getItem('tv_watch_progress');
        if (!raw) return {};
        var map = JSON.parse(raw);
        var cleaned = {};
        var changed = false;
        var keys = Object.keys(map);

        for (var i = 0; i < keys.length; i++) {
          var k = keys[i];
          var item = map[k];
          if (!item) continue;

          // Descartar canales de televisión en vivo (Pluto TV, IPTV, transmisiones continuas)
          var isLiveChannel = (item.kind === 'canal') ||
                              (item.provider === 'pluto') ||
                              (item.provider === 'channels') ||
                              (item.provider === 'iptv') ||
                              (item.isLive === true) ||
                              (!item.duration || item.duration < 300) || // Ventanas deslizantes cortas de HLS en vivo (< 5 min)
                              (!item.slug && item.type === 'hls');

          if (isLiveChannel) {
            changed = true;
          } else {
            cleaned[k] = item;
          }
        }

        // Si se encontraron canales de TV antiguos en localStorage, limpiarlos permanentemente
        if (changed) {
          try {
            localStorage.setItem('tv_watch_progress', JSON.stringify(cleaned));
          } catch (eClean) { }
        }

        return cleaned;
      } catch (e) {
        return {};
      }
    },

    formatTime: function (seconds) {
      if (isNaN(seconds) || seconds < 0) return '00:00';
      var mins = Math.floor(seconds / 60);
      var secs = Math.floor(seconds % 60);
      var m = mins < 10 ? '0' + mins : mins;
      var s = secs < 10 ? '0' + secs : secs;
      return m + ':' + s;
    },

    setupTabs: function () {
      var self = this;
      var tabs = document.querySelectorAll('.nav-tab');
      for (var i = 0; i < tabs.length; i++) {
        (function (tab) {
          tab.addEventListener('click', function () {
            if (tab.id === 'btn-open-personalize') {
              self.showOnboardingModal();
              return;
            }
            for (var j = 0; j < tabs.length; j++) {
              window.SpatialNav.removeClass(tabs[j], 'active-tab');
            }
            window.SpatialNav.addClass(tab, 'active-tab');
            var cat = tab.getAttribute('data-category');
            self.loadCategory(cat);
          }, false);
        })(tabs[i]);
      }
    },

    loadCategory: function (category) {
      this.currentCategory = category;
      var viewport = document.querySelector('.tv-content-viewport');

      // Mostrar el menú lateral solo en la sección de Películas y Series
      if (category === 'movies') {
        if (this.sidebar) this.sidebar.style.display = 'flex';
        if (viewport) {
          viewport.style.marginLeft = '88px';
          viewport.style.width = 'calc(100% - 88px)';
        }
      } else {
        if (this.sidebar) {
          this.collapseSidebar();
          this.sidebar.style.display = 'none';
        }
        if (viewport) {
          viewport.style.marginLeft = '0px';
          viewport.style.width = '100%';
        }
      }

      // Alternar visibilidad entre el contenedor de filas y el buscador
      if (category === 'search') {
        this.sectionsWrapper.style.display = 'none';
        this.searchContainer.style.display = 'block';
        this.setupSearchEvents();

        var searchInput = document.getElementById('search-input');
        if (searchInput) {
          window.SpatialNav.focusElement(searchInput);
        }
        return;
      }

      this.searchContainer.style.display = 'none';
      this.sectionsWrapper.style.display = 'block';
      if (viewport) viewport.scrollTop = 0;
      this.sectionsWrapper.innerHTML = '<div style="padding: 40px; font-size: 26px; color: #8890a0;">Cargando catálogo para la TV...</div>';

      var self = this;
      if (category === 'channels') {
        if (this.cachedChannelCategories) {
          this.renderChannelRows(this.cachedChannelCategories);
          return;
        }
        this.fetchJson('/api/channels', function (err, data) {
          if (err || !data || !data.categories) {
            self.renderError('No se pudieron cargar los canales de TV.');
            return;
          }
          self.cachedChannelCategories = data.categories;
          self.renderChannelRows(data.categories);
        });
      } else if (category === 'movies') {
        if (this.cachedMovieRows) {
          this.renderMovieRows(this.cachedMovieRows, this.currentMovieFilter);
          return;
        }
        this.fetchJson('/api/movies?action=catalog', function (err, data) {
          if (err || !data || !data.rows) {
            self.renderError('No se pudo conectar con el catálogo de Películas y Series.');
            return;
          }
          self.cachedMovieRows = data.rows;
          self.renderMovieRows(data.rows, self.currentMovieFilter);
        });
      }
    },

    setupSearchEvents: function () {
      if (this.searchEventsBound) return;
      this.searchEventsBound = true;

      var self = this;
      var input = document.getElementById('search-input');
      var submitBtn = document.getElementById('btn-search-submit');
      var chips = document.querySelectorAll('.search-chip');

      function doSearch() {
        var query = input.value;
        if (query && query.trim().length > 0) {
          self.performSearch(query.trim());
        }
      }

      submitBtn.addEventListener('click', doSearch, false);

      input.addEventListener('keydown', function (e) {
        if (e.keyCode === 13) {
          doSearch();
          e.preventDefault();
        }
      }, false);

      for (var i = 0; i < chips.length; i++) {
        (function (chip) {
          chip.addEventListener('click', function () {
            var q = chip.getAttribute('data-query');
            input.value = q;
            self.performSearch(q);
          }, false);
        })(chips[i]);
      }

      // Conectar teclado virtual en pantalla para Smart TV
      var keys = document.querySelectorAll('.tv-key');
      for (var k = 0; k < keys.length; k++) {
        (function (keyBtn) {
          keyBtn.addEventListener('click', function () {
            var letter = keyBtn.getAttribute('data-key');
            var action = keyBtn.getAttribute('data-action');
            if (letter) {
              input.value = (input.value || '') + letter;
            } else if (action === 'space') {
              input.value = (input.value || '') + ' ';
            } else if (action === 'backspace') {
              if (input.value && input.value.length > 0) {
                input.value = input.value.slice(0, -1);
              }
            } else if (action === 'clear') {
              input.value = '';
            }
          }, false);
        })(keys[k]);
      }
    },

    performSearch: function (query) {
      var self = this;
      var resultsWrapper = document.getElementById('search-results-wrapper');
      resultsWrapper.innerHTML = '<div style="padding: 30px; font-size: 24px; color: #009d71;">Buscando "' + this.escapeHtml(query) + '" en Películas, Series y Canales en Vivo...</div>';

      function searchChannels(q) {
        var matches = [];
        if (!self.cachedChannelCategories) return matches;
        var qLower = q.toLowerCase();
        for (var c = 0; c < self.cachedChannelCategories.length; c++) {
          var cat = self.cachedChannelCategories[c];
          for (var k = 0; k < cat.items.length; k++) {
            var ch = cat.items[k];
            var chName = (ch.title || '').toLowerCase();
            var chOver = (ch.overview || ch.subtitle || '').toLowerCase();
            if (chName.indexOf(qLower) !== -1 || chOver.indexOf(qLower) !== -1) {
              matches.push(ch);
            }
          }
        }
        return matches;
      }

      this.fetchJson('/api/movies?action=search&q=' + encodeURIComponent(query), function (err, res) {
        var movieItems = (!err && res && res.items) ? res.items : [];
        var channelItems = searchChannels(query);

        if (movieItems.length === 0 && channelItems.length === 0) {
          resultsWrapper.innerHTML = '<div style="padding: 30px; font-size: 22px; color: #ff5555;">No se encontraron resultados para "' + self.escapeHtml(query) + '". Prueba con otra palabra clave.</div>';
          return;
        }

        var totalFound = movieItems.length + channelItems.length;
        var html = '<div class="row-title" style="margin-bottom: 20px;">' + totalFound + ' Resultados encontrados:</div>';
        html += '<div class="search-results-grid">';

        // 1. Canales de TV en Vivo encontrados
        for (var c = 0; c < channelItems.length; c++) {
          var ch = channelItems[c];
          var chMeta = ch.provider === 'pluto' ? 'PLUTO TV • EN VIVO HD' : 'CANAL EN VIVO • SEÑAL IPTV';
          var chBadge = ch.provider === 'pluto' ? 'PLUTO TV' : 'EN VIVO';
          var chBadgeClass = ch.provider === 'pluto' ? 'card-badge badge-pluto' : 'card-badge';

          html += '    <div class="tv-card tv-card-landscape tv-card-channel focusable" tabindex="0" ';
          html += '         data-title="' + self.escapeHtml(ch.title) + '" ';
          html += '         data-meta="' + self.escapeHtml(chMeta) + '" ';
          html += '         data-overview="' + self.escapeHtml(ch.overview || ch.subtitle || '') + '" ';
          html += '         data-url="' + self.escapeHtml(ch.streamUrl) + '" ';
          html += '         data-provider="' + self.escapeHtml(ch.provider || 'pluto') + '" ';
          html += '         data-kind="canal" ';
          html += '         data-is-live="true" ';
          html += '         data-type="hls">';
          html += '      <div class="card-thumb" style="background-image: url(\'' + self.escapeHtml(ch.thumb) + '\');">';
          html += '        <span class="' + chBadgeClass + '">' + chBadge + '</span>';
          html += '      </div>';
          html += '      <div class="card-info">';
          html += '        <div class="card-title">' + self.escapeHtml(ch.title) + '</div>';
          html += '        <div class="card-subtitle">' + self.escapeHtml(ch.subtitle || '') + '</div>';
          html += '      </div>';
          html += '    </div>';
        }

        // 2. Películas y Series encontradas
        for (var i = 0; i < movieItems.length; i++) {
          var item = movieItems[i];
          var qInfo = item.qualityInfo || { isCam: false, badge: 'HD 1080p' };
          var badgeClass = qInfo.isCam ? 'badge-cam' : 'badge-hd';
          var badgeText = qInfo.badge;
          var metaText = badgeText + ' • ★ ' + (item.rating || '7.0') + ' • ' + (item.year || '');

          html += '    <div class="tv-card tv-card-poster focusable" tabindex="0" ';
          html += '         data-title="' + self.escapeHtml(item.title) + '" ';
          html += '         data-meta="' + self.escapeHtml(metaText) + '" ';
          html += '         data-overview="' + self.escapeHtml((qInfo.notice ? qInfo.notice + ' | ' : '') + (item.overview || '')) + '" ';
          html += '         data-slug="' + self.escapeHtml(item.slug) + '" ';
          html += '         data-kind="' + self.escapeHtml(item.kind) + '" ';
          html += '         data-provider="' + self.escapeHtml(item.provider || 'pelispedia') + '" ';
          html += '         data-type="pelispedia">';
          html += '      <div class="card-thumb" style="background-image: url(\'' + self.escapeHtml(item.poster) + '\');">';
          html += '        <span class="card-badge ' + badgeClass + '">' + badgeText + '</span>';
          html += '      </div>';
          html += '      <div class="card-info">';
          html += '        <div class="card-title">' + self.escapeHtml(item.title) + '</div>';
          html += '        <div class="card-subtitle">★ ' + self.escapeHtml(item.rating) + ' • ' + self.escapeHtml(item.year) + '</div>';
          html += '      </div>';
          html += '    </div>';
        }

        html += '</div>';
        resultsWrapper.innerHTML = html;
        self.attachCardEvents();

        // Enfocar primer resultado de la búsqueda
        var firstResult = resultsWrapper.querySelector('.tv-card.focusable');
        if (firstResult) {
          window.SpatialNav.focusElement(firstResult);
        }
      });
    },

    fetchJson: function (url, callback) {
      var xhr = new XMLHttpRequest();
      xhr.open('GET', url, true);
      xhr.onreadystatechange = function () {
        if (xhr.readyState === 4) {
          if (xhr.status === 200) {
            try {
              var json = JSON.parse(xhr.responseText);
              callback(null, json);
            } catch (e) {
              callback(e);
            }
          } else {
            callback(new Error('HTTP Error ' + xhr.status));
          }
        }
      };
      xhr.send(null);
    },

    renderChannelRows: function (categories) {
      var html = '';
      for (var c = 0; c < categories.length; c++) {
        var cat = categories[c];
        html += '<div class="content-row">';
        html += '  <div class="row-header">';
        html += '    <div class="row-title">' + this.escapeHtml(cat.category) + '</div>';
        html += '    <div class="carousel-nav-arrows">';
        html += '      <button class="carousel-nav-btn btn-arrow-prev focusable" tabindex="0" title="Desplazar a la izquierda">&#9668;</button>';
        html += '      <button class="carousel-nav-btn btn-arrow-next focusable" tabindex="0" title="Desplazar a la derecha">&#9658;</button>';
        html += '    </div>';
        html += '  </div>';
        html += '  <div class="row-carousel">';

        for (var i = 0; i < cat.items.length; i++) {
          var item = cat.items[i];
          var metaText = item.provider === 'pluto' ? 'PLUTO TV OFICIAL • EN VIVO HD' : 'CANAL EN VIVO • SEÑAL IPTV';
          var badgeText = item.provider === 'pluto' ? 'PLUTO TV' : (item.type === 'hls' ? 'EN VIVO' : 'VIDEO');
          var badgeClass = item.provider === 'pluto' ? 'card-badge badge-pluto' : 'card-badge';
          var overviewText = item.overview || item.subtitle || '';

          html += '    <div class="tv-card tv-card-landscape tv-card-channel focusable" tabindex="0" ';
          html += '         data-title="' + this.escapeHtml(item.title) + '" ';
          html += '         data-meta="' + this.escapeHtml(metaText) + '" ';
          html += '         data-overview="' + this.escapeHtml(overviewText) + '" ';
          html += '         data-url="' + this.escapeHtml(item.streamUrl) + '" ';
          html += '         data-provider="' + this.escapeHtml(item.provider || 'iptv') + '" ';
          html += '         data-kind="canal" ';
          html += '         data-is-live="true" ';
          html += '         data-type="' + this.escapeHtml(item.type) + '">';
          html += '      <div class="card-thumb" style="background-image: url(\'' + this.escapeHtml(item.thumb) + '\');">';
          html += '        <span class="' + badgeClass + '">' + badgeText + '</span>';
          html += '      </div>';
          html += '      <div class="card-info">';
          html += '        <div class="card-title">' + this.escapeHtml(item.title) + '</div>';
          html += '        <div class="card-subtitle">' + this.escapeHtml(item.subtitle || '') + '</div>';
          html += '      </div>';
          html += '    </div>';
        }

        html += '  </div>';
        html += '</div>';
      }

      this.sectionsWrapper.innerHTML = html;
      this.attachCardEvents();
    },

    isRowMatchingFilter: function (rowTitle, filter) {
      if (!filter || filter === 'all') return true;
      var t = (rowTitle || '').toLowerCase();

      if (filter === 'anime') {
        return t.indexOf('anime') !== -1 || t.indexOf('tyanime') !== -1;
      }
      if (filter === 'series') {
        return t.indexOf('serie') !== -1 || t.indexOf('telenovela') !== -1 || t.indexOf('wwe') !== -1 || t.indexOf('dorama') !== -1;
      }
      if (filter === 'movies') {
        // Películas: todo lo que no es anime ni serie/telenovela
        return t.indexOf('anime') === -1 && t.indexOf('tyanime') === -1 && t.indexOf('serie') === -1 && t.indexOf('telenovela') === -1 && t.indexOf('wwe') === -1;
      }
      if (filter === 'genre-accion') return t.indexOf('acci') !== -1 || t.indexOf('aventura') !== -1;
      if (filter === 'genre-terror') return t.indexOf('terror') !== -1 || t.indexOf('misterio') !== -1 || t.indexOf('suspenso') !== -1;
      if (filter === 'genre-comedia') return t.indexOf('comedia') !== -1 || t.indexOf('humor') !== -1;
      if (filter === 'genre-scifi') return t.indexOf('ciencia') !== -1 || t.indexOf('fantas') !== -1;
      if (filter === 'genre-clasicos') return t.indexOf('clás') !== -1 || t.indexOf('clas') !== -1 || t.indexOf('dominio') !== -1;

      return true;
    },

    getUserPreferences: function () {
      try {
        var raw = localStorage.getItem('tv_user_preferences');
        return raw ? JSON.parse(raw) : null;
      } catch (e) {
        return null;
      }
    },

    getPersonalizedRecommendations: function (rows, userPrefs) {
      if (!rows || !userPrefs || !userPrefs.genres) return [];
      var targetGenres = userPrefs.genres;
      var scored = [];
      var seenSlugs = {};

      if (userPrefs.selectedSlugs) {
        for (var s = 0; s < userPrefs.selectedSlugs.length; s++) {
          seenSlugs[userPrefs.selectedSlugs[s]] = true;
        }
      }

      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        var rowTitleLow = (row.title || '').toLowerCase();
        var items = row.items || [];

        for (var i = 0; i < items.length; i++) {
          var item = items[i];
          if (!item.slug || seenSlugs[item.slug]) continue;

          var itemTitleLow = (item.title || '').toLowerCase();
          var itemDescLow = (item.overview || '').toLowerCase();
          var score = 0;

          for (var g = 0; g < targetGenres.length; g++) {
            var gen = targetGenres[g].toLowerCase();
            if (rowTitleLow.indexOf(gen) !== -1) score += 3;
            if (itemTitleLow.indexOf(gen) !== -1) score += 2;
            if (itemDescLow.indexOf(gen) !== -1) score += 1;
          }

          if (score > 0) {
            seenSlugs[item.slug] = true;
            var numRating = parseFloat(item.rating) || 7.0;
            scored.push({
              score: score * 10 + numRating,
              item: item
            });
          }
        }
      }

      scored.sort(function (a, b) {
        return b.score - a.score;
      });

      var result = [];
      for (var k = 0; k < Math.min(scored.length, 20); k++) {
        result.push(scored[k].item);
      }
      return result;
    },

    showOnboardingModal: function () {
      var self = this;
      if (!this.onboardingModal) {
        this.onboardingModal = document.getElementById('tv-onboarding-modal');
      }
      if (!this.onboardingModal) return;

      var grid = document.getElementById('onboarding-grid');
      var counterEl = document.getElementById('onboarding-counter');
      var btnContinue = document.getElementById('btn-onboarding-continue');
      var btnSkip = document.getElementById('btn-onboarding-skip');

      var existingPrefs = this.getUserPreferences();
      var selectedMap = {};
      if (existingPrefs && existingPrefs.selectedSlugs) {
        for (var s = 0; s < existingPrefs.selectedSlugs.length; s++) {
          selectedMap[existingPrefs.selectedSlugs[s]] = true;
        }
      }

      function getSelectedCount() {
        return Object.keys(selectedMap).length;
      }

      function updateUI() {
        var count = getSelectedCount();
        if (counterEl) {
          counterEl.innerText = count + ' de 3 seleccionados' + (count >= 3 ? ' ✓' : '');
          if (count >= 3) {
            window.SpatialNav.addClass(counterEl, 'ready');
          } else {
            window.SpatialNav.removeClass(counterEl, 'ready');
          }
        }
        if (btnContinue) {
          btnContinue.innerText = count >= 3 ? 'CONTINUAR AHORA (' + count + ')' : 'CONTINUAR (' + count + '/3)';
          if (count >= 3) {
            window.SpatialNav.removeClass(btnContinue, 'disabled');
          } else {
            window.SpatialNav.addClass(btnContinue, 'disabled');
          }
        }
      }

      var html = '';
      for (var i = 0; i < this.curatedOnboardingList.length; i++) {
        var item = this.curatedOnboardingList[i];
        var isSelected = !!selectedMap[item.slug];
        html += '<div class="onboarding-card focusable' + (isSelected ? ' is-selected' : '') + '" ';
        html += '     tabindex="0" ';
        html += '     data-slug="' + self.escapeHtml(item.slug) + '" ';
        html += '     style="background-image: url(\'' + self.escapeHtml(item.poster) + '\');">';
        html += '  <div class="onboarding-card-info">';
        html += '    <div class="onboarding-card-title">' + self.escapeHtml(item.title) + '</div>';
        html += '    <div class="onboarding-card-tag">' + self.escapeHtml(item.tag || 'Popular') + '</div>';
        html += '  </div>';
        html += '</div>';
      }
      grid.innerHTML = html;
      updateUI();

      var cards = grid.querySelectorAll('.onboarding-card');
      for (var c = 0; c < cards.length; c++) {
        (function (card) {
          card.addEventListener('mouseenter', function () {
            window.SpatialNav.focusElement(card);
          }, false);

          card.addEventListener('click', function () {
            var slug = card.getAttribute('data-slug');
            if (selectedMap[slug]) {
              delete selectedMap[slug];
              window.SpatialNav.removeClass(card, 'is-selected');
            } else {
              selectedMap[slug] = true;
              window.SpatialNav.addClass(card, 'is-selected');
            }
            updateUI();
          }, false);
        })(cards[c]);
      }

      btnContinue.onclick = function () {
        var count = getSelectedCount();
        if (count < 3) return;

        var selectedSlugs = Object.keys(selectedMap);
        var chosenGenres = {};
        for (var j = 0; j < self.curatedOnboardingList.length; j++) {
          var candidate = self.curatedOnboardingList[j];
          if (selectedMap[candidate.slug]) {
            for (var g = 0; g < candidate.genres.length; g++) {
              chosenGenres[candidate.genres[g]] = true;
            }
          }
        }

        var prefs = {
          completed: true,
          selectedSlugs: selectedSlugs,
          genres: Object.keys(chosenGenres),
          savedAt: Date.now()
        };

        try {
          localStorage.setItem('tv_user_preferences', JSON.stringify(prefs));
          localStorage.setItem('tv_onboarding_done', 'true');
        } catch (e) {}

        self.onboardingModal.style.display = 'none';
        var scrollCtrls = document.getElementById('tv-page-scroll-controls');
        if (scrollCtrls) scrollCtrls.style.display = 'flex';

        if (self.currentCategory === 'movies' && self.cachedMovieRows) {
          self.renderMovieRows(self.cachedMovieRows, self.currentMovieFilter);
        } else {
          var tabs = document.querySelectorAll('.nav-tab');
          for (var t = 0; t < tabs.length; t++) {
            if (tabs[t].getAttribute('data-category') === 'movies') {
              window.SpatialNav.addClass(tabs[t], 'active-tab');
            } else {
              window.SpatialNav.removeClass(tabs[t], 'active-tab');
            }
          }
          self.loadCategory('movies');
        }
      };

      btnSkip.onclick = function () {
        try {
          localStorage.setItem('tv_onboarding_done', 'true');
        } catch (e) {}
        self.onboardingModal.style.display = 'none';
        var scrollCtrls = document.getElementById('tv-page-scroll-controls');
        if (scrollCtrls) scrollCtrls.style.display = 'flex';
        var firstTab = document.querySelector('.nav-tab.active-tab') || document.querySelector('.nav-tab');
        if (firstTab) window.SpatialNav.focusElement(firstTab);
      };

      var scrollCtrls = document.getElementById('tv-page-scroll-controls');
      if (scrollCtrls) scrollCtrls.style.display = 'none';
      this.onboardingModal.style.display = 'flex';

      var firstCard = grid.querySelector('.onboarding-card');
      if (firstCard) {
        window.SpatialNav.focusElement(firstCard);
      }
    },

    closeOnboardingModal: function () {
      if (this.onboardingModal) {
        this.onboardingModal.style.display = 'none';
      }
      var scrollCtrls = document.getElementById('tv-page-scroll-controls');
      if (scrollCtrls) scrollCtrls.style.display = 'flex';
      var firstTab = document.querySelector('.nav-tab.active-tab') || document.querySelector('.nav-tab');
      if (firstTab) {
        window.SpatialNav.focusElement(firstTab);
      }
    },

    renderMovieRows: function (rows, filter) {
      filter = filter || this.currentMovieFilter || 'all';
      var html = '';
      var matchingCount = 0;

      // 1. Vista exclusiva de Mis Favoritos
      if (filter === 'favorites') {
        var favItems = this.getFavorites();
        if (favItems.length === 0) {
          html = '<div style="padding: 40px; font-size: 24px; color: #7b8290;">Aún no has agregado títulos a Favoritos.<br><span style="font-size: 18px; color: #009d71;">Entra a cualquier película o serie y pulsa "☆ AGREGAR A FAVORITOS".</span></div>';
        } else {
          html += '<div class="content-row">';
          html += '  <div class="row-header">';
          html += '    <div class="row-title">★ Mis Títulos Favoritos (' + favItems.length + ')</div>';
          html += '    <div class="carousel-nav-arrows">';
          html += '      <button class="carousel-nav-btn btn-arrow-prev focusable" tabindex="0">&#9668;</button>';
          html += '      <button class="carousel-nav-btn btn-arrow-next focusable" tabindex="0">&#9658;</button>';
          html += '    </div>';
          html += '  </div>';
          html += '  <div class="row-carousel">';
          for (var f = 0; f < favItems.length; f++) {
            var fItem = favItems[f];
            html += '    <div class="tv-card tv-card-poster focusable" tabindex="0" ';
            html += '         data-title="' + this.escapeHtml(fItem.title) + '" ';
            html += '         data-meta="FAVORITO • ★ ' + (fItem.rating || '7.0') + ' • ' + (fItem.year || '') + '" ';
            html += '         data-overview="' + this.escapeHtml(fItem.overview || '') + '" ';
            html += '         data-slug="' + this.escapeHtml(fItem.slug) + '" ';
            html += '         data-kind="' + this.escapeHtml(fItem.kind || 'movie') + '" ';
            html += '         data-provider="' + this.escapeHtml(fItem.provider || 'pelispedia') + '" ';
            html += '         data-type="pelispedia">';
            html += '      <div class="card-thumb" style="background-image: url(\'' + this.escapeHtml(fItem.poster) + '\');">';
            html += '        <span class="card-badge badge-hd">★ FAVORITO</span>';
            html += '      </div>';
            html += '      <div class="card-info">';
            html += '        <div class="card-title">' + this.escapeHtml(fItem.title) + '</div>';
            html += '        <div class="card-subtitle">★ ' + this.escapeHtml(fItem.rating || '7.0') + ' • ' + this.escapeHtml(fItem.year || '') + '</div>';
            html += '      </div>';
            html += '    </div>';
          }
          html += '  </div>';
          html += '</div>';
        }
        var vpReset = document.querySelector('.tv-content-viewport');
        if (vpReset) vpReset.scrollTop = 0;
        this.sectionsWrapper.innerHTML = html;
        this.attachCardEvents();
        return;
      }

      // 1. Fila "★ Recomendado para ti (Según tus gustos)" (ESTILO NETFLIX)
      if (filter === 'all') {
        var userPrefs = this.getUserPreferences();
        if (userPrefs && userPrefs.genres && userPrefs.genres.length > 0) {
          var recItems = this.getPersonalizedRecommendations(rows, userPrefs);
          if (recItems.length > 0) {
            html += '<div class="content-row recommended-for-you-row">';
            html += '  <div class="row-header">';
            html += '    <div class="row-title" style="color: #009d71;">★ Recomendado para ti (según tus gustos)</div>';
            html += '    <div class="carousel-nav-arrows">';
            html += '      <button class="carousel-nav-btn btn-arrow-prev focusable" tabindex="0" title="Desplazar a la izquierda">&#9668;</button>';
            html += '      <button class="carousel-nav-btn btn-arrow-next focusable" tabindex="0" title="Desplazar a la derecha">&#9658;</button>';
            html += '    </div>';
            html += '  </div>';
            html += '  <div class="row-carousel">';
            for (var rec = 0; rec < recItems.length; rec++) {
              var rItem = recItems[rec];
              var qInfoR = rItem.qualityInfo || { isCam: false, badge: 'HD 1080p' };
              var bClassR = qInfoR.isCam ? 'badge-cam' : 'badge-hd';
              var bTextR = qInfoR.badge;
              var mTextR = 'PARA TI • ★ ' + (rItem.rating || '8.0') + ' • ' + (rItem.year || '2026');

              html += '    <div class="tv-card tv-card-poster focusable" tabindex="0" ';
              html += '         data-title="' + this.escapeHtml(rItem.title) + '" ';
              html += '         data-meta="' + this.escapeHtml(mTextR) + '" ';
              html += '         data-overview="' + this.escapeHtml((qInfoR.notice ? qInfoR.notice + ' | ' : '') + (rItem.overview || '')) + '" ';
              html += '         data-slug="' + this.escapeHtml(rItem.slug) + '" ';
              html += '         data-kind="' + this.escapeHtml(rItem.kind || 'movie') + '" ';
              html += '         data-provider="' + this.escapeHtml(rItem.provider || 'pelispedia') + '" ';
              html += '         data-type="pelispedia">';
              html += '      <div class="card-thumb" style="background-image: url(\'' + this.escapeHtml(rItem.poster) + '\');">';
              html += '        <span class="card-badge ' + bClassR + '">★ PARA TI</span>';
              html += '      </div>';
              html += '      <div class="card-info">';
              html += '        <div class="card-title">' + this.escapeHtml(rItem.title) + '</div>';
              html += '        <div class="card-subtitle">★ ' + this.escapeHtml(rItem.rating || '8.0') + ' • ' + this.escapeHtml(rItem.year || '') + '</div>';
              html += '      </div>';
              html += '    </div>';
            }
            html += '  </div>';
            html += '</div>';
          }
        }
      }

      // 2. Fila "Continuar Viendo" en la vista general (filter === 'all')
      if (filter === 'all') {
        var progressMap = this.getWatchProgressMap();
        var continueKeys = Object.keys(progressMap);
        if (continueKeys.length > 0) {
          html += '<div class="content-row continue-watching-row">';
          html += '  <div class="row-header">';
          html += '    <div class="row-title">Continuar Viendo (' + continueKeys.length + ')</div>';
          html += '    <div class="carousel-nav-arrows">';
          html += '      <button class="carousel-nav-btn btn-arrow-prev focusable" tabindex="0">&#9668;</button>';
          html += '      <button class="carousel-nav-btn btn-arrow-next focusable" tabindex="0">&#9658;</button>';
          html += '    </div>';
          html += '  </div>';
          html += '  <div class="row-carousel">';
          for (var cIdx = 0; cIdx < continueKeys.length; cIdx++) {
            var cItem = progressMap[continueKeys[cIdx]];
            var pct = cItem.percent || 0;
            html += '    <div class="tv-card tv-card-poster focusable" tabindex="0" ';
            html += '         data-title="' + this.escapeHtml(cItem.title) + '" ';
            html += '         data-meta="VISTO ' + pct + '% • Reanudar en ' + this.formatTime(cItem.time) + '" ';
            html += '         data-overview="Pulsa OK para reanudar la reproducción desde el minuto ' + this.formatTime(cItem.time) + '." ';
            html += '         data-slug="' + this.escapeHtml(cItem.slug) + '" ';
            html += '         data-kind="' + this.escapeHtml(cItem.kind || 'movie') + '" ';
            html += '         data-provider="' + this.escapeHtml(cItem.provider || 'pelispedia') + '" ';
            html += '         data-type="pelispedia">';
            html += '      <div class="card-thumb" style="background-image: url(\'' + this.escapeHtml(cItem.poster) + '\');">';
            html += '        <span class="card-badge badge-hd">' + pct + '% VISTO</span>';
            html += '        <div class="card-resume-progress"><div class="card-resume-bar" style="width: ' + pct + '%;"></div></div>';
            html += '      </div>';
            html += '      <div class="card-info">';
            html += '        <div class="card-title">' + this.escapeHtml(cItem.title) + '</div>';
            html += '        <div class="card-subtitle">En ' + this.formatTime(cItem.time) + ' / ' + this.formatTime(cItem.duration) + '</div>';
            html += '      </div>';
            html += '    </div>';
          }
          html += '  </div>';
          html += '</div>';
        }
      }

      for (var r = 0; r < rows.length; r++) {
        var row = rows[r];
        if (!row.items || row.items.length === 0) continue;
        if (!this.isRowMatchingFilter(row.title, filter)) continue;

        matchingCount++;
        html += '<div class="content-row">';
        html += '  <div class="row-header">';
        html += '    <div class="row-title">' + this.escapeHtml(row.title) + '</div>';
        html += '    <div class="carousel-nav-arrows">';
        html += '      <button class="carousel-nav-btn btn-arrow-prev focusable" tabindex="0" title="Desplazar a la izquierda">&#9668;</button>';
        html += '      <button class="carousel-nav-btn btn-arrow-next focusable" tabindex="0" title="Desplazar a la derecha">&#9658;</button>';
        html += '    </div>';
        html += '  </div>';
        html += '  <div class="row-carousel">';

        for (var i = 0; i < row.items.length; i++) {
          var item = row.items[i];
          var qInfo = item.qualityInfo || { isCam: false, badge: 'HD 1080p' };
          var badgeClass = qInfo.isCam ? 'badge-cam' : 'badge-hd';
          var badgeText = qInfo.badge;
          var metaText = badgeText + ' • ★ ' + (item.rating || '7.0') + ' • ' + (item.year || '2026');

          html += '    <div class="tv-card tv-card-poster focusable" tabindex="0" ';
          html += '         data-title="' + this.escapeHtml(item.title) + '" ';
          html += '         data-meta="' + this.escapeHtml(metaText) + '" ';
          html += '         data-overview="' + this.escapeHtml((qInfo.notice ? qInfo.notice + ' | ' : '') + (item.overview || '')) + '" ';
          html += '         data-slug="' + this.escapeHtml(item.slug) + '" ';
          html += '         data-kind="' + this.escapeHtml(item.kind) + '" ';
          html += '         data-provider="' + this.escapeHtml(item.provider || 'pelispedia') + '" ';
          html += '         data-type="pelispedia">';
          html += '      <div class="card-thumb" style="background-image: url(\'' + this.escapeHtml(item.poster) + '\');">';
          html += '        <span class="card-badge ' + badgeClass + '">' + badgeText + '</span>';
          html += '      </div>';
          html += '      <div class="card-info">';
          html += '        <div class="card-title">' + this.escapeHtml(item.title) + '</div>';
          html += '        <div class="card-subtitle">★ ' + this.escapeHtml(item.rating) + ' • ' + this.escapeHtml(item.year) + '</div>';
          html += '      </div>';
          html += '    </div>';
        }

        html += '  </div>';
        html += '</div>';
      }

      if (matchingCount === 0 && filter !== 'favorites') {
        html = '<div style="padding: 40px; font-size: 24px; color: #7b8290;">No hay contenidos disponibles para este filtro.</div>';
      }

      var vpResetMain = document.querySelector('.tv-content-viewport');
      if (vpResetMain) vpResetMain.scrollTop = 0;
      this.sectionsWrapper.innerHTML = html;
      this.attachCardEvents();
    },

    attachCardEvents: function () {
      var self = this;
      var cards = document.querySelectorAll('.tv-card');
      for (var i = 0; i < cards.length; i++) {
        (function (card) {
          // Hover / Mouseenter del cursor virtual de la TV: sincronizar foco y banner de vista previa
          card.addEventListener('mouseenter', function () {
            window.SpatialNav.focusElement(card);
          }, false);

          card.addEventListener('click', function () {
            var title = card.getAttribute('data-title');
            var url = card.getAttribute('data-url');
            var type = card.getAttribute('data-type');
            var slug = card.getAttribute('data-slug');
            var kind = card.getAttribute('data-kind');
            var provider = card.getAttribute('data-provider') || 'pelispedia';
            var isLiveAttr = card.getAttribute('data-is-live') === 'true';

            if (type === 'pelispedia') {
              self.lastFocusedGridItem = card;
              self.openDetailModal(kind, slug, provider);
            } else {
              var isChannel = isLiveAttr || (kind === 'canal') || (provider === 'pluto') || (provider === 'iptv') || (provider === 'channels') || (self.currentCategory === 'channels');
              var playInfo = {
                title: title,
                url: url,
                type: type,
                kind: isChannel ? 'canal' : (kind || 'movie'),
                isLive: isChannel,
                provider: provider || (isChannel ? 'channels' : 'pelispedia')
              };
              window.TVPlayer.play(title, url, type, 0, playInfo);
            }
          }, false);
        })(cards[i]);
      }

      // Conectar botones de flechas (◄ / ►) para desplazamiento horizontal en cada carrusel
      var rows = document.querySelectorAll('.content-row');
      for (var r = 0; r < rows.length; r++) {
        (function (rowEl) {
          var prevBtn = rowEl.querySelector('.btn-arrow-prev');
          var nextBtn = rowEl.querySelector('.btn-arrow-next');
          var carousel = rowEl.querySelector('.row-carousel');
          if (carousel) {
            if (prevBtn) {
              prevBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (typeof carousel.scrollBy === 'function') {
                  carousel.scrollBy({ left: -600, behavior: 'smooth' });
                } else {
                  carousel.scrollLeft -= 600;
                }
              }, false);
            }
            if (nextBtn) {
              nextBtn.addEventListener('click', function (e) {
                e.stopPropagation();
                if (typeof carousel.scrollBy === 'function') {
                  carousel.scrollBy({ left: 600, behavior: 'smooth' });
                } else {
                  carousel.scrollLeft += 600;
                }
              }, false);
            }
          }
        })(rows[r]);
      }

      // Habilitar arrastre fluido con mouse/puntero sobre los carruseles
      this.enableCarouselDrag();

      // Si no hay ningún foco activo en pantalla, enfocar el primer elemento disponible
      if (!window.SpatialNav.currentFocused) {
        var firstCard = document.querySelector('.tv-card.focusable');
        if (firstCard) {
          window.SpatialNav.focusElement(firstCard);
        }
      }
    },

    enableCarouselDrag: function () {
      var carousels = document.querySelectorAll('.row-carousel, .episodes-carousel');
      for (var i = 0; i < carousels.length; i++) {
        (function (carousel) {
          if (carousel.getAttribute('data-drag-bound') === 'true') return;
          carousel.setAttribute('data-drag-bound', 'true');

          var isDown = false;
          var startX = 0;
          var scrollLeft = 0;

          carousel.addEventListener('mousedown', function (e) {
            isDown = true;
            startX = e.pageX - carousel.offsetLeft;
            scrollLeft = carousel.scrollLeft;
          }, false);

          carousel.addEventListener('mouseleave', function () {
            isDown = false;
          }, false);

          carousel.addEventListener('mouseup', function () {
            isDown = false;
          }, false);

          carousel.addEventListener('mousemove', function (e) {
            if (!isDown) return;
            e.preventDefault();
            var x = e.pageX - carousel.offsetLeft;
            var walk = (x - startX) * 1.5;
            carousel.scrollLeft = scrollLeft - walk;
          }, false);
        })(carousels[i]);
      }
    },

    openDetailModal: function (kind, slug, provider) {
      var self = this;
      provider = provider || 'pelispedia';
      this.detailModal.style.display = 'block';

      var cornerCloseBtn = document.getElementById('btn-detail-corner-close');
      if (cornerCloseBtn) {
        cornerCloseBtn.onclick = function () {
          self.closeDetailModal();
        };
      }

      document.getElementById('detail-title').innerText = 'Cargando detalles...';
      document.getElementById('detail-overview').innerText = '';
      document.getElementById('detail-actions').innerHTML = '';
      document.getElementById('detail-episodes-section').style.display = 'none';

      var detailApi = '/api/movies?action=detail&kind=' + encodeURIComponent(kind) + '&slug=' + encodeURIComponent(slug) + '&provider=' + encodeURIComponent(provider);
      this.fetchJson(detailApi, function (err, data) {
        if (err || !data || data.status !== 'ok') {
          alert('Error al cargar la información del contenido.');
          self.closeDetailModal();
          return;
        }

        self.currentSerieDetail = data;

        document.getElementById('detail-title').innerText = data.title;
        document.getElementById('detail-overview').innerText = data.overview || 'Sin sinopsis disponible.';
        document.getElementById('detail-year').innerText = data.year || '2026';
        document.getElementById('detail-kind').innerText = data.kind.toUpperCase() + ' (' + (data.provider || 'PelisPedia').toUpperCase() + ')';

        var qualityAlert = document.getElementById('detail-quality-alert');
        if (qualityAlert) {
          if (data.qualityInfo) {
            qualityAlert.style.display = 'block';
            if (data.qualityInfo.isCam) {
              qualityAlert.className = 'detail-quality-banner detail-quality-cam';
              qualityAlert.innerHTML = '<strong>' + self.escapeHtml(data.qualityInfo.badge) + ':</strong> ' + self.escapeHtml(data.qualityInfo.notice);
            } else {
              qualityAlert.className = 'detail-quality-banner detail-quality-hd';
              qualityAlert.innerHTML = '<strong>' + self.escapeHtml(data.qualityInfo.badge) + ':</strong> ' + self.escapeHtml(data.qualityInfo.notice);
            }
          } else {
            qualityAlert.style.display = 'none';
          }
        }

        if (data.poster) {
          document.getElementById('detail-poster').style.backgroundImage = 'url(\'' + data.poster + '\')';
        }

        var progressMap = self.getWatchProgressMap();
        var key = data.slug || data.title;
        var savedProgress = progressMap[key];

        var isFav = self.isFavorite(data.slug);
        var favBtnText = isFav ? '★ EN FAVORITOS' : '☆ AGREGAR A FAVORITOS';

        var actionsHtml = '';
        if (data.kind === 'movie') {
          if (savedProgress && savedProgress.time > 15) {
            actionsHtml += '<button id="btn-resume-movie" class="btn-tv btn-tv-primary focusable" tabindex="0">► REANUDAR (' + self.formatTime(savedProgress.time) + ')</button>';
            actionsHtml += '<button id="btn-play-movie" class="btn-tv focusable" tabindex="0">DESDE EL PRINCIPIO</button>';
          } else {
            actionsHtml += '<button id="btn-play-movie" class="btn-tv btn-tv-primary focusable" tabindex="0">► REPRODUCIR PELÍCULA</button>';
          }
          actionsHtml += '<button id="btn-toggle-fav" class="btn-tv focusable" tabindex="0">' + favBtnText + '</button>';
          actionsHtml += '<button id="btn-close-modal" class="btn-tv focusable" tabindex="0">VOLVER</button>';
          document.getElementById('detail-actions').innerHTML = actionsHtml;

          var resumeBtn = document.getElementById('btn-resume-movie');
          var playBtn = document.getElementById('btn-play-movie');
          var favBtn = document.getElementById('btn-toggle-fav');
          var closeBtn = document.getElementById('btn-close-modal');

          function startMovie(startTime) {
            var targetBtn = resumeBtn || playBtn;
            if (targetBtn) targetBtn.innerText = 'Extrayendo stream...';
            var resolveApi = '/api/movies?action=resolve&player_url=' + encodeURIComponent(data.player_url) + '&provider=' + encodeURIComponent(data.provider || 'pelispedia');
            self.fetchJson(resolveApi, function (err2, res) {
              if (targetBtn) targetBtn.innerText = '► REPRODUCIR';
              if (!err2 && res && res.streamUrl) {
                self.closeDetailModal();
                var movieInfo = {
                  title: data.title,
                  slug: data.slug,
                  kind: data.kind,
                  provider: data.provider || 'pelispedia',
                  poster: data.poster,
                  backupUrl: res.backupUrl || null,
                  backups: res.backups || []
                };
                window.TVPlayer.play(data.title, res.streamUrl, res.type, startTime, movieInfo);
              } else {
                alert('No se pudo extraer el stream de este servidor. Intenta con otro título.');
              }
            });
          }

          if (resumeBtn) {
            resumeBtn.addEventListener('click', function () {
              startMovie(savedProgress.time);
            }, false);
          }

          if (playBtn) {
            playBtn.addEventListener('click', function () {
              startMovie(0);
            }, false);
          }

          if (favBtn) {
            favBtn.addEventListener('click', function () {
              var isNowFav = self.toggleFavorite({
                title: data.title,
                slug: data.slug,
                kind: data.kind,
                provider: data.provider || 'pelispedia',
                poster: data.poster,
                rating: data.rating,
                year: data.year
              });
              favBtn.innerText = isNowFav ? '★ EN FAVORITOS' : '☆ AGREGAR A FAVORITOS';
            }, false);
          }

          closeBtn.addEventListener('click', function () {
            self.closeDetailModal();
          }, false);

          window.SpatialNav.focusElement(resumeBtn || playBtn);
        } else {
          // Es una Serie o Anime
          actionsHtml += '<button id="btn-toggle-fav" class="btn-tv focusable" tabindex="0">' + favBtnText + '</button>';
          actionsHtml += '<button id="btn-close-modal" class="btn-tv focusable" tabindex="0">VOLVER</button>';
          document.getElementById('detail-actions').innerHTML = actionsHtml;

          var favBtnSerie = document.getElementById('btn-toggle-fav');
          if (favBtnSerie) {
            favBtnSerie.addEventListener('click', function () {
              var isNowFav = self.toggleFavorite({
                title: data.title,
                slug: data.slug,
                kind: data.kind,
                provider: data.provider || 'pelispedia',
                poster: data.poster,
                rating: data.rating,
                year: data.year
              });
              favBtnSerie.innerText = isNowFav ? '★ EN FAVORITOS' : '☆ AGREGAR A FAVORITOS';
            }, false);
          }

          document.getElementById('btn-close-modal').addEventListener('click', function () {
            self.closeDetailModal();
          }, false);

          document.getElementById('detail-episodes-section').style.display = 'block';
          self.renderSeasonsAndEpisodes(data);
        }
      });
    },

    renderSeasonsAndEpisodes: function (data) {
      var self = this;
      var seasonsCount = data.seasons_count || 1;
      var seasonsRow = document.getElementById('seasons-row');
      var html = '';

      for (var s = 1; s <= seasonsCount; s++) {
        html += '<button class="season-btn focusable' + (s === 1 ? ' active' : '') + '" data-season="' + s + '" tabindex="0">Temp ' + s + '</button>';
      }
      seasonsRow.innerHTML = html;

      var seasonBtns = seasonsRow.querySelectorAll('.season-btn');
      for (var i = 0; i < seasonBtns.length; i++) {
        (function (btn) {
          btn.addEventListener('click', function () {
            for (var j = 0; j < seasonBtns.length; j++) {
              window.SpatialNav.removeClass(seasonBtns[j], 'active');
            }
            window.SpatialNav.addClass(btn, 'active');
            var seasonNum = btn.getAttribute('data-season');
            self.loadEpisodes(data.id, seasonNum, data.provider);
          }, false);
        })(seasonBtns[i]);
      }

      // Cargar temporada 1 por defecto
      self.loadEpisodes(data.id, 1, data.provider);
    },

    loadEpisodes: function (itemId, seasonNum, provider) {
      var self = this;
      provider = provider || 'pelispedia';
      var epCarousel = document.getElementById('episodes-carousel');
      epCarousel.innerHTML = '<div style="color: #9aa0a6; padding: 10px;">Cargando episodios de la temporada ' + seasonNum + '...</div>';

      var epApi = '/api/movies?action=episodes&item_id=' + encodeURIComponent(itemId) + '&season=' + encodeURIComponent(seasonNum) + '&provider=' + encodeURIComponent(provider);
      this.fetchJson(epApi, function (err, res) {
        if (err || !res || !res.episodes || res.episodes.length === 0) {
          epCarousel.innerHTML = '<div style="color: #ff5555; padding: 10px;">No se encontraron episodios disponibles.</div>';
          return;
        }

        var html = '';
        for (var i = 0; i < res.episodes.length; i++) {
          var ep = res.episodes[i];
          html += '<div class="episode-card focusable" tabindex="0" ';
          html += '     data-title="' + self.escapeHtml(ep.title) + '" ';
          html += '     data-provider="' + self.escapeHtml(provider) + '" ';
          html += '     data-player="' + self.escapeHtml(ep.player_url) + '">';
          html += '  <div class="episode-thumb" style="background-image: url(\'' + self.escapeHtml(ep.thumb) + '\');"></div>';
          html += '  <div class="episode-info">';
          html += '    <div class="episode-title">Ep. ' + ep.episode + ': ' + self.escapeHtml(ep.title) + '</div>';
          html += '  </div>';
          html += '</div>';
        }
        epCarousel.innerHTML = html;

        var epCards = epCarousel.querySelectorAll('.episode-card');
        for (var k = 0; k < epCards.length; k++) {
          (function (epCard, epIndex) {
            epCard.addEventListener('mouseenter', function () {
              window.SpatialNav.focusElement(epCard);
            }, false);

            epCard.addEventListener('click', function () {
              var epTitle = epCard.getAttribute('data-title');
              var playerUrl = epCard.getAttribute('data-player');
              var epProvider = epCard.getAttribute('data-provider') || 'pelispedia';

              epCard.querySelector('.episode-title').innerText = 'Extrayendo...';
              var resolveApi = '/api/movies?action=resolve&player_url=' + encodeURIComponent(playerUrl) + '&provider=' + encodeURIComponent(epProvider);
              self.fetchJson(resolveApi, function (err2, res2) {
                epCard.querySelector('.episode-title').innerText = epTitle;
                if (!err2 && res2 && res2.streamUrl) {
                  self.closeDetailModal();
                  var serieTitle = self.currentSerieDetail ? self.currentSerieDetail.title : '';
                  var fullTitle = (serieTitle ? serieTitle + ' - ' : '') + epTitle;
                  var epInfo = {
                    title: fullTitle,
                    slug: (self.currentSerieDetail ? self.currentSerieDetail.slug : '') + '-s' + seasonNum + 'e' + epIndex,
                    kind: 'serie',
                    provider: epProvider,
                    poster: (self.currentSerieDetail ? self.currentSerieDetail.poster : ''),
                    backupUrl: res2.backupUrl || null,
                    backups: res2.backups || []
                  };

                  // Auto-reproducir siguiente episodio al terminar
                  var onNextEpisode = function () {
                    if (epIndex + 1 < epCards.length) {
                      window.TVPlayer.showToast('Episodio terminado. Siguiente en 4 segundos...');
                      setTimeout(function () {
                        if (epCards[epIndex + 1]) {
                          epCards[epIndex + 1].click();
                        }
                      }, 4000);
                    } else {
                      window.TVPlayer.close();
                    }
                  };

                  window.TVPlayer.play(fullTitle, res2.streamUrl, res2.type, 0, epInfo, onNextEpisode);
                } else {
                  alert('No se pudo extraer el stream de este episodio.');
                }
              });
            }, false);
          })(epCards[k], k);
        }

        self.enableCarouselDrag();

        // Enfocar primer episodio
        if (epCards.length > 0) {
          window.SpatialNav.focusElement(epCards[0]);
        }
      });
    },

    closeDetailModal: function () {
      if (this.detailModal) {
        this.detailModal.style.display = 'none';
      }
      if (this.lastFocusedGridItem) {
        window.SpatialNav.focusElement(this.lastFocusedGridItem);
      }
    },

    renderError: function (msg) {
      this.sectionsWrapper.innerHTML = '<div style="padding: 40px; font-size: 24px; color: #ff5555;">' + this.escapeHtml(msg) + '</div>';
    },

    escapeHtml: function (text) {
      if (!text) return '';
      return String(text)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
    }
  };

  window.addEventListener('load', function () {
    TVApp.init();
  }, false);

  window.TVApp = TVApp;
})(window);
