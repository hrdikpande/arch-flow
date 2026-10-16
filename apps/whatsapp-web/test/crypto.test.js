'use strict';

const { test } = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const { encryptBytes, decryptBytes } = require('../src/crypto');
const { createSessionStore } = require('../src/session-store');

const KEY = crypto.randomBytes(32).toString('base64');

test('encrypt then decrypt returns the original bytes', () => {
  const plain = crypto.randomBytes(4096);
  const record = encryptBytes(plain, KEY);
  assert.notDeepEqual(Buffer.from(record.ciphertext, 'base64'), plain);
  assert.deepEqual(decryptBytes(record, KEY), plain);
});

test('a tampered ciphertext is rejected, not returned damaged', () => {
  const record = encryptBytes(Buffer.from('session data'), KEY);
  const bytes = Buffer.from(record.ciphertext, 'base64');
  bytes[0] ^= 0xff;
  assert.throws(() => decryptBytes({ ...record, ciphertext: bytes.toString('base64') }, KEY));
});

test('a wrong key is rejected', () => {
  const record = encryptBytes(Buffer.from('session data'), KEY);
  assert.throws(() => decryptBytes(record, crypto.randomBytes(32).toString('base64')));
});

test('a key that is not 32 bytes is refused', () => {
  assert.throws(() => encryptBytes(Buffer.from('x'), crypto.randomBytes(16).toString('base64')), /32 bytes/);
  assert.throws(() => encryptBytes(Buffer.from('x'), undefined), /WA_SESSION_KEY is not set/);
});

test('session store round trip through an in-memory repository, zip written with private mode', async () => {
  const fs = require('node:fs/promises');
  const os = require('node:os');
  const path = require('node:path');
  const rows = new Map();
  const repository = {
    get: async (id) => rows.get(id) ?? null,
    put: async (id, row) => rows.set(id, row),
    remove: async (id) => rows.delete(id),
  };
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), 'wa-test-'));
  const zipIn = path.join(dir, 'in.zip');
  const zipOut = path.join(dir, 'out.zip');
  const payload = crypto.randomBytes(1024);
  await fs.writeFile(zipIn, payload);

  const store = createSessionStore({ repository, sessionKey: KEY });
  assert.equal(await store.sessionExists({ session: 's1' }), false);
  await store.save({ session: 's1', zipPath: zipIn });
  assert.equal(await store.sessionExists({ session: 's1' }), true);
  assert.ok(!JSON.stringify([...rows.values()]).includes(payload.toString('base64').slice(0, 40)));

  await store.extract({ session: 's1', path: zipOut });
  assert.deepEqual(await fs.readFile(zipOut), payload);
  assert.equal((await fs.stat(zipOut)).mode & 0o077, 0);

  await store.delete({ session: 's1' });
  assert.equal(await store.sessionExists({ session: 's1' }), false);
  await fs.rm(dir, { recursive: true, force: true });
});
