<script setup lang="ts">
import {
	ChevronDown,
	Circle,
	Database,
	Diamond,
	Image,
	Layers,
	Minus,
	MoveRight,
	Plus,
	Square,
	Triangle,
	Type,
	Video,
} from 'lucide-vue-next';
/**
 * InsertSection: the Vue 3 port of React's `toolbar/InsertSection.tsx`. Renders
 * the Insert ribbon tab: Text box, the Shape-type `<select>` + Add-shape cluster,
 * Image / Media / Table / SmartArt / Equation pills, and the hover-driven Action
 * Button and Insert Field dropdowns plus the Date/Time picker modal. A faithful,
 * mechanical port for visual + behavioral parity: class strings are copied
 * verbatim and the date-picker's `useState`/`useEffect(mousedown)` plumbing
 * becomes local `ref`s with a backdrop-click + outside-click guard.
 *
 * The shape presets (lucide icon component refs, mirroring React's
 * `SHAPE_PRESETS`) are inlined here since the shared ribbon scaffold does not
 * export them. The OOXML action-button presets (`iconPath` SVG glyphs) come
 * from `pptx-viewer-shared` (`ACTION_BUTTON_PRESETS`), the single source of
 * truth shared with React. The Action / Field dropdowns stay pure CSS
 * `group-hover` (no state), exactly as React; only the Date/Time modal keeps
 * reactive state.
 */
import type { PptxChartType } from 'pptx-viewer-core';
import {
	ACTION_BUTTON_PRESETS,
	DEFAULT_INSERT_CHART_TYPE,
	INSERT_CHART_TYPES,
} from 'pptx-viewer-shared';
import { computed, ref } from 'vue';
import type { Component } from 'vue';

import { grp, ic, pill } from './ribbon-constants';
import type { SupportedShapeType } from './ribbon-types';

interface Props {
	canEdit: boolean;
	newShapeType: SupportedShapeType;
	onSetNewShapeType: (type: SupportedShapeType) => void;
	onAddTextBox: () => void;
	onAddShape: () => void;
	onAddTable: () => void;
	onAddChart?: (chartType: PptxChartType) => void;
	onAddSmartArt: () => void;
	onAddEquation: () => void;
	onAddActionButton: (shapeType: string) => void;
	onInsertField?: (fieldType: string, value?: string) => void;
	onOpenImagePicker: () => void;
	onOpenMediaPicker: () => void;
}

const props = defineProps<Props>();

const canEdit = computed(() => props.canEdit);

/** Shape presets with lucide icon component + className. Mirrors React's `SHAPE_PRESETS`. */
const SHAPE_PRESETS: Array<{
	type: SupportedShapeType;
	label: string;
	icon: Component;
	iconClass: string;
}> = [
	{ type: 'rect', label: 'Rectangle', icon: Square, iconClass: 'w-3.5 h-3.5' },
	{ type: 'roundRect', label: 'Rounded', icon: Square, iconClass: 'w-3.5 h-3.5' },
	{ type: 'ellipse', label: 'Circle', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'cylinder', label: 'Cylinder', icon: Database, iconClass: 'w-3.5 h-3.5' },
	{ type: 'rtArrow', label: 'Right Arrow', icon: MoveRight, iconClass: 'w-3.5 h-3.5' },
	{ type: 'leftArrow', label: 'Left Arrow', icon: MoveRight, iconClass: 'w-3.5 h-3.5 rotate-180' },
	{ type: 'upArrow', label: 'Up Arrow', icon: MoveRight, iconClass: 'w-3.5 h-3.5 -rotate-90' },
	{ type: 'downArrow', label: 'Down Arrow', icon: MoveRight, iconClass: 'w-3.5 h-3.5 rotate-90' },
	{ type: 'triangle', label: 'Triangle', icon: Triangle, iconClass: 'w-3.5 h-3.5' },
	{
		type: 'rtTriangle',
		label: 'Right Triangle',
		icon: Triangle,
		iconClass: 'w-3.5 h-3.5 rotate-90',
	},
	{ type: 'diamond', label: 'Diamond', icon: Diamond, iconClass: 'w-3.5 h-3.5' },
	{
		type: 'parallelogram',
		label: 'Parallelogram',
		icon: Square,
		iconClass: 'w-3.5 h-3.5 -skew-x-12',
	},
	{ type: 'trapezoid', label: 'Trapezoid', icon: Square, iconClass: 'w-3.5 h-3.5' },
	{ type: 'pentagon', label: 'Pentagon', icon: Diamond, iconClass: 'w-3.5 h-3.5' },
	{ type: 'hexagon', label: 'Hexagon', icon: Diamond, iconClass: 'w-3.5 h-3.5' },
	{ type: 'octagon', label: 'Octagon', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'chevron', label: 'Chevron', icon: MoveRight, iconClass: 'w-3.5 h-3.5' },
	{ type: 'star5', label: 'Star', icon: Diamond, iconClass: 'w-3.5 h-3.5 rotate-45' },
	{ type: 'star6', label: 'Star 6', icon: Diamond, iconClass: 'w-3.5 h-3.5' },
	{ type: 'star8', label: 'Star 8', icon: Diamond, iconClass: 'w-3.5 h-3.5 rotate-45' },
	{ type: 'plus', label: 'Plus', icon: Plus, iconClass: 'w-3.5 h-3.5' },
	{ type: 'heart', label: 'Heart', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'cloud', label: 'Cloud', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'sun', label: 'Sun', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'moon', label: 'Moon', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'pie', label: 'Pie', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'plaque', label: 'Plaque', icon: Square, iconClass: 'w-3.5 h-3.5' },
	{ type: 'teardrop', label: 'Teardrop', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'line', label: 'Line', icon: Minus, iconClass: 'w-3.5 h-3.5' },
	{ type: 'connector', label: 'Connector', icon: MoveRight, iconClass: 'w-3.5 h-3.5' },
];

