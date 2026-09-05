const test = require('node:test');
const assert = require('node:assert/strict');
const { create, localDate } = require('../formation-attestation.js');

const PERSON = { name: 'Travailleur Fictif Test', employeeId: 'employee-test-only' };
const ENDPOINT = 'https://mock.invalid/attestation';
const SIGNATURE = 'data:image/png;base64,c2lnbmF0dXJlLXRlc3Q=';
const RECEIPT = 'tms_fg_receipt';
const PENDING = 'tms_fg_pending';
const SENT = 'tms_fg_sent';

function memory(seed = {}, { failWrites = false, failReads = false } = {}) {
  const values = new Map(Object.entries(seed));
  return {
    values,
    getItem(key) { if (failReads) throw new Error('storage denied'); return values.get(key) ?? null; },
    setItem(key, value) { if (failWrites) throw new Error('quota denied'); values.set(key, String(value)); },
    removeItem(key) { if (failWrites) throw new Error('storage denied'); values.delete(key); }
  };
}

function payload(extra = {}) {
  return {
    ...PERSON, lang: 'FR', date: '2026-09-04', score: '5/5 modules',
    signature: SIGNATURE, image: 'data:image/png;base64,aW1hZ2U=',
    appRating: 4, appComment: 'Commentaire fictif de test, non conservé dans le reçu.',
    ...extra
  };
}

function response(body = { ok: true, id: 'record-test-only', signature: true, image: true }, ok = true) {
  return { ok, json: async () => body };
}

function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

function setup(options = {}) {
  const storage = options.storage || memory(), calls = [];
  const fetch = (...args) => { calls.push(args); return options.fetch ? options.fetch(...args) : Promise.resolve(response()); };
  const controller = create({ storage, fetch, endpoint: ENDPOINT, online: options.online || (() => true), timeoutMs: options.timeoutMs || 1000, isCurrent: options.isCurrent });
  return { controller, storage, calls };
}

function assertNoSensitiveStorage(storage) {
  const text = JSON.stringify([...storage.values.values()]);
  assert.equal(text.includes('base64,'), false, 'neither signature nor certificate image is retained');
  assert.equal(text.includes('Commentaire fictif'), false, 'optional feedback is not copied into transfer metadata');
  assert.equal(text.includes('"signature":'), false, 'signature bytes must not be serialized');
}

test('invalid payloads never make a POST or create pending state', async t => {
  const cases = [
    ['missing name', { name: '' }],
    ['whitespace name', { name: '   ' }],
    ['missing signature', { signature: '' }],
    ['undefined signature', { signature: undefined }],
    ['non-data signature', { signature: 'signed' }],
    ['empty signature encoding', { signature: 'data:image/png;base64,' }],
    ['wrong image type', { signature: 'data:image/jpeg;base64,YQ==' }],
    ['incomplete quizzes', { score: '4/5 modules' }],
    ['missing quiz proof', { score: undefined }]
  ];
  for (const [name, invalid] of cases) {
    await t.test(name, async () => {
      const env = setup();
      const result = await env.controller.send(payload(invalid));
      assert.equal(result.ok, false);
      assert.equal(result.status, 'invalid');
      assert.equal(env.calls.length, 0);
      assert.equal(env.storage.values.size, 0);
      assert.equal(env.controller.busy(), false);
    });
  }
});

test('offline send records waiting metadata but performs no POST or automatic retry', async () => {
  let online = false;
  const env = setup({ online: () => online });
  const result = await env.controller.send(payload());
  assert.equal(result.status, 'waiting');
  assert.equal(result.ok, false);
  assert.equal(result.persisted, true);
  assert.equal(env.calls.length, 0);
  assert.equal(env.controller.status(PERSON).status, 'waiting');
  assert.equal(env.controller.busy(), false);
  assertNoSensitiveStorage(env.storage);
  online = true;
  const reloaded = setup({ storage: env.storage });
  assert.equal(reloaded.controller.status(PERSON).status, 'waiting');
  assert.equal(reloaded.calls.length, 0, 'connectivity and construction do not authorize transmission');
});

