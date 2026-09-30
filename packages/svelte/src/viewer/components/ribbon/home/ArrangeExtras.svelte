<script lang="ts">
	import RibbonIcon from '../RibbonIcon.svelte';
	/**
	 * ArrangeExtras: the multi-select-aware half of the Home tab's Arrange
	 * group: align / distribute / flip / group / ungroup. Z-order (front /
	 * forward / backward / back) stays in the existing `ArrangeGroup`; both
	 * are composed together under one "Arrange" ribbon group in `HomeTab`.
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
	// One element aligns to the slide, two or more to each other (PowerPoint).
	const canAlign = $derived(editor.editable && count >= 1);
	const canDistribute = $derived(editor.editable && count >= 3);
	const canFlip = $derived(editor.editable && count >= 1);
	// G10: mirrors the a:spLocks/@noGrp guard editor.arrangeOps.groupSelected
	// already enforces on the command, so a locked selection reads as disabled
	// rather than a click that silently does nothing.
	const selectionGroupable = $derived(
		editor.selectedElements.every((el) => canInteractWithElement(el, 'group')),
	);
	const canGroup = $derived(canGroupSelection(editor.editable, count, selectionGroupable));
	const canUngroup = $derived(canUngroupSelection(editor.editable, editor.selectedElement ?? null));

	const ALIGN_BUTTONS = [
		{ edge: 'left', key: 'pptx.ribbon.alignLeft', d: 'M3 2v12M6 4h6v2H6zM6 10h4v2H6z' },
		{ edge: 'centerH', key: 'pptx.ribbon.alignCenter', d: 'M8 2v12M4 4h8v2H4zM5 10h6v2H5z' },
		{ edge: 'right', key: 'pptx.ribbon.alignRight', d: 'M13 2v12M4 4h6v2H4zM6 10h4v2H6z' },
		{ edge: 'top', key: 'pptx.ribbon.alignTop', d: 'M2 3h12M4 6h2v6H4zM10 6h2v4h-2z' },
		{ edge: 'middle', key: 'pptx.ribbon.alignMiddle', d: 'M2 8h12M4 5h2v6H4zM10 6h2v4h-2z' },
		{ edge: 'bottom', key: 'pptx.ribbon.alignBottom', d: 'M2 13h12M4 4h2v6H4zM10 6h2v4h-2z' },
	] as const;
</script>

<div class="pptx-svelte-arrangex" data-pptx-chrome="control-fragment" role="group" aria-label={t('pptx.ribbon.arrange')}>
<div data-pptx-chrome="align-controls">	{#each ALIGN_BUTTONS as btn (btn.edge)}
		<button
			type="button"
			disabled={!canAlign}
			data-ribbon-control="home.arrange.align"
			aria-label={t(btn.key)}
			title={t(btn.key)}
			onclick={() => editor.arrangeOps.alignSelected(btn.edge)}
		>
			<RibbonIcon name={`home.arrange.align.${btn.edge === 'centerH' ? 'center' : btn.edge}`} />
		</button>
	{/each}</div>
<div data-pptx-chrome="distribute-controls">

	<button
		type="button"
		disabled={!canDistribute}
		data-ribbon-control="home.arrange.align"
		aria-label={t('pptx.arrange.distributeHorizontal')}
		title={t('pptx.arrange.distributeHorizontal')}
		onclick={() => editor.arrangeOps.distributeSelected('horizontal')}
	>
		<RibbonIcon name="home.arrange.distribute.horizontal" />
	</button>
	<button
		type="button"
		disabled={!canDistribute}
		data-ribbon-control="home.arrange.align"
		aria-label={t('pptx.arrange.distributeVertical')}
		title={t('pptx.arrange.distributeVertical')}
		onclick={() => editor.arrangeOps.distributeSelected('vertical')}
	>
		<RibbonIcon name="home.arrange.distribute.vertical" />
	</button>
	</div>
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
	</button><div data-pptx-chrome="flip-controls">
	<button
		type="button"
		disabled={!canFlip}
		data-ribbon-control="home.arrange.flipHorizontal"
		aria-label={t('pptx.arrange.flipH')}
		title={t('pptx.arrange.flipHorizontally')}
		onclick={() => editor.arrangeOps.flipSelected('horizontal')}
	>
		<span>{t('pptx.arrange.flipH')}</span>
	</button>
	<button
		type="button"
		disabled={!canFlip}
		data-ribbon-control="home.arrange.flipVertical"
		aria-label={t('pptx.arrange.flipV')}
		title={t('pptx.arrange.flipVertically')}
		onclick={() => editor.arrangeOps.flipSelected('vertical')}
	>
		<span>{t('pptx.arrange.flipV')}</span>
	</button></div><div data-pptx-chrome="group-controls">

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
