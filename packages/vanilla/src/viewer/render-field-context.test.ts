import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { buildRenderFieldContext } from './render-field-context';

/**
 * Regression: this binding assembled the field context by hand and never set
 * `slideTitle`, so a `slidetitle` field run kept its authored placeholder while
 * React / Vue / Angular / Svelte all printed the slide's real title.
 */

function slide(elements: unknown[] = []): PptxSlide {
	return { id: 's1', slideNumber: 3, elements } as unknown as PptxSlide;
}

function titleElement(text: string, placeholderType = 'title'): unknown {
	return { id: 't1', type: 'text', x: 0, y: 0, width: 100, height: 40, text, placeholderType };
}

const state = {
	headerFooter: { footerText: 'Confidential', headerText: 'Draft', dateTimeText: '2026-07-31' },
	customProperties: [{ name: 'Project', value: 'Beta' }],
} as unknown as Parameters<typeof buildRenderFieldContext>[0];

describe('buildRenderFieldContext', () => {
	it('resolves the slide title from the first title placeholder', () => {
		expect(buildRenderFieldContext(state, slide([titleElement('Results')])).slideTitle).toBe(
			'Results',
		);
	});

	it('resolves a centre-title placeholder too', () => {
		const ctx = buildRenderFieldContext(state, slide([titleElement('Cover', 'ctrTitle')]));
		expect(ctx.slideTitle).toBe('Cover');
	});

	it('leaves the slide title unset when the slide has no title placeholder', () => {
		const body = { id: 'b1', type: 'text', text: 'Body', placeholderType: 'body' };
		expect(buildRenderFieldContext(state, slide([body])).slideTitle).toBeUndefined();
	});

	it('carries the per-slide number and the deck-wide header/footer + properties', () => {
		const ctx = buildRenderFieldContext(state, slide([titleElement('Results')]));
		expect(ctx.slideNumber).toBe(3);
		expect(ctx.footerText).toBe('Confidential');
		expect(ctx.headerText).toBe('Draft');
		expect(ctx.dateTimeText).toBe('2026-07-31');
		expect(ctx.customProperties).toStrictEqual([{ name: 'Project', value: 'Beta' }]);
	});
});
