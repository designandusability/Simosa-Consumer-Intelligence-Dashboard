exports.onExecutePostLogin = async (event, api) => {
    if (event.client.client_id !== event.secrets.SIMOSA_CLIENT_ID) {
        return;
    }

    const methods = event.authentication?.methods ?? [];
    const passwordTime = Math.max(
        ...methods.filter((method) => method.name === "pwd")
            .map((method) => Date.parse(method.timestamp))
    );
    const otpCompleted = Number.isFinite(passwordTime) && methods.some(
        (method) => method.name === "mfa" &&
            method.type === "otp" &&
            Date.parse(method.timestamp) >= passwordTime
    );

    if (!otpCompleted) {
        api.access.deny("Complete the dashboard authenticator app check before signing in.");
        return;
    }

    const claimName = event.secrets.SIMOSA_MFA_CLAIM;
    if (!claimName) {
        api.access.deny("Dashboard sign-in is unavailable. Contact the dashboard administrator.");
        return;
    }

    api.idToken.setCustomClaim(claimName, true);
};
