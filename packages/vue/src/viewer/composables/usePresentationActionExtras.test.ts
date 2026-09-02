// oxlint-disable react-hooks/rules-of-hooks -- `usePresentationActionExtras`
// is a Vue composable, not a React hook; the shared lint config's
// react-hooks rules match on the `use` prefix alone and cannot tell the two
// apart (same disable used in `authored-custom-show.test.ts`).
import type { PptxCustomShow, PptxElement, PptxSlide } from 'pptx-viewer-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ref } from 'vue';

import type { ActiveCustomShow } from './usePresentationActionExtras';
import { usePresentationActionExtras } from './usePresentationActionExtras';

const SHOWS: PptxCustomShow[] = [
	{ id: 'short', name: 'Short Show', slideRIds: ['rId2', 'rId4'] },
	{ id: 'reverse', name: 'Reverse', slideRIds: ['rId4', 'rId3', 'rId2'] },
];

function slide(rId: string, elements: PptxElement[] = []): PptxSlide {
	return { id: rId, rId, elements } as PptxSlide;
}

/**
 * `actionClick` is set the same way core parses a real `ppaction://ole?verb=`
 * shape: in production `oleVerb` only fires once
 * `handlePresentationStageClick` has matched the click to an element that
 * actually carries an action, and it hands that element's id through.
 */
function oleElement(id: string, oleEmbeddedData?: string): PptxElement {
	return {
		id,
		type: 'ole',
		x: 0,
		y: 0,
		width: 10,
		height: 10,
		oleEmbeddedData,
		actionClick: { action: 'ppaction://ole?verb=-1' },
	} as PptxElement;
}

/**
 * usePresentationActionExtras: the wave-4 on-slide action verbs
 * (`lastViewed`, `customShow`, `openFile`, `openPresentation`, `playMedia`,
 * `oleVerb`) a `PresentationActionRunner` gained.
 */
