/* AnatomyHeroModel — visuel 3D du hero (écorché anatomique).
   Composant réutilisable : custom element <anatomy-hero-model>, basé sur <model-viewer>
   (le moteur 3D déjà embarqué dans le projet : vendor/model-viewer.min.js).

   Modèle anatomique : Diego Luján García, via Sketchfab, licence CC BY 4.0.
   (Crédit visible obligatoire : voir le pied de page du site.)

   Principes : chargement différé, repli image fixe (petits écrans / appareils lents /
   économiseur de données / erreur / hors-ligne), rotation lente ±10° en boucle douce,
   respect de prefers-reduced-motion (pose fixe), et arrêt de l'animation quand le hero
   n'est plus visible. Élément purement décoratif (aria-hidden, ne capte pas les clics). */
(function () {
  "use strict";

  var MV_SRC = "vendor/model-viewer.min.js";
  var mvLoading = null;

  // Charge le moteur <model-viewer> une seule fois (réutilise celui de la carte du corps s'il est déjà demandé).
  function loadModelViewer() {
    if (window.customElements && customElements.get("model-viewer")) return Promise.resolve();
    if (mvLoading) return mvLoading;
    mvLoading = new Promise(function (resolve, reject) {
      if (!document.querySelector('script[data-mv]')) {
        var s = document.createElement("script");
        s.type = "module"; s.src = MV_SRC; s.setAttribute("data-mv", "");
        s.onerror = reject;
        document.head.appendChild(s);
      }
      var t0 = Date.now();
      (function wait() {
        if (window.customElements && customElements.get("model-viewer")) return resolve();
        if (Date.now() - t0 > 12000) return reject(new Error("model-viewer timeout"));
        setTimeout(wait, 120);
      })();
    });
    return mvLoading;
  }

  var RM = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  // Rotation 360° continue ; le ZOOM est piloté par le scroll : gros plan en haut
  // de page → corps entier après avoir scrollé (le visuel reste épinglé pendant ce temps).
  var BASE_THETA = 26;          // deg — angle de départ
  var SPIN_PERIOD = 14000;      // ms — durée d'un tour complet (rotation 360°)
  var PERIOD = 9000;            // ms — rythme du léger basculement vertical
  var BASE_PHI = 86;            // deg — hauteur de la caméra
  var PHI_AMP = 2.5;            // deg — léger basculement vertical
  var R_CLOSE = 86;             // gros plan (haut de page)
  var R_FULL = 178;             // corps entier (après le scroll)
  var TY_CLOSE = 6;             // visée gros plan (haut du corps)
  var TY_FULL = -9;             // visée corps entier (centre du corps)
  var FOV = "30deg";
  function orbit(theta, phi, r) { return theta + "deg " + phi + "deg " + r + "m"; }
  function targetStr(ty) { return "-0.09m " + ty + "m -0.49m"; }

  // Repli image fixe : petits écrans, appareils peu dotés ou économiseur de données.
  function prefersStatic() {
    if (!(window.matchMedia && window.matchMedia("(min-width: 981px)").matches)) return true;
    var c = navigator.connection;
    if (c && c.saveData) return true;
    if (navigator.deviceMemory && navigator.deviceMemory < 4) return true;
    return false;
  }

  function AnatomyHeroModel() { return Reflect.construct(HTMLElement, [], AnatomyHeroModel); }
  AnatomyHeroModel.prototype = Object.create(HTMLElement.prototype);
  AnatomyHeroModel.prototype.constructor = AnatomyHeroModel;

  AnatomyHeroModel.prototype.connectedCallback = function () {
    if (this._init) return;
    this._init = true;
    this.setAttribute("aria-hidden", "true");

    this._src = this.getAttribute("data-src") || "models/male-full-body-ecorche-hero.glb";

    // Image fixe : repli immédiat + placeholder pendant le chargement de la 3D.
    var poster = this.getAttribute("data-poster");
    if (poster) {
      var img = document.createElement("img");
      img.className = "ahm-poster";
      img.src = poster; img.alt = ""; img.decoding = "async";
      img.setAttribute("aria-hidden", "true");
      this.appendChild(img);
    }

    if (prefersStatic()) return; // on s'arrête à l'image fixe

    // Chargement différé : on n'amorce la 3D qu'à l'approche du hero.
    var self = this;
    if ("IntersectionObserver" in window) {
      this._io = new IntersectionObserver(function (es) {
        if (es.some(function (e) { return e.isIntersecting; }) && !self._started) {
          self._started = true; self._io.disconnect(); self.startLoad();
        }
      }, { rootMargin: "300px 0px" });
      this._io.observe(this);
    } else { this.startLoad(); }
  };

  AnatomyHeroModel.prototype.startLoad = function () {
    var self = this;
    loadModelViewer().then(function () { self.build(); }).catch(function () { /* on garde l'image fixe */ });
  };

  AnatomyHeroModel.prototype.build = function () {
    var mv = document.createElement("model-viewer");
    this.mv = mv;
    mv.className = "ahm-mv";
    mv.setAttribute("alt", "");
    mv.setAttribute("src", this._src);
    mv.setAttribute("camera-orbit", orbit(BASE_THETA, BASE_PHI, R_CLOSE)); // départ : gros plan
    mv.setAttribute("camera-target", targetStr(TY_CLOSE));
    mv.setAttribute("field-of-view", FOV);
    // autorise le zoom au scroll (sinon model-viewer borne le rayon au cadrage auto)
    mv.setAttribute("min-camera-orbit", "auto auto 40m");
    mv.setAttribute("max-camera-orbit", "auto auto 240m");
    mv.setAttribute("interaction-prompt", "none");
    // éclairage doux et neutre, sans ombre coûteuse ni post-traitement lourd
    mv.setAttribute("environment-image", "neutral");
    mv.setAttribute("tone-mapping", "neutral");
    mv.setAttribute("shadow-intensity", "0");
    mv.setAttribute("exposure", "0.92");
    mv.setAttribute("loading", "eager");
    mv.setAttribute("reveal", "auto");
    // décoratif : pas de camera-controls (aucune interaction), ne capte pas les clics (pointer-events: none via CSS)

    var self = this;
    mv.addEventListener("load", function () { self.classList.add("ahm-ready"); self.setupVisibility(); });
    mv.addEventListener("error", function () {
      if (mv.parentNode) mv.parentNode.removeChild(mv); // échec décodage/réseau → on garde l'image fixe
      self.classList.remove("ahm-ready");
      self.mv = null;
    });
    this.appendChild(mv);
  };

  AnatomyHeroModel.prototype.setupVisibility = function () {
    var self = this;
    if (RM) { // pose fixe : gros plan, sans mouvement
      if (this.mv) { this.mv.cameraOrbit = orbit(BASE_THETA, BASE_PHI, R_CLOSE); this.mv.cameraTarget = targetStr(TY_CLOSE); }
      return;
    }

    // Zoom piloté par le scroll : gros plan (haut) → corps entier (après ~0,8 écran).
    this._scrollP = 0;
    var ticking = false;
    function readScroll() {
      ticking = false;
      var vh = window.innerHeight || 1;
      self._scrollP = Math.min(Math.max(window.scrollY / (vh * 0.8), 0), 1);
    }
    this._onScroll = function () { if (!ticking) { ticking = true; requestAnimationFrame(readScroll); } };
    window.addEventListener("scroll", this._onScroll, { passive: true });
    window.addEventListener("resize", this._onScroll, { passive: true });
    readScroll();

    var visible = true;
    if ("IntersectionObserver" in window) {
      this._vio = new IntersectionObserver(function (es) {
        es.forEach(function (e) { visible = e.isIntersecting; visible ? self.play() : self.stop(); });
      }, { threshold: 0 });
      this._vio.observe(this);
    }
    document.addEventListener("visibilitychange", function () {
      if (document.hidden) self.stop(); else if (visible) self.play();
    });
    this.play();
  };

  AnatomyHeroModel.prototype.play = function () {
    if (this._raf || !this.mv) return;
    var self = this, start = null;
    function frame(now) {
      if (start === null) start = now;
      var ms = now - start;
      var theta = BASE_THETA + (ms / SPIN_PERIOD) * 360; // rotation 360° continue
      var t = ms / PERIOD * Math.PI * 2;
      var phi = BASE_PHI + PHI_AMP * Math.sin(t * 0.6);
      var p = self._scrollP || 0;
      var e = p * p * (3 - 2 * p);               // lissage (smoothstep)
      var r = R_CLOSE + (R_FULL - R_CLOSE) * e;  // zoom piloté par le scroll : gros plan → corps entier
      var ty = TY_CLOSE + (TY_FULL - TY_CLOSE) * e;
      self.mv.cameraTarget = targetStr(ty.toFixed(2));
      self.mv.cameraOrbit = orbit(theta.toFixed(2), phi.toFixed(2), r.toFixed(2));
      self._raf = requestAnimationFrame(frame);
    }
    this._raf = requestAnimationFrame(frame);
  };

  AnatomyHeroModel.prototype.stop = function () {
    if (this._raf) { cancelAnimationFrame(this._raf); this._raf = null; }
  };

  AnatomyHeroModel.prototype.disconnectedCallback = function () {
    this.stop();
    if (this._io) this._io.disconnect();
    if (this._vio) this._vio.disconnect();
    if (this._onScroll) { window.removeEventListener("scroll", this._onScroll); window.removeEventListener("resize", this._onScroll); }
  };

  if (window.customElements && !customElements.get("anatomy-hero-model")) {
    customElements.define("anatomy-hero-model", AnatomyHeroModel);
  }
  window.AnatomyHeroModel = AnatomyHeroModel;

  /* Intro accueil : au 1er affichage on ne voit que le titre + l'écorché ;
     le reste du contenu (.hero-more) se dévoile dès qu'on commence à descendre.
     Respecte prefers-reduced-motion et le repli no-JS (contenu visible d'office). */
  function setupHeroReveal() {
    var more = document.querySelector(".hero-more");
    if (!more) return;
    if (RM || !("IntersectionObserver" in window)) { more.classList.add("in"); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { more.classList.add("in"); io.disconnect(); } });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    io.observe(more);
  }
  if (document.readyState !== "loading") setupHeroReveal();
  else document.addEventListener("DOMContentLoaded", setupHeroReveal);
})();
