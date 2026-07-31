import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Reading View, Angular binding.
 *
 * The navigation rules themselves are proved once in
 * `pptx-viewer-shared/render/reading-view`. What is worth proving here is the
 * glue that has historically rotted: that the ribbon control is actually LIVE
 * (it shipped `disabled` in all five bindings), that the overlay carries the
 * neutral DOM contract `e2e/` addresses all five viewers through, that it is a
 * windowed view rather than a second slide show, and that a reader's keys never
 * reach the editor underneath.
 *
 * No Angular TestBed (see `vitest.config.ts`): components are constructed in a
 * plain `Injector` context, the inputs are replaced with writable signals in a
 * test subclass, and the template contract is read from the source. The model
 * asserted here is literally what the template binds: `counter()` is the
 * counter's text, `canPrevious()` is its `[disabled]` predicate and
 * `visibleSlide()` is its `@if`.
 *
 * Reference binding: packages/react/src/viewer/components/ReadingViewOverlay.test.tsx
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	READING_VIEW_ATTR,
	READING_VIEW_COUNTER_ATTR,
	READING_VIEW_STAGE_ATTR,
} from '../internal/shared';
import type { CanvasSize } from '../internal/shared';
import { ReadingViewOverlayComponent } from './reading-view-overlay.component';

const CANVAS: CanvasSize = { width: 960, height: 540 };

function slide(id: string): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

const DECK = [slide('s1'), slide('s2'), slide('s3')];

/**
 * The overlay with its inputs replaced by writable signals.
 *
 * Subclass field initializers run after the base class's, so these shadow the
 * `input()` signals the real component declares. Every computed reads them
 * through `this`, so the model under test is the shipped one.
 */
class TestReadingViewOverlay extends ReadingViewOverlayComponent {
	override readonly slides = signal<readonly PptxSlide[]>(DECK) as unknown as InputSignal<
		readonly PptxSlide[]
	>;
	override readonly canvasSize = signal(CANVAS) as unknown as InputSignal<CanvasSize>;
	override readonly activeSlideIndex = signal(0) as unknown as InputSignal<number>;
}

/** The protected model + handlers the template binds to. */
interface OverlayModel {
	visibleSlide: () => PptxSlide | undefined;
	counter: () => string;
	canPrevious: () => boolean;
	canNext: () => boolean;
	run: (command: { command: string }) => void;
	onKeyDown: (event: KeyboardEvent) => void;
	slides: { set: (value: readonly PptxSlide[]) => void };
	activeSlideIndex: { set: (value: number) => void };
}

function createOverlay(options?: { slides?: readonly PptxSlide[]; activeSlideIndex?: number }): {
	overlay: OverlayModel;
	exits: number[];
} {
	const overlay = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new TestReadingViewOverlay(),
	);
	const model = overlay as unknown as OverlayModel;
	if (options?.slides) {
		model.slides.set(options.slides);
	}
	model.activeSlideIndex.set(options?.activeSlideIndex ?? 0);
	const exits: number[] = [];
	overlay.exit.subscribe((index) => exits.push(index));
	overlay.ngOnInit();
	return { overlay: model, exits };
}

/** A key press whose `stopPropagation` / `preventDefault` calls are counted. */
function keyEvent(key: string): {
	event: KeyboardEvent;
	calls: { stopPropagation: number; preventDefault: number };
} {
	const calls = { stopPropagation: 0, preventDefault: 0 };
	const event = new KeyboardEvent('keydown', { key, cancelable: true });
	Object.assign(event, {
		stopPropagation: (): void => {
			calls.stopPropagation += 1;
		},
		preventDefault: (): void => {
			calls.preventDefault += 1;
		},
	});
	return { event, calls };
}

const SOURCE = readFileSync(
	path.join(import.meta.dirname, 'reading-view-overlay.component.ts'),
	'utf8',
);
const STYLES = readFileSync(
	path.join(import.meta.dirname, 'reading-view-overlay.styles.ts'),
	'utf8',
);
const VIEW_SECTION = readFileSync(
	path.join(import.meta.dirname, 'ribbon-view-section.component.ts'),
	'utf8',
);

