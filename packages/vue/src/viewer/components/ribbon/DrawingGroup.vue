<script setup lang="ts">
/**
 * DrawingGroup: Shapes, Arrange, Shape Fill, Shape Outline, Quick Styles and
 * Shape Effects. Every control and popover (the shapes list, the layer-order
 * menu, the colour popovers, the style galleries) is the shared
 * `pptx-ui-ribbon-home-drawing` element; this adapter reflects selection,
 * deck colours and gallery descriptors into it and runs the undoable edits.
 * Vue port of React's `toolbar/DrawingGroup.tsx`.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
import {
	drawingHomeControls,
	homeGalleryApply,
	homeGalleryControls,
	homeSnapshotTranslator,
	shapeFillChange,
	shapeOutlineChange,
	withHomeGalleries,
} from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { useRibbonGalleryHost } from '../../composables/useRibbonGalleryHost';
import { SEP } from './ribbon-constants';
import type { SupportedShapeType } from './ribbon-types';
import { useHomeColours } from './use-home-colours';

interface Props {
	canEdit: boolean;
	selectedElement: PptxElement | null;
	newShapeType: string;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	onAddShape: () => void;
	onMoveLayer: (direction: string) => void;
	onMoveLayerToEdge: (direction: string) => void;
	/**
	 * Patch the selected shape's style. Optional only because the mobile menu
	 * sheet renders the group without one; the desktop ribbon always passes it.
	 */
	onUpdateElementStyle?: (style: Partial<ShapeStyle>) => void;
}

const props = defineProps<Props>();
const { t, locale } = useI18n();
const gallery = useRibbonGalleryHost();
const colours = useHomeColours();

const shapeStyle = computed<ShapeStyle | undefined>(() =>
	props.selectedElement && hasShapeProperties(props.selectedElement)
		? props.selectedElement.shapeStyle
		: undefined,
);

const state = computed(() => {
	const common = { themeColors: colours.themeColors.value, recent: colours.recent.value };
	return {
		controls: withHomeGalleries(
			drawingHomeControls({
				editable: props.canEdit,
				hasSelection: Boolean(props.selectedElement),
				shapeType: props.newShapeType,
				fill: {
					...common,
					value: shapeStyle.value?.fillColor ?? '#000000',
					ref: shapeStyle.value?.fillColorRef,
				},
				outline: {
					...common,
					value: shapeStyle.value?.strokeColor ?? '#000000',
					ref: shapeStyle.value?.strokeColorRef,
				},
			}),
			homeGalleryControls('drawing', gallery.context.value, props.canEdit),
			props.canEdit,
		),
		// The locale is read so a language switch re-translates the shared labels.
		locale: locale.value,
		translate: homeSnapshotTranslator(['drawing'], t),
	};
});

function request(event: RibbonHomeRequestEvent): void {
	const { id, value, ref } = event.detail;
	switch (id) {
		case 'home.drawing.shapes':
			props.onSetNewShapeType(String(value) as SupportedShapeType);
			props.onAddShape();
			break;
		case 'home.drawing.arrange':
			if (value === 'front' || value === 'back') {
				props.onMoveLayerToEdge(value);
			} else {
				props.onMoveLayer(String(value));
			}
			break;
		case 'home.drawing.shapeFill':
			props.onUpdateElementStyle?.(shapeFillChange(String(value), ref));
			colours.push(String(value));
			break;
		case 'home.drawing.shapeOutline':
			props.onUpdateElementStyle?.(shapeOutlineChange(String(value), ref));
			colours.push(String(value));
			break;
		default: {
			const result = homeGalleryApply('drawing', id, String(value), gallery.context.value);
			if (result && props.canEdit) {
				gallery.dispatch(result);
			}
		}
	}
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.drawing">
		<div class="flex items-center gap-1" data-pptx-chrome="drawing-controls">
			<pptx-ui-ribbon-home-drawing :state.prop="state" @home-request="request" />
		</div>
		<span data-pptx-chrome="ribbon-group-label">{{ t('pptx.ribbon.groupDrawing') }}</span>
	</div>

	<div :class="SEP" />
</template>
