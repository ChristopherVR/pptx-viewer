<script setup lang="ts">
import { Layers, PaintBucket, PenLine, Shapes, Sparkles } from 'lucide-vue-next';
/**
 * DrawingGroup: Drawing ribbon group with Shapes dropdown, Arrange layer
 * controls, Shape Fill/Outline colour popovers, and a Shape Effects placeholder.
 * Vue port of React's `toolbar/DrawingGroup.tsx`.
 */
import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { RIBBON_SHAPE_SWATCHES, shapeFillChange, shapeOutlineChange } from 'pptx-viewer-shared';
import { useI18n } from 'vue-i18n';

import { cn } from '../../../utils';
import { ic, MENU_ITEM, MENU_PANEL, pill, SEP } from './ribbon-constants';
import type { SupportedShapeType } from './ribbon-types';
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

const FILL_COLORS = RIBBON_SHAPE_SWATCHES;

const shapesMenu = useDropdown();
const arrangeMenu = useDropdown();
const fillMenu = useDropdown();
const outlineMenu = useDropdown();

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

function handleFill(color: string): void {
	props.onUpdateElementStyle?.(shapeFillChange(color));
	fillMenu.close();
}

function handleOutline(color: string): void {
	props.onUpdateElementStyle?.(shapeOutlineChange(color));
	outlineMenu.close();
}
</script>

<template>
	<div class="flex flex-col items-center gap-0.5">
		<div class="flex items-center gap-1">
			<!-- Shapes dropdown -->
			<div :ref="shapesMenu.root" class="relative">
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
					class="absolute left-0 top-full z-50 flex flex-col w-52 pt-1"
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
			<div :ref="arrangeMenu.root" class="relative">
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
					class="absolute left-0 top-full z-50 flex flex-col w-44 pt-1"
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

			<!-- Shape Fill -->
			<div :ref="fillMenu.root" class="relative">
				<button
					type="button"
					:disabled="!props.canEdit || !props.selectedElement"
					:class="pill"
					:title="t('pptx.drawing.shapeFill')"
					@click="fillMenu.toggle()"
				>
					<PaintBucket :class="ic" />
				</button>
				<div v-if="fillMenu.open.value" class="absolute left-0 top-full z-50 pt-1">
					<div
						class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 grid grid-cols-6 gap-1"
					>
						<button
							v-for="c in FILL_COLORS"
							:key="c"
							type="button"
							:aria-label="`Fill colour ${c}`"
							class="w-5 h-5 rounded border border-border/60 hover:scale-110 transition-transform"
							data-pptx-compact
							:style="{ backgroundColor: c }"
							:title="c"
							@mousedown.prevent
							@click="handleFill(c)"
						/>
					</div>
				</div>
			</div>

			<!-- Shape Outline -->
			<div :ref="outlineMenu.root" class="relative">
				<button
					type="button"
					:disabled="!props.canEdit || !props.selectedElement"
					:class="pill"
					:title="t('pptx.drawing.shapeOutline')"
					@click="outlineMenu.toggle()"
				>
					<PenLine :class="ic" />
				</button>
				<div v-if="outlineMenu.open.value" class="absolute left-0 top-full z-50 pt-1">
					<div
						class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl p-2 grid grid-cols-6 gap-1"
					>
						<button
							v-for="c in FILL_COLORS"
							:key="c"
							type="button"
							:aria-label="`Outline colour ${c}`"
							class="w-5 h-5 rounded border border-border/60 hover:scale-110 transition-transform"
							data-pptx-compact
							:style="{ backgroundColor: c }"
							:title="c"
							@mousedown.prevent
							@click="handleOutline(c)"
						/>
					</div>
				</div>
			</div>

			<!-- Shape Effects (placeholder) -->
			<button
				type="button"
				disabled
				:class="cn(pill, 'opacity-50 cursor-not-allowed')"
				:title="t('pptx.drawing.shapeEffectsUnavailable')"
			>
				<Sparkles :class="ic" />
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">{{
			t('pptx.ribbon.groupDrawing')
		}}</span>
	</div>

	<div :class="SEP" />
</template>
