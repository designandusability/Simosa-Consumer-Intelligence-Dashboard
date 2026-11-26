import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { isJazzEmail } from "../lib/firebase-policy.mjs";

import { dashboards, simosaDashboard } from "../lib/dashboard-access.mjs";

const [address, confirmation, selection, ...extra] = process.argv.slice(2);
const email = address?.trim().toLowerCase();
if (!isJazzEmail(email)) throw new Error("Provide the approved user's @jazz.com.pk email.");
if (confirmation !== "--confirmed-work-email") {
  throw new Error("Independently confirm the address with the employee through a trusted Jazz channel, then pass --confirmed-work-email.");
}
let access;
if (selection === "--all-dashboards") {
  access = "*";
} else if (selection === "--no-dashboards") {
  access = [];
} else if (selection?.startsWith("--dashboards=")) {
  access = [...new Set(selection.slice("--dashboards=".length).split(","))];
  if (access.some(id => !dashboards.some(dashboard => dashboard.id === id))) {
    throw new Error("Provide registered dashboard IDs separated by commas.");
  }
} else if (selection !== undefined) {
  throw new Error("Use --dashboards=<ids>, --all-dashboards, or --no-dashboards.");
}
if (extra.length) throw new Error("Provide one dashboard access option.");

const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS ?? "null");
if (!credentials || credentials.project_id !== process.env.FIREBASE_PROJECT_ID) {
  throw new Error("Set matching Firebase project and Admin credentials before approving a user.");
}
const auth = getAuth(initializeApp({ projectId: credentials.project_id, credential: cert(credentials) }));
const user = await auth.getUserByEmail(email);
if (user.disabled) throw new Error("The Firebase account is disabled.");
if (!user.emailVerified) await auth.updateUser(user.uid, { emailVerified: true });
await auth.setCustomUserClaims(user.uid, {
  ...user.customClaims,
  simosa_email: email,
  cx_dashboards: access ?? user.customClaims?.cx_dashboards ?? [simosaDashboard.id],
});
console.log("Confirmed Jazz address marked verified and dashboard access saved.");