/** The preset whose icon shows in the Add-shape button (the currently chosen type). */
const activeShapePreset = computed(() =>
	SHAPE_PRESETS.find((sp) => sp.type === props.newShapeType),
);

/** The chart type chosen in the insert dropdown (mirrors React's `newChartType`). */
const newChartType = ref<PptxChartType>(DEFAULT_INSERT_CHART_TYPE);
const chartTypes = INSERT_CHART_TYPES;

/* Date/Time picker modal state: React's local `useState` + outside-click. */
const datePickerOpen = ref(false);
const datePickerValue = ref('');
const dateFormat = ref('locale');
const datePickerRef = ref<HTMLElement | null>(null);

function openDatePicker(): void {
	const now = new Date();
	const pad = (n: number): string => String(n).padStart(2, '0');
	datePickerValue.value = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T${pad(now.getHours())}:${pad(now.getMinutes())}`;
	dateFormat.value = 'locale';
	datePickerOpen.value = true;
}

function confirmDatePicker(): void {
	if (!props.onInsertField) {
		return;
	}
	const d = new Date(datePickerValue.value);
	if (isNaN(d.getTime())) {
		return;
	}
	let formatted: string;
	switch (dateFormat.value) {
		case 'iso':
			formatted = d.toISOString().slice(0, 10);
			break;
		case 'long':
			formatted = d.toLocaleDateString(undefined, {
				weekday: 'long',
				year: 'numeric',
				month: 'long',
				day: 'numeric',
			});
			break;
		case 'short':
			formatted = d.toLocaleDateString(undefined, {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			});
			break;
		case 'time':
			formatted = d.toLocaleString();
			break;
		default:
			formatted = d.toLocaleDateString();
			break;
	}
	props.onInsertField('datetime', formatted);
	datePickerOpen.value = false;
}

function onBackdropMouseDown(e: MouseEvent): void {
	if (e.target === e.currentTarget) {
		datePickerOpen.value = false;
	}
}

/* Preview strings for the format `<select>` options (recomputed per render). */
function previewLocale(): string {
	return new Date(datePickerValue.value || Date.now()).toLocaleDateString();
}
function previewLong(): string {
	return new Date(datePickerValue.value || Date.now()).toLocaleDateString(undefined, {
		weekday: 'long',
		year: 'numeric',
		month: 'long',
		day: 'numeric',
	});
}
function previewShort(): string {
	return new Date(datePickerValue.value || Date.now()).toLocaleDateString(undefined, {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
	});
}
function previewIso(): string {
	return new Date(datePickerValue.value || Date.now()).toISOString().slice(0, 10);
}
function previewTime(): string {
	return new Date(datePickerValue.value || Date.now()).toLocaleString();
}
</script>

<template>
	<button :disabled="!canEdit" :class="pill" title="Add text box" @click="props.onAddTextBox()">
		<Type :class="ic" />
		Text
	</button>
	<div :class="grp">
		<select
			:value="props.newShapeType"
			class="bg-transparent py-1.5 pl-2 pr-1 outline-none text-xs"
			title="Shape type"
			@change="
				props.onSetNewShapeType(($event.target as HTMLSelectElement).value as SupportedShapeType)
			"
		>
			<option v-for="sp in SHAPE_PRESETS" :key="sp.type" :value="sp.type" class="bg-background">
				{{ sp.label }}
			</option>
		</select>
		<button
			:disabled="!canEdit"
			class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border-l border-border hover:bg-accent transition-colors text-xs"
			title="Add shape"
			@click="props.onAddShape()"
		>
			<component
				:is="activeShapePreset.icon"
				v-if="activeShapePreset"
				:class="activeShapePreset.iconClass"
			/>
			<Square v-else :class="ic" />
			Shape
		</button>
	</div>
	<button
		:disabled="!canEdit"
		:class="pill"
		title="Insert image"
		@click="props.onOpenImagePicker()"
	>
		<Image :class="ic" />
		Image
	</button>
	<button
		:disabled="!canEdit"
		:class="pill"
		title="Insert audio or video"
		@click="props.onOpenMediaPicker()"
	>
		<Video :class="ic" />
		Media
	</button>
	<button :disabled="!canEdit" :class="pill" title="Insert table" @click="props.onAddTable()">
		<Database :class="ic" />
		Table
	</button>
	<div v-if="props.onAddChart" :class="grp">
		<select
			:value="newChartType"
			class="bg-transparent py-1.5 pl-2 pr-1 outline-none text-xs"
			title="Chart type"
			@change="newChartType = ($event.target as HTMLSelectElement).value as PptxChartType"
		>
			<option v-for="ct in chartTypes" :key="ct.type" :value="ct.type" class="bg-background">
				{{ ct.label }}
			</option>
		</select>
		<button
			:disabled="!canEdit"
			class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border-l border-border hover:bg-accent transition-colors text-xs"
			title="Insert chart"
			@click="props.onAddChart(newChartType)"
		>
			<svg
				:class="ic"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M3 3v18h18" />
				<rect x="7" y="11" width="3" height="6" />
				<rect x="12" y="7" width="3" height="10" />
				<rect x="17" y="13" width="3" height="4" />
			</svg>
			Chart
		</button>
	</div>
	<button :disabled="!canEdit" :class="pill" title="Insert SmartArt" @click="props.onAddSmartArt()">
		<Layers :class="ic" />
		SmartArt
	</button>
	<button :disabled="!canEdit" :class="pill" title="Insert Equation" @click="props.onAddEquation()">
		<svg
			:class="ic"
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			stroke-width="2"
			stroke-linecap="round"
			stroke-linejoin="round"
		>
			<path d="M4 17h6M7 14v6M14 7l4.5 10M15.5 14h5" />
		</svg>
		Equation
	</button>
	<!-- Action Buttons dropdown -->
	<div class="relative group">
		<button type="button" :disabled="!canEdit" :class="pill" title="Insert action button">
			<svg
				:class="ic"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<path d="M13 7l4 5-4 5" />
			</svg>
			Action
			<ChevronDown class="w-3 h-3" />
		</button>
		<div class="absolute left-0 top-full z-50 hidden group-hover:flex flex-col w-40 pt-1">
			<div class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1">
				<button
					v-for="preset in ACTION_BUTTON_PRESETS"
					:key="preset.shapeType"
					type="button"
					:disabled="!canEdit"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="props.onAddActionButton(preset.shapeType)"
				>
					<svg
						class="w-4 h-4 flex-shrink-0"
						viewBox="0 0 24 24"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
					>
						<path :d="preset.iconPath" />
					</svg>
					{{ preset.label }}
				</button>
			</div>
		</div>
	</div>
	<!-- Insert Field dropdown -->
	<div v-if="props.onInsertField" class="relative group">
		<button type="button" :disabled="!canEdit" :class="pill" title="Insert Field">
			<svg
				:class="ic"
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<path d="M4 7h16M4 12h10M4 17h12" />
				<circle cx="19" cy="15" r="3" />
			</svg>
			Field
			<ChevronDown class="w-3 h-3" />
		</button>
		<div class="absolute left-0 top-full z-50 hidden group-hover:flex flex-col w-44 pt-1">
			<div class="rounded-lg border border-border bg-popover backdrop-blur-lg shadow-2xl py-1">
				<button
					type="button"
					:disabled="!canEdit"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="props.onInsertField('slidenum')"
				>
					Slide Number
				</button>
				<button
					type="button"
					:disabled="!canEdit"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="openDatePicker"
				>
					Date &amp; Time
				</button>
				<button
					type="button"
					:disabled="!canEdit"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="props.onInsertField('header')"
				>
					Header
				</button>
				<button
					type="button"
					:disabled="!canEdit"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="props.onInsertField('footer')"
				>
					Footer
				</button>
			</div>
		</div>
	</div>
	<!-- Date/Time picker popover -->
	<div
		v-if="datePickerOpen"
		ref="datePickerRef"
		class="fixed inset-0 z-[9999] flex items-center justify-center bg-black/30"
		@mousedown="onBackdropMouseDown"
	>
		<div class="rounded-lg border border-border bg-popover shadow-2xl p-4 w-72 space-y-3">
			<div class="text-sm font-medium text-foreground">Date &amp; Time</div>
			<input
				type="datetime-local"
				class="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
				:value="datePickerValue"
				@input="datePickerValue = ($event.target as HTMLInputElement).value"
			/>
			<div>
				<label class="block text-[11px] text-muted-foreground mb-1">Format</label>
				<select
					class="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
					:value="dateFormat"
					@change="dateFormat = ($event.target as HTMLSelectElement).value"
				>
					<option value="locale">{{ previewLocale() }}</option>
					<option value="long">{{ previewLong() }}</option>
					<option value="short">{{ previewShort() }}</option>
					<option value="iso">{{ previewIso() }}</option>
					<option value="time">{{ previewTime() }}</option>
				</select>
			</div>
			<div class="flex justify-end gap-2 pt-1">
				<button
					type="button"
					class="px-3 py-1.5 text-xs rounded border border-border text-foreground hover:bg-muted transition-colors"
					@click="datePickerOpen = false"
				>
					Cancel
				</button>
				<button
					type="button"
					class="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors"
					@click="confirmDatePicker"
				>
					Insert
				</button>
			</div>
		</div>
	</div>
</template>
