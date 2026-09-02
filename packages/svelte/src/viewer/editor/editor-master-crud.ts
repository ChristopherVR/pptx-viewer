/**
 * Slide Master view sidebar CRUD (Insert / Duplicate / Delete / Rename Layout
 * and Slide Master), the Svelte wiring for the shared decision layer in
 * `pptx-viewer-shared/render/master-view-crud` (wave-4 B4).
 *
 * Unlike every other editor mutation, this one performs real ZIP surgery
 * through `pptx-viewer-core` (a new layout/master part, a rels update, a
 * content-type override) and comes back with a BRAND NEW `PptxHandler` +
 * `PptxData` rather than a patch to the working document. So besides the
 * usual push-history / assign / commit-change shape, it also hands the fresh
 * handler back to the loader through `EditorState.adoptHandler`.
 */
import type { PptxData } from 'pptx-viewer-core';
import {
	applyMasterViewCrudAction,
	masterViewCrudActions,
	masterViewCrudFailureKey,
} from 'pptx-viewer-shared';
import type { MasterViewCrudAction, MasterViewCrudActionId } from 'pptx-viewer-shared';

import type { EditorState } from './editor-state.svelte';

export interface MasterViewCrudPrompts {
	/** Ask for the new layout/master name; null/empty cancels the rename. */
	promptName(currentName: string): string | null;
	/** Surface a rejection (`notFound` / `inUse` / `lastMaster`) as translated copy. */
	notify(message: string): void;
	translate(key: string): string;
}

/** The `PptxData` projection the shared CRUD rules read. */
function toPptxData(editor: EditorState): PptxData {
	return { slides: editor.slides, slideMasters: editor.slideMasters } as unknown as PptxData;
}

/** The layout/master name to seed the rename prompt with. */
function currentName(editor: EditorState): string {
	const target = editor.masterViewTarget;
	if (!target) {
		return '';
	}
	const master = editor.slideMasters[target.masterIndex];
	if (target.layoutIndex === null) {
		return master?.name ?? '';
	}
	return master?.layouts?.[target.layoutIndex]?.name ?? '';
}

/** Drives the sidebar's Insert/Duplicate/Delete/Rename commands on {@link EditorState}. */
export class EditorMasterCrudController {
	constructor(private readonly editor: EditorState) {}

	/** The sidebar's action list (enabled/disabled + reason) for the current target. */
	actions(): MasterViewCrudAction[] {
		const target = this.editor.masterViewTarget;
		if (!target || !this.editor.editable) {
			return [];
		}
		return masterViewCrudActions(toPptxData(this.editor), target);
	}

	/**
	 * Run one command against the CURRENT master-view target. A no-op outside
	 * master view, on a read-only deck, or when the action is disabled for the
	 * target (mirrors the sidebar's own gating, so a stray call through the
	 * public API cannot bypass it).
	 */
	async run(id: MasterViewCrudActionId, prompts: MasterViewCrudPrompts): Promise<boolean> {
		const target = this.editor.masterViewTarget;
		const handler = this.editor.getHandler();
		if (!target || !handler || !this.editor.editable) {
			return false;
		}
		const data = toPptxData(this.editor);
		const action = masterViewCrudActions(data, target).find((entry) => entry.id === id);
		if (!action?.enabled) {
			return false;
		}

		let name: string | undefined;
		if (id === 'renameLayout' || id === 'renameMaster') {
			const entered = prompts.promptName(currentName(this.editor))?.trim();
			if (!entered) {
				return false;
			}
			name = entered;
		}

		const result = await applyMasterViewCrudAction(handler, data, id, target, { name });
		if (!result.ok) {
			prompts.notify(prompts.translate(masterViewCrudFailureKey(id, result.reason)));
			return false;
		}

		this.editor.pushHistory();
		this.editor.adoptHandler(result.handler);
		this.editor.slideMasters = result.data.slideMasters ?? [];
		this.editor.masterViewTarget = {
			tab: 'slides',
			masterIndex: result.target.masterIndex,
			layoutIndex: result.target.layoutIndex,
		};
		this.editor.selection.clear();
		this.editor.commitChange();
		return true;
	}
}
