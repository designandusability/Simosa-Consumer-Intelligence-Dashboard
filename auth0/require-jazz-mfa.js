exports.onExecutePostLogin = async (event, api) => {
    if (event.client.client_id !== event.secrets.SIMOSA_CLIENT_ID) {
        return;
    }

    const email = event.user.email;
    const emailParts = typeof email === "string" ? email.split("@") : [];
    const passwordUsed = event.authentication?.methods?.some(
        (method) => method.name === "pwd"
    );

    if (
        event.connection.strategy !== "auth0" ||
        !passwordUsed ||
        emailParts.length !== 2 ||
        !emailParts[0] ||
        /\s/.test(emailParts[0]) ||
        emailParts[1].toLowerCase() !== "jazz.com.pk"
    ) {
        api.access.deny("Use an @jazz.com.pk account with a dashboard password.");
        return;
    }
    if (event.user.email_verified !== true) {
        api.access.deny("Open the verification link sent to your Jazz email and sign in again.");
        return;
    }

    const otp = { type: "otp" };
    if (event.user.enrolledFactors?.some((factor) => factor.type === otp.type)) {
        api.authentication.challengeWith(otp);
    } else {
        api.authentication.enrollWith(otp);
    }
};
