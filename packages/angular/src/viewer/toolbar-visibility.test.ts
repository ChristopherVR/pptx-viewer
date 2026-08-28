import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { mergeHiddenActions, toolbarVisibility } from './toolbar-visibility';

describe('toolbarVisibility', () => {
	it('reports nothing hidden when hiddenActions is empty (backward-compatible default)', () => {
		const toolbar = toolbarVisibility(signal([]));
		expect(toolbar.isHidden('share')).toBeFalsy();
		expect(toolbar.isHidden('undo')).toBeFalsy();
		expect(toolbar.isHidden('home')).toBeFalsy();
	});

	it('reports an action hidden when it is present in hiddenActions', () => {
		const toolbar = toolbarVisibility(signal(['share', 'record']));
		expect(toolbar.isHidden('share')).toBeTruthy();
		expect(toolbar.isHidden('record')).toBeTruthy();
	});

	it('leaves actions not present in hiddenActions visible', () => {
		const toolbar = toolbarVisibility(signal(['export']));
		expect(toolbar.isHidden('undo')).toBeFalsy();
		expect(toolbar.isHidden('redo')).toBeFalsy();
		expect(toolbar.isHidden('export')).toBeTruthy();
	});
});

/**
 * File > Options > Customize Ribbon stores its hidden tabs entirely
 * separately from the host's own `hiddenActions` prop; before this, nothing
 * downstream ever read `ribbon.hiddenTabIds`, so ticking a tab off in the
 * Customize Ribbon pane changed only what the pane itself displayed.
 */
describe('mergeHiddenActions', () => {
	it('is empty when both sources are empty', () => {
		expect(mergeHiddenActions([], [])).toStrictEqual([]);
	});

	it('unions the host prop with the Customize Ribbon hidden tabs', () => {
		expect(mergeHiddenActions(['share', 'record'], ['review', 'view'])).toStrictEqual([
			'share',
			'record',
			'review',
			'view',
		]);
	});

	it('feeds straight into toolbarVisibility, hiding a tab from EITHER source', () => {
		const merged = mergeHiddenActions(['share'], ['review']);
		const toolbar = toolbarVisibility(signal(merged));
		expect(toolbar.isHidden('share')).toBeTruthy();
		expect(toolbar.isHidden('review')).toBeTruthy();
		expect(toolbar.isHidden('view')).toBeFalsy();
	});
});
