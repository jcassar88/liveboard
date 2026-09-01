"use client";

import { useCallback, useEffect, useRef } from "react";
import { Tldraw, Editor, TLEditorSnapshot, react } from "tldraw";
import "tldraw/tldraw.css";
import { supabase } from "@/lib/supabaseClient";
import { customShapeUtils, customTools } from "@/lib/math-shape";

const SAVE_DEBOUNCE_MS = 500;

export default function AnnotationCanvas({
  sessionId,
  studentId,
  studentSnapshot,
}: {
  sessionId: string;
  studentId: string;
  studentSnapshot: (Partial<TLEditorSnapshot> | null) | undefined;
}) {
  const backgroundEditorRef = useRef<Editor | null>(null);
  const annotationEditorRef = useRef<Editor | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (backgroundEditorRef.current && studentSnapshot) {
      backgroundEditorRef.current.loadSnapshot(studentSnapshot);
      backgroundEditorRef.current.zoomToFit();
    }
  }, [studentSnapshot]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const trySetup = () => {
      if (cancelled) return;
      const background = backgroundEditorRef.current;
      const annotation = annotationEditorRef.current;
      if (background && annotation) {
        unsub = react("sync-background-camera", () => {
          background.setCamera(annotation.getCamera(), {
            animation: { duration: 0 },
          });
        });
      } else {
        requestAnimationFrame(trySetup);
      }
    };
    trySetup();

    return () => {
      cancelled = true;
      unsub?.();
    };
  }, []);

  const saveAnnotation = useCallback(
    async (editor: Editor) => {
      const snapshot = editor.getSnapshot();
      const { error } = await supabase
        .from("canvases")
        .update({ teacher_annotation: snapshot })
        .eq("session_id", sessionId)
        .eq("student_id", studentId);
      if (error) {
        console.error("Failed to save annotation:", error.message);
      }
    },
    [sessionId, studentId]
  );

  const handleAnnotationMount = useCallback(
    (editor: Editor) => {
      annotationEditorRef.current = editor;

      (async () => {
        const { data } = await supabase
          .from("canvases")
          .select("teacher_annotation")
          .eq("session_id", sessionId)
          .eq("student_id", studentId)
          .maybeSingle();
        if (data?.teacher_annotation) {
          editor.loadSnapshot(data.teacher_annotation);
        }
      })();

      const unsubscribe = editor.store.listen(
        () => {
          if (saveTimeout.current) clearTimeout(saveTimeout.current);
          saveTimeout.current = setTimeout(() => {
            saveAnnotation(editor);
          }, SAVE_DEBOUNCE_MS);
        },
        { source: "user", scope: "document" }
      );

      return () => {
        unsubscribe();
        if (saveTimeout.current) clearTimeout(saveTimeout.current);
      };
    },
    [sessionId, studentId, saveAnnotation]
  );

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-0">
        <Tldraw
          hideUi
          shapeUtils={customShapeUtils}
          tools={customTools}
          onMount={(editor) => {
            backgroundEditorRef.current = editor;
            if (studentSnapshot) {
              editor.loadSnapshot(studentSnapshot);
              editor.zoomToFit();
            }
          }}
        />
      </div>
      <div className="absolute inset-0">
        <Tldraw
          shapeUtils={customShapeUtils}
          tools={customTools}
          onMount={handleAnnotationMount}
          components={{ Background: null }}
        />
      </div>
    </div>
  );
}