/**
 * B4: Slide Master view sidebar CRUD (Insert/Duplicate/Delete/Rename Layout
 * and Slide Master), the vanilla wiring for the shared decision layer in
 * `pptx-viewer-shared/render/master-view-crud`.
 *
 * Unlike every other editor action in this directory, this one performs real
 * ZIP surgery through `pptx-viewer-core` (a new layout/master file, a rels
 * update, a content-type override) and comes back with a BRAND NEW
 * `PptxHandler` + `PptxData` rather than a patch to apply to the existing
 * one. So this module, uniquely, also adopts that handler (see `setHandler`)
 * alongside the usual push-history / store-set / commit-change shape every
 * other action here follows.
 *
 * @module viewer/editor/editor-master-view-crud-actions
 */
import type { PptxData, PptxHandler, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import {
	applyImagePathPatches,
	applyMasterViewCrudAction,
	collectImagePaths,
	masterViewCrudActions,
	masterViewCrudFailureKey,
} from 'pptx-viewer-shared';
import type { MasterViewCrudActionId, MasterViewTarget } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import type { Store, ViewerState } from '../state';
import type { EditorOps } from './editor-operations';

export interface MasterViewCrudActions {
	/**
	 * Run one sidebar command (`addLayout` / `duplicateLayout` / `deleteLayout` /
	 * `renameLayout` / `addMaster` / `duplicateMaster` / `deleteMaster` /
	 * `renameMaster`) against the CURRENT master-view target. A no-op outside
	 * master view, when the deck is read-only, or when the action is disabled
	 * for the current target (mirrors the sidebar's own gating, so a stray call
	 * through the public API cannot bypass it).
	 */
	runMasterViewCrudAction(id: MasterViewCrudActionId): Promise<void>;
}

export interface MasterViewCrudActionsDeps {
	doc: Document;
	/** Live getter, not a snapshot: a `setLocale` switch must reach the next call. */
	getTranslator(): Translator;
	store: Store<ViewerState>;
	ops: Pick<EditorOps, 'pushHistory' | 'commitChange'>;
	getHandler(): PptxHandler | null;
	/** Adopt the fresh handler `applyMasterViewCrudAction` returns on success. */
	setHandler(handler: PptxHandler): void;
}

/**
 * Project the store's editable fields onto the `PptxData` shape the shared
 * CRUD layer reads. Exported so `render-controller.ts` can compute the same
 * sidebar action list (enabled/disabled) this module executes against,
 * without a second, drifting projection.
 */
export function toPptxData(state: ViewerState): PptxData {
	return {
		slides: state.slides,
		width: state.canvasSize.width,
		height: state.canvasSize.height,
		widthEmu: state.slideSize?.widthEmu,
		heightEmu: state.slideSize?.heightEmu,
		slideSizeType: state.slideSize?.type,
		slideMasters: state.slideMasters,
		presentationProperties: state.presentationProperties,
		customShows: state.customShows,
		sections: state.sections,
	};
}

/** The store's split `masterViewTab` / `masterViewTarget` as one shared-shape target. */
export function fullTarget(state: ViewerState): MasterViewTarget | null {
	if (!state.masterViewTarget) {
		return null;
	}
	return { tab: state.masterViewTab, ...state.masterViewTarget };
}

/** The layout/master name to seed the rename prompt with. */
function currentName(slideMasters: readonly PptxSlideMaster[], target: MasterViewTarget): string {
	const master = slideMasters[target.masterIndex];
	if (target.layoutIndex === null) {
		return master?.name ?? '';
	}
	return master?.layouts?.[target.layoutIndex]?.name ?? '';
}

/**
 * Re-resolve every layout/master picture path through the FRESH handler, the
 * same way `load-presentation.ts` resolves slide pictures on open: the
 * reloaded `PptxData` this module adopts carries raw archive paths again, not
 * the data URLs the canvas needs to paint them.
 */
async function resolveSlideMasterImages(
	handler: PptxHandler,
	slideMasters: readonly PptxSlideMaster[],
): Promise<PptxSlideMaster[]> {
	const pseudoSlides: PptxSlide[] = [];
	for (const master of slideMasters) {
		pseudoSlides.push({
			id: master.path,
			rId: '',
			slideNumber: 0,
			elements: master.elements ?? [],
		} as PptxSlide);
		for (const layout of master.layouts ?? []) {
			pseudoSlides.push({
				id: layout.path,
				rId: '',
				slideNumber: 0,
				elements: layout.elements ?? [],
			} as PptxSlide);
		}
	}
	const { paths, refs } = collectImagePaths(pseudoSlides);
	if (paths.size === 0) {
		return [...slideMasters];
	}
	const resolvedMap = new Map<string, string>();
	await Promise.all(
		Array.from(paths).map(async (path) => {
			try {
				const url = await handler.getImageData(path);
				if (url) {
					resolvedMap.set(path, url);
				}
			} catch {
				// Non-critical: the picture shows as broken, matching the load pipeline.
			}
		}),
	);
	return slideMasters.map((master) => ({
		...master,
		elements: applyImagePathPatches(master.elements ?? [], resolvedMap, refs),
		layouts: master.layouts?.map((layout) => ({
			...layout,
			elements: applyImagePathPatches(layout.elements ?? [], resolvedMap, refs),
		})),
	}));
}

export function createMasterViewCrudActions(
	deps: MasterViewCrudActionsDeps,
): MasterViewCrudActions {
	const { doc, store, ops } = deps;
	return {
		async runMasterViewCrudAction(id) {
			const t = deps.getTranslator();
			const state = store.get();
			const target = fullTarget(state);
			const handler = deps.getHandler();
			if (!target || !handler || !state.editable) {
				return;
			}
			const data = toPptxData(state);
			const action = masterViewCrudActions(data, target).find((entry) => entry.id === id);
			if (!action?.enabled) {
				return;
			}

			let name: string | undefined;
			if (id === 'renameLayout' || id === 'renameMaster') {
				const entered = doc.defaultView?.prompt(
					t('pptx.masterView.renamePrompt'),
					currentName(state.slideMasters, target),
				);
				if (!entered) {
					return;
				}
				name = entered;
			}

			const result = await applyMasterViewCrudAction(handler, data, id, target, { name });
			if (!result.ok) {
				doc.defaultView?.alert(t(masterViewCrudFailureKey(id, result.reason)));
				return;
			}

			ops.pushHistory();
			deps.setHandler(result.handler);
			const slideMasters = await resolveSlideMasterImages(
				result.handler,
				result.data.slideMasters ?? [],
			);
			store.set({
				slideMasters,
				masterViewTarget: {
					masterIndex: result.target.masterIndex,
					layoutIndex: result.target.layoutIndex,
				},
				selectedElementId: null,
				selectedElementIds: [],
			});
			ops.commitChange();
		},
	};
}
