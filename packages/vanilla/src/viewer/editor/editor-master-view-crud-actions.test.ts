import type { PptxHandler } from 'pptx-viewer-core';
import type {
	MasterViewCrudAction,
	MasterViewCrudActionId,
	MasterViewTarget,
} from 'pptx-viewer-shared';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createTranslator } from '../i18n';
import { createInitialViewerState, createStore } from '../state';
import type { Store, ViewerState } from '../state';
import { createMasterViewCrudActions } from './editor-master-view-crud-actions';
import { createEditorOps } from './editor-operations';

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
 * own; this exercises vanilla's WIRING around it, the part unique to this
 * binding: adopting the fresh handler + resolved master data with a history
 * entry, prompting for a new name, and surfacing a rejection.
 */

function harness(overrides: Partial<ViewerState> = {}): {
	store: Store<ViewerState>;
	setHandler: ReturnType<typeof vi.fn>;
	handler: PptxHandler;
	prompt: ReturnType<typeof vi.fn>;
	alert: ReturnType<typeof vi.fn>;
	run: (id: MasterViewCrudActionId) => Promise<void>;
} {
	const store = createStore<ViewerState>({
		...createInitialViewerState(),
		editable: true,
		slideMasters: [{ path: 'master-1', name: 'Corporate', elements: [], layouts: [] }],
		masterViewTab: 'slides',
		masterViewTarget: { masterIndex: 0, layoutIndex: null },
		...overrides,
	});
	const setHandler = vi.fn();
	const handler = { getImageData: vi.fn() } as unknown as PptxHandler;
	const ops = createEditorOps({ store, getHandler: () => handler, onHistoryChange: vi.fn() });
	const prompt = vi.fn();
	const alert = vi.fn();
	const doc = { defaultView: { prompt, alert } } as unknown as Document;
	const actions = createMasterViewCrudActions({
		doc,
		getTranslator: () => createTranslator(),
		store,
		ops,
		getHandler: () => handler,
		setHandler,
	});
	return { store, setHandler, handler, prompt, alert, run: actions.runMasterViewCrudAction };
}

function stubActionList(id: string, enabled = true): void {
	masterViewCrudActions.mockReturnValue([
		{ id, labelKey: `pptx.masterView.${id}`, enabled } as MasterViewCrudAction,
	]);
}

describe('vanilla master-view CRUD action wiring', () => {
	beforeEach(() => {
		applyMasterViewCrudAction.mockReset();
		masterViewCrudActions.mockReset();
	});
	afterEach(() => {
		vi.restoreAllMocks();
	});

	it('does nothing outside master view', async () => {
		const { run } = harness({ masterViewTarget: null });
		stubActionList('addLayout');
		await run('addLayout');
		expect(applyMasterViewCrudAction).not.toHaveBeenCalled();
	});

	it('does nothing on a read-only deck', async () => {
		const { run } = harness({ editable: false });
		stubActionList('addLayout');
		await run('addLayout');
		expect(applyMasterViewCrudAction).not.toHaveBeenCalled();
	});

	it('does nothing when the action is disabled for the current target', async () => {
		const { run } = harness();
		stubActionList('deleteMaster', false);
		await run('deleteMaster');
		expect(applyMasterViewCrudAction).not.toHaveBeenCalled();
	});

	it('adopts the returned handler + slide masters with a history entry on success', async () => {
		const { run, store, setHandler, handler } = harness();
		stubActionList('addLayout');
		const newHandler = { getImageData: vi.fn() } as unknown as PptxHandler;
		const target: MasterViewTarget = { tab: 'slides', masterIndex: 0, layoutIndex: 1 };
		applyMasterViewCrudAction.mockResolvedValue({
			ok: true,
			handler: newHandler,
			data: {
				slideMasters: [
					{
						path: 'master-1',
						name: 'Corporate',
						elements: [],
						layouts: [
							{ path: 'layout-1', name: 'Title', elements: [] },
							{ path: 'layout-2', name: 'Custom Layout', elements: [] },
						],
					},
				],
			},
			target,
		});

		await run('addLayout');

		expect(applyMasterViewCrudAction).toHaveBeenCalledWith(
			handler,
			expect.anything(),
			'addLayout',
			{ tab: 'slides', masterIndex: 0, layoutIndex: null },
			{ name: undefined },
		);
		expect(setHandler).toHaveBeenCalledWith(newHandler);
		expect(store.get().masterViewTarget).toStrictEqual({ masterIndex: 0, layoutIndex: 1 });
		expect(store.get().slideMasters[0]?.layouts).toHaveLength(2);
		expect(store.get().dirty).toBeTruthy();
	});

	it('prompts for a name on rename and cancels without calling apply when dismissed', async () => {
		const { run, prompt } = harness();
		stubActionList('renameMaster');
		prompt.mockReturnValue(null);

		await run('renameMaster');

		expect(prompt).toHaveBeenCalledOnce();
		expect(applyMasterViewCrudAction).not.toHaveBeenCalled();
	});

	it('passes the entered name through to applyMasterViewCrudAction', async () => {
		const { run, prompt, handler } = harness();
		stubActionList('renameMaster');
		prompt.mockReturnValue('Renamed Master');
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

	it('alerts the mapped reason on rejection and leaves the store untouched', async () => {
		const { run, store, alert, setHandler } = harness();
		stubActionList('deleteMaster');
		applyMasterViewCrudAction.mockResolvedValue({ ok: false, reason: 'lastMaster' });
		const before = store.get().slideMasters;

		await run('deleteMaster');

		expect(alert).toHaveBeenCalledWith('The last slide master cannot be deleted.');
		expect(setHandler).not.toHaveBeenCalled();
		expect(store.get().slideMasters).toBe(before);
	});

	it('alerts the notFound copy when the target vanished under the click', async () => {
		const { run, alert } = harness();
		stubActionList('deleteLayout');
		applyMasterViewCrudAction.mockResolvedValue({ ok: false, reason: 'notFound' });

		await run('deleteLayout');

		expect(alert).toHaveBeenCalledOnce();
	});
});
