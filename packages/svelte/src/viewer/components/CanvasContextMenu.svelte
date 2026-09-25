<script lang="ts">
	/**
	 * Empty-canvas (no element under the cursor) context menu.
	 *
	 * Sibling of `ElementContextMenu.svelte`: the item list comes from
	 * `pptx-viewer-shared`'s `canvas-context-menu-commands` (via
	 * `buildCanvasMenuEntries`), this component only positions and renders it.
	 */
	import { clampFlyoutPosition, customizeCanvasContextMenuEntries } from 'pptx-viewer-shared';
	import type { CanvasContextMenuCommandId } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import {
		buildCanvasMenuEntries,
		runCanvasContextMenuCommand,
	} from '../editor/canvas-context-menu-dispatch';
	import { useViewerCustomization } from '../state/viewer-customization.svelte';
	import type { CanvasContextMenuProps } from './props';

	const {
		x,
		y,
		editor,
		showGrid,
		showRulers,
		onopenlayoutgallery,
		onresetslide,
		onopenformatbackground,
		ontogglegrid,
		ontogglerulers,
		onclose,
	}: CanvasContextMenuProps = $props();
	const t = useTranslator();

	let menuWidth = $state(0);
	let menuHeight = $state(0);
	const menuStyle = $derived.by(() => {
		const { left, top } = clampFlyoutPosition({
			x,
			y,
			width: menuWidth,
			height: menuHeight,
			viewportWidth: typeof window === 'undefined' ? 0 : window.innerWidth,
			viewportHeight: typeof window === 'undefined' ? 0 : window.innerHeight,
		});
		return `left: ${left}px; top: ${top}px`;
	});
	const dispatch = $derived({
		editor,
		showGrid,
		showRulers,
		onOpenLayoutGallery: onopenlayoutgallery,
		onResetSlide: onresetslide,
		onOpenFormatBackground: onopenformatbackground,
		onToggleGrid: ontogglegrid,
		onToggleRulers: ontogglerulers,
	});
	const customization = useViewerCustomization();
	// Filtered through the host's customisation; empty means no menu, so close.
	const entries = $derived(
		customizeCanvasContextMenuEntries(buildCanvasMenuEntries(dispatch), customization.resolved),
	);
	$effect(() => {
		if (entries.length === 0) {
			onclose();
		}
	});

	function run(id: CanvasContextMenuCommandId): void {
		runCanvasContextMenuCommand(id, dispatch);
		onclose();
	}
</script>

<svelte:window
	onkeydown={(event) => {
		if (event.key === 'Escape') onclose();
	}}
/>

{#if entries.length > 0}
<!-- svelte-ignore a11y_click_events_have_key_events -->
<div class="pptx-svelte-context-backdrop" aria-hidden="true" onclick={onclose} oncontextmenu={(event) => { event.preventDefault(); onclose(); }}></div>
<div
	class="pptx-svelte-context-menu"
	data-pptx-context-menu="true"
	data-pptx-canvas-context-menu="true"
	role="menu"
	aria-label={t('pptx.canvasContextMenu.ariaLabel')}
	style={menuStyle}
	bind:clientWidth={menuWidth}
	bind:clientHeight={menuHeight}
>
	{#each entries as entry (entry.id)}
		{#if entry.separatorBefore}<div class="pptx-svelte-context-separator" role="separator"></div>{/if}
		<button
			type="button"
			role={entry.checked === undefined ? 'menuitem' : 'menuitemcheckbox'}
			aria-checked={entry.checked === undefined ? undefined : entry.checked}
			disabled={entry.disabled}
			onclick={() => run(entry.id)}
		>
			{#if entry.checked !== undefined}<span class="pptx-svelte-context-check" aria-hidden="true">{entry.checked ? '✓' : ''}</span>{/if}
			{t(entry.labelKey)}
		</button>
	{/each}
</div>
{/if}

<style>
	.pptx-svelte-context-backdrop { position: fixed; inset: 0; z-index: 119; }
	.pptx-svelte-context-menu { position: fixed; z-index: 120; display: flex; min-width: 180px; flex-direction: column; padding: 6px 0; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 18px 40px rgb(0 0 0 / 35%); color: var(--pptx-card-foreground, #e2e8f0); font-family: system-ui, sans-serif; font-size: 12px; }
	.pptx-svelte-context-menu button { padding: 6px 12px; border: 0; background: transparent; color: inherit; font: inherit; text-align: left; cursor: pointer; }
	.pptx-svelte-context-menu button:hover, .pptx-svelte-context-menu button:focus-visible { background: var(--pptx-accent, #33334d); outline: none; }
	.pptx-svelte-context-menu button:disabled { opacity: 0.45; cursor: default; }
	.pptx-svelte-context-menu button:disabled:hover { background: transparent; }
	.pptx-svelte-context-separator { height: 1px; margin: 5px 0; background: var(--pptx-border, #33334d); }
	.pptx-svelte-context-check { display: inline-block; width: 14px; }
</style>
