const assert = require("node:assert/strict");
const { test } = require("node:test");
const requireMfa = require("../auth0/require-jazz-mfa").onExecutePostLogin;
const confirmMfa = require("../auth0/confirm-jazz-mfa").onExecutePostLogin;

const password = { name: "pwd", timestamp: "2026-11-24T10:00:00Z" };
const otp = { name: "mfa", type: "otp", timestamp: "2026-11-24T10:00:30Z" };
const claim = "https://github.com/designandusability/Simosa-Consumer-Intelligence-Dashboard/otp_verified";

function fixture() {
    const event = {
        client: { client_id: "dashboard" },
        secrets: { SIMOSA_CLIENT_ID: "dashboard", SIMOSA_MFA_CLAIM: claim },
        connection: { strategy: "auth0" },
        user: { email: "employee@JAZZ.COM.PK", email_verified: true, enrolledFactors: [] },
        authentication: { methods: [password] },
    };
    const calls = [];
    const api = {
        access: { deny: () => calls.push(["deny"]) },
        authentication: {
            enrollWith: (factor) => calls.push(["enroll", factor]),
            challengeWith: (factor) => calls.push(["challenge", factor]),
        },
        idToken: { setCustomClaim: (...args) => calls.push(["claim", ...args]) },
    };
    return { event, api, calls };
}

test("invalid account or missing password is denied before MFA", async () => {
    for (const change of [
        { user: { email: "employee@jazz.com.pk.example", email_verified: true } },
        { user: { email: "employee@jazz.com.pk", email_verified: false } },
        { connection: { strategy: "google-oauth2" } },
        { authentication: { methods: [] } },
    ]) {
        const { event, api, calls } = fixture();
        await requireMfa({ ...event, ...change }, api);
        assert.deepEqual(calls, [["deny"]]);
    }
});

test("verified Jazz account is enrolled or challenged with the authenticator app", async () => {
    const { event, api, calls } = fixture();
    await requireMfa(event, api);
    event.user.enrolledFactors = [{ type: "otp" }];
    await requireMfa(event, api);
    assert.deepEqual(calls, [
        ["enroll", { type: "otp" }],
        ["challenge", { type: "otp" }],
    ]);
});

test("only an authenticator check after password produces the signed claim", async () => {
    for (const methods of [
        [password],
        [otp],
        [password, { ...otp, type: "email" }],
        [password, { ...otp, timestamp: "2026-11-24T09:59:00Z" }],
        [password, otp],
    ]) {
        const { event, api, calls } = fixture();
        event.authentication.methods = methods;
        await confirmMfa(event, api);
        assert.deepEqual(calls, methods.includes(otp) && methods.includes(password)
            ? [["claim", claim, true]]
            : [["deny"]]);
    }
});

test("actions leave other Auth0 applications alone", async () => {
    const { event, api, calls } = fixture();
    event.client.client_id = "other-app";
    await requireMfa(event, api);
    await confirmMfa(event, api);
    assert.deepEqual(calls, []);
});

test("a missing claim setting denies access after MFA", async () => {
    const { event, api, calls } = fixture();
    event.authentication.methods = [password, otp];
    delete event.secrets.SIMOSA_MFA_CLAIM;
    await confirmMfa(event, api);
    assert.deepEqual(calls, [["deny"]]);
});
