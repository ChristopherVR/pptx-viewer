<script lang="ts">
	/**
	 * ChartMenu: Insert > Chart, a native `<select>` listing every chart type
	 * the shared `insert-chart.ts` module supports. Selecting an entry inserts
	 * a fully-populated default chart immediately (no separate "insert" step),
	 * matching the Home tab's changeCase/characterSpacing select idiom.
	 */
	import type { PptxChartType } from 'pptx-viewer-core';
	import type { CanvasSize } from 'pptx-viewer-shared';
	import { INSERT_CHART_TYPES } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { buildChartInsertElement } from '../../../editor';

	const { editor, canvasSize }: { editor: EditorState; canvasSize: CanvasSize } = $props();
	const t = useTranslator();

	function onChange(event: Event): void {
		const select = event.currentTarget as HTMLSelectElement;
		const value = select.value;
		select.value = '';
		if (!value) {
			return;
		}
		editor.insertElement(buildChartInsertElement(value as PptxChartType, canvasSize));
	}
</script>

<select
	class="pptx-svelte-insert-select"
	disabled={!editor.editable}
	aria-label={t('pptx.ribbon.insertChart')}
	title={t('pptx.ribbon.insertChart')}
	value=""
	onchange={onChange}
>
	<option value="">{t('pptx.ribbon.chart')}</option>
	{#each INSERT_CHART_TYPES as ct (ct.type)}
		<option value={ct.type}>{ct.label}</option>
	{/each}
</select>

<style>
	.pptx-svelte-insert-select {
		height: 28px;
		max-width: 96px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		padding: 0 6px;
	}

	.pptx-svelte-insert-select:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-insert-select:disabled {
		opacity: 0.35;
		cursor: default;
	}
</style>
