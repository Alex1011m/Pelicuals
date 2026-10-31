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
    sidebar: null,
    sidebarExpanded: false,
    currentMovieFilter: 'all',
    cachedMovieRows: null,
    lastFocusedGridItem: null,
    currentSerieDetail: null,
    searchEventsBound: false,
    sidebarEventsBound: false,

    init: function () {
      this.sectionsWrapper = document.getElementById('tv-sections-wrapper');
      this.searchContainer = document.getElementById('tv-search-container');
      this.detailModal = document.getElementById('tv-detail-modal');
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
        if (self.detailModal && self.detailModal.style.display === 'block') {
          self.closeDetailModal();
        } else if (self.sidebarExpanded) {
          self.collapseSidebar();
        }
      };

      // Soporte para scroll vertical con rueda del mouse o gestos de cursor
      var viewport = document.querySelector('.tv-content-viewport');
      if (viewport) {
        viewport.addEventListener('wheel', function (e) {
          if (self.sectionsWrapper && self.sectionsWrapper.style.display !== 'none') {
            var currentTransform = self.sectionsWrapper.style.transform || '';
            var match = /translateY\(-?(\d+)px\)/.exec(currentTransform);
            var currentY = match ? parseInt(match[1], 10) : 0;
            var maxScroll = Math.max(0, self.sectionsWrapper.offsetHeight - viewport.offsetHeight + 100);
            currentY += (e.deltaY > 0 ? 180 : -180);
            if (currentY < 0) currentY = 0;
            if (currentY > maxScroll) currentY = maxScroll;
            self.sectionsWrapper.style.transform = 'translateY(-' + currentY + 'px)';
            self.sectionsWrapper.style.webkitTransform = 'translateY(-' + currentY + 'px)';
          }
        }, false);
      }

      this.setupTabs();
      this.setupSidebar();
      this.loadCategory('channels');
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

    updatePreviewBanner: function (elem) {
      if (!elem) return;
      var titleEl = document.getElementById('preview-banner-title');
      var metaEl = document.getElementById('preview-banner-meta');
      var descEl = document.getElementById('preview-banner-desc');
      if (!titleEl || !metaEl || !descEl) return;

      if (window.SpatialNav.hasClass(elem, 'sidebar-item')) {
        var labelEl = elem.querySelector('.sidebar-label');
        var labelText = labelEl ? labelEl.innerText : 'Menú Lateral';
        titleEl.innerText = 'Filtro: ' + labelText;
        metaEl.innerText = 'Menú Lateral • Películas, Series y Anime';
        descEl.innerText = 'Presiona OK o la Flecha Derecha para ver y explorar los títulos de esta categoría.';
      } else if (window.SpatialNav.hasClass(elem, 'tv-card')) {
        var title = elem.getAttribute('data-title') || '';
        var meta = elem.getAttribute('data-meta') || '';
        var overview = elem.getAttribute('data-overview') || '';

        titleEl.innerText = title;
        metaEl.innerText = meta;
        descEl.innerText = overview || 'Presiona OK para ver detalles y reproducir a pantalla completa.';
      } else if (window.SpatialNav.hasClass(elem, 'nav-tab')) {
        titleEl.innerText = 'Smart TV Hub';
        metaEl.innerText = 'Sección: ' + elem.innerText;
        descEl.innerText = 'Usa las flechas Abajo y Derecha en el mando a distancia para explorar los contenidos.';
      }
    },

    setupTabs: function () {
      var self = this;
      var tabs = document.querySelectorAll('.nav-tab');
      for (var i = 0; i < tabs.length; i++) {
        (function (tab) {
          tab.addEventListener('click', function () {
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
      this.sectionsWrapper.style.transform = 'translateY(0px)';
      this.sectionsWrapper.innerHTML = '<div style="padding: 40px; font-size: 26px; color: #8890a0;">Cargando catálogo para la TV...</div>';

      var self = this;
      if (category === 'channels') {
        this.fetchJson('/api/channels', function (err, data) {
          if (err || !data || !data.categories) {
            self.renderError('No se pudieron cargar los canales de TV.');
            return;
          }
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
    },

    performSearch: function (query) {
      var self = this;
      var resultsWrapper = document.getElementById('search-results-wrapper');
      resultsWrapper.innerHTML = '<div style="padding: 30px; font-size: 24px; color: #00e5ff;">Buscando "' + this.escapeHtml(query) + '" en PelisPedia y todos los servidores...</div>';

      this.fetchJson('/api/movies?action=search&q=' + encodeURIComponent(query), function (err, res) {
        if (err || !res || !res.items || res.items.length === 0) {
          resultsWrapper.innerHTML = '<div style="padding: 30px; font-size: 22px; color: #ff5555;">No se encontraron resultados para "' + self.escapeHtml(query) + '". Prueba con otra palabra clave.</div>';
          return;
        }

        var html = '<div class="row-title" style="margin-bottom: 20px;">' + res.items.length + ' Resultados encontrados:</div>';
        html += '<div class="search-results-grid">';

        for (var i = 0; i < res.items.length; i++) {
          var item = res.items[i];
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
          html += '    <div class="tv-card tv-card-landscape tv-card-channel focusable" tabindex="0" ';
          html += '         data-title="' + this.escapeHtml(item.title) + '" ';
          html += '         data-meta="' + (item.type === 'hls' ? 'CANAL EN VIVO' : 'VIDEO HD') + '" ';
          html += '         data-overview="' + this.escapeHtml(item.subtitle || '') + '" ';
          html += '         data-url="' + this.escapeHtml(item.streamUrl) + '" ';
          html += '         data-type="' + this.escapeHtml(item.type) + '">';
          html += '      <div class="card-thumb" style="background-image: url(\'' + this.escapeHtml(item.thumb) + '\');">';
          html += '        <span class="card-badge">' + (item.type === 'hls' ? 'EN VIVO' : 'VIDEO') + '</span>';
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

    renderMovieRows: function (rows, filter) {
      filter = filter || this.currentMovieFilter || 'all';
      var html = '';
      var matchingCount = 0;

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

      if (matchingCount === 0) {
        html = '<div style="padding: 40px; font-size: 24px; color: #7b8290;">No hay contenidos disponibles para este filtro.</div>';
      }

      this.sectionsWrapper.style.transform = 'translateY(0px)';
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

            if (type === 'pelispedia') {
              self.lastFocusedGridItem = card;
              self.openDetailModal(kind, slug, provider);
            } else {
              window.TVPlayer.play(title, url, type);
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

        var actionsHtml = '';
        if (data.kind === 'movie') {
          actionsHtml += '<button id="btn-play-movie" class="btn-tv btn-tv-primary focusable" tabindex="0">► REPRODUCIR PELÍCULA</button>';
          actionsHtml += '<button id="btn-close-modal" class="btn-tv focusable" tabindex="0">VOLVER</button>';
          document.getElementById('detail-actions').innerHTML = actionsHtml;

          var playBtn = document.getElementById('btn-play-movie');
          var closeBtn = document.getElementById('btn-close-modal');

          playBtn.addEventListener('click', function () {
            playBtn.innerText = 'Extrayendo stream...';
            var resolveApi = '/api/movies?action=resolve&player_url=' + encodeURIComponent(data.player_url) + '&provider=' + encodeURIComponent(data.provider || 'pelispedia');
            self.fetchJson(resolveApi, function (err2, res) {
              playBtn.innerText = '► REPRODUCIR PELÍCULA';
              if (!err2 && res && res.streamUrl) {
                self.closeDetailModal();
                window.TVPlayer.play(data.title, res.streamUrl, res.type);
              } else {
                alert('No se pudo extraer el stream de este servidor. Intenta con otro título.');
              }
            });
          }, false);

          closeBtn.addEventListener('click', function () {
            self.closeDetailModal();
          }, false);

          window.SpatialNav.focusElement(playBtn);
        } else {
          // Es una Serie o Anime
          actionsHtml += '<button id="btn-close-modal" class="btn-tv focusable" tabindex="0">VOLVER</button>';
          document.getElementById('detail-actions').innerHTML = actionsHtml;

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
          (function (epCard) {
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
                  var fullTitle = (self.currentSerieDetail ? self.currentSerieDetail.title + ' - ' : '') + epTitle;
                  window.TVPlayer.play(fullTitle, res2.streamUrl, res2.type);
                } else {
                  alert('No se pudo extraer el stream de este episodio.');
                }
              });
            }, false);
          })(epCards[k]);
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
