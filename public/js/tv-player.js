// public/js/tv-player.js
// Controlador de Reproductor HTML5 Nativo con HLS.js optimizado para VOD (Anti-Freeze / Búfer Inteligente)
// Compatible con ES5 estricto para Smart TVs Legacy (Samsung Orsay/Tizen, LG webOS/NetCast)

(function (window) {
  'use strict';

  var TVPlayer = {
    modal: null,
    video: null,
    osd: null,
    titleEl: null,
    progressBar: null,
    progressContainer: null,
    timeDisplay: null,
    btnFloatingClose: null,
    btnPlayPause: null,
    btnRewind: null,
    btnForward: null,
    btnFullscreen: null,
    btnAudio: null,
    btnSubs: null,
    toastEl: null,
    bufferingEl: null,
    bufferingTextEl: null,
    toastTimer: null,
    osdTimer: null,
    stallTimer: null,
    lastFocusedElement: null,
    hlsInstance: null,
    hasFatalError: false,
    networkRetryCount: 0,
    currentItemInfo: null,
    pendingStartTime: 0,
    onEndedCallback: null,
    lastSaveTime: 0,

    // Colecciones de pistas
    audioTracks: [],
    currentAudioTrack: 0,
    subtitleTracks: [],
    currentSubtitleTrack: -1, // -1 = desactivados

    init: function () {
      this.modal = document.getElementById('tv-player-modal');
      this.video = document.getElementById('main-video');
      this.osd = document.getElementById('player-osd');
      this.titleEl = document.getElementById('osd-title');
      this.progressBar = document.getElementById('osd-progress-bar');
      this.progressContainer = document.getElementById('osd-progress-container');
      this.timeDisplay = document.getElementById('time-labels');
      this.btnFloatingClose = document.getElementById('btn-player-close');
      this.btnPlayPause = document.getElementById('btn-player-playpause');
      this.btnRewind = document.getElementById('btn-player-rewind');
      this.btnForward = document.getElementById('btn-player-forward');
      this.btnFullscreen = document.getElementById('btn-fullscreen-toggle');
      this.btnAudio = document.getElementById('btn-audio-toggle');
      this.btnSubs = document.getElementById('btn-subs-toggle');
      this.toastEl = document.getElementById('player-toast');
      this.bufferingEl = document.getElementById('player-buffering-indicator');
      this.bufferingTextEl = document.getElementById('buffering-text');

      var self = this;

      // Eventos nativos del elemento <video>
      this.video.addEventListener('timeupdate', function () {
        self.updateProgress();
        if (self.video && self.video.duration && self.currentItemInfo) {
          var now = Date.now();
          if (now - self.lastSaveTime > 3500) {
            self.lastSaveTime = now;
            self.saveProgress();
          }
        }
      }, false);

      this.video.addEventListener('ended', function () {
        self.saveProgress();
        if (typeof self.onEndedCallback === 'function') {
          self.onEndedCallback();
        } else {
          self.close();
        }
      }, false);

      this.video.addEventListener('loadedmetadata', function () {
        self.detectNativeTracks();
      }, false);

      this.video.addEventListener('play', function () {
        self.updatePlayPauseButton(false);
      }, false);

      this.video.addEventListener('pause', function () {
        self.updatePlayPauseButton(true);
      }, false);

      // Clic directo sobre el video para reproducir/pausar o despertar controles
      this.video.addEventListener('click', function (e) {
        e.stopPropagation();
        if (self.isOsdHidden()) {
          self.showOSD();
        } else {
          self.togglePlayPause();
        }
      }, false);

      // Despertar OSD y restaurar cursor con cualquier interacción de ratón / touch / puntero
      if (this.modal) {
        var onUserActivity = function () {
          self.showOSD();
        };
        this.modal.addEventListener('mousemove', onUserActivity, false);
        this.modal.addEventListener('pointermove', onUserActivity, false);
        this.modal.addEventListener('touchstart', onUserActivity, false);
        this.modal.addEventListener('click', onUserActivity, false);
      }

      // Botón flotante para salir del reproductor
      if (this.btnFloatingClose) {
        this.btnFloatingClose.addEventListener('click', function (e) {
          e.stopPropagation();
          self.close();
        }, false);
      }

      // Botones OSD de Play/Pausa, -10s y +10s
      if (this.btnPlayPause) {
        this.btnPlayPause.addEventListener('click', function (e) {
          e.stopPropagation();
          self.togglePlayPause();
        }, false);
      }

      if (this.btnRewind) {
        this.btnRewind.addEventListener('click', function (e) {
          e.stopPropagation();
          if (self.video) {
            self.video.currentTime = Math.max(0, self.video.currentTime - 10);
            self.showOSD();
          }
        }, false);
      }

      if (this.btnForward) {
        this.btnForward.addEventListener('click', function (e) {
          e.stopPropagation();
          if (self.video && self.video.duration) {
            self.video.currentTime = Math.min(self.video.duration, self.video.currentTime + 10);
            self.showOSD();
          }
        }, false);
      }

      // Salto interactivo haciendo clic sobre la barra de progreso
      if (this.progressContainer) {
        this.progressContainer.addEventListener('click', function (e) {
          e.stopPropagation();
          if (!self.video || !self.video.duration) return;
          var rect = self.progressContainer.getBoundingClientRect();
          var clickX = e.clientX - rect.left;
          var ratio = clickX / rect.width;
          if (ratio < 0) ratio = 0;
          if (ratio > 1) ratio = 1;
          self.video.currentTime = ratio * self.video.duration;
          self.updateProgress();
          self.showOSD();
        }, false);
      }

      // Detección de carga y almacenamiento en búfer para evitar congelamientos ("pegarse")
      this.video.addEventListener('waiting', function () {
        if (self.hasFatalError) return;
        self.showBuffering(true, 'Cargando...');
        clearTimeout(self.stallTimer);
        // Si el video se queda esperando datos por más de 12 segundos, intentar un nudge suave
        self.stallTimer = setTimeout(function () {
          if (self.hasFatalError) return;
          if (self.video && !self.video.paused && self.video.currentTime > 0.5) {
            console.warn('Reproductor en espera prolongada. Ajustando posición de reproducción...');
            try {
              self.video.currentTime += 0.1;
              self.safePlay(self.video);
            } catch (e) { }
          }
        }, 12000);
      }, false);

      this.video.addEventListener('stalled', function () {
        if (self.hasFatalError) return;
        self.showBuffering(true, 'Conexión lenta...');
      }, false);

      this.video.addEventListener('loadedmetadata', function () {
        self.applyPendingSeek();
      }, false);

      this.video.addEventListener('playing', function () {
        self.showBuffering(false);
        clearTimeout(self.stallTimer);
        self.applyPendingSeek();
      }, false);

      this.video.addEventListener('canplay', function () {
        self.showBuffering(false);
        clearTimeout(self.stallTimer);
        self.applyPendingSeek();
      }, false);

      this.video.addEventListener('error', function (e) {
        // Ignorar si el reproductor está cerrado o si no hay stream activo
        if (!self.modal || self.modal.style.display === 'none') return;
        if (!self.currentStreamUrl) return;

        // Si Hls.js está gestionando la reproducción, Hls.js maneja sus propios errores
        if (self.hlsInstance) return;

        var err = self.video.error;
        // Si no hay objeto de error o fue cancelado intencionalmente por cambio de src (ABORTED), ignorar
        if (!err || err.code === 1 /* MEDIA_ERR_ABORTED */) return;

        console.warn('Detalle del evento error en video nativo:', err.code, err.message, self.video.currentSrc);

        // Recuperación automática con fuentes o servidores de respaldo
        if (self.backups && self.backups.length > 0) {
          var nextBackup = self.backups.shift();
          console.warn('Fallo en stream nativo. Probando servidor de respaldo:', nextBackup);
          self.showToast('Reconectando con servidor alternativo...');
          self.currentStreamUrl = nextBackup;
          self.video.src = nextBackup;
          self.video.load();
          self.safePlay(self.video);
          return;
        }

        self.hasFatalError = true;
        self.showBuffering(false);
        clearTimeout(self.stallTimer);
        self.showToast('No se pudo reproducir este stream. Pulsa ATRÁS.');
      }, false);

      if (this.btnFullscreen) {
        this.btnFullscreen.addEventListener('click', function () {
          self.toggleFullscreen();
        }, false);
      }

      if (this.btnAudio) {
        this.btnAudio.addEventListener('click', function () {
          self.cycleAudioTrack();
        }, false);
      }

      if (this.btnSubs) {
        this.btnSubs.addEventListener('click', function () {
          self.cycleSubtitleTrack();
        }, false);
      }
    },

    togglePlayPause: function () {
      if (!this.video) return;
      if (this.video.paused) {
        this.safePlay(this.video);
      } else {
        this.video.pause();
      }
      this.showOSD();
    },

    updatePlayPauseButton: function (isPaused) {
      if (this.btnPlayPause) {
        this.btnPlayPause.innerHTML = isPaused ? '&#9658; PLAY' : '&#10074;&#10074; PAUSA';
      }
    },

    showBuffering: function (show, text) {
      if (!this.bufferingEl) {
        this.bufferingEl = document.getElementById('player-buffering-indicator');
        this.bufferingTextEl = document.getElementById('buffering-text');
      }
      if (!this.bufferingEl) return;

      if (show) {
        if (text && this.bufferingTextEl) {
          this.bufferingTextEl.innerText = text;
        }
        this.bufferingEl.style.display = 'flex';
      } else {
        this.bufferingEl.style.display = 'none';
      }
    },

    toggleFullscreen: function () {
      var doc = window.document;
      var docEl = this.modal || doc.documentElement;

      var requestFS = docEl.requestFullscreen || docEl.webkitRequestFullscreen || docEl.mozRequestFullScreen || docEl.msRequestFullscreen;
      var exitFS = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;

      var isFS = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;

      if (!isFS) {
        if (requestFS) {
          requestFS.call(docEl);
        }
      } else {
        if (exitFS) {
          exitFS.call(doc);
        }
      }
    },

    play: function (title, streamUrl, type, startTime, itemInfo, onEndedCallback) {
      this.hasFatalError = false;
      this.networkRetryCount = 0;
      this.currentStreamUrl = streamUrl;
      clearTimeout(this.stallTimer);

      this.pendingStartTime = (typeof startTime === 'number' && startTime > 5) ? startTime : 0;
      this.currentItemInfo = itemInfo || { title: title, url: streamUrl, type: type };
      this.onEndedCallback = onEndedCallback || null;
      this.lastSaveTime = Date.now();

      // Guardar lista de servidores / variantes de respaldo
      this.backups = [];
      if (itemInfo && itemInfo.backups && itemInfo.backups.length > 0) {
        this.backups = itemInfo.backups.slice(0);
      } else if (itemInfo && itemInfo.backupUrl) {
        this.backups = [itemInfo.backupUrl];
      }

      this.lastFocusedElement = window.SpatialNav.currentFocused;
      this.titleEl.innerText = title || 'Reproduciendo contenido...';
      this.modal.style.display = 'block';

      var isVod = this.currentItemInfo && (this.currentItemInfo.kind === 'serie' || this.currentItemInfo.kind === 'movie' || this.currentItemInfo.kind === 'anime');
      var isLive = !isVod && this.currentItemInfo && (this.currentItemInfo.provider === 'pluto' || this.currentItemInfo.isLive === true || this.currentItemInfo.kind === 'canal');
      if (this.progressBar) {
        this.progressBar.style.width = isLive ? '100%' : '0%';
      }
      if (this.timeDisplay) {
        this.timeDisplay.innerHTML = isLive ? '<span>EN VIVO</span>' : '<span>00:00</span> / <span>--:--</span>';
      }

      // Mostrar indicador de carga inicial
      this.showBuffering(true, 'Cargando stream...');

      // Resetear estado de pistas
      this.audioTracks = [];
      this.currentAudioTrack = 0;
      this.subtitleTracks = [];
      this.currentSubtitleTrack = -1;
      this.renderTrackButtons();
      this.updatePlayPauseButton(false);

      var self = this;
      var video = this.video;

      // Destruir instancia previa de HLS si existía
      if (this.hlsInstance) {
        this.hlsInstance.destroy();
        this.hlsInstance = null;
      }

      video.pause();

      var isHls = (type === 'hls') || (streamUrl && streamUrl.indexOf('.m3u8') !== -1);

      if (isHls) {
        // Priorizar HLS.js si está soportado para tener control total de búfer y anti-freeze
        if (window.Hls && window.Hls.isSupported()) {
          this.hlsInstance = new window.Hls({
            enableWorker: false, // ¡ESENCIAL para Smart TVs! Evita fallos de concurrencia y límites de memoria en hilos de TV
            lowLatencyMode: false,

            // Configuración óptima de búfer y reciclaje de memoria para Smart TVs (evita que se caiga por OOM)
            backBufferLength: 30, // ¡CRÍTICO!: Elimina segmentos ya vistos de más de 30s para no saturar la RAM de la TV
            maxBufferLength: 30, // 30 segundos hacia adelante (suficiente para aguantar picos de red lentos)
            maxMaxBufferLength: 60,
            maxBufferSize: 30 * 1000 * 1000, // 30 MB máximo en memoria
            maxBufferHole: 1.0, // Salta micro-huecos de paquetes sin congelar la imagen

            // Inicio rápido (inicia al instante con fragmento precargado)
            startLevel: -1,
            startPosition: (startTime > 0 ? startTime : -1),
            startFragPrefetch: true,
            abrEwmaDefaultEstimate: 1200000,

            // Recuperación de red automática con reintentos amplios
            fragLoadingTimeOut: 30000,
            fragLoadingMaxRetry: 8,
            fragLoadingRetryDelay: 1000,
            levelLoadingTimeOut: 25000,
            levelLoadingMaxRetry: 6,

            // Anti-atasco por desincronización de timestamps o frames corruptos
            highBufferWatchdogPeriod: 2,
            nudgeOffset: 0.2,
            nudgeMaxRetry: 10,

            renderTextTracksNatively: true
          });

          this.hlsInstance.loadSource(streamUrl);
          this.hlsInstance.attachMedia(video);

          this.hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, function () {
            self.detectHlsTracks();
            self.safePlay(video);
          });

          // ¡CRÍTICO!: Reiniciar contadores de reintento de red y decodificación en cada fragmento cargado
          this.hlsInstance.on(window.Hls.Events.FRAG_LOADED, function () {
            self.networkRetryCount = 0;
            self.mediaErrorCount = 0;
            self.showBuffering(false);
          });

          this.hlsInstance.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, function () {
            self.detectHlsTracks();
          });

          this.hlsInstance.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, function () {
            self.detectHlsTracks();
          });

          this.hlsInstance.on(window.Hls.Events.ERROR, function (event, data) {
            if (data.fatal) {
              console.warn('Error fatal HLS:', data.type, data.details, data);
              var httpCode = (data.response && data.response.code) ? data.response.code : 0;

              switch (data.type) {
                case window.Hls.ErrorTypes.NETWORK_ERROR:
                  self.networkRetryCount = (self.networkRetryCount || 0) + 1;
                  var isManifestError = (data.details === 'manifestLoadError');
                  var isFatalHttp = (httpCode === 403 || httpCode === 401 || httpCode === 404);

                  // Si el manifiesto falló o la red falla reiteradamente, probar respaldo de inmediato si existe
                  if (self.backups && self.backups.length > 0 && (isManifestError || self.networkRetryCount >= 2)) {
                    var altHls = self.backups.shift();
                    console.warn('Fallo de red en HLS primario. Probando señal alternativa:', altHls);
                    self.showToast('Conectando con señal alternativa...');
                    self.networkRetryCount = 0;
                    self.hlsInstance.loadSource(altHls);
                    self.hlsInstance.startLoad();
                    break;
                  }

                  // Si el error es 403 (enlace temporal caducado) y tenemos playerUrl, renovar señal automáticamente
                  if (httpCode === 403 && self.currentItemInfo && self.currentItemInfo.playerUrl && !self.reExtracting) {
                    self.reExtracting = true;
                    self.showToast('El enlace temporal caducó. Renovando señal...');
                    var rProvider = self.currentItemInfo.provider || 'pelispedia';
                    var rApi = '/api/movies?action=resolve&player_url=' + encodeURIComponent(self.currentItemInfo.playerUrl) + '&provider=' + encodeURIComponent(rProvider);
                    var xhrR = new XMLHttpRequest();
                    xhrR.open('GET', rApi, true);
                    xhrR.onreadystatechange = function () {
                      if (xhrR.readyState === 4) {
                        self.reExtracting = false;
                        if (xhrR.status === 200) {
                          try {
                            var freshRes = JSON.parse(xhrR.responseText);
                            if (freshRes && freshRes.streamUrl) {
                              console.warn('Señal renovada con éxito tras error 403:', freshRes.streamUrl);
                              self.hasFatalError = false;
                              self.networkRetryCount = 0;
                              self.currentStreamUrl = freshRes.streamUrl;
                              if (freshRes.backups && freshRes.backups.length > 0) {
                                self.backups = freshRes.backups;
                              }
                              var currentPos = (self.video && self.video.currentTime) ? self.video.currentTime : (self.pendingStartTime || 0);
                              self.pendingStartTime = currentPos;
                              self.hlsInstance.loadSource(freshRes.streamUrl);
                              self.hlsInstance.startLoad();
                              return;
                            }
                          } catch (eFresh) { }
                        }
                        self.showToast('No se pudo renovar la señal (Error 403). Pulsa ATRÁS.');
                      }
                    };
                    xhrR.send();
                    break;
                  }

                  // Solo abortar si el manifiesto principal 404/403 o tras 6 reintentos seguidos fallidos
                  if ((isManifestError && isFatalHttp) || self.networkRetryCount > 6) {
                    console.warn('Fallo permanente de red en HLS (' + data.details + ', HTTP ' + httpCode + '). Deteniendo.');
                    self.hasFatalError = true;
                    self.showBuffering(false);
                    clearTimeout(self.stallTimer);

                    var msg = 'Error de conexión con el video. Pulsa ATRÁS para elegir otro.';
                    if (httpCode === 403) {
                      msg = 'Contenido restringido o bloqueado (Error 403). Pulsa ATRÁS.';
                    } else if (httpCode === 404) {
                      msg = 'Video no encontrado en el servidor (Error 404). Pulsa ATRÁS.';
                    } else if (httpCode >= 500) {
                      msg = 'Servidor temporalmente fuera de servicio (Error ' + httpCode + '). Pulsa ATRÁS.';
                    } else if (isManifestError && httpCode === 0) {
                      msg = 'Señal no disponible (Sin respuesta del servidor). Pulsa ATRÁS.';
                    }

                    self.showToast(msg);
                    if (self.hlsInstance) {
                      self.hlsInstance.destroy();
                      self.hlsInstance = null;
                    }
                    break;
                  }
                  console.warn('Reintentando carga por red (intento ' + self.networkRetryCount + ')...');
                  self.showBuffering(true, 'Reconectando video...');
                  self.hlsInstance.startLoad();
                  break;
                case window.Hls.ErrorTypes.MEDIA_ERROR:
                  console.warn('Recuperando error de decodificación multimedia...');
                  self.mediaErrorCount = (self.mediaErrorCount || 0) + 1;
                  if (self.backups && self.backups.length > 0 && self.mediaErrorCount >= 2) {
                    var directHls = self.backups.shift();
                    console.warn('Cambiando a variante HLS directa por desincronización multimedia:', directHls);
                    self.showToast('Optimizando señal de video...');
                    self.mediaErrorCount = 0;
                    self.hlsInstance.loadSource(directHls);
                    self.hlsInstance.startLoad();
                    break;
                  }
                  if (self.mediaErrorCount === 1) {
                    self.hlsInstance.recoverMediaError();
                  } else if (self.mediaErrorCount === 2) {
                    if (self.hlsInstance.swapAudioCodec) {
                      self.hlsInstance.swapAudioCodec();
                    }
                    self.hlsInstance.recoverMediaError();
                  } else {
                    console.warn('Error irrecuperable de códec multimedia');
                    self.hasFatalError = true;
                    self.showToast('Error de decodificación en tu TV. Pulsa ATRÁS.');
                    self.hlsInstance.destroy();
                    self.hlsInstance = null;
                  }
                  break;
                default:
                  if (self.backups && self.backups.length > 0) {
                    var defAlt = self.backups.shift();
                    console.warn('Error en HLS (' + data.details + '). Probando respaldo:', defAlt);
                    self.showToast('Cargando servidor alternativo...');
                    self.hlsInstance.loadSource(defAlt);
                    self.hlsInstance.startLoad();
                    break;
                  }
                  console.warn('Error irrecuperable en HLS:', data.details);
                  self.hasFatalError = true;
                  self.showBuffering(false);
                  clearTimeout(self.stallTimer);
                  self.showToast('Error en el stream. Pulsa ATRÁS.');
                  self.hlsInstance.destroy();
                  self.hlsInstance = null;
                  break;
              }
            } else if (data.details === window.Hls.ErrorDetails.BUFFER_STALLED_ERROR) {
              // El búfer se atascó brevemente: avanzar ligeramente para saltar micro-huecos de paquetes
              if (self.video && !self.video.paused && self.video.currentTime > 0.5) {
                self.video.currentTime += 0.2;
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          // Fallback para Safari donde Hls.js nativo es óptimo
          video.src = streamUrl;
          video.load();
          self.safePlay(video);
        } else {
          video.src = streamUrl;
          video.load();
          self.safePlay(video);
        }
      } else {
        // Video MP4 directo
        video.src = streamUrl;
        var onCanPlay = function () {
          video.removeEventListener('canplay', onCanPlay);
          self.safePlay(video);
        };
        video.addEventListener('canplay', onCanPlay, false);
        video.load();
        self.safePlay(video);
      }

      this.showOSD();

      // Interceptar teclas del control remoto mientras el reproductor está activo
      window.SpatialNav.setKeyHandler(function (keyCode) {
        return self.handlePlayerKeys(keyCode);
      });
    },

    applyPendingSeek: function () {
      if (this.pendingStartTime > 0 && this.video) {
        var targetTime = this.pendingStartTime;
        try {
          var isReady = (this.video.readyState >= 1) || (this.video.duration && !isNaN(this.video.duration) && this.video.duration > 0);
          if (isReady) {
            this.pendingStartTime = 0;
            this.video.currentTime = targetTime;
            this.showToast('Reanudando desde ' + this.formatTime(targetTime));
          }
        } catch (eSeek) { }
      }
    },

    saveProgress: function () {
      if (!this.video || !this.video.duration || !this.currentItemInfo) return;
      var cur = this.video.currentTime;
      var dur = this.video.duration;
      var key = this.currentItemInfo.episodeKey || this.currentItemInfo.slug || this.currentItemInfo.title;
      if (!key) return;

      // ¡NUNCA guardar canales de televisión en vivo (Pluto TV, IPTV, transmisiones continuas) en "Continuar Viendo"!
      var isLiveChannel = (this.currentItemInfo.kind === 'canal') ||
                          (this.currentItemInfo.provider === 'pluto') ||
                          (this.currentItemInfo.provider === 'channels') ||
                          (this.currentItemInfo.provider === 'iptv') ||
                          (this.currentItemInfo.isLive === true) ||
                          (dur < 300) || // Ventanas deslizantes HLS en vivo (ej: 50s, 70s, 110s)
                          (dur === Infinity);

      if (isLiveChannel) {
        // Asegurar que si existía previamente una entrada para este canal, se purgue de localStorage
        try {
          var rawOld = localStorage.getItem('tv_watch_progress');
          if (rawOld) {
            var mapOld = JSON.parse(rawOld);
            if (mapOld[key]) {
              delete mapOld[key];
              localStorage.setItem('tv_watch_progress', JSON.stringify(mapOld));
            }
          }
        } catch (eClean) { }
        return;
      }

      try {
        var raw = localStorage.getItem('tv_watch_progress') || '{}';
        var map = JSON.parse(raw);

        if (cur > 15 && (cur / dur) < 0.95) {
          map[key] = {
            title: this.currentItemInfo.title,
            slug: this.currentItemInfo.slug,
            kind: this.currentItemInfo.kind || 'movie',
            provider: this.currentItemInfo.provider,
            poster: this.currentItemInfo.poster,
            url: this.currentItemInfo.url || this.currentStreamUrl,
            playerUrl: this.currentItemInfo.playerUrl || this.currentItemInfo.player_url || null,
            type: this.currentItemInfo.type || 'hls',
            time: cur,
            duration: dur,
            percent: Math.round((cur / dur) * 100),
            updatedAt: Date.now()
          };
          localStorage.setItem('tv_watch_progress', JSON.stringify(map));
        } else if ((cur / dur) >= 0.95) {
          delete map[key];
          localStorage.setItem('tv_watch_progress', JSON.stringify(map));
        }
      } catch (e) { }
    },

    safePlay: function (video) {
      var playPromise = video.play();
      if (playPromise !== undefined && typeof playPromise.catch === 'function') {
        playPromise.catch(function (error) {
          console.warn('Auto-play pausado (requiere interacción):', error.message);
        });
      }
    },

    close: function () {
      this.saveProgress();
      this.pendingStartTime = 0;
      this.onEndedCallback = null;

      var doc = window.document;
      var isFS = doc.fullscreenElement || doc.webkitFullscreenElement || doc.mozFullScreenElement || doc.msFullscreenElement;
      if (isFS) {
        var exitFS = doc.exitFullscreen || doc.webkitExitFullscreen || doc.mozCancelFullScreen || doc.msExitFullscreen;
        if (exitFS) exitFS.call(doc);
      }

      this.currentStreamUrl = null;
      clearTimeout(this.stallTimer);
      this.hasFatalError = false;
      this.networkRetryCount = 0;
      this.showBuffering(false);

      if (this.hlsInstance) {
        this.hlsInstance.destroy();
        this.hlsInstance = null;
      }

      this.video.pause();
      this.modal.style.display = 'none';
      try {
        this.video.src = '';
      } catch (eSrc) { }

      if (this.toastEl) {
        this.toastEl.style.display = 'none';
      }

      clearTimeout(this.osdTimer);
      if (this.modal) {
        window.SpatialNav.removeClass(this.modal, 'cursor-hidden');
      }
      if (this.osd) {
        window.SpatialNav.removeClass(this.osd, 'hidden');
      }
      if (this.btnFloatingClose) {
        window.SpatialNav.removeClass(this.btnFloatingClose, 'hidden');
      }

      // Restaurar el control a la navegación espacial normal
      window.SpatialNav.setKeyHandler(null);
      if (this.lastFocusedElement) {
        window.SpatialNav.focusElement(this.lastFocusedElement);
      }
    },

    detectHlsTracks: function () {
      if (!this.hlsInstance) return;

      var self = this;
      var rawAudio = this.hlsInstance.audioTracks || [];
      this.audioTracks = [];
      for (var i = 0; i < rawAudio.length; i++) {
        var a = rawAudio[i];
        var aName = a.name || a.lang || ('Audio ' + (i + 1));
        this.audioTracks.push({
          id: a.id !== undefined ? a.id : i,
          index: i,
          name: self.formatTrackName(aName, a.lang)
        });
      }
      this.currentAudioTrack = this.hlsInstance.audioTrack >= 0 ? this.hlsInstance.audioTrack : 0;

      var rawSubs = this.hlsInstance.subtitleTracks || [];
      this.subtitleTracks = [];
      for (var j = 0; j < rawSubs.length; j++) {
        var s = rawSubs[j];
        var sName = s.name || s.lang || ('Sub ' + (j + 1));
        this.subtitleTracks.push({
          id: s.id !== undefined ? s.id : j,
          index: j,
          name: self.formatTrackName(sName, s.lang)
        });
      }
      this.currentSubtitleTrack = this.hlsInstance.subtitleTrack;

      this.renderTrackButtons();
    },

    detectNativeTracks: function () {
      var self = this;
      if (this.hlsInstance) return;

      if (this.video && this.video.audioTracks && this.video.audioTracks.length > 1) {
        this.audioTracks = [];
        for (var i = 0; i < this.video.audioTracks.length; i++) {
          var natAudio = this.video.audioTracks[i];
          var aName = natAudio.label || natAudio.language || ('Audio ' + (i + 1));
          this.audioTracks.push({
            id: i,
            index: i,
            name: self.formatTrackName(aName, natAudio.language)
          });
          if (natAudio.enabled) {
            this.currentAudioTrack = i;
          }
        }
      }

      if (this.video && this.video.textTracks && this.video.textTracks.length > 0) {
        this.subtitleTracks = [];
        for (var j = 0; j < this.video.textTracks.length; j++) {
          var t = this.video.textTracks[j];
          if (t.kind === 'subtitles' || t.kind === 'captions') {
            var sName = t.label || t.language || ('Sub ' + (j + 1));
            this.subtitleTracks.push({
              id: j,
              index: j,
              name: self.formatTrackName(sName, t.language)
            });
            if (t.mode === 'showing') {
              this.currentSubtitleTrack = j;
            }
          }
        }
      }

      this.renderTrackButtons();
    },

    formatTrackName: function (name, lang) {
      if (!name) return 'Audio';
      var n = String(name).trim();
      var l = (lang || '').toLowerCase();

      if (l === 'es' || l === 'spa' || /español|spanish|castellano/i.test(n)) {
        if (/latino|lat/i.test(n)) return 'Español Latino';
        if (/castellano|spain/i.test(n)) return 'Castellano';
        return 'Español';
      }
      if (l === 'en' || l === 'eng' || /ingles|english/i.test(n)) {
        return 'English';
      }
      if (l === 'ja' || l === 'jpn' || /japones|japanese/i.test(n)) {
        return 'Japonés (Original)';
      }
      if (l === 'pt' || l === 'por' || /portugues|portuguese/i.test(n)) {
        return 'Português';
      }
      return n;
    },

    renderTrackButtons: function () {
      if (this.btnAudio) {
        if (this.audioTracks.length > 1) {
          this.btnAudio.style.display = 'inline-block';
          var curAudio = this.audioTracks[this.currentAudioTrack] || this.audioTracks[0];
          this.btnAudio.innerHTML = 'Audio: <strong>' + (curAudio ? curAudio.name : 'Pista 1') + '</strong>';
        } else {
          this.btnAudio.style.display = 'none';
        }
      }

      if (this.btnSubs) {
        if (this.subtitleTracks.length > 0) {
          this.btnSubs.style.display = 'inline-block';
          var subLabel = 'Desactivados';
          if (this.currentSubtitleTrack >= 0 && this.subtitleTracks[this.currentSubtitleTrack]) {
            subLabel = this.subtitleTracks[this.currentSubtitleTrack].name;
          }
          this.btnSubs.innerHTML = 'Subs: <strong>' + subLabel + '</strong>';
        } else {
          this.btnSubs.style.display = 'none';
        }
      }
    },

    cycleAudioTrack: function () {
      if (this.audioTracks.length <= 1) {
        this.showToast('Audio: Única pista estéreo disponible');
        return;
      }
      var nextIndex = (this.currentAudioTrack + 1) % this.audioTracks.length;
      this.setAudioTrack(nextIndex);
    },

    setAudioTrack: function (index) {
      if (index < 0 || index >= this.audioTracks.length) return;
      this.currentAudioTrack = index;
      var track = this.audioTracks[index];

      if (this.hlsInstance) {
        this.hlsInstance.audioTrack = track.id !== undefined ? track.id : track.index;
      } else if (this.video && this.video.audioTracks) {
        for (var i = 0; i < this.video.audioTracks.length; i++) {
          this.video.audioTracks[i].enabled = (i === index);
        }
      }

      this.renderTrackButtons();
      this.showToast('Audio: ' + track.name + ' (' + (index + 1) + '/' + this.audioTracks.length + ')');
    },

    cycleSubtitleTrack: function () {
      if (this.subtitleTracks.length === 0) {
        this.showToast('Subtítulos: No disponibles en este stream');
        return;
      }

      var nextIndex;
      if (this.currentSubtitleTrack === -1) {
        nextIndex = 0;
      } else if (this.currentSubtitleTrack + 1 < this.subtitleTracks.length) {
        nextIndex = this.currentSubtitleTrack + 1;
      } else {
        nextIndex = -1; // Desactivar
      }

      this.setSubtitleTrack(nextIndex);
    },

    setSubtitleTrack: function (index) {
      this.currentSubtitleTrack = index;

      if (this.hlsInstance) {
        if (index === -1) {
          this.hlsInstance.subtitleTrack = -1;
        } else {
          var track = this.subtitleTracks[index];
          this.hlsInstance.subtitleTrack = track.id !== undefined ? track.id : track.index;
        }
      } else if (this.video && this.video.textTracks) {
        for (var i = 0; i < this.video.textTracks.length; i++) {
          this.video.textTracks[i].mode = (i === index) ? 'showing' : 'disabled';
        }
      }

      this.renderTrackButtons();
      if (index === -1) {
        this.showToast('Subtítulos: Desactivados');
      } else {
        var currentTrack = this.subtitleTracks[index];
        var name = currentTrack ? currentTrack.name : 'Activos';
        this.showToast('Subtítulos: ' + name + ' (' + (index + 1) + '/' + this.subtitleTracks.length + ')');
      }
    },

    showToast: function (msg) {
      var self = this;
      if (!this.toastEl) {
        this.toastEl = document.getElementById('player-toast');
      }
      if (!this.toastEl) return;

      this.toastEl.innerText = msg;
      this.toastEl.style.display = 'block';
      this.toastEl.style.opacity = '1';

      clearTimeout(this.toastTimer);
      this.toastTimer = setTimeout(function () {
        if (self.toastEl) {
          self.toastEl.style.opacity = '0';
          setTimeout(function () {
            if (self.toastEl) self.toastEl.style.display = 'none';
          }, 300);
        }
      }, 2500);
    },

    handlePlayerKeys: function (keyCode) {
      var KEYS = window.SpatialNav.KEYS;
      this.showOSD();

      // Atajo Tecla 'A' (65) o Botón Verde (404) para cambiar Pista de Audio
      if (keyCode === 65 || keyCode === 404 || keyCode === 97) {
        this.cycleAudioTrack();
        return true;
      }

      // Atajo Tecla 'S' (83) o Botón Amarillo (405) para cambiar Subtítulos
      if (keyCode === 83 || keyCode === 405 || keyCode === 115) {
        this.cycleSubtitleTrack();
        return true;
      }

      // Atajo Tecla 'F' (70) o Botón Azul (406 / 102) para Pantalla Completa
      if (keyCode === 70 || keyCode === 406 || keyCode === 102) {
        this.toggleFullscreen();
        return true;
      }

      // Verificar si el foco actual está en uno de los botones del OSD
      var activeEl = document.activeElement;
      var isOsdFocused = activeEl && this.osd && this.osd.contains(activeEl);

      if (isOsdFocused) {
        switch (keyCode) {
          case KEYS.ENTER:
            activeEl.click();
            return true;
          case KEYS.LEFT:
            window.SpatialNav.move('left');
            return true;
          case KEYS.RIGHT:
            window.SpatialNav.move('right');
            return true;
          case KEYS.DOWN:
            if (this.video) {
              this.video.focus();
            }
            return true;
          case KEYS.UP:
            return true;
        }
      }

      // Controles normales cuando el foco está sobre la pantalla del video
      switch (keyCode) {
        case KEYS.ENTER:
        case KEYS.PLAY:
        case KEYS.PLAY_PAUSE:
        case KEYS.PAUSE:
          if (this.video.paused) {
            this.video.play();
          } else {
            this.video.pause();
          }
          return true;

        case KEYS.LEFT:
        case KEYS.REWIND:
          this.video.currentTime = Math.max(0, this.video.currentTime - 10);
          return true;

        case KEYS.RIGHT:
        case KEYS.FAST_FWD:
          if (this.video.duration) {
            this.video.currentTime = Math.min(this.video.duration, this.video.currentTime + 10);
          }
          return true;

        case KEYS.UP:
          var targetBtn = null;
          if (this.btnPlayPause) {
            targetBtn = this.btnPlayPause;
          } else if (this.btnAudio && this.btnAudio.style.display !== 'none') {
            targetBtn = this.btnAudio;
          } else if (this.btnSubs && this.btnSubs.style.display !== 'none') {
            targetBtn = this.btnSubs;
          } else if (this.btnFullscreen) {
            targetBtn = this.btnFullscreen;
          }

          if (targetBtn) {
            window.SpatialNav.focusElement(targetBtn);
          }
          return true;

        case KEYS.STOP:
        case KEYS.BACK_ESC:
        case KEYS.BACK_BS:
        case KEYS.BACK_LG:
        case KEYS.BACK_SAMSUNG:
          this.close();
          return true;
      }

      return false;
    },

    isOsdHidden: function () {
      if (!this.osd) return false;
      return window.SpatialNav.hasClass(this.osd, 'hidden');
    },

    showOSD: function () {
      var self = this;
      if (this.osd) {
        window.SpatialNav.removeClass(this.osd, 'hidden');
      }
      if (this.btnFloatingClose) {
        window.SpatialNav.removeClass(this.btnFloatingClose, 'hidden');
      }
      if (this.modal) {
        window.SpatialNav.removeClass(this.modal, 'cursor-hidden');
      }

      clearTimeout(this.osdTimer);
      this.osdTimer = setTimeout(function () {
        var activeEl = document.activeElement;
        var currentNav = window.SpatialNav ? window.SpatialNav.currentFocused : null;
        var isFocusedOnControls = (activeEl && (
          (self.osd && self.osd.contains(activeEl)) ||
          (self.btnFloatingClose && self.btnFloatingClose === activeEl)
        )) || (currentNav && (
          (self.osd && self.osd.contains(currentNav)) ||
          self.btnFloatingClose === currentNav
        ));

        if (!self.video.paused && !isFocusedOnControls) {
          self.hideOSD();
        }
      }, 4000);
    },

    hideOSD: function () {
      if (this.osd) {
        window.SpatialNav.addClass(this.osd, 'hidden');
      }
      if (this.btnFloatingClose) {
        window.SpatialNav.addClass(this.btnFloatingClose, 'hidden');
      }
      if (this.modal) {
        window.SpatialNav.addClass(this.modal, 'cursor-hidden');
      }
    },

    updateProgress: function () {
      if (!this.video || !this.video.duration || this.video.duration === Infinity) {
        var isVod = this.currentItemInfo && (this.currentItemInfo.kind === 'serie' || this.currentItemInfo.kind === 'movie' || this.currentItemInfo.kind === 'anime');
      var isLive = !isVod && this.currentItemInfo && (this.currentItemInfo.provider === 'pluto' || this.currentItemInfo.isLive === true || this.currentItemInfo.kind === 'canal');
        if (isLive) {
          this.progressBar.style.width = '100%';
          if (this.timeDisplay) {
            this.timeDisplay.innerHTML = '<span>EN VIVO</span>';
          }
        } else {
          this.progressBar.style.width = '0%';
          if (this.timeDisplay) {
            this.timeDisplay.innerHTML = '<span>00:00</span> / <span>--:--</span>';
          }
        }
        return;
      }
      var current = this.video.currentTime;
      var duration = this.video.duration;
      var percent = (current / duration) * 100;
      this.progressBar.style.width = percent + '%';

      var curText = this.formatTime(current);
      var durText = this.formatTime(duration);
      if (this.timeDisplay) {
        this.timeDisplay.innerHTML = '<span>' + curText + '</span> / <span>' + durText + '</span>';
      }
    },

    formatTime: function (seconds) {
      if (isNaN(seconds) || seconds < 0) return '00:00';
      var mins = Math.floor(seconds / 60);
      var secs = Math.floor(seconds % 60);
      var m = mins < 10 ? '0' + mins : mins;
      var s = secs < 10 ? '0' + secs : secs;
      return m + ':' + s;
    }
  };

  window.TVPlayer = TVPlayer;
})(window);
