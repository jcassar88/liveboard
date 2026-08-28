// Single-platform LTI config. Saints' Canvas is currently the only
// platform this tool registers with, so these are plain env vars rather
// than a multi-tenant lookup table. If a second Canvas instance (or LMS)
// ever needs to launch this tool, this is the file to generalise into a
// lookup keyed by issuer.

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const ltiConfig = {
  // Canvas's side of the registration (from the Developer Key's "Configure" details).
  get canvasIssuer() {
    return requireEnv("CANVAS_ISSUER");
  },
  get canvasClientId() {
    return requireEnv("CANVAS_CLIENT_ID");
  },
    get canvasDeploymentIds() {
    return requireEnv("CANVAS_DEPLOYMENT_ID")
      .split(",")
      .map((id) => id.trim());
  },
  get canvasAuthLoginUrl() {
    return requireEnv("CANVAS_AUTH_LOGIN_URL");
  },
  get canvasKeySetUrl() {
    return requireEnv("CANVAS_KEY_SET_URL");
  },

  // This tool's own signing key, used to publish our JWKS. Generate once
  // with `node scripts/generate-lti-keys.mjs` and store the two values it
  // prints as env vars — never commit them to the repo.
  get toolPrivateKeyPem() {
    return requireEnv("LTI_TOOL_PRIVATE_KEY");
  },
  get toolPublicJwk() {
    return JSON.parse(requireEnv("LTI_TOOL_PUBLIC_JWK"));
  },

  // This app's own public URL, used to build the redirect_uri Canvas
  // sends the launch back to. Set this to the real Vercel production URL.
  get appUrl() {
    return requireEnv("NEXT_PUBLIC_APP_URL");
  },
};