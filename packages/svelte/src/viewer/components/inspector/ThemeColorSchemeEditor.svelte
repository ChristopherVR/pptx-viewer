<script lang="ts">
	/**
	 * ThemeColorSchemeEditor: the twelve theme-colour swatches, the picker that
	 * opens under the selected one, and the tint/shade preview grid (mirrors
	 * React's component of the same name). Split out of `ThemeEditorPanel` to
	 * keep that file within the repo's file-size budget.
	 *
	 * The labels and the preview-grid tint/shade maths are framework-agnostic
	 * and come from `pptx-viewer-shared`; this file is only the view.
	 */
	import type { PptxThemeColorScheme } from 'pptx-viewer-core';
	import { THEME_COLOR_SCHEME_KEYS } from 'pptx-viewer-core';
	import { buildThemeColorGrid, themeColorLabel } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { ThemeEditorState } from './theme-editor-state.svelte';

	const { state, canEdit }: { state: ThemeEditorState; canEdit: boolean } = $props();
	const t = useTranslator();

	// Slot captions and the grid's row/column labels reach the DOM as tooltips
	// and aria-labels, so they resolve through the shared `pptx.themeColor.*`
	// keys rather than the module's English fallbacks.
	const slotLabel = (key: keyof PptxThemeColorScheme): string => themeColorLabel(key, t);

	const previewGrid = $derived(buildThemeColorGrid(state.colors, t));
	const activeKey = $derived(state.activePickerKey);

	function togglePicker(key: keyof PptxThemeColorScheme): void {
		state.activePickerKey = state.activePickerKey === key ? null : key;
	}
</script>

<div class="pptx-svelte-theme-block">
	<span class="pptx-svelte-theme-heading">{t('pptx.themeEditor.colorScheme')}</span>
	<div class="pptx-svelte-theme-swatches">
		{#each THEME_COLOR_SCHEME_KEYS as key (key)}
			<div class="pptx-svelte-theme-swatch">
				<button
					type="button"
					disabled={!canEdit}
					title={`${slotLabel(key)}: ${state.colors[key]}`}
					aria-label={`${slotLabel(key)}: ${state.colors[key]}`}
					aria-pressed={activeKey === key}
					class:pptx-svelte-theme-swatch-active={activeKey === key}
					style={`background:${state.colors[key]}`}
					onclick={() => togglePicker(key)}
				></button>
				<small>{slotLabel(key)}</small>
			</div>
		{/each}
	</div>
	{#if activeKey}
		<div class="pptx-svelte-theme-picker">
			<span>{slotLabel(activeKey)}</span>
			<input
				type="color"
				disabled={!canEdit}
				aria-label={slotLabel(activeKey)}
				value={state.colors[activeKey]}
				oninput={(event) => state.setColor(activeKey, event.currentTarget.value)}
			/>
			<input
				type="text"
				disabled={!canEdit}
				aria-label={`${slotLabel(activeKey)} hex`}
				value={state.colors[activeKey]}
				onchange={(event) => state.setColorText(event.currentTarget.value)}
			/>
		</div>
	{/if}
</div>

{#if previewGrid}
	<div class="pptx-svelte-theme-block">
		<span class="pptx-svelte-theme-heading">{t('pptx.themeEditor.preview')}</span>
		<div class="pptx-svelte-theme-preview">
			{#each previewGrid as row, rowIndex (rowIndex)}
				<div>
					{#each row as cell (cell.schemeKey)}
						<span
							style={`background:${cell.hex}`}
							title={`${cell.colLabel} - ${cell.rowLabel} (${cell.hex})`}
						></span>
					{/each}
				</div>
			{/each}
		</div>
	</div>
{/if}

<style>
	.pptx-svelte-theme-block {
		display: grid;
		gap: 5px;
	}

	.pptx-svelte-theme-heading {
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
		font-weight: 600;
		text-transform: uppercase;
	}

	input {
		min-width: 0;
		height: 25px;
		box-sizing: border-box;
		padding: 0 5px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
	}

	.pptx-svelte-theme-swatches {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		gap: 5px;
	}

	.pptx-svelte-theme-swatch {
		display: grid;
		gap: 2px;
		justify-items: center;
	}

	.pptx-svelte-theme-swatch button {
		width: 100%;
		height: 24px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 3px;
		cursor: pointer;
	}

	.pptx-svelte-theme-swatch-active {
		outline: 1px solid var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-theme-swatch small {
		width: 100%;
		overflow: hidden;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 9px;
		text-align: center;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-theme-picker {
		display: grid;
		grid-template-columns: auto 32px 1fr;
		gap: 6px;
		align-items: center;
		padding: 5px;
		border-radius: 5px;
		background: var(--pptx-background, #11111b);
		font-size: 10px;
	}

	.pptx-svelte-theme-picker input[type='color'] {
		height: 22px;
		padding: 0;
		border: none;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-theme-preview {
		display: grid;
		gap: 1px;
	}

	.pptx-svelte-theme-preview > div {
		display: grid;
		grid-template-columns: repeat(12, 1fr);
		gap: 1px;
	}

	.pptx-svelte-theme-preview span {
		height: 13px;
		border-radius: 2px;
	}

	button:disabled,
	input:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
</style>
