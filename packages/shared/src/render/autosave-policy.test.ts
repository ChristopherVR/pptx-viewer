import { describe, expect, it } from 'vitest';

import {
	AUTOSAVE_DEFAULT_INTERVAL_MS,
	autosaveDisabledReasonKey,
	nextAutosaveDelayMs,
	resolveAutosaveActivation,
	resolveAutosaveIntervalMs,
} from './autosave-policy';

/**
 * The rule under test: an explicit host prop is a POLICY CEILING, the user's
 * toggle is a PREFERENCE inside it. Before this module the five bindings each
 * answered differently, and three of them defaulted the feature off entirely.
 */
describe('resolveAutosaveActivation', () => {
	const base = {
		userEnabled: true,
		canEdit: true,
		filePath: 'deck.pptx',
	};

	it('runs when the host says nothing: the default is ON, not OFF', () => {
		expect(resolveAutosaveActivation(base)).toStrictEqual({ active: true, toggleAvailable: true });
		expect(resolveAutosaveActivation({ ...base, hostAutosave: undefined }).active).toBeTruthy();
	});

	it('lets an explicit host veto beat the user toggle, and takes the toggle away', () => {
		const result = resolveAutosaveActivation({ ...base, hostAutosave: false });
		expect(result.active).toBeFalsy();
		expect(result.toggleAvailable).toBeFalsy();
		expect(result.reason).toBe('autosave_host_off');
	});

	it('lets the user toggle decide once the host permits it', () => {
		expect(
			resolveAutosaveActivation({ ...base, hostAutosave: true, userEnabled: false }),
		).toStrictEqual({
			active: false,
			toggleAvailable: true,
			reason: 'autosave_toggle_off',
		});
		expect(resolveAutosaveActivation({ ...base, hostAutosave: true }).active).toBeTruthy();
	});

	it('reports the two gates nobody can negotiate', () => {
		expect(resolveAutosaveActivation({ ...base, filePath: undefined }).reason).toBe('no_file_path');
		expect(resolveAutosaveActivation({ ...base, canEdit: false }).reason).toBe('read_only');
	});

	it('maps every reason to a message key', () => {
		expect(autosaveDisabledReasonKey('autosave_host_off')).toBe('pptx.autosave.disabledByHost');
		expect(autosaveDisabledReasonKey('autosave_toggle_off')).toBe(
			'pptx.autosave.disabledToggleOff',
		);
		expect(autosaveDisabledReasonKey('no_file_path')).toBe('pptx.autosave.disabledNoFilePath');
		expect(autosaveDisabledReasonKey('read_only')).toBe('pptx.autosave.disabledReadOnly');
		expect(autosaveDisabledReasonKey(undefined)).toBe('pptx.autosave.disabled');
	});
});

describe('resolveAutosaveIntervalMs', () => {
	it('honours an explicit host interval, including a short demo cadence', () => {
		expect(resolveAutosaveIntervalMs({ hostIntervalMs: 2000, optionsIntervalSeconds: 120 })).toBe(
			2000,
		);
	});

	it('falls back to the user AutoRecover cadence, clamped to the shared minimum', () => {
		expect(resolveAutosaveIntervalMs({ optionsIntervalSeconds: 300 })).toBe(300_000);
		expect(resolveAutosaveIntervalMs({ optionsIntervalSeconds: 1 })).toBe(10_000);
	});

	it('falls back to one shared default when nobody said anything', () => {
		expect(resolveAutosaveIntervalMs({})).toBe(AUTOSAVE_DEFAULT_INTERVAL_MS);
		expect(AUTOSAVE_DEFAULT_INTERVAL_MS).toBe(120_000);
	});

	it('refuses a nonsensical host value rather than spinning the timer', () => {
		expect(resolveAutosaveIntervalMs({ hostIntervalMs: 0 })).toBe(50);
		expect(resolveAutosaveIntervalMs({ hostIntervalMs: Number.NaN })).toBe(
			AUTOSAVE_DEFAULT_INTERVAL_MS,
		);
	});
});

/**
 * The promise both engine shapes have to keep: a snapshot lands no later than
 * one interval after the FIRST unsaved edit. A plain debounce breaks it, which
 * is why this cap exists.
 */
describe('nextAutosaveDelayMs', () => {
	it('waits a full interval when nothing is outstanding', () => {
		expect(nextAutosaveDelayMs({ intervalMs: 2000, firstDirtyAt: null, now: 1000 })).toBe(2000);
	});

	it('caps a re-armed debounce at what is left of the first edit interval', () => {
		expect(nextAutosaveDelayMs({ intervalMs: 2000, firstDirtyAt: 1000, now: 2500 })).toBe(500);
	});

	it('fires immediately once the first edit has waited a whole interval', () => {
		expect(nextAutosaveDelayMs({ intervalMs: 2000, firstDirtyAt: 1000, now: 9000 })).toBe(0);
	});

	it('never exceeds the interval even with a clock that moved backwards', () => {
		expect(nextAutosaveDelayMs({ intervalMs: 2000, firstDirtyAt: 5000, now: 1000 })).toBe(2000);
	});
});
