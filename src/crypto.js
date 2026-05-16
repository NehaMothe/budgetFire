/**
 * AES-256-GCM encryption using the browser's built-in Web Crypto API.
 * No external dependencies. All investment data in localStorage is encrypted.
 *
 * Flow:
 *   password → PBKDF2 → 256-bit AES-GCM key → encrypt/decrypt JSON
 *
 * Storage format (base64):  salt(16) + iv(12) + ciphertext
 */

const ITERATIONS = 200_000;
const KEY_USAGE  = ["encrypt", "decrypt"];

// ── derive a CryptoKey from a password + salt ─────────────────────────────────
async function deriveKey(password, salt) {
  const enc     = new TextEncoder();
  const keyMat  = await crypto.subtle.importKey(
    "raw", enc.encode(password), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: ITERATIONS, hash: "SHA-256" },
    keyMat,
    { name: "AES-GCM", length: 256 },
    false,
    KEY_USAGE
  );
}

// ── helpers ───────────────────────────────────────────────────────────────────
function toBase64(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function fromBase64(str) {
  return Uint8Array.from(atob(str), c => c.charCodeAt(0));
}

// ── encrypt: returns a single base64 string ───────────────────────────────────
export async function encrypt(plaintext, password) {
  const enc  = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv   = crypto.getRandomValues(new Uint8Array(12));
  const key  = await deriveKey(password, salt);

  const cipher = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    enc.encode(plaintext)
  );

  // pack: salt(16) + iv(12) + ciphertext
  const packed = new Uint8Array(16 + 12 + cipher.byteLength);
  packed.set(salt,              0);
  packed.set(iv,               16);
  packed.set(new Uint8Array(cipher), 28);
  return toBase64(packed.buffer);
}

// ── decrypt: returns plaintext string or throws on wrong password ─────────────
export async function decrypt(encoded, password) {
  const packed = fromBase64(encoded);
  const salt   = packed.slice(0,  16);
  const iv     = packed.slice(16, 28);
  const cipher = packed.slice(28);
  const key    = await deriveKey(password, salt);

  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    cipher
  );
  return new TextDecoder().decode(plain);
}

// ── encrypted localStorage wrapper ───────────────────────────────────────────
const LS_KEY = "bf_neha_enc_v1";

export async function saveEncrypted(data, password) {
  const json      = JSON.stringify(data);
  const encrypted = await encrypt(json, password);
  localStorage.setItem(LS_KEY, encrypted);
}

export async function loadEncrypted(password) {
  const stored = localStorage.getItem(LS_KEY);
  if (!stored) return null;
  const json = await decrypt(stored, password);
  return JSON.parse(json);
}

export function hasStoredData() {
  return !!localStorage.getItem(LS_KEY);
}

export function clearStoredData() {
  localStorage.removeItem(LS_KEY);
}
