/**
 * Eyedropper colour sampler.
 *
 * Renders the current slide canvas to an offscreen canvas, then reads
 * the pixel colour at the specified coordinates.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EyedropperResult {
  hex: string;
  r: number;
  g: number;
  b: number;
}

// ---------------------------------------------------------------------------
// Core sampling
// ---------------------------------------------------------------------------

/**
 * Sample the colour of a pixel from a rendered slide element.
 *
 * @param slideElement - The DOM element containing the rendered slide.
 * @param clientX - Pointer X in client coordinates.
 * @param clientY - Pointer Y in client coordinates.
 * @returns The sampled colour, or null if sampling failed.
 */
export function sampleColorFromSlide(
  slideElement: HTMLElement,
  clientX: number,
  clientY: number,
): EyedropperResult | null {
  const rect = slideElement.getBoundingClientRect();
  const x = Math.round(clientX - rect.left);
  const y = Math.round(clientY - rect.top);

  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) {
    return null;
  }

  // Try using the EyeDropper API if available (modern Chrome/Edge)
  // Fallback: use html2canvas-style approach with getComputedStyle
  // For now, we'll use a canvas-based approach

  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  // Try to find a canvas element within the slide for direct sampling
  const existingCanvas = slideElement.querySelector("canvas");
  if (existingCanvas) {
    try {
      const srcCtx = existingCanvas.getContext("2d");
      if (srcCtx) {
        const scaleX = existingCanvas.width / existingCanvas.clientWidth;
        const scaleY = existingCanvas.height / existingCanvas.clientHeight;
        const canvasRect = existingCanvas.getBoundingClientRect();
        const cx = Math.round((clientX - canvasRect.left) * scaleX);
        const cy = Math.round((clientY - canvasRect.top) * scaleY);
        const pixel = srcCtx.getImageData(cx, cy, 1, 1).data;
        return pixelToResult(pixel);
      }
    } catch {
      // Cross-origin or tainted canvas — fall through
    }
  }

  // Fallback: sample the background colour from the element at the pointer
  const targetEl = document.elementFromPoint(clientX, clientY);
  if (targetEl instanceof HTMLElement) {
    const computed = getComputedStyle(targetEl);
    const bgColor = computed.backgroundColor;
    if (
      bgColor &&
      bgColor !== "transparent" &&
      bgColor !== "rgba(0, 0, 0, 0)"
    ) {
      return parseRgbaString(bgColor);
    }
    // Try fill for SVG elements
    const fill = computed.fill;
    if (fill && fill !== "none" && fill !== "transparent") {
      return parseRgbaString(fill);
    }
    // Try color
    const color = computed.color;
    if (color) {
      return parseRgbaString(color);
    }
  }

  return null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pixelToResult(data: Uint8ClampedArray): EyedropperResult {
  const r = data[0];
  const g = data[1];
  const b = data[2];
  return {
    r,
    g,
    b,
    hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
  };
}

function parseRgbaString(str: string): EyedropperResult | null {
  const match = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!match) return null;
  const r = parseInt(match[1], 10);
  const g = parseInt(match[2], 10);
  const b = parseInt(match[3], 10);
  return {
    r,
    g,
    b,
    hex: `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`,
  };
}

/**
 * Use the native EyeDropper API if available (Chrome 95+, Edge 95+).
 * Returns a promise that resolves to the sampled hex colour, or null
 * if the API is unavailable or the user cancels.
 */
export async function useNativeEyeDropper(): Promise<string | null> {
  if (!("EyeDropper" in window)) return null;

  try {
    // EyeDropper API
    const dropper = new (
      window as Record<string, unknown> & {
        EyeDropper: new () => { open: () => Promise<{ sRGBHex: string }> };
      }
    ).EyeDropper();
    const result = await dropper.open();
    return result.sRGBHex;
  } catch {
    // User cancelled or API error
    return null;
  }
}
