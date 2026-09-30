<script lang="ts">
	/**
	 * DesignTab: the ribbon's Design tab, at React's `DesignSection` control set
	 * (Browse Themes / Edit Theme / Slide Size / Format Background), plus the
	 * Variants Colors / Fonts galleries.
	 *
	 * Both theme commands act on the PRESENTATION theme, as in React, Vue and
	 * Angular: "Browse Themes" drops down the shared gallery presets
	 * (`DeckThemeMenu`) and a pick re-themes the deck through the ribbon's
	 * gallery host (undoable); "Edit Theme" docks the deck theme editor
	 * (`DeckThemeEditor`, the same editor the inspector hosts). The viewer's
	 * own chrome theme is chosen in Options > Appearance, not here. "Slide
	 * Size" opens the document-properties dialog the ribbon shell owns, which
	 * is where the slide dimensions live.
	 */

	import { DESIGN_RIBBON_COMMANDS, DESIGN_RIBBON_GROUPS, designCommandState } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import { anchoredPopup } from '../anchored-popup';
	import { fixedGalleryPlacement } from '../galleries/fixed-placements';
	import { createRibbonGalleryHost, useRibbonGalleryHost } from '../galleries/ribbon-gallery-host';
	import RibbonGallery from '../galleries/RibbonGallery.svelte';
	import DeckThemeMenu from './DeckThemeMenu.svelte';
	import FormatBackgroundPanel from './FormatBackgroundPanel.svelte';

	const {
		editor,
		onslidesize,
	}: {
		editor: EditorState;
		onslidesize?: () => void;
	} = $props();
	const t = useTranslator();
	// The ribbon publishes one host for every tab; a tab mounted on its own
	// (tests, the mobile sheet before it provides one) builds its own.
	// svelte-ignore state_referenced_locally
	const host = useRibbonGalleryHost() ?? createRibbonGalleryHost(editor);

	let galleryOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let backgroundOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let galleryAnchor: HTMLElement | undefined = $state();
	const editorOpen = $derived(editor.themeEditorOpen);

	function onFocusOut(event: FocusEvent): void {
		const root = event.currentTarget as HTMLElement;
		if (!(event.relatedTarget instanceof Node) || !root.contains(event.relatedTarget)) {
			galleryOpen = false;
		}
	}

	function toggleThemeEditor(): void {
		editor.themeEditorOpen = !editor.themeEditorOpen;
	}
	const VARIANT_COLORS = fixedGalleryPlacement('design.variants.colors');
	const VARIANT_FONTS = fixedGalleryPlacement('design.variants.fonts');
</script>

<div class="pptx-svelte-designtab" role="group" aria-label={t('pptx.ribbon.tab.design')}>
 {#each DESIGN_RIBBON_GROUPS as group (group.id)}
  <pptx-ui-ribbon-group data-ribbon-group={group.id} label={t(group.labelKey)}>
   {#each DESIGN_RIBBON_COMMANDS.filter((item) => item.id.startsWith(`${group.id}.`)) as command (command.id)}
    {@const view = designCommandState(command.id, { editable: editor.editable, galleryOpen, editorOpen, backgroundOpen, hasSlideSize: Boolean(onslidesize) })}
    {#if !view.hidden}
     {#if command.id === 'design.themes.browseThemes'}
      <div class="pptx-svelte-designtab-menu" bind:this={galleryAnchor} onfocusout={onFocusOut}>
       <pptx-ui-ribbon-command data-ribbon-control={command.id} label={t(command.labelKey)} title={t(command.titleKey)} icon={command.icon} compact
        disabled={view.disabled || undefined} active={view.active || undefined} expanded={String(galleryOpen)} oncommand-request={() => (galleryOpen = !galleryOpen)}></pptx-ui-ribbon-command>
       {#if galleryOpen}
        <div class="pptx-svelte-designtab-pop" role="menu" aria-label={t('pptx.themes.gallery.ariaLabel')} use:anchoredPopup={{ anchor: galleryAnchor }}>
         <DeckThemeMenu theme={editor.theme} disabled={!editor.editable} onpick={(preset) => { galleryOpen = false; void host.applyThemePreset(preset); }} />
        </div>
       {/if}
      </div>
     {:else}
      <pptx-ui-ribbon-command data-ribbon-control={command.id} label={t(command.labelKey)} title={t(command.titleKey)} icon={command.icon} compact
       disabled={view.disabled || undefined} active={view.active || undefined} expanded={view.expanded === undefined ? undefined : String(view.expanded)}
       oncommand-request={() => { if (command.id === 'design.themes.editTheme') { toggleThemeEditor(); }
        else if (command.id === 'design.customize.slideSize') { onslidesize?.(); }
        else { backgroundOpen = !backgroundOpen; } }}></pptx-ui-ribbon-command>
     {/if}
    {/if}
   {/each}
   {#if group.id === 'design.variants'}
    <RibbonGallery placement={VARIANT_COLORS} />
    <RibbonGallery placement={VARIANT_FONTS} />
   {/if}
  </pptx-ui-ribbon-group>
 {/each}
 {#if backgroundOpen}
  <div class="pptx-svelte-designtab-panel"><FormatBackgroundPanel {editor} open={backgroundOpen} onclose={() => (backgroundOpen = false)} /></div>
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

	/* The preset entries are `DeckThemeMenu`'s own buttons, so reach them globally. */
	.pptx-svelte-designtab-pop :global(button) {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		width: 100%;
		height: 28px;
		padding: 0 8px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		justify-content: flex-start;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		white-space: nowrap;
	}

	.pptx-svelte-designtab-pop :global(button:hover:not(:disabled)) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-designtab-panel {
		flex-basis: 100%;
	}
</style>
