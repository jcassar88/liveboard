// One-off script: generates the RSA keypair our tool uses to sign/verify
// its own JWKS for LTI. Run once with `node scripts/generate-lti-keys.mjs`,
// then copy the printed values into env vars (locally and in Vercel).
// Safe to re-run to rotate keys later — old sessions just re-launch fresh.
import { generateKeyPair, exportPKCS8, exportJWK, calculateJwkThumbprint } from "jose";

const { publicKey, privateKey } = await generateKeyPair("RS256", {
  extractable: true,
});

const privatePem = await exportPKCS8(privateKey);
const publicJwk = await exportJWK(publicKey);
const kid = await calculateJwkThumbprint(publicJwk);

publicJwk.kid = kid;
publicJwk.alg = "RS256";
publicJwk.use = "sig";

console.log("Add these to your .env.local and to Vercel (Production + Preview):\n");
console.log("LTI_TOOL_PRIVATE_KEY=" + JSON.stringify(privatePem));
console.log("\nLTI_TOOL_PUBLIC_JWK=" + JSON.stringify(JSON.stringify(publicJwk)));