// ---------------------------------------------------------------------------
// Ribbon control
// ---------------------------------------------------------------------------

describe('view tab Reading View control', () => {
	/**
	 * The regression this whole feature exists for: every binding rendered this
	 * button permanently `disabled`, so a reader who found it in the ribbon got
	 * nothing at all.
	 */
	it('is enabled rather than an inert placeholder', () => {
		expect(VIEW_SECTION).toContain('(click)="openReadingView.emit()"');
		expect(VIEW_SECTION).not.toMatch(
			/<button[^>]*disabled[^>]*>\s*\{\{ 'pptx\.view\.readingView' \| translate \}\}/u,
		);
	});
});

// ---------------------------------------------------------------------------
// DOM contract (read from the template: no TestBed in this package)
// ---------------------------------------------------------------------------

describe('readingViewOverlayComponent DOM contract', () => {
	it('exposes the neutral reading-view attributes e2e addresses all five through', () => {
		expect(SOURCE).toContain(`${READING_VIEW_ATTR}="true"`);
		expect(SOURCE).toContain(`${READING_VIEW_COUNTER_ATTR}="true"`);
		expect(SOURCE).toContain(`${READING_VIEW_STAGE_ATTR}="true"`);
		expect(SOURCE).toContain(`role="region"`);
		expect(SOURCE).toContain(`[attr.aria-label]="'pptx.view.readingView' | translate"`);
		expect(SOURCE).toContain(`aria-roledescription="slide"`);
	});

	it('names previous, next and the way back to Normal from the shared dictionary', () => {
		for (const key of ['pptx.common.previous', 'pptx.common.next', 'pptx.statusBar.normalView']) {
			expect(SOURCE).toContain(`[attr.aria-label]="'${key}' | translate"`);
			expect(SOURCE).toContain(`[title]="'${key}' | translate"`);
		}
	});

	/**
	 * Reading View is the deck at full WINDOW size. If this ever starts asking
	 * for the Fullscreen API it has become a second, worse slide show.
	 */
	it('is a windowed overlay, not a fullscreen slide show', () => {
		expect(STYLES).toContain('position: fixed;');
		expect(STYLES).toContain('inset: 0;');
		expect(SOURCE).not.toContain('requestFullscreen');
		expect(SOURCE).not.toContain('presentation-fullscreen');
		// No slide-show chrome leaked in: no presenter window, no ink annotation
		// layer, no blackout, none of the overlay components that carry them.
		expect(SOURCE).not.toContain('PresenterWindowService');
		expect(SOURCE).not.toContain('<pptx-presentation-');
		// Keys go through the reading-view table, which drops the slide-show-only
		// chords (pen, laser, blackout) rather than acting on them.
		expect(SOURCE).not.toContain('mapPresentationKey');
	});

	it('draws the slide through the shared canvas, uncapped', () => {
		expect(SOURCE).toContain('<pptx-slide-canvas');
		expect(SOURCE).toContain('[interactive]="false"');
		expect(SOURCE).toContain('[autoFit]="false"');
	});
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

describe('readingViewOverlayComponent model', () => {
	it('opens on the slide the editor was on, one-based in the counter', () => {
		expect(createOverlay({ activeSlideIndex: 1 }).overlay.counter()).toBe('2 / 3');
		expect(createOverlay({ activeSlideIndex: 0 }).overlay.counter()).toBe('1 / 3');
	});

	it('disables previous on the first slide and leaves it live after that', () => {
		expect(createOverlay({ activeSlideIndex: 0 }).overlay.canPrevious()).toBeFalsy();
		expect(createOverlay({ activeSlideIndex: 1 }).overlay.canPrevious()).toBeTruthy();
		// Next stays live on the last slide too: there it means "leave".
		expect(createOverlay({ activeSlideIndex: 2 }).overlay.canNext()).toBeTruthy();
	});

	it('advances and goes back through the shared command applier', () => {
		const { overlay } = createOverlay();
		overlay.run({ command: 'next' });
		expect(overlay.counter()).toBe('2 / 3');
		overlay.run({ command: 'previous' });
		expect(overlay.counter()).toBe('1 / 3');
	});

	it('renders nothing when the deck is empty', () => {
		const { overlay } = createOverlay({ slides: [] });
		expect(overlay.visibleSlide()).toBeUndefined();
	});

	it('hands the editor back the slide the reader ended on', () => {
		const { overlay, exits } = createOverlay({ activeSlideIndex: 1 });
		overlay.run({ command: 'exit' });
		expect(exits).toStrictEqual([1]);
		expect(overlay.visibleSlide()).toBeUndefined();
	});

	/** PowerPoint has no "end of slide show" screen here: it returns to Normal. */
	it('closes on the slide after the last one', () => {
		const { overlay, exits } = createOverlay({ activeSlideIndex: 2 });
		overlay.run({ command: 'next' });
		expect(exits).toStrictEqual([2]);
	});
});

// ---------------------------------------------------------------------------
// Keyboard
// ---------------------------------------------------------------------------

describe('readingViewOverlayComponent keyboard', () => {
	/**
	 * The editor is still mounted (and still listening on `window`) underneath
	 * this overlay. A bubble-phase listener let ArrowDown both turn the page and
	 * nudge the selected shape behind the overlay, so reading a deck edited it.
	 */
	it('listens in the capture phase so the editor never sees the key', () => {
		expect(SOURCE).toContain(`window.addEventListener('keydown', this.keyListener, true)`);
		expect(SOURCE).toContain(`window.removeEventListener('keydown', this.keyListener, true)`);
	});

	it('swallows a navigation key from the editor and turns the page', () => {
		const { overlay } = createOverlay();
		const { event, calls } = keyEvent('ArrowRight');
		overlay.onKeyDown(event);
		expect(overlay.counter()).toBe('2 / 3');
		expect(calls).toStrictEqual({ stopPropagation: 1, preventDefault: 1 });
	});

	it('swallows an editing key rather than letting it delete an unseen shape', () => {
		const { overlay } = createOverlay();
		const { event, calls } = keyEvent('Delete');
		overlay.onKeyDown(event);
		expect(overlay.counter()).toBe('1 / 3');
		// Nothing browser-native needs breaking to keep it from the editor.
		expect(calls).toStrictEqual({ stopPropagation: 1, preventDefault: 0 });
	});

	it('lets a modifier chord through so the browser still owns Ctrl+P', () => {
		const { overlay } = createOverlay();
		const calls = { stopPropagation: 0, preventDefault: 0 };
		const event = new KeyboardEvent('keydown', { key: 'p', ctrlKey: true, cancelable: true });
		Object.assign(event, {
			stopPropagation: (): void => {
				calls.stopPropagation += 1;
			},
			preventDefault: (): void => {
				calls.preventDefault += 1;
			},
		});
		overlay.onKeyDown(event);
		expect(calls).toStrictEqual({ stopPropagation: 0, preventDefault: 0 });
	});

	it('leaves on Escape, on the slide the reader reached', () => {
		const { overlay, exits } = createOverlay();
		overlay.onKeyDown(keyEvent('ArrowRight').event);
		overlay.onKeyDown(keyEvent('Escape').event);
		expect(exits).toStrictEqual([1]);
	});

	/** One buffer per session: PowerPoint's "type a number, then Enter" jump. */
	it('jumps to a typed slide number', () => {
		const { overlay } = createOverlay();
		overlay.onKeyDown(keyEvent('3').event);
		overlay.onKeyDown(keyEvent('Enter').event);
		expect(overlay.counter()).toBe('3 / 3');
	});
});
