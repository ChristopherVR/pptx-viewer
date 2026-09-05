import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { resolveElementAriaAttributes } from './element-aria-attributes';

function picture(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'pic-1',
		type: 'image',
		x: 0,
		y: 0,
		width: 100,
		height: 100,
		src: 'data:image/png;base64,',
		altText: 'A described picture',
		...overrides,
	} as PptxElement;
}

describe('resolveElementAriaAttributes', () => {
	it('announces a described picture with its alt text and img role', () => {
		const aria = resolveElementAriaAttributes(picture());
		expect(aria.hidden).toBeFalsy();
		expect(aria.actionable).toBeFalsy();
		expect(aria.role).toBe('img');
		expect(aria.label).toBe('A described picture');
	});

	it('hides a decorative picture from assistive tech and drops its name', () => {
		const aria = resolveElementAriaAttributes(
			picture({ isDecorative: true } as Partial<PptxElement>),
		);
		expect(aria.hidden).toBeTruthy();
		expect(aria.role).toBeUndefined();
		expect(aria.label).toBe('');
	});

	it('keeps a decorative-but-clickable shape announced (actionable wins)', () => {
		const aria = resolveElementAriaAttributes(
			picture({
				isDecorative: true,
				actionClick: { action: 'ppaction://hlinkshowjump?jump=nextslide' },
			} as Partial<PptxElement>),
		);
		expect(aria.actionable).toBeTruthy();
		expect(aria.hidden).toBeFalsy();
		expect(aria.role).toBe('button');
	});

	it('treats an action with no host handler as not actionable', () => {
		const aria = resolveElementAriaAttributes(
			picture({
				isDecorative: true,
				actionClick: { action: 'ppaction://hlinkshowjump?jump=nextslide' },
			} as Partial<PptxElement>),
			{ hasActionHandler: false },
		);
		expect(aria.actionable).toBeFalsy();
		expect(aria.hidden).toBeTruthy();
	});
});
