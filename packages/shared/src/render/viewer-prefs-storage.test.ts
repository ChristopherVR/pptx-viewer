// @vitest-environment jsdom
import { describe, it, expect, beforeEach } from 'vitest';

import {
	clearStoredViewerPrefs,
	readStoredViewerPrefs,
	VIEWER_PREFS_STORAGE_KEY,
	writeStoredViewerPrefs,
} from './viewer-prefs-storage';

beforeEach(() => {
	localStorage.clear();
});

describe('readStoredViewerPrefs', () => {
	it('returns {} when nothing is stored', () => {
		expect(readStoredViewerPrefs()).toStrictEqual({});
	});

	it('returns {} for corrupt JSON', () => {
		localStorage.setItem(VIEWER_PREFS_STORAGE_KEY, '{not json');
		expect(readStoredViewerPrefs()).toStrictEqual({});
	});
});

describe('writeStoredViewerPrefs', () => {
	it('persists and merges patches', () => {
		writeStoredViewerPrefs({ themeKey: 'vermilionDark' });
		writeStoredViewerPrefs({ localeCode: 'fr' });
		expect(readStoredViewerPrefs()).toStrictEqual({ themeKey: 'vermilionDark', localeCode: 'fr' });
	});

	it('overwrites an existing key', () => {
		writeStoredViewerPrefs({ themeKey: 'light' });
		writeStoredViewerPrefs({ themeKey: 'default' });
		expect(readStoredViewerPrefs().themeKey).toBe('default');
	});
});

describe('clearStoredViewerPrefs', () => {
	it('removes everything', () => {
		writeStoredViewerPrefs({ themeKey: 'light', localeCode: 'es' });
		clearStoredViewerPrefs();
		expect(readStoredViewerPrefs()).toStrictEqual({});
	});
});
