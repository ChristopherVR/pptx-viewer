import type { PptxElement } from 'pptx-viewer-core';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';

import { renderSingleSegment } from './text-segment-render';

/**
 * issue #132 - the per-script font span clobbered the fallback chain.
 *
 * React is the only binding that splits a run into per-script `<span>`s so an
 * `a:ea` / `a:cs` typeface can apply to just its own Unicode range. The
 * `latin` entry carried the PANOSE-substituted chain while `eastAsia` carried
 * the RAW authored name, which broke it twice over:
 *
 *  1. The "are these fonts distinct?" test compares strings, so an identical
 *     typeface looked different (chain vs bare name) and a span was emitted
 *     that need not exist at all.
 *  2. That span declared the bare name, and being innermost it WON, throwing
 *     away the fallback the parent had carefully built. On a machine without
 *     the font the browser fell back to its own default - a serif, for CJK.
 */

function segment(style: Record<string, unknown>, text: string) {
	return { style, text };
}

const element = {
	id: 'ppt/slides/slide12.xml-shape-1',
	type: 'text',
	x: 0,
	y: 0,
	width: 400,
	height: 100,
} as unknown as PptxElement;

function render(style: Record<string, unknown>, text: string): string {
	return renderToStaticMarkup(
		<>{renderSingleSegment(element, segment(style, text), 0, '#000000', undefined, undefined)}</>,
	);
}

describe('per-script font spans', () => {
	it('emits no inner span when latin and eastAsia name the same font', () => {
		// Exactly what the reporter's deck authors: `<a:latin typeface="思源黑体 CN
		// Light"/><a:ea typeface="思源黑体 CN Light"/>`.
		const markup = render(
			{ fontFamily: '思源黑体 CN Light', eastAsiaFont: '思源黑体 CN Light' },
			'月初完成养老保险',
		);
		// One span (the segment itself), carrying the substituted chain.
		expect(markup.match(/<span/gu)).toHaveLength(1);
		expect(markup).toContain('sans-serif');
	});

	it('still splits when the scripts really do name different fonts', () => {
		const markup = render({ fontFamily: 'Arial', eastAsiaFont: 'SimSun' }, 'Mixed 中文 text');
		expect((markup.match(/<span/gu) ?? []).length).toBeGreaterThan(1);
	});

	it('gives a script span its own fallback chain, never a bare name', () => {
		const markup = render({ fontFamily: 'Arial', eastAsiaFont: '思源黑体 CN Light' }, 'A 中 B');
		// The east-asian span must not declare the authored name on its own.
		expect(markup).not.toMatch(/font-family:&quot;?思源黑体 CN Light&quot;?(?![^"]*sans-serif)/u);
		expect(markup).toContain('sans-serif');
	});
});
