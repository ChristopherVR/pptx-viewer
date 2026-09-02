/**
 * master-view-crud.ts: the decision layer behind PowerPoint's Slide Master
 * view sidebar commands (Insert/Duplicate/Delete/Rename Layout and Slide
 * Master).
 *
 * Splits into two pure-ish pieces:
 * - {@link masterViewCrudActions}: a synchronous, framework-neutral
 *   descriptor of which buttons a binding's sidebar should show, enabled or
 *   disabled, so no binding re-derives PowerPoint's "can't delete the last
 *   master" / "can't delete a layout slides still use" rules itself.
 * - {@link applyMasterViewCrudAction}: the async bridge to
 *   `pptx-viewer-core`'s `master-layout-crud` module (which performs the
 *   actual ZIP surgery), returning the master-view selection a binding
 *   should move to afterwards (the new layout/master it just created, or the
 *   owning master after a delete).
 *
 * @module render/master-view-crud
 */
import type {
	LayoutDefinition,
	MasterLayoutCrudFailure,
	PptxData,
	PptxHandler,
	PptxSlideMaster,
} from 'pptx-viewer-core';
import {
	deleteLayout,
	deleteSlideMaster,
	duplicateLayout,
	duplicateSlideMaster,
	insertLayout,
	insertSlideMaster,
	renameLayout,
	renameSlideMaster,
} from 'pptx-viewer-core';

import type { MasterViewTarget } from './master-view';

/** One Slide Master view sidebar command. */
export type MasterViewCrudActionId =
	| 'addLayout'
	| 'duplicateLayout'
	| 'deleteLayout'
	| 'renameLayout'
	| 'addMaster'
	| 'duplicateMaster'
	| 'deleteMaster'
	| 'renameMaster';

/** A framework-neutral descriptor for one sidebar button. */
export interface MasterViewCrudAction {
	id: MasterViewCrudActionId;
	/** i18n key for the button label (`pptx.masterView.<id>`). */
	labelKey: string;
	enabled: boolean;
	/** i18n key explaining why the button is disabled, set only when it is. */
	disabledReasonKey?: string;
}

/**
 * The i18n key a binding should show when {@link applyMasterViewCrudAction}
 * refuses a command. Core reports a single `inUse` reason for both part
 * kinds, so the copy is picked by the command that was attempted.
 */
export function masterViewCrudFailureKey(
	id: MasterViewCrudActionId,
	reason: MasterLayoutCrudFailure['reason'],
): string {
	switch (reason) {
		case 'inUse':
			return id === 'deleteMaster' ? 'pptx.masterView.masterInUse' : 'pptx.masterView.layoutInUse';
		case 'lastMaster':
			return 'pptx.masterView.lastMaster';
		case 'notFound':
			return 'pptx.masterView.notFound';
	}
}

function layoutInUse(data: PptxData, layoutPath: string): boolean {
	return data.slides.some((slide) => slide.layoutPath === layoutPath);
}

function masterInUse(data: PptxData, master: PptxSlideMaster): boolean {
	const layoutPaths = new Set((master.layouts ?? []).map((layout) => layout.path));
	return data.slides.some(
		(slide) => slide.layoutPath !== undefined && layoutPaths.has(slide.layoutPath),
	);
}

/**
 * The eight Slide Master view sidebar commands for the current selection,
 * each already resolved to enabled/disabled with the i18n key a binding
 * needs to explain why (`pptx.masterView.layoutInUse` /
 * `masterInUse` / `lastMaster`). Returns `[]` outside the "slides" tab (the
 * Notes/Handout master panes have no layout gallery to act on).
 */
export function masterViewCrudActions(
	data: PptxData,
	target: MasterViewTarget | null | undefined,
): MasterViewCrudAction[] {
	if (!target || target.tab !== 'slides') {
		return [];
	}
	const master = data.slideMasters?.[target.masterIndex];
	if (!master) {
		return [];
	}
	const layout = target.layoutIndex === null ? undefined : master.layouts?.[target.layoutIndex];
	const masterCount = data.slideMasters?.length ?? 0;

	const layoutCanDelete = layout !== undefined && !layoutInUse(data, layout.path);
	const isLastMaster = masterCount <= 1;
	const masterCanDelete = !isLastMaster && !masterInUse(data, master);

	return [
		{ id: 'addLayout', labelKey: 'pptx.masterView.addLayout', enabled: true },
		{
			id: 'duplicateLayout',
			labelKey: 'pptx.masterView.duplicateLayout',
			enabled: layout !== undefined,
		},
		{
			id: 'deleteLayout',
			labelKey: 'pptx.masterView.deleteLayout',
			enabled: layoutCanDelete,
			...(layout !== undefined && !layoutCanDelete
				? { disabledReasonKey: 'pptx.masterView.layoutInUse' }
				: {}),
		},
		{
			id: 'renameLayout',
			labelKey: 'pptx.masterView.renameLayout',
			enabled: layout !== undefined,
		},
		{ id: 'addMaster', labelKey: 'pptx.masterView.addMaster', enabled: true },
		{ id: 'duplicateMaster', labelKey: 'pptx.masterView.duplicateMaster', enabled: true },
		{
			id: 'deleteMaster',
			labelKey: 'pptx.masterView.deleteMaster',
			enabled: masterCanDelete,
			...(!masterCanDelete
				? {
						disabledReasonKey: isLastMaster
							? 'pptx.masterView.lastMaster'
							: 'pptx.masterView.masterInUse',
					}
				: {}),
		},
		{ id: 'renameMaster', labelKey: 'pptx.masterView.renameMaster', enabled: true },
	];
}

