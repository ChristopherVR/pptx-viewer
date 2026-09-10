<script lang="ts">
	/**
	 * OleEditorDialogDeckTab: the "deck" content tab of `OleEditorDialog`,
	 * mirroring React's `OleDeckEditor` in `OleEditorDialogTabs.tsx`. Loads
	 * every slide's full text-element inventory on mount (every text-bearing
	 * shape, not just a "title" slot; see `ole-nested-deck-editor.ts`), and
	 * commits each shape's edit on blur through core's
	 * `applyOleNestedDeckElementTextEdit` + the same `editor.applyElementPatch`
	 * path every other inspector field uses.
	 */
	import type { OleNestedDeckSlideDetail, OlePptxElement, PptxElement } from 'pptx-viewer-core';
	import { applyOleNestedDeckElementTextEdit, getOleNestedDeckDetail } from 'pptx-viewer-core';
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

	let slides = $state<OleNestedDeckSlideDetail[] | undefined>(undefined);
	let loading = $state(true);

	// `handleElementBlur` below settles after its own full deck save/load
	// round-trip await, which can outlive the component if it is destroyed
	// first. Guard the post-await state writes with this so a late
	// resolution never writes into a destroyed component.
	let alive = true;
	onDestroy(() => {
		alive = false;
	});

	$effect(() => {
		let cancelled = false;
		loading = true;
		void (async (): Promise<void> => {
			const value = await getOleNestedDeckDetail(el);
			if (!cancelled) {
				slides = value;
				loading = false;
			}
		})();
		return () => {
			cancelled = true;
		};
	});

	async function handleElementBlur(
		slideIndex: number,
		elementId: string,
		text: string,
		previous: string,
	): Promise<void> {
		if (text === previous) {
			return;
		}
		try {
			const updated = await applyOleNestedDeckElementTextEdit(el, slideIndex, elementId, text);
			if (updated.oleContentDirty) {
				editor.applyElementPatch(el.id, buildOleContentUpdatePatch(updated) as Partial<PptxElement>);
			}
			const refreshed = await getOleNestedDeckDetail(updated);
			if (alive) {
				slides = refreshed;
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
{:else if !slides || slides.length === 0}
	<p class="hint">{t('pptx.ole.editDialog.deckEmpty')}</p>
{:else}
	<div class="slides">
		{#each slides as slide (slide.index)}
			<div class="slide-group">
				<span class="label">{t('pptx.ole.editDialog.deckSlideLabel', { number: slide.index + 1 })}</span>
				{#if slide.elements.length === 0}
					<p class="hint">{t('pptx.ole.editDialog.deckEmpty')}</p>
				{:else}
					{#each slide.elements as element (element.elementId)}
						<input
							type="text"
							value={element.text}
							onblur={(event) =>
								void handleElementBlur(
									slide.index,
									element.elementId,
									event.currentTarget.value,
									element.text,
								)}
						/>
					{/each}
				{/if}
			</div>
		{/each}
	</div>
{/if}

<style>
	.hint {
		margin: 0;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.slides {
		display: flex;
		flex-direction: column;
		gap: 12px;
	}

	.slide-group {
		display: flex;
		flex-direction: column;
		gap: 6px;
	}

	.label {
		font-size: 11px;
		font-weight: 600;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	input {
		box-sizing: border-box;
		width: 100%;
		padding: 6px 8px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		font: inherit;
	}

	input:focus {
		outline: 2px solid var(--pptx-primary, #c43b32);
		outline-offset: -1px;
	}
</style>
