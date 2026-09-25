/**
 * Label colour from a cached SmartArt drawing shape's style matrix reference.
 *
 * PowerPoint caches every `dsp:sp` with a `dsp:style` whose `a:fontRef`
 * carries the label's resolved colour (`lt1` for most quick styles, `dk1` for
 * Metallic Scene and Subtle Effect, `tx1` for Basic Venn). The runs
 * themselves rarely carry an `a:solidFill`, so without this the renderers had
 * to guess a contrast colour and drew Metallic's black labels white.
 *
 * @module pptx-runtime/smartart-drawing-shape-font-ref
 */

import type { XmlObject } from '../../types';
import type { DrawingShapeStyleDeps } from './smartart-drawing-shape-style';

/**
 * The colour of `dsp:style/a:fontRef` on a cached drawing shape, or
 * `undefined` when the shape has no style or the reference names no colour.
 */
export function extractDrawingShapeFontRefColor(
	sp: XmlObject | undefined,
	deps: Pick<DrawingShapeStyleDeps, 'getChild' | 'parseColor'>,
): string | undefined {
	const fontRef = deps.getChild(deps.getChild(sp, 'style'), 'fontRef');
	return fontRef ? (deps.parseColor(fontRef) ?? undefined) : undefined;
}
