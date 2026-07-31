<script lang="ts">
	/**
	 * AltTextSection: the accessibility alt-text field, matching React's control
	 * in `inspector/ElementTransformControls.tsx` and Vue's in `ImagePanel.vue`.
	 *
	 * WHY it matters: `altText` is the only thing a screen reader has to go on
	 * for a picture, and the shared `element-accessibility-dom` helpers already
	 * publish it as the rendered element's `aria-label`. Without an editing
	 * surface a Svelte author simply cannot author accessible decks.
	 *
	 * `altText` lives on `PptxImageProperties`, so the field is only meaningful
	 * for image-like elements; the caller gates on that and the guard below
	 * keeps the read type-safe rather than casting the way React does.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import { isImageLikeElement } from 'pptx-viewer-core';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();
	const canEdit = $derived(editor.editable);
	const altText = $derived(isImageLikeElement(el) ? (el.altText ?? '') : '');
</script>

<label class="pptx-svelte-alt-text">
	<span>{t('pptx.image.altText')}</span>
	<textarea
		rows="2"
		disabled={!canEdit}
		placeholder={t('pptx.imageTransform.altTextPlaceholder')}
		value={altText}
		oninput={(event) =>
			editor.applyElementPatch(el.id, { altText: event.currentTarget.value } as Partial<PptxElement>)}
	></textarea>
</label>

<style>
	.pptx-svelte-alt-text {
		display: flex;
		flex-direction: column;
		gap: 3px;
		margin-top: 10px;
	}

	.pptx-svelte-alt-text span {
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.pptx-svelte-alt-text textarea {
		width: 100%;
		box-sizing: border-box;
		padding: 4px 6px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-background, #11111b);
		color: inherit;
		font: inherit;
		resize: vertical;
	}
</style>
