import { describe, expect, it } from 'vitest';

import { computeToolbarVisibility } from './useToolbarVisibility';

// ---------------------------------------------------------------------------
// useToolbarVisibility is a thin useMemo wrapper around computeToolbarVisibility;
// we test the pure derivation directly (matches the convention used by the
// other small derivation hooks in this directory, e.g. useScopedLayoutOptions).
// ---------------------------------------------------------------------------

describe('computeToolbarVisibility', () => {
	it('hides nothing when hiddenActions is undefined (backward-compatible default)', () => {
		const { isHidden, isTabVisible } = computeToolbarVisibility(undefined);
		expect(isHidden('share')).toBeFalsy();
		expect(isHidden('undo')).toBeFalsy();
		expect(isTabVisible('file')).toBeTruthy();
	});

	it('hides nothing when hiddenActions is an empty array', () => {
		const { isHidden, isTabVisible } = computeToolbarVisibility([]);
		expect(isHidden('export')).toBeFalsy();
		expect(isTabVisible('insert')).toBeTruthy();
	});

	it('reports a listed button id as hidden', () => {
		const { isHidden } = computeToolbarVisibility(['share', 'undo']);
		expect(isHidden('share')).toBeTruthy();
		expect(isHidden('undo')).toBeTruthy();
		expect(isHidden('redo')).toBeFalsy();
	});

	it('reports a listed ribbon-tab id as hidden via isTabVisible', () => {
		const { isTabVisible } = computeToolbarVisibility(['file', 'review']);
		expect(isTabVisible('file')).toBeFalsy();
		expect(isTabVisible('review')).toBeFalsy();
		expect(isTabVisible('home')).toBeTruthy();
	});

	it('always shows React-local contextual tabs (text, arrange) regardless of hiddenActions', () => {
		const { isTabVisible } = computeToolbarVisibility(['file', 'home']);
		expect(isTabVisible('text')).toBeTruthy();
		expect(isTabVisible('arrange')).toBeTruthy();
	});

	it('shares the record id between the quick-access button and the ribbon tab', () => {
		const { isHidden, isTabVisible } = computeToolbarVisibility(['record']);
		expect(isHidden('record')).toBeTruthy();
		expect(isTabVisible('record')).toBeFalsy();
	});
});
