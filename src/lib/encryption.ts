// Simple encryption using AES-GCM with a server-side key.
// For production, consider using Supabase Vault or a dedicated KMS.

const ALGORITHM = "AES-GCM";
const KEY_LENGTH = 256;

function getEncryptionKey(): string {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) {
    throw new Error("ENCRYPTION_KEY environment variable is not set");
  }
  return key;
}

async function deriveKey(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(password),
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: encoder.encode("aissistant-writer-salt"),
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ["encrypt", "decrypt"]
  );
}

export async function encryptApiKey(plaintext: string): Promise<string> {
  const key = await deriveKey(getEncryptionKey());
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoder = new TextEncoder();
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    encoder.encode(plaintext)
  );
  // Combine IV + ciphertext and encode as base64
  const combined = new Uint8Array(iv.length + new Uint8Array(encrypted).length);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decryptApiKey(ciphertext: string): Promise<string> {
  const key = await deriveKey(getEncryptionKey());
  const combined = new Uint8Array(
    atob(ciphertext)
      .split("")
      .map((c) => c.charCodeAt(0))
  );
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  const decrypted = await crypto.subtle.decrypt(
    { name: ALGORITHM, iv },
    key,
    data
  );
  return new TextDecoder().decode(decrypted);
}
