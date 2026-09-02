/**
 * useMasterViewCrud: the Slide Master view sidebar's
 * Insert/Duplicate/Delete/Rename Layout and Slide Master commands.
 *
 * The button list (which ids are enabled, and why not when they are not) is
 * the shared, framework-neutral `masterViewCrudActions`. Running a command
 * dispatches to `applyMasterViewCrudAction`, which performs real ZIP surgery
 * (`pptx-viewer-core`'s `master-layout-crud` module: save the handler, mutate
 * the ZIP, reload through a fresh `PptxHandler`) and hands back a brand-new
 * `handler` + `data` rather than mutating the existing ones in place. Adopting
 * that result is therefore the same "replace the loaded deck" shape every
 * other full-document mutation in this viewer uses (see `refreshContent` in
 * `PowerPointViewer.vue`): swap in the new handler, resync the Vue refs the
 * result actually changed, and move the sidebar selection to the returned
 * target.
 */
import type { PptxData, PptxHandler, PptxSlideMaster } from 'pptx-viewer-core';
import {
	applyMasterViewCrudAction,
	masterViewCrudActions,
	masterViewCrudFailureKey,
} from 'pptx-viewer-shared';
import type {
	MasterViewCrudAction,
	MasterViewCrudActionId,
	MasterViewTarget,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { ComputedRef, Ref, ShallowRef } from 'vue';
import { useI18n } from 'vue-i18n';

export interface UseMasterViewCrudInput {
	handler: ShallowRef<PptxHandler | null>;
	slideMasters: ShallowRef<PptxSlideMaster[]>;
	/** Snapshot the presentation-level `PptxData` the CRUD action reads/validates against. */
	deckData: () => PptxData;
	/** The sidebar's current selection, as the shared rule sees it. */
	target: () => MasterViewTarget;
	onSelectMaster: (index: number) => void;
	onSelectLayout: (masterIndex: number, layoutIndex: number) => void;
	markDirty: () => void;
	/** Snapshot `slides` onto the undo stack before adopting the CRUD result. */
	pushHistory: () => void;
}

export interface UseMasterViewCrudResult {
	/** The sidebar's button list for the current selection (enabled/disabled + why). */
	actions: ComputedRef<MasterViewCrudAction[]>;
	/** i18n key for the last command's failure, or `null`. Cleared on the next run. */
	error: Ref<string | null>;
	/** Run one sidebar command. */
	run: (id: MasterViewCrudActionId) => Promise<void>;
}

const RENAME_ACTIONS = new Set<MasterViewCrudActionId>(['renameLayout', 'renameMaster']);

export function useMasterViewCrud(input: UseMasterViewCrudInput): UseMasterViewCrudResult {
	const { t } = useI18n();
	const error = ref<string | null>(null);

	const actions = computed(() => masterViewCrudActions(input.deckData(), input.target()));

	/** The layout/master name the rename prompt seeds, for the current target. */
	function currentName(): string {
		const target = input.target();
		const master = input.slideMasters.value[target.masterIndex];
		if (target.layoutIndex === null) {
			return master?.name ?? '';
		}
		return master?.layouts?.[target.layoutIndex]?.name ?? '';
	}

	async function run(id: MasterViewCrudActionId): Promise<void> {
		error.value = null;
		const handler = input.handler.value;
		if (!handler) {
			return;
		}

		let name: string | undefined;
		if (RENAME_ACTIONS.has(id)) {
			// Mirrors the Custom Shows rename flow (`useCustomShowsWiring`), the
			// only other rename affordance in this binding: `window.prompt`.
			const next = window.prompt(t('pptx.masterView.renamePrompt'), currentName())?.trim();
			if (!next) {
				return;
			}
			name = next;
		}

		input.pushHistory();
		const result = await applyMasterViewCrudAction(
			handler,
			input.deckData(),
			id,
			input.target(),
			name === undefined ? undefined : { name },
		);
		if (!result.ok) {
			error.value = t(masterViewCrudFailureKey(id, result.reason));
			return;
		}

		input.handler.value = result.handler;
		input.slideMasters.value = result.data.slideMasters ?? [];
		if (result.target.layoutIndex === null) {
			input.onSelectMaster(result.target.masterIndex);
		} else {
			input.onSelectLayout(result.target.masterIndex, result.target.layoutIndex);
		}
		input.markDirty();
	}

	return { actions, error, run };
}
