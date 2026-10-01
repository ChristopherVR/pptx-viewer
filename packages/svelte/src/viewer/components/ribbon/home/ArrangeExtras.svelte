<script lang="ts">
	import RibbonIcon from '../RibbonIcon.svelte';
	import ArrangeHomeStrip from './ArrangeHomeStrip.svelte';
	/**
	 * ArrangeExtras: the multi-select-aware half of the Home tab's Arrange
	 * group: the shared align / distribute and flip strips around the native Format
	 * Painter and Group / Ungroup. Z-order, Duplicate and Delete are further shared
	 * strips (`ArrangeHomeStrip`) composed in `HomeTab`.
	 * Reads `editor.selectedElements`/`selection` (the ordered multi-select)
	 * and routes every mutation through `EditorState.arrangeOps`.
	 */
	import {
		canGroupSelection,
		canInteractWithElement,
		canUngroupSelection,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const count = $derived(editor.selection.size);
	// G10: mirrors the a:spLocks/@noGrp guard editor.arrangeOps.groupSelected
	// already enforces on the command, so a locked selection reads as disabled
	// rather than a click that silently does nothing.
	const selectionGroupable = $derived(
		editor.selectedElements.every((el) => canInteractWithElement(el, 'group')),
	);
	const canGroup = $derived(canGroupSelection(editor.editable, count, selectionGroupable));
	const canUngroup = $derived(canUngroupSelection(editor.editable, editor.selectedElement ?? null));

</script>

<div class="pptx-svelte-arrangex" data-pptx-chrome="control-fragment" role="group" aria-label={t('pptx.ribbon.arrange')}>
<ArrangeHomeStrip {editor} strip="align" />
	<!-- The Arrange group's labelled Format Painter, beside the Clipboard
	     group's icon-only one. Both drive the same controller; PowerPoint (and
	     React) offer it in both places because the Arrange group is where you
	     are already working when you want to copy a shape's look. -->
	<button
		type="button"
		class="pptx-svelte-arrangex-wide"
		class:pptx-svelte-arrangex-on={editor.formatPainter.active}
		data-active={editor.formatPainter.active}
		aria-pressed={editor.formatPainter.active}
		disabled={!editor.formatPainter.enabled}
		data-ribbon-control="home.clipboard.formatPainter"
		title={t('pptx.arrange.formatPainter')}
		onclick={() => editor.formatPainter.toggle()}
	>
		<RibbonIcon name="home.clipboard.formatPainter" />
		<span>{t('pptx.arrange.format')}</span>
	</button>
<ArrangeHomeStrip {editor} strip="flip" /><div data-pptx-chrome="group-controls">

	<button
		type="button"
		disabled={!canGroup}
		data-ribbon-control="home.arrange.group"
		aria-label={t('pptx.contextMenu.group')}
		title={t('pptx.contextMenu.group')}
		onclick={() => editor.arrangeOps.groupSelected()}
	>
		<RibbonIcon name="home.arrange.group" />
	</button>
	<button
		type="button"
		disabled={!canUngroup}
		data-ribbon-control="home.arrange.ungroup"
		aria-label={t('pptx.contextMenu.ungroup')}
		title={t('pptx.contextMenu.ungroup')}
		onclick={() => editor.arrangeOps.ungroupSelected()}
	>
		<RibbonIcon name="home.arrange.ungroup" />
	</button>

</div>
</div>

<style>
	.pptx-svelte-arrangex {
		display: inline-flex;
		align-items: center;
		gap: 2px;
	}

	.pptx-svelte-arrangex button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-arrangex button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-arrangex button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-arrangex svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-arrangex-wide {
		gap: 4px;
		padding: 0 8px;
		font: inherit;
		font-size: 11.5px;
		white-space: nowrap;
	}

	.pptx-svelte-arrangex-on {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-arrangex-sep {
		width: 1px;
		height: 18px;
		margin: 0 3px;
		background: var(--pptx-border, #33334d);
	}
</style>
