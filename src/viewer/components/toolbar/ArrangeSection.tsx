import React from "react";
import {
  LuChevronDown,
  LuChevronUp,
  LuClipboardPaste,
  LuCopy,
  LuPaintbrush,
  LuTrash2,
} from "react-icons/lu";
import { cn } from "../../utils";
import type { ElementClipboardPayload } from "../../types";
import type { PptxElement } from "../../../core";
import { gB, gL, grp, ic, pill, ALIGN_BTNS } from "./toolbar-constants";

export interface ArrangeSectionProps {
  canEdit: boolean;
  selectedElement: PptxElement | null;
  clipboardPayload: ElementClipboardPayload | null;
  onAlignElements: (align: string) => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onFlip: (direction: "horizontal" | "vertical") => void;
  onMoveLayer: (direction: string) => void;
  onMoveLayerToEdge: (direction: string) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  formatPainterActive?: boolean;
  onToggleFormatPainter?: () => void;
}

export function ArrangeSection(p: ArrangeSectionProps): React.ReactElement {
  const hasSel = !!p.selectedElement;
  const canMut = hasSel && p.canEdit;

  return (
    <>
      <div className={grp}>
        {ALIGN_BTNS.map((a, i, arr) => (
          <button
            key={a.k}
            type="button"
            onClick={() => p.onAlignElements(a.k)}
            disabled={!canMut}
            className={i < arr.length - 1 ? gB : gL}
            title={`Align ${a.k}`}
          >
            {a.el}
          </button>
        ))}
      </div>
      <div className={grp}>
        <button
          onClick={p.onCopy}
          disabled={!hasSel}
          className={gB}
          title="Copy"
        >
          <LuCopy className={ic} />
        </button>
        <button onClick={p.onCut} disabled={!canMut} className={gB} title="Cut">
          Cut
        </button>
        <button
          onClick={p.onPaste}
          disabled={!p.clipboardPayload || !p.canEdit}
          className={gL}
          title="Paste"
        >
          <LuClipboardPaste className={ic} />
        </button>
      </div>
      {p.onToggleFormatPainter && (
        <button
          type="button"
          onClick={p.onToggleFormatPainter}
          disabled={!p.canEdit}
          className={cn(
            pill,
            p.formatPainterActive
              ? "bg-amber-600 hover:bg-amber-500 text-amber-50"
              : "",
          )}
          title="Format Painter"
        >
          <LuPaintbrush className={ic} />
          Format
        </button>
      )}
      <div className={grp}>
        <button
          type="button"
          onClick={() => p.onFlip("horizontal")}
          disabled={!canMut}
          className={gB}
          title="Flip horizontally"
        >
          Flip H
        </button>
        <button
          type="button"
          onClick={() => p.onFlip("vertical")}
          disabled={!canMut}
          className={gL}
          title="Flip vertically"
        >
          Flip V
        </button>
      </div>
      <div className={grp}>
        <button
          onClick={() => p.onMoveLayer("backward")}
          disabled={!canMut}
          className={gB}
          title="Send backward"
        >
          <LuChevronDown className={ic} />
        </button>
        <button
          onClick={() => p.onMoveLayer("forward")}
          disabled={!canMut}
          className={gB}
          title="Bring forward"
        >
          <LuChevronUp className={ic} />
        </button>
        <button
          onClick={() => p.onMoveLayerToEdge("back")}
          disabled={!canMut}
          className={gB}
          title="Send to back"
        >
          Back
        </button>
        <button
          onClick={() => p.onMoveLayerToEdge("front")}
          disabled={!canMut}
          className={gL}
          title="Bring to front"
        >
          Front
        </button>
      </div>
      <button
        onClick={p.onDuplicate}
        disabled={!canMut}
        className={pill}
        title="Duplicate"
      >
        <LuCopy className={ic} />
        Duplicate
      </button>
      <button
        onClick={p.onDelete}
        disabled={!canMut}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded bg-red-700/80 hover:bg-red-600 disabled:opacity-40 disabled:cursor-not-allowed text-xs transition-colors"
        title="Delete"
      >
        <LuTrash2 className={ic} />
        Delete
      </button>
    </>
  );
}
