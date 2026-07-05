<script setup lang="ts">
import { Layers, PaintBucket, PenLine, Shapes, Sparkles } from 'lucide-vue-next';
/**
 * DrawingGroup: Drawing ribbon group with Shapes dropdown, Arrange layer
 * controls, Shape Fill/Outline colour popovers, and a Shape Effects placeholder.
 * Vue port of React's `toolbar/DrawingGroup.tsx`.
 */
import type { PptxElement } from 'pptx-viewer-core';

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
	onUpdateElementStyle?: (style: Record<string, unknown>) => void;
}

const props = defineProps<Props>();

const TOP_SHAPES: Array<{ type: SupportedShapeType; label: string }> = [
	{ type: 'rect', label: 'Rectangle' },
	{ type: 'roundRect', label: 'Rounded Rectangle' },
	{ type: 'ellipse', label: 'Ellipse' },
	{ type: 'triangle', label: 'Triangle' },
	{ type: 'diamond', label: 'Diamond' },
	{ type: 'pentagon', label: 'Pentagon' },
	{ type: 'hexagon', label: 'Hexagon' },
	{ type: 'star5', label: '5-Point Star' },
	{ type: 'rtArrow', label: 'Arrow' },
	{ type: 'chevron', label: 'Chevron' },
	{ type: 'heart', label: 'Heart' },
	{ type: 'cloud', label: 'Cloud' },
];

const FILL_COLORS = [
	'#ffffff',
	'#000000',
	'#ff0000',
	'#00ff00',
	'#0000ff',
	'#ffff00',
	'#ff00ff',
	'#00ffff',
	'#ff8800',
	'#8800ff',
	'#008888',
	'#888888',
];

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
	props.onUpdateElementStyle?.({ fill: color });
	fillMenu.close();
}

function handleOutline(color: string): void {
	props.onUpdateElementStyle?.({ outlineColor: color });
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
					title="Shapes"
					@click="shapesMenu.toggle()"
				>
					<Shapes :class="ic" />
					Shapes
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
							{{ s.label }}
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
					title="Arrange"
					@click="arrangeMenu.toggle()"
				>
					<Layers :class="ic" />
					Arrange
				</button>
				<div
					v-if="arrangeMenu.open.value"
					class="absolute left-0 top-full z-50 flex flex-col w-44 pt-1"
				>
					<div :class="MENU_PANEL">
						<button type="button" :class="MENU_ITEM" @click="handleArrange('forward', false)">
							Bring Forward
						</button>
						<button type="button" :class="MENU_ITEM" @click="handleArrange('backward', false)">
							Send Backward
						</button>
						<button type="button" :class="MENU_ITEM" @click="handleArrange('front', true)">
							Bring to Front
						</button>
						<button type="button" :class="MENU_ITEM" @click="handleArrange('back', true)">
							Send to Back
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
					title="Shape Fill"
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
							class="w-5 h-5 rounded border border-border/60 hover:scale-110 transition-transform"
							:style="{ backgroundColor: c }"
							:title="c"
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
					title="Shape Outline"
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
							class="w-5 h-5 rounded border border-border/60 hover:scale-110 transition-transform"
							:style="{ backgroundColor: c }"
							:title="c"
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
				title="Shape Effects (not available)"
			>
				<Sparkles :class="ic" />
			</button>
		</div>
		<span class="text-[9px] text-muted-foreground leading-none">Drawing</span>
	</div>

	<div :class="SEP" />
</template>
