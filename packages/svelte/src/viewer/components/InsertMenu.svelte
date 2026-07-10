<script lang="ts">
	/**
	 * InsertMenu: insert a text box, rectangle, ellipse, line, image (file
	 * picker), or 3x3 table onto the current slide. Every new element uses the
	 * shared factories (`newTextElement` / `newShapeElement` / `newTableElement`)
	 * so it matches the other bindings, and lands via `EditorState.insertElement`
	 * (fresh id, selected, history-integrated).
	 */
	import { useTranslator } from '../../i18n/context';
	import type { EditorState } from '../editor/editor-state.svelte';
	import {
		newImageElement,
		newShapeElement,
		newTableElement,
		newTextElement,
	} from '../editor';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	// eslint-disable-next-line prefer-const
	let fileInput = $state<HTMLInputElement | null>(null);

	/** Largest edge (px) a picked image is scaled to fit while keeping aspect. */
	const MAX_IMAGE_EDGE = 400;

	function pickImage(): void {
		fileInput?.click();
	}

	function onFileChange(event: Event): void {
		const input = event.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) {
			return;
		}
		const reader = new FileReader();
		reader.onload = () => {
			const dataUrl = typeof reader.result === 'string' ? reader.result : '';
			if (!dataUrl) {
				return;
			}
			const probe = new Image();
			probe.onload = () => {
				const ratio = Math.min(
					1,
					MAX_IMAGE_EDGE / Math.max(probe.naturalWidth || 1, probe.naturalHeight || 1),
				);
				const w = Math.max(1, Math.round((probe.naturalWidth || MAX_IMAGE_EDGE) * ratio));
				const h = Math.max(1, Math.round((probe.naturalHeight || MAX_IMAGE_EDGE) * ratio));
				editor.insertElement(newImageElement(dataUrl, 120, 120, w, h));
			};
			probe.onerror = () => {
				editor.insertElement(newImageElement(dataUrl, 120, 120, 300, 200));
			};
			probe.src = dataUrl;
		};
		reader.readAsDataURL(file);
	}
</script>

<div class="pptx-svelte-insert" role="group" aria-label={t('pptx.ribbon.insert')}>
	<button
		type="button"
		class="pptx-svelte-insert-btn"
		aria-label={t('pptx.insert.addTextBox')}
		title={t('pptx.insert.addTextBox')}
		onclick={() => editor.insertElement(newTextElement())}
	>
		<span aria-hidden="true">T</span>
	</button>
	<button
		type="button"
		class="pptx-svelte-insert-btn"
		aria-label={t('pptx.ribbon.rectangle')}
		title={t('pptx.ribbon.rectangle')}
		onclick={() => editor.insertElement(newShapeElement('rect'))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="3.5" width="11" height="9" rx="1" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-insert-btn"
		aria-label={t('pptx.ribbon.ellipse')}
		title={t('pptx.ribbon.ellipse')}
		onclick={() => editor.insertElement(newShapeElement('ellipse'))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><ellipse cx="8" cy="8" rx="5.5" ry="4.5" fill="none" stroke="currentColor" stroke-width="1.4" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-insert-btn"
		aria-label={t('pptx.ribbon.line')}
		title={t('pptx.ribbon.line')}
		onclick={() => editor.insertElement(newShapeElement('line'))}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 13 13 3" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-insert-btn"
		aria-label={t('pptx.ribbon.insertImage')}
		title={t('pptx.ribbon.insertImage')}
		onclick={pickImage}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v9h-11zM4 11l3-3 2 2 2.5-3 1.5 2" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /><circle cx="5.5" cy="6" r="1" fill="currentColor" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-insert-btn"
		aria-label={t('pptx.insert.insertTable')}
		title={t('pptx.insert.insertTable')}
		onclick={() => editor.insertElement(newTableElement())}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v9h-11zM2.5 6.5h11M2.5 9.5h11M6 3.5v9M10 3.5v9" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
	</button>
	<input
		bind:this={fileInput}
		type="file"
		accept="image/*"
		class="pptx-svelte-insert-file"
		onchange={onFileChange}
	/>
</div>

<style>
	.pptx-svelte-insert {
		display: inline-flex;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-insert-btn {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 28px;
		height: 28px;
		padding: 0 6px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 13px;
		font-weight: 600;
	}

	.pptx-svelte-insert-btn:hover {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-insert-btn svg {
		width: 16px;
		height: 16px;
	}

	.pptx-svelte-insert-file {
		display: none;
	}
</style>
