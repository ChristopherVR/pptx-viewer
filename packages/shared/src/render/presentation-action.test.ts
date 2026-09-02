// @vitest-environment jsdom
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { afterEach, describe, expect, it } from 'vitest';

import {
	findPresentationActionTarget,
	handlePresentationStageClick,
	isNoOpPresentationAction,
	resolvePresentationAction,
	resolvePresentationClick,
	runPresentationAction,
} from './presentation-action';
import type { PresentationActionRunner } from './presentation-action';

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

	it('maps hlinkshowjump?jump=lastslideviewed to lastViewed, not lastSlide', () => {
		expect(
			resolvePresentationAction(
				{ action: 'ppaction://hlinkshowjump?jump=lastslideviewed' },
				{ slideCount: 14 },
			).intent,
		).toStrictEqual({ kind: 'lastViewed' });
	});

	it('maps a custom show action to customShow with its id and returnAfter', () => {
		expect(
			resolvePresentationAction(
				{ action: 'ppaction://customshow?id=3&return=true' },
				{ slideCount: 3 },
			).intent,
		).toStrictEqual({ kind: 'customShow', customShowId: '3', returnAfter: true });
		expect(
			resolvePresentationAction({ action: 'ppaction://customshow?id=7' }, { slideCount: 3 }).intent,
		).toStrictEqual({ kind: 'customShow', customShowId: '7', returnAfter: false });
	});

	it('navigates nowhere for a custom show action with no id', () => {
		expect(
			resolvePresentationAction({ action: 'ppaction://customshow' }, { slideCount: 3 }).intent.kind,
		).toBe('none');
	});

	it('maps hlinkfile / hlinkpres to openFile / openPresentation with the resolved target', () => {
		expect(
			resolvePresentationAction(
				{ action: 'ppaction://hlinkfile', url: 'report.docx' },
				{ slideCount: 3 },
			).intent,
		).toStrictEqual({ kind: 'openFile', target: 'report.docx' });
		expect(
			resolvePresentationAction(
				{ action: 'ppaction://hlinkpres', url: 'other.pptx' },
				{ slideCount: 3 },
			).intent,
		).toStrictEqual({ kind: 'openPresentation', target: 'other.pptx' });
	});

	it('navigates nowhere for hlinkfile / hlinkpres with no resolved target', () => {
		expect(
			resolvePresentationAction({ action: 'ppaction://hlinkfile' }, { slideCount: 3 }).intent.kind,
		).toBe('none');
	});

	it('maps ppaction://media to playMedia, carrying the clicked element id', () => {
		expect(
			resolvePresentationAction(
				{ action: 'ppaction://media' },
				{ slideCount: 3, elementId: 'video1' },
			).intent,
		).toStrictEqual({ kind: 'playMedia', elementId: 'video1' });
		expect(
			resolvePresentationAction({ action: 'ppaction://media' }, { slideCount: 3 }).intent,
		).toStrictEqual({ kind: 'playMedia' });
	});

	it('maps ppaction://ole?verb=N to oleVerb with the parsed number and the acting element', () => {
		expect(
			resolvePresentationAction({ action: 'ppaction://ole?verb=-1' }, { slideCount: 3 }).intent,
		).toStrictEqual({ kind: 'oleVerb', verb: -1 });
		expect(
			resolvePresentationAction(
				{ action: 'ppaction://ole?verb=0' },
				{ slideCount: 3, elementId: 'ole1' },
			).intent,
		).toStrictEqual({ kind: 'oleVerb', verb: 0, elementId: 'ole1' });
	});
});

describe('runPresentationAction: wave-4 verbs', () => {
	function runnerSpy(): { runner: PresentationActionRunner; calls: string[] } {
		const calls: string[] = [];
		const runner: PresentationActionRunner = {
			goToSlide: () => calls.push('goToSlide'),
			move: () => calls.push('move'),
			endShow: () => calls.push('endShow'),
			lastViewed: () => calls.push('lastViewed'),
			customShow: (id, returnAfter) => calls.push(`customShow:${id}:${returnAfter}`),
			openFile: (target) => calls.push(`openFile:${target}`),
			openPresentation: (target) => calls.push(`openPresentation:${target}`),
			playMedia: (elementId) => calls.push(`playMedia:${elementId}`),
			oleVerb: (verb, elementId) => calls.push(`oleVerb:${verb}:${elementId}`),
		};
		return { runner, calls };
	}

	it('calls the matching optional callback and reports the click as spent', () => {
		const { runner, calls } = runnerSpy();
		expect(
			runPresentationAction(
				{ action: 'ppaction://hlinkshowjump?jump=lastslideviewed' },
				{ slideCount: 3 },
				runner,
			),
		).toBeTruthy();
		expect(calls).toStrictEqual(['lastViewed']);
	});

	it('still reports the click as spent when the optional callback is missing', () => {
		const emptyRunner: PresentationActionRunner = {
			goToSlide: () => undefined,
			move: () => undefined,
			endShow: () => undefined,
		};
		expect(
			runPresentationAction({ action: 'ppaction://media' }, { slideCount: 3 }, emptyRunner),
		).toBeTruthy();
	});

	it('passes the custom show id and returnAfter through', () => {
		const { runner, calls } = runnerSpy();
		runPresentationAction(
			{ action: 'ppaction://customshow?id=3&return=true' },
			{ slideCount: 3 },
			runner,
		);
		expect(calls).toStrictEqual(['customShow:3:true']);
	});

	it('passes the resolved target through for openFile and openPresentation', () => {
		const { runner, calls } = runnerSpy();
		runPresentationAction(
			{ action: 'ppaction://hlinkfile', url: 'report.docx' },
			{ slideCount: 3 },
			runner,
		);
		expect(calls).toStrictEqual(['openFile:report.docx']);
	});

	it('passes the OLE verb number and the acting element through', () => {
		const { runner, calls } = runnerSpy();
		runPresentationAction(
			{ action: 'ppaction://ole?verb=-1' },
			{ slideCount: 3, elementId: 'ole1' },
			runner,
		);
		expect(calls).toStrictEqual(['oleVerb:-1:ole1']);
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

describe('handlePresentationStageClick: playMedia elementId threading', () => {
	it('threads the clicked element id into playMedia', () => {
		const slide = slideOf([shape('video1', { action: 'ppaction://media' })]);
		const node = render('<div data-element-id="video1"></div>');
		const calls: Array<string | undefined> = [];
		const runner: PresentationActionRunner = {
			goToSlide: () => undefined,
			move: () => undefined,
			endShow: () => undefined,
			playMedia: (elementId) => calls.push(elementId),
		};
		handlePresentationStageClick(node, slide, { slideCount: 1 }, runner);
		expect(calls).toStrictEqual(['video1']);
	});
});
