const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const PERSON = { name: 'Identité fictive Test', empId: 'employee-test-only' };
const SIGNATURE = 'data:image/png;base64,c2lnbmF0dXJlLXRlc3Q=';
const RECEIPT = 'tms_fg_receipt';

function harness(language, { seed = {}, blockedStorage = false, online = false } = {}) {
  const data = new Map(Object.entries({ tms_form_name: PERSON.name, ...seed }));
  const windowListeners = {}, padListeners = {}, clearListeners = {}, images = [], writes = [], network = [];
  let session = { ...PERSON }, drawCount = 0, strokeCount = 0, releases = 0;
  const drawing = { scale() {}, clearRect() {}, beginPath() {}, moveTo() {}, lineTo() {}, stroke() { strokeCount++; }, drawImage() { drawCount++; } };
  const canvas = {
    isConnected: true, width: 300, height: 150,
    getContext: () => drawing,
    getBoundingClientRect: () => ({ left: 0, top: 0, width: 300, height: 150 }),
    setPointerCapture() {}, releasePointerCapture() { releases++; },
    toDataURL: () => SIGNATURE,
    addEventListener: (name, fn) => { padListeners[name] = fn; }
  };
  const elements = {
    attSig: canvas, attSigPh: { style: {} }, certSig: { src: '' }, certSigBox: { style: {} },
    attSigClear: { addEventListener: (name, fn) => { clearListeners[name] = fn; } },
    attSave: { style: {}, dataset: {}, disabled: true }, saveMsg: { style: {} }
  };
  const emit = (type, detail) => (windowListeners[type] || []).forEach(fn => fn({ detail }));
  const storage = {
    getItem(key) { if (blockedStorage) throw new Error('storage denied'); return data.get(key) ?? null; },
    setItem(key, value) { if (blockedStorage) throw new Error('storage denied'); writes.push(['set', key]); data.set(key, String(value)); },
    removeItem(key) { if (blockedStorage) throw new Error('storage denied'); writes.push(['remove', key]); data.delete(key); }
  };
  const window = {
    addEventListener: (type, fn) => (windowListeners[type] ||= []).push(fn),
    devicePixelRatio: 1, scrollTo() {}, confirm: () => true,
    TMSSession: {
      get: () => session,
      set(next) {
        const previous = session;
        session = { ...next };
        if (previous.name !== next.name || previous.empId !== next.empId) emit('tms:identity', { ...next, previous, external: false });
        return session;
      }
    }
  };
  const context = vm.createContext({
    window, localStorage: storage, navigator: { onLine: online }, AbortController,
    testApp: { innerHTML: '', querySelectorAll: () => [] },
    document: { readyState: 'loading', addEventListener() {}, getElementById: key => elements[key] || null, querySelector: () => null, querySelectorAll: () => [], documentElement: { scrollTop: 0 } },
    Image: class { constructor() { images.push(this); } },
    fetch: async (...args) => { network.push(args); throw new Error('simulated lost response; no network performed'); },
    setTimeout: () => 1, clearTimeout() {}, setInterval: () => 1, clearInterval() {}
  });
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', 'formation-attestation.js'), 'utf8'), context);
  const filename = language === 'fr' ? 'formation-guidee.js' : 'formation-guidee.en.js';
  let source = fs.readFileSync(path.join(__dirname, '..', filename), 'utf8');
  source = source.replace(/  if \(document\.readyState !== 'loading'\) init\(\);/, `
    app = globalThis.testApp;
    globalThis.course = {
      state, MODULES, load, certBlock, initSig, initAttestationEvents, resetAttestation,
      setCertName, attStatus, attStatusLabel, saveCert, transfer: attTransfer,
      setSending: function (value) { attSending = value; }
    };
    if (document.readyState !== 'loading') init();`);
  vm.runInContext(source, context, { filename });
  context.course.load();
  context.course.initAttestationEvents();
  return {
    api: context.course, data, writes, images, network, elements, window, emit,
    pointer(type, overrides = {}) {
      const event = { pointerId: 1, isPrimary: true, pointerType: 'mouse', button: 0, clientX: 20, clientY: 20, preventDefault() {}, ...overrides };
      padListeners[type](event);
    },
    clear: () => clearListeners.click(),
    get drawCount() { return drawCount; }, get strokeCount() { return strokeCount; }, get releases() { return releases; }
  };
}

function receipt(name = PERSON.name, employeeId = PERSON.empId) {
  return { version: 1, status: 'sent', name, employeeId, date: '2020-01-09', sentAt: '2020-01-09T17:00:00.000Z', recordId: 'record-test-only', signatureConfirmed: true };
}

