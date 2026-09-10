import { describe, expect, it } from 'vitest';

import { buildRunProgramNotice } from './run-program-notice';

describe('buildRunProgramNotice', () => {
	it('carries the exact resolved command string through as target', () => {
		const notice = buildRunProgramNotice('notepad.exe C:\\temp\\notes.txt');
		expect(notice.target).toBe('notepad.exe C:\\temp\\notes.txt');
	});

	it('points at the run-program message and copy-label i18n keys', () => {
		const notice = buildRunProgramNotice('notepad.exe myfile.txt');
		expect(notice.messageKey).toBe('pptx.presentation.runProgramNotice');
		expect(notice.copyLabelKey).toBe('pptx.presentation.runProgramCopy');
	});

	it('gives each call a distinct, stable id', () => {
		const first = buildRunProgramNotice('a.exe');
		const second = buildRunProgramNotice('a.exe');
		expect(first.id).not.toBe(second.id);
		expect(first.id).toMatch(/^run-program-/);
		expect(second.id).toMatch(/^run-program-/);
	});
});