/** Extra input a command needs beyond `target`: a new name, or a layout definition for `addLayout`. */
export interface MasterViewCrudActionOptions {
	name?: string;
	layoutDefinition?: LayoutDefinition;
}

/** {@link applyMasterViewCrudAction} success: the selection to move to. */
export interface MasterViewCrudApplySuccess {
	ok: true;
	handler: PptxHandler;
	data: PptxData;
	target: MasterViewTarget;
}
export type MasterViewCrudApplyResult = MasterViewCrudApplySuccess | MasterLayoutCrudFailure;

function targetForLayout(
	data: PptxData,
	masterPath: string,
	layoutPath: string | undefined,
): MasterViewTarget {
	const masters = data.slideMasters ?? [];
	const masterIndex = Math.max(
		0,
		masters.findIndex((master) => master.path === masterPath),
	);
	const layoutIndex = layoutPath
		? (masters[masterIndex]?.layouts?.findIndex((layout) => layout.path === layoutPath) ?? -1)
		: -1;
	return { tab: 'slides', masterIndex, layoutIndex: layoutIndex === -1 ? null : layoutIndex };
}

function targetForMaster(data: PptxData, masterPath: string | undefined): MasterViewTarget {
	const masters = data.slideMasters ?? [];
	const masterIndex = Math.max(
		0,
		masterPath ? masters.findIndex((master) => master.path === masterPath) : 0,
	);
	return { tab: 'slides', masterIndex, layoutIndex: null };
}

/**
 * Run one Slide Master view sidebar command against `pptx-viewer-core`'s
 * `master-layout-crud` module, and resolve the selection the sidebar should
 * move to afterwards: the layout/master the command just created, or the
 * owning master once a delete removes the current selection.
 *
 * `options.name` is required for `renameLayout` / `renameMaster`;
 * `options.layoutDefinition` is optional for `addLayout` (a default
 * title-only layout is generated when omitted, see `insertLayout` in core).
 */
export async function applyMasterViewCrudAction(
	handler: PptxHandler,
	data: PptxData,
	action: MasterViewCrudActionId,
	target: MasterViewTarget,
	options?: MasterViewCrudActionOptions,
): Promise<MasterViewCrudApplyResult> {
	if (target.tab !== 'slides') {
		return { ok: false, reason: 'notFound' };
	}
	const master = data.slideMasters?.[target.masterIndex];
	if (!master) {
		return { ok: false, reason: 'notFound' };
	}
	const layout = target.layoutIndex === null ? undefined : master.layouts?.[target.layoutIndex];

	switch (action) {
		case 'addLayout': {
			const result = await insertLayout(handler, data, master.path, options?.layoutDefinition);
			return result.ok
				? {
						ok: true,
						handler: result.handler,
						data: result.data,
						target: targetForLayout(result.data, master.path, result.layoutId),
					}
				: result;
		}
		case 'duplicateLayout': {
			if (!layout) {
				return { ok: false, reason: 'notFound' };
			}
			const result = await duplicateLayout(handler, data, layout.path);
			return result.ok
				? {
						ok: true,
						handler: result.handler,
						data: result.data,
						target: targetForLayout(result.data, master.path, result.layoutId),
					}
				: result;
		}
		case 'deleteLayout': {
			if (!layout) {
				return { ok: false, reason: 'notFound' };
			}
			const result = await deleteLayout(handler, data, layout.path);
			return result.ok
				? {
						ok: true,
						handler: result.handler,
						data: result.data,
						target: { ...target, layoutIndex: null },
					}
				: result;
		}
		case 'renameLayout': {
			if (!layout || options?.name === undefined) {
				return { ok: false, reason: 'notFound' };
			}
			const result = await renameLayout(handler, data, layout.path, options.name);
			return result.ok ? { ok: true, handler: result.handler, data: result.data, target } : result;
		}
		case 'addMaster': {
			const result = await insertSlideMaster(handler, data);
			return result.ok
				? {
						ok: true,
						handler: result.handler,
						data: result.data,
						target: targetForMaster(result.data, result.masterId),
					}
				: result;
		}
		case 'duplicateMaster': {
			const result = await duplicateSlideMaster(handler, data, master.path);
			return result.ok
				? {
						ok: true,
						handler: result.handler,
						data: result.data,
						target: targetForMaster(result.data, result.masterId),
					}
				: result;
		}
		case 'deleteMaster': {
			const result = await deleteSlideMaster(handler, data, master.path);
			return result.ok
				? {
						ok: true,
						handler: result.handler,
						data: result.data,
						target: targetForMaster(result.data, undefined),
					}
				: result;
		}
		case 'renameMaster': {
			if (options?.name === undefined) {
				return { ok: false, reason: 'notFound' };
			}
			const result = await renameSlideMaster(handler, data, master.path, options.name);
			return result.ok ? { ok: true, handler: result.handler, data: result.data, target } : result;
		}
		default: {
			const exhaustive: never = action;
			throw new Error(`Unhandled master-view CRUD action: ${String(exhaustive)}`);
		}
	}
}
