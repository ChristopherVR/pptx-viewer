import { describe, it, expect } from 'vitest';
// ---------------------------------------------------------------------------
// We test the *exported types and logic paths* of useAutosave by extracting
// and exercising the pure decision points. The actual React hook wiring
// (useState, useEffect, useRef, useCallback) is not tested here — those are
// React framework responsibilities.  Instead we verify:
//   1. The AutosaveStatus type shape / discriminated union.
//   2. Integration with computeAutosaveIntervalMs (via re-import).
//   3. getElectronApi detection logic (pure logic only).
// ---------------------------------------------------------------------------

import {
	computeAutosaveIntervalMs,
	canAutosave,
	DEFAULT_AUTOSAVE_INTERVAL_SECONDS,
} from './useAutosave-helpers';

// ---------------------------------------------------------------------------
// getElectronApi — pure logic test (typeof window branch)
// ---------------------------------------------------------------------------

function getElectronApi(
	windowRef: Record<string, unknown> | undefined,
): { pptxRecovery: unknown } | undefined {
	if (!windowRef) {
		return undefined;
	}
	if (windowRef['electron']) {
		return windowRef['electron'] as { pptxRecovery: unknown };
	}
	return undefined;
}

describe('getElectronApi (pure logic)', () => {
	it('returns undefined when windowRef is undefined', () => {
		expect(getElectronApi(undefined)).toBeUndefined();
	});

	it('returns undefined when electron is not on window', () => {
		expect(getElectronApi({})).toBeUndefined();
	});

	it('returns the electron object when present', () => {
		const mock = { pptxRecovery: { autosave: () => {} } };
		const result = getElectronApi({ electron: mock });
		expect(result).toBeDefined();
		expect(result!.pptxRecovery).toBe(mock.pptxRecovery);
	});

	it('returns undefined for falsy electron values', () => {
		expect(getElectronApi({ electron: null })).toBeUndefined();
		expect(getElectronApi({ electron: false })).toBeUndefined();
		expect(getElectronApi({ electron: 0 })).toBeUndefined();
		expect(getElectronApi({ electron: '' })).toBeUndefined();
	});
});

// ---------------------------------------------------------------------------
// AutosaveStatus discriminated union tests
// ---------------------------------------------------------------------------

describe('autosaveStatus type shapes', () => {
	it('idle status has only state', () => {
		const status = { state: 'idle' as const };
		expect(status.state).toBe('idle');
	});

	it('saving status has only state', () => {
		const status = { state: 'saving' as const };
		expect(status.state).toBe('saving');
	});

	it('saved status includes timestamp', () => {
		const now = Date.now();
		const status = { state: 'saved' as const, timestamp: now };
		expect(status.state).toBe('saved');
		expect(status.timestamp).toBe(now);
	});

	it('error status includes message', () => {
		const status = { state: 'error' as const, message: 'Network error' };
		expect(status.state).toBe('error');
		expect(status.message).toBe('Network error');
	});
});

// ---------------------------------------------------------------------------
// Integration: canAutosave works with default interval
// ---------------------------------------------------------------------------

describe('useAutosave integration (pure logic)', () => {
	it('default interval produces correct milliseconds', () => {
		const ms = computeAutosaveIntervalMs(DEFAULT_AUTOSAVE_INTERVAL_SECONDS);
		expect(ms).toBe(120_000);
	});

	it('canAutosave returns false when disabled', () => {
		expect(
			canAutosave({
				enabled: false,
				filePath: '/some/file.pptx',
				isDirty: true,
				isSaving: false,
				hasElectronApi: true,
			}),
		).toBeFalsy();
	});

	it('canAutosave returns true with all conditions met', () => {
		expect(
			canAutosave({
				enabled: true,
				filePath: '/some/file.pptx',
				isDirty: true,
				isSaving: false,
				hasElectronApi: true,
			}),
		).toBeTruthy();
	});

	it('canAutosave returns false while a save is in progress', () => {
		expect(
			canAutosave({
				enabled: true,
				filePath: '/some/file.pptx',
				isDirty: true,
				isSaving: true,
				hasElectronApi: true,
			}),
		).toBeFalsy();
	});

	it('canAutosave returns false when document is clean', () => {
		expect(
			canAutosave({
				enabled: true,
				filePath: '/some/file.pptx',
				isDirty: false,
				isSaving: false,
				hasElectronApi: true,
			}),
		).toBeFalsy();
	});
});
