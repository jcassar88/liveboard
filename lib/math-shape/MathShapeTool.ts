import { StateNode, createShapeId } from "tldraw";
import type { MathShape } from "./MathShapeUtil";

export class MathShapeTool extends StateNode {
  static override id = "math";

  override onPointerDown = () => {
    const { currentPagePoint } = this.editor.inputs;
    const id = createShapeId();

    this.editor.createShapes<MathShape>([
      {
        id,
        type: "math",
        x: currentPagePoint.x,
        y: currentPagePoint.y,
      },
    ]);

    this.editor.setSelectedShapes([id]);
    this.editor.setEditingShape(id);
    this.editor.setCurrentTool("select");
  };
}