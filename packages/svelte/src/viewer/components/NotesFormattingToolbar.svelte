<script lang="ts">
	import Bold from '@lucide/svelte/icons/bold';
	import Italic from '@lucide/svelte/icons/italic';
	import Link from '@lucide/svelte/icons/link';
	import IndentDecrease from '@lucide/svelte/icons/list-indent-decrease';
	import IndentIncrease from '@lucide/svelte/icons/list-indent-increase';
	import ListOrdered from '@lucide/svelte/icons/list-ordered';
	import List from '@lucide/svelte/icons/list';
	import Strikethrough from '@lucide/svelte/icons/strikethrough';
	import Underline from '@lucide/svelte/icons/underline';
	import { useTranslator } from '../../i18n/context';

	const { rich, disabled = false, oninline, onparagraph, onlink, ontogglemode }: {
		rich: boolean;
		disabled?: boolean;
		oninline: (command: 'bold' | 'italic' | 'underline' | 'strikeThrough') => void;
		onparagraph: (command: 'bullet' | 'numbered' | 'indent' | 'outdent') => void;
		onlink: () => void;
		ontogglemode: () => void;
	} = $props();
	const t = useTranslator();
</script>

<div class="pptx-svelte-notes-toolbar" aria-label={t('pptx.notesToolbar.ariaLabel')}>
	{#if rich}
		<button type="button" {disabled} title={t('pptx.notes.bold')} aria-label={t('pptx.notes.bold')} onclick={() => oninline('bold')}><Bold size={14} aria-hidden="true" /></button>
		<button type="button" {disabled} title={t('pptx.notes.italic')} aria-label={t('pptx.notes.italic')} onclick={() => oninline('italic')}><Italic size={14} aria-hidden="true" /></button>
		<button type="button" {disabled} title={t('pptx.notes.underline')} aria-label={t('pptx.notes.underline')} onclick={() => oninline('underline')}><Underline size={14} aria-hidden="true" /></button>
		<button type="button" {disabled} title={t('pptx.notes.strikethrough')} aria-label={t('pptx.notes.strikethrough')} onclick={() => oninline('strikeThrough')}><Strikethrough size={14} aria-hidden="true" /></button>
		<span></span>
		<button type="button" {disabled} title={t('pptx.notes.bulletList')} aria-label={t('pptx.notes.bulletList')} onclick={() => onparagraph('bullet')}><List size={14} aria-hidden="true" /></button>
		<button type="button" {disabled} title={t('pptx.notes.numberedList')} aria-label={t('pptx.notes.numberedList')} onclick={() => onparagraph('numbered')}><ListOrdered size={14} aria-hidden="true" /></button>
		<button type="button" {disabled} title={t('pptx.notes.outdent')} aria-label={t('pptx.notes.outdent')} onclick={() => onparagraph('outdent')}><IndentDecrease size={14} aria-hidden="true" /></button>
		<button type="button" {disabled} title={t('pptx.notes.indent')} aria-label={t('pptx.notes.indent')} onclick={() => onparagraph('indent')}><IndentIncrease size={14} aria-hidden="true" /></button>
		<button type="button" {disabled} title={t('pptx.notes.insertLink')} aria-label={t('pptx.notes.insertLink')} onclick={onlink}><Link size={14} aria-hidden="true" /></button>
	{/if}
	<button type="button" {disabled} class:active={rich} onclick={ontogglemode} title={rich ? t('pptx.notes.switchToPlainEditor') : t('pptx.notes.switchToRichEditor')}>
		{rich ? t('pptx.notesToolbar.plain') : t('pptx.notesToolbar.rich')}
	</button>
</div>

<style>
	.pptx-svelte-notes-toolbar { display: flex; align-items: center; gap: 2px; margin-bottom: 6px; }
	.pptx-svelte-notes-toolbar span { width: 1px; height: 16px; margin: 0 3px; background: var(--pptx-border, #33334d); }
	.pptx-svelte-notes-toolbar button { display: inline-flex; align-items: center; justify-content: center; min-width: 25px; height: 24px; padding: 0 5px; border: 1px solid transparent; border-radius: 3px; background: transparent; color: inherit; font: 600 12px system-ui, sans-serif; cursor: pointer; }
	.pptx-svelte-notes-toolbar button:hover, .pptx-svelte-notes-toolbar button.active { border-color: var(--pptx-border, #33334d); background: var(--pptx-accent, #33334d); }
	.pptx-svelte-notes-toolbar button:disabled { cursor: not-allowed; opacity: .45; }
</style>
