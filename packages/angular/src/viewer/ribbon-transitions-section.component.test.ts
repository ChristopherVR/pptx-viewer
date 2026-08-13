/**
 * ribbon-transitions-section.component.test.ts: pins that every control on the
 * Transitions tab reaches the deck.
 *
 * Before this wiring the tab committed only the preset and the duration (with a
 * hard-coded `advanceOnClick: true`), while the Advance Slide checkboxes and the
 * seconds field wrote component-local signals nothing read, so a timed advance
 * picked in the ribbon never existed anywhere but the checkbox. These assertions
 * fail against that version.
 *
 * No TestBed (matching the rest of this package): the component is constructed
 * inside a plain `Injector` context and its protected handlers are invoked with
 * the same event objects the template hands them.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { RIBBON_TRANSITION_PRESETS } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { RibbonTransitionsSectionComponent } from './ribbon-transitions-section.component';

/** The protected surface the template binds to. */
interface TransitionsControls {
	setTransition: (type: string) => void;
	onDurationChange: (event: Event) => void;
	onAdvanceOnClick: (event: Event) => void;
	onAdvanceAfter: (event: Event) => void;
	onAdvanceAfterText: (event: Event) => void;
	applyToAll: () => void;
	draft: () => {
		type: string;
		durationSec: number;
		advanceOnClick: boolean;
		advanceAfter: boolean;
		advanceAfterText: string;
	};
}

function slide(id: string): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [] } as unknown as PptxSlide;
}

function harness(slideCount = 2): {
	editor: EditorStateService;
	controls: TransitionsControls;
} {
	const editor = new EditorStateService();
	editor.setSlides(Array.from({ length: slideCount }, (_, index) => slide(`s${index + 1}`)));
	const injector = Injector.create({
		providers: [{ provide: EditorStateService, useValue: editor }],
	});
	const section = runInInjectionContext(injector, () => new RibbonTransitionsSectionComponent());
	return { editor, controls: section as unknown as TransitionsControls };
}

/** A change event carrying the value/checked the DOM control would report. */
function changeEvent(value: string | boolean): Event {
	const target =
		typeof value === 'boolean'
			? ({ checked: value } as HTMLInputElement)
			: ({ value } as HTMLInputElement);
	return { target } as unknown as Event;
}

describe('transitions ribbon tab', () => {
	it('offers the shared preset gallery rather than a hand-copied list', () => {
		const { controls } = harness();
		expect(RIBBON_TRANSITION_PRESETS.map((preset) => preset.type)).toContain('fade');
		expect(controls.draft().type).toBe('none');
	});

	it('writes the picked preset onto the active slide', () => {
		const { editor, controls } = harness();

		controls.setTransition('fade');

		expect(editor.slides()[0].transition).toMatchObject({ type: 'fade' });
		expect(editor.slides()[1].transition).toBeUndefined();
	});

	it('commits the duration in milliseconds without dropping the preset', () => {
		const { editor, controls } = harness();

		controls.setTransition('push');
		controls.onDurationChange(changeEvent('1.25'));

		expect(editor.slides()[0].transition).toMatchObject({ type: 'push', durationMs: 1250 });
	});

	it('commits the Advance Slide on-mouse-click toggle', () => {
		const { editor, controls } = harness();

		controls.setTransition('wipe');
		controls.onAdvanceOnClick(changeEvent(false));

		expect(editor.slides()[0].transition).toMatchObject({ advanceOnClick: false });
	});

	it('commits a timed advance from the After field, and clears it when unticked', () => {
		const { editor, controls } = harness();

		controls.onAdvanceAfter(changeEvent(true));
		controls.onAdvanceAfterText(changeEvent('00:03.50'));

		expect(editor.slides()[0].transition).toMatchObject({ advanceAfterMs: 3500 });
		expect(controls.draft().advanceAfter).toBeTruthy();

		controls.onAdvanceAfter(changeEvent(false));

		expect(editor.slides()[0].transition?.advanceAfterMs).toBeUndefined();
	});

	it('applies the current draft to every slide on Apply to All', () => {
		const { editor, controls } = harness(3);

		controls.setTransition('cover');
		controls.onDurationChange(changeEvent('0.4'));
		controls.applyToAll();

		for (const item of editor.slides()) {
			expect(item.transition).toMatchObject({ type: 'cover', durationMs: 400 });
		}
	});

	it('seeds its controls from the slide rather than from component state', () => {
		const { editor, controls } = harness();
		// A transition authored anywhere else (inspector, a loaded deck, undo) is
		// what an untouched tab shows, because the draft is derived from the deck.
		editor.updateSlide(0, { transition: { type: 'reveal', durationMs: 900 } });

		expect(controls.draft()).toMatchObject({ type: 'reveal', durationSec: 0.9 });

		// Once a control is touched the tab holds that draft for THIS slide, so a
		// half-made pick (After ticked, no time typed yet) is not thrown away.
		controls.setTransition('split');
		expect(controls.draft().type).toBe('split');
	});
});
