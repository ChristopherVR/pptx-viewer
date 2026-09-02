/**
 * master-view-crud-wiring.test.ts: the Slide Master view sidebar CRUD actions
 * (wave-4 B4) end-to-end through `LoadContentService`.
 *
 * `applyMasterViewCrudAction` performs real ZIP surgery and reloads through a
 * FRESH `PptxHandler` (see `master-layout-crud`'s module doc): a plain signal
 * patch is not enough, the loaded HANDLER itself has to be swapped, or the
 * next save would write the OLD package. This exercises the real shared
 * functions against a real generated presentation, then adopts the result
 * through `LoadContentService.adoptMasterViewData` (the method
 * `PowerPointViewerComponent.onMasterViewCrudAction` calls), and asserts the
 * service's own signals (and its `getHandler()`) reflect the NEW package, not
 * a stale one.
 */
import { DestroyRef, Injector, runInInjectionContext } from '@angular/core';
import type { PptxData, PptxHandler } from 'pptx-viewer-core';
import { PptxHandler as PptxHandlerCtor } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { applyMasterViewCrudAction, masterViewCrudActions } from '../internal/shared';
import { LoadContentService } from './load-content.service';

/** Build the service in a throwaway injection context with a DestroyRef stub. */
function createService(): LoadContentService {
	const destroyRefStub: Pick<DestroyRef, 'onDestroy'> = { onDestroy: () => () => {} };
	const injector = Injector.create({
		providers: [{ provide: DestroyRef, useValue: destroyRefStub }],
	});
	return runInInjectionContext(injector, () => new LoadContentService());
}

async function freshPresentation(): Promise<{ handler: PptxHandler; data: PptxData }> {
	return PptxHandlerCtor.create();
}

describe('master view CRUD adoption (LoadContentService.adoptMasterViewData)', () => {
	it('addLayout: adopts the new layout AND swaps the handler, not just the signal', async () => {
		const { handler, data } = await freshPresentation();
		const svc = createService();
		svc.adoptMasterViewData(handler, data);
		const before = svc.getHandler();
		const layoutCountBefore = svc.slideMasters()[0]?.layouts?.length ?? 0;

		const target = { tab: 'slides' as const, masterIndex: 0, layoutIndex: null };
		const result = await applyMasterViewCrudAction(handler, data, 'addLayout', target);
		expect(result.ok).toBeTruthy();
		if (!result.ok) {
			return;
		}

		svc.adoptMasterViewData(result.handler, result.data);
		expect(svc.slideMasters()[0]?.layouts?.length).toBe(layoutCountBefore + 1);
		// The handler itself changed: a plain data patch would have left the OLD
		// handler (and its stale ZIP) in place, so the next save would omit the
		// new layout entirely.
		expect(svc.getHandler()).not.toBe(before);
		expect(svc.getHandler()).toBe(result.handler);
	});

	it('deleteLayout is disabled while a slide uses the layout, per masterViewCrudActions', () => {
		const inUseData: PptxData = {
			slides: [
				{ id: 's1', layoutPath: 'ppt/slideLayouts/slideLayout1.xml', elements: [] } as never,
			],
			width: 960,
			height: 540,
			slideMasters: [
				{
					path: 'ppt/slideMasters/slideMaster1.xml',
					layouts: [{ path: 'ppt/slideLayouts/slideLayout1.xml', name: 'Title Slide' } as never],
				} as never,
			],
		};
		const actions = masterViewCrudActions(inUseData, {
			tab: 'slides',
			masterIndex: 0,
			layoutIndex: 0,
		});
		const deleteLayout = actions.find((action) => action.id === 'deleteLayout');
		expect(deleteLayout?.enabled).toBeFalsy();
		expect(deleteLayout?.disabledReasonKey).toBe('pptx.masterView.layoutInUse');
	});

	it('deleteLayout: the layout an unused layout can be removed, and the returned target clears layoutIndex', async () => {
		const { handler, data } = await freshPresentation();
		const svc = createService();

		// Add a spare layout first so the deck has one nothing uses.
		const addTarget = { tab: 'slides' as const, masterIndex: 0, layoutIndex: null };
		const added = await applyMasterViewCrudAction(handler, data, 'addLayout', addTarget);
		expect(added.ok).toBeTruthy();
		if (!added.ok) {
			return;
		}
		svc.adoptMasterViewData(added.handler, added.data);

		const newLayoutIndex = (svc.slideMasters()[0]?.layouts?.length ?? 1) - 1;
		const deleteTarget = { tab: 'slides' as const, masterIndex: 0, layoutIndex: newLayoutIndex };
		const deleted = await applyMasterViewCrudAction(
			added.handler,
			added.data,
			'deleteLayout',
			deleteTarget,
		);
		expect(deleted.ok).toBeTruthy();
		if (!deleted.ok) {
			return;
		}
		expect(deleted.target.layoutIndex).toBeNull();
		svc.adoptMasterViewData(deleted.handler, deleted.data);
		expect(svc.slideMasters()[0]?.layouts?.length).toBe(newLayoutIndex);
	});
});
