/**
 * load-content-options-tracking.test.ts: a preference write must not reload
 * the deck.
 *
 * The viewer loads from an `effect` that calls `LoadContentService.load()`.
 * `load()` reads Trust Center > "Allow external content" off the Options
 * store synchronously, before its first await, so a TRACKED read there made
 * the load effect depend on the whole store: the title-bar AutoSave switch,
 * every ribbon View toggle and every Options dialog field re-parsed the deck
 * from its original bytes and re-seeded the editor, discarding unsaved edits
 * and the undo history (and stalling the main thread for seconds on a slow
 * machine). React's load effect depends on `[content]` only; this pins
 * Angular to the same contract.
 *
 * Same bare-injector harness as `autosave.service.test.ts`: no TestBed here.
 */
import {
	DestroyRef,
	Injector,
	effect,
	runInInjectionContext,
	signal,
	ɵChangeDetectionScheduler as ChangeDetectionScheduler,
	ɵEffectScheduler as EffectScheduler,
} from '@angular/core';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { LoadContentService } from './load-content.service';
import { ViewerOptionsService } from './viewer-options.service';

interface SchedulableEffect {
	run(): void;
}

function harness(): {
	injector: Injector;
	loader: LoadContentService;
	options: ViewerOptionsService;
	flushEffects: () => void;
} {
	const queued = new Set<SchedulableEffect>();
	const effects = {
		add: (item: SchedulableEffect) => queued.add(item),
		schedule: (item: SchedulableEffect) => queued.add(item),
		remove: (item: SchedulableEffect) => queued.delete(item),
		flush: () => {
			for (const item of [...queued]) {
				queued.delete(item);
				item.run();
			}
		},
	};
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } },
			{ provide: ChangeDetectionScheduler, useValue: { notify: () => {} } },
			{ provide: EffectScheduler, useValue: effects },
			{ provide: ViewerOptionsService, useClass: ViewerOptionsService },
			{ provide: LoadContentService, useClass: LoadContentService },
		],
	});
	return {
		injector,
		loader: injector.get(LoadContentService),
		options: injector.get(ViewerOptionsService),
		flushEffects: () => effects.flush(),
	};
}

async function blankDeck(): Promise<ArrayBuffer> {
	const { handler, data } = await PptxHandler.create({ title: 'Deck', initialSlideCount: 1 });
	const bytes = await handler.save(data.slides);
	handler.dispose();
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('load() inside the viewer load effect', () => {
	it('re-runs for new content but not for an Options store write', async () => {
		const { injector, loader, options, flushEffects } = harness();
		const content = signal<ArrayBuffer | null>(await blankDeck());
		const load = vi.spyOn(loader, 'load');

		// The viewer's own shape: track the content, call load.
		runInInjectionContext(injector, () => {
			effect(() => {
				void loader.load(content());
			});
		});
		flushEffects();
		expect(load).toHaveBeenCalledOnce();
		await vi.waitFor(() => expect(loader.slides()).toHaveLength(1));

		// The AutoSave switch, a View toggle, an Options field: all of these end
		// in a store write. None of them may re-arm the load effect, not even the
		// very option `load()` reads.
		options.setValue('trust', 'allowExternalContent', true);
		options.setValue('save', 'autoSave', false);
		flushEffects();
		expect(load, 'a preference write must not reload the deck').toHaveBeenCalledOnce();

		// Sanity: the effect is alive and does still follow its real dependency.
		content.set(await blankDeck());
		flushEffects();
		expect(load).toHaveBeenCalledTimes(2);
	});
});
