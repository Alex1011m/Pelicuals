// public/js/spatial-nav.js
// Motor de Navegación Espacial D-Pad en Vanilla JavaScript ES5 Estricto
// Compatible con navegadores legacy (WebKit 2011+, Orsay, Tizen, webOS, Opera TV)

(function (window) {
  'use strict';

  var SpatialNav = {
    currentFocused: null,
    enabled: true,
    customKeyHandler: null,

    // Códigos de teclas estándar y propietarios de Smart TVs
    KEYS: {
      LEFT: 37,
      UP: 38,
      RIGHT: 39,
      DOWN: 40,
      ENTER: 13,
      BACK_ESC: 27,
      BACK_BS: 8,
      BACK_LG: 461,       // LG webOS / NetCast Return
      BACK_SAMSUNG: 10009,// Samsung Tizen / Orsay Return
      PLAY: 179,
      PLAY_PAUSE: 415,
      PAUSE: 19,
      STOP: 413,
      REWIND: 412,
      FAST_FWD: 417
    },

    init: function () {
      var self = this;
      document.addEventListener('keydown', function (e) {
        self.handleKeyDown(e);
      }, false);
    },

    setKeyHandler: function (handler) {
      this.customKeyHandler = handler;
    },

    getFocusableElements: function () {
      // 1. Si el modal de Onboarding / Personalización está activo, restringir foco al modal
      var onboarding = document.getElementById('tv-onboarding-modal');
      if (onboarding && onboarding.style.display !== 'none' && window.getComputedStyle(onboarding).display !== 'none') {
        var obElements = onboarding.querySelectorAll('.focusable');
        var obVisible = [];
        for (var o = 0; o < obElements.length; o++) {
          var oEl = obElements[o];
          if (oEl.offsetWidth > 0 && oEl.offsetHeight > 0 && window.getComputedStyle(oEl).display !== 'none') {
            obVisible.push(oEl);
          }
        }
        return obVisible;
      }

      // 2. Si el modal de detalles está activo, restringir foco al modal
      var detail = document.getElementById('tv-detail-modal');
      if (detail && detail.style.display !== 'none' && window.getComputedStyle(detail).display !== 'none') {
        var dtElements = detail.querySelectorAll('.focusable');
        var dtVisible = [];
        for (var d = 0; d < dtElements.length; d++) {
          var dEl = dtElements[d];
          if (dEl.offsetWidth > 0 && dEl.offsetHeight > 0 && window.getComputedStyle(dEl).display !== 'none') {
            dtVisible.push(dEl);
          }
        }
        return dtVisible;
      }

      var elements = document.querySelectorAll('.focusable');
      var visible = [];
      for (var i = 0; i < elements.length; i++) {
        var el = elements[i];
        // Verificar visibilidad básica
        if (el.offsetWidth > 0 && el.offsetHeight > 0 && window.getComputedStyle(el).display !== 'none') {
          visible.push(el);
        }
      }
      return visible;
    },

    focusElement: function (elem) {
      if (!elem) return;

      if (this.currentFocused) {
        this.removeClass(this.currentFocused, 'focused');
      }

      this.currentFocused = elem;
      this.addClass(elem, 'focused');
      elem.focus();

      // Desplazamiento suave para mantenerlo visible en pantalla
      this.ensureVisible(elem);

      if (typeof elem.onFocus === 'function') {
        elem.onFocus(elem);
      }
      if (typeof this.onFocusChange === 'function') {
        this.onFocusChange(elem);
      }
    },

    ensureVisible: function (elem) {
      // 1. Scroll horizontal si está dentro de un carousel
      var carousel = this.findParentWithClass(elem, 'row-carousel');
      if (carousel) {
        var cardLeft = elem.offsetLeft;
        var cardWidth = elem.offsetWidth;
        var carouselWidth = carousel.offsetWidth;
        var scrollLeft = carousel.scrollLeft;

        if (cardLeft < scrollLeft + 80) {
          carousel.scrollLeft = Math.max(0, cardLeft - 80);
        } else if (cardLeft + cardWidth > scrollLeft + carouselWidth - 80) {
          carousel.scrollLeft = cardLeft + cardWidth - carouselWidth + 120;
        }
      }

      // 2. Scroll vertical en viewport nativo si está dentro del catálogo
      var viewport = document.querySelector('.tv-content-viewport');
      var section = this.findParentWithClass(elem, 'content-row');
      if (section && viewport) {
        var sectionTop = section.offsetTop;
        var targetY = Math.max(0, sectionTop - 15);
        if (typeof viewport.scrollTo === 'function') {
          viewport.scrollTo({ top: targetY, behavior: 'smooth' });
        } else {
          viewport.scrollTop = targetY;
        }
      } else if (this.findParentWithClass(elem, 'tv-header') && viewport) {
        if (typeof viewport.scrollTo === 'function') {
          viewport.scrollTo({ top: 0, behavior: 'smooth' });
        } else {
          viewport.scrollTop = 0;
        }
      }

      // 2b. Scroll vertical si está dentro de los resultados del buscador
      var searchGrid = this.findParentWithClass(elem, 'search-results-grid');
      var searchContainer = document.getElementById('tv-search-container');
      if (searchGrid && searchContainer) {
        var elTop = elem.offsetTop;
        var targetSearchY = Math.max(0, elTop - 120);
        if (typeof searchContainer.scrollTo === 'function') {
          searchContainer.scrollTo({ top: targetSearchY, behavior: 'smooth' });
        } else {
          searchContainer.scrollTop = targetSearchY;
        }
      }

      // 3. Scroll vertical si está dentro del menú lateral (Sidebar)
      var sidebarScroll = this.findParentWithClass(elem, 'sidebar-scroll-area');
      if (sidebarScroll) {
        var itemTop = elem.offsetTop;
        var itemHeight = elem.offsetHeight;
        var containerHeight = sidebarScroll.offsetHeight;
        var scrollTop = sidebarScroll.scrollTop;

        if (itemTop < scrollTop + 30) {
          sidebarScroll.scrollTop = Math.max(0, itemTop - 30);
        } else if (itemTop + itemHeight > scrollTop + containerHeight - 30) {
          sidebarScroll.scrollTop = itemTop + itemHeight - containerHeight + 40;
        }
      }

      // 4. Scroll vertical si está dentro del grid de Onboarding / Personalización
      var onboardingGrid = this.findParentWithClass(elem, 'onboarding-grid');
      if (onboardingGrid) {
        var obTop = elem.offsetTop;
        var obHeight = elem.offsetHeight;
        var obContainerHeight = onboardingGrid.offsetHeight;
        var obScrollTop = onboardingGrid.scrollTop;

        if (obTop < obScrollTop + 30) {
          onboardingGrid.scrollTop = Math.max(0, obTop - 30);
        } else if (obTop + obHeight > obScrollTop + obContainerHeight - 30) {
          onboardingGrid.scrollTop = obTop + obHeight - obContainerHeight + 50;
        }
      }
    },

    findParentWithClass: function (el, className) {
      while (el && el !== document.body) {
        if (this.hasClass(el, className)) {
          return el;
        }
        el = el.parentElement || el.parentNode;
      }
      return null;
    },

    move: function (direction) {
      var candidates = this.getFocusableElements();
      if (!candidates.length) return;

      if (!this.currentFocused || !document.body.contains(this.currentFocused)) {
        this.focusElement(candidates[0]);
        return;
      }

      var currentRect = this.currentFocused.getBoundingClientRect();
      var bestCandidate = null;
      var shortestDistance = 999999;

      for (var i = 0; i < candidates.length; i++) {
        var cand = candidates[i];
        if (cand === this.currentFocused) continue;

        var candRect = cand.getBoundingClientRect();
        var isValid = false;
        var primaryDiff = 0;
        var secondaryDiff = 0;

        switch (direction) {
          case 'left':
            isValid = candRect.right <= currentRect.left + 5;
            primaryDiff = currentRect.left - candRect.right;
            secondaryDiff = Math.abs((currentRect.top + currentRect.height / 2) - (candRect.top + candRect.height / 2));
            break;
          case 'right':
            isValid = candRect.left >= currentRect.right - 5;
            primaryDiff = candRect.left - currentRect.right;
            secondaryDiff = Math.abs((currentRect.top + currentRect.height / 2) - (candRect.top + candRect.height / 2));
            break;
          case 'up':
            isValid = candRect.bottom <= currentRect.top + 5;
            primaryDiff = currentRect.top - candRect.bottom;
            secondaryDiff = Math.abs((currentRect.left + currentRect.width / 2) - (candRect.left + candRect.width / 2));
            break;
          case 'down':
            isValid = candRect.top >= currentRect.bottom - 5;
            primaryDiff = candRect.top - currentRect.bottom;
            secondaryDiff = Math.abs((currentRect.left + currentRect.width / 2) - (candRect.left + candRect.width / 2));
            break;
        }

        if (isValid) {
          // Penalizar más la desviación en el eje secundario para favorecer el movimiento natural
          var distance = primaryDiff + (secondaryDiff * 2.5);
          if (distance < shortestDistance) {
            shortestDistance = distance;
            bestCandidate = cand;
          }
        }
      }

      if (bestCandidate) {
        this.focusElement(bestCandidate);
      }
    },

    handleKeyDown: function (e) {
      var keyCode = e.keyCode || e.which;

      // Si hay un manejador personalizado (por ejemplo, el reproductor de video a pantalla completa)
      if (this.customKeyHandler && this.customKeyHandler(keyCode, e)) {
        e.preventDefault();
        return;
      }

      if (!this.enabled) return;

      switch (keyCode) {
        case this.KEYS.LEFT:
          this.move('left');
          e.preventDefault();
          break;
        case this.KEYS.RIGHT:
          this.move('right');
          e.preventDefault();
          break;
        case this.KEYS.UP:
          this.move('up');
          e.preventDefault();
          break;
        case this.KEYS.DOWN:
          this.move('down');
          e.preventDefault();
          break;
        case this.KEYS.ENTER:
          if (this.currentFocused) {
            this.currentFocused.click();
          }
          e.preventDefault();
          break;
        case this.KEYS.BACK_ESC:
        case this.KEYS.BACK_BS:
        case this.KEYS.BACK_LG:
        case this.KEYS.BACK_SAMSUNG:
          // Acción de retroceso
          if (typeof window.onBackKey === 'function') {
            window.onBackKey();
          }
          e.preventDefault();
          break;
      }
    },

    // Funciones utilitarias para manejo de clases en ES5 sinclassList dependencies
    addClass: function (el, cls) {
      if (!this.hasClass(el, cls)) {
        el.className += (el.className ? ' ' : '') + cls;
      }
    },

    removeClass: function (el, cls) {
      if (this.hasClass(el, cls)) {
        var reg = new RegExp('(\\s|^)' + cls + '(\\s|$)');
        el.className = el.className.replace(reg, ' ').replace(/^\s+|\s+$/g, '');
      }
    },

    hasClass: function (el, cls) {
      return (' ' + el.className + ' ').indexOf(' ' + cls + ' ') > -1;
    }
  };

  window.SpatialNav = SpatialNav;
})(window);

