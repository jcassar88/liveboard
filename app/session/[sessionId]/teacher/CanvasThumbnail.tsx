"use client";

import { useEffect, useRef } from "react";
import dynamic from "next/dynamic";
import "@excalidraw/excalidraw/index.css";
import type { ExcalidrawImperativeAPI } from "@excalidraw/excalidraw/types";
import type { ExcalidrawScene } from "@/lib/excalidraw-scene";

const Excalidraw = dynamic(
  async () => (await import("@excalidraw/excalidraw")).Excalidraw,
  { ssr: false }
);

export default function CanvasThumbnail({
  snapshot,
  interactive = false,
}: {
  snapshot: (ExcalidrawScene | null) | undefined;
  interactive?: boolean;
}) {
  const apiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  useEffect(() => {
    if (apiRef.current && snapshot) {
      apiRef.current.updateScene({ elements: snapshot.elements });
      apiRef.current.scrollToContent(undefined, { fitToContent: true });
    }
  }, [snapshot]);

  return (
    <div className={interactive ? "h-full w-full" : "pointer-events-none h-full w-full"}>
      <Excalidraw
        viewModeEnabled={!interactive}
        excalidrawAPI={(api) => {
          apiRef.current = api;
          if (snapshot) {
            api.updateScene({ elements: snapshot.elements });
            api.scrollToContent(undefined, { fitToContent: true });
          }
        }}
        initialData={{
          elements: snapshot?.elements ?? [],
          appState: { viewBackgroundColor: "#ffffff" },
        }}
      />
    </div>
  );
}