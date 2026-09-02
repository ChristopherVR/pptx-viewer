<script lang="ts">
	/**
	 * DrawTab: the ribbon's Draw tab. A four-way tool selector (Select / Pen /
	 * Highlighter / Eraser) plus stroke colour and width controls, all backed
	 * by `EditorState.inkOps` (`EditorInkController`). Selecting a draw tool
	 * clears the current selection (see `EditorInkController.setTool`), so the
	 * selection overlay's own resize/rotate handles never race a drawing
	 * gesture over the same screen area.
	 *
	 * The pointer-to-stroke pipeline itself (accumulate points -> live preview
	 * -> commit an `ink` `PptxElement`, or hit-test + delete for the eraser) is
	 * wired on the stage holder by `EditorController` + `createInkGestureController`
	 * (`editor-ink-gesture.ts`); this tab only edits tool/colour/width state,
	 * matching the thin-presentation split every other ribbon tab follows.
	 *
	 * Freeform shares the pen's gesture but commits a closed custom-geometry
	 * `shape` instead of an `ink` stroke, so the result can be filled, outlined
	 * and reshaped like any other shape afterwards (`editor-freeform.ts`).
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { InkDrawTool } from '../../../editor/editor-ink-controller.svelte';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import SwatchColorPicker from '../SwatchColorPicker.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const ink = $derived(editor.inkOps);

	const MIN_WIDTH = 1;
	const MAX_WIDTH = 12;

	const TOOLS: ReadonlyArray<{ id: InkDrawTool; labelKey: string }> = [
		{ id: 'select', labelKey: 'pptx.ribbon.tool.select' },
		{ id: 'pen', labelKey: 'pptx.ribbon.tool.pen' },
		{ id: 'highlighter', labelKey: 'pptx.ribbon.tool.highlighter' },
		{ id: 'eraser', labelKey: 'pptx.ribbon.tool.eraser' },
		{ id: 'freeform', labelKey: 'pptx.ribbon.tool.freeform' },
	];
</script>

<div class="pptx-svelte-drawtab" role="group" aria-label={t('pptx.ribbon.tab.draw')}>
	<div class="pptx-svelte-drawtab-tools" role="group" aria-label={t('pptx.ribbon.tab.draw')}>
		{#each TOOLS as tool (tool.id)}
			<button
				type="button"
				class="pptx-svelte-drawtab-tool"
				class:pptx-svelte-drawtab-tool-active={ink.tool === tool.id}
				disabled={!editor.editable}
				aria-pressed={ink.tool === tool.id}
				aria-label={t(tool.labelKey)}
				title={t(tool.labelKey)}
				onclick={() => ink.setTool(tool.id)}
			>
				{#if tool.id === 'select'}
					<svg viewBox="0 0 16 16" aria-hidden="true"
						><path d="M3 2.5 12.5 9l-3.6.6L11 13l-1.6 1-2.1-3.4L4.8 13z" fill="currentColor" /></svg
					>
				{:else if tool.id === 'pen'}
					<svg viewBox="0 0 16 16" aria-hidden="true"
						><path
							d="M10.5 2.5 13.5 5.5 5.5 13.5 2 14l.5-3.5z"
							fill="none"
							stroke="currentColor"
							stroke-width="1.3"
							stroke-linejoin="round"
						/></svg
					>
				{:else if tool.id === 'highlighter'}
					<svg viewBox="0 0 16 16" aria-hidden="true"
						><rect x="2" y="9.5" width="7" height="3.5" fill="currentColor" opacity="0.5" /><path
							d="M9 3 13 7 8 12 4 8z"
							fill="none"
							stroke="currentColor"
							stroke-width="1.3"
							stroke-linejoin="round"
						/></svg
					>
				{:else if tool.id === 'eraser'}
					<svg viewBox="0 0 16 16" aria-hidden="true"
						><rect
							x="3"
							y="7.5"
							width="10"
							height="5"
							rx="1"
							transform="rotate(-20 8 10)"
							fill="none"
							stroke="currentColor"
							stroke-width="1.3"
						/><path d="M2.5 14h11" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg
					>
				{:else}
					<svg viewBox="0 0 16 16" aria-hidden="true"
						><path
							d="M2.5 12c1-5 3-8 5-8s1.5 5 3 5 2-2 3-3"
							fill="none"
							stroke="currentColor"
							stroke-width="1.3"
							stroke-linecap="round"
							stroke-linejoin="round"
						/></svg
					>
				{/if}
			</button>
		{/each}
	</div>

	<SwatchColorPicker
		value={ink.color}
		disabled={!editor.editable}
		label={t('pptx.ribbon.colour')}
		title={t('pptx.ribbon.penColour')}
		glyph="P"
		recentColors={editor.mruColors}
		onselect={(hex) => {
			ink.setColor(hex);
			editor.recordRecentColor(hex);
		}}
	/>

	<label class="pptx-svelte-drawtab-width" title={t('pptx.ribbon.strokeWidth')}>
		<span>{t('pptx.ribbon.width')}</span>
		<input
			type="range"
			min={MIN_WIDTH}
			max={MAX_WIDTH}
			disabled={!editor.editable}
			value={ink.width}
			oninput={(e) => ink.setWidth(Number(e.currentTarget.value))}
		/>
		<span class="pptx-svelte-drawtab-width-value">{ink.width}</span>
	</label>
</div>

<style>
	.pptx-svelte-drawtab {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 8px;
	}

	.pptx-svelte-drawtab-tools {
		display: inline-flex;
		align-items: center;
		gap: 2px;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		overflow: hidden;
	}

	.pptx-svelte-drawtab-tool {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 30px;
		height: 28px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-drawtab-tool:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-drawtab-tool:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-drawtab-tool-active {
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-drawtab-tool svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-drawtab-width {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 11.5px;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
	}

	.pptx-svelte-drawtab-width input[type='range'] {
		width: 72px;
		accent-color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-drawtab-width-value {
		min-width: 14px;
		text-align: right;
		color: var(--pptx-card-foreground, #e2e8f0);
	}
</style>
