<script setup lang="ts">
/**
 * DrawingGroup: Drawing ribbon group with Shapes dropdown, Arrange layer
 * controls, Shape Fill/Outline colour popovers, and the Quick Styles / Shape
 * Effects galleries (built from the shared ribbon gallery descriptors). The four
 * trigger buttons are the shared `pptx-ui-ribbon-home-drawing` strip.
 * Vue port of React's `toolbar/DrawingGroup.tsx`.
 */
import type { PptxElement, PptxThemeColorRef, ShapeStyle } from 'pptx-viewer-core';
import { hasShapeProperties } from 'pptx-viewer-core';
import type { RibbonHomeRequestEvent } from 'pptx-viewer-shared';
import { drawingHomeControls, shapeFillChange, shapeOutlineChange } from 'pptx-viewer-shared';
import { computed, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { vAnchoredPopup } from './anchored-popup';
import { MENU_ITEM, MENU_PANEL, SEP } from './ribbon-constants';
import type { SupportedShapeType } from './ribbon-types';
import RibbonGallery from './RibbonGallery.vue';
import ShapeColorPopover from './ShapeColorPopover.vue';
import { useDropdown } from './use-dropdown';
import { useHomeHost } from './use-home-host';

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
const { t, locale } = useI18n();

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
const fillMenu = useDropdown();
const outlineMenu = useDropdown();
const menus = { shapes: shapesMenu, arrange: arrangeMenu, fill: fillMenu, outline: outlineMenu };
const { host, anchorOf } = useHomeHost();
/** Wrapper holding the shared triggers and their menus: the outside-click boundary. */
const root = ref<HTMLElement | null>(null);
onMounted(() => {
	for (const menu of Object.values(menus)) {
		menu.root.value = root.value;
	}
});

const state = computed(() => ({
	// The locale is read so a language switch re-translates the shared labels.
	locale: locale.value,
	controls: drawingHomeControls({
		editable: props.canEdit,
		hasSelection: Boolean(props.selectedElement),
		open: {
			shapes: shapesMenu.open.value,
			arrange: arrangeMenu.open.value,
			fill: fillMenu.open.value,
			outline: outlineMenu.open.value,
		},
	}),
	translate: t,
}));

const MENU_BY_ID = {
	'home.drawing.shapes': 'shapes',
	'home.drawing.arrange': 'arrange',
	'home.drawing.shapeFill': 'fill',
	'home.drawing.shapeOutline': 'outline',
} as const;

function request(event: RibbonHomeRequestEvent): void {
	const name = MENU_BY_ID[event.detail.id as keyof typeof MENU_BY_ID];
	if (!name) {
		return;
	}
	for (const [key, menu] of Object.entries(menus)) {
		if (key !== name) {
			menu.close();
		}
	}
	menus[name].toggle();
}

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

function handleFill(color: string, themeRef?: PptxThemeColorRef): void {
	props.onUpdateElementStyle?.(shapeFillChange(color, themeRef));
}

function handleOutline(color: string, themeRef?: PptxThemeColorRef): void {
	props.onUpdateElementStyle?.(shapeOutlineChange(color, themeRef));
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5" data-ribbon-group="home.drawing">
		<div class="flex items-center gap-1" data-pptx-chrome="drawing-controls">
			<div ref="root" class="contents">
				<pptx-ui-ribbon-home-drawing ref="host" :state.prop="state" @home-request="request" />
				<div
					v-if="shapesMenu.open.value"
					class="z-50 flex flex-col w-52 pt-1"
					v-anchored-popup="{ anchor: anchorOf('home.drawing.shapes') }"
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
				<div
					v-if="arrangeMenu.open.value"
					class="z-50 flex flex-col w-44 pt-1"
					v-anchored-popup="{ anchor: anchorOf('home.drawing.arrange') }"
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
				<ShapeColorPopover
					v-if="fillMenu.open.value"
					:anchor="anchorOf('home.drawing.shapeFill')"
					:disabled="!props.canEdit || !props.selectedElement"
					swatch-aria-prefix="Fill colour"
					:selected-ref="selectedShapeStyle?.fillColorRef"
					:selected-hex="selectedShapeStyle?.fillColor"
					@pick="handleFill"
					@close="fillMenu.close()"
				/>
				<ShapeColorPopover
					v-if="outlineMenu.open.value"
					:anchor="anchorOf('home.drawing.shapeOutline')"
					:disabled="!props.canEdit || !props.selectedElement"
					swatch-aria-prefix="Outline colour"
					:selected-ref="selectedShapeStyle?.strokeColorRef"
					:selected-hex="selectedShapeStyle?.strokeColor"
					@pick="handleOutline"
					@close="outlineMenu.close()"
				/>
			</div>

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
