import { signal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { toolbarVisibility } from './toolbar-visibility';

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
