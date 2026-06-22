/* Couche « formation guidée » — par-dessus la copie de la base de connaissances.
   (1) progression (5 parties)  (2) parcours : une sous-section à la fois
   (3) capture du score du quiz  (4) attestation (sans note minimale, sur la dernière partie).
   Chargé UNIQUEMENT sur les pages formation*.html, après app.js / app.en.js. */
(function () {
  var path = (location.pathname.split('/').pop() || 'formation.html').toLowerCase();
  if (path.indexOf('formation') !== 0) return;
  var EN = /\.en\.html$/.test(path);
  var mm = path.match(/^formation-(\d)/);
  var PART = mm ? parseInt(mm[1], 10) : 1, TOTAL = 5;
  var NEXTFILE = PART < TOTAL ? (PART === 1 ? 'formation-2' : 'formation-' + (PART + 1)) + (EN ? '.en.html' : '.html') : null;
  var PREVFILE = PART > 1 ? (PART === 2 ? 'formation' : 'formation-' + (PART - 1)) + (EN ? '.en.html' : '.html') : null;
  var KEY = 'tms_form_done', QKEY = 'tms_form_quiz', NKEY = 'tms_form_name', SKEY = 'tms_form_sent';
  /* URL du Worker Cloudflare qui enregistre l'attestation dans Airtable.
     Laisser vide tant que le Worker n'est pas déployé : le site fonctionne
     normalement, il n'envoie simplement rien. Une fois le Worker en ligne,
     coller ici son URL (ex. 'https://attestations-tms.xxx.workers.dev'). */
  var ATTEST_ENDPOINT = 'https://attestations-tms.frankyray-21.workers.dev';
  var T = EN ? {
    lbl: 'My progress', done: 'Training complete ✓', prev: 'Previous', next: 'Next', nextPart: 'Next part', finish: 'Finish ✓',
    attEy: 'Certificate', attH: 'Your training certificate',
    gateMsg: 'Complete the 5 parts to unlock your certificate.', gateFrac: 'parts done',
    congrats: 'Congratulations — you completed the training!', nameLbl: 'Your full name', namePh: 'First and last name',
    gen: 'Generate / print (save as PDF)', certTitle: 'TRAINING CERTIFICATE', certSub: 'Prevention of musculoskeletal disorders (MSD)',
    certTo: 'Awarded to', certOn: 'On', certScore: 'Quiz score', certOrg: 'Machines Roger International',
    empHint: 'Start typing your name, then pick it from the list', empLinked: 'Linked to your employee file ✓', empNone: 'No match — your name will be saved as typed'
  } : {
    lbl: 'Ma progression', done: 'Formation terminée ✓', prev: 'Précédent', next: 'Suivant', nextPart: 'Partie suivante', finish: 'Terminer ✓',
    attEy: 'Attestation', attH: 'Ton attestation de formation',
    gateMsg: 'Termine les 5 parties pour débloquer ton attestation.', gateFrac: 'parties faites',
    congrats: 'Félicitations — tu as complété la formation !', nameLbl: 'Ton nom complet', namePh: 'Prénom et nom',
    gen: 'Générer / imprimer (enregistrer en PDF)', certTitle: 'ATTESTATION DE FORMATION', certSub: 'Prévention des troubles musculosquelettiques (TMS)',
    certTo: 'Délivrée à', certOn: 'Le', certScore: 'Score au quiz', certOrg: 'Machines Roger International',
    empHint: 'Commence à taper ton nom, puis choisis-le dans la liste', empLinked: 'Relié à ton dossier employé ✓', empNone: 'Aucune correspondance — ton nom sera enregistré tel quel'
  };

  function getDone() { try { return JSON.parse(localStorage.getItem(KEY) || '[]').filter(function (n) { return n >= 1 && n <= TOTAL; }); } catch (e) { return []; } }
  function saveDone(a) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} }
  function markPartDone() { var d = getDone(); if (d.indexOf(PART) < 0) { d.push(PART); saveDone(d); } renderProg(); }
  function allDone() { return getDone().length >= TOTAL; }
  function getQuiz() { try { return JSON.parse(localStorage.getItem(QKEY) || 'null'); } catch (e) { return null; } }

  /* ---------- progression ---------- */
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

  /* ---------- capture du score du quiz ---------- */
  function captureQuiz() {
    var box = document.getElementById('quizBox'); if (!box) return;
    var res = document.getElementById('qResult'), live = document.getElementById('qScoreLive');
    if (!res || !live) return;
    function grab() {
      if (res.hasAttribute('hidden')) return;
      var m = (live.textContent || '').match(/\d+/);
      if (!m) return;
      var rec = { score: parseInt(m[0], 10), total: 10, date: new Date().toISOString().slice(0, 10) };
      try { localStorage.setItem(QKEY, JSON.stringify(rec)); } catch (e) {}
    }
    new MutationObserver(grab).observe(res, { attributes: true, attributeFilter: ['hidden'], childList: true });
    grab();
  }

  /* ---------- attestation (dernière partie) ---------- */
  function buildAttestation() {
    if (PART !== TOTAL) return;
    var main = document.querySelector('main.main') || document.querySelector('.main');
    if (!main || document.getElementById('formAttest')) return;
    var sec = document.createElement('section');
    sec.id = 'formAttest'; sec.setAttribute('tabindex', '-1');
    sec.innerHTML = '<div class="wrap"><div class="eyebrow">' + T.attEy + '</div>'
      + '<h2 class="title">' + T.attH + '</h2><div id="attGate"></div></div>';
    main.appendChild(sec);
  }
  function fmtDate(iso) {
    var d = iso ? new Date(iso) : new Date();
    return d.toLocaleDateString(EN ? 'en-CA' : 'fr-CA', { year: 'numeric', month: 'long', day: 'numeric' });
  }
  /* Envoi (non bloquant) de l'attestation au Worker Cloudflare → Airtable.
     Tolérant aux pannes : si l'envoi échoue, l'impression du PDF n'est jamais
     bloquée. Anti-doublon : un même nom n'est envoyé qu'une fois par jour. */
  function sendAttestation(name, q, employeeId) {
    if (!ATTEST_ENDPOINT) return;
    name = (name || '').trim();
    if (!name) return;
    var sig = name + '|' + new Date().toISOString().slice(0, 10);
    var sent = '';
    try { sent = localStorage.getItem(SKEY) || ''; } catch (e) {}
    if (sent === sig) return;
    var payload = { name: name, lang: EN ? 'EN' : 'FR', date: new Date().toISOString().slice(0, 10), score: q ? (q.score + '/' + q.total) : '', employeeId: employeeId || '' };
    try {
      fetch(ATTEST_ENDPOINT, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), keepalive: true })
        .then(function (r) { if (r && r.ok) { try { localStorage.setItem(SKEY, sig); } catch (e) {} } })
        .catch(function () {});
    } catch (e) {}
  }
  function renderAttestGate() {
    var g = document.getElementById('attGate'); if (!g) return;
    if (!allDone()) {
      g.innerHTML = '<div class="form-gate"><svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0110 0v4"/></svg><p>' + T.gateMsg + '</p><span class="fg-frac">' + getDone().length + ' / ' + TOTAL + ' ' + T.gateFrac + '</span></div>';
      return;
    }
    var q = getQuiz();
    var nm = '';
    try { nm = localStorage.getItem(NKEY) || ''; } catch (e) {}
    g.innerHTML = '<p class="att-congrats">🎉 ' + T.congrats + '</p>'
      + '<div class="att-field att-emp">'
      +   '<span>' + T.nameLbl + '</span>'
      +   '<input type="text" id="attName" placeholder="' + T.namePh + '" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="empSugg" value="' + nm.replace(/"/g, '&quot;') + '">'
      +   '<div id="empSugg" class="emp-sugg" role="listbox" hidden></div>'
      +   '<p class="emp-hint" id="empHint">' + T.empHint + '</p>'
      + '</div>'
      + '<div class="cert" id="certDoc">'
      + '<img class="cert-logo" src="images/logo_roger.png" alt="Machines Roger International">'
      + '<div class="cert-kick">' + T.certTitle + '</div>'
      + '<div class="cert-sub">' + T.certSub + '</div>'
      + '<div class="cert-to">' + T.certTo + '</div>'
      + '<div class="cert-name" id="certName">—</div>'
      + '<div class="cert-meta"><span>' + T.certOn + ' <b id="certDate">' + fmtDate() + '</b></span>'
      + (q ? '<span>' + T.certScore + ' : <b>' + q.score + ' / ' + q.total + '</b></span>' : '')
      + '</div><div class="cert-org">' + T.certOrg + '</div></div>'
      + '<button type="button" class="btn att-print" id="attPrint" disabled><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9V2h12v7M6 18H4a2 2 0 01-2-2v-5a2 2 0 012-2h16a2 2 0 012 2v5a2 2 0 01-2 2h-2M6 14h12v8H6z"/></svg> ' + T.gen + '</button>';
    var input = g.querySelector('#attName'), cn = g.querySelector('#certName'), btn = g.querySelector('#attPrint');
    var sugg = g.querySelector('#empSugg'), hint = g.querySelector('#empHint');
    var pickedId = '', pickedName = '';   // employé choisi dans la liste
    function setHint(txt, ok) { if (hint) { hint.textContent = txt; hint.classList.toggle('ok', !!ok); } }
    function db(s) { try { return s.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) { return s; } }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    function upd() {
      var v = (input.value || '').trim();
      cn.textContent = v || '—';
      btn.disabled = !v;
      try { localStorage.setItem(NKEY, v); } catch (e) {}
      if (pickedId && v.toLowerCase() !== pickedName.toLowerCase()) { pickedId = ''; pickedName = ''; setHint(T.empHint, false); }
    }
    function hideSugg() { if (sugg) { sugg.hidden = true; sugg.innerHTML = ''; } input.setAttribute('aria-expanded', 'false'); }
    function pick(it) { pickedId = it.id; pickedName = it.name; input.value = it.name; upd(); setHint(T.empLinked, true); hideSugg(); }
    function hl(name, term) {
      var t = db(name.toLowerCase()), qd = db((term || '').toLowerCase()), i = qd ? t.indexOf(qd) : -1;
      if (i < 0) return esc(name);
      return esc(name.slice(0, i)) + '<b>' + esc(name.slice(i, i + qd.length)) + '</b>' + esc(name.slice(i + qd.length));
    }
    function renderSugg(list, term) {
      if (!sugg) return;
      if (!list.length) { hideSugg(); setHint(T.empNone, false); return; }
      sugg.innerHTML = '';
      list.forEach(function (it) {
        var b = document.createElement('button');
        b.type = 'button'; b.className = 'emp-item'; b.setAttribute('role', 'option');
        b.innerHTML = hl(it.name, term);
        b.addEventListener('mousedown', function (e) { e.preventDefault(); pick(it); });
        sugg.appendChild(b);
      });
      sugg.hidden = false; input.setAttribute('aria-expanded', 'true');
    }
    var tmr = null, lastReq = 0;
    function doSearch() {
      var v = (input.value || '').trim();
      if (!ATTEST_ENDPOINT || v.length < 2) { hideSugg(); return; }
      var myReq = ++lastReq;
      fetch(ATTEST_ENDPOINT + '?q=' + encodeURIComponent(v), { method: 'GET' })
        .then(function (r) { return r && r.ok ? r.json() : null; })
        .then(function (d) { if (myReq === lastReq && document.activeElement === input) renderSugg((d && d.results) || [], v); })
        .catch(function () {});
    }
    input.addEventListener('input', function () { upd(); if (tmr) clearTimeout(tmr); tmr = setTimeout(doSearch, 220); });
    input.addEventListener('focus', function () { if (!pickedId && (input.value || '').trim().length >= 2) doSearch(); });
    input.addEventListener('blur', function () { setTimeout(hideSugg, 150); });
    input.addEventListener('keydown', function (e) { if (e.key === 'Escape') hideSugg(); });
    upd(); setHint(T.empHint, false);
    btn.addEventListener('click', function () { sendAttestation((input.value || '').trim(), q, pickedId); document.documentElement.classList.add('printing-cert'); window.print(); setTimeout(function () { document.documentElement.classList.remove('printing-cert'); }, 600); });
  }

  /* ---------- parcours : une sous-section à la fois ---------- */
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
      var prefix = kids.slice(0, subAt[0]);
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
    if (cs.sec.id === 'formAttest') { markPartDone(); renderAttestGate(); }
    updateNav();
    try { window.scrollTo(0, 0); } catch (e) {}
    try { window.dispatchEvent(new Event('resize')); } catch (e) {}
    if (cs.sec.querySelector('#scene')) setTimeout(function () { try { window.dispatchEvent(new Event('resize')); } catch (e) {} }, 60);
  }
  function updateNav() {
    var bar = document.getElementById('fnav'); if (!bar) return;
    var last = cur === steps.length - 1;
    bar.querySelector('.fn-pos').textContent = (cur + 1) + ' / ' + steps.length;
    bar.querySelector('.fn-prev').disabled = (cur === 0 && !PREVFILE);
    var nx = bar.querySelector('.fn-next');
    nx.innerHTML = (last ? (NEXTFILE ? T.nextPart : T.finish) : T.next) + ' <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
    nx.classList.toggle('fn-final', last);
  }
  function goNext() {
    if (cur < steps.length - 1) { show(cur + 1); return; }
    markPartDone();
    if (NEXTFILE) { location.href = NEXTFILE; return; }
    /* Dernière étape de la dernière partie : déclencher l'attestation. */
    var pin = document.getElementById('attPrint');
    if (pin && !pin.disabled) { pin.click(); return; }
    var nin = document.getElementById('attName');
    if (nin) { try { nin.scrollIntoView({ behavior: 'smooth', block: 'center' }); } catch (e) {} nin.focus(); }
  }
  function goPrev() {
    if (cur > 0) { show(cur - 1); return; }
    if (PREVFILE) location.href = PREVFILE + '#last';
  }
  function buildNav() {
    if (document.getElementById('fnav')) return;
    var bar = document.createElement('div'); bar.id = 'fnav'; bar.className = 'fnav';
    bar.innerHTML = '<button type="button" class="fn-prev"><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 18l-6-6 6-6"/></svg> ' + T.prev + '</button><span class="fn-pos" aria-live="polite"></span><button type="button" class="fn-next"></button>';
    (document.querySelector('main.main') || document.querySelector('.main') || document.body).appendChild(bar);
    bar.querySelector('.fn-prev').addEventListener('click', goPrev);
    bar.querySelector('.fn-next').addEventListener('click', goNext);
  }
  function initSteps() {
    if (!buildSteps()) return;
    document.documentElement.classList.add('fmode');
    buildNav();
    show(location.hash === '#last' ? steps.length - 1 : 0);
  }

  function init() { buildProg(); captureQuiz(); buildAttestation(); initSteps(); }
  if (document.readyState !== 'loading') init();
  else document.addEventListener('DOMContentLoaded', init);
})();
