<script setup lang="ts">
import { Plus, Trash2 } from 'lucide-vue-next';
import type { PptxChartSeries } from 'pptx-viewer-core';
import { getDenseGridLayoutPlan, getDensePanelTouchTargetPx } from 'pptx-viewer-shared';
import { computed, nextTick, ref, watch } from 'vue';
import { useI18n } from 'vue-i18n';

import { useIsMobile } from '../../composables/useIsMobile';

/**
 * ChartDataGrid: an editable spreadsheet-style grid of the chart's underlying
 * data. Mirrors React's `ChartDataGrid`. Categories run down the rows, series
 * across the columns; every cell is a numeric value. Series names and category
 * labels are editable in the header column/row, and series/categories can be
 * added or removed. A read-only summary line reports the current counts.
 *
 * All mutation is emitted upward; the parent routes it through `useChartEditing`
 * so the full new `chartData` is emitted via the panel's `update` contract.
 *
 * `highlightCell` is driven by the on-canvas chart part selection: a
 * `pointIndex` ring-highlights one value cell, series-only highlights the
 * series name header, and the highlighted cell is scrolled into view.
 */
const props = defineProps<{
	series: readonly PptxChartSeries[];
	categories: readonly string[];
	highlightCell?: { seriesIndex: number; pointIndex?: number } | null;
}>();

const emit = defineEmits<{
	updateSeries: [index: number, patch: Partial<PptxChartSeries>];
	updateCategoryLabel: [catIndex: number, value: string];
	updateValue: [seriesIndex: number, catIndex: number, raw: string];
	addSeries: [];
	removeSeries: [seriesIndex: number];
	addCategory: [];
	removeCategory: [catIndex: number];
}>();

const { t } = useI18n();

const summary = computed(
	() =>
		`${props.series.length} ${t('pptx.chart.series')} · ${props.categories.length} ${t('pptx.chart.categories')}`,
);

function onSeriesName(event: Event, index: number): void {
	emit('updateSeries', index, { name: (event.target as HTMLInputElement).value });
}

function onCategoryLabel(event: Event, catIndex: number): void {
	emit('updateCategoryLabel', catIndex, (event.target as HTMLInputElement).value);
}

function onValue(event: Event, seriesIndex: number, catIndex: number): void {
	emit('updateValue', seriesIndex, catIndex, (event.target as HTMLInputElement).value);
}

const CELL_INPUT =
	'pptx-vue-chart-cell w-full bg-muted border border-border rounded px-1 py-0.5 text-[11px]';
const BTN =
	'pptx-vue-chart-grid-btn inline-flex items-center justify-center px-1.5 py-0.5 rounded border border-border bg-muted hover:bg-accent text-[11px]';
const REMOVE_ICON_BTN =
	'text-muted-foreground hover:text-red-400 shrink-0 inline-flex items-center justify-center';

// ── Dense-panel responsive layout: sticky row-label column + touch targets
// below 768px, from the shared decision functions every binding uses (never
// hand-duplicate the thresholds/pixel values here - see CLAUDE.md Rule 2). ──
const { viewportWidth } = useIsMobile();
const gridPlan = computed(() => getDenseGridLayoutPlan(viewportWidth.value));
const touchTargetPx = computed(() => getDensePanelTouchTargetPx(viewportWidth.value));
const rowHeaderClass = computed(() =>
	gridPlan.value.stickyFirstColumn ? 'sticky left-0 z-10 bg-card' : '',
);
const cellMinWidthStyle = computed(() => ({ minWidth: `${gridPlan.value.minCellWidthPx}px` }));
const iconBtnStyle = computed(() => ({
	minWidth: `${touchTargetPx.value}px`,
	minHeight: `${touchTargetPx.value}px`,
}));

// ── On-canvas part selection highlight ────────────────────────────
const HIGHLIGHT_CLASS = 'pptx-vue-chart-cell-highlight ring-1 ring-primary';

function isSeriesHighlight(seriesIndex: number): boolean {
	return (
		props.highlightCell?.seriesIndex === seriesIndex && props.highlightCell.pointIndex === undefined
	);
}

function isValueHighlight(seriesIndex: number, catIndex: number): boolean {
	return (
		props.highlightCell?.seriesIndex === seriesIndex && props.highlightCell.pointIndex === catIndex
	);
}

