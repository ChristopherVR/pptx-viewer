<script lang="ts">
	import RibbonIcon from '../RibbonIcon.svelte';
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

<div class="pptx-svelte-rgroup" role="group" aria-label={t('pptx.ribbon.clipboard')} data-ribbon-group="home.clipboard">
	<div class="pptx-svelte-rgroup-row">
		<button
			type="button"
			disabled={!editor.hasClipboard || !editor.editable}
			data-ribbon-control="home.clipboard.paste"
			aria-label={t('pptx.arrange.paste')}
			title={t('pptx.arrange.paste')}
			onclick={() => editor.clipboardOps.pasteClipboard()}
		>
			<RibbonIcon name="home.clipboard.paste" />
		</button>
		<button
			type="button"
			disabled={!canMutate}
			data-ribbon-control="home.clipboard.cut"
			aria-label={t('pptx.arrange.cut')}
			title={t('pptx.arrange.cut')}
			onclick={() => editor.clipboardOps.cutSelected()}
		>
			<RibbonIcon name="home.clipboard.cut" />
		</button>
		<button
			type="button"
			disabled={!hasSelection}
			data-ribbon-control="home.clipboard.copy"
			aria-label={t('pptx.arrange.copy')}
			title={t('pptx.arrange.copy')}
			onclick={() => editor.clipboardOps.copySelected()}
		>
			<RibbonIcon name="home.clipboard.copy" />
		</button>
		<button
			type="button"
			data-testid="format-painter-toggle"
			data-active={editor.formatPainter.active}
			aria-pressed={editor.formatPainter.active}
			disabled={!editor.formatPainter.enabled}
			data-ribbon-control="home.clipboard.formatPainter"
			aria-label={t('pptx.arrange.formatPainter')}
			title={t('pptx.arrange.formatPainter')}
			onclick={() => editor.formatPainter.toggle()}
		>
			<RibbonIcon name="home.clipboard.formatPainter" />
		</button>
	</div>
	<span class="pptx-svelte-rgroup-label">{t('pptx.ribbon.clipboard')}</span>
</div>

<style>
	.pptx-svelte-rgroup {
		display: flex;
		flex: none;
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
