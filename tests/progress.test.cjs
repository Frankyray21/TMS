const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

// Exercise the actual standalone scripts. The in-memory hook is never shipped to browsers.
function course(language, store = new Map(), storageUnavailable = false) {
  const filename = path.join(__dirname, '..', language === 'fr' ? 'formation-guidee.js' : 'formation-guidee.en.js');
  let source = fs.readFileSync(filename, 'utf8');
  const hook = `
    app = globalThis.testApp;
    globalThis.course = {
      state, MODULES, steps, stepKey, load, loadResume, rememberStep, resetResume,
      moduleStarted, hasStarted, resumeIndex, renderSommaire, start, reset, go,
      moduleScore, syncModulePass, passed,
      resume: function () { return resumeState; }
    };
  `;
  source = source.replace(/  if \(document\.readyState !== 'loading'\) init\(\);/, hook + "\n  if (document.readyState !== 'loading') init();");
  const app = { innerHTML: '', querySelectorAll: () => [] };
  const context = vm.createContext({
    testApp: app,
    console,
    localStorage: {
      getItem(key) { if (storageUnavailable) throw new Error('Storage unavailable'); return store.get(key) ?? null; },
      setItem(key, value) { if (storageUnavailable) throw new Error('Storage unavailable'); store.set(key, String(value)); },
      removeItem(key) { if (storageUnavailable) throw new Error('Storage unavailable'); store.delete(key); }
    },
    document: { readyState: 'loading', addEventListener() {}, getElementById: () => null, querySelector: () => null, querySelectorAll: () => [], documentElement: { scrollTop: 0 } },
    window: { confirm: () => true, scrollTo() {} },
    setInterval: () => 1, clearInterval() {}, setTimeout: () => 1, clearTimeout() {},
    fetch: () => { throw new Error('Tests must never submit data'); }
  });
  vm.runInContext(source, context, { filename });
  context.course.load();
  return { api: context.course, store, app };
}

