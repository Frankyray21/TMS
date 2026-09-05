/* Transmission explicite des attestations. Aucun envoi au chargement, aucune
   signature conservée dans localStorage. Le reçu appartient à une identité.
   Un échec réseau peut survenir après enregistrement côté serveur : sa reprise
   reste volontaire, car l'API existante ne garantit pas l'idempotence. */
(function (root) {
  'use strict';
  var RECEIPT = 'tms_fg_receipt', PENDING = 'tms_fg_pending', SENT = 'tms_fg_sent';
  function localDate(date) {
    var d = date || new Date();
    return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  }
  function identity(value) {
    return { name: String(value.name || '').trim(), employeeId: String(value.employeeId || '').trim() };
  }
  function same(a, b) {
    return !!a && !!b && a.name === b.name && (a.employeeId || '') === (b.employeeId || '');
  }
  function create(options) {
    var storage = options.storage, fetcher = options.fetch, active = null, revision = 0, memory = null;
    function current(person) { try { return !options.isCurrent || options.isCurrent(person); } catch (_) { return false; } }
    function read(key) { try { return JSON.parse(storage.getItem(key) || 'null'); } catch (_) { return null; } }
    function write(key, value) { try { storage.setItem(key, JSON.stringify(value)); return true; } catch (_) { return false; } }
    function remove(key) { try { storage.removeItem(key); } catch (_) {} }
    function status(person) {
      person = identity(person);
      var receipt = read(RECEIPT), pending = read(PENDING);
      if (receipt && receipt.version === 1 && same(receipt, person) &&
          ['sent', 'incomplete'].indexOf(receipt.status) !== -1 && typeof receipt.recordId === 'string' && receipt.recordId) return receipt;
      if (memory && same(memory, person)) return memory;
      if (pending && pending.version === 1 && same(pending, person) && ['waiting', 'uncertain'].indexOf(pending.status) !== -1) return pending;
      // Ancienne preuve locale : son horodatage exact et l'état de la signature
      // ne sont pas connus. Ne jamais la transformer en nouveau reçu complet.
      try {
        var old = storage.getItem(SENT) || '';
        if (/^fg\|(FR|EN)\|/.test(old)) {
          var tail = old.slice(6), date = tail.slice(-10), name = tail.slice(0, -11);
          if (name === person.name && /^\d{4}-\d{2}-\d{2}$/.test(date)) return { status: 'legacy', name: name, date: date };
        }
        if (storage.getItem(PENDING)) return { status: 'unsigned', name: person.name };
      } catch (_) {}
      return { status: 'unsigned', name: person.name };
    }
    function cancel(clear) {
      revision++;
      memory = null;
      if (active) { active.abort.abort(); active = null; }
      if (clear) { remove(PENDING); remove(RECEIPT); remove(SENT); }
    }
    async function send(payload) {
      var person = identity(payload);
      if (!current(person)) return { ok: false, status: 'cancelled' };
      if (active) return { ok: false, status: 'busy' };
      if (!person.name || payload.score !== '5/5 modules' || !/^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(payload.signature || '')) return { ok: false, status: 'invalid' };
      var previous = status(person);
      if (['sent', 'incomplete', 'legacy'].indexOf(previous.status) !== -1) return { ok: previous.status !== 'incomplete', status: previous.status, receipt: previous };
      var pending = { version: 1, status: 'waiting', name: person.name, employeeId: person.employeeId,
        date: payload.date || localDate(), attemptedAt: new Date().toISOString() };
      memory = pending;
      var saved = write(PENDING, pending);
      if (options.online && !options.online()) return { ok: false, status: 'waiting', persisted: saved };
      var token = ++revision, abort = new AbortController();
      active = { abort: abort };
      var timer = setTimeout(function () { abort.abort(); }, options.timeoutMs || 20000);
      // Dès que le POST part, une réponse perdue rend le résultat incertain.
      pending.status = 'uncertain'; saved = write(PENDING, pending);
      try {
        var response = await fetcher(options.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload), signal: abort.signal });
        var body = await response.json();
        if (token !== revision || !current(person)) return { ok: false, status: 'cancelled' };
        if (abort.signal.aborted || !response.ok || !body || body.ok !== true || typeof body.id !== 'string' || !body.id) return { ok: false, status: 'uncertain', persisted: saved };
        var receipt = { version: 1, status: body.signature === true ? 'sent' : 'incomplete',
          name: person.name, employeeId: person.employeeId, date: pending.date, sentAt: new Date().toISOString(),
          recordId: body.id, signatureConfirmed: body.signature === true, imageConfirmed: body.image === true };
        memory = receipt;
        saved = write(RECEIPT, receipt);
        if (saved) remove(PENDING);
        return { ok: receipt.status === 'sent', status: receipt.status, receipt: receipt, persisted: saved };
      } catch (_) {
        return { ok: false, status: token !== revision || !current(person) ? 'cancelled' : 'uncertain', persisted: saved };
      } finally {
        clearTimeout(timer);
        if (token === revision) active = null;
      }
    }
    return { status: status, send: send, cancel: cancel, busy: function () { return !!active; } };
  }
  root.TMSAttestation = { create: create, localDate: localDate };
  if (typeof module === 'object' && module.exports) module.exports = root.TMSAttestation;
})(typeof window === 'object' ? window : globalThis);