test('successful explicit send produces a durable, language-independent receipt with no signature data', async () => {
  const env = setup();
  const result = await env.controller.send(payload());
  assert.equal(env.calls.length, 1);
  const [url, request] = env.calls[0];
  assert.equal(url, ENDPOINT);
  assert.equal(request.method, 'POST');
  assert.equal(request.headers['Content-Type'], 'application/json');
  assert.equal(JSON.parse(request.body).signature, SIGNATURE);
  assert.equal(request.signal.aborted, false);
  assert.equal(result.ok, true);
  assert.equal(result.status, 'sent');
  assert.equal(result.persisted, true);
  assert.equal(result.receipt.recordId, 'record-test-only');
  assert.equal(result.receipt.signatureConfirmed, true);
  assert.equal(result.receipt.imageConfirmed, true);
  assert.equal(result.receipt.date, '2026-09-04');
  assert.ok(Number.isFinite(Date.parse(result.receipt.sentAt)));
  assert.equal(env.storage.getItem(PENDING), null);
  assertNoSensitiveStorage(env.storage);
  const reloaded = setup({ storage: env.storage });
  assert.equal(reloaded.controller.status({ ...PERSON, lang: 'EN' }).status, 'sent');
  const again = await reloaded.controller.send(payload({ lang: 'EN' }));
  assert.equal(again.status, 'sent');
  assert.equal(reloaded.calls.length, 0, 'changing language must not duplicate a certificate');
});

test('receipt identity must match both name and employee record, including an absent ID', async () => {
  const env = setup();
  await env.controller.send(payload());
  assert.equal(env.controller.status({ ...PERSON, name: 'Autre Nom Test' }).status, 'unsigned');
  assert.equal(env.controller.status({ ...PERSON, employeeId: 'another-test-id' }).status, 'unsigned');
  assert.equal(env.controller.status({ name: PERSON.name }).status, 'unsigned', 'an unidentified namesake must not inherit a linked employee receipt');
  const unlinked = setup();
  await unlinked.controller.send(payload({ employeeId: '' }));
  assert.equal(unlinked.controller.status(PERSON).status, 'unsigned', 'linking a record later requires confirming the new identity');
});

test('unconfirmed server signature is incomplete and cannot be automatically resubmitted', async t => {
  for (const signature of [false, undefined]) {
    await t.test(String(signature), async () => {
      const env = setup({ fetch: async () => response({ ok: true, id: 'partial-test', signature }) });
      const result = await env.controller.send(payload());
      assert.equal(result.ok, false);
      assert.equal(result.status, 'incomplete');
      assert.equal(result.receipt.signatureConfirmed, false);
      assert.equal(result.persisted, true);
      assert.equal(env.controller.status(PERSON).status, 'incomplete');
      assertNoSensitiveStorage(env.storage);
      const again = await env.controller.send(payload());
      assert.equal(again.ok, false);
      assert.equal(again.status, 'incomplete');
      assert.equal(env.calls.length, 1);
      const reloaded = setup({ storage: env.storage });
      assert.equal((await reloaded.controller.send(payload())).status, 'incomplete');
      assert.equal(reloaded.calls.length, 0);
    });
  }
});

test('HTTP, response-body and network failures remain uncertain, never falsely sent', async t => {
  const cases = [
    ['HTTP failure', async () => response({ ok: true, id: 'not-confirmed', signature: true }, false)],
    ['body refusal', async () => response({ ok: false, id: 'not-confirmed', signature: true })],
    ['missing body id', async () => response({ ok: true, signature: true })],
    ['empty body id', async () => response({ ok: true, id: '', signature: true })],
    ['non-string body id', async () => response({ ok: true, id: 123, signature: true })],
    ['null body', async () => response(null)],
    ['invalid JSON', async () => ({ ok: true, json: async () => { throw new Error('invalid JSON'); } })],
    ['connection lost', async () => { throw new Error('connection lost'); }]
  ];
  for (const [name, fetch] of cases) {
    await t.test(name, async () => {
      const env = setup({ fetch });
      const result = await env.controller.send(payload());
      assert.equal(result.ok, false);
      assert.equal(result.status, 'uncertain');
      assert.equal(env.controller.status(PERSON).status, 'uncertain');
      assert.equal(env.storage.getItem(RECEIPT), null);
      assert.equal(env.calls.length, 1);
      assert.equal(env.controller.busy(), false);
      assertNoSensitiveStorage(env.storage);
    });
  }
});

test('a double click has one active POST and never overwrites pending identity', async () => {
  const pending = deferred();
  const env = setup({ fetch: () => pending.promise });
  const first = env.controller.send(payload());
  assert.equal(env.controller.busy(), true);
  const second = await env.controller.send(payload({ name: 'Second Clic Test' }));
  assert.equal(second.status, 'busy');
  assert.equal(second.ok, false);
  assert.equal(env.calls.length, 1);
  assert.equal(JSON.parse(env.storage.getItem(PENDING)).name, PERSON.name);
  pending.resolve(response());
  assert.equal((await first).status, 'sent');
  assert.equal(env.controller.busy(), false);
});

