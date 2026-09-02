"use client";

import { useCallback, useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import { supabase } from "@/lib/supabaseClient";
import type { ExcalidrawScene } from "@/lib/excalidraw-scene";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

const SAVE_DEBOUNCE_MS = 500;

export default function AnnotationCanvas({
  sessionId,
  studentId,
  studentSnapshot,
}: {
  sessionId: string;
  studentId: string;
  studentSnapshot: (ExcalidrawScene | null) | undefined;
}) {
  const backgroundApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const annotationApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (backgroundApiRef.current && studentSnapshot) {
      backgroundApiRef.current.updateScene({ elements: studentSnapshot.elements });
      backgroundApiRef.current.scrollToContent(undefined, { fitToContent: true });
    }
  }, [studentSnapshot]);

      // Both layers now occupy the exact same screen space, so fitting each
  // one independently to the student's own content — rather than reading
  // one's camera and copying it into the other — produces an identical
  // result with no timing race between the two.
  useEffect(() => {
    const annotation = annotationApiRef.current;
    if (annotation && studentSnapshot?.elements?.length) {
      annotation.scrollToContent(studentSnapshot.elements, {
        fitToContent: true,
      });
    }
  }, [studentSnapshot]);

  useEffect(() => {
    let cancelled = false;
    let unsub: (() => void) | undefined;

    const trySetup = () => {
      if (cancelled) return;
      const annotation = annotationApiRef.current;
      const background = backgroundApiRef.current;
      if (annotation && background) {
        unsub = annotation.onScrollChange((scrollX, scrollY, zoom) => {
          background.updateScene({ appState: { scrollX, scrollY, zoom } });
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
    (elements: readonly unknown[]) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        const scene: ExcalidrawScene = {
          elements: elements as ExcalidrawScene["elements"],
        };
        const { error } = await supabase
          .from("canvases")
          .update({ teacher_annotation: scene })
          .eq("session_id", sessionId)
          .eq("student_id", studentId);
        if (error) {
          console.error("Failed to save annotation:", error.message);
        }
      }, SAVE_DEBOUNCE_MS);
    },
    [sessionId, studentId]
  );

  return (
    <div className="relative h-full w-full">
      <div className="pointer-events-none absolute inset-0">
        <Excalidraw
          viewModeEnabled
          excalidrawAPI={(api) => {
            backgroundApiRef.current = api;
            if (studentSnapshot) {
              api.updateScene({ elements: studentSnapshot.elements });
              api.scrollToContent(undefined, { fitToContent: true });
            }
          }}
          initialData={{
            elements: studentSnapshot?.elements ?? [],
            appState: { viewBackgroundColor: "#ffffff" },
          }}
        />
      </div>
      <div className="absolute inset-0">
        <Excalidraw
          excalidrawAPI={async (api) => {
            annotationApiRef.current = api;
            const { data } = await supabase
              .from("canvases")
              .select("teacher_annotation")
              .eq("session_id", sessionId)
              .eq("student_id", studentId)
              .maybeSingle();
            const existing = data?.teacher_annotation as ExcalidrawScene | undefined;
            if (existing?.elements) {
              api.updateScene({ elements: existing.elements });
            }
          }}
          initialData={{
            elements: [],
            appState: { viewBackgroundColor: "transparent" },
          }}
          onChange={(elements) => saveAnnotation(elements)}
        />
      </div>
    </div>
  );
}