for (const language of ['fr', 'en']) {
  test(`${language}: external identity cancels local signature without deleting the new worker receipt`, () => {
    const newer = receipt('Autre identité fictive', 'other-test-id');
    const env = harness(language, { seed: { [RECEIPT]: JSON.stringify(newer) } });
    env.api.state.sigData = SIGNATURE;
    env.emit('tms:identity', { name: newer.name, empId: newer.employeeId, previous: PERSON, external: true });
    assert.equal(env.api.state.sigData, '');
    assert.equal(env.api.state.certName, newer.name);
    assert.deepEqual(JSON.parse(env.data.get(RECEIPT)), newer);
    assert.equal(env.writes.some(([action, key]) => action === 'remove' && key === RECEIPT), false);
    assert.equal(env.network.length, 0);
  });

  test(`${language}: same-tab identity correction invalidates the old local receipt and signature`, () => {
    const env = harness(language, { seed: { [RECEIPT]: JSON.stringify(receipt()) } });
    env.api.state.sigData = SIGNATURE;
    env.emit('tms:identity', { name: 'Nom corrigé Test', empId: PERSON.empId, previous: PERSON, external: false });
    assert.equal(env.api.state.sigData, '');
    assert.equal(env.data.has(RECEIPT), false);
    assert.equal(env.api.state.certName, 'Nom corrigé Test');
    assert.equal(env.network.length, 0);
  });

  test(`${language}: certificate copy uses the saved completion date, not today's date`, () => {
    const env = harness(language, { seed: { [RECEIPT]: JSON.stringify(receipt()) } });
    const html = env.api.certBlock();
    const copy = html.slice(html.indexOf('id="certDoc"'));
    const expected = new Date('2020-01-09T12:00:00').toLocaleDateString(language === 'fr' ? 'fr-CA' : 'en-CA', { year: 'numeric', month: 'long', day: 'numeric' });
    assert.ok(copy.includes(expected));
    assert.doesNotMatch(copy, /id="attSave"/);
  });

  test(`${language}: cancelling a drawing prevents a late pointer-up from restoring the signature`, () => {
    const env = harness(language);
    env.api.initSig();
    env.pointer('pointerdown');
    env.pointer('pointermove', { clientX: 60, clientY: 40 });
    assert.equal(env.strokeCount, 1);
    env.api.resetAttestation(true);
    env.pointer('pointerup', { clientX: 60, clientY: 40 });
    assert.equal(env.api.state.sigData, '');
    assert.equal(env.releases, 1);
    assert.equal(env.elements.attSigPh.style.display, 'flex');
  });

  test(`${language}: corrected identity needs new ink, not a blank tap or stale image restoration`, () => {
    const env = harness(language);
    env.api.state.sigData = SIGNATURE;
    env.api.initSig();
    assert.equal(env.images.length, 1);
    env.api.setCertName('Nom corrigé Test');
    env.images[0].onload();
    assert.equal(env.drawCount, 0, 'the old signature image must not be redrawn after reset');
    env.pointer('pointerdown');
    env.pointer('pointerup');
    assert.equal(env.api.state.sigData, '', 'a blank tap is not a signature');
    env.pointer('pointerdown');
    env.pointer('pointermove', { clientX: 70 });
    env.pointer('pointerup');
    assert.equal(env.api.state.sigData, SIGNATURE, 'new ink can be signed after correction');
  });

  test(`${language}: signature drawing is blocked during transmission`, () => {
    const env = harness(language);
    env.api.initSig();
    env.api.setSending(true);
    env.pointer('pointerdown'); env.pointer('pointermove', { clientX: 70 }); env.pointer('pointerup');
    assert.equal(env.api.state.sigData, '');
    assert.equal(env.strokeCount, 0);
  });

  test(`${language}: network uncertainty remains visible when browser storage is unavailable`, async () => {
    const env = harness(language, { blockedStorage: true, online: true });
    env.api.state.certName = PERSON.name;
    const result = await env.api.transfer.send({ name: PERSON.name, employeeId: PERSON.empId, score: '5/5 modules', signature: SIGNATURE });
    assert.equal(result.status, 'uncertain');
    assert.equal(result.persisted, false);
    assert.equal(env.api.attStatus().status, 'uncertain');
    assert.match(env.api.attStatusLabel(), language === 'fr' ? /Transmission à vérifier/ : /Transmission to verify/);
    assert.equal(env.network.length, 1, 'one mocked request only');
  });

  test(`${language}: explicit Send can attach an already-signed typed identity without erasing its signature`, async () => {
    const env = harness(language);
    const typed = 'Identité saisie Test';
    env.api.state.certName = typed;
    env.api.state.sigData = SIGNATURE;
    env.api.state.completed = Array.from(env.api.MODULES, module => module.id);
    env.api.saveCert();
    await Promise.resolve();
    await Promise.resolve();
    assert.equal(env.window.TMSSession.get().name, typed);
    assert.equal(env.api.state.sigData, SIGNATURE);
    const pending = JSON.parse(env.data.get('tms_fg_pending'));
    assert.equal(pending.name, typed);
    assert.equal(pending.status, 'waiting');
    assert.equal(env.network.length, 0, 'offline test must not make any request');
  });
}
