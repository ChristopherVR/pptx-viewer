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
import { useI18n } from 'vue-i18n';

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

const { t } = useI18n();

const canEdit = computed(() => props.canEdit);

/** Shape presets with lucide icon component + className. Mirrors React's `SHAPE_PRESETS`. */
const SHAPE_PRESETS: Array<{
	type: SupportedShapeType;
	labelKey: string;
	icon: Component;
	iconClass: string;
}> = [
	{
		type: 'rect',
		labelKey: 'pptx.editorToolbar.shapeRectangle',
		icon: Square,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'roundRect',
		labelKey: 'pptx.shapePresets.rounded',
		icon: Square,
		iconClass: 'w-3.5 h-3.5',
	},
	{ type: 'ellipse', labelKey: 'pptx.shapePresets.circle', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{
		type: 'cylinder',
		labelKey: 'pptx.shapePresets.cylinder',
		icon: Database,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'rtArrow',
		labelKey: 'pptx.shapePresets.rightArrow',
		icon: MoveRight,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'leftArrow',
		labelKey: 'pptx.shapePresets.leftArrow',
		icon: MoveRight,
		iconClass: 'w-3.5 h-3.5 rotate-180',
	},
	{
		type: 'upArrow',
		labelKey: 'pptx.shapePresets.upArrow',
		icon: MoveRight,
		iconClass: 'w-3.5 h-3.5 -rotate-90',
	},
	{
		type: 'downArrow',
		labelKey: 'pptx.shapePresets.downArrow',
		icon: MoveRight,
		iconClass: 'w-3.5 h-3.5 rotate-90',
	},
	{
		type: 'triangle',
		labelKey: 'pptx.editorToolbar.shapeTriangle',
		icon: Triangle,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'rtTriangle',
		labelKey: 'pptx.shapePresets.rightTriangle',
		icon: Triangle,
		iconClass: 'w-3.5 h-3.5 rotate-90',
	},
	{
		type: 'diamond',
		labelKey: 'pptx.shapePresets.diamond',
		icon: Diamond,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'parallelogram',
		labelKey: 'pptx.shapePresets.parallelogram',
		icon: Square,
		iconClass: 'w-3.5 h-3.5 -skew-x-12',
	},
	{
		type: 'trapezoid',
		labelKey: 'pptx.shapePresets.trapezoid',
		icon: Square,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'pentagon',
		labelKey: 'pptx.shapePresets.pentagon',
		icon: Diamond,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'hexagon',
		labelKey: 'pptx.shapePresets.hexagon',
		icon: Diamond,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'octagon',
		labelKey: 'pptx.shapePresets.octagon',
		icon: Circle,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'chevron',
		labelKey: 'pptx.shapePresets.chevron',
		icon: MoveRight,
		iconClass: 'w-3.5 h-3.5',
	},
	{
		type: 'star5',
		labelKey: 'pptx.shapePresets.star',
		icon: Diamond,
		iconClass: 'w-3.5 h-3.5 rotate-45',
	},
	{ type: 'star6', labelKey: 'pptx.shapePresets.star6', icon: Diamond, iconClass: 'w-3.5 h-3.5' },
	{
		type: 'star8',
		labelKey: 'pptx.shapePresets.star8',
		icon: Diamond,
		iconClass: 'w-3.5 h-3.5 rotate-45',
	},
	{ type: 'plus', labelKey: 'pptx.shapePresets.plus', icon: Plus, iconClass: 'w-3.5 h-3.5' },
	{ type: 'heart', labelKey: 'pptx.shapePresets.heart', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'cloud', labelKey: 'pptx.shapePresets.cloud', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'sun', labelKey: 'pptx.shapePresets.sun', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'moon', labelKey: 'pptx.shapePresets.moon', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'pie', labelKey: 'pptx.shapePresets.pie', icon: Circle, iconClass: 'w-3.5 h-3.5' },
	{ type: 'plaque', labelKey: 'pptx.shapePresets.plaque', icon: Square, iconClass: 'w-3.5 h-3.5' },
	{
		type: 'teardrop',
		labelKey: 'pptx.shapePresets.teardrop',
		icon: Circle,
		iconClass: 'w-3.5 h-3.5',
	},
	{ type: 'line', labelKey: 'pptx.ribbon.line', icon: Minus, iconClass: 'w-3.5 h-3.5' },
	{
		type: 'connector',
		labelKey: 'pptx.elementType.connector',
		icon: MoveRight,
		iconClass: 'w-3.5 h-3.5',
	},
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
	<button
		:disabled="!canEdit"
		:class="pill"
		:title="t('pptx.insert.addTextBox')"
		@click="props.onAddTextBox()"
	>
		<Type :class="ic" />
		{{ t('pptx.ribbon.text') }}
	</button>
	<div :class="grp">
		<select
			:value="props.newShapeType"
			class="bg-transparent py-1.5 pl-2 pr-1 outline-none text-xs"
			:title="t('pptx.insert.shapeType')"
			@change="
				props.onSetNewShapeType(($event.target as HTMLSelectElement).value as SupportedShapeType)
			"
		>
			<option v-for="sp in SHAPE_PRESETS" :key="sp.type" :value="sp.type" class="bg-background">
				{{ t(sp.labelKey) }}
			</option>
		</select>
		<button
			:disabled="!canEdit"
			class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border-l border-border hover:bg-accent transition-colors text-xs"
			:title="t('pptx.insert.addShape')"
			@click="props.onAddShape()"
		>
			<component
				:is="activeShapePreset.icon"
				v-if="activeShapePreset"
				:class="activeShapePreset.iconClass"
			/>
			<Square v-else :class="ic" />
			{{ t('pptx.insert.shape') }}
		</button>
	</div>
	<button
		:disabled="!canEdit"
		:class="pill"
		:title="t('pptx.ribbon.insertImage')"
		@click="props.onOpenImagePicker()"
	>
		<Image :class="ic" />
		{{ t('pptx.ribbon.image') }}
	</button>
	<button
		:disabled="!canEdit"
		:class="pill"
		:title="t('pptx.ribbon.insertMedia')"
		@click="props.onOpenMediaPicker()"
	>
		<Video :class="ic" />
		{{ t('pptx.ribbon.media') }}
	</button>
	<button
		:disabled="!canEdit"
		:class="pill"
		:title="t('pptx.insert.insertTable')"
		@click="props.onAddTable()"
	>
		<Database :class="ic" />
		{{ t('pptx.ribbon.table') }}
	</button>
	<div v-if="props.onAddChart" :class="grp">
		<select
			:value="newChartType"
			class="bg-transparent py-1.5 pl-2 pr-1 outline-none text-xs"
			:title="t('pptx.ribbon.chartType')"
			@change="newChartType = ($event.target as HTMLSelectElement).value as PptxChartType"
		>
			<option v-for="ct in chartTypes" :key="ct.type" :value="ct.type" class="bg-background">
				{{ ct.label }}
			</option>
		</select>
		<button
			:disabled="!canEdit"
			class="inline-flex items-center gap-1.5 px-2.5 py-1.5 border-l border-border hover:bg-accent transition-colors text-xs"
			:title="t('pptx.ribbon.insertChart')"
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
			{{ t('pptx.ribbon.chart') }}
		</button>
	</div>
	<button
		:disabled="!canEdit"
		:class="pill"
		:title="t('pptx.insert.insertSmartArt')"
		@click="props.onAddSmartArt()"
	>
		<Layers :class="ic" />
		{{ t('pptx.ribbon.smartArt') }}
	</button>
	<button
		:disabled="!canEdit"
		:class="pill"
		:title="t('pptx.insert.insertEquation')"
		@click="props.onAddEquation()"
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
			<path d="M4 17h6M7 14v6M14 7l4.5 10M15.5 14h5" />
		</svg>
		{{ t('pptx.ribbon.equation') }}
	</button>
	<!-- Action Buttons dropdown -->
	<div class="relative group">
		<button
			type="button"
			:disabled="!canEdit"
			:class="pill"
			:title="t('pptx.ribbon.insertActionButton')"
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
				<rect x="3" y="3" width="18" height="18" rx="2" />
				<path d="M13 7l4 5-4 5" />
			</svg>
			{{ t('pptx.ribbon.action') }}
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
		<button type="button" :disabled="!canEdit" :class="pill" :title="t('pptx.field.insertField')">
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
			{{ t('pptx.field.field') }}
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
					{{ t('pptx.field.slideNumber') }}
				</button>
				<button
					type="button"
					:disabled="!canEdit"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="openDatePicker"
				>
					{{ t('pptx.field.dateTime') }}
				</button>
				<button
					type="button"
					:disabled="!canEdit"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="props.onInsertField('header')"
				>
					{{ t('pptx.field.header') }}
				</button>
				<button
					type="button"
					:disabled="!canEdit"
					class="flex items-center gap-2 w-full px-3 py-1.5 text-xs text-foreground hover:bg-muted transition-colors"
					@click="props.onInsertField('footer')"
				>
					{{ t('pptx.field.footer') }}
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
			<div class="text-sm font-medium text-foreground">{{ t('pptx.field.dateTime') }}</div>
			<input
				type="datetime-local"
				class="w-full rounded border border-border bg-muted px-2.5 py-1.5 text-xs text-foreground focus:border-primary focus:ring-1 focus:ring-primary outline-none"
				:value="datePickerValue"
				@input="datePickerValue = ($event.target as HTMLInputElement).value"
			/>
			<div>
				<label class="block text-[11px] text-muted-foreground mb-1">{{
					t('pptx.field.format', 'Format')
				}}</label>
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
					{{ t('pptx.common.cancel', 'Cancel') }}
				</button>
				<button
					type="button"
					class="px-3 py-1.5 text-xs rounded bg-primary text-white hover:bg-primary/90 transition-colors"
					@click="confirmDatePicker"
				>
					{{ t('pptx.common.insert', 'Insert') }}
				</button>
			</div>
		</div>
	</div>
</template>
