import type { MergeShapeOperation } from 'pptx-viewer-core';
import {
	CROP_ASPECT_GROUP_LABEL_KEYS,
	CROP_ASPECT_LABEL_KEY,
	CROP_ASPECT_PRESETS,
	CROP_FILL_LABEL_KEY,
	CROP_FIT_LABEL_KEY,
	CROP_LABEL_KEY,
	isActionHidden,
	MERGE_SHAPES_HINT_KEY,
	MERGE_SHAPES_LABEL_KEY,
	MERGE_SHAPES_MENU_ITEMS,
} from 'pptx-viewer-shared';
import type { CropAspectGroup, ToolbarActionId } from 'pptx-viewer-shared';

import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { ActionMenuItem } from './ribbon-action-menu';
import { makeActionMenu } from './ribbon-action-menu';

export interface MergeCropHandlers {
	mergeShapes(operation: MergeShapeOperation): void;
	toggleCropMode(): void;
	cropToAspect(ratioWidth: number, ratioHeight: number): void;
	cropFill(): void;
	cropFit(): void;
}

export interface MergeCropState {
	editable: boolean;
	/** Shared `canMergeShapes` over the selection. */
	canMergeShapes: boolean;
	/** A single croppable picture is selected (shared `canCropElement`). */
	canCrop: boolean;
	/** Crop mode is on. */
	cropActive: boolean;
}

export interface MergeCropControls {
	el: HTMLElement;
	update(state: MergeCropState): void;
}

const CROP_HINT_KEY = 'pptx.image.cropHint';

/**
 * Home > Arrange's Merge Shapes dropdown and the picture Crop toggle + Crop
 * dropdown (aspect presets, Fill, Fit). The menu contents and every enable
 * rule come from the shared `merge-shapes` / `picture-crop` modules, so the
 * five bindings list the same commands in the same order.
 *
 * A control in `hiddenActions` ('mergeShapes' / 'crop', which already folds in
 * `customization.ribbon.hiddenButtons`) is never built, like every other
 * hidden ribbon control in this binding.
 */
export function createMergeCropControls(
	doc: Document,
	t: Translator,
	handlers: MergeCropHandlers,
	hiddenActions?: readonly ToolbarActionId[],
): MergeCropControls {
	const el = createEl(doc, 'div', 'pptxv-arrange-extras');

	const merge = isActionHidden('mergeShapes', hiddenActions)
		? null
		: makeActionMenu(doc, {
				label: t(MERGE_SHAPES_LABEL_KEY),
				icon: 'merge-shapes',
				control: 'merge-shapes',
				items: MERGE_SHAPES_MENU_ITEMS.map((item) => ({
					label: t(item.labelKey),
					dataset: { pptxMergeOp: item.operation },
					run: () => handlers.mergeShapes(item.operation),
				})),
			});
	if (merge) {
		el.appendChild(merge.el);
	}

	let crop: ReturnType<typeof makeButton> | null = null;
	let cropMenu: ReturnType<typeof makeActionMenu> | null = null;
	if (!isActionHidden('crop', hiddenActions)) {
		const cropWrap = createEl(doc, 'div', 'pptxv-arrange-extras');
		// Presses here own crop mode's toggle, so they must not also commit it.
		cropWrap.dataset.pptxCropControls = 'true';
		crop = makeButton(doc, {
			label: t(CROP_LABEL_KEY),
			icon: 'crop',
			onClick: handlers.toggleCropMode,
		});
		crop.btn.dataset.pptxRibbonControl = 'crop';
		let lastGroup: CropAspectGroup | null = null;
		const items: ActionMenuItem[] = CROP_ASPECT_PRESETS.map((preset) => {
			const groupLabel =
				preset.group !== lastGroup ? t(CROP_ASPECT_GROUP_LABEL_KEYS[preset.group]) : undefined;
			lastGroup = preset.group;
			return {
				label: preset.id,
				groupLabel,
				dataset: { pptxCropAspect: preset.id },
				run: () => handlers.cropToAspect(preset.ratioWidth, preset.ratioHeight),
			};
		});
		items.push(
			{
				label: t(CROP_FILL_LABEL_KEY),
				dataset: { pptxCropAction: 'fill' },
				run: handlers.cropFill,
			},
			{
				label: t(CROP_FIT_LABEL_KEY),
				dataset: { pptxCropAction: 'fit' },
				run: handlers.cropFit,
			},
		);
		cropMenu = makeActionMenu(doc, {
			label: t(CROP_ASPECT_LABEL_KEY),
			control: 'crop-menu',
			items,
		});
		cropWrap.append(crop.btn, cropMenu.el);
		el.appendChild(cropWrap);
	}

	return {
		el,
		update({ editable, canMergeShapes, canCrop, cropActive }) {
			merge?.setDisabled(!(editable && canMergeShapes), t(MERGE_SHAPES_HINT_KEY));
			if (crop) {
				const cropEnabled = editable && (canCrop || cropActive);
				crop.setDisabled(!cropEnabled);
				crop.btn.title = cropEnabled ? t(CROP_LABEL_KEY) : t(CROP_HINT_KEY);
				crop.setActive(cropActive);
			}
			cropMenu?.setDisabled(!(editable && (canCrop || cropActive)), t(CROP_HINT_KEY));
		},
	};
}
