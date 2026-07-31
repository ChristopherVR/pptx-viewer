/**
 * The actionable-element rule: a shape carrying a click / hover action, a text
 * hyperlink, or a zoom target is a control, and every binding has to agree on
 * that (a deck advertised 37 buttons in React and none in the other four).
 */
import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { getAriaRole } from './accessibility';
import { elementHasTextHyperlink, isElementActionable } from './element-actionability';

function element(overrides: Partial<PptxElement> = {}): PptxElement {
	return {
		id: 'el-1',
		type: 'shape',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		...overrides,
	} as PptxElement;
}

describe('elementHasTextHyperlink', () => {
	it('finds a run-level hyperlink on a text-bearing element', () => {
		const el = element({
			type: 'text',
			text: 'Docs',
			textSegments: [{ text: 'Docs', style: { hyperlink: 'https://example.com' } }],
		});
		expect(elementHasTextHyperlink(el)).toBeTruthy();
	});

	it('is false for text with no hyperlinked run', () => {
		const el = element({
			type: 'text',
			text: 'Docs',
			textSegments: [{ text: 'Docs' }],
		});
		expect(elementHasTextHyperlink(el)).toBeFalsy();
	});

	it('is false for an element type that cannot carry text', () => {
		expect(elementHasTextHyperlink(element({ type: 'image' }))).toBeFalsy();
	});
});

describe('isElementActionable', () => {
	it('is true for a shape-level click action', () => {
		expect(
			isElementActionable(element({ actionClick: { url: 'https://example.com' } })),
		).toBeTruthy();
	});

	it('is true for a ppaction hover action even with no handlers wired', () => {
		const el = element({ actionHover: { action: 'ppaction://hlinkshowjump?jump=nextslide' } });
		expect(
			isElementActionable(el, {
				hasActionHandler: false,
				hasHyperlinkHandler: false,
				hasZoomHandler: false,
			}),
		).toBeTruthy();
	});

	it('is true for a run-level text hyperlink', () => {
		const el = element({
			type: 'text',
			text: 'Docs',
			textSegments: [{ text: 'Docs', style: { hyperlink: 'https://example.com' } }],
		});
		expect(isElementActionable(el)).toBeTruthy();
	});

	it('is true for a zoom tile', () => {
		expect(isElementActionable(element({ type: 'zoom' }))).toBeTruthy();
	});

	it('is false for an inert shape', () => {
		expect(isElementActionable(element({ text: 'Title' }))).toBeFalsy();
	});

	it('respects a host that cannot follow the action', () => {
		const el = element({ actionClick: { url: 'https://example.com' } });
		expect(isElementActionable(el, { hasActionHandler: false })).toBeFalsy();
	});

	it('respects a host that cannot follow hyperlinks or zooms', () => {
		const link = element({
			type: 'text',
			text: 'Docs',
			textSegments: [{ text: 'Docs', style: { hyperlink: 'https://example.com' } }],
		});
		expect(isElementActionable(link, { hasHyperlinkHandler: false })).toBeFalsy();
		expect(isElementActionable(element({ type: 'zoom' }), { hasZoomHandler: false })).toBeFalsy();
	});
});

describe('actionable elements resolve to role="button"', () => {
	it('overrides the type-derived role for an action shape', () => {
		const el = element({ actionClick: { url: 'https://example.com' } });
		expect(getAriaRole(el)).toBe('img');
		expect(getAriaRole(el, { actionable: isElementActionable(el) })).toBe('button');
	});

	it('overrides the role of a text-bearing shape too', () => {
		const el = element({
			text: 'Open the docs',
			textSegments: [{ text: 'Open the docs', style: { hyperlink: 'https://example.com' } }],
		});
		expect(getAriaRole(el)).toBe('group');
		expect(getAriaRole(el, { actionable: isElementActionable(el) })).toBe('button');
	});

	it('leaves an inert element on its type-derived role', () => {
		const el = element({ type: 'image' });
		expect(getAriaRole(el, { actionable: isElementActionable(el) })).toBe('img');
	});
});
