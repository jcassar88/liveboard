"use client";

import { useEffect, useRef, useState } from "react";
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

export default function CanvasThumbnail({
  sessionId,
  snapshot,
  interactive = false,
}: {
  sessionId: string;
  snapshot: (ExcalidrawScene | null) | undefined;
  interactive?: boolean;
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);
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

  const render = async () => {
    const api = apiRef.current;
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
      elements: [...worksheetElements, ...(snapshot?.elements ?? [])],
    });
    api.scrollToContent(undefined, { fitToContent: true });
  };

  useEffect(() => {
    render();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [snapshot, worksheet]);

  return (
    <div className={interactive ? "h-full w-full" : "pointer-events-none h-full w-full"}>
      <Excalidraw
        viewModeEnabled={!interactive}
        excalidrawAPI={(api) => {
          apiRef.current = api;
          render();
        }}
        initialData={{
          elements: [],
          appState: { viewBackgroundColor: "#ffffff" },
        }}
      />
    </div>
  );
}