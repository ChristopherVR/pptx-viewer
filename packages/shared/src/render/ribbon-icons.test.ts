// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';

import { createRibbonControlIcon, RIBBON_CONTROL_ICONS } from './ribbon-icons';

describe('canonical Home ribbon icons', () => {
	it.each(Object.keys(RIBBON_CONTROL_ICONS))(
		'renders visible artwork with the common 24-unit geometry: %s',
		(control) => {
			const svg = createRibbonControlIcon(document, control);
			expect(svg.getAttribute('viewBox')).toBe('0 0 24 24');
			expect(svg.childElementCount).toBeGreaterThan(0);
			for (const rectangle of svg.querySelectorAll('rect')) {
				expect(Number(rectangle.getAttribute('width'))).toBeGreaterThan(0);
				expect(Number(rectangle.getAttribute('height'))).toBeGreaterThan(0);
			}
		},
	);

	it('keeps strokes and text-shadow layers from the reference artwork', () => {
		expect(
			createRibbonControlIcon(document, 'home.font.characterSpacing').getAttribute('stroke-width'),
		).toBe('1.5');
		const texts = createRibbonControlIcon(document, 'home.font.shadow').querySelectorAll('text');
		expect(texts).toHaveLength(2);
		expect(texts[1].getAttribute('stroke-width')).toBe('0.5');
	});
});
