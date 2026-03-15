/**
 * SVG pattern generation for OOXML pattern fill presets.
 *
 * Each preset maps to a tiled inline SVG data URI that closely approximates
 * the corresponding ECMA-376 pattern (ST_PresetPatternVal). Patterns use
 * two colours: foreground (`fg`) drawn on top of a background (`bg`) fill.
 *
 * Tile sizes are kept small (4-16 px) for performance when used as CSS
 * `background-image` data URIs.
 *
 * Reference: ECMA-376 Part 1, section 20.1.10.33 (ST_PresetPatternVal)
 */
export function getPatternSvg(
  preset: string,
  fg: string,
  bg: string,
): string | null {
  const s = 8; // default pattern tile size
  const xmlns = "http://www.w3.org/2000/svg";
  const svg = (w: number, h: number, inner: string) =>
    `<svg xmlns="${xmlns}" width="${w}" height="${h}">${inner}</svg>`;
  const rect = (x: number, y: number, w: number, h: number, fill: string) =>
    `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"/>`;
  const bgRect = (w: number, h: number) => rect(0, 0, w, h, bg);
  const line = (
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    stroke: string,
    sw: number,
    extra = "",
  ) =>
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${stroke}" stroke-width="${sw}"${extra}/>`;
  const circle = (cx: number, cy: number, r: number, fill: string) =>
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"/>`;

  switch (preset) {
    // ── Percentage fills ──────────────────────────────────────────────
    case "pct5":
      return svg(s, s, bgRect(s, s) + rect(0, 0, 1, 1, fg));
    case "pct10":
      return svg(
        s,
        s,
        bgRect(s, s) + rect(0, 0, 1, 1, fg) + rect(4, 4, 1, 1, fg),
      );
    case "pct20":
      return svg(
        4,
        4,
        bgRect(4, 4) + rect(0, 0, 1, 1, fg) + rect(2, 2, 1, 1, fg),
      );
    case "pct25":
      return svg(
        4,
        4,
        bgRect(4, 4) +
          rect(0, 0, 1, 1, fg) +
          rect(2, 0, 1, 1, fg) +
          rect(1, 2, 1, 1, fg) +
          rect(3, 2, 1, 1, fg),
      );
    case "pct30":
      return svg(
        4,
        4,
        bgRect(4, 4) +
          rect(0, 0, 1, 1, fg) +
          rect(2, 0, 1, 1, fg) +
          rect(1, 1, 1, 1, fg) +
          rect(3, 1, 1, 1, fg) +
          rect(0, 2, 1, 1, fg) +
          rect(2, 2, 1, 1, fg),
      );
    case "pct40":
      return svg(
        4,
        4,
        bgRect(4, 4) +
          rect(0, 0, 2, 1, fg) +
          rect(1, 1, 1, 1, fg) +
          rect(3, 1, 1, 1, fg) +
          rect(0, 2, 2, 1, fg) +
          rect(1, 3, 1, 1, fg) +
          rect(3, 3, 1, 1, fg),
      );
    case "pct50":
      return svg(
        2,
        2,
        bgRect(2, 2) + rect(0, 0, 1, 1, fg) + rect(1, 1, 1, 1, fg),
      );
    case "pct60":
      return svg(
        4,
        4,
        rect(0, 0, 4, 4, fg) + rect(0, 0, 2, 1, bg) + rect(1, 2, 2, 1, bg),
      );
    case "pct70":
      return svg(
        4,
        4,
        rect(0, 0, 4, 4, fg) +
          rect(0, 0, 1, 1, bg) +
          rect(2, 0, 1, 1, bg) +
          rect(1, 2, 1, 1, bg) +
          rect(3, 2, 1, 1, bg),
      );
    case "pct75":
      return svg(
        4,
        4,
        rect(0, 0, 4, 4, fg) + rect(0, 0, 1, 1, bg) + rect(2, 2, 1, 1, bg),
      );
    case "pct80":
      return svg(4, 4, rect(0, 0, 4, 4, fg) + rect(0, 0, 1, 1, bg));
    case "pct90":
      return svg(s, s, rect(0, 0, s, s, fg) + rect(0, 0, 1, 1, bg));

    // ── Horizontal lines ─────────────────────────────────────────────
    case "horz":
      return svg(s, s, bgRect(s, s) + rect(0, 3, s, 2, fg));
    case "ltHorz":
      return svg(s, s, bgRect(s, s) + rect(0, 0, s, 1, fg));
    case "dkHorz":
      return svg(s, s, bgRect(s, s) + rect(0, 0, s, 4, fg));
    case "narHorz":
      return svg(
        s,
        4,
        bgRect(s, 4) + rect(0, 0, s, 1, fg) + rect(0, 2, s, 1, fg),
      );
    case "wdHorz":
      return svg(s, 12, bgRect(s, 12) + rect(0, 0, s, 2, fg));

    // ── Vertical lines ───────────────────────────────────────────────
    case "vert":
      return svg(s, s, bgRect(s, s) + rect(3, 0, 2, s, fg));
    case "ltVert":
      return svg(s, s, bgRect(s, s) + rect(0, 0, 1, s, fg));
    case "dkVert":
      return svg(s, s, bgRect(s, s) + rect(0, 0, 4, s, fg));
    case "narVert":
      return svg(
        4,
        s,
        bgRect(4, s) + rect(0, 0, 1, s, fg) + rect(2, 0, 1, s, fg),
      );
    case "wdVert":
      return svg(12, s, bgRect(12, s) + rect(0, 0, 2, s, fg));

    // ── Dash lines ───────────────────────────────────────────────────
    case "dashHorz":
      return svg(s, 4, bgRect(s, 4) + rect(0, 0, 4, 1, fg));
    case "dashVert":
      return svg(4, s, bgRect(4, s) + rect(0, 0, 1, 4, fg));

    // ── Cross / grid ─────────────────────────────────────────────────
    case "cross":
      return svg(
        s,
        s,
        bgRect(s, s) + rect(3, 0, 2, s, fg) + rect(0, 3, s, 2, fg),
      );

    // ── Diagonal lines (down) ────────────────────────────────────────
    case "dnDiag":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, 0, s, s, fg, 2) +
          line(-s, 0, 0, s, fg, 2) +
          line(s, 0, s * 2, s, fg, 2),
      );
    case "ltDnDiag":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, 0, s, s, fg, 1) +
          line(-s, 0, 0, s, fg, 1) +
          line(s, 0, s * 2, s, fg, 1),
      );
    case "dkDnDiag":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, 0, s, s, fg, 3) +
          line(-s, 0, 0, s, fg, 3) +
          line(s, 0, s * 2, s, fg, 3),
      );
    case "wdDnDiag":
      return svg(
        12,
        12,
        bgRect(12, 12) +
          line(0, 0, 12, 12, fg, 4) +
          line(-12, 0, 0, 12, fg, 4) +
          line(12, 0, 24, 12, fg, 4),
      );
    case "dashDnDiag":
      return svg(
        s,
        s,
        bgRect(s, s) + line(0, 0, s, s, fg, 1, ' stroke-dasharray="4,4"'),
      );

    // ── Diagonal lines (up) ──────────────────────────────────────────
    case "upDiag":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, s, s, 0, fg, 2) +
          line(-s, s, 0, 0, fg, 2) +
          line(s, s, s * 2, 0, fg, 2),
      );
    case "ltUpDiag":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, s, s, 0, fg, 1) +
          line(-s, s, 0, 0, fg, 1) +
          line(s, s, s * 2, 0, fg, 1),
      );
    case "dkUpDiag":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, s, s, 0, fg, 3) +
          line(-s, s, 0, 0, fg, 3) +
          line(s, s, s * 2, 0, fg, 3),
      );
    case "wdUpDiag":
      return svg(
        12,
        12,
        bgRect(12, 12) +
          line(0, 12, 12, 0, fg, 4) +
          line(-12, 12, 0, 0, fg, 4) +
          line(12, 12, 24, 0, fg, 4),
      );
    case "dashUpDiag":
      return svg(
        s,
        s,
        bgRect(s, s) + line(0, s, s, 0, fg, 1, ' stroke-dasharray="4,4"'),
      );

    // ── Diagonal cross ───────────────────────────────────────────────
    case "diagCross":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, 0, s, s, fg, 1) +
          line(-s, 0, 0, s, fg, 1) +
          line(s, 0, s * 2, s, fg, 1) +
          line(0, s, s, 0, fg, 1) +
          line(-s, s, 0, 0, fg, 1) +
          line(s, s, s * 2, 0, fg, 1),
      );

    // ── Checkerboard ─────────────────────────────────────────────────
    case "smCheck":
      return svg(
        4,
        4,
        bgRect(4, 4) + rect(0, 0, 2, 2, fg) + rect(2, 2, 2, 2, fg),
      );
    case "lgCheck":
      return svg(
        s,
        s,
        bgRect(s, s) + rect(0, 0, 4, 4, fg) + rect(4, 4, 4, 4, fg),
      );

    // ── Grids ────────────────────────────────────────────────────────
    case "smGrid":
      return svg(
        s,
        s,
        bgRect(s, s) + rect(0, 0, s, 1, fg) + rect(0, 0, 1, s, fg),
      );
    case "lgGrid":
      return svg(
        16,
        16,
        bgRect(16, 16) + rect(0, 0, 16, 1, fg) + rect(0, 0, 1, 16, fg),
      );
    case "dotGrid":
      return svg(
        s,
        s,
        bgRect(s, s) +
          circle(0, 0, 0.5, fg) +
          circle(4, 0, 0.5, fg) +
          circle(0, 4, 0.5, fg) +
          circle(4, 4, 0.5, fg) +
          rect(0, 0, s, 0.5, fg) +
          rect(0, 0, 0.5, s, fg),
      );

    // ── Confetti ─────────────────────────────────────────────────────
    case "smConfetti":
      return svg(
        s,
        s,
        bgRect(s, s) +
          rect(1, 0, 1, 1, fg) +
          rect(5, 1, 1, 1, fg) +
          rect(3, 3, 1, 1, fg) +
          rect(7, 2, 1, 1, fg) +
          rect(0, 5, 1, 1, fg) +
          rect(4, 6, 1, 1, fg) +
          rect(2, 7, 1, 1, fg) +
          rect(6, 5, 1, 1, fg),
      );
    case "lgConfetti":
      return svg(
        s,
        s,
        bgRect(s, s) +
          rect(0, 0, 2, 2, fg) +
          rect(5, 1, 2, 2, fg) +
          rect(2, 4, 2, 2, fg) +
          rect(6, 5, 2, 2, fg),
      );

    // ── Brick ────────────────────────────────────────────────────────
    case "horzBrick":
      return svg(
        s,
        s,
        bgRect(s, s) +
          rect(0, 0, s, 1, fg) +
          rect(0, 0, 1, 4, fg) +
          rect(0, 4, s, 1, fg) +
          rect(4, 4, 1, 4, fg),
      );
    case "diagBrick":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, 4, 4, 0, fg, 1) +
          line(4, s, s, 4, fg, 1) +
          line(0, s, s, 0, fg, 1),
      );

    // ── Diamond ──────────────────────────────────────────────────────
    case "solidDmnd":
      return svg(
        s,
        s,
        bgRect(s, s) + `<polygon points="4,0 8,4 4,8 0,4" fill="${fg}"/>`,
      );
    case "openDmnd":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(4, 0, s, 4, fg, 1) +
          line(s, 4, 4, s, fg, 1) +
          line(4, s, 0, 4, fg, 1) +
          line(0, 4, 4, 0, fg, 1),
      );
    case "dotDmnd":
      return svg(
        s,
        s,
        bgRect(s, s) +
          circle(4, 0, 0.75, fg) +
          circle(s, 4, 0.75, fg) +
          circle(4, s, 0.75, fg) +
          circle(0, 4, 0.75, fg) +
          circle(4, 4, 0.75, fg),
      );

    // ── Plaid ────────────────────────────────────────────────────────
    case "plaid":
      return svg(
        s,
        s,
        bgRect(s, s) +
          rect(0, 0, 4, 4, fg) +
          rect(0, 0, s, 1, fg) +
          rect(0, 2, s, 1, fg) +
          rect(0, 0, 1, s, fg) +
          rect(2, 0, 1, s, fg),
      );

    // ── Sphere ───────────────────────────────────────────────────────
    // Uses a radial gradient to simulate the 3D sphere highlight effect.
    case "sphere": {
      const defs =
        `<defs><radialGradient id="sph" cx="35%" cy="35%" r="60%">` +
        `<stop offset="0%" stop-color="${bg}" stop-opacity="0.8"/>` +
        `<stop offset="100%" stop-color="${fg}" stop-opacity="1"/>` +
        `</radialGradient></defs>`;
      return svg(
        s,
        s,
        bgRect(s, s) + defs + `<circle cx="4" cy="4" r="3.5" fill="url(#sph)"/>`,
      );
    }

    // ── Weave ────────────────────────────────────────────────────────
    // Approximates a basket-weave pattern with interlacing diagonal stripes.
    case "weave":
      return svg(
        s,
        s,
        bgRect(s, s) +
          // top-left to center diagonals
          line(0, 0, 4, 4, fg, 1.5) +
          line(4, 4, 0, s, fg, 1.5) +
          // top-right to center diagonals
          line(s, 0, 4, 4, fg, 1.5) +
          line(4, 4, s, s, fg, 1.5) +
          // cross-hatching to create woven appearance
          line(4, 0, s, 4, fg, 1.5) +
          line(0, 4, 4, s, fg, 1.5),
      );

    // ── Divot ────────────────────────────────────────────────────────
    // Small plus/cross marks scattered across the tile.
    case "divot":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(2, 1, 2, 3, fg, 1) +
          line(1, 2, 3, 2, fg, 1) +
          line(6, 5, 6, 7, fg, 1) +
          line(5, 6, 7, 6, fg, 1),
      );

    // ── Shingle ──────────────────────────────────────────────────────
    // Overlapping diagonal roof-tile pattern with a horizontal baseline.
    case "shingle":
      return svg(
        s,
        s,
        bgRect(s, s) +
          line(0, 0, s, s, fg, 1) +
          line(0, s, 4, 4, fg, 1) +
          rect(0, 7, s, 1, fg),
      );

    // ── Wave ─────────────────────────────────────────────────────────
    // Repeating sine-wave curves filling the tile vertically.
    case "wave":
      return svg(
        s,
        s,
        bgRect(s, s) +
          `<path d="M0,2 Q2,0 4,2 Q6,4 8,2" stroke="${fg}" stroke-width="1" fill="none"/>` +
          `<path d="M0,6 Q2,4 4,6 Q6,8 8,6" stroke="${fg}" stroke-width="1" fill="none"/>`,
      );

    // ── Trellis ──────────────────────────────────────────────────────
    case "trellis":
      return svg(
        4,
        4,
        bgRect(4, 4) +
          rect(0, 0, 4, 1, fg) +
          rect(0, 2, 4, 1, fg) +
          rect(0, 0, 1, 4, fg) +
          rect(2, 0, 1, 4, fg),
      );

    // ── ZigZag ───────────────────────────────────────────────────────
    case "zigZag":
      return svg(
        s,
        s,
        bgRect(s, s) +
          `<path d="M0,4 L2,0 L4,4 L6,0 L8,4" stroke="${fg}" stroke-width="1" fill="none"/>` +
          `<path d="M0,8 L2,4 L4,8 L6,4 L8,8" stroke="${fg}" stroke-width="1" fill="none"/>`,
      );

    default:
      return null;
  }
}
