import { describe, expect, it } from 'vitest';

import { useRunProgramNotices } from './useRunProgramNotices';

describe('useRunProgramNotices', () => {
	it('starts with an empty stack', () => {
		const notices = useRunProgramNotices();
		expect(notices.notices.value).toStrictEqual([]);
	});

	it('notify adds a notice carrying the resolved target and the shared i18n keys', () => {
		const notices = useRunProgramNotices();
		notices.notify('notepad.exe C:\\temp\\notes.txt');
		expect(notices.notices.value).toHaveLength(1);
		expect(notices.notices.value[0]).toMatchObject({
			target: 'notepad.exe C:\\temp\\notes.txt',
			messageKey: 'pptx.presentation.runProgramNotice',
			copyLabelKey: 'pptx.presentation.runProgramCopy',
		});
	});

	it('gives each notify call a fresh id, so the same target clicked twice stacks two notices', () => {
		const notices = useRunProgramNotices();
		notices.notify('same.exe');
		notices.notify('same.exe');
		expect(notices.notices.value).toHaveLength(2);
		expect(notices.notices.value[0].id).not.toBe(notices.notices.value[1].id);
	});

	it('dismiss removes only the matching notice', () => {
		const notices = useRunProgramNotices();
		notices.notify('a.exe');
		notices.notify('b.exe');
		const [first, second] = notices.notices.value;
		notices.dismiss(first.id);
		expect(notices.notices.value).toStrictEqual([second]);
	});

	it('dismiss with an unknown id is a no-op', () => {
		const notices = useRunProgramNotices();
		notices.notify('a.exe');
		notices.dismiss('not-a-real-id');
		expect(notices.notices.value).toHaveLength(1);
	});
});
