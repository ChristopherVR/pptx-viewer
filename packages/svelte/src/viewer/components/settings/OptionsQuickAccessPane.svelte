<script lang="ts">
	/**
	 * Options > Quick Access Toolbar: PowerPoint's dual-list command chooser
	 * with Add/Remove, reorder arrows, and Reset over the shared catalog.
	 */
	import type { ViewerOptions } from 'pptx-viewer-shared';
	import {
		QUICK_ACCESS_COMMAND_CATALOG,
		addQuickAccessCommand,
		availableQuickAccessCommands,
		moveQuickAccessCommand,
		removeQuickAccessCommand,
	} from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';

	const {
		options,
		oncommandschange,
		onreset,
	}: {
		options: ViewerOptions;
		oncommandschange: (commandIds: string[]) => void;
		onreset: () => void;
	} = $props();
	const t = useTranslator();
	let selectedAvailable = $state<string | null>(null);
	let selectedCurrent = $state<string | null>(null);
	const current = $derived(options.quickAccess.commandIds);
	const available = $derived(availableQuickAccessCommands(current).map((entry) => entry.id));

	function label(id: string): string {
		const command = QUICK_ACCESS_COMMAND_CATALOG.find((entry) => entry.id === id);
		return command ? t(command.labelKey) : id;
	}

	function add(): void {
		if (selectedAvailable) {
			oncommandschange(addQuickAccessCommand(current, selectedAvailable));
			selectedAvailable = null;
		}
	}

	function remove(): void {
		if (selectedCurrent) {
			oncommandschange(removeQuickAccessCommand(current, selectedCurrent));
			selectedCurrent = null;
		}
	}

	function move(direction: 'up' | 'down'): void {
		if (selectedCurrent) {
			oncommandschange(moveQuickAccessCommand(current, selectedCurrent, direction));
		}
	}
</script>

{#snippet commandList(title: string, ids: readonly string[], selectedId: string | null, onselect: (id: string) => void)}
	<div class="list">
		<p>{title}</p>
		<div role="listbox" aria-label={title}>
			{#each ids as id (id)}
				<button type="button" role="option" aria-selected={selectedId === id} class:selected={selectedId === id} onclick={() => onselect(id)}>{label(id)}</button>
			{/each}
		</div>
	</div>
{/snippet}

<div class="qat-pane">
	<div class="columns">
		{@render commandList(t('pptx.options.quickAccess.chooseCommands'), available, selectedAvailable, (id) => (selectedAvailable = id))}
		<div class="middle">
			<button type="button" disabled={!selectedAvailable} onclick={add}>{t('pptx.options.quickAccess.add')} &gt;&gt;</button>
			<button type="button" disabled={!selectedCurrent} onclick={remove}>&lt;&lt; {t('pptx.options.quickAccess.remove')}</button>
		</div>
		{@render commandList(t('pptx.options.quickAccess.currentCommands'), current, selectedCurrent, (id) => (selectedCurrent = id))}
		<div class="middle">
			<button type="button" aria-label={t('pptx.options.quickAccess.moveUp')} disabled={!selectedCurrent} onclick={() => move('up')}>▲</button>
			<button type="button" aria-label={t('pptx.options.quickAccess.moveDown')} disabled={!selectedCurrent} onclick={() => move('down')}>▼</button>
		</div>
	</div>
	<button type="button" class="reset" onclick={onreset}>{t('pptx.options.quickAccess.reset')}</button>
</div>

<style>
	.qat-pane { display: flex; flex-direction: column; gap: 10px; }
	.columns { display: flex; align-items: stretch; gap: 10px; }
	.list { display: flex; flex: 1; min-width: 0; flex-direction: column; }
	.list p { margin: 0 0 4px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 11px; font-weight: 600; }
	.list [role='listbox'] { display: flex; height: 176px; flex-direction: column; gap: 2px; overflow-y: auto; border: 1px solid color-mix(in srgb, var(--pptx-border, #3f3f52) 60%, transparent); border-radius: 6px; padding: 4px; }
	.list [role='option'] { border: 0; border-radius: 4px; padding: 5px 8px; background: transparent; color: var(--pptx-foreground, #e2e8f0); font-size: 12px; text-align: left; cursor: pointer; }
	.list [role='option']:hover { background: var(--pptx-accent, #33334d); }
	.list [role='option'].selected { background: color-mix(in srgb, var(--pptx-primary, #6366f1) 15%, transparent); color: var(--pptx-primary, #6366f1); }
	.middle { display: flex; flex-direction: column; justify-content: center; gap: 6px; }
	.middle button, .reset { border: 1px solid var(--pptx-border, #3f3f52); border-radius: 5px; padding: 6px 10px; background: transparent; color: var(--pptx-foreground, #e2e8f0); font-size: 11px; white-space: nowrap; cursor: pointer; }
	.middle button:hover:not(:disabled), .reset:hover { background: var(--pptx-accent, #33334d); }
	.middle button:disabled { opacity: 0.5; cursor: not-allowed; }
	.reset { align-self: flex-start; }
	@media (max-width: 600px) { .columns { flex-wrap: wrap; } }
</style>
