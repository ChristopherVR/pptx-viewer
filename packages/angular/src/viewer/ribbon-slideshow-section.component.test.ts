/**
 * ribbon-slideshow-section.component.test.ts: pins the Slide Show tab's Options
 * cluster against the shared descriptors.
 *
 * The four checkboxes used to render hard-coded `checked` with
 * `(click)="$event.preventDefault()"`, so "Use Timings" claimed to be on
 * whatever the deck said and unticking it changed nothing. These assertions
 * fail against that version: nothing was readable and nothing was writable.
 *
 * No TestBed (matching the rest of this package): the component is constructed
 * inside a plain `Injector` context with a DestroyRef stub for
 * {@link LoadContentService}, which owns the deck's presentation properties.
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import { describe, expect, it } from 'vitest';

import type { SlideShowOptionId } from '../internal/shared';
import { SLIDE_SHOW_OPTIONS } from '../internal/shared';
import { LoadContentService } from './load-content.service';
import { RibbonSlideshowSectionComponent } from './ribbon-slideshow-section.component';

/** The protected surface the template binds to. */
interface OptionControls {
	isOptionChecked: (id: SlideShowOptionId) => boolean;
	onOptionChange: (id: SlideShowOptionId, event: Event) => void;
	primaryOptions: readonly { id: SlideShowOptionId; unsupported: boolean }[];
	secondaryOptions: readonly { id: SlideShowOptionId; unsupported: boolean }[];
}

function harness(): { loader: LoadContentService; controls: OptionControls } {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = { onDestroy: () => () => {} };
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }, LoadContentService],
	});
	const loader = injector.get(LoadContentService);
	const section = runInInjectionContext(injector, () => new RibbonSlideshowSectionComponent());
	return { loader, controls: section as unknown as OptionControls };
}

function tick(checked: boolean): Event {
	return { target: { checked } as HTMLInputElement } as unknown as Event;
}

describe('slide show ribbon options', () => {
	it('renders the shared option set, in order, across the two columns', () => {
		const { controls } = harness();

		expect(
			[...controls.primaryOptions, ...controls.secondaryOptions].map((o) => o.id),
		).toStrictEqual(SLIDE_SHOW_OPTIONS.map((o) => o.id));
	});

	it('unticking Use Timings puts the deck into manual advance', () => {
		const { loader, controls } = harness();
		expect(controls.isOptionChecked('useTimings')).toBeTruthy();

		controls.onOptionChange('useTimings', tick(false));

		expect(loader.presentationProperties().advanceMode).toBe('manual');
		expect(controls.isOptionChecked('useTimings')).toBeFalsy();

		controls.onOptionChange('useTimings', tick(true));
		expect(loader.presentationProperties().advanceMode).toBe('useTimings');
	});

	it('commits the narration flag and leaves the rest of the properties alone', () => {
		const { loader, controls } = harness();
		loader.presentationProperties.set({ loopContinuously: true });

		controls.onOptionChange('playNarrations', tick(false));

		expect(loader.presentationProperties()).toStrictEqual({
			loopContinuously: true,
			showWithNarration: false,
		});
		expect(controls.isOptionChecked('playNarrations')).toBeFalsy();
	});

	it('leaves the unsupported options unchecked, disabled and inert', () => {
		const { loader, controls } = harness();
		const unsupported = SLIDE_SHOW_OPTIONS.filter((option) => option.unsupported).map((o) => o.id);
		expect(unsupported).toStrictEqual(['keepUpdated', 'mediaControls']);

		for (const id of unsupported) {
			expect(controls.isOptionChecked(id)).toBeFalsy();
			controls.onOptionChange(id, tick(true));
		}

		expect(loader.presentationProperties()).toStrictEqual({});
	});
});
