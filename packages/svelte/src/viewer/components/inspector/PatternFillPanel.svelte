<script lang="ts">
	/**
	 * PatternFillPanel: the `a:pattFill` sub-panel (56-preset swatch grid +
	 * foreground/background colour pickers), built on the shared
	 * `PATTERN_PRESET_OPTIONS` catalogue and `getPatternSvg` preview renderer
	 * (`render/fill-pattern-label-keys.ts` / `render/fill-style.ts`). Rendered by
	 * `FillStrokeSection` only while the Pattern fill toggle is on, matching the
	 * scope of `GradientPanel`.
	 *
	 * Reuses the existing `pptx.table.patternPreset` / `patternForeground` /
	 * `patternBackground` i18n keys (the table-cell pattern picker's labels):
	 * there is no shape-scoped equivalent yet, and the English text is
	 * identical, so this avoids adding a new key while staying translated.
	 */
	import type { PptxElement, ShapeStyle } from 'pptx-viewer-core';
	import { hasShapeProperties } from 'pptx-viewer-core';
	import { getPatternSvg, PATTERN_PRESET_OPTIONS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();

	const style = $derived(hasShapeProperties(el) ? el.shapeStyle : undefined);
	const preset = $derived(style?.fillPatternPreset ?? 'pct20');
	const fgColor = $derived(/^#/.test(style?.fillColor ?? '') ? (style?.fillColor as string) : '#000000');
	const bgColor = $derived(
		/^#/.test(style?.fillPatternBackgroundColor ?? '') ? (style?.fillPatternBackgroundColor as string) : '#ffffff',
	);

	function patch(changes: Partial<ShapeStyle>): void {
		editor.patchSelected({
			shapeStyle: { ...style, fillMode: 'pattern', ...changes },
		} as Partial<PptxElement>);
	}
</script>

<div class="pptx-svelte-pattern">
	<span class="pptx-svelte-pattern-label">{t('pptx.table.patternPreset')}</span>
	<div class="pptx-svelte-pattern-grid" role="listbox" aria-label={t('pptx.table.patternPreset')}>
		{#each PATTERN_PRESET_OPTIONS as option (option.value)}
			{@const svg = getPatternSvg(option.value, fgColor, bgColor)}
			<button
				type="button"
				role="option"
				aria-selected={preset === option.value}
				class="pptx-svelte-pattern-swatch"
				class:pptx-svelte-pattern-swatch-on={preset === option.value}
				title={t(option.labelKey)}
				aria-label={t(option.labelKey)}
				onclick={() => patch({ fillPatternPreset: option.value })}
			>
				{#if svg}
					<span
						class="pptx-svelte-pattern-swatch-fill"
						style={`background-image:url('data:image/svg+xml;utf8,${encodeURIComponent(svg)}')`}
					></span>
				{/if}
			</button>
		{/each}
	</div>
	<label class="pptx-svelte-field">
		<span class="pptx-svelte-field-label">{t('pptx.table.patternForeground')}</span>
		<input
			type="color"
			value={fgColor}
			onchange={(e) => patch({ fillColor: e.currentTarget.value })}
		/>
	</label>
	<label class="pptx-svelte-field">
		<span class="pptx-svelte-field-label">{t('pptx.table.patternBackground')}</span>
		<input
			type="color"
			value={bgColor}
			onchange={(e) => patch({ fillPatternBackgroundColor: e.currentTarget.value })}
		/>
	</label>
</div>

<style>
	.pptx-svelte-pattern {
		display: flex;
		flex-direction: column;
		gap: 6px;
		margin-top: 10px;
	}

	.pptx-svelte-pattern-label {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-pattern-grid {
		display: grid;
		grid-template-columns: repeat(8, 1fr);
		gap: 4px;
		max-height: 160px;
		overflow-y: auto;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 6px;
	}

	.pptx-svelte-pattern-swatch {
		display: flex;
		width: 100%;
		aspect-ratio: 1;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: #fff;
		cursor: pointer;
	}

	.pptx-svelte-pattern-swatch-on {
		border-color: var(--pptx-primary, #6366f1);
		outline: 2px solid color-mix(in srgb, var(--pptx-primary, #6366f1) 30%, transparent);
	}

	.pptx-svelte-pattern-swatch-fill {
		width: 100%;
		height: 100%;
		border-radius: 3px;
		background-repeat: repeat;
		background-size: 8px 8px;
	}

	.pptx-svelte-field {
		display: flex;
		flex-direction: row;
		align-items: center;
		justify-content: space-between;
		gap: 6px;
	}

	.pptx-svelte-field-label {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-field input[type='color'] {
		width: 40px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}
</style>
