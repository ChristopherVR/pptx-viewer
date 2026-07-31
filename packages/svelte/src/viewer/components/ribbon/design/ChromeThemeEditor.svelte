<script lang="ts">
	/**
	 * ChromeThemeEditor: Design > Edit Theme, a docked editor for the four
	 * viewer-chrome colours a user actually notices (surface, text, primary
	 * accent, borders).
	 *
	 * Scope note, because the name invites the wrong expectation: this edits the
	 * `ViewerTheme` the Design tab's preset gallery also swaps, NOT the deck's
	 * OOXML `PptxTheme` colour scheme. Editing the deck theme is a separate,
	 * much larger surface (`applyThemeToData` in `pptx-viewer-core`) that this
	 * tab has never built in any binding except React, and half-porting it
	 * behind a button labelled "Edit Theme" would be worse than being explicit.
	 * The colours here are exactly the ones the gallery presets set, so the two
	 * controls compose: pick a preset, then nudge it.
	 */
	import type { ViewerTheme } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';

	const {
		theme,
		onsettheme,
		onclose,
	}: {
		theme: ViewerTheme | undefined;
		onsettheme: (theme: ViewerTheme | undefined) => void;
		onclose: () => void;
	} = $props();
	const t = useTranslator();

	const SLOTS = [
		{ key: 'primary', labelKey: 'pptx.theme.primary', fallback: '#6366f1' },
		{ key: 'background', labelKey: 'pptx.theme.background', fallback: '#11111b' },
		{ key: 'cardForeground', labelKey: 'pptx.theme.foreground', fallback: '#e2e8f0' },
		{ key: 'border', labelKey: 'pptx.theme.border', fallback: '#33334d' },
	] as const;

	function set(key: (typeof SLOTS)[number]['key'], value: string): void {
		onsettheme({ ...theme, colors: { ...theme?.colors, [key]: value } });
	}
</script>

<div class="pptx-svelte-themeedit" role="group" aria-label={t('pptx.ribbon.editTheme')}>
	{#each SLOTS as slot (slot.key)}
		<label>
			<span>{t(slot.labelKey)}</span>
			<input
				type="color"
				value={theme?.colors?.[slot.key] ?? slot.fallback}
				oninput={(event) => set(slot.key, event.currentTarget.value)}
			/>
		</label>
	{/each}
	<button type="button" onclick={() => onsettheme(undefined)}>{t('pptx.common.reset')}</button>
	<button type="button" onclick={onclose}>{t('pptx.common.close')}</button>
</div>

<style>
	.pptx-svelte-themeedit {
		display: flex;
		align-items: center;
		gap: 10px;
		padding: 8px 10px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-card, #1e1e2e);
	}

	.pptx-svelte-themeedit label {
		display: inline-flex;
		align-items: center;
		gap: 5px;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-themeedit input {
		width: 26px;
		height: 22px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-themeedit button {
		height: 24px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 11px;
	}
</style>
