// @vitest-environment jsdom
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
	findPresentationActionTarget,
	isNoOpPresentationAction,
	resolvePresentationAction,
	resolvePresentationClick,
} from './presentation-action';

function shape(id: string, actionClick?: PptxElement['actionClick']): PptxElement {
	return {
		id,
		type: 'shape',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		actionClick,
	} as PptxElement;
}

function slideOf(elements: PptxElement[]): PptxSlide {
	return { id: 'slide-1', elements } as PptxSlide;
}

function render(html: string): HTMLElement {
	document.body.innerHTML = html;
	return document.body.firstElementChild as HTMLElement;
}

afterEach(() => {
	document.body.innerHTML = '';
});

describe('isNoOpPresentationAction', () => {
	it('treats PowerPoint’s "Action: None" verb as doing nothing', () => {
		expect(isNoOpPresentationAction({ action: 'ppaction://noaction' })).toBeTruthy();
		expect(isNoOpPresentationAction({ action: 'PPAction://NoAction' })).toBeTruthy();
		expect(isNoOpPresentationAction(undefined)).toBeTruthy();
		// An entry carrying only a tooltip navigates nowhere either.
		expect(isNoOpPresentationAction({ tooltip: 'hi' })).toBeTruthy();
	});

	it('leaves a real action alone', () => {
		expect(
			isNoOpPresentationAction({ action: 'ppaction://hlinksldjump', targetSlideIndex: 4 }),
		).toBeFalsy();
		expect(isNoOpPresentationAction({ url: 'https://example.com' })).toBeFalsy();
	});
});

describe('resolvePresentationAction', () => {
	it('jumps to a resolved slide index, clamped to the deck', () => {
		expect(
			resolvePresentationAction(
				{ action: 'ppaction://hlinksldjump', targetSlideIndex: 8 },
				{ slideCount: 14 },
			).intent,
		).toStrictEqual({ kind: 'goToSlide', slideIndex: 8 });
		expect(
			resolvePresentationAction({ targetSlideIndex: 99 }, { slideCount: 14 }).intent,
		).toStrictEqual({ kind: 'goToSlide', slideIndex: 13 });
		expect(
			resolvePresentationAction({ targetSlideIndex: -3 }, { slideCount: 14 }).intent,
		).toStrictEqual({ kind: 'goToSlide', slideIndex: 0 });
	});

	it('maps the hlinkshowjump verbs onto show navigation', () => {
		const at = (jump: string) =>
			resolvePresentationAction(
				{ action: `ppaction://hlinkshowjump?jump=${jump}` },
				{ slideCount: 14 },
			).intent;
		expect(at('nextslide')).toStrictEqual({ kind: 'move', direction: 1 });
		expect(at('previousslide')).toStrictEqual({ kind: 'move', direction: -1 });
		expect(at('firstslide')).toStrictEqual({ kind: 'goToSlide', slideIndex: 0 });
		expect(at('lastslide')).toStrictEqual({ kind: 'goToSlide', slideIndex: 13 });
		expect(at('endshow')).toStrictEqual({ kind: 'endShow' });
	});

	it('opens a safe external URL and refuses an unsafe one', () => {
		expect(
			resolvePresentationAction({ url: 'https://example.com/a' }, { slideCount: 3 }).intent,
		).toStrictEqual({ kind: 'openUrl', url: 'https://example.com/a' });
		expect(
			resolvePresentationAction({ url: `${'javascript'}:alert(1)` }, { slideCount: 3 }).intent.kind,
		).toBe('none');
	});

	it('carries the action sound through', () => {
		expect(
			resolvePresentationAction(
				{ targetSlideIndex: 1, soundPath: 'ppt/media/audio1.wav' },
				{ slideCount: 3 },
			).soundPath,
		).toBe('ppt/media/audio1.wav');
	});

	it('navigates nowhere for an unresolved slide jump', () => {
		expect(
			resolvePresentationAction({ action: 'ppaction://hlinksldjump' }, { slideCount: 3 }).intent
				.kind,
		).toBe('none');
	});
});

describe('findPresentationActionTarget', () => {
	it('finds the action of the element under the pointer', () => {
		const slide = slideOf([
			shape('s1', { action: 'ppaction://hlinksldjump', targetSlideIndex: 8 }),
		]);
		const node = render('<div data-element-id="s1"><span>Tactical Edge</span></div>');
		expect(findPresentationActionTarget(node.firstElementChild, slide)).toStrictEqual({
			elementId: 's1',
			action: { action: 'ppaction://hlinksldjump', targetSlideIndex: 8 },
		});
	});

	it('keeps walking past an element that carries no action', () => {
		const group: PptxElement = {
			id: 'g1',
			type: 'group',
			x: 0,
			y: 0,
			width: 10,
			height: 10,
			actionClick: { targetSlideIndex: 2 },
			children: [shape('g1-child')],
		} as PptxElement;
		const slide = slideOf([group]);
		const node = render('<div data-element-id="g1"><div data-element-id="g1-child"></div></div>');
		expect(findPresentationActionTarget(node.firstElementChild, slide)?.elementId).toBe('g1');
	});

	it('ignores an "Action: None" entry', () => {
		const slide = slideOf([shape('s1', { action: 'ppaction://noaction', highlightClick: true })]);
		const node = render('<div data-element-id="s1"></div>');
		expect(findPresentationActionTarget(node, slide)).toBeUndefined();
	});
});

describe('resolvePresentationClick', () => {
	it('gives an action shape its own click instead of advancing the show', () => {
		const slide = slideOf([shape('s1', { targetSlideIndex: 8 })]);
		const node = render('<div data-element-id="s1"><span>slice</span></div>');
		expect(resolvePresentationClick(node.firstElementChild, slide)).toStrictEqual({
			kind: 'action',
			elementId: 's1',
			action: { targetSlideIndex: 8 },
		});
	});

	it('advances on inert slide content', () => {
		const slide = slideOf([shape('s1')]);
		const node = render('<div data-element-id="s1"><span>title</span></div>');
		expect(resolvePresentationClick(node, slide).kind).toBe('advance');
	});

	it('lets an "Action: None" shape fall through to click-to-advance', () => {
		const slide = slideOf([shape('s1', { action: 'ppaction://noaction' })]);
		const node = render('<div data-element-id="s1"></div>');
		expect(resolvePresentationClick(node, slide).kind).toBe('advance');
	});

	it('leaves show chrome and live content inert', () => {
		const slide = slideOf([]);
		expect(
			resolvePresentationClick(render('<button type="button">next</button>'), slide).kind,
		).toBe('inert');
		expect(resolvePresentationClick(render('<a href="#x">link</a>'), slide).kind).toBe('inert');
	});
});
