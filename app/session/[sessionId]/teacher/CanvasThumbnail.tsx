"use client";

import { useEffect, useRef } from "react";
import { Tldraw, Editor, TLEditorSnapshot } from "tldraw";
import "tldraw/tldraw.css";
import { customShapeUtils, customTools } from "@/lib/math-shape";

export default function CanvasThumbnail({
  snapshot,
  interactive = false,
}: {
  snapshot: (Partial<TLEditorSnapshot> | null) | undefined;
  interactive?: boolean;
}) {
  const editorRef = useRef<Editor | null>(null);

  useEffect(() => {
    if (editorRef.current && snapshot) {
      editorRef.current.loadSnapshot(snapshot);
      editorRef.current.zoomToFit();
    }
  }, [snapshot]);

  return (
    <div className={interactive ? "h-full w-full" : "pointer-events-none h-full w-full"}>
   <Tldraw
        hideUi
        shapeUtils={customShapeUtils}
        tools={customTools}
        licenseKey={process.env.NEXT_PUBLIC_TLDRAW_LICENSE_KEY}
        onMount={(editor) => {
          editorRef.current = editor;
          if (snapshot) {
            editor.loadSnapshot(snapshot);
            editor.zoomToFit();
          }
        }}
      />
    </div>
  );
}