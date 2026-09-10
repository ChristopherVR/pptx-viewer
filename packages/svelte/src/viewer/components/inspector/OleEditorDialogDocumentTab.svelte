<script lang="ts">
	/**
	 * OleEditorDialogDocumentTab: the "document" content tab of `OleEditorDialog`,
	 * mirroring React's `OleDocumentEditor` in `OleEditorDialogTabs.tsx`. Loads
	 * the Word-payload paragraph list on mount, and commits each paragraph's edit
	 * on blur through core's `applyOleDocumentParagraphEdit` + the same
	 * `editor.applyElementPatch` path every other inspector field uses.
	 */
	import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
	import { applyOleDocumentParagraphEdit, getOleDocumentParagraphs } from 'pptx-viewer-core';
	import { buildOleContentUpdatePatch } from 'pptx-viewer-shared';
	import { onDestroy } from 'svelte';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';

	const {
		editor,
		el,
		onerror,
	}: {
		editor: EditorState;
		el: OlePptxElement;
		onerror: () => void;
	} = $props();
	const t = useTranslator();

	let paragraphs = $state<string[] | undefined>(undefined);
	let loading = $state(true);

	// `handleParagraphBlur` below settles after its own re-encode await, which
	// can outlive the component if it is destroyed first. Guard the
	// post-await state writes with this so a late resolution never writes
	// into a destroyed component.
	let alive = true;
	onDestroy(() => {
		alive = false;
	});

	$effect(() => {
		let cancelled = false;
		loading = true;
		void (async (): Promise<void> => {
			const value = await getOleDocumentParagraphs(el);
			if (!cancelled) {
				paragraphs = value;
				loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	async function handleParagraphBlur(index: number, text: string, previous: string): Promise<void> {
		if (text === previous) {
			return;
		}
		try {
			const updated = await applyOleDocumentParagraphEdit(el, index, text);
			if (updated.oleContentDirty) {
				editor.applyElementPatch(el.id, buildOleContentUpdatePatch(updated) as Partial<PptxElement>);
			}
			const refreshed = await getOleDocumentParagraphs(updated);
			if (alive) {
				paragraphs = refreshed;
			}
		} catch {
			if (alive) {
				onerror();
			}
		}
	}
</script>

{#if loading}
	<p class="hint">{t('pptx.ole.editDialog.loading')}</p>
{:else if !paragraphs || paragraphs.length === 0}
	<p class="hint">{t('pptx.ole.editDialog.emptyDocument')}</p>
{:else}
	<div class="paragraphs">
		{#each paragraphs as paragraph, index (index)}
			<textarea
				rows="2"
				value={paragraph}
				onblur={(event) => void handleParagraphBlur(index, event.currentTarget.value, paragraph)}
			></textarea>
		{/each}
	</div>
{/if}

<style>
	.hint {
		margin: 0;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.paragraphs {
		display: flex;
		flex-direction: column;
		gap: 8px;
	}

	textarea {
		box-sizing: border-box;
		width: 100%;
		padding: 6px 8px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
		resize: vertical;
	}

	textarea:focus {
		outline: 2px solid var(--pptx-primary, #c43b32);
		outline-offset: -1px;
	}
</style>
