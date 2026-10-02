<script lang="ts">
	/**
	 * SlideBackgroundSection: the active slide's own background (solid colour
	 * plus the Clear Background action), at parity with React's
	 * `SlideBackgroundPanel`, Vue's and Angular's slide-background card. Clear
	 * visibility and enablement come from the shared
	 * `slideBackgroundClearState`, and one click is one undo step through
	 * `EditorState.backgroundOps`.
	 */
	import { normalizeHexColor, slideBackgroundClearState } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const slide = $derived(editor.slides[editor.currentSlideIndex]);
	const clearState = $derived(slideBackgroundClearState(slide, editor.editable));
</script>

<label class="pptx-svelte-background-colour">
	<span>{t('pptx.slideBackground.colour')}</span>
	<input
		type="color"
		disabled={!editor.editable}
		value={normalizeHexColor(slide?.backgroundColor, '#ffffff')}
		oninput={(e) => editor.backgroundOps.setSlideBackgroundColor(e.currentTarget.value)}
		onchange={(e) => editor.recordRecentColor(e.currentTarget.value)}
	/>
</label>
{#if clearState.visible}
	<button
		type="button"
		class="pptx-svelte-background-clear"
		disabled={!clearState.enabled}
		onclick={() => editor.backgroundOps.clearSlideBackground()}
	>
		{t('pptx.slideBackground.clearBackground')}
	</button>
{/if}

<style>
	.pptx-svelte-background-colour {
		display: flex;
		align-items: center;
		gap: 8px;
	}
	.pptx-svelte-background-clear {
		width: 100%;
		min-height: 28px;
		margin-top: 8px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 5px;
		background: var(--pptx-muted, #1e1e2e);
		color: inherit;
		font-size: 11px;
	}
</style>
