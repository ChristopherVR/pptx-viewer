<script lang="ts">
	/**
	 * PowerPoint's Outline view.
	 *
	 * The deck as an editable indented text document: one row per slide title at
	 * the left margin, that slide's body lines stepped in beneath it. Typing edits
	 * the slide, Tab and Shift+Tab change a line's outline level, and Enter on a
	 * title starts a new slide. See `render/outline-view` in `pptx-viewer-shared`
	 * for the model and `render/outline-view-edit` for what each gesture does and
	 * (just as important) what it deliberately does not.
	 *
	 * Drawn as a full-window overlay rather than by replacing the thumbnail pane,
	 * matching `SlideSorterOverlay` and `ReadingViewOverlay`: every binding then
	 * needs one overlay, not five different rebuilds of its own sidebar.
	 *
	 * Each row is a real `<input>`. A contenteditable would have to re-implement
	 * caret placement, IME commit and undo per browser, and a list of one-line
	 * inputs is exactly what an outline is.
	 */
	import X from '@lucide/svelte/icons/x';
	import type { PptxSlide } from 'pptx-viewer-core';
	import {
		OUTLINE_LEVEL_ATTR,
		OUTLINE_ROW_ATTR,
		OUTLINE_SLIDE_ATTR,
		OUTLINE_VIEW_ATTR,
	} from 'pptx-viewer-shared';
	import type { CanvasSize, OutlineRow } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { OutlineViewSession } from '../state/outline-view.svelte';

	const {
		slides,
		canvasSize,
		canEdit,
		oncommit,
		onactiveslide,
		onclose,
	}: {
		slides: PptxSlide[];
		canvasSize: CanvasSize;
		/** False for a read-only deck: rows stay readable but every edit is inert. */
		canEdit: boolean;
		/** Receives the whole new deck, for the caller's own undoable commit path. */
		oncommit: (slides: PptxSlide[]) => void;
		/** Receives the slide an edit landed on, so leaving the outline goes there. */
		onactiveslide: (index: number) => void;
		onclose: () => void;
	} = $props();

	const t = useTranslator();

	/** Indent per outline level, in pixels. Level 0 (a title) sits flush left. */
	const INDENT_PX = 22;

	// Not a rune: `bind:this` is the only writer and the focus effect below is
	// woken by the row list, not by the box. Matches `InlineTextEditor.svelte`,
	// including the disable comment oxlint needs to see past the template.
	// eslint-disable-next-line no-unassigned-vars
	let container: HTMLElement | undefined;

	// Built once: the session reads the deck through accessors, so it never holds
	// a stale copy and never has to be rebuilt when the props change.
	const session = new OutlineViewSession({
		getSlides: () => slides,
		getCanvasSize: () => canvasSize,
		canEdit: () => canEdit,
		onCommit: (next) => oncommit(next),
		onActiveSlide: (index) => onactiveslide(index),
	});

	const rows = $derived(session.rows);

	// Reads `rows` so it re-runs only after the deck an edit produced has been
	// rendered: the row that should take the caret may not exist before then.
	$effect(() => {
		void rows;
		session.restoreFocus(container);
	});

	const rowLabel = (row: OutlineRow): string =>
		t(row.kind === 'title' ? 'pptx.outline.titleLine' : 'pptx.outline.bodyLine');

	// Neutral data attributes rather than classes: `e2e/` addresses all five
	// bindings through one selector, and each binding styles itself as it likes.
	const rootAttrs = { [OUTLINE_VIEW_ATTR]: 'true' };
	const rowAttrs = (row: OutlineRow): Record<string, string> => ({
		[OUTLINE_ROW_ATTR]: row.key,
		[OUTLINE_SLIDE_ATTR]: String(row.slideIndex + 1),
		[OUTLINE_LEVEL_ATTR]: String(row.level),
	});
</script>

<div {...rootAttrs} class="pptx-svelte-outline" role="region" aria-label={t('pptx.view.outlineView')}>
	<div class="pptx-svelte-outline-header">
		<span class="pptx-svelte-outline-title">{t('pptx.view.outlineView')}</span>
		<span class="pptx-svelte-outline-hint">{t('pptx.outline.hint')}</span>
		<button
			type="button"
			aria-label={t('pptx.statusBar.normalView')}
			title={t('pptx.statusBar.normalView')}
			onclick={() => onclose()}
		>
			<X size={16} aria-hidden="true" />
		</button>
	</div>
	<div class="pptx-svelte-outline-rows" bind:this={container}>
		{#each rows as row (row.key)}
			<div class="pptx-svelte-outline-row" style="padding-left: {row.level * INDENT_PX}px">
				<!--
					The slide number is drawn only on a slide's first row, which is always
					its title row, so the outline reads as a list of slides rather than as
					one undifferentiated wall of lines.
				-->
				<span class="pptx-svelte-outline-number">{row.kind === 'title' ? row.slideIndex + 1 : ''}</span>
				<input
					{...rowAttrs(row)}
					type="text"
					value={row.text}
					readonly={!canEdit}
					aria-label={rowLabel(row)}
					class:pptx-svelte-outline-input-title={row.kind === 'title'}
					oninput={(event) =>
						session.run({ type: 'setText', key: row.key, text: event.currentTarget.value })}
					onkeydown={(event) => session.handleKey(event, row.key)}
				/>
			</div>
		{/each}
	</div>
</div>

<style>
	.pptx-svelte-outline {
		position: fixed;
		inset: 0;
		z-index: 1300;
		display: flex;
		flex-direction: column;
		background: #171721;
		color: #f1f1f5;
	}

	.pptx-svelte-outline-header {
		display: flex;
		align-items: center;
		gap: 12px;
		padding: 8px 16px;
		border-bottom: 1px solid rgb(255 255 255 / 10%);
	}

	.pptx-svelte-outline-title {
		font-size: 13px;
		font-weight: 600;
	}

	.pptx-svelte-outline-hint {
		flex: 1;
		overflow: hidden;
		color: rgb(255 255 255 / 50%);
		font-size: 11px;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.pptx-svelte-outline-header button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 32px;
		height: 32px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: rgb(255 255 255 / 80%);
		cursor: pointer;
	}

	.pptx-svelte-outline-header button:hover {
		background: rgb(255 255 255 / 15%);
		color: #fff;
	}

	.pptx-svelte-outline-rows {
		flex: 1;
		min-height: 0;
		overflow: auto;
		padding: 12px 16px;
	}

	.pptx-svelte-outline-row {
		display: flex;
		align-items: center;
		gap: 8px;
		padding: 2px 0;
	}

	.pptx-svelte-outline-number {
		flex: none;
		width: 24px;
		color: rgb(255 255 255 / 40%);
		font-size: 10px;
		font-variant-numeric: tabular-nums;
		text-align: right;
	}

	.pptx-svelte-outline-row input {
		flex: 1;
		min-width: 0;
		padding: 2px 4px;
		border: 0;
		border-radius: 4px;
		background: transparent;
		color: rgb(255 255 255 / 80%);
		font: inherit;
		font-size: 13px;
	}

	.pptx-svelte-outline-row input:focus {
		background: rgb(255 255 255 / 10%);
		outline: none;
	}

	/* Compounded with the row rule above, which would otherwise out-specify it. */
	.pptx-svelte-outline-row input.pptx-svelte-outline-input-title {
		color: #f1f1f5;
		font-size: 14px;
		font-weight: 600;
	}
</style>
