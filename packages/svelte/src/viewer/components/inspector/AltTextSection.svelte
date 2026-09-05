<script lang="ts">
	/**
	 * AltTextSection: the accessibility alt-text / title editor, matching
	 * React's `AccessibilityTextSection` / `ImagePropertiesPanel` and Vue's
	 * `AccessibilityPanel.vue` / `ImagePanel.vue`.
	 *
	 * WHY it matters: `altText` is the only thing a screen reader has to go on
	 * for a picture, shape, text box or connector, and the shared
	 * `element-accessibility-dom` helpers already publish it as the rendered
	 * element's `aria-label`. Without an editing surface a Svelte author
	 * simply cannot author accessible decks.
	 *
	 * `getNonVisualDescriptionFields` (shared) decides which of `altText` /
	 * `title` apply to `el`'s kind (a picture models only `altText`; a plain
	 * shape/text box/connector and every graphic-frame kind model both), so
	 * this component stays a thin view mounted for both cases by
	 * `InspectorPanel.svelte`.
	 */
	import type { PptxElement } from 'pptx-viewer-core';
	import { getNonVisualDescriptionFields } from 'pptx-viewer-shared';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const { editor, el }: { editor: EditorState; el: PptxElement } = $props();
	const t = useTranslator();
	const canEdit = $derived(editor.editable);
	const fields = $derived(getNonVisualDescriptionFields(el));
</script>

{#if fields.showAltText}
	<label class="pptx-svelte-alt-text">
		<span>{t('pptx.elementAccessibility.altText')}</span>
		<textarea
			rows="2"
			disabled={!canEdit}
			placeholder={t('pptx.elementAccessibility.altTextPlaceholder')}
			value={fields.altText}
			oninput={(event) =>
				editor.applyElementPatch(el.id, {
					altText: event.currentTarget.value,
				} as Partial<PptxElement>)}
		></textarea>
	</label>
{/if}

{#if fields.showTitle}
	<label class="pptx-svelte-alt-text">
		<span>{t('pptx.elementAccessibility.title')}</span>
		<input
			type="text"
			disabled={!canEdit}
			placeholder={t('pptx.elementAccessibility.titlePlaceholder')}
			value={fields.title}
			oninput={(event) =>
				editor.applyElementPatch(el.id, {
					title: event.currentTarget.value,
				} as Partial<PptxElement>)}
		/>
	</label>
{/if}

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

	.pptx-svelte-alt-text textarea,
	.pptx-svelte-alt-text input {
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
