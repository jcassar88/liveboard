"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

// Local dev helper only — jumps straight to a session without going
// through an LTI launch. The real entry points are the LTI launch
// endpoints (student -> /session/[id]/student/[id], teacher -> /session/[id]/teacher).
export default function DevHomePage() {
  const [sessionId, setSessionId] = useState("test-session");
  const [studentId, setStudentId] = useState("student-1");
  const router = useRouter();

  return (
    <div className="mx-auto mt-24 max-w-md space-y-6 px-4">
      <div>
        <h1 className="text-xl font-semibold">Live Whiteboard — dev launcher</h1>
        <p className="mt-1 text-sm text-neutral-500">
          For local testing only, until the LTI launch flow is wired up.
        </p>
      </div>

      <div className="space-y-3">
        <label className="block text-sm">
          Session ID
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={sessionId}
            onChange={(e) => setSessionId(e.target.value)}
          />
        </label>
        <label className="block text-sm">
          Student ID
          <input
            className="mt-1 w-full rounded border px-2 py-1"
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
          />
        </label>
      </div>

      <div className="flex gap-3">
        <button
          className="rounded bg-neutral-900 px-3 py-2 text-sm text-white"
          onClick={() =>
            router.push(`/session/${sessionId}/student/${studentId}`)
          }
        >
          Open as student
        </button>
        <button
          className="rounded border border-neutral-900 px-3 py-2 text-sm"
          onClick={() => router.push(`/session/${sessionId}/teacher`)}
        >
          Open teacher grid
        </button>
      </div>
    </div>
  );
}
