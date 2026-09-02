"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import type {
  ExcalidrawImperativeAPI,
  DataURL,
} from "@excalidraw/excalidraw/types";
import type { FileId } from "@excalidraw/excalidraw/element/types";
import { supabase } from "@/lib/supabaseClient";
import type { ExcalidrawScene } from "@/lib/excalidraw-scene";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);
const excalidrawUtilsPromise = import("@excalidraw/excalidraw");

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
  const [worksheet, setWorksheet] = useState<{
    image_data: string;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    let isCancelled = false;
    (async () => {
      const { data } = await supabase
        .from("session_worksheet")
        .select("image_data, width, height")
        .eq("session_id", sessionId)
        .maybeSingle();
      if (!isCancelled) setWorksheet(data ?? null);
    })();
    return () => {
      isCancelled = true;
    };
  }, [sessionId]);

  const renderBackground = useCallback(async () => {
    const api = backgroundApiRef.current;
    if (!api) return;
    const { convertToExcalidrawElements } = await excalidrawUtilsPromise;

    const worksheetElements = worksheet
      ? convertToExcalidrawElements([
          {
            type: "image",
            x: 0,
            y: 0,
            width: worksheet.width,
            height: worksheet.height,
            fileId: `worksheet-${sessionId}` as FileId,
            locked: true,
          },
        ])
      : [];

    if (worksheet) {
      api.addFiles([
        {
          id: `worksheet-${sessionId}` as FileId,
          dataURL: worksheet.image_data as DataURL,
          mimeType: worksheet.image_data.startsWith("data:image/png")
            ? "image/png"
            : "image/jpeg",
          created: Date.now(),
        },
      ]);
    }

    api.updateScene({
      elements: [...worksheetElements, ...(studentSnapshot?.elements ?? [])],
    });
  }, [worksheet, studentSnapshot, sessionId]);

  useEffect(() => {
    renderBackground();
  }, [renderBackground]);

  useEffect(() => {
    const annotation = annotationApiRef.current;
    const background = backgroundApiRef.current;
    if (!annotation || !background) return;
    const elements = background.getSceneElements();
    if (elements.length > 0) {
      annotation.scrollToContent(elements, { fitToContent: true });
    }
  }, [studentSnapshot, worksheet]);

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
            renderBackground();
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