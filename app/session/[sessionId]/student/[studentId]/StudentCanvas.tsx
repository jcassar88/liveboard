"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import type {
  ExcalidrawImperativeAPI,
  ExcalidrawInitialDataState,
} from "@excalidraw/excalidraw/types";
import { supabase } from "@/lib/supabaseClient";
import type { ExcalidrawScene } from "@/lib/excalidraw-scene";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);
const excalidrawUtilsPromise = import("@excalidraw/excalidraw");

const SAVE_DEBOUNCE_MS = 800;

export default function StudentCanvas({
  sessionId,
  studentId,
}: {
  sessionId: string;
  studentId: string;
}) {
  const [prompt, setPrompt] = useState("");
  const [acceptingResponses, setAcceptingResponses] = useState(true);
  const [teacherAnnotation, setTeacherAnnotation] =
    useState<ExcalidrawScene | null>(null);
  const [badgePositions, setBadgePositions] = useState
    { id: string; x: number; y: number }[]
  >([]);

  const saveTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainApiRef = useRef<ExcalidrawImperativeAPI | null>(null);
  const overlayApiRef = useRef<ExcalidrawImperativeAPI | null>(null);

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
            | { student_id?: string; teacher_annotation?: ExcalidrawScene | null }
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

  const recomputeBadgePositions = useCallback(async () => {
    const overlay = overlayApiRef.current;
    if (!overlay) return;
    const { sceneCoordsToViewportCoords } = await excalidrawUtilsPromise;
    const appState = overlay.getAppState();
    const positions = overlay.getSceneElements().map((el) => {
      const { x, y } = sceneCoordsToViewportCoords(
        { sceneX: el.x, sceneY: el.y },
        {
          zoom: appState.zoom,
          offsetLeft: 0,
          offsetTop: 0,
          scrollX: appState.scrollX,
          scrollY: appState.scrollY,
        }
      );
      return { id: el.id, x, y: y - 22 };
    });
    setBadgePositions(positions);
  }, []);

  useEffect(() => {
    const overlay = overlayApiRef.current;
    if (overlay && teacherAnnotation) {
      overlay.updateScene({ elements: teacherAnnotation.elements });
      requestAnimationFrame(recomputeBadgePositions);
    }
  }, [teacherAnnotation, recomputeBadgePositions]);

  useEffect(() => {
    const main = mainApiRef.current;
    const overlay = overlayApiRef.current;
    if (!main || !overlay) return;

    const unsubscribe = main.onScrollChange((scrollX, scrollY, zoom) => {
      overlay.updateScene({ appState: { scrollX, scrollY, zoom } });
      recomputeBadgePositions();
    });

    return unsubscribe;
  }, [recomputeBadgePositions]);

  const saveScene = useCallback(
    (elements: readonly unknown[]) => {
      if (saveTimeout.current) clearTimeout(saveTimeout.current);
      saveTimeout.current = setTimeout(async () => {
        const scene: ExcalidrawScene = {
          elements: elements as ExcalidrawScene["elements"],
        };
        const { error } = await supabase.from("canvases").upsert(
          { session_id: sessionId, student_id: studentId, snapshot: scene },
          { onConflict: "session_id,student_id" }
        );
        if (error) console.error("Failed to save canvas:", error.message);
      }, SAVE_DEBOUNCE_MS);
    },
    [sessionId, studentId]
  );

  const loadInitialData =
    useCallback(async (): Promise<ExcalidrawInitialDataState> => {
      const { data, error } = await supabase
        .from("canvases")
        .select("snapshot")
        .eq("session_id", sessionId)
        .eq("student_id", studentId)
        .maybeSingle();

      if (error) console.error("Failed to load canvas:", error.message);
      const scene = data?.snapshot as ExcalidrawScene | undefined;

      return {
        elements: scene?.elements ?? [],
        appState: { viewBackgroundColor: "#ffffff" },
      };
    }, [sessionId, studentId]);

  return (
    <div className="fixed inset-0">
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

      <Excalidraw
        excalidrawAPI={(api) => {
          mainApiRef.current = api;
        }}
        initialData={loadInitialData}
        onChange={(elements) => saveScene(elements)}
      />

      {badgePositions.map((pos) => (
        <div
          key={pos.id}
          className="pointer-events-none absolute z-40 rounded bg-purple-600 px-2 py-0.5 text-xs font-medium text-white shadow"
          style={{ left: pos.x, top: pos.y }}
        >
          Teacher Comment
        </div>
      ))}

      <div className="pointer-events-none absolute inset-0 z-40">
        <Excalidraw
          excalidrawAPI={(api) => {
            overlayApiRef.current = api;
            if (teacherAnnotation) {
              api.updateScene({ elements: teacherAnnotation.elements });
            }
          }}
          viewModeEnabled
          initialData={{
            elements: [],
            appState: { viewBackgroundColor: "transparent" },
          }}
          UIOptions={{
            canvasActions: {
              export: false,
              saveToActiveFile: false,
              saveAsImage: false,
              loadScene: false,
              clearCanvas: false,
              toggleTheme: false,
            },
          }}
        />
      </div>
    </div>
  );
}