const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'session.js'), 'utf8');
const INITIAL = { name: 'Travailleur Test', empId: 'test-only', since: '2026-09-01T10:00:00.000Z' };

function harness(seed = {}, shared, options = {}) {
  const data = shared || new Map(Object.entries(seed));
  const listeners = {}, events = [], timers = [], writes = [];
  let reloads = 0;
  const localStorage = {
    getItem: key => data.has(key) ? data.get(key) : null,
    setItem: (key, value) => { writes.push(['set', key]); data.set(key, String(value)); },
    removeItem: key => {
      writes.push(['remove', key]);
      if (options.failRemoval === key) throw new Error('removal denied');
      data.delete(key);
    }
  };
  const window = {
    addEventListener: (type, fn) => (listeners[type] ||= []).push(fn),
    dispatchEvent: event => { events.push(event); (listeners[event.type] || []).forEach(fn => fn(event)); }
  };
  const context = vm.createContext({
    window, localStorage, sessionStorage: localStorage,
    document: {
      documentElement: { getAttribute: () => 'fr' },
      readyState: 'loading', addEventListener() {}
    },
    CustomEvent: class { constructor(type, opts) { this.type = type; this.detail = opts.detail; } },
    location: { reload: () => reloads++ },
    setTimeout: fn => { timers.push(fn); return timers.length; }, clearTimeout() {}
  });
  vm.runInContext(source, context);
  return {
    api: window.TMSSession, data, events, writes,
    event: (type, event = {}) => (listeners[type] || []).forEach(fn => fn(event)),
    listen: (type, fn) => window.addEventListener(type, fn),
    flush: () => { while (timers.length) timers.shift()(); },
    get reloads() { return reloads; }
  };
}

function signedSeed() {
  return {
    tms_session: JSON.stringify(INITIAL), tms_form_name: INITIAL.name,
    tms_form_progress: '[1,2]', tms_form_answers: '{}', tms_form_zones: '["dos"]',
    tms_form_times: '{}', tms_form_quiz: '{}', tms_form_done: '1',
    tms_form_sent: 'old', tms_fg_sent: 'old', tms_fg_pending: '{"status":"pending"}',
    tms_fg_apprec: '{"comment":"test-only"}', tms_fg_resume: '7',
    tms_fg_receipt: '{"status":"sent","name":"Travailleur Test"}',
    tms_tour_done: '1', unrelated_preference: 'dark'
  };
}

test('handover announces cancellation before clearing all personal training state', () => {
  const env = harness(signedSeed());
  let pendingAtEvent;
  env.listen('tms:session-reset', () => { pendingAtEvent = env.data.get('tms_fg_pending'); });
  assert.equal(env.api.resetAll(), true);
  assert.ok(pendingAtEvent, 'the receiver can cancel its pending operation before storage is erased');
  for (const key of Object.keys(signedSeed()).filter(k => !['tms_tour_done', 'unrelated_preference'].includes(k))) {
    assert.equal(env.data.has(key), false, key + ' must be cleared');
  }
  assert.equal(env.data.get('tms_tour_done'), '1');
  assert.equal(env.data.get('unrelated_preference'), 'dark');
  assert.ok(env.data.get('tms_session_epoch'));
  assert.equal(env.events[0].type, 'tms:session-reset');
  assert.equal(env.events[0].detail.external, false);
  env.event('focus');
  env.flush();
  assert.equal(env.reloads, 0, 'the originating tab does not interpret its own writes as external');
});

test('saving an unchanged identity preserves a pending signature operation', () => {
  const env = harness(signedSeed());
  env.api.set({ name: INITIAL.name, empId: INITIAL.empId });
  assert.equal(env.events.length, 0);
  assert.ok(env.data.get('tms_fg_pending'));
  assert.ok(env.data.get('tms_fg_receipt'));
});

test('correcting an existing name preserves progress but never reuses prior employee links or receipts', () => {
  const env = harness(signedSeed());
  const next = env.api.set({ name: 'Nom Corrigé Test' });
  assert.equal(next.empId, '');
  assert.equal(next.since, INITIAL.since);
  assert.equal(env.data.get('tms_form_progress'), '[1,2]');
  assert.equal(env.data.get('tms_fg_resume'), '7');
  for (const key of ['tms_form_sent', 'tms_fg_sent', 'tms_fg_pending', 'tms_fg_receipt']) {
    assert.equal(env.data.has(key), false, key);
  }
  const event = env.events.find(e => e.type === 'tms:identity');
  assert.equal(event.detail.previous.name, INITIAL.name);
  assert.equal(event.detail.name, 'Nom Corrigé Test');
  assert.equal(event.detail.changed, true);
  assert.equal(event.detail.external, false);
});

