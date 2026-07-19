<script lang="ts">
	/**
	 * Quick Access Toolbar strip in the title bar, driven by File > Options >
	 * Quick Access Toolbar: visibility, command order, and the "always show
	 * command labels" toggle all come from the options store. Each catalog id
	 * maps to an existing viewer handler via the `onexec` callback; tooltips
	 * honor the ScreenTip style (Options > General).
	 */
	import { getQuickAccessCommand } from 'pptx-viewer-shared';
	import { useTranslator } from '../../i18n/context';
	import { useViewerOptions } from '../state/viewer-options-context';

	const {
		canUndo,
		canRedo,
		onexec,
	}: {
		canUndo: boolean;
		canRedo: boolean;
		onexec: (commandId: string) => void;
	} = $props();
	const t = useTranslator();
	const optionsState = useViewerOptions();
	const quickAccess = $derived(optionsState.options.quickAccess);

	const GLYPHS: Record<string, string> = {
		save: '⤓',
		undo: '↶',
		redo: '↷',
		presentFromStart: '▶',
		print: '⎙',
		exportPdf: '⇩',
		newSlide: '＋',
		spellCheck: '✓',
		zoomIn: '⊕',
		zoomOut: '⊖',
	};

	function isDisabled(id: string): boolean {
		return (id === 'undo' && !canUndo) || (id === 'redo' && !canRedo);
	}
</script>

{#if quickAccess.visible && quickAccess.commandIds.length > 0}
	<div class="pptx-svelte-quick-access" role="toolbar" aria-label={t('pptx.options.quickAccess.label')}>
		{#each quickAccess.commandIds as id (id)}
			{@const command = getQuickAccessCommand(id)}
			{#if command}
				{@const label = t(command.labelKey)}
				<button
					type="button"
					aria-label={label}
					title={optionsState.screenTip(label)}
					disabled={isDisabled(id)}
					onclick={() => onexec(id)}
				>
					<span aria-hidden="true">{GLYPHS[id] ?? '·'}</span>
					{#if quickAccess.showCommandLabels}<small>{label}</small>{/if}
				</button>
			{/if}
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-quick-access { display: flex; align-items: center; gap: 2px; }
	button { display: inline-flex; align-items: center; gap: 4px; min-height: 24px; border: 0; border-radius: 3px; padding: 2px 5px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
	button:hover:not(:disabled) { background: var(--pptx-accent, #33334d); }
	button:disabled { opacity: 0.4; cursor: default; }
	button span { font-size: 13px; line-height: 1; }
	button small { font-size: 10px; white-space: nowrap; }
</style>
