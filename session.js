/*
  session.js — À qui appartient la session + visite guidée (bilingue FR/EN).

  Chargé sur toutes les pages de contenu. Autonome : ne dépend ni de app.js ni de
  formation-guidee.js (qui restent inchangés dans leur logique). Réutilise le
  système de design (styles.css) et l'endpoint « roster » du Worker Cloudflare
  déjà utilisé par la formation guidée (recherche d'un employé par son nom).

  Contexte métier : le site est souvent consulté sur un ordinateur PARTAGÉ au
  bureau de chantier. On affiche donc clairement le travailleur à qui appartient
  la session en cours, et on offre un moyen de PASSER LA MAIN au suivant (ce qui
  remet la progression de la formation à zéro pour le nouvel arrivant, sans
  toucher aux attestations déjà transmises à Machines Roger International).

  La langue est déduite de <html lang> : une seule source pour FR et EN, ce qui
  garantit la parité (impossible que les deux versions divergent).
*/
(function () {
  'use strict';

  var LANG = ((document.documentElement.getAttribute('lang') || 'fr').toLowerCase().indexOf('en') === 0) ? 'en' : 'fr';

  /* Endpoint du Worker (identique à formation-guidee.js) : recherche de l'employé
     dans le roster Airtable. Renvoie { results: [{ id, name }] }. */
  var ROSTER_ENDPOINT = 'https://attestations-tms.frankyray-21.workers.dev';

  /* Clés localStorage */
  var K_SESSION = 'tms_session';          // { name, empId, since } — source de vérité de l'indicateur
  var K_NAME = 'tms_form_name';           // miroir du nom, lu par la formation (guidée + classique)
  var K_TOUR = 'tms_tour_done';           // '1' quand la visite guidée a été vue
  var K_AFTER_SWITCH = 'tms_after_switch';// drapeau (sessionStorage) : rouvrir le panneau en mode « identifier »
  var K_EPOCH = 'tms_session_epoch';      // identifiant de remise à zéro, partagé entre les onglets

  /* Progression de la formation, effacée quand on passe la main à un autre travailleur. */
  var PROGRESS_KEYS = ['tms_form_progress', 'tms_form_answers', 'tms_form_name', 'tms_form_zones',
    'tms_form_times', 'tms_form_quiz', 'tms_form_done', 'tms_form_sent', 'tms_fg_sent', 'tms_fg_pending',
    'tms_fg_apprec', 'tms_fg_resume', 'tms_fg_receipt'];
  var IDENTITY_KEYS = ['tms_form_sent', 'tms_fg_sent', 'tms_fg_pending', 'tms_fg_receipt'];

  /* ------------------------------------------------------------------ i18n */
  var STR = {
    fr: {
      chip_signin: 'S’identifier',
      chip_aria_none: 'Aucune session active — s’identifier',
      chip_aria_named: function (n) { return 'Session de ' + n + ' — ouvrir les options'; },
      panel_title: 'Ta session',
      panel_close: 'Fermer',
      who_none_title: 'Personne n’est identifié sur cet appareil',
      who_none_desc: 'Poste partagé au chantier ? Identifie-toi pour que ta formation et ton attestation soient bien à ton nom.',
      linked: 'Relié à ton dossier employé',
      notlinked: 'Enregistré tel quel (non relié à un dossier)',
      since: function (d) { return 'Session ouverte ' + d; },
      identify_label: 'Cherche ton nom dans la liste',
      identify_ph: 'Prénom et nom',
      identify_hint: 'Commence à taper ton nom, puis choisis-le dans la liste.',
      identify_searching: 'Recherche…',
      identify_nomatch: 'Aucune correspondance dans la liste.',
      identify_use: function (n) { return 'Utiliser « ' + n + ' »'; },
      identify_linked_ok: 'Relié à ton dossier employé ✓',
      btn_fixname: 'Corriger mon nom',
      btn_switch: 'Passer au prochain travailleur',
      btn_continue_anon: 'Continuer sans m’identifier',
      btn_myformation: 'Voir ma formation guidée',
      btn_tour: 'Revoir la visite guidée',
      shared_note: 'Cet appareil conserve une seule progression, pour la session affichée. Passer au prochain travailleur efface cette progression locale ; les attestations déjà transmises restent enregistrées.',
      fix_title: 'Corriger le nom de cette session',
      fix_desc: 'Cette option garde ta progression : elle sert à corriger ton identité, pas à changer de travailleur. Tu devras signer de nouveau une attestation non transmise. Une correction ne modifie pas les attestations déjà transmises.',
      fix_cancel: 'Annuler la correction',
      fix_pending: 'Un envoi n’a pas encore été confirmé. Corriger le nom annulera cette tentative locale ; vérifie ensuite ton attestation et signe de nouveau.',
      switch_pending: 'Attention : un envoi d’attestation n’a pas encore été confirmé. Passer la main supprime cette tentative locale. Si tu veux la conserver, annule et retourne à ta formation.',
      switch_title: 'Passer au prochain travailleur ?',
      switch_desc: 'La progression de la formation sur cet appareil sera effacée pour laisser la place au prochain travailleur. Les attestations déjà transmises à Machines Roger International, elles, restent enregistrées.',
      switch_yes: 'Oui, passer la main',
      switch_cancel: 'Annuler',
      switch_failed: 'La session n’a pas pu être entièrement effacée sur cet appareil. Ne passe pas ce poste au prochain travailleur. Ferme les fenêtres de ce site, puis efface les données de ce site dans les paramètres du navigateur avant de le rouvrir. Cela ne supprime pas les attestations déjà transmises.',
      toast_reset: 'Session remise à zéro. À toi d’ouvrir la tienne.',
      /* Visite guidée */
      tour_launch: 'Visite guidée',
      tour_prev: 'Précédent',
      tour_next: 'Suivant',
      tour_done: 'Terminer',
      tour_skip: 'Passer',
      tour_step: function (i, n) { return i + ' / ' + n; },
      tour_cta_formation: 'Commencer la formation guidée',
      tour_steps: {
        welcome_t: 'Bienvenue 👋',
        welcome_b: 'Un tour de 30 secondes pour t’y retrouver. Ton corps, c’est ton premier outil de travail — voici comment ce site t’aide à le protéger.',
        session_t: 'À qui appartient cette session',
        session_b: 'Ton nom s’affiche ici. Sur un poste partagé, ouvre ce menu pour t’identifier ou passer la main au prochain travailleur.',
        formation_t: 'Commence par la formation guidée',
        formation_b: 'Un parcours pas à pas avec quiz, score et attestation. C’est le chemin recommandé pour les nouveaux.',
        search_t: 'Trouve un sujet en un clin d’œil',
        search_b: 'Cherche une zone du corps, un geste ou un mot-clé — raccourci clavier « / ».',
        install_t: 'Emporte-le sous terre',
        install_b: 'Installe l’app pour consulter la prévention même hors ligne.',
        end_t: 'Prêt à commencer 💪',
        end_b: 'Tu peux relancer cette visite à tout moment depuis ton menu de session, en haut à droite.'
      }
    },
    en: {
      chip_signin: 'Sign in',
      chip_aria_none: 'No active session — sign in',
      chip_aria_named: function (n) { return 'Session for ' + n + ' — open options'; },
      panel_title: 'Your session',
      panel_close: 'Close',
      who_none_title: 'No one is signed in on this device',
      who_none_desc: 'Shared computer on site? Sign in so your training and certificate are under your name.',
      linked: 'Linked to your employee record',
      notlinked: 'Saved as typed (not linked to a record)',
      since: function (d) { return 'Session opened ' + d; },
      identify_label: 'Find your name in the list',
      identify_ph: 'First and last name',
      identify_hint: 'Start typing your name, then pick it from the list.',
      identify_searching: 'Searching…',
      identify_nomatch: 'No match in the list.',
      identify_use: function (n) { return 'Use “' + n + '”'; },
      identify_linked_ok: 'Linked to your employee record ✓',
      btn_fixname: 'Fix my name',
      btn_switch: 'Hand over to the next worker',
      btn_continue_anon: 'Continue without signing in',
      btn_myformation: 'Open my guided training',
      btn_tour: 'Replay the guided tour',
      shared_note: 'This device keeps one training record for the session shown. Handing over to the next worker clears this local progress; certificates already sent stay on record.',
      fix_title: 'Correct this session’s name',
      fix_desc: 'This keeps your progress: use it to correct your identity, not to change workers. You will need to sign an unsent certificate again. A correction does not change certificates already sent.',
      fix_cancel: 'Cancel the correction',
      fix_pending: 'A certificate delivery has not been confirmed. Correcting the name cancels this local attempt; check your certificate and sign again afterwards.',
      switch_pending: 'Warning: a certificate delivery has not been confirmed. Handing over removes this local attempt. To keep it, cancel and return to your training.',
      switch_title: 'Hand over to the next worker?',
      switch_desc: 'Training progress on this device will be cleared for the next worker. Certificates already sent to Machines Roger International stay on record.',
      switch_yes: 'Yes, hand over',
      switch_cancel: 'Cancel',
      switch_failed: 'This device could not fully clear the session. Do not hand it over to the next worker. Close this site’s windows, then clear this site’s data in your browser settings before reopening it. This does not delete certificates already sent.',
      toast_reset: 'Session reset. Open yours to get started.',
      tour_launch: 'Guided tour',
      tour_prev: 'Back',
      tour_next: 'Next',
      tour_done: 'Done',
      tour_skip: 'Skip',
      tour_step: function (i, n) { return i + ' / ' + n; },
      tour_cta_formation: 'Start the guided training',
      tour_steps: {
        welcome_t: 'Welcome 👋',
        welcome_b: 'A 30-second tour to find your way. Your body is your first tool — here’s how this site helps you protect it.',
        session_t: 'Who this session belongs to',
        session_b: 'Your name shows here. On a shared computer, open this menu to sign in or hand over to the next worker.',
        formation_t: 'Start with the guided training',
        formation_b: 'A step-by-step path with quiz, score and certificate. It’s the recommended route for new workers.',
        search_t: 'Find a topic in a snap',
        search_b: 'Search a body zone, a movement or a keyword — keyboard shortcut “/”.',
        install_t: 'Take it underground',
        install_b: 'Install the app to read the prevention content even offline.',
        end_t: 'Ready to go 💪',
        end_b: 'You can replay this tour anytime from your session menu, top right.'
      }
    }
  };
  var T = STR[LANG];

  /* ------------------------------------------------------------------ utils */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function lsDel(k) { try { localStorage.removeItem(k); } catch (e) {} }
  function ssGet(k) { try { return sessionStorage.getItem(k); } catch (e) { return null; } }
  function ssSet(k, v) { try { sessionStorage.setItem(k, v); } catch (e) {} }
  function ssDel(k) { try { sessionStorage.removeItem(k); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]; }); }
  function firstName(n) { n = (n || '').trim(); return n ? n.split(/\s+/)[0] : ''; }
  function reduced() { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) { return false; } }
  function fmtDate(iso) {
    try {
      var d = iso ? new Date(iso) : new Date();
      return d.toLocaleDateString(LANG === 'en' ? 'en-CA' : 'fr-CA', { day: 'numeric', month: 'long' });
    } catch (e) { return ''; }
  }
  var USER_SVG = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="8" r="4.2"/></svg>';

  /* ------------------------------------------------------------ session state */
  var TMSSession = (function () {
    var subs = [];
    function read() {
      var raw = lsGet(K_SESSION);
      if (raw) { try { var o = JSON.parse(raw); if (o && typeof o === 'object') return o; } catch (e) {} }
      return null;
    }
    function get() { return read(); }
    function notify() { var s = read(); subs.forEach(function (fn) { try { fn(s); } catch (e) {} }); }
    function emit(type, detail) { try { window.dispatchEvent(new CustomEvent(type, { detail: detail })); } catch (e) {} }
    function identityKey(s) { return s ? JSON.stringify([s.name || '', s.empId || '', s.since || '']) : ''; }
    var known = read(), knownEpoch = lsGet(K_EPOCH), reloadQueued = false, resetFailed = false;
    function remember() { known = read(); knownEpoch = lsGet(K_EPOCH); }
    function hasExternalChange() { return reloadQueued || knownEpoch !== lsGet(K_EPOCH) || identityKey(known) !== identityKey(read()); }
    function identityDetail(next, previous, external) {
      return { name: next ? next.name : '', empId: next ? next.empId : '', since: next ? next.since : '',
        previous: previous, changed: true, external: external };
    }
    function set(o) {
      if (resetFailed) return null;
      /* Bloquer aussi une action arrivée avant l'évènement storage : cet onglet
         obsolète n'a pas le droit de rétablir l'identité du travailleur précédent. */
      if (hasExternalChange()) { syncExternal(); return read(); }
      o = o || {};
      var name = String(o.name || '').trim();
      if (!name) { return clear(); }
      var cur = read() || {};
      var next = { name: name, empId: String((o.empId != null ? o.empId : (cur.name === name ? cur.empId : '')) || ''), since: cur.since || new Date().toISOString() };
      var changed = identityKey(next) !== identityKey(cur);
      lsSet(K_SESSION, JSON.stringify(next));
      lsSet(K_NAME, name); /* miroir pour la formation */
      remember();
      /* Une attestation/signature appartient à une identité précise. Les modules
         validés restent acquis lors d'une correction, pas la preuve d'envoi. */
      if (changed && cur.name) IDENTITY_KEYS.forEach(lsDel);
      if (changed) emit('tms:identity', identityDetail(next, cur.name ? cur : null, false));
      notify();
      return next;
    }
    function clear() {
      resetAll();
      return null;
    }
    /* Efface toute la progression de la formation (passage à un autre travailleur). */
    function resetAll() {
      if (hasExternalChange()) { syncExternal(); return false; }
      /* D'abord annuler les opérations en mémoire : leurs callbacks ne doivent
         jamais réécrire un reçu pour le travailleur précédent après l'effacement. */
      emit('tms:session-reset', { reason: 'handover', external: false, previous: read() });
      PROGRESS_KEYS.forEach(lsDel);
      lsDel(K_SESSION);
      /* Ne pas annoncer un poste vide si le navigateur a refusé l'effacement.
         Une lecture refusée ne permet pas non plus de confirmer cette opération. */
      var cleared = false;
      try {
        cleared = PROGRESS_KEYS.concat([K_SESSION]).every(function (key) { return localStorage.getItem(key) === null; });
      } catch (e) {}
      resetFailed = !cleared;
      if (!cleared) { remember(); notify(); return false; }
      lsSet(K_EPOCH, Date.now().toString(36) + '-' + Math.random().toString(36).slice(2));
      remember();
      notify();
      return true;
    }
    /* Une identité modifiée dans un autre onglet ne doit pas laisser une ancienne
       formation active en mémoire. Aucun write ici : pas de boucle entre onglets.
       Le rechargement protège aussi le parcours classique, sans gestion d'évènement. */
    function syncExternal() {
      if (reloadQueued) return;
      var next = read(), epoch = lsGet(K_EPOCH), previous = known;
      var reset = epoch !== knownEpoch || (!!previous && (!next || previous.since !== next.since));
      var changed = identityKey(next) !== identityKey(previous);
      if (!reset && !changed) { notify(); return; }
      remember();
      reloadQueued = true;
      if (reset) emit('tms:session-reset', { reason: 'external', external: true, previous: previous, session: next });
      else emit('tms:identity', identityDetail(next, previous, true));
      notify();
      setTimeout(function () { location.reload(); }, 0);
    }
    window.addEventListener('storage', function (e) {
      if (!e || e.key === null || e.key === K_SESSION || e.key === K_EPOCH) syncExternal();
    });
    window.addEventListener('focus', syncExternal);
    function subscribe(fn) { if (typeof fn === 'function') subs.push(fn); }
    /* Bootstrap : si aucune session mais un nom déjà saisi via la formation, on l'adopte. */
    function reconcile() {
      if (read()) return;
      var nm = (lsGet(K_NAME) || '').trim();
      if (nm) { lsSet(K_SESSION, JSON.stringify({ name: nm, empId: '', since: new Date().toISOString() })); remember(); notify(); }
    }
    return { get: get, set: set, clear: clear, resetAll: resetAll, subscribe: subscribe, reconcile: reconcile };
  })();
  window.TMSSession = TMSSession;

  /* ------------------------------------------------------------------- chip */
  var chip = null;
  function buildChip() {
    chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sess-chip';
    chip.setAttribute('aria-haspopup', 'dialog');
    chip.setAttribute('aria-expanded', 'false');
    chip.addEventListener('click', function () { openPanel(); });
    renderChip();
    return chip;
  }
  function renderChip() {
    if (!chip) return;
    var s = TMSSession.get();
    var name = s && s.name ? s.name : '';
    chip.classList.toggle('is-anon', !name);
    chip.innerHTML = '<span class="sess-chip-dot" aria-hidden="true"></span>' + USER_SVG +
      '<span class="sess-chip-name">' + esc(name || T.chip_signin) + '</span>';
    chip.setAttribute('aria-label', name ? T.chip_aria_named(name) : T.chip_aria_none);
  }
  /* Insertion adaptée au chrome de la page (deux gabarits distincts sur le site). */
  function injectChip() {
    buildChip();
    var ls = document.querySelector('.langswitch');
    if (ls) {
      /* Pages « base de connaissances » / « formation classique » : cluster fixe en
         haut à droite, on ré-parente le sélecteur de langue à côté de l'indicateur.
         (app.js garde sa référence au nœud .langswitch : le masquage au scroll reste bon.) */
      var cluster = document.createElement('div');
      cluster.className = 'sess-cluster';
      ls.parentNode.insertBefore(cluster, ls);
      cluster.appendChild(chip);
      cluster.appendChild(ls);
      return;
    }
    var hdrNav = document.querySelector('.fg-page header nav');
    if (hdrNav) {
      /* Page « formation guidée » : en-tête sticky, on insère dans la barre de droite. */
      chip.classList.add('sess-chip--inline');
      hdrNav.insertBefore(chip, hdrNav.firstChild);
      return;
    }
    /* Repli : pastille fixe autonome. */
    var solo = document.createElement('div');
    solo.className = 'sess-cluster sess-cluster--solo';
    solo.appendChild(chip);
    document.body.appendChild(solo);
  }

  /* ------------------------------------------------------------------ panel */
  var ov = null, panelBody = null, lastFocus = null, escBound = false;
  var rosterTmr = null, rosterReq = 0;

  function lockScroll(on) { try { document.documentElement.style.overflow = on ? 'hidden' : ''; document.body.style.overflow = on ? 'hidden' : ''; } catch (e) {} }
  function trapFocus(container, e) {
    if (e.key !== 'Tab') return;
    var f = container.querySelectorAll('button,[href],input,select,textarea,[tabindex]:not([tabindex="-1"])');
    f = Array.prototype.filter.call(f, function (el) { return !el.disabled && el.offsetParent !== null; });
    if (!f.length) return;
    var first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  function ensurePanel() {
    if (ov) return;
    ov = document.createElement('div');
    ov.className = 'sess-ov';
    ov.setAttribute('role', 'dialog');
    ov.setAttribute('aria-modal', 'true');
    ov.setAttribute('aria-label', T.panel_title);
    ov.innerHTML = '<div class="sess-panel" role="document">' +
      '<div class="sess-panel-head"><h2 class="sess-panel-title">' + esc(T.panel_title) + '</h2>' +
      '<button type="button" class="sess-x" aria-label="' + esc(T.panel_close) + '">×</button></div>' +
      '<span class="sess-bar" aria-hidden="true"></span>' +
      '<div class="sess-panel-body"></div></div>';
    document.body.appendChild(ov);
    panelBody = ov.querySelector('.sess-panel-body');
    ov.addEventListener('click', function (e) { if (e.target === ov) closePanel(); });
    ov.querySelector('.sess-x').addEventListener('click', closePanel);
    ov.querySelector('.sess-panel').addEventListener('keydown', function (e) { trapFocus(this, e); });
  }

  function openPanel(mode) {
    ensurePanel();
    lastFocus = document.activeElement;
    if (chip) chip.setAttribute('aria-expanded', 'true');
    renderPanel(mode || (TMSSession.get() ? 'view' : 'identify'));
    lockScroll(true);
    ov.classList.add('open');
    if (!escBound) { document.addEventListener('keydown', onEsc); escBound = true; }
    setTimeout(function () {
      var focusEl = ov.querySelector('#sessName') || ov.querySelector('.sess-x');
      if (focusEl) focusEl.focus();
    }, 30);
  }
  function closePanel() {
    if (!ov || !ov.classList.contains('open')) return;
    rosterReq++;
    if (rosterTmr) { clearTimeout(rosterTmr); rosterTmr = null; }
    ov.classList.remove('open');
    lockScroll(false);
    if (chip) chip.setAttribute('aria-expanded', 'false');
    if (escBound) { document.removeEventListener('keydown', onEsc); escBound = false; }
    if (lastFocus && lastFocus.focus) { try { lastFocus.focus(); } catch (e) {} }
  }
  function onEsc(e) { if (e.key === 'Escape') closePanel(); }

  function isFormationGuidee() { return /formation-guidee(\.en)?\.html?$/.test(location.pathname) || document.body.classList.contains('fg-page'); }
  function formationHref() { return LANG === 'en' ? 'formation-guidee.en.html' : 'formation-guidee.html'; }
  function hasUnconfirmedCertificate() {
    if (lsGet('tms_fg_pending')) return true;
    try { var receipt = JSON.parse(lsGet('tms_fg_receipt') || 'null'); return !!(receipt && receipt.status === 'incomplete'); }
    catch (e) { return false; }
  }

  function renderPanel(mode) {
    rosterReq++;
    if (rosterTmr) { clearTimeout(rosterTmr); rosterTmr = null; }
    var s = TMSSession.get();
    var correcting = mode === 'correct' && s && s.name;
    var html = '';
    if (mode !== 'identify' && !correcting && s && s.name) {
      /* ------- État A : un travailleur est identifié ------- */
      var linkedTxt = s.empId ? T.linked : T.notlinked;
      html += '<div class="sess-id">' +
        '<span class="sess-avatar" aria-hidden="true">' + USER_SVG + '</span>' +
        '<div class="sess-id-txt"><strong class="sess-id-name">' + esc(s.name) + '</strong>' +
        '<span class="sess-id-meta ' + (s.empId ? 'ok' : '') + '">' + (s.empId ? '✓ ' : '') + esc(linkedTxt) + '</span>' +
        (s.since ? '<span class="sess-id-since">' + esc(T.since(fmtDate(s.since))) + '</span>' : '') +
        '</div></div>';
      html += '<div class="sess-actions">';
      html += '<button type="button" class="sess-btn sess-btn-ghost" data-act="fixname">' + esc(T.btn_fixname) + '</button>';
      if (!isFormationGuidee()) html += '<a class="sess-btn sess-btn-ghost" href="' + formationHref() + '">' + esc(T.btn_myformation) + '</a>';
      html += '<button type="button" class="sess-btn sess-btn-danger" data-act="switch">' + esc(T.btn_switch) + '</button>';
      html += '</div>';
      html += '<p class="sess-note">' + esc(T.shared_note) + '</p>';
    } else {
      /* ------- État B : personne n'est identifié / on (ré)identifie ------- */
      html += '<div class="sess-empty"><h3 class="sess-empty-t">' + esc(correcting ? T.fix_title : T.who_none_title) + '</h3>' +
        '<p class="sess-empty-d">' + esc(correcting ? T.fix_desc : T.who_none_desc) + '</p></div>';
      if (correcting && hasUnconfirmedCertificate()) html += '<p class="sess-note" role="status">' + esc(T.fix_pending) + '</p>';
      html += '<div class="sess-find">' +
        '<label class="sess-lbl" for="sessName">' + esc(T.identify_label) + '</label>' +
        '<div class="sess-find-wrap"><input id="sessName" type="text" autocomplete="off" spellcheck="false" placeholder="' + esc(T.identify_ph) + '" value="' + esc(correcting ? s.name : '') + '">' +
        '<div class="sess-sugg" id="sessSugg" hidden></div></div>' +
        '<p class="sess-hint" id="sessHint">' + esc(T.identify_hint) + '</p></div>';
      html += '<div class="sess-actions">';
      html += '<button type="button" class="sess-btn sess-btn-ghost" data-act="' + (correcting ? 'cancel-fix' : 'anon') + '">' + esc(correcting ? T.fix_cancel : T.btn_continue_anon) + '</button>';
      html += '</div>';
    }
    /* Pied commun : relancer la visite guidée. */
    html += '<div class="sess-foot"><button type="button" class="sess-tourlink" data-act="tour"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 8v.01M11 12h1v4h1"/></svg> ' + esc(T.btn_tour) + '</button></div>';

    panelBody.innerHTML = html;
    wirePanel(mode);
  }

  function wirePanel(mode) {
    panelBody.querySelectorAll('[data-act]').forEach(function (el) {
      el.addEventListener('click', function () {
        var a = el.getAttribute('data-act');
        if (a === 'fixname') { renderPanel('correct'); setTimeout(function () { var i = ov.querySelector('#sessName'); if (i) i.focus(); }, 20); }
        else if (a === 'cancel-fix') renderPanel('view');
        else if (a === 'switch') confirmSwitch();
        else if (a === 'anon') closePanel();
        else if (a === 'tour') { closePanel(); setTimeout(function () { Tour.start(true); }, 120); }
      });
    });
    var input = panelBody.querySelector('#sessName');
    if (input) wireRoster(input);
  }

  /* Recherche dans le roster (même endpoint que la formation guidée). */
  function wireRoster(input) {
    var sugg = panelBody.querySelector('#sessSugg'), hint = panelBody.querySelector('#sessHint');
    function db(s) { try { return s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { return s; } }
    function setHint(t) { if (hint) hint.textContent = t; }
    function hide() { if (sugg) { sugg.hidden = true; sugg.innerHTML = ''; } }
    function commit(name, empId) {
      var current = TMSSession.get();
      /* Valider le texte inchangé ne doit pas détacher un dossier déjà choisi. */
      if (!empId && current && current.name === name) empId = current.empId;
      TMSSession.set({ name: name, empId: empId || '' }); renderPanel('view');
    }
    function hl(name, term) {
      var t = db(name.toLowerCase()), q = db((term || '').toLowerCase()), i = q ? t.indexOf(q) : -1;
      if (i < 0) return esc(name);
      return esc(name.slice(0, i)) + '<b>' + esc(name.slice(i, i + q.length)) + '</b>' + esc(name.slice(i + q.length));
    }
    function render(list, term) {
      if (!sugg) return;
      sugg.innerHTML = '';
      list.forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'sess-opt'; b.innerHTML = hl(it.name, term);
        b.addEventListener('click', function () { commit(it.name, it.id); });
        sugg.appendChild(b);
      });
      /* Toujours proposer d'utiliser le texte saisi tel quel (marche aussi hors ligne). */
      if (term && !list.some(function (it) { return it.name.toLowerCase() === term.toLowerCase(); })) {
        var use = document.createElement('button');
        use.type = 'button'; use.className = 'sess-opt sess-opt-use'; use.textContent = T.identify_use(term);
        use.addEventListener('click', function () { commit(term, ''); });
        sugg.appendChild(use);
      }
      sugg.hidden = false;
    }
    function search() {
      var v = (input.value || '').trim();
      if (v.length < 2) { hide(); return; }
      /* Repli immédiat : on peut toujours s'identifier tel quel, même hors ligne
         (PWA sous terre) ou avant la réponse du Worker. Les correspondances du
         roster viennent s'ajouter au-dessus dès qu'elles arrivent. */
      render([], v);
      setHint(T.identify_searching);
      var my = ++rosterReq, ctrl = null, to = null;
      try { ctrl = new AbortController(); to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 4000); } catch (e) {}
      fetch(ROSTER_ENDPOINT + '?q=' + encodeURIComponent(v), { method: 'GET', signal: ctrl ? ctrl.signal : undefined })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (d) {
          if (to) clearTimeout(to);
          if (my !== rosterReq || document.activeElement !== input) return;
          var list = (d && d.results) || [];
          setHint(list.length ? T.identify_hint : T.identify_nomatch);
          render(list, v);
        })
        .catch(function () {
          if (to) clearTimeout(to);
          if (my !== rosterReq) return;
          setHint(T.identify_nomatch); /* le repli « Utiliser … » reste affiché */
        });
    }
    input.addEventListener('input', function () { if (rosterTmr) clearTimeout(rosterTmr); rosterTmr = setTimeout(search, 220); });
    input.addEventListener('blur', function () {
      setTimeout(function () {
        /* Les propositions sont de vrais boutons : Tab puis Entrée doit pouvoir
           sélectionner un employé, au même titre qu'un clic ou un toucher. */
        if (!sugg || !sugg.contains(document.activeElement)) hide();
      }, 160);
    });
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Escape') { hide(); }
      else if (e.key === 'Enter') { e.preventDefault(); var v = (input.value || '').trim(); if (v) commit(v, ''); }
    });
  }

  /* Confirmation avant de passer la main (efface la progression). */
  function confirmSwitch() {
    panelBody.innerHTML = '<div class="sess-confirm">' +
      '<h3 class="sess-confirm-t">' + esc(T.switch_title) + '</h3>' +
      '<p class="sess-confirm-d">' + esc(T.switch_desc) + '</p>' +
      (hasUnconfirmedCertificate() ? '<p class="sess-note" role="status">' + esc(T.switch_pending) + '</p>' : '') +
      '<div class="sess-actions">' +
      '<button type="button" class="sess-btn sess-btn-ghost" data-act="cancel">' + esc(T.switch_cancel) + '</button>' +
      '<button type="button" class="sess-btn sess-btn-danger" data-act="confirm">' + esc(T.switch_yes) + '</button>' +
      '</div></div>';
    panelBody.querySelector('[data-act="cancel"]').addEventListener('click', function () { renderPanel('view'); });
    panelBody.querySelector('[data-act="confirm"]').addEventListener('click', function () {
      if (!TMSSession.resetAll()) {
        panelBody.innerHTML = '<p class="sess-confirm-d" role="alert">' + esc(T.switch_failed) + '</p>';
        return;
      }
      ssSet(K_AFTER_SWITCH, '1');
      /* On recharge : la formation en mémoire (le cas échéant) repart proprement à zéro,
         puis le panneau se rouvre en mode « identifier » pour le nouvel arrivant. */
      location.reload();
    });
    setTimeout(function () { var b = panelBody.querySelector('[data-act="confirm"]'); if (b) b.focus(); }, 20);
  }

  /* ------------------------------------------------------------- toast léger */
  function toast(msg) {
    var t = document.createElement('div');
    t.className = 'sess-toast'; t.setAttribute('role', 'status'); t.textContent = msg;
    document.body.appendChild(t);
    requestAnimationFrame(function () { t.classList.add('in'); });
    setTimeout(function () { t.classList.remove('in'); setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 400); }, 3200);
  }

  /* ================================================================== TOUR */
  var Tour = (function () {
    var STEPS = [
      { key: 'welcome', center: true, t: T.tour_steps.welcome_t, b: T.tour_steps.welcome_b },
      { key: 'session', sel: '.sess-chip', t: T.tour_steps.session_t, b: T.tour_steps.session_b, prefer: 'below' },
      { key: 'formation', sel: '#ctaFormation, .path-card.here', t: T.tour_steps.formation_t, b: T.tour_steps.formation_b },
      { key: 'search', sel: '#searchOpen', t: T.tour_steps.search_t, b: T.tour_steps.search_b },
      { key: 'install', sel: '[data-pwa-install]', t: T.tour_steps.install_t, b: T.tour_steps.install_b },
      { key: 'end', center: true, end: true, t: T.tour_steps.end_t, b: T.tour_steps.end_b }
    ];
    var root = null, hi = null, pop = null, seq = [], idx = 0, active = false, tLastFocus = null;

    function resolve() {
      seq = STEPS.filter(function (st) {
        if (st.center) return true;
        var el = st.sel ? document.querySelector(st.sel) : null;
        st._el = el || null;
        return !!el;
      });
    }
    function build() {
      root = document.createElement('div');
      root.className = 'tour-root';
      root.setAttribute('role', 'dialog');
      root.setAttribute('aria-modal', 'true');
      root.setAttribute('aria-label', T.tour_launch);
      root.innerHTML = '<div class="tour-catch"></div><div class="tour-hi" hidden></div>' +
        '<div class="tour-pop" role="document">' +
        '<div class="tour-pop-in">' +
        '<span class="tour-count"></span>' +
        '<h3 class="tour-t"></h3><p class="tour-b"></p>' +
        '<div class="tour-nav">' +
        '<button type="button" class="tour-skip"></button>' +
        '<div class="tour-nav-r"><button type="button" class="tour-prev"></button><button type="button" class="tour-next"></button></div>' +
        '</div></div><span class="tour-arrow" hidden></span></div>';
      document.body.appendChild(root);
      hi = root.querySelector('.tour-hi');
      pop = root.querySelector('.tour-pop');
      if (reduced()) root.classList.add('tour-noanim');
      root.querySelector('.tour-skip').addEventListener('click', finish);
      root.querySelector('.tour-prev').addEventListener('click', function () { go(idx - 1); });
      root.querySelector('.tour-next').addEventListener('click', function () { if (idx >= seq.length - 1) finishToFormation(); else go(idx + 1); });
      root.querySelector('.tour-catch').addEventListener('click', function () {}); /* clic sur le voile : sans effet (éviter les sorties accidentelles) */
      root.addEventListener('keydown', onKey);
      window.addEventListener('resize', reposition, { passive: true });
      window.addEventListener('scroll', reposition, { passive: true });
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (e.key === 'ArrowRight' || e.key === 'Enter') { e.preventDefault(); if (idx >= seq.length - 1) finishToFormation(); else go(idx + 1); }
      else if (e.key === 'ArrowLeft') { e.preventDefault(); go(idx - 1); }
      else if (e.key === 'Tab') { trapFocus(pop, e); }
    }
    function go(i) {
      idx = Math.max(0, Math.min(i, seq.length - 1));
      var st = seq[idx];
      root.querySelector('.tour-count').textContent = T.tour_step(idx + 1, seq.length);
      root.querySelector('.tour-t').textContent = st.t;
      root.querySelector('.tour-b').textContent = st.b;
      var prev = root.querySelector('.tour-prev'), next = root.querySelector('.tour-next'), skip = root.querySelector('.tour-skip');
      prev.textContent = T.tour_prev; prev.disabled = (idx === 0); prev.style.visibility = idx === 0 ? 'hidden' : '';
      skip.textContent = T.tour_skip; skip.style.visibility = (idx === seq.length - 1) ? 'hidden' : '';
      next.textContent = st.end ? T.tour_cta_formation : (idx >= seq.length - 1 ? T.tour_done : T.tour_next);
      next.classList.toggle('is-cta', !!st.end);
      reposition();
      setTimeout(function () { next.focus(); }, 30);
    }
    function reposition() {
      if (!active) return;
      var st = seq[idx];
      var arrow = root.querySelector('.tour-arrow');
      if (!st || st.center || !st._el) {
        root.classList.add('tour-centered');
        hi.hidden = true; arrow.hidden = true;
        pop.style.left = ''; pop.style.top = '';
        return;
      }
      root.classList.remove('tour-centered');
      var r = st._el.getBoundingClientRect();
      var pad = 8;
      hi.hidden = false;
      hi.style.left = (r.left - pad) + 'px';
      hi.style.top = (r.top - pad) + 'px';
      hi.style.width = (r.width + pad * 2) + 'px';
      hi.style.height = (r.height + pad * 2) + 'px';
      /* place la bulle : dessous si assez de place, sinon dessus */
      var pw = Math.min(340, window.innerWidth - 24);
      pop.style.width = pw + 'px';
      var below = st.prefer === 'below' || (r.bottom + 170 < window.innerHeight) || r.top < 160;
      var top, left = r.left + r.width / 2 - pw / 2;
      left = Math.max(12, Math.min(left, window.innerWidth - pw - 12));
      var ph = pop.offsetHeight || 160;
      if (below) { top = r.bottom + pad + 12; } else { top = r.top - pad - 12 - ph; }
      top = Math.max(12, Math.min(top, window.innerHeight - ph - 12));
      pop.style.left = left + 'px';
      pop.style.top = top + 'px';
      /* flèche */
      arrow.hidden = false;
      var ax = Math.max(left + 16, Math.min(r.left + r.width / 2, left + pw - 16));
      arrow.style.left = (ax - left) + 'px';
      arrow.classList.toggle('down', !below);
      arrow.classList.toggle('up', below);
      arrow.style.top = below ? '-7px' : '';
      arrow.style.bottom = below ? '' : '-7px';
    }
    function start(force) {
      if (active) return;
      resolve();
      if (!seq.length) return;
      if (!root) build();
      active = true; idx = 0;
      tLastFocus = document.activeElement;
      lockScroll(true);
      root.classList.add('open');
      go(0);
    }
    function finish() {
      if (!active) return;
      active = false;
      lsSet(K_TOUR, '1');
      root.classList.remove('open');
      lockScroll(false);
      if (tLastFocus && tLastFocus.focus) { try { tLastFocus.focus(); } catch (e) {} }
    }
    function finishToFormation() {
      finish();
      if (!isFormationGuidee()) { location.href = formationHref(); }
    }
    return { start: start, finish: finish };
  })();
  window.TMSTour = Tour;

  /* -------------------------------------------------------------------- init */
  function init() {
    if (document.getElementById('sess-noscript-guard')) return;
    injectChip();
    TMSSession.reconcile();
    TMSSession.subscribe(renderChip);
    renderChip();

    /* Les changements inter-onglets sont traités par TMSSession : le badge et
       la formation en mémoire restent ainsi toujours rattachés au même travailleur. */
    window.addEventListener('tms:identity', function () { renderChip(); });

    /* Après un « changer d'utilisateur » : rouvrir le panneau pour identifier le suivant. */
    if (ssGet(K_AFTER_SWITCH)) {
      ssDel(K_AFTER_SWITCH);
      setTimeout(function () { openPanel('identify'); toast(T.toast_reset); }, 500);
    }

    /* Visite guidée au 1er passage : page d'accueil uniquement, si rien n'est encore commencé. */
    var isHome = /(^|\/)(index(\.en)?\.html?)?$/.test(location.pathname) || document.querySelector('.hero-intro');
    var fresh = !lsGet(K_TOUR) && !TMSSession.get() && !lsGet('tms_form_progress');
    if (isHome && fresh) {
      setTimeout(function () { if (!ov || !ov.classList.contains('open')) Tour.start(); }, 900);
    }
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