test('cancel aborts the request and ignores a late response, including after a new submission', async () => {
  const oldRequest = deferred(), newRequest = deferred();
  let count = 0;
  const env = setup({ fetch: () => ++count === 1 ? oldRequest.promise : newRequest.promise });
  const first = env.controller.send(payload());
  env.controller.cancel(true);
  assert.equal(env.calls[0][1].signal.aborted, true);
  assert.equal(env.controller.busy(), false);
  assert.equal(env.storage.getItem(PENDING), null);
  const nextPerson = { name: 'Prochain Fictif Test', employeeId: 'next-test-id' };
  const second = env.controller.send(payload(nextPerson));
  const newPending = env.storage.getItem(PENDING);
  oldRequest.resolve(response({ ok: true, id: 'old-late-record', signature: true }));
  assert.equal((await first).status, 'cancelled');
  assert.equal(env.controller.busy(), true, 'old finally must not release the new request');
  assert.equal(env.storage.getItem(PENDING), newPending, 'old response must not mutate current worker state');
  assert.equal(env.storage.getItem(RECEIPT), null);
  newRequest.resolve(response({ ok: true, id: 'new-record', signature: true }));
  assert.equal((await second).status, 'sent');
  assert.equal(env.controller.status(nextPerson).recordId, 'new-record');
  assert.equal(env.controller.status(PERSON).status, 'unsigned');
});

test('cancellation while reading the response body cannot save a late receipt', async () => {
  const body = deferred();
  const env = setup({ fetch: async () => ({ ok: true, json: () => body.promise }) });
  const result = env.controller.send(payload());
  await Promise.resolve();
  env.controller.cancel(true);
  body.resolve({ ok: true, id: 'late-body', signature: true });
  assert.equal((await result).status, 'cancelled');
  assert.equal(env.storage.getItem(RECEIPT), null);
  assert.equal(env.storage.getItem(PENDING), null);
});

test('legacy sent markers are not upgraded to signed receipts or submitted again', async t => {
  for (const lang of ['FR', 'EN']) {
    await t.test(lang, async () => {
      const env = setup({ storage: memory({ [SENT]: `fg|${lang}|${PERSON.name}|2026-09-03` }) });
      const status = env.controller.status(PERSON);
      assert.equal(status.status, 'legacy');
      assert.equal(status.date, '2026-09-03');
      assert.equal(env.calls.length, 0);
      assert.equal((await env.controller.send(payload({ lang: lang === 'FR' ? 'EN' : 'FR' }))).status, 'legacy');
      assert.equal(env.calls.length, 0);
      assert.equal(env.storage.getItem(RECEIPT), null);
    });
  }
});

test('old pending markers, corrupt storage and persisted waiting state never trigger automatic POST', () => {
  for (const marker of [`fg|FR|${PERSON.name}|2026-09-03`, 'not-json', JSON.stringify({ version: 1, ...PERSON, status: 'waiting' })]) {
    const env = setup({ storage: memory({ [PENDING]: marker }) });
    assert.ok(['unsigned', 'waiting'].includes(env.controller.status(PERSON).status));
    assert.equal(env.calls.length, 0);
    assert.equal(env.controller.busy(), false);
  }
  const denied = setup({ storage: memory({}, { failReads: true }) });
  assert.equal(denied.controller.status(PERSON).status, 'unsigned');
  assert.equal(denied.calls.length, 0);
});

test('storage failure is reported for offline and server-confirmed outcomes', async () => {
  const offline = setup({ storage: memory({}, { failWrites: true }), online: () => false });
  const wait = await offline.controller.send(payload());
  assert.equal(wait.status, 'waiting');
  assert.equal(wait.persisted, false);
  assert.equal(offline.calls.length, 0);
  const online = setup({ storage: memory({}, { failWrites: true }) });
  const result = await online.controller.send(payload());
  assert.equal(result.status, 'sent');
  assert.equal(result.ok, true, 'storage failure must not deny a confirmed server recording');
  assert.equal(result.persisted, false, 'the UI must know to offer a copy while this page remains open');
  assert.equal(result.receipt.recordId, 'record-test-only');
  assert.equal(online.storage.values.size, 0);
});

test('uncertain transfer also reports when its retry status could not be persisted', async () => {
  const env = setup({ storage: memory({}, { failWrites: true }), fetch: async () => { throw new Error('connection lost'); } });
  const result = await env.controller.send(payload());
  assert.equal(result.status, 'uncertain');
  assert.equal(result.persisted, false, 'a failed status write must not silently lose the only retry warning');
  assert.equal(env.calls.length, 1);
});

