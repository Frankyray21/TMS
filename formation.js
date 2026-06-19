/* Couche « formation guidée » — ajoutée par-dessus la copie de la base de connaissances.
   Étape 1 : suivi de progression à travers les 5 parties (localStorage) + barre dans le sommaire.
   Chargé UNIQUEMENT sur les pages formation*.html (après app.js / app.en.js).
   Les étapes suivantes (quiz/score, attestation) viendront s'ajouter ici. */
(function () {
  var path = (location.pathname.split('/').pop() || 'formation.html').toLowerCase();
  if (path.indexOf('formation') !== 0) return;                 // sécurité : pages formation seulement
  var EN = /\.en\.html$/.test(path);
  var mm = path.match(/^formation-(\d)/);
  var PART = mm ? parseInt(mm[1], 10) : 1;                      // formation.html = 1 ; formation-N.html = N
  var TOTAL = 5;
  var KEY = 'tms_form_done';
  var T = EN
    ? { lbl: 'My progress', done: 'Training complete ✓' }
    : { lbl: 'Ma progression', done: 'Formation terminée ✓' };

  function get() {
    try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(function (n) { return n >= 1 && n <= TOTAL; }); }
    catch (e) { return []; }
  }
  function save(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function add(n) { var d = get(); if (d.indexOf(n) < 0) { d.push(n); save(d); render(); } }
  function count() { return get().length; }
  function pct() { return Math.round(count() / TOTAL * 100); }

  function render() {
    var el = document.getElementById('formProg'); if (!el) return;
    var n = count();
    el.querySelector('.fp-frac').textContent = (n >= TOTAL ? T.done : (n + ' / ' + TOTAL));
    el.querySelector('.fp-track > i').style.width = pct() + '%';
    el.classList.toggle('done', n >= TOTAL);
  }
  function build() {
    var anchor = document.querySelector('.toc .toc-brand');
    if (!anchor || document.getElementById('formProg')) return;
    var w = document.createElement('div');
    w.id = 'formProg'; w.className = 'form-prog';
    w.innerHTML = '<div class="fp-top"><span class="fp-lbl">' + T.lbl + '</span><span class="fp-frac"></span></div>'
      + '<div class="fp-track" role="progressbar" aria-label="' + T.lbl + '"><i></i></div>';
    anchor.parentNode.insertBefore(w, anchor.nextSibling);
    render();
  }
  function wire() {
    var nx = document.querySelector('.part-nav .pn-next');       // bouton « Partie suivante »
    if (nx) nx.addEventListener('click', function () { add(PART); });   // terminer la partie courante en passant à la suivante
  }
  function init() { build(); wire(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
