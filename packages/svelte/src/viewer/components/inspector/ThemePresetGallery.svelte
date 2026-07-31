<script lang="ts">
	/**
	 * ThemePresetGallery: the theme editor's built-in preset picker (mirrors
	 * React's component of the same name). Split out of `ThemeEditorPanel` to
	 * keep that file within the repo's file-size budget.
	 *
	 * The catalogue itself (`PRESET_THEMES`) is framework-agnostic and lives in
	 * `pptx-viewer-shared`; this file is only the swatch-strip view.
	 */
	import { PRESET_THEMES } from 'pptx-viewer-shared';
	import type { PresetTheme } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';

	const {
		activeName,
		canEdit,
		onselect,
	}: {
		/** The working copy's theme name; a preset shows as pressed when it matches. */
		activeName: string;
		canEdit: boolean;
		onselect: (preset: PresetTheme) => void;
	} = $props();
	const t = useTranslator();

	/** The six accents shown in each preset's strip, in theme order. */
	const STRIP_KEYS = ['accent1', 'accent2', 'accent3', 'accent4', 'accent5', 'accent6'] as const;
</script>

<div class="pptx-svelte-theme-block">
	<span class="pptx-svelte-theme-heading">{t('pptx.themeEditor.presetThemes')}</span>
	<div class="pptx-svelte-theme-presets">
		{#each PRESET_THEMES as preset (preset.name)}
			<button
				type="button"
				disabled={!canEdit}
				title={preset.name}
				aria-label={preset.name}
				aria-pressed={activeName === preset.name}
				class:pptx-svelte-theme-preset-active={activeName === preset.name}
				onclick={() => onselect(preset)}
			>
				<span class="pptx-svelte-theme-preset-strip">
					{#each STRIP_KEYS as key (key)}
						<span style={`background:${preset.colorScheme[key]}`}></span>
					{/each}
				</span>
				<small>{preset.name}</small>
			</button>
		{/each}
	</div>
</div>

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

	.pptx-svelte-theme-presets {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 5px;
	}

	.pptx-svelte-theme-presets button {
		display: grid;
		gap: 3px;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		text-align: left;
		cursor: pointer;
	}

	.pptx-svelte-theme-preset-active {
		border-color: var(--pptx-primary, #6366f1) !important;
	}

	.pptx-svelte-theme-preset-strip {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		gap: 1px;
	}

	.pptx-svelte-theme-preset-strip span {
		height: 12px;
	}

	.pptx-svelte-theme-presets small {
		overflow: hidden;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	button:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
</style>
