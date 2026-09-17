<script lang="ts">
	/**
	 * ChartQuickActionsOverlay: PowerPoint's three floating quick-action icons
	 * ("Chart Elements" +, "Chart Styles" paintbrush, "Chart Filters" funnel)
	 * shown just outside a selected chart's top-right corner.
	 *
	 * Like `SelectionOverlay`/`ConnectorEndpointOverlay`, this layer is
	 * UNSCALED: it sits outside the CSS-scaled slide stage (mounted as a
	 * sibling of `EditorLayer` in `SlideOverlays.svelte`), so element geometry
	 * is multiplied by the stage scale ONCE, up front, when building the
	 * descriptor's `selectionBox`; every coordinate the shared function
	 * returns is then already correct screen px, and no further scaling is
	 * needed for the buttons/popovers.
	 *
	 * All decision-making (which buttons render, checklist/gallery/filter
	 * state) comes from the shared `buildChartQuickActionsDescriptor`; this
	 * component only renders three buttons plus whichever popover is open, and
	 * commits through `editor.applyElementPatch` (the same on-canvas commit
	 * path chart mark-drag and inline title editing already use). See the
	 * shared module's header for scope notes (Series-only Chart Filters, no
	 * trendline/error-bar/up-down-bars rows).
	 */
	import Filter from '@lucide/svelte/icons/filter';
	import Paintbrush from '@lucide/svelte/icons/paintbrush';
	import Plus from '@lucide/svelte/icons/plus';
	import type { ChartPptxElement, PptxElement } from 'pptx-viewer-core';
	import {
		applyChartElementToggle,
		applyChartStylePreset,
		buildChartQuickActionsDescriptor,
		CHART_QUICK_ACTION_BUTTON_SIZE,
		hideChartSeries,
		restoreFilteredSeries,
	} from 'pptx-viewer-shared';
	import type { ChartQuickElementKey } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';

	const {
		element,
		canEdit,
		scale,
		onupdateelement,
	}: {
		element: ChartPptxElement;
		canEdit: boolean;
		scale: number;
		onupdateelement: (elementId: string, updates: Partial<PptxElement>) => void;
	} = $props();

	const t = useTranslator();

	let open = $state<'elements' | 'styles' | 'filters' | null>(null);
	let hostEl = $state<HTMLElement | null>(null);

	const descriptor = $derived(
		buildChartQuickActionsDescriptor({
			isChartSelected: true,
			chartData: element.chartData,
			selectionBox: {
				x: element.x * scale,
				y: element.y * scale,
				width: element.width * scale,
				height: element.height * scale,
			},
		}),
	);

	function toggleOpen(id: 'elements' | 'styles' | 'filters'): void {
		open = open === id ? null : id;
	}

	function onOutsideClick(event: MouseEvent): void {
		if (open && hostEl && !hostEl.contains(event.target as Node)) {
			open = null;
		}
	}

	$effect(() => {
		document.addEventListener('mousedown', onOutsideClick);
		return () => document.removeEventListener('mousedown', onOutsideClick);
	});

	function commit(updates: Partial<PptxElement>): void {
		onupdateelement(element.id, updates);
	}

	function onElementToggle(key: ChartQuickElementKey, event: Event): void {
		const chartData = element.chartData;
		if (!chartData) {
			return;
		}
		const checked = (event.target as HTMLInputElement).checked;
		commit({ chartData: applyChartElementToggle(chartData, key, checked) });
	}

	function onStylePreset(presetId: string): void {
		const chartData = element.chartData;
		if (!chartData) {
			return;
		}
		const next = applyChartStylePreset(chartData, presetId);
		if (next) {
			commit({ chartData: next });
		}
	}

	function onFilterToggle(seriesIndex: number | undefined, filteredIndex: number | undefined): void {
		const chartData = element.chartData;
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

{#if descriptor}
	<div
		class="pptx-svelte-chart-quick-actions"
		data-pptx-chart-quick-actions
		role="presentation"
		bind:this={hostEl}
		onpointerdown={(event) => event.stopPropagation()}
		onmousedown={(event) => event.stopPropagation()}
	>
		{#each descriptor.buttons as button (button.id)}
			<button
				type="button"
				class="pptx-svelte-chart-quick-btn"
				disabled={!canEdit}
				data-testid={`chart-quick-action-${button.id}`}
				aria-label={t(button.labelKey)}
				title={t(button.labelKey)}
				style={`left:${button.x}px;top:${button.y}px;width:${button.size}px;height:${button.size}px`}
				onclick={() => toggleOpen(button.id)}
			>
				{#if button.id === 'elements'}
					<Plus size={14} />
				{:else if button.id === 'styles'}
					<Paintbrush size={14} />
				{:else}
					<Filter size={14} />
				{/if}
			</button>

			{#if open === button.id && button.id === 'elements'}
				<div
					class="pptx-svelte-chart-quick-card"
					data-testid="chart-quick-elements-popover"
					style={`left:${button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4}px;top:${button.y}px`}
				>
					<h5>{t('pptx.chart.quickElements')}</h5>
					{#each descriptor.elements as item (item.key)}
						<label class="row">
							<input
								type="checkbox"
								disabled={!canEdit}
								checked={item.checked}
								data-testid={`chart-quick-element-${item.key}`}
								onchange={(event) => onElementToggle(item.key, event)}
							/>
							<span>{t(item.labelKey)}</span>
						</label>
					{/each}
				</div>
			{/if}

			{#if open === button.id && button.id === 'styles'}
				<div
					class="pptx-svelte-chart-quick-card pptx-svelte-chart-quick-styles"
					data-testid="chart-quick-styles-popover"
					style={`left:${button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4}px;top:${button.y}px`}
				>
					{#each descriptor.styles.presets as preset (preset.id)}
						<button
							type="button"
							class="pptx-svelte-chart-quick-swatch"
							class:is-applied={preset.applied}
							disabled={!canEdit}
							data-testid={`chart-quick-style-${preset.id}`}
							aria-label={t(preset.labelKey)}
							aria-pressed={preset.applied}
							title={t(preset.labelKey)}
							onclick={() => onStylePreset(preset.id)}
						>
							<span class="swatch-row">
								{#each preset.colors.slice(0, 5) as c, i (i)}
									<span style={`background-color:${c}`}></span>
								{/each}
							</span>
						</button>
					{/each}
				</div>
			{/if}

			{#if open === button.id && button.id === 'filters'}
				<div
					class="pptx-svelte-chart-quick-card"
					data-testid="chart-quick-filters-popover"
					style={`left:${button.x + CHART_QUICK_ACTION_BUTTON_SIZE + 4}px;top:${button.y}px`}
				>
					<h5>{t('pptx.chart.quickFilters')}</h5>
					{#each descriptor.filters.series as row (row.key)}
						<label class="row">
							<input
								type="checkbox"
								disabled={!canEdit}
								checked={row.visible}
								data-testid={`chart-quick-filter-${row.key}`}
								onchange={() => onFilterToggle(row.seriesIndex, row.filteredIndex)}
							/>
							<span class="name">{row.name}</span>
						</label>
					{/each}
				</div>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-chart-quick-actions {
		position: absolute;
		inset: 0;
		pointer-events: none;
		z-index: 59;
	}

	.pptx-svelte-chart-quick-btn {
		position: absolute;
		display: flex;
		align-items: center;
		justify-content: center;
		pointer-events: auto;
		border-radius: 4px;
		border: 1px solid var(--pptx-border, #444);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-chart-quick-btn:hover {
		background: var(--pptx-accent, #3a3a5a);
	}

	.pptx-svelte-chart-quick-btn:disabled {
		opacity: 0.6;
		cursor: not-allowed;
	}

	.pptx-svelte-chart-quick-card {
		position: absolute;
		pointer-events: auto;
		z-index: 10;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
		min-width: 11rem;
		padding: 0.5rem;
		border-radius: 6px;
		border: 1px solid var(--pptx-border, #444);
		background: var(--pptx-muted, #2a2a3d);
		box-shadow: 0 4px 16px rgba(0, 0, 0, 0.35);
	}

	.pptx-svelte-chart-quick-card h5 {
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		margin: 0;
	}

	.pptx-svelte-chart-quick-card .row {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		font-size: 11px;
		cursor: pointer;
	}

	.pptx-svelte-chart-quick-card .name {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-chart-quick-styles {
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 0.35rem;
		min-width: 12rem;
	}

	.pptx-svelte-chart-quick-swatch {
		border-radius: 4px;
		overflow: hidden;
		border: 1px solid var(--pptx-border, #444);
		padding: 0;
		cursor: pointer;
	}

	.pptx-svelte-chart-quick-swatch.is-applied {
		border-color: var(--pptx-primary, #6a8dff);
		box-shadow: 0 0 0 1px var(--pptx-primary, #6a8dff);
	}

	.swatch-row {
		display: flex;
		height: 20px;
		width: 100%;
	}

	.swatch-row > span {
		flex: 1 1 auto;
	}
</style>
