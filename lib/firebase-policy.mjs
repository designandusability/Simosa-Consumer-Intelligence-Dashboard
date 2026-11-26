export const SESSION_SECONDS = 3600;

export function isJazzEmail(email) {
  return typeof email === "string" && /^[^@\s]+@jazz\.com\.pk$/i.test(email) && !/\s/.test(email);
}

export function isApprovedFirebaseSignIn(user) {
  return isJazzEmail(user?.email)
    && user.email_verified === true
    && user.firebase?.sign_in_provider === "password"
    && user.simosa_email === user.email.toLowerCase();
}

export function hasCurrentAuthenticator(account, user) {
  return user.firebase?.sign_in_second_factor === "totp"
    && Boolean(account.multiFactor?.enrolledFactors.some(factor =>
      factor.factorId === "totp" && factor.uid === user.firebase.second_factor_identifier));
}
