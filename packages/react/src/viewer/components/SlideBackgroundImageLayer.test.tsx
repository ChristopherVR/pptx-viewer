import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';

import { SlideBackgroundImageLayer } from './SlideBackgroundImageLayer';

describe('slide background image layer', () => {
	it('preserves background blip alpha without applying it twice', () => {
		const html = renderToStaticMarkup(
			<SlideBackgroundImageLayer
				slide={{
					id: 'ppt/slides/slide1.xml',
					rId: 'rId1',
					slideNumber: 1,
					elements: [],
					backgroundImage: 'data:image/png;base64,abc',
					backgroundImageProperties: {
						cropLeft: 0.1,
						imageEffects: { alphaModFix: 50, grayscale: true },
					},
				}}
			/>,
		);

		expect(html).toContain('opacity:0.5');
		expect(html).toContain('grayscale(100%)');
		expect(html).toContain('scale(1.111111');
		expect(html).not.toContain('imgalpha-');
	});

	// Regression for issue #286 (alpha applied twice: SVG filter x CSS opacity).
	it('applies alphaModFix exactly once when combined with another advanced alpha effect', () => {
		const html = renderToStaticMarkup(
			<SlideBackgroundImageLayer
				slide={{
					id: 'ppt/slides/slide1.xml',
					rId: 'rId1',
					slideNumber: 1,
					elements: [],
					backgroundImage: 'data:image/png;base64,abc',
					backgroundImageProperties: {
						imageEffects: { alphaModFix: 40, biLevel: 30 },
					},
				}}
			/>,
		);

		// The alpha filter IS emitted here (biLevel needs it), but opacity must
		// still be the sole carrier of alphaModFix's own multiplier.
		expect(html).toContain('opacity:0.4');
		expect(html).toContain('imgalpha-');
		expect(html).not.toContain('0 0 0 0.4 0');
	});

	it('renders nothing without a background image', () => {
		expect(
			renderToStaticMarkup(
				<SlideBackgroundImageLayer
					slide={{ id: 'slide', rId: 'rId1', slideNumber: 1, elements: [] }}
				/>,
			),
		).toBe('');
	});
});
