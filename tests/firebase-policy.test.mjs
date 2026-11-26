import assert from "node:assert/strict";
import { test } from "node:test";
import { canAccessDashboard } from "../lib/dashboard-access.mjs";
import { hasCurrentAuthenticator, isApprovedFirebaseSignIn } from "../lib/firebase-policy.mjs";

test("Firebase password sign-in requires a matching Jazz approval claim and independently verified address", () => {
  const claims = {
    email: "test@JAZZ.COM.PK",
    email_verified: true,
    simosa_email: "test@jazz.com.pk",
    firebase: { sign_in_provider: "password" },
  };
  assert.equal(isApprovedFirebaseSignIn(claims), true);
  assert.equal(isApprovedFirebaseSignIn({ ...claims, email_verified: false }), false);
  assert.equal(isApprovedFirebaseSignIn({ ...claims, simosa_email: undefined }), false);
  assert.equal(isApprovedFirebaseSignIn({ ...claims, email: "different@jazz.com.pk" }), false);
  assert.equal(isApprovedFirebaseSignIn({ ...claims, email: "test@jazz.com.pk.example.org" }), false);
  assert.equal(isApprovedFirebaseSignIn({ ...claims, firebase: { sign_in_provider: "custom" } }), false);
  assert.equal(isApprovedFirebaseSignIn(null), false);
});

test("dashboard sessions require a Firebase TOTP sign-in with an enrolled authenticator", () => {
  const account = { multiFactor: { enrolledFactors: [{ factorId: "totp", uid: "enrollment-1" }] } };
  const claims = { firebase: { sign_in_second_factor: "totp", second_factor_identifier: "enrollment-1" } };
  assert.equal(hasCurrentAuthenticator(account, claims), true);
  assert.equal(hasCurrentAuthenticator(account, { firebase: { sign_in_provider: "password" } }), false);
  assert.equal(hasCurrentAuthenticator(account, { firebase: { ...claims.firebase, sign_in_second_factor: "phone" } }), false);
  assert.equal(hasCurrentAuthenticator(account, { firebase: { ...claims.firebase, second_factor_identifier: "removed" } }), false);
  assert.equal(hasCurrentAuthenticator({}, claims), false);
});

test("dashboard access preserves SIMOSA-only legacy grants and honors explicit assignments", () => {
  const legacy = { simosa_email: "test@jazz.com.pk" };
  assert.equal(canAccessDashboard(legacy, "simosa"), true);
  assert.equal(canAccessDashboard({ ...legacy, cx_dashboards: ["simosa"] }, "simosa"), true);
  assert.equal(canAccessDashboard({ ...legacy, cx_dashboards: "*" }, "simosa"), true);
  assert.equal(canAccessDashboard({ ...legacy, cx_dashboards: "*" }, "unregistered"), false);
  assert.equal(canAccessDashboard({ ...legacy, cx_dashboards: ["*"] }, "simosa"), false);
  assert.equal(canAccessDashboard({ ...legacy, cx_dashboards: "simosa" }, "simosa"), false);
  assert.equal(canAccessDashboard({ ...legacy, cx_dashboards: [] }, "simosa"), false);
  assert.equal(canAccessDashboard({ ...legacy, cx_dashboards: null }, "simosa"), false);
  assert.equal(canAccessDashboard(undefined, "simosa"), false);
});
