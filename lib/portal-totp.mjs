import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";

const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const maxFailures = 5;
const retryWindowMs = 15 * 60_000;
const enrollmentMs = 5 * 60_000;
export const portalProofCookie = "semantic_cx_totp_proof";

export function portalTotpPreview(env = process.env) {
  if (env.PORTAL_TOTP_PREVIEW !== "1" || env.FIREBASE_PROJECT_ID === "simosa-sentiment-analysis") return false;
  if (env.VERCEL === "1") return env.VERCEL_ENV === "preview";
  try {
    return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(env.APP_BASE_URL).hostname);
  } catch {
    return false;
  }
}

export function isPortalTotpAccount(account, env = process.env) {
  if (portalTotpPreview(env)) return account.customClaims?.portal_totp_preview === true;
  return Boolean(env.PORTAL_TOTP_PILOT_EMAIL && account.email?.toLowerCase() === env.PORTAL_TOTP_PILOT_EMAIL &&
    env.VERCEL === "1" && env.VERCEL_ENV === "production" && env.FIREBASE_PROJECT_ID === "simosa-sentiment-analysis");
}

export function validPilotActivation(value, hash) {
  if (typeof value !== "string" || !/^[a-f0-9]{32}$/.test(value) || !/^[a-f0-9]{64}$/.test(hash ?? "")) return false;
  return timingSafeEqual(createHash("sha256").update(value).digest(), Buffer.from(hash, "hex"));
}

function keyFor(masterKey, purpose) {
  if (!/^[0-9a-f]{64}$/i.test(masterKey ?? "")) throw new Error("Preview authenticator key is not configured");
  return createHmac("sha256", Buffer.from(masterKey, "hex")).update(purpose).digest();
}

function base32(bytes) {
  let bits = 0;
  let value = 0;
  let encoded = "";
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      encoded += alphabet[(value >>> bits) & 31];
    }
  }
  return bits ? encoded + alphabet[(value << (5 - bits)) & 31] : encoded;
}

export function authenticatorCode(secret, counter, digits = 6) {
  const bytes = Buffer.alloc(8);
  bytes.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(bytes).digest();
  return String((mac.readUInt32BE(mac.at(-1) & 15) & 0x7fffffff) % (10 ** digits)).padStart(digits, "0");
}

function encrypt(masterKey, uid, id, secret) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", keyFor(masterKey, "totp-encryption-v1"), iv);
  cipher.setAAD(Buffer.from(JSON.stringify([uid, id])));
  const encrypted = Buffer.concat([cipher.update(secret), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map(value => value.toString("base64url")).join(".");
}

function decrypt(masterKey, uid, factor) {
  const [iv, tag, ciphertext] = factor.encrypted.split(".").map(value => Buffer.from(value, "base64url"));
  const cipher = createDecipheriv("aes-256-gcm", keyFor(masterKey, "totp-encryption-v1"), iv);
  cipher.setAAD(Buffer.from(JSON.stringify([uid, factor.id])));
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(ciphertext), cipher.final()]);
}

export function portalProof(masterKey, uid, factorId, sessionCookie) {
  return createHmac("sha256", keyFor(masterKey, "totp-session-v1"))
    .update(JSON.stringify([uid, factorId, sessionCookie])).digest("base64url");
}

export function matchesPortalProof(masterKey, uid, factorId, sessionCookie, proof) {
  if (!factorId || typeof proof !== "string" || !/^[\w-]{43}$/.test(proof)) return false;
  return timingSafeEqual(Buffer.from(proof), Buffer.from(portalProof(masterKey, uid, factorId, sessionCookie)));
}

// Persist state and its response in a single transaction. Only a successful code activates an enrollment.
export function transitionPortalTotp(state, { uid, authTime, code, now, masterKey, canRevealSetup = true }) {
  const attempts = state.attempts?.until > now ? state.attempts : { count: 0, until: now + retryWindowMs };
  if (attempts.count >= maxFailures) return { status: 429 };

  const pending = state.pending?.authTime === authTime && state.pending?.expires > now ? state.pending : null;
  const factor = state.factor ?? pending;
  if (code === undefined) {
    if (state.factor) return { status: 202 };
    if (!canRevealSetup) return { status: 428 };
    if (pending) return { status: 201, setupKey: base32(decrypt(masterKey, uid, pending)) };
    const secret = randomBytes(20);
    const id = randomUUID();
    return {
      status: 201, setupKey: base32(secret),
      state: { ...state, pending: { id, authTime, expires: now + enrollmentMs, encrypted: encrypt(masterKey, uid, id, secret) } },
    };
  }
  if (!factor) return { status: 409 };

  const secret = decrypt(masterKey, uid, factor);
  const current = Math.floor(now / 30_000);
  const matched = [current, current - 1, current + 1].find(counter =>
    counter > (state.lastCounter ?? -1) &&
    timingSafeEqual(Buffer.from(code), Buffer.from(authenticatorCode(secret, counter))));
  if (matched === undefined) {
    const count = attempts.count + 1;
    return { status: count >= maxFailures ? 429 : 422, state: { ...state, attempts: { ...attempts, count } } };
  }

  return {
    status: 204, factorId: factor.id,
    state: { factor: { id: factor.id, encrypted: factor.encrypted }, lastCounter: matched },
  };
}
