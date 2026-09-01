import type { ExcalidrawElement } from "@excalidraw/excalidraw/element/types";
import type { AppState } from "@excalidraw/excalidraw/types";

export type ExcalidrawScene = {
  elements: readonly ExcalidrawElement[];
  appState?: Partial<AppState>;
};