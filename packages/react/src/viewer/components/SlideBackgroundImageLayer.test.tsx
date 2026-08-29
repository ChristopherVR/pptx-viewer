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
