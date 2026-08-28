<script lang="ts">
	/**
	 * Quick Access Toolbar "below the Ribbon" row: File > Options > Quick
	 * Access Toolbar > position `'below'` moves the configured extras here,
	 * directly under the ribbon, instead of inline in the title bar
	 * (`TitleBar.svelte`'s `extraQuickCommands`, gated to skip them while this
	 * row is showing). Save/Undo/Redo stay dedicated title-bar buttons in both
	 * positions (they carry undo-state the generic strip has no way to know),
	 * so only `extraQuickAccessCommands` renders here.
	 */
	import Play from '@lucide/svelte/icons/play';
	import Printer from '@lucide/svelte/icons/printer';
	import FileDown from '@lucide/svelte/icons/file-down';
	import Plus from '@lucide/svelte/icons/plus';
	import SpellCheck from '@lucide/svelte/icons/spell-check';
	import ZoomIn from '@lucide/svelte/icons/zoom-in';
	import ZoomOut from '@lucide/svelte/icons/zoom-out';
	import { extraQuickAccessCommands } from 'pptx-viewer-shared';
	import type { Component } from 'svelte';
	import { useTranslator } from '../../i18n/context';
	import { useViewerOptions } from '../state/viewer-options-context';

	const {
		onexec,
	}: {
		onexec: (commandId: string) => void;
	} = $props();
	const t = useTranslator();
	const optionsState = useViewerOptions();
	const quickAccess = $derived(optionsState.options.quickAccess);
	const commands = $derived(extraQuickAccessCommands(quickAccess.commandIds));

	/** Catalog icon name -> Lucide component (same mapping the title bar uses). */
	const ICONS: Record<string, Component> = {
		play: Play,
		printer: Printer,
		fileDown: FileDown,
		plus: Plus,
		spellCheck: SpellCheck,
		zoomIn: ZoomIn,
		zoomOut: ZoomOut,
	};
</script>

{#if quickAccess.visible && quickAccess.position === 'below' && commands.length > 0}
	<div class="pptx-svelte-quick-access" role="toolbar" aria-label={t('pptx.options.quickAccess.label')}>
		{#each commands as command (command.id)}
			{@const label = t(command.labelKey)}
			{@const Icon = ICONS[command.icon] ?? Play}
			<button
				type="button"
				aria-label={label}
				title={optionsState.screenTip(label)}
				onclick={() => onexec(command.id)}
			>
				<Icon size={14} aria-hidden="true" />
				{#if quickAccess.showCommandLabels}<small>{label}</small>{/if}
			</button>
		{/each}
	</div>
{/if}

<style>
	.pptx-svelte-quick-access { display: flex; align-items: center; gap: 2px; padding: 3px 8px; border-bottom: 1px solid var(--pptx-border, #33334d); background: color-mix(in srgb, var(--pptx-card, #1e1e2e) 88%, #000); color: var(--pptx-card-foreground, #e2e8f0); }
	button { display: inline-flex; align-items: center; gap: 4px; min-height: 24px; border: 0; border-radius: 3px; padding: 2px 5px; background: transparent; color: inherit; font: inherit; cursor: pointer; }
	button:hover:not(:disabled) { background: var(--pptx-accent, #33334d); }
	button:disabled { opacity: 0.4; cursor: default; }
	button small { font-size: 10px; white-space: nowrap; }
</style>
