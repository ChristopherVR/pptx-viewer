<script lang="ts">
	/**
	 * React-aligned command row above the ribbon tabs. The title bar owns
	 * save/undo/redo and autosave state; this row keeps collaboration actions
	 * on the upper right.
	 */
	import { isActionHidden } from 'pptx-viewer-shared';
	import type { ToolbarActionId } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';

	const {
		onshare,
		onbroadcast,
		collabActive = false,
		hiddenActions,
	}: {
		onshare?: () => void;
		onbroadcast?: () => void;
		collabActive?: boolean;
		hiddenActions?: ToolbarActionId[];
	} = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-ribbon-primary" role="group" aria-label={t('pptx.toolbar.presentationToolbarAria')}>
	{#if onshare && !isActionHidden('share', hiddenActions)}
		<button
			type="button"
			class:pptx-svelte-ribbon-primary-active={collabActive}
			aria-label={t('pptx.toolbar.share')}
			title={t('pptx.toolbar.share')}
			aria-pressed={collabActive}
			onclick={onshare}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><circle cx="12" cy="3.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><circle cx="12" cy="12.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M5.4 7.2 10.6 4.3M5.4 8.8 10.6 11.7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
		</button>
	{/if}
	{#if onbroadcast && !isActionHidden('broadcast', hiddenActions)}
		<button type="button" aria-label={t('pptx.broadcast.title')} title={t('pptx.broadcast.title')} onclick={onbroadcast}>
			<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="1.4" fill="currentColor" /><path d="M5.5 5.5a3.5 3.5 0 0 0 0 5M10.5 5.5a3.5 3.5 0 0 1 0 5M3.3 3.3a6.5 6.5 0 0 0 0 9.4M12.7 3.3a6.5 6.5 0 0 1 0 9.4" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
		</button>
	{/if}
</div>

<style>
	.pptx-svelte-ribbon-primary {
		display: flex;
		align-items: center;
		justify-content: flex-end;
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

	.pptx-svelte-ribbon-primary-active {
		color: var(--pptx-primary, #6366f1);
	}
</style>
