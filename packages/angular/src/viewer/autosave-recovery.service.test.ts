import {
	DestroyRef,
	Injector,
	runInInjectionContext,
	signal,
	ɵChangeDetectionScheduler as ChangeDetectionScheduler,
	ɵEffectScheduler as EffectScheduler,
} from '@angular/core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Does Angular actually OFFER a crash-recovery snapshot back?
 *
 * It wrote snapshots from the day autosave landed and never looked for one
 * again, so the data was there and nothing surfaced it. The IndexedDB round trip
 * is proved in `pptx-viewer-shared/render/autosave-recovery.test.ts`; here the
 * shared probe is stubbed so the assertion is about the wiring: probe -> prompt
 * -> restore/discard.
 */
const { probeMock, discardMock } = vi.hoisted(() => ({
	probeMock: vi.fn(),
	discardMock: vi.fn(),
}));

vi.mock(import('../internal/shared'), async () => {
	const actual = await vi.importActual<typeof import('../internal/shared')>('../internal/shared');
	return { ...actual, probeAutosaveRecovery: probeMock, discardAutosaveRecovery: discardMock };
});

const { AutosaveRecoveryService } = await import('./autosave-recovery.service');
const { autosaveRecoveryPrompt } = await import('../internal/shared');

interface SchedulableEffect {
	run(): void;
}

/** Same bare-injector harness as `autosave.service.test.ts` (no TestBed here). */
function harness(): { service: InstanceType<typeof AutosaveRecoveryService>; flush: () => void } {
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
			{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } },
			{ provide: ChangeDetectionScheduler, useValue: { notify: () => {} } },
			{ provide: EffectScheduler, useValue: effects },
		],
	});
	return {
		service: runInInjectionContext(injector, () => new AutosaveRecoveryService()),
		flush: () => effects.flush(),
	};
}

const BYTES = new Uint8Array([0x50, 0x4b, 3, 4]);
const RECORD = { key: 'deck.pptx', data: BYTES, timestamp: Date.now() - 60_000, size: 4096 };

function offer() {
	return {
		record: RECORD,
		prompt: autosaveRecoveryPrompt({ record: RECORD, now: Date.now() })!,
	};
}

describe('autosaveRecoveryService', () => {
	beforeEach(() => {
		probeMock.mockReset();
		discardMock.mockReset();
	});

	function bind(overrides: { loading?: boolean; slideCount?: number; allowed?: boolean } = {}) {
		const { service, flush } = harness();
		const restore = vi.fn();
		const loading = signal(overrides.loading ?? false);
		service.bind({
			filePath: () => 'deck.pptx',
			loading: () => loading(),
			error: () => null,
			slideCount: () => overrides.slideCount ?? 3,
			autosaveAllowed: () => overrides.allowed ?? true,
			restore,
		});
		flush();
		return { service, restore, loading, flush };
	}

	it('offers the shared prompt once the deck has loaded', async () => {
		probeMock.mockResolvedValue(offer());
		const { service } = bind();
		await Promise.resolve();
		expect(service.prompt()?.titleKey).toBe('pptx.autosave.recovery.title');
	});

	it('hands the recovered bytes to the viewer on restore, then closes', async () => {
		probeMock.mockResolvedValue(offer());
		const { service, restore } = bind();
		await Promise.resolve();
		service.restore();
		expect(restore).toHaveBeenCalledWith(BYTES);
		expect(service.prompt()).toBeNull();
	});

	it('drops the snapshot on discard, and never loads it', async () => {
		probeMock.mockResolvedValue(offer());
		discardMock.mockResolvedValue(undefined);
		const { service, restore } = bind();
		await Promise.resolve();
		service.discard();
		expect(discardMock).toHaveBeenCalledWith(expect.objectContaining({ key: 'deck.pptx' }));
		expect(restore).not.toHaveBeenCalled();
		expect(service.prompt()).toBeNull();
	});

	it('never probes while loading, without slides, or when the host forbade autosave', async () => {
		probeMock.mockResolvedValue(offer());
		bind({ loading: true });
		bind({ slideCount: 0 });
		bind({ allowed: false });
		await Promise.resolve();
		expect(probeMock).not.toHaveBeenCalled();
	});
});
