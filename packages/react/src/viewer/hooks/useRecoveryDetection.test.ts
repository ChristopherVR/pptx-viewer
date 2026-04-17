import { describe, it, expect, vi, expectTypeOf } from 'vitest';

import type { UseRecoveryDetectionInput } from './useRecoveryDetection';
import {
	shouldCheckRecovery,
	hasRecentRecoveryVersion,
	RECOVERY_WINDOW_MS,
} from './useRecoveryDetection-helpers';

// ---------------------------------------------------------------------------
// useRecoveryDetection is a small hook that:
//   1. Uses shouldCheckRecovery to guard the check
//   2. Calls electron.pptxRecovery.getVersions
//   3. Calls hasRecentRecoveryVersion
//   4. Opens version history if recent
//
// The helpers are already tested in useRecoveryDetection-helpers.test.ts.
// Here we test additional edge cases and the decision flow as pure logic.
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Decision flow (pure logic)
// ---------------------------------------------------------------------------

/**
 * Simulate the full recovery detection decision flow.
 * Mirrors the logic in the useRecoveryDetection useEffect.
 */
async function simulateRecoveryFlow(input: {
	alreadyChecked: boolean;
	filePath: string | undefined;
	loading: boolean;
	error: string | null;
	slideCount: number;
	hasElectronApi: boolean;
	versions: Array<{ timestamp: number }>;
	now: number;
}): Promise<{ shouldOpen: boolean; reason: string }> {
	const { alreadyChecked, filePath, loading, error, slideCount, hasElectronApi, versions, now } =
		input;

	if (!shouldCheckRecovery({ alreadyChecked, filePath, loading, error, slideCount })) {
		return { shouldOpen: false, reason: 'precondition_failed' };
	}

	if (!hasElectronApi) {
		return { shouldOpen: false, reason: 'no_electron_api' };
	}

	if (hasRecentRecoveryVersion(versions, now)) {
		return { shouldOpen: true, reason: 'recent_recovery_found' };
	}

	return { shouldOpen: false, reason: 'no_recent_recovery' };
}

describe('simulateRecoveryFlow', () => {
	const now = Date.now();

	it('opens version history when recent recovery exists', async () => {
		const result = await simulateRecoveryFlow({
			alreadyChecked: false,
			filePath: '/test/file.pptx',
			loading: false,
			error: null,
			slideCount: 5,
			hasElectronApi: true,
			versions: [{ timestamp: now - 1000 }],
			now,
		});
		expect(result.shouldOpen).toBeTruthy();
		expect(result.reason).toBe('recent_recovery_found');
	});

	it('does not open when already checked', async () => {
		const result = await simulateRecoveryFlow({
			alreadyChecked: true,
			filePath: '/test/file.pptx',
			loading: false,
			error: null,
			slideCount: 5,
			hasElectronApi: true,
			versions: [{ timestamp: now - 1000 }],
			now,
		});
		expect(result.shouldOpen).toBeFalsy();
		expect(result.reason).toBe('precondition_failed');
	});

	it('does not open when no electron API', async () => {
		const result = await simulateRecoveryFlow({
			alreadyChecked: false,
			filePath: '/test/file.pptx',
			loading: false,
			error: null,
			slideCount: 5,
			hasElectronApi: false,
			versions: [{ timestamp: now - 1000 }],
			now,
		});
		expect(result.shouldOpen).toBeFalsy();
		expect(result.reason).toBe('no_electron_api');
	});

	it('does not open when versions are too old', async () => {
		const result = await simulateRecoveryFlow({
			alreadyChecked: false,
			filePath: '/test/file.pptx',
			loading: false,
			error: null,
			slideCount: 5,
			hasElectronApi: true,
			versions: [{ timestamp: now - RECOVERY_WINDOW_MS - 1000 }],
			now,
		});
		expect(result.shouldOpen).toBeFalsy();
		expect(result.reason).toBe('no_recent_recovery');
	});

	it('does not open when no versions exist', async () => {
		const result = await simulateRecoveryFlow({
			alreadyChecked: false,
			filePath: '/test/file.pptx',
			loading: false,
			error: null,
			slideCount: 5,
			hasElectronApi: true,
			versions: [],
			now,
		});
		expect(result.shouldOpen).toBeFalsy();
		expect(result.reason).toBe('no_recent_recovery');
	});

	it('does not open when still loading', async () => {
		const result = await simulateRecoveryFlow({
			alreadyChecked: false,
			filePath: '/test/file.pptx',
			loading: true,
			error: null,
			slideCount: 0,
			hasElectronApi: true,
			versions: [{ timestamp: now - 1000 }],
			now,
		});
		expect(result.shouldOpen).toBeFalsy();
		expect(result.reason).toBe('precondition_failed');
	});

	it('does not open when there is an error', async () => {
		const result = await simulateRecoveryFlow({
			alreadyChecked: false,
			filePath: '/test/file.pptx',
			loading: false,
			error: 'Parse error',
			slideCount: 5,
			hasElectronApi: true,
			versions: [{ timestamp: now - 1000 }],
			now,
		});
		expect(result.shouldOpen).toBeFalsy();
		expect(result.reason).toBe('precondition_failed');
	});

	it('does not open when filePath is missing', async () => {
		const result = await simulateRecoveryFlow({
			alreadyChecked: false,
			filePath: undefined,
			loading: false,
			error: null,
			slideCount: 5,
			hasElectronApi: true,
			versions: [{ timestamp: now - 1000 }],
			now,
		});
		expect(result.shouldOpen).toBeFalsy();
		expect(result.reason).toBe('precondition_failed');
	});
});

// ---------------------------------------------------------------------------
// RECOVERY_WINDOW_MS constant
// ---------------------------------------------------------------------------

describe('rECOVERY_WINDOW_MS', () => {
	it('is exactly 24 hours in milliseconds', () => {
		expect(RECOVERY_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
		expect(RECOVERY_WINDOW_MS).toBe(86_400_000);
	});
});

// ---------------------------------------------------------------------------
// UseRecoveryDetectionInput type shape
// ---------------------------------------------------------------------------

describe('useRecoveryDetectionInput type', () => {
	it('has expected properties', () => {
		const input: UseRecoveryDetectionInput = {
			filePath: '/test.pptx',
			loading: false,
			error: null,
			slideCount: 3,
			openVersionHistory: vi.fn<() => void>(),
		};
		expect(input.filePath).toBe('/test.pptx');
		expect(input.loading).toBeFalsy();
		expect(input.error).toBeNull();
		expect(input.slideCount).toBe(3);
		expectTypeOf(input.openVersionHistory).toBeFunction();
	});

	it('accepts undefined filePath', () => {
		const input: UseRecoveryDetectionInput = {
			filePath: undefined,
			loading: false,
			error: null,
			slideCount: 0,
			openVersionHistory: vi.fn<() => void>(),
		};
		expect(input.filePath).toBeUndefined();
	});
});
