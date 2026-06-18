import { describe, expect, it } from 'vitest';

import { buildActionButtonElement, isActionButton } from './action-buttons';

interface ActionShape {
	type: string;
	shapeType: string;
	text: string;
	width: number;
	height: number;
	shapeStyle: { fillColor: string };
	actionClick?: { action: string; tooltip: string; highlightClick: boolean };
}

describe('action-buttons', () => {
	it('recognises known action buttons', () => {
		expect(isActionButton('actionButtonForwardNext')).toBeTruthy();
		expect(isActionButton('rect')).toBeFalsy();
	});

	it('builds a nav action button with a slide-jump actionClick', () => {
		const el = buildActionButtonElement('actionButtonForwardNext', 'a1') as unknown as ActionShape;
		expect(el.type).toBe('shape');
		expect(el.shapeType).toBe('actionButtonForwardNext');
		expect(el.text).toBe('Forward / Next');
		expect(el.shapeStyle.fillColor).toBe('#4472C4');
		expect(el.actionClick?.action).toBe('ppaction://hlinkshowjump?jump=nextslide');
		expect(el.actionClick?.highlightClick).toBeTruthy();
	});

	it('builds non-nav buttons without an actionClick', () => {
		const el = buildActionButtonElement('actionButtonBlank', 'a2') as unknown as ActionShape;
		expect(el.text).toBe('Custom');
		expect(el.actionClick).toBeUndefined();
	});

	it('returns null for an unknown shape type', () => {
		expect(buildActionButtonElement('unknownButton', 'a3')).toBeNull();
	});
});
