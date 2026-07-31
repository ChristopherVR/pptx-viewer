import { readFileSync } from 'node:fs';
import path from 'node:path';

/**
 * Outline view, Angular binding.
 *
 * The outline's rules are proved once in `pptx-viewer-shared/render/outline-view`
 * and `.../outline-view-edit`. What is worth proving here is the glue: that the
 * ribbon control is live, that the pane carries the neutral DOM contract `e2e/`
 * addresses all five viewers through, and above all that a gesture in a row
 * produces the right new deck. That glue is what has historically rotted in this
 * repo, never the shared maths.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is constructed in a
 * plain `Injector` context with its inputs replaced by writable signals in a
 * test subclass, and the template contract is read from the source. The model
 * asserted here is literally what the template binds: `rows()` is the `@for`,
 * and `onInput` / `onRowKeyDown` are its two event bindings.
 *
 * Reference binding: packages/react/src/viewer/components/OutlineViewOverlay.test.tsx
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { OUTLINE_ROW_ATTR, OUTLINE_VIEW_ATTR } from '../internal/shared';
import type { CanvasSize, OutlineRow } from '../internal/shared';
import { OutlineViewOverlayComponent } from './outline-view-overlay.component';
import type { OutlineCommit } from './outline-view-overlay.component';

const CANVAS: CanvasSize = { width: 960, height: 540 };

function textElement(id: string, partial: Partial<PptxElement> = {}): PptxElement {
	return {
		type: 'text',
		id,
		name: 'Text Box',
		x: 0,
		y: 0,
		width: 100,
		height: 50,
		text: '',
		...partial,
	} as PptxElement;
}

const placeholder = (type: string): Record<string, unknown> => ({
	'p:nvSpPr': { 'p:nvPr': { 'p:ph': { '@_type': type } } },
});

function deck(): PptxSlide[] {
	return [
		{
			id: 's1',
			rId: '',
			slideNumber: 1,
			elements: [
				textElement('t', { text: 'Agenda', rawXml: placeholder('title') }),
				textElement('b', {
					rawXml: placeholder('body'),
					text: 'First\nSecond',
					textSegments: [
						{ text: 'First', style: {} },
						{ text: '\n', style: {}, isParagraphBreak: true },
						{ text: 'Second', style: {} },
					],
				}),
			],
		},
		// A slide with no text at all: it must still appear, or the outline hides it.
		{ id: 's2', rId: '', slideNumber: 2, elements: [] } as unknown as PptxSlide,
	];
}

/**
 * The overlay with its inputs replaced by writable signals.
 *
 * Subclass field initializers run after the base class's, so these shadow the
 * `input()` signals the real component declares. Every computed reads them
 * through `this`, so the model under test is the shipped one.
 */
class TestOutlineViewOverlay extends OutlineViewOverlayComponent {
	override readonly slides = signal<readonly PptxSlide[]>(deck()) as unknown as InputSignal<
		readonly PptxSlide[]
	>;
	override readonly canvasSize = signal(CANVAS) as unknown as InputSignal<CanvasSize>;
	override readonly canEdit = signal(true) as unknown as InputSignal<boolean>;
}

/** The protected model + handlers the template binds to. */
interface OverlayModel {
	rows: () => OutlineRow[];
	onInput: (event: Event, key: string) => void;
	onRowKeyDown: (event: KeyboardEvent, key: string) => void;
	slides: { set: (value: readonly PptxSlide[]) => void };
	canEdit: { set: (value: boolean) => void };
}

/**
 * Build the overlay over a deck the harness owns, re-feeding every committed
 * deck straight back in, which is exactly what the host component does. A
 * commit that never reaches `rows()` therefore fails here.
 */
function createOverlay(canEdit = true): { overlay: OverlayModel; commits: OutlineCommit[] } {
	const instance = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new TestOutlineViewOverlay(),
	);
	const model = instance as unknown as OverlayModel;
	model.canEdit.set(canEdit);
	const commits: OutlineCommit[] = [];
	instance.commit.subscribe((commit) => {
		commits.push(commit);
		model.slides.set(commit.slides);
	});
	return { overlay: model, commits };
}

function inputEvent(value: string): Event {
	const event = new Event('input');
	Object.defineProperty(event, 'target', { value: { value } });
	return event;
}

