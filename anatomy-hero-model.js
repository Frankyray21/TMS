/* AnatomyHeroModel — visuel 3D du hero.
   Composant réutilisable : custom element <anatomy-hero-model>, basé sur <model-viewer>
   (le moteur 3D déjà embarqué dans le projet : vendor/model-viewer.min.js).

   Deux modes :
   1) Écorché (par défaut) — modèle musculaire seul (Diego Luján García, Sketchfab, CC BY 4.0).
   2) Systèmes (attribut data-systems) — modèle multi-systèmes (Z-Anatomy, CC BY-SA) :
      révélation des couches du corps (Muscles → Os → Nerfs → Articulations).
      La révélation est pilotée au scroll (on « épluche » les couches en descendant) ET
      rejoue toute seule en boucle quand on ne scrolle pas.

   Principes communs : chargement différé, repli image fixe (petits écrans / appareils lents /
   économiseur de données / erreur / hors-ligne), rotation lente en boucle, respect de
   prefers-reduced-motion (pose fixe), arrêt de l'animation quand le hero n'est plus visible.
   Élément purement décoratif (aria-hidden, ne capte pas les clics). */
(function () {
  "use strict";

  var MV_SRC = "vendor/model-viewer.min.js";
  var mvLoading = null;

  function nowMs() { return (window.performance && performance.now) ? performance.now() : Date.now(); }

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

  // ── Profils de cadrage caméra (le ZOOM est piloté par le scroll : gros plan en haut
  //    de page → corps entier après avoir scrollé ; le visuel reste épinglé pendant ce temps). ──
  // Écorché : modèle à grande échelle (rayon en dizaines de mètres).
  var ECORCHE = {
    theta: 26, phi: 86, phiAmp: 2.5, fov: "30deg",
    rClose: 86, rFull: 178, tyClose: 6, tyFull: -9, tx: -0.09, tz: -0.49,
    minR: "40m", maxR: "240m", spin: 14000, exposure: "0.92"
  };
  // Multi-systèmes (Z-Anatomy) : modèle à échelle humaine (~1,7 m de haut, centre y≈0,86).
  var CORPS = {
    theta: 18, phi: 84, phiAmp: 2, fov: "30deg",
    rClose: 1.95, rFull: 3.5, tyClose: 1.25, tyFull: 0.86, tx: 0, tz: 0,
    minR: "1.2m", maxR: "5m", spin: 16000, exposure: "1.0"
  };

  var BOB_PERIOD = 9000; // ms — rythme du léger basculement vertical de la caméra

  // Révélation des systèmes : scènes successives (matériau → opacité).
  // On garde un squelette discret en fond pour les nerfs et les articulations (sinon ils « flottent »).
  var SYS_SCENES = [
    { Muscles: 1, Os: 0, Nerfs: 0, Articulations: 0 },
    { Muscles: 0, Os: 1, Nerfs: 0, Articulations: 0 },
    { Muscles: 0, Os: 0.18, Nerfs: 1, Articulations: 0 },
    { Muscles: 0, Os: 0.30, Nerfs: 0, Articulations: 1 }
  ];
  var SYS_SEG_MS = 7000;  // durée d'une étape en mode auto (sans scroll) — transition lente et contemplative
  var SYS_HOLD = 0.28;    // part de l'étape où le système reste pleinement visible AVANT le fondu
                          // (le reste — 72 % — est un fondu LINÉAIRE lent : on voit la progression couche par couche)
  var IDLE_MS = 1100;     // délai sans scroll avant que la révélation rejoue toute seule
  var SCROLL_SPAN = 1.6;  // distance de scroll (en hauteurs d'écran) pour dérouler tout le zoom + la révélation
                          // (plus la valeur est grande, plus la transition au scroll est lente/progressive)

  function orbit(theta, phi, r) { return theta + "deg " + phi + "deg " + r + "m"; }

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

  AnatomyHeroModel.prototype.targetStr = function (ty) {
    var c = this.cfg;
    return c.tx + "m " + ty + "m " + c.tz + "m";
  };

  AnatomyHeroModel.prototype.connectedCallback = function () {
    if (this._init) return;
    this._init = true;
    this.setAttribute("aria-hidden", "true");

    this._src = this.getAttribute("data-src") || "models/male-full-body-ecorche-hero.glb";

    // Mode systèmes : data-systems="Muscles,Os,Nerfs,Articulations" (ordre de révélation).
    var sysAttr = this.getAttribute("data-systems");
    this._systems = sysAttr ? sysAttr.split(",").map(function (s) { return s.trim(); }).filter(Boolean) : null;
    this.cfg = this._systems ? CORPS : ECORCHE;
    // Libellés affichés (localisés) : data-labels="Muscles|Squelette|Système nerveux|Articulations".
    var lbl = this.getAttribute("data-labels");
    this._labels = lbl ? lbl.split("|") : (this._systems || []);

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
    var c = this.cfg;
    var mv = document.createElement("model-viewer");
    this.mv = mv;
    mv.className = "ahm-mv";
    mv.setAttribute("alt", "");
    mv.setAttribute("src", this._src);
    mv.setAttribute("camera-orbit", orbit(c.theta, c.phi, c.rClose)); // départ : gros plan
    mv.setAttribute("camera-target", this.targetStr(c.tyClose));
    mv.setAttribute("field-of-view", c.fov);
    // autorise le zoom au scroll (sinon model-viewer borne le rayon au cadrage auto)
    mv.setAttribute("min-camera-orbit", "auto auto " + c.minR);
    mv.setAttribute("max-camera-orbit", "auto auto " + c.maxR);
    mv.setAttribute("interaction-prompt", "none");
    // éclairage doux et neutre, sans ombre coûteuse ni post-traitement lourd
    mv.setAttribute("environment-image", "neutral");
    mv.setAttribute("tone-mapping", "neutral");
    mv.setAttribute("shadow-intensity", "0");
    mv.setAttribute("exposure", c.exposure);
    mv.setAttribute("loading", "eager");
    mv.setAttribute("reveal", "auto");
    // décoratif : pas de camera-controls (aucune interaction), ne capte pas les clics (pointer-events: none via CSS)

    // Libellé du système en cours (mode systèmes) — petit cartouche discret, décoratif.
    if (this._systems) {
      var label = document.createElement("span");
      label.className = "ahm-sys-label";
      label.setAttribute("aria-hidden", "true");
      this.appendChild(label);
      this._label = label;
      this._labelIdx = -1;
    }

    var self = this;
    mv.addEventListener("load", function () {
      if (self._systems) { self.primeSystems(); self.applyReveal(0); } // BLEND une fois, puis état initial (1er système seul, pas de flash)
      self.classList.add("ahm-ready");
      self.setupVisibility();
    });
    mv.addEventListener("error", function () {
      if (mv.parentNode) mv.parentNode.removeChild(mv); // échec décodage/réseau → on garde l'image fixe
      self.classList.remove("ahm-ready");
      self.mv = null;
    });
    this.appendChild(mv);
  };

  // Réinitialise les caches d'opacité / de mode (au chargement).
  AnatomyHeroModel.prototype.primeSystems = function () {
    this._matCache = {};
    this._modeCache = {};
  };

  // Met à jour l'opacité d'un système.
  //  - On n'utilise JAMAIS le mode MASK : il active alphaTest, ce qui force une RECOMPILATION
  //    du shader à chaque masquage/affichage → c'est la source des saccades. Un système masqué
  //    reste donc en BLEND à alpha 0 (dessiné mais invisible, sans recompilation).
  //  - OPAQUE au repos (alpha plein) : occlusion correcte (le muscle cache bien l'intérieur).
  //    OPAQUE↔BLEND ne change qu'un état de rendu (pas de recompilation) → bascule fluide.
  //  - On n'appelle setAlphaMode que lorsque le mode change réellement (cache de mode).
  AnatomyHeroModel.prototype.setAlpha = function (name, alpha) {
    var cache = this._matCache || (this._matCache = {});
    var modeC = this._modeCache || (this._modeCache = {});
    if (cache[name] !== undefined && Math.abs(cache[name] - alpha) < 0.003) return; // saute les variations imperceptibles
    var mdl = this.mv && this.mv.model;
    if (!mdl || !mdl.materials) return;
    for (var i = 0; i < mdl.materials.length; i++) {
      var m = mdl.materials[i];
      if (m && m.name === name && m.pbrMetallicRoughness) {
        var f = m.pbrMetallicRoughness.baseColorFactor || [1, 1, 1, 1];
        m.pbrMetallicRoughness.setBaseColorFactor([f[0], f[1], f[2], alpha]);
        var mode = alpha >= 0.999 ? "OPAQUE" : "BLEND";
        if (m.setAlphaMode && modeC[name] !== mode) { m.setAlphaMode(mode); modeC[name] = mode; }
        cache[name] = alpha;
        return;
      }
    }
  };

  // Applique la révélation à une position continue (anneau de scènes ; pos réel quelconque).
  AnatomyHeroModel.prototype.applyReveal = function (pos) {
    var N = SYS_SCENES.length;
    var base = Math.floor(pos);
    var frac = pos - base;
    // Fondu LINÉAIRE (et non smoothstep) : le morphing avance à vitesse constante,
    // donc lentement et de façon bien visible, sans « claquer » au milieu de la transition.
    var ef = frac <= SYS_HOLD ? 0 : (frac - SYS_HOLD) / (1 - SYS_HOLD);
    var i0 = ((base % N) + N) % N;
    var i1 = (i0 + 1) % N;
    var s0 = SYS_SCENES[i0], s1 = SYS_SCENES[i1];
    for (var k = 0; k < this._systems.length; k++) {
      var name = this._systems[k];
      var a0 = s0[name] || 0, a1 = s1[name] || 0;
      this.setAlpha(name, a0 + (a1 - a0) * ef);
    }
    // Libellé : nom du système dominant (celui vers lequel on fond).
    if (this._label) {
      var dom = ef < 0.5 ? i0 : i1;
      if (dom !== this._labelIdx) {
        this._labelIdx = dom;
        this._label.textContent = this._labels[dom] || this._systems[dom] || "";
        this._label.classList.remove("in"); void this._label.offsetWidth; this._label.classList.add("in");
      }
    }
  };

  AnatomyHeroModel.prototype.setupVisibility = function () {
    var self = this, c = this.cfg;
    if (RM) { // pose fixe : gros plan, sans mouvement (et 1er système en mode systèmes)
      if (this.mv) { this.mv.cameraOrbit = orbit(c.theta, c.phi, c.rClose); this.mv.cameraTarget = this.targetStr(c.tyClose); }
      return;
    }

    // Zoom (et scrub de la révélation) pilotés par le scroll : gros plan (haut) → corps entier (après ~0,8 écran).
    this._scrollP = 0;
    this._lastScrollTs = -1e9; // démarre en mode auto (révélation qui rejoue toute seule dès l'ouverture)
    this._autoAnchor = 0;      // position de reprise de l'auto après un scroll
    this._clock = 0;           // horloge interne (ms) — n'avance que pendant la lecture (pause/reprise sans à-coup)
    this._autoClock = 0;       // valeur de l'horloge au début du cycle auto courant
    var ticking = false;
    function readScroll() {
      ticking = false;
      var vh = window.innerHeight || 1;
      self._scrollP = Math.min(Math.max(window.scrollY / (vh * SCROLL_SPAN), 0), 1);
    }
    this._onScroll = function () {
      self._lastScrollTs = nowMs();
      if (!ticking) { ticking = true; requestAnimationFrame(readScroll); }
    };
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
    var self = this, c = this.cfg;
    var N = SYS_SCENES.length;
    if (this._clock === undefined) this._clock = 0;
    this._lastNow = null;
    function frame(now) {
      // Horloge interne accumulée : avance du delta réel entre deux frames, mais reste figée
      // pendant les pauses (hero hors écran, onglet caché) → reprise sans saut.
      if (self._lastNow === null) self._lastNow = now;
      var dt = now - self._lastNow; self._lastNow = now;
      if (dt > 100) dt = 16;          // après une longue pause, on n'avance pas d'un bloc
      self._clock += dt;
      var ms = self._clock;

      var theta = c.theta + (ms / c.spin) * 360; // rotation 360° continue
      var t = ms / BOB_PERIOD * Math.PI * 2;
      var phi = c.phi + c.phiAmp * Math.sin(t * 0.6);
      var p = self._scrollP || 0;
      var e = p * p * (3 - 2 * p);                 // lissage (smoothstep)
      var r = c.rClose + (c.rFull - c.rClose) * e; // zoom piloté par le scroll : gros plan → corps entier
      var ty = c.tyClose + (c.tyFull - c.tyClose) * e;
      var tgt = self.targetStr(ty.toFixed(2));
      if (tgt !== self._lastTarget) { self.mv.cameraTarget = tgt; self._lastTarget = tgt; } // évite une réécriture inutile
      self.mv.cameraOrbit = orbit(theta.toFixed(2), phi.toFixed(2), r.toFixed(2));
      // Applique la pose immédiatement : sans ça, model-viewer lisse vers la cible dans SA propre
      // boucle de rendu, désynchronisée de la nôtre → battement/saccade. Ici notre horloge (delta-time)
      // est la seule source du mouvement → rotation régulière.
      if (self.mv.jumpCameraToGoal) self.mv.jumpCameraToGoal();

      // Révélation des systèmes : suit le scroll ; rejoue toute seule en boucle dès qu'on s'arrête.
      if (self._systems) {
        var scrollPos = p * (N - 1);
        var revPos;
        if (now - self._lastScrollTs < IDLE_MS) {   // scroll récent → scrub
          revPos = scrollPos;
          self._autoAnchor = scrollPos; self._autoClock = self._clock; // mémorise le point de reprise auto
        } else {                                    // au repos → lecture automatique en boucle
          revPos = self._autoAnchor + (self._clock - self._autoClock) / SYS_SEG_MS;
        }
        self.applyReveal(revPos);
      }
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

  /* Intro accueil : au 1er affichage on ne voit que le titre + le corps 3D ;
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
