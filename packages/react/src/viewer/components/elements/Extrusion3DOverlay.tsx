/**
 * Extrusion3DOverlay — renders CSS 3D extrusion side faces for shapes
 * with `a:sp3d` extrusion depth.
 *
 * This component creates the side panels (top, bottom, left, right) of a
 * 3D-extruded shape using CSS 3D transforms (`transform-style: preserve-3d`,
 * `perspective`, `rotateX/Y`). Each panel is a plain `<div>` positioned in
 * 3D space around the shape's bounding box to form the sides of the extrusion.
 *
 * The front face of the shape (the original content) gets a `translateZ`
 * offset applied through inline styles so it sits at the front of the
 * extrusion volume.
 *
 * This is purely visual — no interactivity on the panels.
 */
import React from "react";

import type {
  Extrusion3DData,
  ExtrusionPanel,
} from "../../utils/shape-visual-3d";

interface Extrusion3DOverlayProps {
  /** Extrusion data computed by `build3DExtrusionData`. */
  data: Extrusion3DData;
}

/**
 * Renders the 3D extrusion side panels as absolutely-positioned divs
 * within a `preserve-3d` container. This component should be rendered
 * as a sibling or wrapper alongside the shape's main content.
 */
export const Extrusion3DOverlay: React.FC<Extrusion3DOverlayProps> = React.memo(
  function Extrusion3DOverlayInner({ data }) {
    if (!data.hasExtrusion || data.panels.length === 0) {
      return null;
    }

    return (
      <div
        className="extrusion-3d-wrapper"
        style={data.wrapperStyle}
        aria-hidden="true"
      >
        {data.panels.map((panel: ExtrusionPanel) => (
          <div
            key={panel.side}
            className="extrusion-3d-panel"
            style={panel.style}
          />
        ))}
        {data.materialOverlay && (
          <div
            className="extrusion-3d-material-overlay"
            style={{
              position: "absolute",
              inset: 0,
              backgroundImage: data.materialOverlay,
              pointerEvents: "none",
              borderRadius: "inherit",
              transform: data.frontFaceStyle.transform,
              transformStyle: "preserve-3d",
              backfaceVisibility: "hidden",
            }}
          />
        )}
      </div>
    );
  },
);
