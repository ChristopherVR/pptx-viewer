/**
 * run-program-notice-store.test.ts: the running show's "Run program" notice
 * list. Plain class, no TestBed, matching `presentation-show-navigator.test.ts`.
 */
import { describe, expect, it } from 'vitest';

import { RunProgramNoticeStore } from './run-program-notice-store';

describe('runProgramNoticeStore', () => {
	it('starts empty', () => {
		const store = new RunProgramNoticeStore();
		expect(store.notices()).toStrictEqual([]);
	});

	it('add() appends a notice carrying the exact resolved command as its target', () => {
		const store = new RunProgramNoticeStore();
		store.add('notepad.exe C:\\temp\\notes.txt');

		const notices = store.notices();
		expect(notices).toHaveLength(1);
		expect(notices[0]?.target).toBe('notepad.exe C:\\temp\\notes.txt');
		expect(notices[0]?.messageKey).toBe('pptx.presentation.runProgramNotice');
		expect(notices[0]?.copyLabelKey).toBe('pptx.presentation.runProgramCopy');
	});

	it('add() twice for the same target produces two distinct notices', () => {
		const store = new RunProgramNoticeStore();
		store.add('notepad.exe');
		store.add('notepad.exe');

		const notices = store.notices();
		expect(notices).toHaveLength(2);
		expect(notices[0]?.id).not.toBe(notices[1]?.id);
	});

	it('dismiss() removes only the named notice', () => {
		const store = new RunProgramNoticeStore();
		store.add('a.exe');
		store.add('b.exe');
		const [first, second] = store.notices();

		store.dismiss(first?.id ?? '');

		expect(store.notices()).toStrictEqual([second]);
	});
});
