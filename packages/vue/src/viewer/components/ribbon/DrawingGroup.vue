<script setup lang="ts">
import { Layers, PaintBucket, PenLine, Shapes } from 'lucide-vue-next';
/**
 * DrawingGroup: Drawing ribbon group with Shapes dropdown, Arrange layer
 * controls, Shape Fill/Outline colour popovers, and the Quick Styles / Shape
 * Effects galleries (built from the shared ribbon gallery descriptors).
 * Vue port of React's `toolbar/DrawingGroup.tsx`.
 */
import type { PptxElement, PptxThemeColorRef, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import { shapeFillChange, shapeOutlineChange } from 'pptx-viewer-shared';
import { computed } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { vAnchoredPopup } from './anchored-popup';
import { ic, MENU_ITEM, MENU_PANEL, pill, SEP } from './ribbon-constants';
import type { SupportedShapeType } from './ribbon-types';
import RibbonGallery from './RibbonGallery.vue';
import ShapeColorPopover from './ShapeColorPopover.vue';
import { useDropdown } from './use-dropdown';

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
	 * It used to be passed by nobody, so both swatch grids were decorative.
	 */
	onUpdateElementStyle?: (style: Partial<ShapeStyle>) => void;
}

const props = defineProps<Props>();
const { t } = useI18n();

const TOP_SHAPES: Array<{ type: SupportedShapeType; labelKey: string }> = [
	{ type: 'rect', labelKey: 'pptx.editorToolbar.shapeRectangle' },
	{ type: 'roundRect', labelKey: 'pptx.editorToolbar.shapeRoundedRectangle' },
	{ type: 'ellipse', labelKey: 'pptx.editorToolbar.shapeEllipse' },
	{ type: 'triangle', labelKey: 'pptx.editorToolbar.shapeTriangle' },
	{ type: 'diamond', labelKey: 'pptx.shapePresets.diamond' },
	{ type: 'pentagon', labelKey: 'pptx.shapePresets.pentagon' },
	{ type: 'hexagon', labelKey: 'pptx.shapePresets.hexagon' },
	{ type: 'star5', labelKey: 'pptx.ribbon.shapeStar5' },
	{ type: 'rtArrow', labelKey: 'pptx.shapePresets.arrow' },
	{ type: 'chevron', labelKey: 'pptx.shapePresets.chevron' },
	{ type: 'heart', labelKey: 'pptx.shapePresets.heart' },
	{ type: 'cloud', labelKey: 'pptx.shapePresets.cloud' },
];

const shapesMenu = useDropdown();
const arrangeMenu = useDropdown();

const selectedShapeStyle = computed<ShapeStyle | undefined>(() =>
	props.selectedElement && hasShapeProperties(props.selectedElement)
		? props.selectedElement.shapeStyle
		: undefined,
);

function handlePickShape(s: { type: SupportedShapeType }): void {
	props.onSetNewShapeType(s.type);
	props.onAddShape();
	shapesMenu.close();
}

function handleArrange(action: string, edge: boolean): void {
	if (edge) {
		props.onMoveLayerToEdge(action);
	} else {
		props.onMoveLayer(action);
	}
	arrangeMenu.close();
}

function handleFill(color: string, ref?: PptxThemeColorRef): void {
	props.onUpdateElementStyle?.(shapeFillChange(color, ref));
}

function handleOutline(color: string, ref?: PptxThemeColorRef): void {
	props.onUpdateElementStyle?.(shapeOutlineChange(color, ref));
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.drawing">
		<div class="flex items-center gap-1">
			<!-- Shapes dropdown -->
			<div :ref="shapesMenu.root" class="relative" data-ribbon-control="home.drawing.shapes">
				<button
					type="button"
					:disabled="!props.canEdit"
					:class="pill"
					:title="t('pptx.drawing.shapes')"
					@click="shapesMenu.toggle()"
				>
					<Shapes :class="ic" />
					{{ t('pptx.drawing.shapes') }}
				</button>
				<div
					v-if="shapesMenu.open.value"
					class="z-50 flex flex-col w-52 pt-1"
					v-anchored-popup="{ anchor: shapesMenu.root.value }"
				>
					<div :class="MENU_PANEL">
						<button
							v-for="s in TOP_SHAPES"
							:key="s.type"
							type="button"
							:class="cn(MENU_ITEM, props.newShapeType === s.type && 'bg-accent')"
							@click="handlePickShape(s)"
						>
							{{ t(s.labelKey) }}
						</button>
					</div>
				</div>
			</div>

			<!-- Arrange dropdown -->
			<div :ref="arrangeMenu.root" class="relative" data-ribbon-control="home.drawing.arrange">
				<button
					type="button"
					:disabled="!props.canEdit || !props.selectedElement"
					:class="pill"
					:title="t('pptx.ribbon.arrange')"
					@click="arrangeMenu.toggle()"
				>
					<Layers :class="ic" />
					{{ t('pptx.ribbon.arrange') }}
				</button>
				<div
					v-if="arrangeMenu.open.value"
					class="z-50 flex flex-col w-44 pt-1"
					v-anchored-popup="{ anchor: arrangeMenu.root.value }"
				>
					<div :class="MENU_PANEL">
						<button type="button" :class="MENU_ITEM" @click="handleArrange('forward', false)">
							{{ t('pptx.contextMenu.bringForward') }}
						</button>
						<button type="button" :class="MENU_ITEM" @click="handleArrange('backward', false)">
							{{ t('pptx.contextMenu.sendBackward') }}
						</button>
						<button type="button" :class="MENU_ITEM" @click="handleArrange('front', true)">
							{{ t('pptx.contextMenu.bringToFront') }}
						</button>
						<button type="button" :class="MENU_ITEM" @click="handleArrange('back', true)">
							{{ t('pptx.contextMenu.sendToBack') }}
						</button>
					</div>
				</div>
			</div>

			<!-- Shape Fill / Shape Outline -->
			<ShapeColorPopover
				data-ribbon-control="home.drawing.shapeFill"
				:disabled="!props.canEdit || !props.selectedElement"
				:icon="PaintBucket"
				title-key="pptx.drawing.shapeFill"
				swatch-aria-prefix="Fill colour"
				:selected-ref="selectedShapeStyle?.fillColorRef"
				:selected-hex="selectedShapeStyle?.fillColor"
				@pick="handleFill"
			/>
			<ShapeColorPopover
				data-ribbon-control="home.drawing.shapeOutline"
				:disabled="!props.canEdit || !props.selectedElement"
				:icon="PenLine"
				title-key="pptx.drawing.shapeOutline"
				swatch-aria-prefix="Outline colour"
				:selected-ref="selectedShapeStyle?.strokeColorRef"
				:selected-hex="selectedShapeStyle?.strokeColor"
				@pick="handleOutline"
			/>

			<!-- Quick Styles (Shape Styles) and Shape Effects galleries (shared descriptors) -->
			<RibbonGallery gallery="shapeStyles" control="home.drawing.quickStyles" mode="dropdown" />
			<RibbonGallery gallery="shapeEffects" control="home.drawing.shapeEffects" mode="dropdown" />
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.ribbon.groupDrawing')
		}}</span>
	</div>

	<div :class="SEP" />
</template>
