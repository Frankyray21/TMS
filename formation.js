/* Couche « formation guidée » — par-dessus la copie de la base de connaissances.
   (1) suivi de progression (5 parties, localStorage)  (2) mode parcours : une sous-section à la fois.
   Chargé UNIQUEMENT sur les pages formation*.html, après app.js / app.en.js. */
(function () {
  var path = (location.pathname.split('/').pop() || 'formation.html').toLowerCase();
  if (path.indexOf('formation') !== 0) return;
  var EN = /\.en\.html$/.test(path);
  var mm = path.match(/^formation-(\d)/);
  var PART = mm ? parseInt(mm[1], 10) : 1, TOTAL = 5;
  var NEXTFILE = PART < TOTAL ? (PART === 1 ? 'formation-2' : 'formation-' + (PART + 1)) + (EN ? '.en.html' : '.html') : null;
  var PREVFILE = PART > 1 ? (PART === 2 ? 'formation' : 'formation-' + (PART - 1)) + (EN ? '.en.html' : '.html') : null;
  var KEY = 'tms_form_done';
  var T = EN
    ? { lbl: 'My progress', done: 'Training complete ✓', prev: 'Previous', next: 'Next', nextPart: 'Next part', finish: 'Finish' }
    : { lbl: 'Ma progression', done: 'Formation terminée ✓', prev: 'Précédent', next: 'Suivant', nextPart: 'Partie suivante', finish: 'Terminer' };

  /* ---------- progression (5 parties) ---------- */
  function getDone() { try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(function (n) { return n >= 1 && n <= TOTAL; }); } catch (e) { return []; } }
  function saveDone(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function markPartDone() { var d = getDone(); if (d.indexOf(PART) < 0) { d.push(PART); saveDone(d); } renderProg(); }
  function renderProg() {
    var el = document.getElementById('formProg'); if (!el) return;
    var n = getDone().length;
    el.querySelector('.fp-frac').textContent = (n >= TOTAL ? T.done : (n + ' / ' + TOTAL));
    el.querySelector('.fp-track > i').style.width = Math.round(n / TOTAL * 100) + '%';
    el.classList.toggle('done', n >= TOTAL);
  }
  function buildProg() {
    var anchor = document.querySelector('.toc .toc-brand');
    if (!anchor || document.getElementById('formProg')) return;
    var w = document.createElement('div'); w.id = 'formProg'; w.className = 'form-prog';
    w.innerHTML = '<div class="fp-top"><span class="fp-lbl">' + T.lbl + '</span><span class="fp-frac"></span></div><div class="fp-track" role="progressbar"><i></i></div>';
    anchor.parentNode.insertBefore(w, anchor.nextSibling);
    renderProg();
  }

  /* ---------- mode parcours : une sous-section à la fois ---------- */
  var steps = [], cur = 0;
  function buildSteps() {
    var main = document.querySelector('main.main') || document.querySelector('.main');
    if (!main) return false;
    var sections = [].slice.call(main.children).filter(function (n) { return n.tagName === 'SECTION'; });
    if (!sections.length) return false;
    sections.forEach(function (sec) {
      var wrap = sec.querySelector(':scope > .wrap') || sec;
      var kids = [].slice.call(wrap.children);
      var subAt = [];
      kids.forEach(function (k, i) { if (k.matches && k.matches('h3.sub-h')) subAt.push(i); });
      if (!subAt.length) { steps.push({ sec: sec, wrap: wrap, prefix: [], block: kids }); return; }
      var prefix = kids.slice(0, subAt[0]);                       // titre + intro = contexte affiché à chaque étape de la section
      for (var s = 0; s < subAt.length; s++) {
        var end = (s + 1 < subAt.length) ? subAt[s + 1] : kids.length;
        steps.push({ sec: sec, wrap: wrap, prefix: prefix, block: kids.slice(subAt[s], end) });
      }
    });
    return steps.length > 0;
  }
  function show(i) {
    cur = Math.max(0, Math.min(steps.length - 1, i));
    steps.forEach(function (st) { st.sec.style.display = 'none'; });
    var cs = steps[cur]; cs.sec.style.display = '';
    [].slice.call(cs.wrap.children).forEach(function (c) { c.style.display = 'none'; });
    cs.prefix.forEach(function (n) { n.style.display = ''; });
    cs.block.forEach(function (n) { n.style.display = ''; });
    updateNav();
    try { window.scrollTo(0, 0); } catch (e) {}
    // recalcul des composants interactifs révélés (schéma des facteurs, titres ajustés…)
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    var sc = cs.sec.querySelector('#scene'); if (sc) setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
  }
  function updateNav() {
    var bar = document.getElementById('fnav'); if (!bar) return;
    var pos = bar.querySelector('.fn-pos'), prev = bar.querySelector('.fn-prev'), next = bar.querySelector('.fn-next');
    pos.textContent = (cur + 1) + ' / ' + steps.length;
    prev.disabled = (cur === 0 && !PREVFILE);
    var last = cur === steps.length - 1;
    next.innerHTML = (last ? (NEXTFILE ? T.nextPart : T.finish) : T.next) + ' <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    next.classList.toggle('fn-final', last);
  }
  function goNext() {
    if (cur < steps.length - 1) { show(cur + 1); return; }
    markPartDone();                                              // dernière sous-section de la partie -> partie terminée
    if (NEXTFILE) location.href = NEXTFILE; else { var d = getDone(); if (d.indexOf(PART) < 0) d.push(PART); saveDone(d); renderProg(); }
  }
  function goPrev() {
    if (cur > 0) { show(cur - 1); return; }
    if (PREVFILE) location.href = PREVFILE + '#last';
  }
  function buildNav() {
    if (document.getElementById('fnav')) return;
    var bar = document.createElement('div'); bar.id = 'fnav'; bar.className = 'fnav';
    bar.innerHTML = '<button type="button" class="fn-prev" aria-label="' + T.prev + '"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> ' + T.prev + '</button>'
      + '<span class="fn-pos" aria-live="polite"></span>'
      + '<button type="button" class="fn-next"></button>';
    (document.querySelector('main.main') || document.querySelector('.main') || document.body).appendChild(bar);
    bar.querySelector('.fn-prev').addEventListener('click', goPrev);
    bar.querySelector('.fn-next').addEventListener('click', goNext);
  }
  function initSteps() {
    if (!buildSteps()) return;
    document.documentElement.classList.add('fmode');            // active le style « parcours »
    buildNav();
    var start = (location.hash === '#last') ? steps.length - 1 : 0;
    show(start);
  }

  function init() { buildProg(); initSteps(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