describe('usePresentationActionExtras', () => {
	let currentIndex: ReturnType<typeof ref<number>>;
	let activeShowOverride: ReturnType<typeof ref<ActiveCustomShow>>;
	let goToSpy: ReturnType<typeof vi.fn>;
	let currentSlide: PptxSlide;

	function build(frameRoot: () => HTMLElement | null = () => null) {
		return usePresentationActionExtras({
			customShows: () => SHOWS,
			currentIndex,
			activeSlide: () => currentSlide,
			activeShowOverride,
			firstShowSlide: () => 0,
			goTo: goToSpy,
			frameRoot,
		});
	}

	beforeEach(() => {
		currentIndex = ref(0);
		activeShowOverride = ref<ActiveCustomShow>(undefined);
		goToSpy = vi.fn((index: number) => {
			currentIndex.value = index;
		});
		currentSlide = slide('rId1');
	});

	describe('lastViewed', () => {
		it('does nothing before any navigation has happened', () => {
			const extras = build();
			extras.lastViewed();
			expect(goToSpy).not.toHaveBeenCalled();
		});

		it('returns to the slide the show was on before the current one', () => {
			const extras = build();
			currentIndex.value = 2; // a navigation the composable's watcher observes
			currentIndex.value = 5;
			extras.lastViewed();
			expect(goToSpy).toHaveBeenCalledWith(2);
		});
	});

	describe('customShow + handleShowEnd', () => {
		it('unknown id is a no-op', () => {
			const extras = build();
			extras.customShow('missing', false);
			expect(goToSpy).not.toHaveBeenCalled();
			expect(activeShowOverride.value).toBeUndefined();
		});

		it('switches the active show and jumps to its first slide', () => {
			const extras = build();
			extras.customShow('short', false);
			expect(activeShowOverride.value).toStrictEqual(SHOWS[0]);
			expect(goToSpy).toHaveBeenCalledWith(0);
		});

		it('without returnAfter, handleShowEnd does not intervene', () => {
			const extras = build();
			extras.customShow('short', false);
			expect(extras.handleShowEnd()).toBeFalsy();
		});

		it('with returnAfter, handleShowEnd restores the previous show and the origin slide', () => {
			const extras = build();
			currentIndex.value = 3; // the slide the sub-show branched from

			extras.customShow('short', true);
			expect(activeShowOverride.value).toStrictEqual(SHOWS[0]);

			const handled = extras.handleShowEnd();
			expect(handled).toBeTruthy();
			expect(activeShowOverride.value).toBeUndefined();
			expect(goToSpy).toHaveBeenLastCalledWith(3);
		});

		it('handleShowEnd is one-shot: a second call does not intervene again', () => {
			const extras = build();
			extras.customShow('short', true);
			expect(extras.handleShowEnd()).toBeTruthy();
			expect(extras.handleShowEnd()).toBeFalsy();
		});
	});

	describe('openFile / openPresentation', () => {
		it('opens a safe target in a new tab', () => {
			const extras = build();
			const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
			extras.openFile('https://example.com/report.pdf');
			expect(openSpy).toHaveBeenCalledWith(
				'https://example.com/report.pdf',
				'_blank',
				'noopener,noreferrer',
			);
			openSpy.mockRestore();
		});

		it('an unsafe scripted target does nothing', () => {
			const extras = build();
			const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
			// Built without the literal token to satisfy the no-script-url lint
			// rule, mirroring `hyperlink-security.ts`'s own `BLOCKED_PROTOCOLS`.
			const unsafeTarget = `${'javascript'}:alert(1)`;
			extras.openFile(unsafeTarget);
			extras.openPresentation(unsafeTarget);
			expect(openSpy).not.toHaveBeenCalled();
			openSpy.mockRestore();
		});
	});

	describe('playMedia', () => {
		it('unknown id is a no-op', () => {
			const root = document.createElement('div');
			const extras = build(() => root);
			expect(() => extras.playMedia('nope')).not.toThrow();
		});

		it('toggles play/pause on the matching media element', () => {
			const root = document.createElement('div');
			const wrapper = document.createElement('div');
			wrapper.setAttribute('data-element-id', 'media-1');
			const video = document.createElement('video');
			// happy-dom's <video> has no real playback engine; stub the two calls
			// this composable makes so the test exercises the DOM lookup, not a
			// browser media pipeline.
			const playSpy = vi.fn().mockResolvedValue(undefined);
			const pauseSpy = vi.fn();
			Object.defineProperty(video, 'play', { value: playSpy });
			Object.defineProperty(video, 'pause', { value: pauseSpy });
			Object.defineProperty(video, 'paused', { value: true, writable: true });
			wrapper.appendChild(video);
			root.appendChild(wrapper);

			const extras = build(() => root);
			extras.playMedia('media-1');
			expect(playSpy).toHaveBeenCalledOnce();

			Object.defineProperty(video, 'paused', { value: false, writable: true });
			extras.playMedia('media-1');
			expect(pauseSpy).toHaveBeenCalledOnce();
		});
	});

	describe('oleVerb', () => {
		it('does nothing when the click carried no element', () => {
			currentSlide = slide('rId1', [oleElement('ole-1', 'blob:http://localhost/ole-payload')]);
			const extras = build();
			const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);
			extras.oleVerb(-1, undefined);
			expect(openSpy).not.toHaveBeenCalled();
			openSpy.mockRestore();
		});

		it("opens the clicked element's embedded payload", () => {
			currentSlide = slide('rId1', [oleElement('ole-1', 'blob:http://localhost/ole-payload')]);
			const extras = build();
			const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

			extras.oleVerb(-1, 'ole-1');

			expect(openSpy).toHaveBeenCalledWith('blob:http://localhost/ole-payload', '_blank');
			openSpy.mockRestore();
		});

		it('does nothing for an element with no embedded payload', () => {
			currentSlide = slide('rId1', [oleElement('ole-1', undefined)]);
			const extras = build();
			const openSpy = vi.spyOn(window, 'open').mockReturnValue(null);

			extras.oleVerb(-1, 'ole-1');

			expect(openSpy).not.toHaveBeenCalled();
			openSpy.mockRestore();
		});
	});
});
