import { NextResponse } from "next/server";
import { ltiConfig } from "@/lib/lti/config";

export async function GET() {
  return NextResponse.json({ keys: [ltiConfig.toolPublicJwk] });
}