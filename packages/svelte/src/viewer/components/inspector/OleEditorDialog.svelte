<script lang="ts">
	/**
	 * OleEditorDialog: "Edit content" modal for an embedded OLE object,
	 * mirroring React's `OleEditorDialog.tsx`. Which content tab it shows
	 * (spreadsheet grid / document paragraphs / nested-deck slide titles, or
	 * just Replace File) comes from the shared, framework-neutral
	 * `buildOleEditDialogDescriptor`; the actual tab is delegated to one of
	 * `OleEditorDialogSheetTab` / `OleEditorDialogDocumentTab` /
	 * `OleEditorDialogDeckTab`, split into their own files (a `.svelte` file
	 * can only default-export one component, unlike React's
	 * `OleEditorDialogTabs.tsx`) to respect the 300-LOC file limit.
	 *
	 * Replace File is always offered regardless of payload kind and lives here
	 * (not in a tab) since it applies to every kind, including an unsupported
	 * one. Every edit commits through core's `ole-edit-api.ts` and the same
	 * `editor.applyElementPatch` path every other inspector field uses, so
	 * undo/history/collaboration sync works exactly like a typed-field edit.
	 */
	import type { OlePptxElement, PptxElement } from 'pptx-viewer-core';
	import { replaceOleFile } from 'pptx-viewer-core';
	import { buildOleContentUpdatePatch, buildOleEditDialogDescriptor } from 'pptx-viewer-shared';
	import { onDestroy } from 'svelte';

	import { useTranslator } from '../../../i18n/context';
	import type { EditorState } from '../../editor/editor-state.svelte';
	import OleEditorDialogDeckTab from './OleEditorDialogDeckTab.svelte';
	import OleEditorDialogDocumentTab from './OleEditorDialogDocumentTab.svelte';
	import OleEditorDialogSheetTab from './OleEditorDialogSheetTab.svelte';

	const {
		editor,
		el,
		open,
		onclose,
	}: {
		editor: EditorState;
		el: OlePptxElement;
		open: boolean;
		onclose: () => void;
	} = $props();
	const t = useTranslator();

	let fileInputEl = $state<HTMLInputElement | null>(null);
	let saveError = $state(false);

	// `handleReplaceFile` below settles after its own await, which can outlive
	// the component if it is destroyed first. Guard the post-await state
	// writes with this so a late resolution never writes into a destroyed
	// component.
	let alive = true;
	onDestroy(() => {
		alive = false;
	});

	const descriptor = $derived(buildOleEditDialogDescriptor(el));

	function commit(updated: OlePptxElement): void {
		if (!updated.oleContentDirty) {
			return;
		}
		editor.applyElementPatch(el.id, buildOleContentUpdatePatch(updated) as Partial<PptxElement>);
	}

	async function handleReplaceFile(file: File): Promise<void> {
		try {
			const bytes = new Uint8Array(await file.arrayBuffer());
			const updated = await replaceOleFile(el, bytes, file.name);
			commit(updated);
			if (alive) {
				onclose();
			}
		} catch {
			if (alive) {
				saveError = true;
			}
		}
	}

	function onFileChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		if (file) {
			void handleReplaceFile(file);
		}
		input.value = '';
	}

	function onKeydown(event: KeyboardEvent): void {
		event.stopPropagation();
		if (event.key === 'Escape') {
			onclose();
		}
	}

	function onBackdropClick(event: MouseEvent): void {
		if (event.target === event.currentTarget) {
			onclose();
		}
	}
</script>

{#if open}
	<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
	<div class="backdrop" onclick={onBackdropClick} onkeydown={onKeydown} role="presentation">
		<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
		<section role="dialog" tabindex="-1" aria-modal="true" aria-label={t(descriptor.titleKey)}>
			<header>
				<h2>{t(descriptor.titleKey)}</h2>
				<button type="button" class="close" aria-label={t('pptx.settings.close')} onclick={onclose}>&times;</button>
			</header>

			<div class="content">
				{#if saveError}
					<p class="error">{t('pptx.ole.editDialog.saveError')}</p>
				{/if}
				{#if descriptor.contentTab?.kind === 'sheet'}
					<OleEditorDialogSheetTab {editor} {el} onerror={() => (saveError = true)} />
				{:else if descriptor.contentTab?.kind === 'document'}
					<OleEditorDialogDocumentTab {editor} {el} onerror={() => (saveError = true)} />
				{:else if descriptor.contentTab?.kind === 'deck'}
					<OleEditorDialogDeckTab {editor} {el} onerror={() => (saveError = true)} />
				{:else}
					<p class="unsupported">{t('pptx.ole.editDialog.unsupported')}</p>
				{/if}
			</div>

			<footer>
				<input bind:this={fileInputEl} type="file" class="hidden-file-input" onchange={onFileChange} />
				<button type="button" class="replace" onclick={() => fileInputEl?.click()}>
					{t('pptx.ole.editDialog.replaceFile')}
				</button>
				<button type="button" class="primary" onclick={onclose}>
					{t('pptx.ole.editDialog.save')}
				</button>
			</footer>
		</section>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 1200;
		display: grid;
		place-items: center;
		background: #0009;
	}

	section {
		display: flex;
		flex-direction: column;
		gap: 12px;
		width: min(560px, calc(100vw - 32px));
		max-height: 80vh;
		overflow-y: auto;
		padding: 18px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: 11px;
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-foreground, #f3f4f6);
	}

	header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	h2 {
		margin: 0;
		font-size: 14px;
	}

	.close {
		border: none;
		background: none;
		color: var(--pptx-muted-foreground, #94a3b8);
		font-size: 16px;
		cursor: pointer;
		padding: 2px 6px;
		border-radius: var(--pptx-radius, 6px);
	}

	.close:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.content {
		display: flex;
		flex-direction: column;
		gap: 8px;
		font-size: 12px;
	}

	.error {
		margin: 0;
		font-size: 11px;
		color: var(--pptx-destructive, #ef4444);
	}

	.unsupported {
		margin: 0;
		font-size: 11px;
		color: var(--pptx-muted-foreground, #94a3b8);
	}

	.hidden-file-input {
		display: none;
	}

	footer {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 8px;
	}

	footer button {
		height: 28px;
		padding: 0 12px;
		border: 1px solid var(--pptx-border, #3f3f52);
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 12px;
	}

	footer button:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.primary {
		border-color: transparent;
		background: var(--pptx-primary, #c43b32);
		color: #fff;
	}

	.primary:hover {
		background: var(--pptx-primary, #c43b32);
		color: #fff;
		filter: brightness(1.1);
	}
</style>
