<script setup lang="ts">
import { Filter, Paintbrush, Plus } from 'lucide-vue-next';
/**
 * ChartQuickActionsOverlay: PowerPoint's three floating quick-action icons
 * ("Chart Elements" +, "Chart Styles" paintbrush, "Chart Filters" funnel)
 * shown just outside a selected chart's top-right corner. Mirrors React's
 * `ChartQuickActionsOverlay.tsx`; lives in the SAME scaled-stage coordinate
 * space as `SelectionOverlay` (mounted as its sibling in
 * `ViewerCanvasOverlays.vue`), reusing that overlay's `--pptx-vue-hs`
 * inverse-zoom CSS var so the buttons/popovers stay a constant screen size.
 *
 * All decision-making (which buttons render, checklist/gallery/filter state)
 * comes from the shared `buildChartQuickActionsDescriptor`; this component
 * only renders three buttons plus whichever popover is open, and calls the
 * shared mutation functions the descriptor's state was computed from
 * (`applyChartElementToggle`, `hideChartSeries`/`restoreFilteredSeries`,
 * `applyChartStylePreset`) through the existing `ChartCanvasEditContext`
 * (`updateElement`), the same commit path chart mark-drag and inline title
 * editing already use. See the shared module's header for scope notes
 * (Series-only Chart Filters, no trendline/error-bar/up-down-bars rows).
 */
import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
import {
	applyChartElementToggle,
	applyChartStylePreset,
	buildChartQuickActionsDescriptor,
	CHART_QUICK_ACTION_BUTTON_SIZE,
	hideChartSeries,
	restoreFilteredSeries,
} from 'pptx-viewer-shared';
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { injectChartCanvasEdit } from '../composables/chart-part-selection';

const props = defineProps<{
	element: ChartPptxElement;
	canEdit: boolean;
	/** Effective stage zoom, so the buttons/popovers can size to a constant screen px. */
	zoom: number;
}>();

const { t } = useI18n();
const editCtx = injectChartCanvasEdit();

type QuickActionId = 'elements' | 'styles' | 'filters';
const open = ref<QuickActionId | null>(null);
const hostEl = ref<HTMLElement | null>(null);

const ICONS: Record<QuickActionId, typeof Plus> = {
	elements: Plus,
	styles: Paintbrush,
	filters: Filter,
};

const descriptor = computed(() =>
	buildChartQuickActionsDescriptor({
		isChartSelected: true,
		chartData: props.element.chartData,
		selectionBox: {
			x: props.element.x,
			y: props.element.y,
			width: props.element.width,
			height: props.element.height,
		},
	}),
);

function commit(updates: Partial<PptxElement>): void {
	editCtx?.updateElement(props.element.id, updates);
}

function toggle(id: QuickActionId): void {
	open.value = open.value === id ? null : id;
}

function onOutsideClick(e: MouseEvent): void {
	if (open.value && hostEl.value && !hostEl.value.contains(e.target as Node)) {
		open.value = null;
	}
}

onMounted(() => document.addEventListener('mousedown', onOutsideClick));
onBeforeUnmount(() => document.removeEventListener('mousedown', onOutsideClick));

function onElementToggle(
	key: 'title' | 'legend' | 'gridlines' | 'dataLabels' | 'axes' | 'axisTitles',
	checked: boolean,
): void {
	const chartData = props.element.chartData;
	if (!chartData) {
		return;
	}
	commit({ chartData: applyChartElementToggle(chartData, key, checked) });
}

function onStylePreset(presetId: string): void {
	const chartData = props.element.chartData;
	if (!chartData) {
		return;
	}
	const next = applyChartStylePreset(chartData, presetId);
	if (next) {
		commit({ chartData: next });
	}
}

function onFilterToggle(seriesIndex: number | undefined, filteredIndex: number | undefined): void {
	const chartData = props.element.chartData;
	if (!chartData) {
		return;
	}
	const next =
		seriesIndex !== undefined
			? hideChartSeries(chartData, seriesIndex)
			: restoreFilteredSeries(chartData, filteredIndex!);
	if (next) {
		commit({ chartData: next });
	}
}
</script>

