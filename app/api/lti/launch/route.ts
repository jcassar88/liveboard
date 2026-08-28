import { NextRequest, NextResponse } from "next/server";
import { jwtVerify, createRemoteJWKSet } from "jose";
import { ltiConfig } from "@/lib/lti/config";

const CLAIM_MESSAGE_TYPE =
  "https://purl.imsglobal.org/spec/lti/claim/message_type";
const CLAIM_DEPLOYMENT_ID =
  "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
const CLAIM_ROLES = "https://purl.imsglobal.org/spec/lti/claim/roles";
const CLAIM_CONTEXT = "https://purl.imsglobal.org/spec/lti/claim/context";

// Sessions reset daily per class, per the earlier decision: blueprint
// courses share names across classes, but each Canvas course still has
// its own unique context.id, so this alone already prevents different
// classes from colliding — the date suffix just gives each class a
// fresh set of boards each day rather than picking up from last time.
function buildSessionId(contextId: string): string {
  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD
  return `${contextId}-${today}`;
}

function isInstructor(roles: unknown): boolean {
  if (!Array.isArray(roles)) return false;
  return roles.some(
    (role) => typeof role === "string" && role.includes("Instructor")
  );
}

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const idToken = formData.get("id_token");
  const state = formData.get("state");

  const cookieState = request.cookies.get("lti_state")?.value;
  const cookieNonce = request.cookies.get("lti_nonce")?.value;

  if (typeof idToken !== "string" || typeof state !== "string") {
    return NextResponse.json(
      { error: "Missing id_token or state" },
      { status: 400 }
    );
  }
  if (!cookieState || state !== cookieState) {
    return NextResponse.json(
      { error: "State mismatch — launch may have expired, try again" },
      { status: 400 }
    );
  }

  const jwks = createRemoteJWKSet(new URL(ltiConfig.canvasKeySetUrl));

  let payload;
  try {
    const result = await jwtVerify(idToken, jwks, {
      issuer: ltiConfig.canvasIssuer,
      audience: ltiConfig.canvasClientId,
    });
    payload = result.payload;
        } catch (err) {
    console.error("LTI launch token verification failed:", err);
    return NextResponse.json(
      { error: "Invalid launch token" },
      { status: 400 }
    );
  }

  if (payload.nonce !== cookieNonce) {
    return NextResponse.json({ error: "Nonce mismatch" }, { status: 400 });
  }
  if (payload[CLAIM_MESSAGE_TYPE] !== "LtiResourceLinkRequest") {
    return NextResponse.json(
      { error: "Unsupported LTI message type" },
      { status: 400 }
    );
  }
    if (!ltiConfig.canvasDeploymentIds.includes(payload[CLAIM_DEPLOYMENT_ID] as string)) {
    return NextResponse.json(
      { error: "Unexpected deployment_id" },
      { status: 400 }
    );
  }

  const context = payload[CLAIM_CONTEXT] as { id?: string } | undefined;
  const contextId = context?.id;
  const studentId = payload.sub;
  const name =
    typeof payload.name === "string" ? payload.name : undefined;

  if (!contextId || !studentId) {
    return NextResponse.json(
      { error: "Launch is missing course context or user id" },
      { status: 400 }
    );
  }

  const sessionId = buildSessionId(contextId);

  const destination = isInstructor(payload[CLAIM_ROLES])
    ? new URL(`/session/${sessionId}/teacher`, ltiConfig.appUrl)
    : new URL(
        `/session/${sessionId}/student/${studentId}`,
        ltiConfig.appUrl
      );

  if (name) {
    // StudentCanvas doesn't read this yet — it's here so that's a
    // straightforward follow-up (read the query param on mount, include
    // it in the upsert alongside session_id/student_id) rather than a
    // missing piece of the launch itself.
    destination.searchParams.set("name", name);
  }

  const response = NextResponse.redirect(destination.toString(), 303);
  response.cookies.delete("lti_state");
  response.cookies.delete("lti_nonce");
  return response;
}