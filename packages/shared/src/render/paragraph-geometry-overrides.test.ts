import type { TextStyle } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveParagraphGeometryOverrides } from './paragraph-geometry-overrides';

describe('resolveParagraphGeometryOverrides', () => {
	const bodyStyle: TextStyle = {
		eaLineBreak: true,
		latinLineBreak: false,
		hangingPunctuation: true,
		fontAlignment: 'ctr',
		defaultTabSize: 48,
	};

	it('falls back to the body style when the paragraph authors none of its own', () => {
		expect(resolveParagraphGeometryOverrides(undefined, bodyStyle)).toStrictEqual({
			eaLineBreak: true,
			latinLineBreak: false,
			hangingPunctuation: true,
			fontAlignment: 'ctr',
			defaultTabSize: 48,
		});
	});

	it('prefers the paragraph own authored value per field, independently', () => {
		// Regression: core collapses these five fields to whichever paragraph in
		// the shape authors them FIRST (`resolveShapeParagraphStyle`, first-wins on
		// the shared shape-scope TextStyle), so a second paragraph with its own
		// distinct values rendered the FIRST paragraph's values instead. This is
		// the render-side per-paragraph fix.
		const paraProps: TextStyle = {
			eaLineBreak: false,
			fontAlignment: 't',
		};
		expect(resolveParagraphGeometryOverrides(paraProps, bodyStyle)).toStrictEqual({
			eaLineBreak: false, // paragraph's own
			latinLineBreak: false, // body fallback (paragraph authors none)
			hangingPunctuation: true, // body fallback
			fontAlignment: 't', // paragraph's own
			defaultTabSize: 48, // body fallback
		});
	});

	it('returns an all-undefined result when neither the paragraph nor the body authors anything', () => {
		expect(resolveParagraphGeometryOverrides(undefined, undefined)).toStrictEqual({
			eaLineBreak: undefined,
			latinLineBreak: undefined,
			hangingPunctuation: undefined,
			fontAlignment: undefined,
			defaultTabSize: undefined,
		});
	});
});
