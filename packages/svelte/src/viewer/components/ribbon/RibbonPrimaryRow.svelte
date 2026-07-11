<script lang="ts">
	/**
	 * RibbonPrimaryRow: the quick-access row above the tab bar (undo/redo,
	 * save/download, autosave status pill), matching React's
	 * `ToolbarPrimaryRow` intent for the editing-only affordances. Rendered
	 * only while editing (see `Ribbon.svelte`).
	 */
	import { useTranslator } from '../../../i18n/context';
	import AutosaveIndicator from '../AutosaveIndicator.svelte';
	import type { AutosaveStatus } from '../../state/autosave.svelte';

	const {
		canUndo,
		canRedo,
		dirty,
		onundo,
		onredo,
		onsave,
		ondownload,
		autosaveStatus,
		autosaveDirty = false,
	}: {
		canUndo: boolean;
		canRedo: boolean;
		dirty: boolean;
		onundo: () => void;
		onredo: () => void;
		onsave: () => void;
		ondownload: () => void;
		autosaveStatus?: AutosaveStatus;
		autosaveDirty?: boolean;
	} = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-ribbon-primary" role="group" aria-label={t('pptx.inspector.elementProperties')}>
	<button
		type="button"
		aria-label={t('pptx.toolbar.undo')}
		title={t('pptx.toolbar.undo')}
		disabled={!canUndo}
		onclick={onundo}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M6 4 3 7l3 3M3 7h6.5a3.5 3.5 0 0 1 0 7H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<button
		type="button"
		aria-label={t('pptx.toolbar.redo')}
		title={t('pptx.toolbar.redo')}
		disabled={!canRedo}
		onclick={onredo}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M10 4l3 3-3 3M13 7H6.5a3.5 3.5 0 0 0 0 7H8" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	<button
		type="button"
		class="pptx-svelte-ribbon-primary-save"
		class:pptx-svelte-ribbon-primary-dirty={dirty}
		aria-label={t('pptx.toolbar.save')}
		title={t('pptx.toolbar.save')}
		onclick={onsave}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 2.5h8l2 2v9h-10zM5 2.5v4h5v-4M5 13.5v-4h6v4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
	</button>
	<button
		type="button"
		aria-label={t('pptx.ribbon.saveAsPptx')}
		title={t('pptx.ribbon.saveAsPptx')}
		onclick={ondownload}
	>
		<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8 2.5v7m0 0 3-3m-3 3-3-3M3 12.5h10" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" /></svg>
	</button>
	{#if autosaveStatus}
		<AutosaveIndicator status={autosaveStatus} isDirty={autosaveDirty} />
	{/if}
</div>

<style>
	.pptx-svelte-ribbon-primary {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-ribbon-primary button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: inherit;
		cursor: pointer;
	}

	.pptx-svelte-ribbon-primary button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-ribbon-primary button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-ribbon-primary svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-ribbon-primary-dirty {
		color: var(--pptx-primary, #6366f1);
	}
</style>
