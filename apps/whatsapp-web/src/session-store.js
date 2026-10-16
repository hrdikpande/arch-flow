'use strict';

/**
 * RemoteAuth store for whatsapp-web.js. The session zip is encrypted before it is written to
 * Supabase, in the `whatsapp_sessions` table. RLS is enabled on that table with no policies, so
 * only the service role can read it. The session never sits in a shared folder.
 *
 * `repository` is { get(id), put(id, row), remove(id) }. The Supabase repository is below;
 * tests use an in-memory one.
 */

const fs = require('node:fs/promises');
const { encryptBytes, decryptBytes } = require('./crypto');

function createSessionStore({ repository, sessionKey }) {
  return {
    async sessionExists({ session }) {
      return (await repository.get(session)) !== null;
    },
    async save({ session, zipPath }) {
      const bytes = await fs.readFile(zipPath);
      const record = encryptBytes(bytes, sessionKey);
      await repository.put(session, { ...record, updated_at: new Date().toISOString() });
    },
    async extract({ session, path }) {
      const row = await repository.get(session);
      if (!row) throw new Error('No stored WhatsApp session to extract');
      const bytes = decryptBytes(row, sessionKey);
      await fs.writeFile(path, bytes, { mode: 0o600 });
    },
    async delete({ session }) {
      await repository.remove(session);
    },
  };
}

function createSupabaseRepository(db, table = 'whatsapp_sessions') {
  return {
    async get(id) {
      const { data, error } = await db.from(table).select('ciphertext, iv, tag').eq('id', id).maybeSingle();
      if (error) throw new Error(`Could not read the WhatsApp session: ${error.message}`);
      return data ?? null;
    },
    async put(id, row) {
      const { error } = await db.from(table).upsert({ id, ...row });
      if (error) throw new Error(`Could not save the WhatsApp session: ${error.message}`);
    },
    async remove(id) {
      const { error } = await db.from(table).delete().eq('id', id);
      if (error) throw new Error(`Could not delete the WhatsApp session: ${error.message}`);
    },
  };
}

module.exports = { createSessionStore, createSupabaseRepository };
