import type { PptxData, PptxHandler, PptxSlide, PptxSlideMaster } from 'pptx-viewer-core';
import type {
	CompatibilityWarningToast,
	MasterViewCrudAction,
	MasterViewCrudActionId,
	MasterViewTarget,
} from 'pptx-viewer-shared';
import {
	applyMasterViewCrudAction,
	masterViewCrudActions,
	masterViewCrudFailureKey,
} from 'pptx-viewer-shared';
import { useCallback, useMemo } from 'react';
import { useTranslation } from 'react-i18next';

import { safePrompt } from '../utils/dom-helpers';

/**
 * useMasterViewCrud: Slide Master view sidebar CRUD (Insert/Duplicate/
 * Delete/Rename Layout and Slide Master).
 *
 * The shared `master-view-crud` module only ever reads `.slides` /
 * `.slideMasters` off the `PptxData` it is handed (verified against
 * `packages/core/src/core/builders/sdk/master-layout-crud*.ts`: every lookup
 * and `saveToZip` call touches only those two fields), so the minimal object
 * built here is safe even though React keeps the rest of a loaded deck's
 * fields split into their own state slots rather than one `PptxData`
 * (`useExportSaveAs`'s JSON export takes the same shortcut).
 */

export interface UseMasterViewCrudInput {
	handlerRef: React.RefObject<PptxHandler | null>;
	slides: PptxSlide[];
	slideMasters: PptxSlideMaster[];
	target: MasterViewTarget | null;
	setSlides: React.Dispatch<React.SetStateAction<PptxSlide[]>>;
	setSlideMasters: React.Dispatch<React.SetStateAction<PptxSlideMaster[]>>;
	setActiveMasterIndex: React.Dispatch<React.SetStateAction<number>>;
	setActiveLayoutIndex: React.Dispatch<React.SetStateAction<number | null>>;
	markDirty: () => void;
	/** Surfaces a failure reason through the existing compat-toast stack. */
	pushToast: (toast: CompatibilityWarningToast) => void;
}

export interface UseMasterViewCrudResult {
	/** The sidebar's eight command buttons, resolved enabled/disabled for `target`. */
	crudActions: MasterViewCrudAction[];
	/** Run one command by id (rename* prompts for a name first). */
	handleCrudAction: (id: MasterViewCrudActionId) => Promise<void>;
}

export function useMasterViewCrud(input: UseMasterViewCrudInput): UseMasterViewCrudResult {
	const {
		handlerRef,
		slides,
		slideMasters,
		target,
		setSlides,
		setSlideMasters,
		setActiveMasterIndex,
		setActiveLayoutIndex,
		markDirty,
		pushToast,
	} = input;
	const { t } = useTranslation();

	// See the module doc: only `.slides` / `.slideMasters` are ever read off
	// this by the shared helper or core's master-layout-crud SDK.
	const data = useMemo(
		() => ({ slides, slideMasters }) as unknown as PptxData,
		[slides, slideMasters],
	);

	const crudActions = useMemo(() => masterViewCrudActions(data, target), [data, target]);

	const handleCrudAction = useCallback(
		async (id: MasterViewCrudActionId) => {
			const handler = handlerRef.current;
			if (!handler || !target) {
				return;
			}
			const action = crudActions.find((candidate) => candidate.id === id);
			if (!action?.enabled) {
				return;
			}

			let name: string | undefined;
			if (id === 'renameLayout' || id === 'renameMaster') {
				const master = slideMasters[target.masterIndex];
				const current =
					id === 'renameLayout'
						? (master?.layouts?.[target.layoutIndex ?? -1]?.name ?? '')
						: (master?.name ?? '');
				const next = safePrompt(t('pptx.masterView.renamePrompt'), current)?.trim();
				if (!next) {
					return;
				}
				name = next;
			}

			const result = await applyMasterViewCrudAction(
				handler,
				data,
				id,
				target,
				name !== undefined ? { name } : undefined,
			);

			if (!result.ok) {
				pushToast({
					id: `master-crud-${Date.now()}`,
					code: `masterViewCrud:${result.reason}`,
					severity: 'warning',
					messageKey: masterViewCrudFailureKey(id, result.reason),
				});
				return;
			}

			// Adopt the helper's fresh handler/data wholesale (it does not mutate
			// the ones it was given) through React's normal per-field state slots.
			handlerRef.current = result.handler;
			setSlides(result.data.slides);
			setSlideMasters(result.data.slideMasters ?? []);
			setActiveMasterIndex(result.target.masterIndex);
			setActiveLayoutIndex(result.target.layoutIndex);
			markDirty();
		},
		[
			handlerRef,
			target,
			crudActions,
			slideMasters,
			t,
			data,
			pushToast,
			setSlides,
			setSlideMasters,
			setActiveMasterIndex,
			setActiveLayoutIndex,
			markDirty,
		],
	);

	return { crudActions, handleCrudAction };
}
