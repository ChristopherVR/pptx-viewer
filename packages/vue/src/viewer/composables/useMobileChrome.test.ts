// oxlint-disable react-hooks/rules-of-hooks -- `setup()` calls the `use*`-named
// Vue composable under test, which the react-hooks plugin mistakes for a React
// hook call site (same false positive suppressed the same way in
// useAccessibility.test.ts and its siblings in this directory).
import { toggleSheet } from 'pptx-viewer-shared';
import { describe, expect, it } from 'vitest';
import { ref } from 'vue';

import { useMobileChrome } from './useMobileChrome';

function setup() {
	return useMobileChrome({ presenting: ref(false), addText: () => {} });
}

describe('useMobileChrome toggleMobileSheet priority', () => {
	it('opens a sheet from closed', () => {
		const chrome = setup();
		chrome.toggleMobileSheet('slides');
		expect(chrome.activeSheet.value).toBe('slides');
		expect(chrome.mobileSlidesOpen.value).toBeTruthy();
	});

	it('closes the sheet that is already open (tapping it again)', () => {
		const chrome = setup();
		chrome.toggleMobileSheet('format');
		expect(chrome.activeSheet.value).toBe('format');
		chrome.toggleMobileSheet('format');
		expect(chrome.activeSheet.value).toBeNull();
		expect(chrome.mobileInspectorOpen.value).toBeFalsy();
	});

	it('switches to a different sheet, closing the previous one', () => {
		const chrome = setup();
		chrome.toggleMobileSheet('slides');
		chrome.toggleMobileSheet('comments');
		expect(chrome.activeSheet.value).toBe('comments');
		expect(chrome.mobileSlidesOpen.value).toBeFalsy();
		expect(chrome.mobileCommentsOpen.value).toBeTruthy();
	});

	it('matches shared toggleSheet for every pair, the same priority order every binding shares', () => {
		const SHARED_KEY = {
				slides: 'slides',
				format: 'inspector',
				comments: 'comments',
				notes: 'notes',
			} as const,
			kinds = ['slides', 'format', 'comments', 'notes'] as const;
		for (const current of kinds) {
			for (const tapped of kinds) {
				// Open `current` first (its own single-shot toggle already verified above).
				const chrome = setup(),
					sharedNext = toggleSheet(SHARED_KEY[current], SHARED_KEY[tapped]),
					expectedKind = sharedNext === null ? null : tapped;
				chrome.toggleMobileSheet(current);
				chrome.toggleMobileSheet(tapped);
				expect(chrome.activeSheet.value).toBe(expectedKind);
			}
		}
	});
});
