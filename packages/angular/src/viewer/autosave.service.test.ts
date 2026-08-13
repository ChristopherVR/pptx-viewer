import {
	DestroyRef,
	Injector,
	runInInjectionContext,
	ɵChangeDetectionScheduler as ChangeDetectionScheduler,
	ɵEffectScheduler as EffectScheduler,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AutosaveService } from './autosave.service';

vi.mock(import('../internal/shared'), async () => {
	const actual = await vi.importActual<typeof import('../internal/shared')>('../internal/shared');
	return { ...actual, saveAutosaveSnapshot: vi.fn(async () => true) };
});

const { saveAutosaveSnapshot } = await import('../internal/shared');

/**
 * The autosave TIMER contract, the Angular half of the polling pair.
 *
 * Angular and React poll on an interval while the document is dirty; Vue,
 * Svelte and Vanilla debounce on the slides signal being reassigned. A recovery
 * snapshot deliberately never clears the editor's dirty flag, so the polling
 * pair used to re-serialize and rewrite an identical deck on every tick, for as
 * long as the tab stayed open. These tests pin Angular onto the debounce
 * engines' trigger, and pin the cases where it must still write.
 *
 * Mirrors `packages/react/src/viewer/hooks/useAutosave.tick.test.tsx`; the two
 * must not drift.
 */
interface SchedulableEffect {
	run(): void;
}

/**
 * A bare injector rather than `TestBed`: this package has no Angular test
 * platform (no `@analogjs/vite-plugin-angular`), so `TestBed` cannot compile
 * its dynamic module. `bind()` registers an `effect`, which needs both
 * schedulers; the effect scheduler queues and is drained explicitly, because
 * running a watch inside `schedule()` is an error in Angular's own contract.
 */
function harness(): { autosave: AutosaveService; flushEffects: () => void } {
	const queued = new Set<SchedulableEffect>();
	const effects = {
		add: (effect: SchedulableEffect) => queued.add(effect),
		schedule: (effect: SchedulableEffect) => queued.add(effect),
		remove: (effect: SchedulableEffect) => queued.delete(effect),
		flush: () => {
			for (const effect of [...queued]) {
				queued.delete(effect);
				effect.run();
			}
		},
	};
	const injector = Injector.create({
		providers: [
			{ provide: TranslateService, useValue: { instant: (key: string) => key } },
			{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } },
			{ provide: ChangeDetectionScheduler, useValue: { notify: () => {} } },
			{ provide: EffectScheduler, useValue: effects },
		],
	});
	return {
		autosave: runInInjectionContext(injector, () => new AutosaveService()),
		flushEffects: () => effects.flush(),
	};
}

describe('autosave timer redundancy', () => {
	beforeEach(() => {
		vi.useFakeTimers();
		vi.mocked(saveAutosaveSnapshot).mockClear();
	});

	afterEach(() => {
		vi.useRealTimers();
	});

	interface Bound {
		serialize: ReturnType<typeof vi.fn>;
		sources: { value: readonly unknown[] };
		autosave: AutosaveService;
		tick: () => Promise<void>;
	}

	function bind(withSources: boolean): Bound {
		const serialize = vi.fn(async () => new Uint8Array([1, 2, 3]));
		const sources: { value: readonly unknown[] } = { value: [] };
		const { autosave, flushEffects } = harness();
		autosave.bind({
			enabled: () => true,
			filePath: () => 'deck.pptx',
			isDirty: () => true,
			serialize,
			intervalSeconds: () => 10,
			...(withSources ? { changeSources: () => sources.value } : {}),
		});
		// The interval is armed inside the bind effect.
		flushEffects();
		return {
			serialize,
			sources,
			autosave,
			tick: async () => {
				await vi.advanceTimersByTimeAsync(10_000);
			},
		};
	}

	it('writes the first snapshot, then skips ticks that change nothing', async () => {
		const slides = [{ id: 'slide1' }];
		const bound = bind(true);
		bound.sources.value = [slides];

		await bound.tick();
		expect(bound.serialize).toHaveBeenCalledOnce();
		expect(saveAutosaveSnapshot).toHaveBeenCalledOnce();

		await bound.tick();
		await bound.tick();
		expect(bound.serialize).toHaveBeenCalledOnce();
		expect(saveAutosaveSnapshot).toHaveBeenCalledOnce();
	});

	it('writes again as soon as an edit reassigns the slides', async () => {
		const slides = [{ id: 'slide1' }];
		const bound = bind(true);
		bound.sources.value = [slides];
		await bound.tick();
		expect(bound.serialize).toHaveBeenCalledOnce();

		// An immutable edit: same content, new array.
		bound.sources.value = [[...slides]];
		await bound.tick();
		expect(bound.serialize).toHaveBeenCalledTimes(2);
	});

	it('writes on every tick when the host supplies no change sources', async () => {
		const bound = bind(false);
		await bound.tick();
		await bound.tick();
		expect(bound.serialize).toHaveBeenCalledTimes(2);
	});

	it('never suppresses an explicit triggerAutosave', async () => {
		const bound = bind(true);
		bound.sources.value = [[{ id: 'slide1' }]];

		await bound.autosave.triggerAutosave();
		await bound.autosave.triggerAutosave();
		expect(bound.serialize).toHaveBeenCalledTimes(2);
	});
});
