<script lang="ts">
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
	const canAlign = $derived(editor.editable && count >= 2);
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

<div class="pptx-svelte-arrangex" role="group" aria-label={t('pptx.ribbon.arrange')}>
	{#each ALIGN_BUTTONS as btn (btn.edge)}
		<button
			type="button"
			disabled={!canAlign}
			aria-label={t(btn.key)}
			title={t(btn.key)}
			onclick={() => editor.arrangeOps.alignSelected(btn.edge)}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d={btn.d} fill="currentColor" /></svg>
		</button>
	{/each}
	<span class="pptx-svelte-arrangex-sep" aria-hidden="true"></span>
	<button
		type="button"
		disabled={!canDistribute}
		aria-label={t('pptx.arrange.distributeHorizontal')}
		title={t('pptx.arrange.distributeHorizontal')}
		onclick={() => editor.arrangeOps.distributeSelected('horizontal')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4" width="3" height="8" fill="currentColor" /><rect x="6.5" y="4" width="3" height="8" fill="currentColor" /><rect x="11.5" y="4" width="3" height="8" fill="currentColor" /></svg>
	</button>
	<button
		type="button"
		disabled={!canDistribute}
		aria-label={t('pptx.arrange.distributeVertical')}
		title={t('pptx.arrange.distributeVertical')}
		onclick={() => editor.arrangeOps.distributeSelected('vertical')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="1.5" width="8" height="3" fill="currentColor" /><rect x="4" y="6.5" width="8" height="3" fill="currentColor" /><rect x="4" y="11.5" width="8" height="3" fill="currentColor" /></svg>
	</button>
	<span class="pptx-svelte-arrangex-sep" aria-hidden="true"></span>
	<button
		type="button"
		disabled={!canFlip}
		aria-label={t('pptx.arrange.flipH')}
		title={t('pptx.arrange.flipHorizontally')}
		onclick={() => editor.arrangeOps.flipSelected('horizontal')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2v12M3 5l2-2 2 2M3 11l2 2 2-2M13 5l-2-2-2 2M13 11l-2 2-2-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<button
		type="button"
		disabled={!canFlip}
		aria-label={t('pptx.arrange.flipV')}
		title={t('pptx.arrange.flipVertically')}
		onclick={() => editor.arrangeOps.flipSelected('vertical')}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2 8h12M5 3l-2 2 2 2M11 3l2 2-2 2M5 13l-2-2 2-2M11 13l2-2-2-2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<span class="pptx-svelte-arrangex-sep" aria-hidden="true"></span>
	<button
		type="button"
		disabled={!canGroup}
		aria-label={t('pptx.contextMenu.group')}
		title={t('pptx.contextMenu.group')}
		onclick={() => editor.arrangeOps.groupSelected()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" /><rect x="8.5" y="8.5" width="6" height="6" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" /><path d="M2 2 14 14" stroke="currentColor" stroke-width="1" stroke-dasharray="1.5 1.5" /></svg>
	</button>
	<button
		type="button"
		disabled={!canUngroup}
		aria-label={t('pptx.contextMenu.ungroup')}
		title={t('pptx.contextMenu.ungroup')}
		onclick={() => editor.arrangeOps.ungroupSelected()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="1.5" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" /><rect x="9.5" y="9.5" width="5" height="5" rx="1" fill="none" stroke="currentColor" stroke-width="1.1" /></svg>
	</button>
	<span class="pptx-svelte-arrangex-sep" aria-hidden="true"></span>
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
		title={t('pptx.arrange.formatPainter')}
		onclick={() => editor.formatPainter.toggle()}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h8v4H3zM11 4h2v5H8v4H6V8h5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
		<span>{t('pptx.arrange.format')}</span>
	</button>
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
