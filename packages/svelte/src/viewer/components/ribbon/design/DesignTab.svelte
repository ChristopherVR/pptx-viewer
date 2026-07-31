<script lang="ts">
	/**
	 * DesignTab: the ribbon's Design tab, at React's `DesignSection` control set
	 * (Browse Themes / Edit Theme / Slide Size / Format Background).
	 *
	 * The theme-preset swatches used to sit loose on the tab, which made Svelte
	 * offer three top-level controls no other binding has. They now live behind
	 * "Browse Themes", the button React uses to open its own theme gallery, so
	 * the tab presents the same four commands everywhere and the presets are one
	 * click away instead of zero.
	 *
	 * "Edit Theme" opens `ThemeEditorPanel.svelte` (see the scope note there:
	 * viewer-chrome theme, not the deck's OOXML colour scheme). "Slide Size"
	 * opens the document-properties dialog the ribbon shell owns, which is where
	 * the slide dimensions live.
	 */
	import type { ViewerTheme } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup } from '../anchored-popup';
	import FormatBackgroundPanel from './FormatBackgroundPanel.svelte';
	import ChromeThemeEditor from './ChromeThemeEditor.svelte';
	import { THEME_SWATCHES } from './theme-swatches';

	const {
		editor,
		theme,
		onsettheme,
		onslidesize,
	}: {
		editor: EditorState;
		theme: ViewerTheme | undefined;
		onsettheme: (theme: ViewerTheme | undefined) => void;
		onslidesize?: () => void;
	} = $props();
	const t = useTranslator();

	let galleryOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let editorOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let backgroundOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let galleryAnchor: HTMLElement | undefined = $state();

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			galleryOpen = false;
		}
	}
</script>

<div class="pptx-svelte-designtab" role="group" aria-label={t('pptx.ribbon.tab.design')}>
	<div class="pptx-svelte-designtab-menu" bind:this={galleryAnchor} onfocusout={onFocusOut}>
		<button
			type="button"
			disabled={!editor.editable}
			aria-haspopup="menu"
			aria-expanded={galleryOpen}
			title={t('pptx.ribbon.browseThemesTitle')}
			onclick={() => (galleryOpen = !galleryOpen)}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.5" fill="none" stroke="currentColor" stroke-width="1.2" /><circle cx="6" cy="6.5" r="1" fill="currentColor" /><circle cx="10" cy="6.5" r="1" fill="currentColor" /><circle cx="8" cy="10.5" r="1" fill="currentColor" /></svg>
			<span>{t('pptx.ribbon.browseThemes')}</span>
		</button>
		{#if galleryOpen}
			<div class="pptx-svelte-designtab-pop" role="menu" use:anchoredPopup={{ anchor: galleryAnchor }}>
				{#each THEME_SWATCHES as swatch (swatch.labelKey)}
					<button
						type="button"
						role="menuitem"
						class:pptx-svelte-designtab-active={swatch.theme?.colors?.primary === theme?.colors?.primary}
						onclick={() => {
							onsettheme(swatch.theme);
							galleryOpen = false;
						}}
					>
						<span
							class="pptx-svelte-designtab-swatch"
							style={`background:${swatch.theme?.colors?.primary ?? '#6b7280'}`}
						></span>
						{t(swatch.labelKey)}
					</button>
				{/each}
			</div>
		{/if}
	</div>

	<button
		type="button"
		disabled={!editor.editable}
		class:pptx-svelte-designtab-active={editorOpen}
		title={t('pptx.ribbon.editThemeTitle')}
		onclick={() => (editorOpen = !editorOpen)}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10.5 2.5 13.5 5.5 5.5 13.5 2 14l.5-3.5z" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
		<span>{t('pptx.ribbon.editTheme')}</span>
	</button>

	<button type="button" title={t('pptx.ribbon.slideSizeTitle')} onclick={() => onslidesize?.()}>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="3.5" width="13" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M5.5 14.5h5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" /></svg>
		<span>{t('pptx.ribbon.slideSize')}</span>
	</button>

	<button
		type="button"
		disabled={!editor.editable}
		aria-haspopup="dialog"
		aria-expanded={backgroundOpen}
		title={t('pptx.ribbon.formatBackgroundTitle')}
		onclick={() => (backgroundOpen = !backgroundOpen)}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 2.5h11v11h-11z" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M2.5 10.5l3-3 2.5 2.5 3-4 2.5 3" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
		<span>{t('pptx.ribbon.formatBackground')}</span>
	</button>

	{#if editorOpen}
		<div class="pptx-svelte-designtab-panel">
			<ChromeThemeEditor {theme} {onsettheme} onclose={() => (editorOpen = false)} />
		</div>
	{/if}
	{#if backgroundOpen}
		<div class="pptx-svelte-designtab-panel">
			<FormatBackgroundPanel {editor} open={backgroundOpen} onclose={() => (backgroundOpen = false)} />
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-designtab {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 4px;
	}

	.pptx-svelte-designtab-menu {
		position: relative;
		display: inline-flex;
	}

	.pptx-svelte-designtab button {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		white-space: nowrap;
	}

	.pptx-svelte-designtab button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-designtab button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-designtab-active {
		outline: 2px solid var(--pptx-primary, #6366f1);
		outline-offset: -2px;
	}

	.pptx-svelte-designtab-swatch {
		width: 12px;
		height: 12px;
		border-radius: 50%;
		border: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-designtab svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-designtab-pop {
		position: absolute;
		top: 100%;
		left: 0;
		z-index: 50;
		margin-top: 4px;
		display: flex;
		min-width: 172px;
		flex-direction: column;
		gap: 2px;
		padding: 4px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
		box-shadow: 0 10px 15px -3px rgb(0 0 0 / 35%), 0 4px 6px -4px rgb(0 0 0 / 35%);
	}

	.pptx-svelte-designtab-pop button {
		width: 100%;
		justify-content: flex-start;
		background: transparent;
	}

	.pptx-svelte-designtab-panel {
		flex-basis: 100%;
	}
</style>
