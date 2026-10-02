<!--
	Arrange ribbon section: Vue port of React's `toolbar/ArrangeSection.tsx`.
	Every control is a shared `pptx-ui-ribbon-home-arrange-*` strip (markup,
	icons, menus and gating come from shared code; this adapter maps their
	`home-request` intents onto the handlers): align/distribute, the optional
	second Format Painter, flip, Group/Ungroup + Merge Shapes + Crop + outline
	width, layer order and duplicate/delete.

	This group deliberately does NOT repeat Cut / Copy / Paste. It used to, and
	since the Home tab already renders the Clipboard group beside it, every one
	of those three commands appeared twice on the same tab under the same name:
	two buttons that claim to be "Copy" is a tab that cannot be addressed by
	name, by a user or by a test.
-->
<script setup lang="ts">
import type { MergeShapeOperation, PptxElement, ShapeStyle } from 'pptx-viewer-core';
import type { RibbonHomeRequestEvent, ToolbarActionId } from 'pptx-viewer-shared';
import {
	arrangeAlignAction,
	arrangeHomeControls,
	arrangePainterHomeControls,
	arrangeShapeHomeControls,
	canGroupSelection,
	canSetStrokeWidth,
	canUngroupSelection,
	homeSnapshotTranslator,
	parseCropValue,
	strokeWidthOf,
} from 'pptx-viewer-shared';
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';

import { MergeCropKey } from '../../composables/merge-crop-context';
import { useToolbarVisibility } from '../../composables/useToolbarVisibility';

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

const controller = inject(MergeCropKey, undefined);

const families = [
	'arrange-align',
	'arrange-painter',
	'arrange-flip',
	'arrange-shape',
	'arrange-order',
	'arrange-edit',
] as const;

const state = computed(() => ({
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	controls: arrangeHomeControls({
		editable: props.canEdit,
		hasSelection: Boolean(props.selectedElement),
		canDistribute: props.canDistribute,
	}),
	translate: homeSnapshotTranslator(families, t),
}));

const painterState = computed(() => ({
	controls: arrangePainterHomeControls({
		editable: props.canEdit,
		active: Boolean(props.formatPainterActive),
		canFormatPaint: props.canActivateFormatPainter !== false,
		show: true,
	}),
	locale: locale.value,
	translate: homeSnapshotTranslator(families, t),
}));

const shapeState = computed(() => ({
	controls: arrangeShapeHomeControls({
		editable: props.canEdit,
		canGroup: canGroupSelection(props.canEdit, props.selectedCount, props.selectionGroupable),
		canUngroup: canUngroupSelection(props.canEdit, props.selectedElement),
		canMerge: Boolean(controller?.canMerge.value),
		canCrop: Boolean(controller?.cropActive.value) || Boolean(controller?.canCrop.value),
		cropActive: Boolean(controller?.cropActive.value),
		canStrokeWidth: canSetStrokeWidth(props.canEdit, props.selectedElement),
		strokeWidth: strokeWidthOf(props.selectedElement),
		hideMerge: isHidden('mergeShapes'),
		hideCrop: isHidden('crop'),
	}),
	locale: locale.value,
	translate: homeSnapshotTranslator(families, t),
}));

function requestShape(event: RibbonHomeRequestEvent): void {
	const { id, value } = event.detail;
	switch (id) {
		case 'home.arrange.group':
			props.onGroupElements();
			break;
		case 'home.arrange.ungroup':
			props.onUngroupElement();
			break;
		case 'home.arrange.outlineWidth':
			props.onUpdateElementStyle({ strokeWidth: Math.max(0, Number(value)) });
			break;
		case 'home.arrange.mergeShapes':
			controller?.merge(String(value) as MergeShapeOperation);
			break;
		case 'home.arrange.crop': {
			const crop = parseCropValue(value);
			if (!crop) {
				controller?.toggleCrop();
			} else if (crop.kind === 'aspect') {
				controller?.applyAspect(`${crop.width}:${crop.height}`);
			} else if (crop.kind === 'fill') {
				controller?.applyFill();
			} else {
				controller?.applyFit();
			}
		}
	}
}

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
			<pptx-ui-ribbon-home-arrange-painter
				v-if="props.onToggleFormatPainter"
				:state.prop="painterState"
				@home-request="props.onToggleFormatPainter()"
			/>
			<pptx-ui-ribbon-home-arrange-flip :state.prop="state" @home-request="requestFlip" />
			<!-- A press here must not count as "outside" and commit crop mode. -->
			<div class="contents" data-pptx-crop-keep="true">
				<pptx-ui-ribbon-home-arrange-shape :state.prop="shapeState" @home-request="requestShape" />
			</div>
			<pptx-ui-ribbon-home-arrange-order :state.prop="state" @home-request="requestOrder" />
			<pptx-ui-ribbon-home-arrange-edit :state.prop="state" @home-request="requestEdit" />
		</div>
		<span data-pptx-chrome="ribbon-group-label">{{ t('pptx.ribbon.arrange') }}</span>
	</div>
</template>
