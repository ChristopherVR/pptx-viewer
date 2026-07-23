<script lang="ts">
	/**
	 * Quick Access Toolbar strip in the title bar, driven by File > Options >
	 * Quick Access Toolbar: visibility, command order, and the "always show
	 * command labels" toggle all come from the options store. Each catalog id
	 * maps to an existing viewer handler via the `onexec` callback; tooltips
	 * honor the ScreenTip style (Options > General).
	 */
	import FileDown from '@lucide/svelte/icons/file-down';
	import Play from '@lucide/svelte/icons/play';
	import Plus from '@lucide/svelte/icons/plus';
	import Printer from '@lucide/svelte/icons/printer';
	import Redo from '@lucide/svelte/icons/redo';
	import Save from '@lucide/svelte/icons/save';
	import SpellCheck from '@lucide/svelte/icons/spell-check';
	import Undo from '@lucide/svelte/icons/undo';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import { getQuickAccessCommand } from 'pptx-viewer-shared';
	import type { Component } from 'svelte';
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

	/** Catalog icon name -> Lucide component (same mapping React's QAT uses). */
	const ICONS: Record<string, Component> = {
		save: Save,
		undo: Undo,
		redo: Redo,
		play: Play,
		printer: Printer,
		fileDown: FileDown,
		plus: Plus,
		spellCheck: SpellCheck,
		zoomIn: ZoomIn,
		zoomOut: ZoomOut,
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
				{@const Icon = ICONS[command.icon] ?? Save}
				<button
					type="button"
					aria-label={label}
					title={optionsState.screenTip(label)}
					disabled={isDisabled(id)}
					onclick={() => onexec(id)}
				>
					<Icon size={14} aria-hidden="true" />
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
	button small { font-size: 10px; white-space: nowrap; }
</style>
