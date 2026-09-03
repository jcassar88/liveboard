"use client";

import { useEffect, useState } from "react";
import type { ExcalidrawScene } from "@/lib/excalidraw-scene";
import { supabase } from "@/lib/supabaseClient";
import CanvasThumbnail from "./CanvasThumbnail";
import { useRouter } from "next/navigation";
import AnnotationCanvas from "./AnnotationCanvas";

type CanvasRow = {
  student_id: string;
  student_name: string | null;
  snapshot: ExcalidrawScene | null;
  updated_at: string;
};

type PastSession = { sessionId: string; date: string };

// session_id is built as `${courseId}-${YYYY-MM-DD}` — split that back apart
// so we can look up every date this course has a session for.
function parseSessionId(id: string): { courseId: string; date: string } | null {
  const match = id.match(/^(.*)-(\d{4}-\d{2}-\d{2})$/);
  if (!match) return null;
  return { courseId: match[1], date: match[2] };
}

export default function TeacherGrid({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [canvases, setCanvases] = useState<Record<string, CanvasRow>>({});
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(
    null
  );
  const [pastSessions, setPastSessions] = useState<PastSession[]>([]);

  const parsed = parseSessionId(sessionId);

  useEffect(() => {
    if (!parsed) return;
    let isCancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("canvases")
        .select("session_id")
        .like("session_id", `${parsed.courseId}-%`);

      if (error) {
        console.error("Failed to load past sessions:", error.message);
        return;
      }
      if (isCancelled || !data) return;

      const unique = Array.from(
        new Set([...data.map((row) => row.session_id), sessionId])
      );
      const sessions = unique
        .map((id) => {
          const p = parseSessionId(id);
          return p ? { sessionId: id, date: p.date } : null;
        })
        .filter((s): s is PastSession => s !== null)
        .sort((a, b) => b.date.localeCompare(a.date));

      setPastSessions(sessions);
    })();

    return () => {
      isCancelled = true;
    };
  }, [parsed?.courseId]);

  useEffect(() => {
    let isCancelled = false;

    (async () => {
      const { data, error } = await supabase
        .from("canvases")
        .select("student_id, student_name, snapshot, updated_at")
        .eq("session_id", sessionId);

      if (error) {
        console.error("Failed to load canvases:", error.message);
        return;
      }
      if (isCancelled || !data) return;

      const asMap: Record<string, CanvasRow> = {};
      for (const row of data) asMap[row.student_id] = row as CanvasRow;
      setCanvases(asMap);
    })();

    const channel = supabase
      .channel(`canvases-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "canvases",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as CanvasRow | undefined;
          if (!row?.student_id) return;
          setCanvases((prev) => ({ ...prev, [row.student_id]: row }));
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  const students = Object.values(canvases).sort((a, b) =>
    (a.student_name ?? a.student_id).localeCompare(
      b.student_name ?? b.student_id
    )
  );

  const expanded = expandedStudentId ? canvases[expandedStudentId] : null;

  const [prompt, setPrompt] = useState("");
  const [promptInput, setPromptInput] = useState("");
  const [acceptingResponses, setAcceptingResponses] = useState(true);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("session_prompts")
        .select("prompt, accepting_responses")
        .eq("session_id", sessionId)
        .maybeSingle();
      const current = data?.prompt ?? "";
      setPrompt(current);
      setPromptInput(current);
      setAcceptingResponses(data?.accepting_responses ?? false);    })();
  }, [sessionId]);

  const postPrompt = async () => {
    const { error } = await supabase
      .from("session_prompts")
      .upsert({
        session_id: sessionId,
        prompt: promptInput,
        accepting_responses: acceptingResponses,
      });
    if (error) {
      console.error("Failed to post prompt:", error.message);
      return;
    }
    setPrompt(promptInput);
  };

    const toggleAccepting = async () => {
    const next = !acceptingResponses;
    const { error } = await supabase
      .from("session_prompts")
      .upsert({ session_id: sessionId, prompt, accepting_responses: next });
    if (error) {
      console.error("Failed to toggle accepting_responses:", error.message);
      return;
    }
    setAcceptingResponses(next);
  };

  const [hasWorksheet, setHasWorksheet] = useState(false);

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("session_worksheet")
        .select("session_id")
        .eq("session_id", sessionId)
        .maybeSingle();
      setHasWorksheet(Boolean(data));
    })();
  }, [sessionId]);

  const handleWorksheetUpload = async (file: File) => {
    const dataURL = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });

    const { width, height } = await new Promise<{
      width: number;
      height: number;
    }>((resolve, reject) => {
      const img = new Image();
      img.onload = () =>
        resolve({ width: img.naturalWidth, height: img.naturalHeight });
      img.onerror = reject;
      img.src = dataURL;
    });

    const { error } = await supabase.from("session_worksheet").upsert({
      session_id: sessionId,
      image_data: dataURL,
      width,
      height,
    });
    if (error) {
      console.error("Failed to upload worksheet:", error.message);
      return;
    }
    setHasWorksheet(true);
  };

  const removeWorksheet = async () => {
    const { error } = await supabase
      .from("session_worksheet")
      .delete()
      .eq("session_id", sessionId);
    if (error) {
      console.error("Failed to remove worksheet:", error.message);
      return;
    }
    setHasWorksheet(false);
  };
  return (
    <div className="min-h-screen bg-neutral-950 p-4 text-neutral-100">
      <div className="mb-4 flex items-center gap-3">
        <h1 className="text-lg font-medium">Live session — {sessionId}</h1>
        {pastSessions.length > 1 && (
          <select
            value={sessionId}
            onChange={(e) => router.push(`/session/${e.target.value}/teacher`)}
            className="rounded border border-neutral-700 bg-neutral-900 px-2 py-1 text-sm text-neutral-100"
          >
            {pastSessions.map((s) => (
              <option key={s.sessionId} value={s.sessionId}>
                {s.date === parsed?.date ? `${s.date} (current)` : s.date}
              </option>
            ))}
          </select>
        )}
      </div>
      <div className="mb-4 flex gap-2">
        <input
          value={promptInput}
          onChange={(e) => setPromptInput(e.target.value)}
          placeholder="Type a question or statement for students to see…"
          className="flex-1 rounded border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-neutral-100"
        />
        <button
          onClick={postPrompt}
          className="rounded bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Post to students
        </button>
        <button
          onClick={toggleAccepting}
          className={`rounded px-4 py-2 text-sm font-medium text-white ${
            acceptingResponses
              ? "bg-red-600 hover:bg-red-700"
              : "bg-green-600 hover:bg-green-700"
          }`}
        >
          {acceptingResponses ? "Pause responses" : "Resume responses"}
        </button>
      </div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="cursor-pointer rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700">
          {hasWorksheet ? "Replace worksheet" : "Upload worksheet"}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleWorksheetUpload(file);
              e.target.value = "";
            }}
          />
        </label>
        {hasWorksheet && (
          <button
            onClick={removeWorksheet}
            className="rounded bg-neutral-800 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
          >
            Remove worksheet
          </button>
        )}
      </div>

      {prompt && (
        <p className="mb-4 text-sm text-neutral-400">
          Currently showing: <span className="text-neutral-200">{prompt}</span>
        </p>
      )}

      {students.length === 0 && (        <p className="text-neutral-400">
          Waiting for students to join and start drawing…
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
        {students.map((row) => (
          <div
            key={row.student_id}
            role="button"
            tabIndex={0}
            onClick={() => setExpandedStudentId(row.student_id)}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                setExpandedStudentId(row.student_id);
              }
            }}
            className="cursor-pointer overflow-hidden rounded-lg border border-neutral-800 bg-white text-left transition hover:border-neutral-500"
          >
            <div className="aspect-video w-full">
              {row.snapshot ? (
                                <CanvasThumbnail
                  key={row.updated_at}
                  sessionId={sessionId}
                  snapshot={row.snapshot}
                />
              ) : (
                <div className="flex h-full items-center justify-center text-neutral-400">
                  No drawing yet
                </div>
              )}
            </div>
            <div className="border-t border-neutral-800 bg-neutral-900 px-2 py-1 text-sm text-neutral-100">
              {row.student_name ?? row.student_id}
            </div>
          </div>
        ))}
      </div>

            {expanded && (
        <div className="fixed inset-0 z-20 bg-white">
          <div className="flex items-center justify-between border-b px-4 py-2">
            <span className="font-medium text-neutral-900">
              {expanded.student_name ?? expanded.student_id}
            </span>
            <button
              onClick={() => setExpandedStudentId(null)}
              className="text-neutral-500 hover:text-neutral-900"
            >
              Close
            </button>
          </div>
          <div className="h-[calc(100%-41px)] w-full">
            <AnnotationCanvas
              sessionId={sessionId}
              studentId={expanded.student_id}
              studentSnapshot={expanded.snapshot}
            />
          </div>
        </div>
      )}
    </div>
  );
}