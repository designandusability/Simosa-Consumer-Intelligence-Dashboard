import { cert, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { isJazzEmail } from "../lib/firebase-policy.mjs";

const [address, confirmation] = process.argv.slice(2);
const email = address?.trim().toLowerCase();
if (!isJazzEmail(email)) throw new Error("Provide the approved user's @jazz.com.pk email.");
if (confirmation !== "--confirmed-work-email") {
  throw new Error("Independently confirm the address with the employee through a trusted Jazz channel, then pass --confirmed-work-email.");
}
const credentials = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS ?? "null");
if (!credentials || credentials.project_id !== process.env.FIREBASE_PROJECT_ID) {
  throw new Error("Set matching Firebase project and Admin credentials before approving a user.");
}
const auth = getAuth(initializeApp({ projectId: credentials.project_id, credential: cert(credentials) }));
const user = await auth.getUserByEmail(email);
if (user.disabled) throw new Error("The Firebase account is disabled.");
if (!user.emailVerified) await auth.updateUser(user.uid, { emailVerified: true });
await auth.setCustomUserClaims(user.uid, { ...user.customClaims, simosa_email: email });
console.log("Confirmed Jazz address marked verified and approved for SIMOSA.");