for (const language of ['fr', 'en']) {
  test(`${language}: fresh progress is not in progress and has no reset action`, () => {
    const { api } = course(language);
    assert.equal(api.hasStarted(), false);
    const html = api.renderSommaire();
    assert.doesNotMatch(html, /data-act="reset"/);
    assert.doesNotMatch(html, language === 'fr' ? />En cours</ : />In progress</);
    assert.match(html, language === 'fr' ? /Commencer la formation/ : /Start the training/);
    assert.match(html, /0 \/ 21/);
    assert.equal(api.resumeIndex(), 0);
  });

  test(`${language}: entering a topic saves its stable position once`, () => {
    const { api, store } = course(language);
    const step = api.steps()[2];
    api.go('viewer', 2);
    api.go('viewer', 2);
    const saved = JSON.parse(store.get('tms_fg_resume'));
    assert.deepEqual(saved, { version: 1, stepKey: api.stepKey(step), visited: [api.stepKey(step)] });
    assert.equal(api.hasStarted(), true);
    assert.equal(api.passed(step.module.id), false);
    api.go('sommaire');
    assert.equal(JSON.parse(store.get('tms_fg_resume')).stepKey, api.stepKey(step));
    assert.match(api.renderSommaire(), language === 'fr' ? /Reprendre : module 1 · notion 3/ : /Resume: module 1 · topic 3/);
  });

  test(`${language}: reload and Resume open the exact topic without validating a module`, () => {
    const first = course(language);
    first.api.go('viewer', 3);
    const reloaded = course(language, first.store);
    assert.equal(reloaded.api.state.idx, 3);
    reloaded.api.start();
    assert.equal(reloaded.api.state.view, 'viewer');
    assert.equal(reloaded.api.state.idx, 3);
    assert.equal(reloaded.api.state.completed.length, 0);
    assert.equal(reloaded.api.moduleScore(reloaded.api.MODULES[0]).passed, false);
  });

  test(`${language}: a quiz is resumable but is not counted as a viewed topic`, () => {
    const { api, store } = course(language);
    const idx = api.steps().findIndex(step => step.kind === 'quiz' && step.mi === 1);
    api.go('viewer', idx);
    const reloaded = course(language, store);
    assert.equal(reloaded.api.resumeIndex(), idx);
    assert.equal(reloaded.api.resume().visited.length, 0);
    assert.match(reloaded.api.renderSommaire(), language === 'fr' ? /Reprendre : module 2 · quiz/ : /Resume: module 2 · quiz/);
    assert.equal(reloaded.api.moduleScore(reloaded.api.MODULES[1]).passed, false);
  });

  test(`${language}: resume records are validated and deduplicated`, () => {
    const store = new Map([['tms_fg_resume', JSON.stringify({ version: 1, stepKey: 'bad/position', visited: ['comprendre/intro', 'comprendre/intro', 'comprendre/quiz', 'missing/topic', null, {}] })]]);
    const { api } = course(language, store);
    assert.equal(api.resume().stepKey, null);
    assert.equal(JSON.stringify(api.resume().visited), '["comprendre/intro"]');
    assert.equal(api.resumeIndex(), 0);
    assert.equal(api.hasStarted(), true);
    assert.doesNotMatch(api.renderSommaire(), language === 'fr' ? /Reprendre : module/ : /Resume: module/);
  });

  test(`${language}: malformed or future resume versions fall back safely`, () => {
    for (const invalid of ['{broken', 'null', '[]', JSON.stringify({ version: 99, stepKey: 'comprendre/types', visited: ['comprendre/intro'] })]) {
      const { api } = course(language, new Map([['tms_fg_resume', invalid]]));
      assert.equal(api.hasStarted(), false);
      assert.equal(api.resumeIndex(), 0);
      assert.equal(api.resume().visited.length, 0);
    }
  });

  test(`${language}: legacy reading and answers remain in progress without invented position`, () => {
    const store = new Map([
      ['tms_form_times', JSON.stringify({ 'comprendre/types': 2500 })],
      ['tms_form_answers', JSON.stringify({ charge: { 0: 1 } })]
    ]);
    const { api } = course(language, store);
    assert.equal(api.hasStarted(), true);
    assert.equal(api.moduleStarted(api.MODULES[0]), true);
    assert.equal(api.moduleStarted(api.MODULES[1]), true);
    assert.equal(api.resume().stepKey, null);
    assert.equal(api.resume().visited.length, 0);
    assert.equal(api.resumeIndex(), 0);
    assert.match(api.renderSommaire(), /data-act="reset"/);
  });

  test(`${language}: legacy validated modules choose first unpassed module`, () => {
    const { api } = course(language, new Map([['tms_form_progress', '["comprendre"]']]));
    assert.equal(api.steps()[api.resumeIndex()].module.id, 'charge');
    assert.equal(api.hasStarted(), true);
    assert.equal(api.resume().visited.length, 0);
  });

  test(`${language}: reset clears resume, reading, answers and module progress`, () => {
    const { api, store } = course(language);
    api.go('viewer', 3);
    api.state.answers = { comprendre: { 0: 1 } };
    api.state.completed = ['comprendre'];
    api.state.times = { 'comprendre/types': 1000 };
    api.reset();
    assert.equal(store.has('tms_fg_resume'), false);
    assert.equal(api.hasStarted(), false);
    assert.equal(api.state.idx, 0);
    assert.equal(api.state.view, 'sommaire');
    assert.equal(JSON.stringify(api.state.answers), '{}');
    assert.equal(JSON.stringify(api.state.times), '{}');
    assert.equal(api.state.completed.length, 0);
  });

  test(`${language}: unavailable browser storage does not break navigation`, () => {
    const { api } = course(language, new Map(), true);
    assert.doesNotThrow(() => { api.go('viewer', 2); api.go('sommaire'); api.start(); });
    assert.equal(api.state.idx, 2);
    assert.equal(api.hasStarted(), true);
    assert.doesNotThrow(() => api.reset());
    assert.equal(api.hasStarted(), false);
  });

  test(`${language}: visiting all steps does not bypass quiz 80% requirement`, () => {
    const { api } = course(language);
    api.steps().forEach(api.rememberStep);
    api.MODULES.forEach(api.syncModulePass);
    assert.equal(api.resume().visited.length, 21);
    assert.equal(api.state.completed.length, 0);
    const module = api.MODULES[0];
    api.state.answers[module.id] = Object.fromEntries(module.quiz.map((question, i) => [i, i < 3 ? question.answer : (question.answer + 1) % question.options.length]));
    api.syncModulePass(module);
    assert.equal(api.moduleScore(module).score, 3);
    assert.equal(api.passed(module.id), false);
    api.state.answers[module.id][3] = module.quiz[3].answer;
    api.syncModulePass(module);
    assert.equal(api.moduleScore(module).score, 4);
    assert.equal(api.passed(module.id), true);
  });
}

test('French and English use identical stable step IDs and share exact Resume', () => {
  const fr = course('fr');
  fr.api.go('viewer', 9);
  const en = course('en', fr.store);
  assert.deepEqual(Array.from(fr.api.steps(), fr.api.stepKey), Array.from(en.api.steps(), en.api.stepKey));
  assert.equal(en.api.resumeIndex(), 9);
  en.api.start();
  assert.equal(en.api.state.idx, 9);
  en.api.go('viewer', 13);
  const back = course('fr', fr.store);
  assert.equal(back.api.resumeIndex(), 13);
  assert.equal(back.api.resume().visited.length, 2);
});
