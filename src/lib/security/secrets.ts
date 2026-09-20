import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const MAX_SECRET_BYTES = 32_768;
type Keyring = { active: string; keys: Record<string, string> };

/**
 * Missing or malformed keyring env vars: a deployment fault, not operator error.
 * Carries a `code` so serverError() can answer 503 `credentialConfig` instead of
 * a blank 500, which is otherwise indistinguishable from a database failure.
 */
export class CredentialConfigError extends Error {
  readonly code = "CREDENTIAL_CONFIG";
  constructor() {
    super("Credential encryption configuration is invalid");
    this.name = "CredentialConfigError";
  }
}

function keyring(): Keyring {
  try {
    const keys = JSON.parse(process.env.CREDENTIAL_ENCRYPTION_KEYS ?? "{}");
    const active = process.env.CREDENTIAL_ACTIVE_KEY_ID ?? "";
    if (!/^[a-zA-Z0-9_-]{1,32}$/.test(active) || !keys[active]) throw new Error();
    for (const [id, key] of Object.entries(keys)) {
      if (!/^[a-zA-Z0-9_-]{1,32}$/.test(id) || typeof key !== "string" ||
          !/^[A-Za-z0-9+/]{43}=$/.test(key) || Buffer.from(key, "base64").length !== 32) throw new Error();
    }
    return { active, keys };
  } catch { throw new CredentialConfigError(); }
}

export function validateEncryptionConfiguration(): void { keyring(); }

/** True when the keyring is usable, so callers can degrade instead of throwing. */
export function isEncryptionConfigured(): boolean {
  try { keyring(); return true; } catch { return false; }
}

/** AAD binds ciphertext to the owning row; moving a ciphertext cannot move a secret. */
export function encryptSecret(value: unknown, context: string): string {
  const { active, keys } = keyring();
  const bytes = Buffer.from(JSON.stringify(value));
  if (bytes.length > MAX_SECRET_BYTES) throw new Error("Credential payload exceeds limit");
  const nonce = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(keys[active], "base64"), nonce);
  cipher.setAAD(Buffer.from(`growthlab:v1:${active}:${context}`));
  const encrypted = Buffer.concat([cipher.update(bytes), cipher.final()]);
  return ["v1", active, nonce.toString("base64url"), cipher.getAuthTag().toString("base64url"), encrypted.toString("base64url")].join(".");
}

/** Used by the audited admin reveal endpoint and controlled repair/rotation. */
export function decryptSecret(ciphertext: string, context: string): unknown {
  try {
    if (ciphertext.length > MAX_SECRET_BYTES * 2) throw new Error();
    const [version, id, nonce, tag, data, extra] = ciphertext.split(".");
    const { keys } = keyring();
    if (version !== "v1" || extra !== undefined || !keys[id] ||
        ![nonce, tag, data].every((part) => typeof part === "string" && /^[A-Za-z0-9_-]+$/.test(part))) throw new Error();
    const iv = Buffer.from(nonce, "base64url");
    const authTag = Buffer.from(tag, "base64url");
    if (iv.length !== 12 || authTag.length !== 16) throw new Error();
    const decipher = createDecipheriv("aes-256-gcm", Buffer.from(keys[id], "base64"), iv);
    decipher.setAAD(Buffer.from(`growthlab:v1:${id}:${context}`));
    decipher.setAuthTag(authTag);
    return JSON.parse(Buffer.concat([decipher.update(Buffer.from(data, "base64url")), decipher.final()]).toString());
  } catch { throw new Error("Credential decryption failed"); }
}
