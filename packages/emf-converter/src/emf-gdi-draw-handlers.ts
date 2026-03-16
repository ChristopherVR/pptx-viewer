/**
 * EMF GDI basic shape, text, and bitmap record handlers.
 *
 * Delegates to specialised modules:
 * - emf-gdi-draw-shapes      (MoveTo, LineTo, Rectangle, RoundRect, Ellipse, Arc family)
 * - emf-gdi-draw-text-bitmap  (ExtTextOutW, BitBlt, StretchDIBits, IntersectClipRect)
 */

import { handleEmfGdiShapeRecord } from './emf-gdi-draw-shapes';
import { handleEmfGdiTextBitmapRecord } from './emf-gdi-draw-text-bitmap';
import type { EmfGdiReplayCtx } from './emf-types';

// ---------------------------------------------------------------------------
// Main handler — tries shape records first, then text/bitmap/clip records.
// ---------------------------------------------------------------------------

export function handleEmfGdiDrawRecord(
	rCtx: EmfGdiReplayCtx,
	recType: number,
	offset: number,
	dataOff: number,
	recSize: number,
): boolean {
	return (
		handleEmfGdiShapeRecord(rCtx, recType, dataOff, recSize) ||
		handleEmfGdiTextBitmapRecord(rCtx, recType, offset, dataOff, recSize)
	);
}
