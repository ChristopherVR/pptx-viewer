/**
 * presentation-input-controller.test.ts: the show runner's wave-4 verbs
 * (`lastViewed`, `customShow`, `openFile`, `openPresentation`, `playMedia`,
 * `oleVerb`), driven directly (no TestBed): the class takes plain injected
 * collaborators, so its dependencies are trivially faked, matching
 * `presentation-show-navigator.test.ts`.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { AnimationPlaybackService } from './animation-playback.service';
import type { PresentationAnnotationsService } from './presentation-annotations.service';
import { PresentationInputController } from './presentation-input-controller';
import type { PresentationInputDeps } from './presentation-input-controller';
import type { PresentationShowNavigator } from './presentation-show-navigator';

function slideWithAction(action: {
	action?: string;
	url?: string;
	targetSlideIndex?: number;
}): PptxSlide {
	return {
		id: 's1',
		rId: 'rId1',
		slideNumber: 1,
		elements: [
			{
				id: 'el-1',
				type: 'shape',
				name: 'Shape 1',
				x: 0,
				y: 0,
				width: 10,
				height: 10,
				actionClick: action,
			},
		],
	} as unknown as PptxSlide;
}

function stageClickTarget(elementId: string): HTMLElement {
	const root = document.createElement('div');
	const el = document.createElement('div');
	el.setAttribute('data-element-id', elementId);
	root.appendChild(el);
	document.body.appendChild(root);
	return el;
}

function makeController(
	slide: PptxSlide,
	overrides: Partial<PresentationInputDeps> = {},
): { controller: PresentationInputController; deps: PresentationInputDeps } {
	const navigator = {
		goToSlide: vi.fn(),
		navigate: vi.fn(),
		goToLastViewed: vi.fn(),
	} as unknown as PresentationShowNavigator;
	const playback = {
		advance: () => false,
		isSeededCompleted: () => false,
		setSlide: () => undefined,
		isComplete: () => true,
		interactiveTriggerShapeIds: () => new Set<string>(),
		handleInteractiveShapeClick: () => false,
	} as unknown as AnimationPlaybackService;
	const annotations = { tool: () => 'none' } as unknown as PresentationAnnotationsService;

	const deps: PresentationInputDeps = {
		slides: () => [slide],
		currentSlide: () => slide,
		root: () => document.body,
		navigator,
		playback,
		annotations,
		presenterWindow: {} as PresentationInputDeps['presenterWindow'],
		toggleInkMarkup: () => undefined,
		toggleSubtitles: () => undefined,
		toggleChrome: () => undefined,
		showAllSlides: () => undefined,
		requestClose: () => undefined,
		...overrides,
	};
	return { controller: new PresentationInputController(deps), deps };
}

describe('presentationInputController show-runner verbs', () => {
	it('lastViewed calls navigator.goToLastViewed()', () => {
		const slide = slideWithAction({ action: 'ppaction://hlinkshowjump?jump=lastslideviewed' });
		const { controller, deps } = makeController(slide);
		controller.handleBodyClick({
			button: 0,
			target: stageClickTarget('el-1'),
		} as unknown as MouseEvent);
		expect(deps.navigator.goToLastViewed).toHaveBeenCalledOnce();
	});

	it('customShow calls the runCustomShow callback with the id and return flag', () => {
		const slide = slideWithAction({ action: 'ppaction://customshow?id=3&return=true' });
		const runCustomShow = vi.fn();
		const { controller } = makeController(slide, { runCustomShow });
		controller.handleBodyClick({
			button: 0,
			target: stageClickTarget('el-1'),
		} as unknown as MouseEvent);
		expect(runCustomShow).toHaveBeenCalledWith('3', true);
	});

	it('openFile opens a safe target in a new tab', () => {
		const slide = slideWithAction({ action: 'ppaction://hlinkfile', url: 'file:///report.pdf' });
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const { controller } = makeController(slide);
		controller.handleBodyClick({
			button: 0,
			target: stageClickTarget('el-1'),
		} as unknown as MouseEvent);
		expect(openSpy).toHaveBeenCalledWith('file:///report.pdf', '_blank', 'noopener,noreferrer');
		openSpy.mockRestore();
	});

	it('openFile with a javascript: target does nothing', () => {
		// Built without the literal token to satisfy the no-script-url lint rule,
		// matching `hyperlink-security.ts`'s own convention.
		const unsafeUrl = `${'javascript'}:alert(1)`;
		const slide = slideWithAction({
			action: 'ppaction://hlinkfile',
			url: unsafeUrl,
		});
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const { controller } = makeController(slide);
		controller.handleBodyClick({
			button: 0,
			target: stageClickTarget('el-1'),
		} as unknown as MouseEvent);
		expect(openSpy).not.toHaveBeenCalled();
		openSpy.mockRestore();
	});

	it("playMedia toggles the clicked element's own <video>", () => {
		const slide = slideWithAction({ action: 'ppaction://media' });
		const target = stageClickTarget('el-1');
		const video = document.createElement('video');
		Object.defineProperty(video, 'paused', { value: true, configurable: true });
		vi.spyOn(video, 'play').mockResolvedValue(undefined);
		target.appendChild(video);
		const { controller } = makeController(slide);
		controller.handleBodyClick({ button: 0, target } as unknown as MouseEvent);
		expect(video.play).toHaveBeenCalledOnce();
	});

	it("oleVerb opens the clicked OLE object's recovered embedding", () => {
		const slide = slideWithAction({ action: 'ppaction://ole?verb=0' });
		const element = slide.elements[0] as unknown as Record<string, unknown>;
		element.type = 'ole';
		element.oleEmbeddedData = 'blob:http://localhost/ole-payload';
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const { controller } = makeController(slide);
		controller.handleBodyClick({
			button: 0,
			target: stageClickTarget('el-1'),
		} as unknown as MouseEvent);
		expect(openSpy).toHaveBeenCalledWith('blob:http://localhost/ole-payload', '_blank');
		openSpy.mockRestore();
	});

	it('oleVerb on a shape with no embedding consumes the click without opening anything', () => {
		const slide = slideWithAction({ action: 'ppaction://ole?verb=0' });
		const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
		const { controller, deps } = makeController(slide);
		expect(() =>
			controller.handleBodyClick({
				button: 0,
				target: stageClickTarget('el-1'),
			} as unknown as MouseEvent),
		).not.toThrow();
		expect(openSpy).not.toHaveBeenCalled();
		expect(deps.navigator.navigate).not.toHaveBeenCalled();
		openSpy.mockRestore();
	});
});
