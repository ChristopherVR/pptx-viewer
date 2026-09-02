<script lang="ts">
	/**
	 * FormatBackgroundPanel: a docked solid-colour slide-background panel,
	 * mirroring `FindReplacePanel.svelte`'s docked
	 * idiom rather than a floating dialog. Sets/clears the current slide's
	 * background colour via `EditorState.backgroundOps` (undoable).
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor, open, onclose }: { editor: EditorState; open: boolean; onclose: () => void } =
		$props();
	const t = useTranslator();

	const DEFAULT_COLOR = '#ffffff';

	const currentColor = $derived(
		editor.slides[editor.currentSlideIndex]?.backgroundColor ?? DEFAULT_COLOR,
	);

	function onKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Escape') {
			onclose();
		}
	}
</script>

{#if open}
	<div
		class="pptx-svelte-formatbg"
		role="dialog"
		tabindex="-1"
		aria-label={t('pptx.ribbon.formatBackground')}
		onkeydown={onKeydown}
	>
		<label class="pptx-svelte-formatbg-color">
			<span>{t('pptx.ribbon.formatBackground')}</span>
			<input
				type="color"
				disabled={!editor.editable}
				value={currentColor}
				oninput={(e) => editor.backgroundOps.setSlideBackgroundColor(e.currentTarget.value)}
				onchange={(e) => editor.recordRecentColor(e.currentTarget.value)}
			/>
		</label>
		<button
			type="button"
			disabled={!editor.editable}
			onclick={() => editor.backgroundOps.clearSlideBackground()}
		>
			{t('pptx.ribbon.theme.default')}
		</button>
		<button type="button" class="pptx-svelte-formatbg-close" onclick={onclose}>
			{t('pptx.common.close')}
		</button>
	</div>
{/if}

<style>
	.pptx-svelte-formatbg {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 8px;
		width: 100%;
		padding: 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: calc(var(--pptx-radius, 6px) + 2px);
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
	}

	.pptx-svelte-formatbg-color {
		display: inline-flex;
		align-items: center;
		gap: 6px;
		font-size: 12px;
	}

	.pptx-svelte-formatbg-color input[type='color'] {
		width: 26px;
		height: 26px;
		padding: 0;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 4px;
		background: transparent;
		cursor: pointer;
	}

	.pptx-svelte-formatbg-color input:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-formatbg button {
		height: 28px;
		padding: 0 10px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
		white-space: nowrap;
	}

	.pptx-svelte-formatbg button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-formatbg button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-formatbg-close {
		margin-left: auto;
	}
</style>
