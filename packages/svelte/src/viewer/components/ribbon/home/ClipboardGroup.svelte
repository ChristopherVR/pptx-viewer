<script lang="ts">
	/**
	 * ClipboardGroup: cut / copy / paste / duplicate / delete for the Home
	 * tab. Copy works even read-only (matches React); cut/paste/duplicate/
	 * delete require `editable`. All mutations route through `EditorState`
	 * (`clipboardOps` for cut/copy/paste, the core `duplicateSelected` /
	 * `deleteSelected` for the rest) so undo/redo covers every action.
	 */
	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';

	const { editor }: { editor: EditorState } = $props();
	const t = useTranslator();

	const hasSelection = $derived(editor.selectedElementId !== null);
	const canMutate = $derived(editor.editable && hasSelection);
</script>

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.ribbon.clipboard')}>
	<span class="pptx-svelte-rgroup-label">{t('pptx.ribbon.clipboard')}</span>
	<div class="pptx-svelte-rgroup-row">
		<button
			type="button"
			data-testid="format-painter-toggle"
			data-active={editor.formatPainter.active}
			aria-pressed={editor.formatPainter.active}
			disabled={!editor.formatPainter.enabled}
			aria-label={t('pptx.arrange.formatPainter')}
			title={t('pptx.arrange.formatPainter')}
			onclick={() => editor.formatPainter.toggle()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 3h8v4H3zM11 4h2v5H8v4H6V8h5" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linejoin="round" /></svg>
		</button>
		<button
			type="button"
			disabled={!editor.hasClipboard || !editor.editable}
			aria-label={t('pptx.arrange.paste')}
			title={t('pptx.arrange.paste')}
			onclick={() => editor.clipboardOps.pasteClipboard()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3h6v2H5zM4 4h8v10H4zM6 7h4M6 9.5h4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
		</button>
		<button
			type="button"
			disabled={!canMutate}
			aria-label={t('pptx.arrange.cut')}
			title={t('pptx.arrange.cut')}
			onclick={() => editor.clipboardOps.cutSelected()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 6 12.5 12.5M10 6 3.5 12.5M8 8l4-4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /><circle cx="5" cy="5" r="1.4" fill="none" stroke="currentColor" stroke-width="1.1" /><circle cx="5" cy="13" r="1.4" fill="none" stroke="currentColor" stroke-width="1.1" /></svg>
		</button>
		<button
			type="button"
			disabled={!hasSelection}
			aria-label={t('pptx.arrange.copy')}
			title={t('pptx.arrange.copy')}
			onclick={() => editor.clipboardOps.copySelected()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="5.5" y="5.5" width="8" height="8" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><path d="M3 10V3h7" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
		</button>
		<button
			type="button"
			disabled={!canMutate}
			aria-label={t('pptx.arrange.duplicate')}
			title={t('pptx.arrange.duplicate')}
			onclick={() => editor.duplicateSelected()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="2.5" y="4.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /><rect x="6.5" y="6.5" width="7" height="7" rx="1" fill="none" stroke="currentColor" stroke-width="1.2" /></svg>
		</button>
		<button
			type="button"
			class="pptx-svelte-rgroup-danger"
			disabled={!canMutate}
			aria-label={t('pptx.arrange.delete')}
			title={t('pptx.arrange.delete')}
			onclick={() => editor.deleteSelected()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3.5 4.5h9M6 4.5V3h4v1.5M5 4.5l.6 8.2c.05.7.6 1.3 1.3 1.3h2.2c.7 0 1.25-.6 1.3-1.3l.6-8.2" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round" /></svg>
		</button>
	</div>
</div>

<style>
	.pptx-svelte-rgroup {
		display: flex;
		flex-direction: column;
		align-items: center;
		gap: 3px;
	}

	.pptx-svelte-rgroup-label {
		font-size: 9px;
		color: var(--pptx-muted-foreground, #94a3b8);
		line-height: 1;
	}

	.pptx-svelte-rgroup-row {
		display: inline-flex;
		align-items: center;
		gap: 1px;
		border-radius: var(--pptx-radius, 6px);
		background: var(--pptx-muted, #2a2a3d);
		overflow: hidden;
	}

	.pptx-svelte-rgroup-row button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		padding: 0 5px;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-rgroup-row button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-rgroup-row button:disabled {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-rgroup-row svg {
		width: 14px;
		height: 14px;
	}

	.pptx-svelte-rgroup-danger:hover:not(:disabled) {
		background: #7f1d1d !important;
		color: #fecaca !important;
	}
</style>
