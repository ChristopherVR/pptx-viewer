<script lang="ts">
	/**
	 * ChartMenu: Insert > Chart, a type picker beside an insert button, matching
	 * React's split control exactly (`InsertSection`: a `<select>` named "Chart
	 * type" plus a "Chart" button).
	 *
	 * It used to be a single select that inserted on change. That worked, but it
	 * meant the tab offered one control where every other binding offers two,
	 * and it made re-inserting the same chart type impossible without first
	 * picking a different one. Splitting the pending type from the commit fixes
	 * both. The chart itself comes from the shared `insert-chart.ts` catalogue,
	 * fully populated with default data.
	 */
	import type { CanvasSize, InsertChartKind } from 'pptx-viewer-shared';
	import { DEFAULT_INSERT_CHART_KIND, INSERT_CHART_TYPES } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildChartInsertElement } from '../../../editor';

	const { editor, canvasSize }: { editor: EditorState; canvasSize: CanvasSize } = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let chartKind = $state<InsertChartKind>(DEFAULT_INSERT_CHART_KIND);
</script>

<div class="pptx-svelte-insert-split">
	<select
		class="pptx-svelte-insert-select"
		disabled={!editor.editable}
		aria-label={t('pptx.ribbon.chartType')}
		title={t('pptx.ribbon.chartType')}
		value={chartKind}
		onchange={(event) => (chartKind = event.currentTarget.value as InsertChartKind)}
	>
		{#each INSERT_CHART_TYPES as ct (ct.id)}
			<option value={ct.id}>{t(ct.labelKey)}</option>
		{/each}
	</select>
	<button
		type="button"
		disabled={!editor.editable}
		title={t('pptx.ribbon.insertChart')}
		onclick={() => editor.insertElement(buildChartInsertElement(chartKind, canvasSize))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 2v12h12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /><rect x="4.5" y="7.5" width="2" height="4.5" fill="currentColor" /><rect x="7.75" y="5" width="2" height="7" fill="currentColor" /><rect x="11" y="9" width="2" height="3" fill="currentColor" /></svg>
		<span>{t('pptx.ribbon.chart')}</span>
	</button>
</div>

<style>
	.pptx-svelte-insert-split {
		display: inline-flex;
		align-items: stretch;
		overflow: hidden;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
	}

	.pptx-svelte-insert-select {
		height: 28px;
		max-width: 104px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		padding: 0 6px;
	}

	.pptx-svelte-insert-split button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-left: 1px solid var(--pptx-border, #33334d);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	.pptx-svelte-insert-split button:hover:not(:disabled),
	.pptx-svelte-insert-select:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-insert-split button:disabled,
	.pptx-svelte-insert-select:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-insert-split svg {
		width: 15px;
		height: 15px;
	}
</style>
