import React from "react";

import type {
  PptxElement,
  PptxSmartArtNode,
  SmartArtStyle,
} from "../../core";
import { colour, nodeOpacity, styleShadow } from "./smartart-helpers";

/** basicMatrix — grid of coloured cells. */
export function renderMatrix(
  element: PptxElement,
  nodes: PptxSmartArtNode[],
  palette: string[],
  style: SmartArtStyle,
): React.ReactNode {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  const rows = Math.ceil(nodes.length / cols);
  const shadow = styleShadow(style);
  return (
    <div
      className="w-full h-full p-2 pointer-events-none grid gap-1.5"
      style={{
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        gridTemplateRows: `repeat(${rows}, 1fr)`,
        filter: shadow,
      }}
    >
      {nodes.map((node, i) => (
        <div
          key={`${element.id}-matrix-${node.id}-${i}`}
          className="rounded-md flex items-center justify-center text-[10px] text-white font-medium truncate px-1"
          style={{
            backgroundColor: colour(i, palette),
            opacity: nodeOpacity(i, nodes.length, style),
          }}
        >
          {node.text}
        </div>
      ))}
    </div>
  );
}
