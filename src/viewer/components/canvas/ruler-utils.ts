/**
 * Ruler utility constants, types, and tick generation logic.
 *
 * Extracted from Ruler.tsx to keep each file under 300 lines.
 */

/* ------------------------------------------------------------------ */
/*  Constants                                                         */
/* ------------------------------------------------------------------ */

/** CSS pixels per inch at 96 dpi. */
export const PX_PER_INCH = 96;
/** CSS pixels per centimetre (96 / 2.54). */
export const PX_PER_CM = 96 / 2.54;

/** Ruler strip thickness in CSS pixels. */
export const RULER_THICKNESS = 20;

/** Font size for numbers on the ruler. */
export const RULER_FONT_SIZE = 10;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

/** The unit system used for ruler display. */
export type RulerUnit = "inches" | "centimetres";

export interface Tick {
  /** Position along the ruler in scaled CSS pixels from the slide origin. */
  position: number;
  /** Label to display (empty for minor ticks). */
  label: string;
  /** Whether this is a major (numbered) tick. */
  isMajor: boolean;
}

/* ------------------------------------------------------------------ */
/*  Tick generation                                                   */
/* ------------------------------------------------------------------ */

/**
 * Generates tick marks for a single ruler axis.
 *
 * @param slideLengthPx  The slide dimension (width or height) in CSS px.
 * @param scale          The current editorScale.
 * @param unit           Ruler unit system.
 */
export function generateTicks(
  slideLengthPx: number,
  scale: number,
  unit: RulerUnit,
): Tick[] {
  const pxPerUnit = unit === "inches" ? PX_PER_INCH : PX_PER_CM;
  const scaledPxPerUnit = pxPerUnit * scale;

  // Determine minor subdivisions based on zoom so tick marks stay readable.
  // With inches: ideally 8 minor divisions (1/8"). With cm: 10 (1mm).
  // Collapse subdivisions when ticks would be too dense.
  const baseSubdivisions = unit === "inches" ? 8 : 10;
  let subdivisions = baseSubdivisions;

  // Collapse subdivisions when they'd be less than ~4 px apart.
  const minTickSpacingPx = 4;
  while (
    subdivisions > 1 &&
    scaledPxPerUnit / subdivisions < minTickSpacingPx
  ) {
    subdivisions = Math.max(1, Math.floor(subdivisions / 2));
    // Prevent infinite loop on tiny scale:
    if (subdivisions <= 1) break;
  }

  // Also determine if we need to skip major labels (for very tiny zoom):
  let majorStep = 1; // in unit-space (every 1 inch / 1 cm)
  const minMajorSpacingPx = 30;
  while (scaledPxPerUnit * majorStep < minMajorSpacingPx) {
    majorStep *= 2;
  }

  const totalUnits = slideLengthPx / pxPerUnit;
  const totalSubdivisions = Math.ceil(totalUnits * subdivisions);
  const ticks: Tick[] = [];

  for (let i = 0; i <= totalSubdivisions; i++) {
    const unitValue = i / subdivisions;
    const slidePx = unitValue * pxPerUnit;
    if (slidePx > slideLengthPx + 0.5) break;

    const position = slidePx * scale;
    const isSubdivisionMajor = i % subdivisions === 0;
    const unitIndex = Math.round(unitValue);
    const showLabel = isSubdivisionMajor && unitIndex % majorStep === 0;

    ticks.push({
      position,
      label: showLabel ? String(unitIndex) : "",
      isMajor: isSubdivisionMajor,
    });
  }

  return ticks;
}
