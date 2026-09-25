import { describe, expect, it } from 'vitest';

import { buildTextBlockStyle } from './text-block-style';
import { resolveVertOverflowClipLines } from './text-overflow-lines';

describe('resolveVertOverflowClipLines (COM: audit-text slide 2)', () => {
	it('hides the partial line below the last whole one', () => {
		// 100px of content at a 24px line: four whole lines, 4px of a fifth.
		expect(resolveVertOverflowClipLines({ vertOverflow: 'clip' }, 100, 5, 24)).toStrictEqual({
			clipPath: 'inset(0 0 9px 0)',
		});
	});

	it('also hides the next paragraph peeking under an ellipsis clamp', () => {
		expect(resolveVertOverflowClipLines({ vertOverflow: 'ellipsis' }, 100, 5, 24)).toStrictEqual({
			clipPath: 'inset(0 0 9px 0)',
		});
	});

	it('does nothing when the lines fit exactly, or the body does not clip', () => {
		expect(resolveVertOverflowClipLines({ vertOverflow: 'clip' }, 96, 5, 24)).toBeUndefined();
		expect(resolveVertOverflowClipLines({ vertOverflow: 'overflow' }, 100, 5, 24)).toBeUndefined();
		expect(resolveVertOverflowClipLines(undefined, 100, 5, 24)).toBeUndefined();
	});

	it('leaves centred and bottom-anchored bodies to the plain clip', () => {
		expect(
			resolveVertOverflowClipLines({ vertOverflow: 'clip', vAlign: 'middle' }, 100, 5, 24),
		).toBeUndefined();
		expect(
			resolveVertOverflowClipLines({ vertOverflow: 'clip', vAlign: 'bottom' }, 100, 5, 24),
		).toBeUndefined();
	});

	it('is applied by buildTextBlockStyle for a clipping body', () => {
		const style = buildTextBlockStyle({
			id: 't',
			type: 'text',
			x: 0,
			y: 0,
			width: 200,
			height: 107,
			text: 'x',
			textStyle: { fontSize: 20, vertOverflow: 'clip' },
		} as never);
		expect(String(style.clipPath)).toMatch(/^inset\(0 0 [\d.]+px 0\)$/u);
		expect(style.overflow).toBe('hidden');
	});
});
