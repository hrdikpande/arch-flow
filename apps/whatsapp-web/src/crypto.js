'use strict';

/**
 * AES-256-GCM for the stored WhatsApp session. The key comes from WA_SESSION_KEY (32 random bytes,
 * base64). Without the key the stored session is unreadable, and any change to the stored
 * ciphertext makes decryption fail instead of returning damaged data.
 */

const crypto = require('node:crypto');

const ALGORITHM = 'aes-256-gcm';

function parseKey(keyBase64) {
  if (!keyBase64) throw new Error('WA_SESSION_KEY is not set. Generate one with: openssl rand -base64 32');
  const key = Buffer.from(keyBase64, 'base64');
  if (key.length !== 32) throw new Error('WA_SESSION_KEY must decode to exactly 32 bytes');
  return key;
}

function encryptBytes(plain, keyBase64) {
  const key = parseKey(keyBase64);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([cipher.update(plain), cipher.final()]);
  return {
    ciphertext: ciphertext.toString('base64'),
    iv: iv.toString('base64'),
    tag: cipher.getAuthTag().toString('base64'),
  };
}

function decryptBytes(record, keyBase64) {
  const key = parseKey(keyBase64);
  const decipher = crypto.createDecipheriv(ALGORITHM, key, Buffer.from(record.iv, 'base64'));
  decipher.setAuthTag(Buffer.from(record.tag, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(record.ciphertext, 'base64')), decipher.final()]);
}

module.exports = { encryptBytes, decryptBytes, parseKey };
