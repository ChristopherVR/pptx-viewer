// @vitest-environment jsdom
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import {
	applyHighlightClickStyle,
	findHighlightClickTarget,
	HIGHLIGHT_CLEAR_STYLE,
	HIGHLIGHT_CLICK_FLASH_DURATION_MS,
	HIGHLIGHT_CLICK_STYLE,
	HIGHLIGHT_HOVER_STYLE,
	resolveElementHighlightClick,
	resolveHighlightClickForElementId,
} from './element-highlight-click';

describe('resolveElementHighlightClick', () => {
	it('returns no click/hover flash when neither action requests one', () => {
		expect(resolveElementHighlightClick(undefined, undefined)).toStrictEqual({
			click: null,
			hover: null,
		});
		expect(resolveElementHighlightClick({ highlightClick: false }, undefined)).toStrictEqual({
			click: null,
			hover: null,
		});
	});

	it('resolves the click flash (a:hlinkClick/@highlightClick) with its duration', () => {
		const descriptor = resolveElementHighlightClick({ highlightClick: true }, undefined);
		expect(descriptor.click).toStrictEqual({
			style: HIGHLIGHT_CLICK_STYLE,
			clearStyle: HIGHLIGHT_CLEAR_STYLE,
			durationMs: HIGHLIGHT_CLICK_FLASH_DURATION_MS,
		});
		expect(descriptor.hover).toBeNull();
	});

	it('resolves the hover flash (a:hlinkHover/@highlightClick) independently of click', () => {
		const descriptor = resolveElementHighlightClick(undefined, { highlightClick: true });
		expect(descriptor.click).toBeNull();
		expect(descriptor.hover).toStrictEqual({
			enterStyle: HIGHLIGHT_HOVER_STYLE,
			leaveStyle: HIGHLIGHT_CLEAR_STYLE,
		});
	});

	it('resolves both when a shape carries highlightClick on both actions', () => {
		const descriptor = resolveElementHighlightClick(
			{ highlightClick: true },
			{ highlightClick: true },
		);
		expect(descriptor.click).not.toBeNull();
		expect(descriptor.hover).not.toBeNull();
	});
});

describe('applyHighlightClickStyle', () => {
	it('writes filter and outline onto the element inline style', () => {
		const el = { style: {} } as unknown as HTMLElement;
		applyHighlightClickStyle(el, HIGHLIGHT_CLICK_STYLE);
		expect(el.style.filter).toBe('brightness(1.18)');
		expect(el.style.outline).toBe('2px solid rgba(59, 130, 246, 0.6)');
	});

	it('clears both properties with HIGHLIGHT_CLEAR_STYLE', () => {
		const el = {
			style: { filter: 'brightness(1.18)', outline: '2px solid red' },
		} as unknown as HTMLElement;
		applyHighlightClickStyle(el, HIGHLIGHT_CLEAR_STYLE);
		expect(el.style.filter).toBe('');
		expect(el.style.outline).toBe('');
	});
});

describe('resolveHighlightClickForElementId', () => {
	function slideWithGroupedShape(): PptxSlide {
		const inner: PptxElement = {
			id: 'leaf',
			type: 'shape',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			actionClick: { highlightClick: true },
		} as unknown as PptxElement;
		const group: PptxElement = {
			id: 'group-1',
			type: 'group',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			children: [inner],
		} as unknown as PptxElement;
		return { id: 'slide-1', elements: [group] } as unknown as PptxSlide;
	}

	it('finds a highlightClick action on a shape nested inside a group', () => {
		const descriptor = resolveHighlightClickForElementId(slideWithGroupedShape(), 'leaf');
		expect(descriptor.click).not.toBeNull();
	});

	it('returns no flash for an unknown element id', () => {
		expect(resolveHighlightClickForElementId(slideWithGroupedShape(), 'missing')).toStrictEqual({
			click: null,
			hover: null,
		});
	});

	it('returns no flash when the slide is undefined', () => {
		expect(resolveHighlightClickForElementId(undefined, 'leaf')).toStrictEqual({
			click: null,
			hover: null,
		});
	});
});

describe('findHighlightClickTarget', () => {
	function slideWithNestedAction(): PptxSlide {
		const child: PptxElement = {
			id: 'child',
			type: 'shape',
			x: 0,
			y: 0,
			width: 5,
			height: 5,
		} as unknown as PptxElement;
		const parent: PptxElement = {
			id: 'parent',
			type: 'shape',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			actionClick: { highlightClick: true },
			actionHover: { highlightClick: true },
		} as unknown as PptxElement;
		return { id: 'slide-1', elements: [parent, child] } as unknown as PptxSlide;
	}

	it('walks up from a nested DOM node to the ancestor carrying the action', () => {
		const outer = document.createElement('div');
		outer.dataset.elementId = 'parent';
		const inner = document.createElement('span');
		outer.appendChild(inner);
		const slide = slideWithNestedAction();

		const found = findHighlightClickTarget(inner, slide);
		expect(found?.element).toBe(outer);
		expect(found?.descriptor.click).not.toBeNull();
		expect(found?.descriptor.hover).not.toBeNull();
	});

	it('returns undefined when no ancestor carries a highlightClick action', () => {
		const node = document.createElement('div');
		node.dataset.elementId = 'child';
		expect(findHighlightClickTarget(node, slideWithNestedAction())).toBeUndefined();
	});

	it('returns undefined for a non-Element target, or an undefined slide', () => {
		expect(findHighlightClickTarget(null, slideWithNestedAction())).toBeUndefined();
		expect(findHighlightClickTarget(document.createElement('div'), undefined)).toBeUndefined();
	});
});

// Sanity: consumers pass the callback shape they already have (vi.fn is just
// documentation here that the descriptor is plain data, not a function).
describe('descriptor shape', () => {
	it('is plain data usable from a setTimeout-based clear, not a callback', () => {
		const timer = vi.fn();
		const descriptor = resolveElementHighlightClick({ highlightClick: true }, undefined);
		if (descriptor.click) {
			timer(descriptor.click.durationMs);
		}
		expect(timer).toHaveBeenCalledWith(320);
	});
});
