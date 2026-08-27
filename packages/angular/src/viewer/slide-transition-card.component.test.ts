/**
 * slide-transition-card.component.test.ts: pins the Speed and Morph-option
 * controls added to the SLIDE TRANSITION card (parity with the same controls
 * added to react/vue/svelte/vanilla).
 *
 * No TestBed (matching the rest of this package): the component is
 * constructed inside a plain `Injector` context, mirroring
 * `ribbon-transitions-section.component.test.ts`. `slideIndex`/`canEdit` are
 * `input()` signals the framework normally binds, so the harness overwrites
 * them with plain zero-arg functions after construction; every consumer in
 * the component just calls them (`this.slideIndex()`), so a plain function
 * satisfies that contract without a real Angular input binding.
 */
import { Injector, runInInjectionContext } from '@angular/core';
import type { PptxSlide, PptxSlideTransition } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { TRANSITION_MORPH_OPTIONS, TRANSITION_SPEED_OPTIONS } from '../internal/shared';
import { EditorStateService } from './editor-state.service';
import { SlideTransitionCardComponent } from './slide-transition-card.component';

/** The protected surface the template binds to. */
interface TransitionCardControls {
	onSpeed: (event: Event) => void;
	onMorphOption: (event: Event) => void;
	speed: () => string;
	morphOption: () => string;
	isMorph: () => boolean;
}

function slide(id: string, transition?: PptxSlideTransition): PptxSlide {
	return { id, rId: id, slideNumber: 1, elements: [], transition } as unknown as PptxSlide;
}

/** A change event carrying the value a `<select>` would report. */
function changeEvent(value: string): Event {
	return { target: { value } as HTMLSelectElement } as unknown as Event;
}

function harness(transition?: PptxSlideTransition): {
	editor: EditorStateService;
	controls: TransitionCardControls;
} {
	const editor = new EditorStateService();
	editor.setSlides([slide('s1', transition)]);
	const injector = Injector.create({
		providers: [{ provide: EditorStateService, useValue: editor }],
	});
	const card = runInInjectionContext(injector, () => new SlideTransitionCardComponent());
	// See the module doc: `input()` fields are overwritten with plain functions
	// since nothing here binds them through Angular's real input machinery.
	(card as unknown as { slideIndex: () => number }).slideIndex = () => 0;
	(card as unknown as { canEdit: () => boolean }).canEdit = () => true;
	return { editor, controls: card as unknown as TransitionCardControls };
}

describe('slide transition card: speed control', () => {
	it('offers the shared speed catalogue, defaulting to fast', () => {
		const { controls } = harness({ type: 'fade', durationMs: 500 });
		expect(TRANSITION_SPEED_OPTIONS.map((o) => o.value)).toStrictEqual(['slow', 'med', 'fast']);
		expect(controls.speed()).toBe('fast');
	});

	it('is offered for every transition type, including none', () => {
		const { controls } = harness(undefined);
		expect(controls.speed()).toBe('fast');
	});

	it('writes the chosen speed onto the slide without dropping the type', () => {
		const { editor, controls } = harness({ type: 'push', direction: 'l', durationMs: 500 });

		controls.onSpeed(changeEvent('slow'));

		expect(editor.slides()[0].transition).toMatchObject({
			type: 'push',
			direction: 'l',
			speed: 'slow',
		});
	});
});

describe('slide transition card: morph-option control', () => {
	it('is hidden for a non-morph transition', () => {
		const { controls } = harness({ type: 'fade', durationMs: 500 });
		expect(controls.isMorph()).toBeFalsy();
	});

	it('offers the shared morph-option catalogue for the morph transition, defaulting to byObject', () => {
		const { controls } = harness({ type: 'morph', durationMs: 2000 });
		expect(TRANSITION_MORPH_OPTIONS.map((o) => o.value)).toStrictEqual([
			'byObject',
			'byWord',
			'byChar',
		]);
		expect(controls.isMorph()).toBeTruthy();
		expect(controls.morphOption()).toBe('byObject');
	});

	it('writes the chosen morph option onto the slide without dropping the type', () => {
		const { editor, controls } = harness({ type: 'morph', durationMs: 2000 });

		controls.onMorphOption(changeEvent('byChar'));

		expect(editor.slides()[0].transition).toMatchObject({ type: 'morph', morphOption: 'byChar' });
	});
});