<template>
	<div
		v-if="descriptor"
		ref="hostEl"
		data-pptx-chart-quick-actions="true"
		data-export-ignore="true"
		data-testid="chart-quick-actions"
		style="position: absolute; left: 0; top: 0; z-index: 59"
		@pointerdown.stop
		@mousedown.stop
	>
		<template v-for="button in descriptor.buttons" :key="button.id">
			<button
				type="button"
				:disabled="!canEdit"
				:data-testid="`chart-quick-action-${button.id}`"
				:aria-label="t(button.labelKey)"
				:title="t(button.labelKey)"
				class="flex items-center justify-center rounded bg-popover border border-border shadow-sm hover:bg-accent text-foreground"
				:style="{
					position: 'absolute',
					left: `${button.x}px`,
					top: `${button.y}px`,
					width: `${button.size}px`,
					height: `${button.size}px`,
					scale: 'var(--pptx-vue-hs, 1)',
					transformOrigin: 'top left',
				}"
				@click="toggle(button.id)"
			>
				<component :is="ICONS[button.id]" class="size-3.5" />
			</button>

			<div
				v-if="open === button.id && button.id === 'elements'"
				data-testid="chart-quick-elements-popover"
				class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2 w-44 z-10 shadow-lg"
				:style="{
					position: 'absolute',
					left: `${button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4}px`,
					top: `${button.y}px`,
					scale: 'var(--pptx-vue-hs, 1)',
					transformOrigin: 'top left',
				}"
			>
				<div
					class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground"
				>
					{{ t('pptx.chart.quickElements') }}
				</div>
				<label
					v-for="item in descriptor.elements"
					:key="item.key"
					class="flex items-center gap-2 cursor-pointer"
				>
					<input
						type="checkbox"
						:disabled="!canEdit"
						:checked="item.checked"
						:data-testid="`chart-quick-element-${item.key}`"
						class="accent-primary"
						@change="onElementToggle(item.key, ($event.target as HTMLInputElement).checked)"
					/>
					<span class="text-[11px]">{{ t(item.labelKey) }}</span>
				</label>
			</div>

			<div
				v-if="open === button.id && button.id === 'styles'"
				data-testid="chart-quick-styles-popover"
				class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2 w-48 z-10 shadow-lg grid grid-cols-3 gap-1.5"
				:style="{
					position: 'absolute',
					left: `${button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4}px`,
					top: `${button.y}px`,
					scale: 'var(--pptx-vue-hs, 1)',
					transformOrigin: 'top left',
				}"
			>
				<button
					v-for="preset in descriptor.styles.presets"
					:key="preset.id"
					type="button"
					:disabled="!canEdit"
					:data-testid="`chart-quick-style-${preset.id}`"
					:aria-label="t(preset.labelKey)"
					:aria-pressed="preset.applied"
					:title="t(preset.labelKey)"
					class="flex flex-col rounded overflow-hidden border"
					:class="preset.applied ? 'border-primary ring-1 ring-primary' : 'border-border'"
					@click="onStylePreset(preset.id)"
				>
					<span class="flex h-5 w-full">
						<span
							v-for="(c, i) in preset.colors.slice(0, 5)"
							:key="i"
							class="flex-1"
							:style="{ backgroundColor: c }"
						/>
					</span>
				</button>
			</div>

			<div
				v-if="open === button.id && button.id === 'filters'"
				data-testid="chart-quick-filters-popover"
				class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2 w-48 z-10 shadow-lg"
				:style="{
					position: 'absolute',
					left: `${button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4}px`,
					top: `${button.y}px`,
					scale: 'var(--pptx-vue-hs, 1)',
					transformOrigin: 'top left',
				}"
			>
				<div
					class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground"
				>
					{{ t('pptx.chart.quickFilters') }}
				</div>
				<label
					v-for="row in descriptor.filters.series"
					:key="row.key"
					class="flex items-center gap-2 cursor-pointer"
				>
					<input
						type="checkbox"
						:disabled="!canEdit"
						:checked="row.visible"
						:data-testid="`chart-quick-filter-${row.key}`"
						class="accent-primary"
						@change="onFilterToggle(row.seriesIndex, row.filteredIndex)"
					/>
					<span class="text-[11px] truncate">{{ row.name }}</span>
				</label>
			</div>
		</template>
	</div>
</template>