test('storage failure after the initial waiting write reports an unpersisted uncertainty warning', async () => {
  const storage = memory();
  const originalWrite = storage.setItem.bind(storage);
  let writes = 0;
  storage.setItem = (key, value) => {
    if (++writes > 1) throw new Error('storage quota changed');
    originalWrite(key, value);
  };
  const env = setup({ storage, fetch: async () => { throw new Error('lost response'); } });
  const result = await env.controller.send(payload());
  assert.equal(result.status, 'uncertain');
  assert.equal(result.persisted, false, 'saving waiting before POST is not proof that uncertain after POST was saved');
  assert.equal(env.controller.status(PERSON).status, 'uncertain');
});

test('in-memory sent and incomplete receipts prevent duplicates even when storage is unavailable', async t => {
  for (const signature of [true, false]) {
    await t.test(String(signature), async () => {
      const env = setup({ storage: memory({}, { failWrites: true }), fetch: async () => response({ ok: true, id: 'memory-test', signature }) });
      const expected = signature ? 'sent' : 'incomplete';
      assert.equal((await env.controller.send(payload())).persisted, false);
      assert.equal(env.controller.status(PERSON).status, expected);
      assert.equal((await env.controller.send(payload())).status, expected);
      assert.equal(env.calls.length, 1);
      env.controller.cancel(true);
      assert.equal(env.controller.status(PERSON).status, 'unsigned');
    });
  }
});

test('an obsolete or unreadable current identity prevents any POST or pending write', async t => {
  for (const [name, isCurrent] of [['changed', () => false], ['unreadable', () => { throw new Error('identity unavailable'); }]]) {
    await t.test(name, async () => {
      const env = setup({ isCurrent });
      const result = await env.controller.send(payload());
      assert.equal(result.status, 'cancelled');
      assert.equal(env.calls.length, 0);
      assert.equal(env.storage.values.size, 0);
    });
  }
});

test('a late response cannot create a receipt if the identity changed without its event arriving yet', async () => {
  let current = true;
  const pending = deferred();
  const env = setup({ isCurrent: person => current && person.employeeId === PERSON.employeeId, fetch: () => pending.promise });
  const result = env.controller.send(payload());
  current = false;
  pending.resolve(response());
  assert.equal((await result).status, 'cancelled');
  assert.equal(env.storage.getItem(RECEIPT), null);
  assert.equal(env.controller.busy(), false);
});

test('a receipt saved by another tab supersedes this tab’s old waiting state and prevents a duplicate POST', async () => {
  const shared = memory();
  let online = false;
  const first = setup({ storage: shared, online: () => online });
  const second = setup({ storage: shared });
  assert.equal((await first.controller.send(payload())).status, 'waiting');
  assert.equal(first.controller.status(PERSON).status, 'waiting');
  assert.equal((await second.controller.send(payload())).status, 'sent');
  online = true;
  assert.equal(first.controller.status(PERSON).status, 'sent');
  assert.equal((await first.controller.send(payload())).status, 'sent');
  assert.equal(first.calls.length, 0);
  assert.equal(second.calls.length, 1);
});

test('timeout aborts transport and leaves an uncertain, retry-only-on-explicit-action state', async () => {
  const env = setup({ timeoutMs: 5, fetch: (_url, request) => new Promise((_resolve, reject) => {
    request.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  }) });
  const result = await env.controller.send(payload());
  assert.equal(result.status, 'uncertain');
  assert.equal(result.ok, false);
  assert.equal(env.calls[0][1].signal.aborted, true);
  assert.equal(env.controller.busy(), false);
  assert.equal(env.controller.status(PERSON).status, 'uncertain');
  assert.equal(env.storage.getItem(RECEIPT), null);
});

test('a transport that resolves after timeout cannot turn an aborted transfer into a receipt', async () => {
  const env = setup({ timeoutMs: 5, fetch: (_url, request) => new Promise(resolve => {
    request.signal.addEventListener('abort', () => resolve(response()), { once: true });
  }) });
  const result = await env.controller.send(payload());
  assert.equal(result.status, 'uncertain');
  assert.equal(result.ok, false);
  assert.equal(env.storage.getItem(RECEIPT), null);
  assert.equal(env.controller.busy(), false);
});

test('cancel(true) clears local sent, pending and receipt metadata, not other training state', async () => {
  const env = setup({ storage: memory({ tms_form_progress: '[1,2,3,4,5]', [SENT]: 'legacy-test' }) });
  await env.controller.send(payload());
  env.controller.cancel(true);
  for (const key of [SENT, PENDING, RECEIPT]) assert.equal(env.storage.getItem(key), null);
  assert.equal(env.storage.getItem('tms_form_progress'), '[1,2,3,4,5]');
});

test('local date represents the device calendar, including local midnight boundaries', () => {
  assert.equal(localDate(new Date(2026, 8, 4, 0, 1)), '2026-09-04');
  assert.equal(localDate(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
});
