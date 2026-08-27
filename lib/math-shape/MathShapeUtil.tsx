"use client";

import {
  DefaultColorStyle,
  HTMLContainer,
  Rectangle2d,
  ShapeUtil,
  T,
  TLBaseShape,
  TLDefaultColorStyle,
  TLResizeInfo,
  stopEventPropagation,
} from "tldraw";
import katex from "katex";
import "katex/dist/katex.min.css";

export type MathShape = TLBaseShape<"math", { w: number, h: number, latex: string, color: TLDefaultColorStyle }>;

declare module "@tldraw/tlschema" {
  interface TLGlobalShapePropsMap {
    math: MathShape["props"];
  }
}

export class MathShapeUtil extends ShapeUtil<MathShape> {
  static override type = "math" as const;

  static override props = {
    w: T.number,
    h: T.number,
    latex: T.string,
    color: DefaultColorStyle,
  };

  override getDefaultProps(): MathShape["props"] {
    return { w: 240, h: 70, latex: "x^2 + 3x - 5 = 0", color: "black" };
  }

  override canEdit() {
    return true;
  }

  override getGeometry(shape: MathShape) {
    return new Rectangle2d({
      width: shape.props.w,
      height: shape.props.h,
      isFilled: true,
    });
  }

  override onResize(shape: MathShape, info: TLResizeInfo<MathShape>) {
    return {
      x: info.newPoint.x,
      y: info.newPoint.y,
      props: {
        w: Math.max(1, info.initialShape.props.w * info.scaleX),
        h: Math.max(1, info.initialShape.props.h * info.scaleY),
      },
    };
  }

  override component(shape: MathShape) {
    const isEditing = this.editor.getEditingShapeId() === shape.id;

    if (isEditing) {
      return (
        <HTMLContainer
          style={{
            width: shape.props.w,
            height: shape.props.h,
            pointerEvents: "all",
          }}
        >
          <textarea
            autoFocus
            value={shape.props.latex}
            onChange={(e) => {
              this.editor.updateShapes<MathShape>([
                {
                  id: shape.id,
                  type: "math",
                  props: { latex: e.target.value },
                },
              ]);
            }}
            onPointerDown={stopEventPropagation}
            onKeyDown={(e) => {
              e.stopPropagation();
              if (e.key === "Escape" || e.key === "Enter") {
                e.preventDefault();
                this.editor.setEditingShape(null);
              }
            }}
            className="h-full w-full resize-none rounded border-2 border-blue-400 bg-white p-2 font-mono text-sm outline-none"
            placeholder="Type LaTeX, e.g. x^2 + 3x - 5 = 0"
          />
        </HTMLContainer>
      );
    }

    let html = "";
    try {
      html = katex.renderToString(shape.props.latex || "", {
        throwOnError: false,
        displayMode: true,
      });
    } catch {
      html = shape.props.latex;
    }

    return (
      <HTMLContainer
        style={{
          width: shape.props.w,
          height: shape.props.h,
          display: "flex",
          alignItems: "center",
          padding: 8,
          pointerEvents: "all",
          overflow: "hidden",
        }}
      >
        <div dangerouslySetInnerHTML={{ __html: html }} />
      </HTMLContainer>
    );
  }

  override getIndicatorPath(shape: MathShape) {
    const path = new Path2D();
    path.rect(0, 0, shape.props.w, shape.props.h);
    return path;
  }
}