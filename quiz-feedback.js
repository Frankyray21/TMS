/*
  quiz-feedback.js — « Cette question était-elle bonne ? » sous chaque question de quiz.
  Pouce haut / pouce bas + champ commentaire. Bilingue (via <html lang>).

  S'attache à TOUS les quiz du site sans réécrire chaque moteur : les rendus de
  quiz déposent un simple gabarit
      <div class="qfb" data-qfb-key="..." data-qfb-quiz="..." data-qfb-q="..."></div>
  sous chaque question ; ce module le remplit (idempotent) et gère les clics via
  délégation, ce qui survit aux re-rendus (le quiz guidé reconstruit tout son HTML
  à chaque réponse).

  Les retours sont enregistrés localement PUIS envoyés au Worker Cloudflare
  (POST /feedback → Airtable). File d'attente : si le Worker /feedback n'est pas
  encore déployé (ou hors ligne), le retour reste en attente et repart au prochain
  chargement. On n'envoie AUCUN champ « name » de premier niveau : l'ancien Worker,
  qui traite tout POST comme une attestation, répond alors 400 sans rien créer.
*/
(function () {
  'use strict';

  var LANG = ((document.documentElement.getAttribute('lang') || 'fr').toLowerCase().indexOf('en') === 0) ? 'en' : 'fr';
  var ENDPOINT = 'https://attestations-tms.frankyray-21.workers.dev/feedback';
  var K_FB = 'tms_qfb';          // { key: {rating, comment, quiz, q, lang, ts, sent} }
  var K_SESSION = 'tms_session'; // identité (facultative) pour joindre au retour

  var STR = {
    fr: {
      ask: 'Cette question était-elle bonne ?',
      up: 'Bonne question', down: 'À revoir',
      comment_ph: 'Un commentaire ? (facultatif)',
      thanks: 'Merci — ton retour aide à améliorer le quiz.',
      saved: 'Retour enregistré ✓', pending: 'Retour enregistré (envoi en attente)'
    },
    en: {
      ask: 'Was this question good?',
      up: 'Good question', down: 'Needs work',
      comment_ph: 'A comment? (optional)',
      thanks: 'Thanks — your feedback helps improve the quiz.',
      saved: 'Feedback saved ✓', pending: 'Feedback saved (queued)'
    }
  };
  var T = STR[LANG];

  var THUMB_UP = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M1 21h4V9H1v12zm22-11c0-1.1-.9-2-2-2h-6.31l.95-4.57.03-.32c0-.41-.17-.79-.44-1.06L14.17 1 7.59 7.59C7.22 7.95 7 8.45 7 9v10c0 1.1.9 2 2 2h9c.83 0 1.54-.5 1.84-1.22l3.02-7.05c.09-.23.14-.47.14-.73v-2z"/></svg>';
  var THUMB_DOWN = '<svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true"><path d="M15 3H6c-.83 0-1.54.5-1.84 1.22l-3.02 7.05c-.09.23-.14.47-.14.73v2c0 1.1.9 2 2 2h6.31l-.95 4.57-.03.32c0 .41.17.79.44 1.06L9.83 23l6.59-6.59c.36-.36.58-.86.58-1.41V5c0-1.1-.9-2-2-2zm4 0v12h4V3h-4z"/></svg>';

  /* ------------------------------------------------------------------ utils */
  function lsGet(k) { try { return localStorage.getItem(k); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;' })[c]; }); }
  function nowISO() { try { return new Date().toISOString(); } catch (e) { return ''; } }
  function readStore() { var r = lsGet(K_FB); if (r) { try { var o = JSON.parse(r); if (o && typeof o === 'object') return o; } catch (e) {} } return {}; }
  function writeStore(o) { lsSet(K_FB, JSON.stringify(o)); }
  function identity() { var r = lsGet(K_SESSION); if (r) { try { var o = JSON.parse(r); if (o && o.name) return { name: o.name, empId: o.empId || '' }; } catch (e) {} } return { name: '', empId: '' }; }

  /* ------------------------------------------------------- envoi + file d'attente */
  var flushing = false;
  function send(entry) {
    var id = identity();
    var payload = {
      kind: 'quiz-feedback', key: entry.key, quiz: entry.quiz || '', question: entry.q || '',
      rating: entry.rating || '', comment: entry.comment || '', lang: LANG.toUpperCase(),
      authorName: id.name, authorId: id.empId, date: (entry.ts || nowISO()).slice(0, 10), voteId: entry.vid || ''
    };
    var ctrl = null, to = null;
    try { ctrl = new AbortController(); to = setTimeout(function () { try { ctrl.abort(); } catch (e) {} }, 6000); } catch (e) {}
    return fetch(ENDPOINT, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload), signal: ctrl ? ctrl.signal : undefined
    }).then(function (r) { if (to) clearTimeout(to); return !!(r && r.ok); })
      .catch(function () { if (to) clearTimeout(to); return false; });
  }
  function flush() {
    if (flushing) return;
    var store = readStore();
    var pending = Object.keys(store).filter(function (k) { return store[k] && store[k].rating && !store[k].sent; });
    if (!pending.length) return;
    flushing = true;
    (function step(i) {
      if (i >= pending.length) { flushing = false; return; }
      var k = pending[i], entry = store[k];
      send(entry).then(function (ok) {
        if (ok) { var s = readStore(); if (s[k]) { s[k].sent = true; writeStore(s); markSent(k); } }
        step(i + 1);
      });
    })(0);
  }

  /* --------------------------------------------------------------- rendu widget */
  function fill(node) {
    var key = node.getAttribute('data-qfb-key');
    if (!key) return;
    node.setAttribute('data-qfb-ready', '1');
    node.setAttribute('data-qfb-quiz', node.getAttribute('data-qfb-quiz') || '');
    var store = readStore(), cur = store[key] || {};
    var rated = cur.rating === 'up' || cur.rating === 'down';
    node.innerHTML =
      '<div class="qfb-in">' +
      '<div class="qfb-ask">' +
      '<span class="qfb-thumbs">' +
      '<button type="button" class="qfb-thumb qfb-up' + (cur.rating === 'up' ? ' on' : '') + '" data-qfb-rate="up" aria-pressed="' + (cur.rating === 'up') + '" aria-label="' + esc(T.up) + '" title="' + esc(T.up) + '">' + THUMB_UP + '</button>' +
      '<button type="button" class="qfb-thumb qfb-down' + (cur.rating === 'down' ? ' on' : '') + '" data-qfb-rate="down" aria-pressed="' + (cur.rating === 'down') + '" aria-label="' + esc(T.down) + '" title="' + esc(T.down) + '">' + THUMB_DOWN + '</button>' +
      '</span>' +
      '<span class="qfb-q-label">' + esc(T.ask) + '</span></div>' +
      '<div class="qfb-more">' +
      '<textarea class="qfb-comment" rows="2" placeholder="' + esc(T.comment_ph) + '">' + esc(cur.comment || '') + '</textarea>' +
      '<div class="qfb-note" aria-live="polite">' + (rated ? esc(cur.sent ? T.saved : (cur.comment ? T.saved : T.thanks)) : '') + '</div>' +
      '</div></div>';
  }
  function fillAll() {
    var list = document.querySelectorAll('.qfb:not([data-qfb-ready])');
    for (var i = 0; i < list.length; i++) fill(list[i]);
  }
  function markSent(key) {
    document.querySelectorAll('.qfb[data-qfb-key="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"] .qfb-note').forEach(function (n) { n.textContent = T.saved; });
  }

  /* ---------------------------------------------------------- persistance + note */
  function saveEntry(node, patch) {
    var key = node.getAttribute('data-qfb-key');
    if (!key) return null;
    var store = readStore();
    var e = store[key] || { key: key };
    e.key = key;
    if (!e.vid) e.vid = 'v' + Date.now().toString(36) + Math.random().toString(36).slice(2, 8); /* clé stable du vote (dédoublonnage Airtable) */
    e.quiz = node.getAttribute('data-qfb-quiz') || e.quiz || '';
    e.q = node.getAttribute('data-qfb-q') || e.q || '';
    e.lang = LANG.toUpperCase();
    if (patch.rating !== undefined) e.rating = patch.rating;
    if (patch.comment !== undefined) e.comment = patch.comment;
    e.ts = nowISO();
    e.sent = false; /* toute modification repart à l'envoi */
    store[key] = e;
    writeStore(store);
    return e;
  }
  function setNote(node, txt) { var n = node.querySelector('.qfb-note'); if (n) n.textContent = txt; }

  var cmtTimers = {};
  function onCommentInput(node) {
    var key = node.getAttribute('data-qfb-key');
    var ta = node.querySelector('.qfb-comment'); if (!ta) return;
    if (cmtTimers[key]) clearTimeout(cmtTimers[key]);
    cmtTimers[key] = setTimeout(function () {
      saveEntry(node, { comment: ta.value.trim() }); /* sauvegarde locale ; l'envoi se fait au blur */
    }, 500);
  }
  function onCommentBlur(node) {
    var key = node.getAttribute('data-qfb-key');
    var ta = node.querySelector('.qfb-comment'); if (!ta) return;
    if (cmtTimers[key]) { clearTimeout(cmtTimers[key]); cmtTimers[key] = null; }
    saveEntry(node, { comment: ta.value.trim() });
    setNote(node, T.pending); flush();
  }
  function onRate(node, rating) {
    var store = readStore(), key = node.getAttribute('data-qfb-key');
    var cur = (store[key] || {}).rating;
    var next = (cur === rating) ? '' : rating; /* re-cliquer = annuler */
    saveEntry(node, { rating: next });
    /* refléter l'état sans tout re-rendre (garde le commentaire en cours) */
    node.querySelectorAll('.qfb-thumb').forEach(function (b) {
      var on = b.getAttribute('data-qfb-rate') === next;
      b.classList.toggle('on', on); b.setAttribute('aria-pressed', on);
    });
    if (next) { setNote(node, T.thanks); flush(); }
    else setNote(node, '');
  }

  /* ----------------------------------------------------------------- délégation */
  function bindOnce() {
    if (bindOnce._done) return; bindOnce._done = true;
    document.addEventListener('click', function (e) {
      var btn = e.target.closest ? e.target.closest('.qfb-thumb') : null;
      if (!btn) return;
      var node = btn.closest('.qfb'); if (!node) return;
      e.preventDefault();
      onRate(node, btn.getAttribute('data-qfb-rate'));
    });
    document.addEventListener('input', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('qfb-comment')) {
        var node = e.target.closest('.qfb'); if (node) onCommentInput(node);
      }
    });
    document.addEventListener('blur', function (e) {
      if (e.target && e.target.classList && e.target.classList.contains('qfb-comment')) {
        var node = e.target.closest('.qfb'); if (node) onCommentBlur(node);
      }
    }, true);
  }

  /* ------------------------------------------------------------------ init */
  function init() {
    bindOnce();
    fillAll();
    flush(); /* renvoie les retours en attente (ex. Worker déployé depuis) */
    /* Les quiz se (re)construisent dynamiquement : on remplit tout nouveau gabarit. */
    var obs = new MutationObserver(function (muts) {
      for (var i = 0; i < muts.length; i++) {
        if (muts[i].addedNodes && muts[i].addedNodes.length) { fillAll(); return; }
      }
    });
    try { obs.observe(document.body, { childList: true, subtree: true }); } catch (e) {}
    window.addEventListener('focus', flush);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

  window.TMSQuizFeedback = { flush: flush, fillAll: fillAll };
})();
