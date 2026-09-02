import type { PptxHandler, PptxSlideMaster } from 'pptx-viewer-core';
import type { MasterViewCrudAction, MasterViewCrudActionId } from 'pptx-viewer-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { MasterViewCrudPrompts } from './editor-master-crud';
import { EditorState } from './editor-state.svelte';

const { applyMasterViewCrudAction, masterViewCrudActions } = vi.hoisted(() => ({
	applyMasterViewCrudAction: vi.fn(),
	masterViewCrudActions: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => {
	const actual = await importOriginal();
	return { ...actual, applyMasterViewCrudAction, masterViewCrudActions };
});

/**
 * B4: the sidebar CRUD commands ZIP-surgery through
 * `pptx-viewer-shared/render/master-view-crud`, which is unit-tested on its
 * own; this exercises Svelte's WIRING around it: adopting the fresh handler
 * through the loader dep with a history entry, prompting for a new name, and
 * surfacing a rejection. Named `.svelte.test.ts` because `EditorState` is a
 * runes class.
 */

const MASTER: PptxSlideMaster = {
	path: 'master-1',
	name: 'Corporate',
	elements: [],
	layouts: [{ path: 'layout-1', name: 'Title', elements: [] }],
} as PptxSlideMaster;

function harness(overrides: { editable?: boolean; inMasterView?: boolean } = {}): {
	editor: EditorState;
	handler: PptxHandler;
	setHandler: ReturnType<typeof vi.fn>;
	prompts: MasterViewCrudPrompts & { promptName: ReturnType<typeof vi.fn> };
	notify: ReturnType<typeof vi.fn>;
	run: (id: MasterViewCrudActionId) => Promise<boolean>;
} {
	const handler = { getImageData: vi.fn() } as unknown as PptxHandler;
	const setHandler = vi.fn();
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => handler, setHandler });
	editor.editable = overrides.editable ?? true;
	editor.slideMasters = [MASTER];
	if (overrides.inMasterView ?? true) {
		editor.masterOps.enter(0, null);
	}
	const promptName = vi.fn();
	const notify = vi.fn();
	const prompts = { promptName, notify, translate: (key: string) => `[${key}]` };
	return {
		editor,
		handler,
		setHandler,
		prompts,
		notify,
		run: (id) => editor.masterCrud.run(id, prompts),
	};
}

function stubActionList(id: string, enabled = true): void {
	masterViewCrudActions.mockReturnValue([
		{ id, labelKey: `pptx.masterView.${id}`, enabled } as MasterViewCrudAction,
	]);
}

describe('svelte master-view CRUD wiring', () => {
	beforeEach(() => {
		applyMasterViewCrudAction.mockReset();
		masterViewCrudActions.mockReset();
	});

	it('exposes no actions outside master view or on a read-only deck', () => {
		stubActionList('addLayout');
		expect(harness({ inMasterView: false }).editor.masterCrud.actions()).toStrictEqual([]);
		expect(harness({ editable: false }).editor.masterCrud.actions()).toStrictEqual([]);
		expect(harness().editor.masterCrud.actions()).toHaveLength(1);
	});

	it('does nothing outside master view, read-only, or when the action is disabled', async () => {
		stubActionList('addLayout');
		await expect(harness({ inMasterView: false }).run('addLayout')).resolves.toBeFalsy();
		await expect(harness({ editable: false }).run('addLayout')).resolves.toBeFalsy();
		stubActionList('deleteMaster', false);
		await expect(harness().run('deleteMaster')).resolves.toBeFalsy();
		expect(applyMasterViewCrudAction).not.toHaveBeenCalled();
	});

	it('adopts the returned handler + slide masters with a history entry on success', async () => {
		const { run, editor, handler, setHandler } = harness();
		stubActionList('addLayout');
		const newHandler = { getImageData: vi.fn() } as unknown as PptxHandler;
		const layouts = [...(MASTER.layouts ?? []), { path: 'layout-2', name: 'Custom', elements: [] }];
		applyMasterViewCrudAction.mockResolvedValue({
			ok: true,
			handler: newHandler,
			data: { slides: [], slideMasters: [{ ...MASTER, layouts }] },
			target: { tab: 'slides', masterIndex: 0, layoutIndex: 1 },
		});

		await expect(run('addLayout')).resolves.toBeTruthy();

		expect(applyMasterViewCrudAction).toHaveBeenCalledWith(
			handler,
			expect.anything(),
			'addLayout',
			{ tab: 'slides', masterIndex: 0, layoutIndex: null },
			{ name: undefined },
		);
		expect(setHandler).toHaveBeenCalledWith(newHandler);
		expect(editor.masterViewTarget).toStrictEqual({
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: 1,
		});
		expect(editor.slideMasters[0]?.layouts).toHaveLength(2);
		expect(editor.dirty).toBeTruthy();
		expect(editor.canUndo).toBeTruthy();
	});

	it('prompts for a name on rename and cancels without calling apply when dismissed', async () => {
		const { run, prompts } = harness();
		stubActionList('renameMaster');
		prompts.promptName.mockReturnValue(null);

		await expect(run('renameMaster')).resolves.toBeFalsy();

		expect(prompts.promptName).toHaveBeenCalledWith('Corporate');
		expect(applyMasterViewCrudAction).not.toHaveBeenCalled();
	});

	it('passes the entered name through to applyMasterViewCrudAction', async () => {
		const { run, prompts, handler } = harness();
		stubActionList('renameMaster');
		prompts.promptName.mockReturnValue('  Renamed Master ');
		applyMasterViewCrudAction.mockResolvedValue({ ok: false, reason: 'notFound' });

		await run('renameMaster');

		expect(applyMasterViewCrudAction).toHaveBeenCalledWith(
			handler,
			expect.anything(),
			'renameMaster',
			{ tab: 'slides', masterIndex: 0, layoutIndex: null },
			{ name: 'Renamed Master' },
		);
	});

	it('surfaces the mapped reason on rejection and leaves the editor untouched', async () => {
		const { run, editor, notify, setHandler } = harness();
		stubActionList('deleteMaster');
		applyMasterViewCrudAction.mockResolvedValue({ ok: false, reason: 'lastMaster' });
		const before = editor.slideMasters;

		await expect(run('deleteMaster')).resolves.toBeFalsy();

		expect(notify).toHaveBeenCalledWith('[pptx.masterView.lastMaster]');
		expect(setHandler).not.toHaveBeenCalled();
		expect(editor.slideMasters).toBe(before);
		expect(editor.dirty).toBeFalsy();
	});
});
