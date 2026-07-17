import { describe, it, expect, vi, beforeEach } from 'vitest';

import {
	AVATAR_COLOR_SWATCHES,
	clearAllLocalViewerData,
	DEFAULT_VIEWER_PROFILE,
	getLocalStorageUsageSummary,
	resolveProfileInitial,
	saveViewerProfile,
} from './account';
import { deleteAutosaveSnapshot, listAutosaveSnapshots } from './autosave-store';
import { clearStoredViewerPrefs, writeStoredViewerPrefs } from './viewer-prefs-storage';

vi.mock(import('./autosave-store'), () => ({
	listAutosaveSnapshots: vi.fn(),
	deleteAutosaveSnapshot: vi.fn(),
}));
vi.mock(import('./viewer-prefs-storage'), () => ({
	clearStoredViewerPrefs: vi.fn(),
	writeStoredViewerPrefs: vi.fn(),
	readStoredViewerPrefs: vi.fn(),
	VIEWER_PREFS_STORAGE_KEY: 'pptx-viewer-prefs',
}));

const mockList = vi.mocked(listAutosaveSnapshots);
const mockDelete = vi.mocked(deleteAutosaveSnapshot);
const mockClearPrefs = vi.mocked(clearStoredViewerPrefs);
const mockWritePrefs = vi.mocked(writeStoredViewerPrefs);

beforeEach(() => {
	vi.clearAllMocks();
});

describe('resolveProfileInitial', () => {
	it('uses the explicit initial when set', () => {
		expect(resolveProfileInitial({ displayName: 'Ana', avatarColor: '#fff', initial: 'z' })).toBe(
			'Z',
		);
	});

	it('derives from the first letter of displayName', () => {
		expect(resolveProfileInitial({ displayName: 'chris', avatarColor: '#fff' })).toBe('C');
	});

	it('falls back to ? for an empty name', () => {
		expect(resolveProfileInitial(DEFAULT_VIEWER_PROFILE)).toBe('?');
	});
});

describe('avatar color swatches', () => {
	it('is non-empty and every entry is a hex color', () => {
		expect(AVATAR_COLOR_SWATCHES.length).toBeGreaterThan(0);
		for (const color of AVATAR_COLOR_SWATCHES) {
			expect(color).toMatch(/^#[0-9a-f]{6}$/i);
		}
	});
});

describe('getLocalStorageUsageSummary', () => {
	it('summarizes count and total bytes', async () => {
		mockList.mockResolvedValue([
			{ key: 'a', timestamp: 1, size: 100 },
			{ key: 'b', timestamp: 2, size: 250 },
		]);
		await expect(getLocalStorageUsageSummary()).resolves.toStrictEqual({
			presentationCount: 2,
			totalBytes: 350,
		});
	});

	it('handles no snapshots', async () => {
		mockList.mockResolvedValue([]);
		await expect(getLocalStorageUsageSummary()).resolves.toStrictEqual({
			presentationCount: 0,
			totalBytes: 0,
		});
	});
});

describe('clearAllLocalViewerData', () => {
	it('deletes every snapshot and clears prefs', async () => {
		mockList.mockResolvedValue([
			{ key: 'a', timestamp: 1, size: 100 },
			{ key: 'b', timestamp: 2, size: 250 },
		]);
		mockDelete.mockResolvedValue(true);

		await clearAllLocalViewerData();

		expect(mockDelete).toHaveBeenCalledWith('a');
		expect(mockDelete).toHaveBeenCalledWith('b');
		expect(mockClearPrefs).toHaveBeenCalledOnce();
	});
});

describe('saveViewerProfile', () => {
	it('writes the profile through the prefs store', () => {
		const profile = { displayName: 'Ana', avatarColor: '#c2431f' };
		saveViewerProfile(profile);
		expect(mockWritePrefs).toHaveBeenCalledWith({ profile });
	});
});
