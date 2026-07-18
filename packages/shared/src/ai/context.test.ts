import { describe, expect, it } from 'vitest';

import {
	buildDeckOutline,
	buildSlideMarkdown,
	clampToTokenBudget,
	estimateTokens,
	slideTitle,
} from './context';
import { makeMockBridge } from './mock-bridge';

describe('deck context builders', () => {
	it('builds a whole-deck outline with titles and element breakdowns', () => {
		const bridge = makeMockBridge();
		const outline = buildDeckOutline(bridge.getSlides(), bridge.getDeckMeta());
		expect(outline).toContain('2 slide(s)');
		expect(outline).toContain('Slide 1: Title One');
		expect(outline).toContain('2 text');
		expect(outline).toContain('Slide 2: Title Two');
	});

	it('respects the maxSlides cap', () => {
		const bridge = makeMockBridge();
		const outline = buildDeckOutline(bridge.getSlides(), bridge.getDeckMeta(), { maxSlides: 1 });
		expect(outline).toContain('Slide 1');
		expect(outline).not.toContain('Slide 2:');
		expect(outline).toContain('and 1 more');
	});

	it('reads a best-effort slide title', () => {
		const bridge = makeMockBridge();
		expect(slideTitle(bridge.getSlides()[0])).toBe('Title One');
	});

	it('estimates and clamps to a token budget', () => {
		expect(estimateTokens('12345678')).toBe(2);
		const clamped = clampToTokenBudget('x'.repeat(100), 5);
		expect(clamped).toContain('truncated');
		expect(clamped.length).toBeLessThan(100 + 40);
	});

	it('renders a single slide to markdown text', async () => {
		const bridge = makeMockBridge();
		const md = await buildSlideMarkdown(bridge.getSlides(), 0, bridge.getDeckMeta());
		expect(md).toBeTypeOf('string');
		expect(md).toContain('Title One');
	});
});
