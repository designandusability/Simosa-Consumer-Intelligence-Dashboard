export const MFA_CLAIM = "https://github.com/designandusability/Simosa-Consumer-Intelligence-Dashboard/otp_verified";
export const SESSION_SECONDS = 3600;

export function canAccessDashboard(user, now = Date.now() / 1000) {
  return typeof user?.email === "string"
    && /^[^@\s]+@jazz\.com\.pk$/i.test(user.email)
    && !/\s/.test(user.email)
    && user.email_verified === true
    && user[MFA_CLAIM] === true
    && Number.isSafeInteger(user.iat)
    && Number.isSafeInteger(user.exp)
    && user.iat <= now && now < Math.min(user.exp, user.iat + SESSION_SECONDS);
}
