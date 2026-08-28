import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { ltiConfig } from "@/lib/lti/config";

// Cookies only need to survive the couple of seconds between Canvas
// sending us here and Canvas posting back to /api/lti/launch.
const COOKIE_MAX_AGE_SECONDS = 5 * 60;

async function handleLogin(params: URLSearchParams) {
  const iss = params.get("iss");
  const loginHint = params.get("login_hint");
  const targetLinkUri = params.get("target_link_uri");
  const ltiMessageHint = params.get("lti_message_hint");
  const clientId = params.get("client_id") ?? ltiConfig.canvasClientId;

  if (iss !== ltiConfig.canvasIssuer) {
    return NextResponse.json(
      { error: `Unexpected issuer: ${iss}` },
      { status: 400 }
    );
  }
  if (!loginHint) {
    return NextResponse.json(
      { error: "Missing login_hint" },
      { status: 400 }
    );
  }

  const state = randomBytes(16).toString("hex");
  const nonce = randomBytes(16).toString("hex");

  const authUrl = new URL(ltiConfig.canvasAuthLoginUrl);
  authUrl.searchParams.set("scope", "openid");
  authUrl.searchParams.set("response_type", "id_token");
  authUrl.searchParams.set("client_id", clientId);
  authUrl.searchParams.set(
    "redirect_uri",
    `${ltiConfig.appUrl}/api/lti/launch`
  );
  authUrl.searchParams.set("login_hint", loginHint);
  authUrl.searchParams.set("state", state);
  authUrl.searchParams.set("response_mode", "form_post");
  authUrl.searchParams.set("nonce", nonce);
  authUrl.searchParams.set("prompt", "none");
  if (ltiMessageHint) {
    authUrl.searchParams.set("lti_message_hint", ltiMessageHint);
  }
  if (targetLinkUri) {
    // Not required by Canvas, but harmless to pass through for debugging.
    authUrl.searchParams.set("target_link_uri", targetLinkUri);
  }

  const response = NextResponse.redirect(authUrl.toString());

  // SameSite=None because this whole flow is a chain of cross-site
  // top-level navigations (Canvas -> us -> Canvas -> us) — Lax cookies
  // can get dropped on the POST back from Canvas in some browsers.
  const cookieOptions = {
    httpOnly: true,
    secure: true,
    sameSite: "none" as const,
    maxAge: COOKIE_MAX_AGE_SECONDS,
    path: "/",
  };
  response.cookies.set("lti_state", state, cookieOptions);
  response.cookies.set("lti_nonce", nonce, cookieOptions);

  return response;
}

export async function GET(request: NextRequest) {
  return handleLogin(request.nextUrl.searchParams);
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const params = new URLSearchParams();
  formData.forEach((value, key) => {
    if (typeof value === "string") params.set(key, value);
  });
  return handleLogin(params);
}