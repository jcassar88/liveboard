"use client";

import { useCallback, useRef, useState } from "react";
import { Tldraw, Editor } from "tldraw";
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
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const editorRef = useRef<Editor | null>(null);

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
         <button
        onClick={() => editorRef.current?.setCurrentTool("math")}
        className="absolute bottom-3 right-3 z-50 rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-lg hover:bg-blue-700"
      >
        Insert equation
      </button>
      <Tldraw
        onMount={handleMount}
        shapeUtils={customShapeUtils}
        tools={customTools}
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
      />
    </div>
  );
}