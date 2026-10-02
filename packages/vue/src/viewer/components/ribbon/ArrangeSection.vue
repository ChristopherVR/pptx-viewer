<!--
	Arrange ribbon section: Vue port of React's `toolbar/ArrangeSection.tsx`.
	The align/distribute, flip, layer-order and duplicate/delete buttons are the
	shared `pptx-ui-ribbon-home-arrange-*` strips (markup, icons and gating come
	from shared code; this adapter maps their `home-request` intents onto the
	handlers). The optional format-painter toggle, group/ungroup + outline width
	(`ShapeArrangeExtras.vue`), Merge Shapes and Crop stay native.

	This group deliberately does NOT repeat Cut / Copy / Paste. It used to, and
	since the Home tab already renders the Clipboard group beside it, every one
	of those three commands appeared twice on the same tab under the same name:
	two buttons that claim to be "Copy" is a tab that cannot be addressed by
	name, by a user or by a test.
-->
<script setup lang="ts">
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import type { RibbonHomeRequestEvent, ToolbarActionId } from 'pptx-viewer-shared';
import { arrangeAlignAction, arrangeHomeControls } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { useToolbarVisibility } from '../../composables/useToolbarVisibility';
import CropControls from './CropControls.vue';
import MergeShapesMenu from './MergeShapesMenu.vue';
import { ic, pill } from './ribbon-constants';
import RibbonIcon from './RibbonIcon';
import ShapeArrangeExtras from './ShapeArrangeExtras.vue';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	/** How many elements the multi-select currently holds; Group needs two. */
	selectedCount: number;
	/** Whether every selected element allows `a:spLocks/@noGrp` grouping. */
	selectionGroupable: boolean;
	onAlignElements: (align: string) => void;
	onDistributeElements: (axis: string) => void;
	canDistribute: boolean;
	onFlip: (direction: 'horizontal' | 'vertical') => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	onGroupElements: () => void;
	onUngroupElement: () => void;
	onUpdateElementStyle: (updates: Partial<ShapeStyle>) => void;
	onDuplicate: () => void;
	onDelete: () => void;
	formatPainterActive?: boolean;
	onToggleFormatPainter?: () => void;
	canActivateFormatPainter?: boolean;
	/** Host + customisation hidden actions (gates Merge Shapes and Crop). */
	hiddenActions?: ToolbarActionId[];
}

const props = defineProps<Props>();

const { t, locale } = useI18n();
const { isHidden } = useToolbarVisibility(() => props.hiddenActions);

const state = computed(() => ({
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	controls: arrangeHomeControls({
		editable: props.canEdit,
		hasSelection: Boolean(props.selectedElement),
		canDistribute: props.canDistribute,
	}),
	translate: t,
}));

/** This binding's align handler names the horizontal centre `center`. */
function requestAlign(event: RibbonHomeRequestEvent): void {
	const action = arrangeAlignAction(event.detail.part);
	if (action?.kind === 'align') {
		props.onAlignElements(action.edge === 'centerH' ? 'center' : action.edge);
	} else if (action?.kind === 'distribute') {
		props.onDistributeElements(action.axis);
	}
}

function requestFlip(event: RibbonHomeRequestEvent): void {
	props.onFlip(event.detail.id === 'home.arrange.flipHorizontal' ? 'horizontal' : 'vertical');
}

function requestOrder(event: RibbonHomeRequestEvent): void {
	switch (event.detail.id) {
		case 'home.arrange.sendBackward':
			props.onMoveLayer('backward');
			break;
		case 'home.arrange.bringForward':
			props.onMoveLayer('forward');
			break;
		case 'home.arrange.sendToBack':
			props.onMoveLayerToEdge('back');
			break;
		case 'home.arrange.bringToFront':
			props.onMoveLayerToEdge('front');
	}
}

function requestEdit(event: RibbonHomeRequestEvent): void {
	if (event.detail.id === 'home.arrange.duplicate') {
		props.onDuplicate();
	} else if (event.detail.id === 'home.arrange.delete') {
		props.onDelete();
	}
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.arrange">
		<div data-pptx-chrome="arrange-controls">
			<pptx-ui-ribbon-home-arrange-align :state.prop="state" @home-request="requestAlign" />
			<button
				v-if="props.onToggleFormatPainter"
				type="button"
				:disabled="
					!props.canEdit || (props.canActivateFormatPainter === false && !props.formatPainterActive)
				"
				data-testid="format-painter-toggle"
				data-ribbon-control="home.clipboard.formatPainter"
				:data-active="props.formatPainterActive ? 'true' : 'false'"
				:class="
					cn(pill, props.formatPainterActive ? 'bg-amber-600 hover:bg-amber-500 text-amber-50' : '')
				"
				:title="t('pptx.arrange.formatPainter')"
				@click="props.onToggleFormatPainter"
			>
				<RibbonIcon name="home.clipboard.formatPainter" :class="ic" />
				{{ t('pptx.arrange.format') }}
			</button>
			<pptx-ui-ribbon-home-arrange-flip :state.prop="state" @home-request="requestFlip" />
			<ShapeArrangeExtras
				:can-edit="props.canEdit"
				:selected-element="props.selectedElement"
				:selected-count="props.selectedCount"
				:selection-groupable="props.selectionGroupable"
				:on-group-elements="props.onGroupElements"
				:on-ungroup-element="props.onUngroupElement"
				:on-update-element-style="props.onUpdateElementStyle"
			/>
			<MergeShapesMenu
				v-if="!isHidden('mergeShapes')"
				data-ribbon-control="home.arrange.mergeShapes"
			/>
			<CropControls v-if="!isHidden('crop')" data-ribbon-control="home.arrange.crop" />
			<pptx-ui-ribbon-home-arrange-order :state.prop="state" @home-request="requestOrder" />
			<pptx-ui-ribbon-home-arrange-edit :state.prop="state" @home-request="requestEdit" />
		</div>
		<span data-pptx-chrome="ribbon-group-label">{{ t('pptx.ribbon.arrange') }}</span>
	</div>
</template>