const rootEl = ref<HTMLElement | null>(null);

// Bring the canvas-selected cell into view when the selection changes.
watch(
	() => [props.highlightCell?.seriesIndex, props.highlightCell?.pointIndex] as const,
	async ([seriesIndex]) => {
		if (seriesIndex === undefined) {
			return;
		}
		await nextTick();
		rootEl.value
			?.querySelector('.pptx-vue-chart-cell-highlight')
			?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
	},
);
</script>

<template>
	<div ref="rootEl" class="pptx-vue-chart-card rounded border border-border bg-card p-2 space-y-2">
		<div class="flex items-center justify-between">
			<div class="pptx-vue-chart-heading text-[11px] uppercase tracking-wide text-muted-foreground">
				{{ t('pptx.chart.data') }}
			</div>
			<div class="flex gap-1">
				<button
					type="button"
					:class="BTN"
					:style="iconBtnStyle"
					data-testid="chart-add-category"
					:title="t('pptx.chart.addCategory')"
					@click="emit('addCategory')"
				>
					<Plus class="inline w-3 h-3 mr-0.5" aria-hidden="true" />{{ t('pptx.chart.cat') }}
				</button>
				<button
					type="button"
					:class="BTN"
					:style="iconBtnStyle"
					data-testid="chart-add-series"
					:title="t('pptx.chart.addSeries')"
					@click="emit('addSeries')"
				>
					<Plus class="inline w-3 h-3 mr-0.5" aria-hidden="true" />{{ t('pptx.chart.seriesShort') }}
				</button>
			</div>
		</div>

		<div
			class="pptx-vue-chart-summary text-[11px] text-muted-foreground"
			data-testid="chart-data-summary"
		>
			{{ summary }}
		</div>

		<div class="overflow-x-auto">
			<table class="w-full text-[11px] border-collapse">
				<thead>
					<tr>
						<th
							:class="`text-muted-foreground p-0.5 text-left ${rowHeaderClass}`"
							:style="cellMinWidthStyle"
						></th>
						<th
							v-for="(s, si) in props.series"
							:key="`h-${s.name}-${si}`"
							class="p-0.5 font-normal"
							:style="cellMinWidthStyle"
						>
							<div class="flex items-center gap-0.5">
								<input
									type="text"
									:class="[CELL_INPUT, isSeriesHighlight(si) ? HIGHLIGHT_CLASS : '']"
									data-testid="chart-grid-series-name"
									:value="s.name"
									@input="onSeriesName($event, si)"
								/>
								<button
									v-if="props.series.length > 1"
									type="button"
									:class="REMOVE_ICON_BTN"
									:style="iconBtnStyle"
									data-testid="chart-remove-series"
									:title="t('pptx.chart.removeSeries')"
									@click="emit('removeSeries', si)"
								>
									<Trash2 class="w-3 h-3" aria-hidden="true" />
								</button>
							</div>
						</th>
					</tr>
				</thead>
				<tbody>
					<tr v-for="(cat, ci) in props.categories" :key="`r-${cat}-${ci}`">
						<td :class="`p-0.5 ${rowHeaderClass}`">
							<div class="flex items-center gap-0.5">
								<input
									type="text"
									:class="CELL_INPUT"
									data-testid="chart-grid-cat-label"
									:value="cat"
									@input="onCategoryLabel($event, ci)"
								/>
								<button
									v-if="props.categories.length > 1"
									type="button"
									:class="REMOVE_ICON_BTN"
									:style="iconBtnStyle"
									data-testid="chart-remove-category"
									:title="t('pptx.chart.removeCategory')"
									@click="emit('removeCategory', ci)"
								>
									<Trash2 class="w-3 h-3" aria-hidden="true" />
								</button>
							</div>
						</td>
						<td v-for="(s, si) in props.series" :key="`c-${si}-${ci}`" class="p-0.5">
							<input
								type="number"
								:class="[CELL_INPUT, isValueHighlight(si, ci) ? HIGHLIGHT_CLASS : '']"
								data-testid="chart-grid-value"
								:value="s.values[ci] ?? 0"
								@input="onValue($event, si, ci)"
							/>
						</td>
					</tr>
				</tbody>
			</table>
		</div>
	</div>
</template>
