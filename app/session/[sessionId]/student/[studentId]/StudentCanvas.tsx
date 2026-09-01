"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Tldraw, Editor, TLEditorSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { supabase } from "@/lib/supabaseClient";
import { customShapeUtils, customTools } from "@/lib/math-shape";

const SAVE_DEBOUNCE_MS = 800;

export default function StudentCanvas({
  sessionId,
  studentId,
}: {
  sessionId: string;
  studentId: string;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [prompt, setPrompt] = useState("");
  const [acceptingResponses, setAcceptingResponses] = useState(true);
  const [teacherAnnotation, setTeacherAnnotation] = useState
    Partial<TLEditorSnapshot> | null
  >(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Editor | null>(null);
  const annotationEditorRef = useRef<Editor | null>(null);

  // Prompt banner + accepting-responses toggle, live from the teacher.
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      const { data } = await supabase
        .from("session_prompts")
        .select("prompt, accepting_responses")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!isCancelled) {
        setPrompt(data?.prompt ?? "");
        setAcceptingResponses(data?.accepting_responses ?? true);
      }
    })();

    const channel = supabase
      .channel(`prompt-${sessionId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "session_prompts",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as
            | { prompt?: string; accepting_responses?: boolean }
            | undefined;
          setPrompt(row?.prompt ?? "");
          setAcceptingResponses(row?.accepting_responses ?? true);
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Teacher's live annotation overlay. The canvases table doesn't support
  // a compound (session_id AND student_id) realtime filter, so this
  // subscribes to the whole session and ignores updates for other students.
  useEffect(() => {
    let isCancelled = false;

    (async () => {
      const { data } = await supabase
        .from("canvases")
        .select("teacher_annotation")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .maybeSingle();
      if (!isCancelled) {
        setTeacherAnnotation(data?.teacher_annotation ?? null);
      }
    })();

    const channel = supabase
      .channel(`annotation-${sessionId}-${studentId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "canvases",
          filter: `session_id=eq.${sessionId}`,
        },
        (payload) => {
          const row = payload.new as
            | { student_id?: string; teacher_annotation?: Partial<TLEditorSnapshot> | null }
            | undefined;
          if (row?.student_id !== studentId) return;
          setTeacherAnnotation(row.teacher_annotation ?? null);
        }
      )
      .subscribe();

    return () => {
      isCancelled = true;
      supabase.removeChannel(channel);
    };
  }, [sessionId, studentId]);

  useEffect(() => {
    if (annotationEditorRef.current && teacherAnnotation) {
      annotationEditorRef.current.loadSnapshot(teacherAnnotation);
    }
  }, [teacherAnnotation]);

  const saveSnapshot = useCallback(
    async (editor: Editor) => {
      const snapshot = editor.getSnapshot();
      const { error } = await supabase.from("canvases").upsert(
        {
          session_id: sessionId,
          student_id: studentId,
          snapshot,
        },
        { onConflict: "session_id,student_id" }
      );
      if (error) {
        console.error("Failed to save canvas:", error.message);
      }
    },
    [sessionId, studentId]
  );

  const handleMount = useCallback(
    (editor: Editor) => {
      editorRef.current = editor;
      let isCancelled = false;

      (async () => {
        const { data, error } = await supabase
          .from("canvases")
          .select("snapshot")
          .eq("session_id", sessionId)
          .eq("student_id", studentId)
          .maybeSingle();

        if (error) {
          console.error("Failed to load canvas:", error.message);
        } else if (data?.snapshot && !isCancelled) {
          editor.loadSnapshot(data.snapshot);
        }

        if (!isCancelled) setIsLoading(false);
      })();

      const unsubscribe = editor.store.listen(
        () => {
          if (saveTimeout.current) clearTimeout(saveTimeout.current);
          saveTimeout.current = setTimeout(() => {
            saveSnapshot(editor);
          }, SAVE_DEBOUNCE_MS);
        },
        { source: "user", scope: "document" }
      );

      return () => {
        isCancelled = true;
        unsubscribe();
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
      };
    },
    [sessionId, studentId, saveSnapshot]
  );

  return (
    <div className="fixed inset-0">
      {isLoading && (
        <div className="absolute top-3 left-3 z-10 rounded bg-black/70 px-3 py-1 text-sm text-white">
          Loading your canvas…
        </div>
      )}
      {prompt && (
        <div className="absolute top-3 left-1/2 z-50 max-w-xl -translate-x-1/2 rounded-lg bg-blue-600 px-4 py-2 text-center text-sm font-medium text-white shadow-lg">
          {prompt}
        </div>
      )}
      {!acceptingResponses && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/70">
          <p className="max-w-sm rounded-lg bg-neutral-900 px-6 py-4 text-center text-white shadow-lg">
            Your teacher has paused responses right now.
          </p>
        </div>
      )}
      <button
        onClick={() => editorRef.current?.setCurrentTool("math")}
        className="absolute bottom-3 left-3 z-50 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
      >
        Insert equation
      </button>
      <Tldraw
        onMount={handleMount}
        shapeUtils={customShapeUtils}
        tools={customTools}
      />
      {/* Live, read-only overlay of whatever the teacher has annotated on
          this student's board — purely visual, never intercepts the
          student's own drawing. */}
      <div className="pointer-events-none absolute inset-0 z-40">
        <Tldraw
          hideUi
          shapeUtils={customShapeUtils}
          tools={customTools}
          components={{ Background: null }}
          onMount={(editor) => {
            annotationEditorRef.current = editor;
            if (teacherAnnotation) {
              editor.loadSnapshot(teacherAnnotation);
            }
          }}
        />
      </div>
    </div>
  );
}