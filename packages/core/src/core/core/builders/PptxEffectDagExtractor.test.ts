import { describe, it, expect } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxEffectDagExtractor } from './PptxEffectDagExtractor';
import type { PptxEffectDagExtractorContext } from './PptxEffectDagExtractor';

/**
 * Minimal context whose `parseColor`/`extractColorOpacity` understand a colour
 * *container* node (e.g. `a:solidFill` or a gradient stop) the same way the
 * real codec does: they look inside for an `a:srgbClr` child.
 */
function makeContext(
	overrides: Partial<PptxEffectDagExtractorContext> = {},
): PptxEffectDagExtractorContext {
	return {
		emuPerPx: 9525,
		parseColor: (node: XmlObject | undefined): string | undefined => {
			const clr = node?.['a:srgbClr'] as XmlObject | undefined;
			const val = clr?.['@_val'] ?? node?.['@_val'];
			return val ? `#${String(val)}` : undefined;
		},
		extractColorOpacity: (node: XmlObject | undefined): number | undefined => {
			const clr = node?.['a:srgbClr'] as XmlObject | undefined;
			const alpha = (clr?.['a:alpha'] as XmlObject | undefined)?.['@_val'];
			return alpha === undefined ? undefined : parseInt(String(alpha), 10) / 100000;
		},
		ensureArray: (value: unknown): XmlObject[] => {
			if (Array.isArray(value)) {
				return value as XmlObject[];
			}
			return value === undefined || value === null ? [] : [value as XmlObject];
		},
		...overrides,
	};
}

function dagWith(fillOverlay: XmlObject): XmlObject {
	return { 'a:effectDag': { 'a:fillOverlay': fillOverlay } };
}

describe('extractEffectDagStyle fill-overlay colour', () => {
	it('parses a solidFill overlay colour, opacity and blend mode', () => {
		const extractor = new PptxEffectDagExtractor(makeContext());
		const style = extractor.extractEffectDagStyle(
			dagWith({
				'@_blend': 'mult',
				'a:solidFill': { 'a:srgbClr': { '@_val': 'FF0000', 'a:alpha': { '@_val': '50000' } } },
			}),
		);
		expect(style.dagFillOverlayColor).toBe('#FF0000');
		expect(style.dagFillOverlayOpacity).toBe(0.5);
		expect(style.dagFillOverlayBlend).toBe('mult');
	});

	it('parses the first gradient stop colour for a gradFill overlay', () => {
		const extractor = new PptxEffectDagExtractor(makeContext());
		const style = extractor.extractEffectDagStyle(
			dagWith({
				'@_blend': 'screen',
				'a:gradFill': {
					'a:gsLst': {
						'a:gs': [
							{ 'a:srgbClr': { '@_val': '00FF00' } },
							{ 'a:srgbClr': { '@_val': '0000FF' } },
						],
					},
				},
			}),
		);
		expect(style.dagFillOverlayColor).toBe('#00FF00');
		expect(style.dagFillOverlayBlend).toBe('screen');
	});

	it('leaves the colour unset when the overlay carries no fill child', () => {
		const extractor = new PptxEffectDagExtractor(makeContext());
		const style = extractor.extractEffectDagStyle(dagWith({ '@_blend': 'over' }));
		expect(style.dagFillOverlayColor).toBeUndefined();
		expect(style.dagFillOverlayOpacity).toBeUndefined();
		expect(style.dagFillOverlayBlend).toBe('over');
	});

	it('does not set overlay colour when there is no fillOverlay at all', () => {
		const extractor = new PptxEffectDagExtractor(makeContext());
		const style = extractor.extractEffectDagStyle({ 'a:effectDag': { 'a:grayscl': {} } });
		expect(style.dagFillOverlayColor).toBeUndefined();
		expect(style.dagGrayscale).toBeTruthy();
	});
});
