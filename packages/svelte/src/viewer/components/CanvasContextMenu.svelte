<script lang="ts">
	/**
	 * Empty-canvas (no element under the cursor) context menu.
	 *
	 * Sibling of `ElementContextMenu.svelte`: the item list comes from
	 * `pptx-viewer-shared`'s `canvas-context-menu-commands` (via
	 * `buildCanvasMenuEntries`); the rows are drawn by the shared
	 * `pptx-ui-context-menu`.
	 */
	import { contextMenuViewItems, customizeCanvasContextMenuEntries } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import {
		buildCanvasMenuEntries,
		runCanvasContextMenuCommand,
	} from '../editor/canvas-context-menu-dispatch';
	import { useViewerCustomization } from '../state/viewer-customization.svelte';
	import ContextMenuSurface from './ContextMenuSurface.svelte';
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
		customizeCanvasContextMenuEntries(buildCanvasMenuEntries(dispatch), customization.resolved, { slideIndex: editor.currentSlideIndex }),
	);
	$effect(() => {
		if (entries.length === 0) {
			onclose();
		}
	});

	function run(id: string): void {
		const entry = entries.find((candidate) => candidate.id === id);
		if (!entry) {
			return;
		}
		if ('host' in entry) {
			onclose();
			entry.onSelect();
			return;
		}
		runCanvasContextMenuCommand(entry.id, dispatch);
		onclose();
	}
</script>

{#if entries.length > 0}
	<ContextMenuSurface
		{x}
		{y}
		label={t('pptx.canvasContextMenu.ariaLabel')}
		markers={['data-pptx-context-menu', 'data-pptx-canvas-context-menu']}
		items={contextMenuViewItems(entries, t)}
		onrequest={run}
		{onclose}
	/>
{/if}
