import assert from "node:assert/strict";
import { test } from "node:test";
import {
  authenticatorCode, isPortalTotpAccount, matchesPortalProof, portalProof, portalTotpPreview, transitionPortalTotp,
} from "../lib/portal-totp.mjs";

const masterKey = "5b".repeat(32);
const now = 1_800_000_000_000;
const subject = { uid: "preview-user", authTime: now / 1000, now, masterKey };

function decodeBase32(value) {
  const bits = [...value].map(char => "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567".indexOf(char).toString(2).padStart(5, "0")).join("");
  return Buffer.from(bits.match(/.{8}/g).map(byte => parseInt(byte, 2)));
}

test("authenticator code matches the RFC 6238 SHA-1 example", () => {
  assert.equal(authenticatorCode(Buffer.from("12345678901234567890"), 1, 8), "94287082");
});

test("enrollment persists through later logins, never shows its key again, and rejects a reused code", () => {
  const enrollment = transitionPortalTotp({}, subject);
  const secret = decodeBase32(enrollment.setupKey);
  assert.equal(enrollment.status, 201);
  assert.ok(!JSON.stringify(enrollment.state).includes(enrollment.setupKey));
  assert.equal(transitionPortalTotp(enrollment.state, subject).setupKey, enrollment.setupKey);
  const code = authenticatorCode(secret, now / 30_000);
  const accepted = transitionPortalTotp(enrollment.state, { ...subject, code });
  assert.equal(accepted.status, 204);
  assert.equal(accepted.state.pending, undefined);
  assert.equal(transitionPortalTotp(accepted.state, { ...subject, code }).status, 422);
  const later = { ...subject, now: now + 30_000, authTime: subject.authTime + 30 };
  assert.deepEqual(transitionPortalTotp(accepted.state, later), { status: 202 });
  assert.equal(transitionPortalTotp(accepted.state, {
    ...later, code: authenticatorCode(secret, later.now / 30_000),
  }).factorId, accepted.factorId);
});

test("attempt throttling persists across sign-ins and preview proofs are session- and factor-bound", () => {
  const pending = transitionPortalTotp({}, subject);
  const secret = decodeBase32(pending.setupKey);
  const counter = now / 30_000;
  const nearby = [counter - 1, counter, counter + 1].map(value => authenticatorCode(secret, value));
  const wrongCode = ["000000", "111111", "222222", "333333"].find(code => !nearby.includes(code));
  let state = pending.state;
  for (let index = 0; index < 5; index++) {
    const response = transitionPortalTotp(state, { ...subject, code: wrongCode });
    assert.equal(response.status, index === 4 ? 429 : 422);
    state = response.state;
  }
  assert.equal(transitionPortalTotp(state, { ...subject, authTime: subject.authTime + 1 }).status, 429);
  const proof = portalProof(masterKey, "uid", "factor", "cookie");
  assert.equal(matchesPortalProof(masterKey, "uid", "factor", "cookie", proof), true);
  assert.equal(matchesPortalProof(masterKey, "uid", "factor", "other", proof), false);
  assert.equal(matchesPortalProof(masterKey, "uid", "different", "cookie", proof), false);
});

test("the preview is excluded from Vercel Production and the live Firebase project", () => {
  const preview = { PORTAL_TOTP_PREVIEW: "1", VERCEL: "1", VERCEL_ENV: "preview", FIREBASE_PROJECT_ID: "preview-project" };
  assert.equal(portalTotpPreview(preview), true);
  assert.equal(portalTotpPreview({ ...preview, VERCEL_ENV: "production" }), false);
  assert.equal(portalTotpPreview({ ...preview, FIREBASE_PROJECT_ID: "simosa-sentiment-analysis" }), false);
  assert.equal(portalTotpPreview({ PORTAL_TOTP_PREVIEW: "1", APP_BASE_URL: "http://127.0.0.1:3919" }), true);
});

test("production enrollment starts directly for the single approved pilot account", () => {
  const env = { VERCEL: "1", VERCEL_ENV: "production", FIREBASE_PROJECT_ID: "simosa-sentiment-analysis", PORTAL_TOTP_PILOT_EMAIL: "tester@jazz.com.pk" };
  assert.equal(isPortalTotpAccount({ email: "Tester@jazz.com.pk" }, env), true);
  assert.equal(isPortalTotpAccount({ email: "other@jazz.com.pk" }, env), false);
  assert.equal(isPortalTotpAccount({ email: "tester@jazz.com.pk" }, { ...env, VERCEL_ENV: "preview" }), false);
  const setup = transitionPortalTotp({}, subject);
  assert.equal(setup.status, 201);
  assert.match(setup.setupKey, /^[A-Z2-7]{32}$/);
});