test('initial identification supplies previous:null and then becomes stable', () => {
  const env = harness();
  env.api.set({ name: 'Test Initial', empId: 'test-id' });
  assert.equal(env.events[0].detail.previous, null);
  env.event('focus');
  env.flush();
  assert.equal(env.events.length, 1);
  assert.equal(env.reloads, 0);
});

test('another tab cancels stale work and reloads once after handover without storage write loops', () => {
  const origin = harness(signedSeed());
  const other = harness({}, origin.data);
  origin.api.resetAll();
  other.event('storage', { key: 'tms_session_epoch' });
  other.event('storage', { key: 'tms_session' });
  other.event('focus');
  other.flush();
  assert.equal(other.events.length, 1);
  assert.equal(other.events[0].type, 'tms:session-reset');
  assert.equal(other.events[0].detail.external, true);
  assert.equal(other.reloads, 1);
  assert.equal(other.writes.length, 0);
});

test('anonymous reset is propagated even when both tabs have no identity', () => {
  const origin = harness({ tms_form_progress: '[1]' });
  const other = harness({}, origin.data);
  origin.api.resetAll();
  other.event('storage', { key: 'tms_session_epoch' });
  other.flush();
  assert.equal(other.events[0].type, 'tms:session-reset');
  assert.equal(other.reloads, 1);
});

test('external name correction invalidates the old in-memory identity before reload', () => {
  const origin = harness(signedSeed());
  const other = harness({}, origin.data);
  origin.api.set({ name: 'Correction Test', empId: 'new-test-id' });
  other.event('storage', { key: 'tms_session' });
  other.flush();
  assert.equal(other.events[0].type, 'tms:identity');
  assert.equal(other.events[0].detail.external, true);
  assert.equal(other.events[0].detail.name, 'Correction Test');
  assert.equal(other.reloads, 1);
  assert.equal(other.writes.length, 0);
});

test('a stale tab cannot restore or clear the previous worker before storage events arrive', () => {
  const origin = harness(signedSeed());
  const other = harness({}, origin.data);
  origin.api.resetAll();
  origin.api.set({ name: 'Prochain Test', empId: 'next-test' });
  other.api.set({ name: INITIAL.name, empId: INITIAL.empId });
  assert.equal(other.api.resetAll(), false);
  assert.equal(JSON.parse(origin.data.get('tms_session')).name, 'Prochain Test');
  assert.equal(other.writes.length, 0);
  other.flush();
  assert.equal(other.reloads, 1);
});

test('clearing an identity also clears its mirrored name and private feedback', () => {
  const env = harness(signedSeed());
  assert.equal(env.api.clear(), null);
  assert.equal(env.data.has('tms_form_name'), false);
  assert.equal(env.data.has('tms_fg_apprec'), false);
  assert.equal(env.api.get(), null);
});

test('legacy name reconciliation does not trigger an external-change reload', () => {
  const env = harness({ tms_form_name: 'Nom Local Test' });
  env.api.reconcile();
  assert.equal(env.api.get().name, 'Nom Local Test');
  env.event('focus');
  env.event('storage', { key: 'unrelated_preference' });
  env.flush();
  assert.equal(env.reloads, 0);
  assert.equal(env.events.length, 0);
});

test('failed removal blocks handover and a new identity without reloading retained personal state', () => {
  const env = harness(signedSeed(), undefined, { failRemoval: 'tms_fg_apprec' });
  assert.equal(env.api.resetAll(), false);
  assert.ok(env.data.get('tms_fg_apprec'));
  assert.equal(env.data.has('tms_session_epoch'), false, 'failed reset is not broadcast as a completed handover');
  assert.equal(env.events[0].type, 'tms:session-reset', 'in-memory transfer is still cancelled before attempted cleanup');
  assert.equal(env.api.set({ name: 'Prochain Test' }), null, 'retained personal data must not be attributed to a new worker');
  env.event('focus');
  env.flush();
  assert.equal(env.reloads, 0);
});

test('failed session removal keeps an explicit failure rather than claiming anonymous state', () => {
  const env = harness(signedSeed(), undefined, { failRemoval: 'tms_session' });
  assert.equal(env.api.resetAll(), false);
  assert.equal(env.api.get().name, INITIAL.name);
  assert.equal(env.api.set({ name: 'Prochain Test' }), null);
  env.event('focus');
  env.flush();
  assert.equal(env.reloads, 0);
});
