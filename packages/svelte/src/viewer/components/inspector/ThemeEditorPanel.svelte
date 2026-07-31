<script lang="ts">
	/**
	 * ThemeEditorPanel: full theme authoring, mirroring React's
	 * `inspector/ThemeEditorPanel.tsx` (+ its `ThemePresetGallery` and
	 * `ThemeColorSchemeEditor` children, which this binding now mirrors as
	 * sibling components too).
	 *
	 * Replaces the ad-hoc "Edit theme" disclosure this binding used to inline in
	 * `ThemeSection`, which offered raw colour inputs but none of React's
	 * preset gallery, live preview grid, curated font pair, or Reset.
	 *
	 * The working copy (and why it is a copy) lives in `theme-editor-state`;
	 * every catalogue (`PRESET_THEMES`, `COMMON_FONTS`, the colour labels, and
	 * the preview-grid tint/shade maths) comes from `pptx-viewer-shared`. What
	 * is left here is the name field, the font pair, and the actions.
	 */
	import type { PptxTheme, PptxThemeColorScheme, PptxThemeFontScheme } from 'pptx-viewer-core';
	import { COMMON_FONTS } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import { ThemeEditorState } from './theme-editor-state.svelte';
	import ThemeColorSchemeEditor from './ThemeColorSchemeEditor.svelte';
	import ThemePresetGallery from './ThemePresetGallery.svelte';

	const {
		theme,
		canEdit,
		onupdatecolorscheme,
		onupdatefontscheme,
		onupdatename,
		onapply,
	}: {
		theme: PptxTheme | undefined;
		canEdit: boolean;
		onupdatecolorscheme: (colorScheme: PptxThemeColorScheme) => void;
		onupdatefontscheme: (fontScheme: PptxThemeFontScheme) => void;
		onupdatename: (name: string) => void;
		onapply: () => void;
	} = $props();
	const t = useTranslator();

	// Each commit is forwarded through a closure, not captured: a `$props()`
	// value read at the top level of the script would freeze this panel to the
	// host's first-render callbacks.
	const state = new ThemeEditorState(() => theme, {
		onupdatecolorscheme: (colorScheme) => onupdatecolorscheme(colorScheme),
		onupdatefontscheme: (fontScheme) => onupdatefontscheme(fontScheme),
		onupdatename: (name) => onupdatename(name),
	});
</script>

<div class="pptx-svelte-theme-editor">
	<label class="pptx-svelte-theme-field">
		<span>{t('pptx.themeEditor.themeName')}</span>
		<input
			type="text"
			disabled={!canEdit}
			value={state.name}
			onchange={(event) => state.setName(event.currentTarget.value)}
		/>
	</label>

	<ThemePresetGallery
		activeName={state.name}
		{canEdit}
		onselect={(preset) => state.selectPreset(preset)}
	/>

	<ThemeColorSchemeEditor {state} {canEdit} />

	<div class="pptx-svelte-theme-block">
		<span class="pptx-svelte-theme-heading">{t('pptx.themeEditor.fonts')}</span>
		<label class="pptx-svelte-theme-field">
			<span>{t('pptx.themeEditor.headingFont')}</span>
			<select
				disabled={!canEdit}
				value={state.majorFont}
				onchange={(event) => state.setFonts(event.currentTarget.value, state.minorFont)}
			>
				{#if !COMMON_FONTS.includes(state.majorFont)}
					<option value={state.majorFont}>{state.majorFont}</option>
				{/if}
				{#each COMMON_FONTS as font (font)}
					<option value={font}>{font}</option>
				{/each}
			</select>
		</label>
		<label class="pptx-svelte-theme-field">
			<span>{t('pptx.themeEditor.bodyFont')}</span>
			<select
				disabled={!canEdit}
				value={state.minorFont}
				onchange={(event) => state.setFonts(state.majorFont, event.currentTarget.value)}
			>
				{#if !COMMON_FONTS.includes(state.minorFont)}
					<option value={state.minorFont}>{state.minorFont}</option>
				{/if}
				{#each COMMON_FONTS as font (font)}
					<option value={font}>{font}</option>
				{/each}
			</select>
		</label>
		<p class="pptx-svelte-theme-samples">
			<span style={`font-family:${state.majorFont}`}>{t('pptx.themeEditor.headingSample')}</span>
			<span aria-hidden="true">|</span>
			<span style={`font-family:${state.minorFont}`}>{t('pptx.themeEditor.bodySample')}</span>
		</p>
	</div>

	<div class="pptx-svelte-theme-actions">
		<button type="button" disabled={!canEdit} onclick={onapply}>
			{t('pptx.themeEditor.applyToPresentation')}
		</button>
		<button type="button" disabled={!canEdit} onclick={() => state.reset()}>
			{t('pptx.themeEditor.reset')}
		</button>
	</div>
</div>

<style>
	.pptx-svelte-theme-editor {
		display: grid;
		gap: 9px;
	}

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

	.pptx-svelte-theme-field {
		display: grid;
		gap: 3px;
	}

	.pptx-svelte-theme-field > span {
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}

	input,
	select {
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

	.pptx-svelte-theme-samples {
		display: flex;
		gap: 6px;
		margin: 2px 0 0;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 10px;
	}

	.pptx-svelte-theme-actions {
		display: flex;
		gap: 5px;
	}

	.pptx-svelte-theme-actions button {
		flex: 1;
		padding: 4px 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		cursor: pointer;
	}

	.pptx-svelte-theme-actions button:first-child {
		border-color: var(--pptx-primary, #6366f1);
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	button:disabled,
	input:disabled,
	select:disabled {
		cursor: not-allowed;
		opacity: 0.4;
	}
</style>
