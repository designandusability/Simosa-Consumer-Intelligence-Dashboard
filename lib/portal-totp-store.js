import "server-only";
import { createHash } from "node:crypto";
import { getFirestore } from "firebase-admin/firestore";
import { transitionPortalTotp } from "./portal-totp.mjs";

function factorRef(db, uid) {
  const id = createHash("sha256").update(uid).digest("hex");
  return db.collection("semantic-cx-private-totp").doc(id);
}

export async function enrolledPortalFactorId(app, uid) {
  return (await factorRef(getFirestore(app), uid).get()).data()?.factor?.id;
}

export function updatePortalFactor(app, input) {
  const db = getFirestore(app);
  const ref = factorRef(db, input.uid);
  return db.runTransaction(async transaction => {
    const snapshot = await transaction.get(ref);
    const { state, ...result } = transitionPortalTotp(snapshot.data() ?? {}, { ...input, now: Date.now() });
    if (state) transaction.set(ref, state);
    return result;
  });
}
