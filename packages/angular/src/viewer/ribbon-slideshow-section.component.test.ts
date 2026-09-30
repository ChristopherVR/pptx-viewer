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
import { TranslateService } from '@ngx-translate/core';
import { describe, expect, it } from 'vitest';

import { LoadContentService } from './load-content.service';
import { RibbonSlideshowSectionComponent } from './ribbon-slideshow-section.component';

/** The protected surface the template binds to. */
interface OptionControls {
	onOptionsChange: (event: Event) => void;
	optionLabels: () => Record<string, string>;
	onCommand: (event: Event) => void;
}

function harness(): {
	loader: LoadContentService;
	controls: OptionControls;
	section: RibbonSlideshowSectionComponent;
} {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = { onDestroy: () => () => {} };
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: destroyRefStub },
			LoadContentService,
			{ provide: TranslateService, useValue: { instant: (key: string) => key } },
		],
	});
	const loader = injector.get(LoadContentService);
	const section = runInInjectionContext(injector, () => new RibbonSlideshowSectionComponent());
	return { loader, controls: section as unknown as OptionControls, section };
}

describe('slide show ribbon options adapter', () => {
	it('supplies translated labels for all four shared options', () => {
		const { controls } = harness();
		expect(Object.keys(controls.optionLabels())).toStrictEqual([
			'keepUpdated',
			'useTimings',
			'playNarrations',
			'mediaControls',
		]);
	});

	it('merges a shared options intent into the current presentation properties', () => {
		const { loader, controls } = harness();
		loader.presentationProperties.set({ loopContinuously: true });
		controls.onOptionsChange({ detail: { advanceMode: 'manual' } } as unknown as Event);
		controls.onOptionsChange({ detail: { showWithNarration: false } } as unknown as Event);
		expect(loader.presentationProperties()).toStrictEqual({
			loopContinuously: true,
			advanceMode: 'manual',
			showWithNarration: false,
		});
	});

	it('routes command intents to distinct output boundaries', () => {
		const { controls, section } = harness();
		let beginning = 0;
		let current = 0;
		const subscriptions = [
			section.presentFromBeginning.subscribe(() => {
				beginning += 1;
			}),
			section.presentFromCurrent.subscribe(() => {
				current += 1;
			}),
		];
		controls.onCommand({
			detail: { id: 'slideShow.startSlideShow.fromBeginning' },
		} as unknown as Event);
		controls.onCommand({
			detail: { id: 'slideShow.startSlideShow.fromCurrent' },
		} as unknown as Event);
		expect(beginning).toBe(1);
		expect(current).toBe(1);
		subscriptions.forEach((subscription) => subscription.unsubscribe());
	});
});