function keyEvent(key: string, init: KeyboardEventInit = {}): KeyboardEvent {
	return new KeyboardEvent('keydown', { key, cancelable: true, ...init });
}

const SOURCE = readFileSync(
	path.join(import.meta.dirname, 'outline-view-overlay.component.ts'),
	'utf8',
);
const VIEW_SECTION = readFileSync(
	path.join(import.meta.dirname, 'ribbon-view-section.component.ts'),
	'utf8',
);

// ---------------------------------------------------------------------------
// Ribbon control
// ---------------------------------------------------------------------------

describe('view tab Outline View control', () => {
	it('is a live command next to the other presentation views', () => {
		expect(VIEW_SECTION).toContain('(click)="openOutlineView.emit()"');
		expect(VIEW_SECTION).not.toMatch(
			/<button[^>]*disabled[^>]*>\s*\{\{ 'pptx\.view\.outlineView' \| translate \}\}/u,
		);
	});
});

// ---------------------------------------------------------------------------
// DOM contract
// ---------------------------------------------------------------------------

describe('outline view DOM contract', () => {
	it('carries the neutral attributes e2e addresses all five bindings through', () => {
		expect(SOURCE).toContain(`[attr.${OUTLINE_VIEW_ATTR}]`);
		expect(SOURCE).toContain(`[attr.${OUTLINE_ROW_ATTR}]`);
		expect(SOURCE).toContain(`'pptx.view.outlineView' | translate`);
	});
});

// ---------------------------------------------------------------------------
// Model
// ---------------------------------------------------------------------------

describe('outline view overlay', () => {
	it('reflects the deck: title, body lines, and the titleless slide', () => {
		const { overlay } = createOverlay();
		expect(overlay.rows().map((row) => row.text)).toStrictEqual(['Agenda', 'First', 'Second', '']);
		expect(overlay.rows().map((row) => row.level)).toStrictEqual([0, 1, 1, 0]);
	});

	it('an edit reaches the slide', () => {
		const { overlay, commits } = createOverlay();
		overlay.onInput(inputEvent('Rewritten'), overlay.rows()[1].key);
		expect(commits).toHaveLength(1);
		const body = commits[0].slides[0].elements.find((element) => element.id === 'b');
		expect((body as { text?: string }).text).toBe('Rewritten\nSecond');
		expect(overlay.rows()[1].text).toBe('Rewritten');
	});

	it('demotes with Tab and promotes with Shift+Tab', () => {
		const { overlay } = createOverlay();
		overlay.onRowKeyDown(keyEvent('Tab'), overlay.rows()[1].key);
		expect(overlay.rows()[1].level).toBe(2);
		overlay.onRowKeyDown(keyEvent('Tab', { shiftKey: true }), overlay.rows()[1].key);
		expect(overlay.rows()[1].level).toBe(1);
	});

	it('adds a slide when Enter lands on a title row', () => {
		const { overlay, commits } = createOverlay();
		overlay.onRowKeyDown(keyEvent('Enter'), overlay.rows()[0].key);
		expect(commits[0].slides).toHaveLength(3);
		expect(commits[0].activeSlideIndex).toBe(1);
		expect(overlay.rows()).toHaveLength(5);
	});

	it('typing into a titleless slide creates its title', () => {
		const { overlay, commits } = createOverlay();
		overlay.onInput(inputEvent('Brand new'), overlay.rows()[3].key);
		expect(commits[0].slides[1].elements).toHaveLength(1);
		expect(overlay.rows()[3].text).toBe('Brand new');
	});

	it('cancels the browser default for Tab, so focus stays in the outline', () => {
		const { overlay } = createOverlay();
		const event = keyEvent('Tab');
		overlay.onRowKeyDown(event, overlay.rows()[1].key);
		expect(event.defaultPrevented).toBeTruthy();
	});

	it('commits nothing when the viewer cannot edit', () => {
		const { overlay, commits } = createOverlay(false);
		overlay.onInput(inputEvent('Nope'), overlay.rows()[1].key);
		overlay.onRowKeyDown(keyEvent('Tab'), overlay.rows()[1].key);
		expect(commits).toHaveLength(0);
	});
});
