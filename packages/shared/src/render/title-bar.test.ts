import { describe, expect, it } from 'vitest';

import { resolveTitleBarStatusKey } from './title-bar';

describe('resolveTitleBarStatusKey', () => {
	it('shows saving while an enabled autosave is in flight', () => {
		expect(
			resolveTitleBarStatusKey({ autosaveState: 'saving', isDirty: true, autosaveEnabled: true }),
		).toBe('pptx.autosave.saving');
	});

	it('shows the autosave error when enabled and errored', () => {
		expect(
			resolveTitleBarStatusKey({ autosaveState: 'error', isDirty: true, autosaveEnabled: true }),
		).toBe('pptx.autosave.error');
	});

	it('ignores saving/error states when autosave is disabled', () => {
		expect(
			resolveTitleBarStatusKey({ autosaveState: 'saving', isDirty: true, autosaveEnabled: false }),
		).toBe('pptx.statusBar.unsavedChanges');
		expect(
			resolveTitleBarStatusKey({ autosaveState: 'error', isDirty: false, autosaveEnabled: false }),
		).toBe('pptx.titleBar.savedToThisPc');
	});

	it('shows unsaved changes when dirty and idle', () => {
		expect(
			resolveTitleBarStatusKey({ autosaveState: 'idle', isDirty: true, autosaveEnabled: true }),
		).toBe('pptx.statusBar.unsavedChanges');
	});

	it('shows saved-to-this-pc when clean', () => {
		expect(
			resolveTitleBarStatusKey({ autosaveState: 'saved', isDirty: false, autosaveEnabled: true }),
		).toBe('pptx.titleBar.savedToThisPc');
	});

	it('shows disabled-no-file-path when autosave is disabled due to missing filePath', () => {
		expect(
			resolveTitleBarStatusKey({
				autosaveState: 'disabled',
				isDirty: false,
				autosaveEnabled: true,
				disabledReason: 'no_file_path',
			}),
		).toBe('pptx.autosave.disabledNoFilePath');
	});

	it('shows disabled-toggle-off when autosave is disabled by user toggle', () => {
		expect(
			resolveTitleBarStatusKey({
				autosaveState: 'disabled',
				isDirty: true,
				autosaveEnabled: false,
				disabledReason: 'autosave_toggle_off',
			}),
		).toBe('pptx.autosave.disabledToggleOff');
	});

	it('shows generic disabled when reason is unknown', () => {
		expect(
			resolveTitleBarStatusKey({
				autosaveState: 'disabled',
				isDirty: false,
				autosaveEnabled: true,
			}),
		).toBe('pptx.autosave.disabled');
	});
});
