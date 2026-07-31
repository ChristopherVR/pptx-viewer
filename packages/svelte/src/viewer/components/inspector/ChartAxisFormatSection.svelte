<script lang="ts">
	/**
	 * ChartAxisFormatSection: per-axis number format and display units,
	 * mirroring the corresponding rows of React's `inspector/ChartAxisOptions.tsx`.
	 *
	 * These two were the last axis settings Svelte had no control for at all: the
	 * neighbouring `ChartLabelsAxesSection` covers scale, gridlines, orientation
	 * and title typography, but a deck whose value axis reads "1200000" could not
	 * be switched to "1.2" + a Millions label, and a currency/percent format code
	 * could not be typed in. Both round-trip through `c:numFmt` / `c:dispUnits`
	 * and both are honoured by the shared renderer (`chart-axis-render.ts`), so
	 * the only thing missing was the view layer.
	 *
	 * Kept out of `ChartLabelsAxesSection` deliberately: that file is untranslated
	 * legacy markup, while everything here resolves through the shared dictionary
	 * and the shared `chart-editor-options` catalogue, so the option list and the
	 * "only scaled axes take display units" rule cannot drift from React.
	 */
	import type { PptxChartAxisFormatting, PptxChartData } from 'pptx-viewer-core';
	import { DISPLAY_UNITS_OPTIONS, EDITABLE_AXIS_ROWS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		data,
		canEdit,
		onpatch,
	}: {
		data: PptxChartData;
		canEdit: boolean;
		onpatch: (patch: Partial<PptxChartData>) => void;
	} = $props();
	const t = useTranslator();

	/** Axes paired with the shared row metadata (label key + whether they scale). */
	const rows = $derived(
		(data.axes ?? []).map((axis, index) => ({
			axis,
			index,
			row: EDITABLE_AXIS_ROWS.find((candidate) => candidate.type === axis.axisType),
		})),
	);

	function axisPatch(index: number, next: Partial<PptxChartAxisFormatting>): void {
		onpatch({
			axes: (data.axes ?? []).map((axis, i) => (i === index ? { ...axis, ...next } : axis)),
		});
	}

	/**
	 * An empty box clears `c:numFmt` outright rather than saving an empty format
	 * code, which PowerPoint renders as a blank tick label.
	 */
	function setFormat(index: number, code: string): void {
		axisPatch(index, {
			numFmt: code ? { formatCode: code, sourceLinked: false } : undefined,
		});
	}
</script>

{#if rows.length > 0}
	<details class="pptx-svelte-chart-axis-format">
		<summary>{t('pptx.chart.axes')}</summary>
		{#each rows as { axis, index, row } (index)}
			<fieldset>
				<legend>{row ? t(row.labelKey) : axis.axisType}</legend>
				<label>
					{t('pptx.chart.numberFormat')}
					<input
						type="text"
						disabled={!canEdit}
						value={axis.numFmt?.formatCode ?? ''}
						onchange={(event) => setFormat(index, event.currentTarget.value)}
					/>
				</label>
				{#if row?.hasScale}
					<label>
						{t('pptx.chart.displayUnits')}
						<select
							disabled={!canEdit}
							value={axis.displayUnits ?? ''}
							onchange={(event) =>
								axisPatch(index, {
									displayUnits: (event.currentTarget.value ||
										undefined) as PptxChartAxisFormatting['displayUnits'],
								})}
						>
							{#each DISPLAY_UNITS_OPTIONS as option (option.value)}
								<option value={option.value}>{t(option.labelKey)}</option>
							{/each}
						</select>
					</label>
				{/if}
			</fieldset>
		{/each}
	</details>
{/if}

<style>
	details {
		margin-top: 8px;
		padding-top: 7px;
		border-top: 1px solid var(--pptx-border);
	}
	summary {
		cursor: pointer;
		font-weight: 600;
	}
	fieldset {
		display: grid;
		gap: 6px;
		margin: 6px 0;
		padding: 6px;
		border: 1px solid var(--pptx-border);
		border-radius: 6px;
	}
	label {
		display: grid;
		gap: 3px;
		color: var(--pptx-muted-foreground);
		font-size: 10px;
	}
	input,
	select {
		min-width: 0;
		height: 25px;
		border: 1px solid var(--pptx-border);
		border-radius: 5px;
		background: var(--pptx-background);
		color: inherit;
	}
</style>
