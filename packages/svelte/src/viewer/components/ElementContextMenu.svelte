<script lang="ts">
	/**
	 * Editable-element context menu.
	 *
	 * The items are not decided here: `buildEditorContextMenuEntries` asks the
	 * shared `buildContextMenuEntries` (the one definition all five bindings
	 * render) what to offer, and this component hands the chosen command id back to
	 * the dispatch. The rows, positioning, dismissal and focus belong to the shared
	 * `pptx-ui-context-menu`.
	 */
	import { contextMenuViewItems, customizeContextMenuEntries } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import {
		buildEditorContextMenuEntries,
		runContextMenuCommand,
	} from '../editor/context-menu-dispatch';
	import { useViewerCustomization } from '../state/viewer-customization.svelte';
	import ContextMenuSurface from './ContextMenuSurface.svelte';
	import type { ElementContextMenuProps } from './props';

	const {
		x,
		y,
		editor,
		cell = null,
		onaskai,
		onfixai,
		oncomment,
		onhyperlink,
		onenterinlineedit,
		onsaveaspicture,
		onfocusinspectorsection,
		onclose,
	}: ElementContextMenuProps = $props();
	const t = useTranslator();

	const dispatch = $derived({
		editor,
		cell,
		onAskAi: onaskai,
		onFixAi: onfixai,
		onComment: oncomment,
		onHyperlink: onhyperlink,
		onEnterInlineEdit: onenterinlineedit,
		onSaveAsPicture: onsaveaspicture,
		onFocusInspectorSection: onfocusinspectorsection,
	});
	const customization = useViewerCustomization();
	// The host's customisation filters the shared list (hidden commands, repaired
	// separators); an empty result means no menu at all, so close instead.
	const entries = $derived(
		customizeContextMenuEntries(buildEditorContextMenuEntries(dispatch), customization.resolved, { slideIndex: editor.currentSlideIndex, elementIds: [...editor.selection.ids] }),
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
		runContextMenuCommand(entry.id, dispatch);
		onclose();
	}
</script>

{#if entries.length > 0}
	<ContextMenuSurface
		{x}
		{y}
		label={t('pptx.contextMenu.ariaLabel')}
		markers={['data-pptx-context-menu']}
		items={contextMenuViewItems(entries, t)}
		onrequest={run}
		{onclose}
	/>
{/if}
