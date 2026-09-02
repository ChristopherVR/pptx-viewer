// oxlint-disable react-hooks/rules-of-hooks
import { mount } from '@vue/test-utils';
import type { PptxData, PptxHandler, PptxSlideMaster } from 'pptx-viewer-core';
import type {
	MasterLayoutCrudFailure,
	MasterViewCrudApplySuccess,
	MasterViewTarget,
} from 'pptx-viewer-shared';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, shallowRef } from 'vue';

import type { UseMasterViewCrudResult } from './useMasterViewCrud';

const { applyMasterViewCrudActionMock } = vi.hoisted(() => ({
	applyMasterViewCrudActionMock: vi.fn(),
}));

vi.mock(import('pptx-viewer-shared'), async (importOriginal) => ({
	...(await importOriginal()),
	applyMasterViewCrudAction: applyMasterViewCrudActionMock,
}));

const { useMasterViewCrud } = await import('./useMasterViewCrud');

function master(path: string, overrides: Partial<PptxSlideMaster> = {}): PptxSlideMaster {
	return { path, name: 'Office Theme', layouts: [], ...overrides };
}

function baseData(masters: PptxSlideMaster[], slides: PptxData['slides'] = []): PptxData {
	return { slides, slideMasters: masters } satisfies Partial<PptxData> as PptxData;
}

/**
 * `useMasterViewCrud` calls `useI18n()` (rename prompt copy + failure
 * messages), so it has to run inside a component setup, exactly like
 * `useCustomShowsWiring` (see `authored-custom-show.test.ts`).
 */
function setup(
	masters: PptxSlideMaster[],
	target: MasterViewTarget,
	slides: PptxData['slides'] = [],
	handlerValue: PptxHandler | null = {} as PptxHandler,
): {
	crud: UseMasterViewCrudResult;
	masterRef: ReturnType<typeof shallowRef<PptxSlideMaster[]>>;
	handler: ReturnType<typeof shallowRef<PptxHandler | null>>;
	onSelectMaster: ReturnType<typeof vi.fn>;
	onSelectLayout: ReturnType<typeof vi.fn>;
	markDirty: ReturnType<typeof vi.fn>;
	pushHistory: ReturnType<typeof vi.fn>;
} {
	const masterRef = shallowRef<PptxSlideMaster[]>(masters);
	const handler = shallowRef<PptxHandler | null>(handlerValue);
	const onSelectMaster = vi.fn();
	const onSelectLayout = vi.fn();
	const markDirty = vi.fn();
	const pushHistory = vi.fn();
	let captured: UseMasterViewCrudResult | null = null;
	mount(
		defineComponent({
			setup() {
				captured = useMasterViewCrud({
					handler,
					slideMasters: masterRef,
					deckData: () => baseData(masterRef.value, slides),
					target: () => target,
					onSelectMaster,
					onSelectLayout,
					markDirty,
					pushHistory,
				});
				return () => h('div');
			},
		}),
	);
	return {
		crud: captured as unknown as UseMasterViewCrudResult,
		masterRef,
		handler,
		onSelectMaster,
		onSelectLayout,
		markDirty,
		pushHistory,
	};
}

/**
 * useMasterViewCrud: the wiring behind the Slide Master view sidebar's
 * Insert/Duplicate/Delete/Rename Layout and Slide Master buttons (wave-4 B4).
 * `applyMasterViewCrudAction` performs real ZIP surgery in `pptx-viewer-core`,
 * so it is mocked here; `masterViewCrudActions` (the button list) is pure and
 * runs for real.
 */
describe('useMasterViewCrud', () => {
	beforeEach(() => {
		applyMasterViewCrudActionMock.mockReset();
	});

	it('disables deleteLayout for a layout a slide still uses', () => {
		const layoutPath = 'ppt/slideLayouts/slideLayout1.xml';
		const { crud } = setup(
			[
				master('ppt/slideMasters/slideMaster1.xml', {
					layouts: [{ path: layoutPath, name: 'Title Slide' }],
				}),
			],
			{ tab: 'slides', masterIndex: 0, layoutIndex: 0 },
			[{ id: 's1', rId: 'rId1', slideNumber: 1, elements: [], layoutPath }],
		);

		const deleteLayout = crud.actions.value.find((a) => a.id === 'deleteLayout');
		expect(deleteLayout?.enabled).toBeFalsy();
		expect(deleteLayout?.disabledReasonKey).toBe('pptx.masterView.layoutInUse');
		const addLayout = crud.actions.value.find((a) => a.id === 'addLayout');
		expect(addLayout?.enabled).toBeTruthy();
	});

	it('adopts the returned handler, slideMasters and selection when addLayout succeeds', async () => {
		const { crud, handler, masterRef, onSelectLayout, markDirty, pushHistory } = setup(
			[master('ppt/slideMasters/slideMaster1.xml')],
			{ tab: 'slides', masterIndex: 0, layoutIndex: null },
		);

		const newHandler = {} as PptxHandler;
		const newMasters: PptxSlideMaster[] = [
			master('ppt/slideMasters/slideMaster1.xml', {
				layouts: [{ path: 'ppt/slideLayouts/slideLayout9.xml', name: 'Title and Content' }],
			}),
		];
		const success: MasterViewCrudApplySuccess = {
			ok: true,
			handler: newHandler,
			data: baseData(newMasters),
			target: { tab: 'slides', masterIndex: 0, layoutIndex: 0 },
		};
		applyMasterViewCrudActionMock.mockResolvedValue(success);

		await crud.run('addLayout');

		expect(pushHistory).toHaveBeenCalledOnce();
		expect(handler.value).toBe(newHandler);
		expect(masterRef.value).toBe(newMasters);
		expect(onSelectLayout).toHaveBeenCalledWith(0, 0);
		expect(markDirty).toHaveBeenCalledOnce();
		expect(crud.error.value).toBeNull();
	});

	it('reports a failure without adopting anything', async () => {
		const { crud, handler } = setup(
			[
				master('ppt/slideMasters/slideMaster1.xml', {
					layouts: [{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide' }],
				}),
			],
			{ tab: 'slides', masterIndex: 0, layoutIndex: 0 },
		);
		const originalHandler = handler.value;
		const failure: MasterLayoutCrudFailure = { ok: false, reason: 'inUse' };
		applyMasterViewCrudActionMock.mockResolvedValue(failure);

		await crud.run('deleteLayout');

		expect(handler.value).toBe(originalHandler);
		expect(crud.error.value).toBe('This layout is used by slides and cannot be deleted.');
	});

	it('prompts for a name before renaming, and skips the call when the prompt is cancelled', async () => {
		// happy-dom does not implement `window.prompt` at all, so there is no
		// existing method for `vi.spyOn` to wrap; `vi.stubGlobal` installs one.
		const promptSpy = vi.fn().mockReturnValue(null);
		vi.stubGlobal('prompt', promptSpy);
		const { crud } = setup([master('ppt/slideMasters/slideMaster1.xml')], {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: null,
		});

		await crud.run('renameMaster');

		expect(promptSpy).toHaveBeenCalledWith('New name', 'Office Theme');
		expect(applyMasterViewCrudActionMock).not.toHaveBeenCalled();
		vi.unstubAllGlobals();
	});
});
