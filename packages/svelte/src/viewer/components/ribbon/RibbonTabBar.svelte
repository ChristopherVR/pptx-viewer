<script lang="ts">
	/**
	 * RibbonTabBar: the File/Home/Insert/View tab strip, driven by the registry,
	 * plus the right-side quick actions React keeps on the tab row
	 * (`TabRowActions`): Record and the highlighted Share button.
	 */
	import { filterVisibleTabs, isActionHidden } from 'pptx-viewer-shared';
	import type { ToolbarActionId } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';
	import { RIBBON_TABS } from './ribbon-tabs';
	import type { RibbonTabId } from './ribbon-tabs';

	const {
		active,
		onselect,
		onrecord,
		onshare,
		collabActive = false,
		hiddenActions,
	}: {
		active: RibbonTabId;
		onselect: (id: RibbonTabId) => void;
		onrecord?: () => void;
		onshare?: () => void;
		collabActive?: boolean;
		hiddenActions?: ToolbarActionId[];
	} = $props();

	const t = useTranslator();
	const visibleTabs = $derived(filterVisibleTabs(RIBBON_TABS, hiddenActions));
</script>

<div class="pptx-svelte-ribbon-tabrow">
	<div class="pptx-svelte-ribbon-tabs" role="tablist">
		{#each visibleTabs as tab (tab.id)}
			<button
				type="button"
				class="pptx-svelte-ribbon-tab"
				class:pptx-svelte-ribbon-tab-active={active === tab.id}
				role="tab"
				aria-selected={active === tab.id}
				onclick={() => onselect(tab.id)}
			>
				{t(tab.labelKey)}
			</button>
		{/each}
	</div>
	<div class="pptx-svelte-ribbon-tabrow-actions">
		{#if onrecord && !isActionHidden('record', hiddenActions)}
			<button
				type="button"
				class="pptx-svelte-ribbon-record"
				title={t('pptx.titleBar.record')}
				aria-label={t('pptx.titleBar.record')}
				onclick={onrecord}
			>
				<span class="pptx-svelte-ribbon-record-dot" aria-hidden="true"></span>
				<span>{t('pptx.titleBar.record')}</span>
			</button>
		{/if}
		{#if onshare && !isActionHidden('share', hiddenActions)}
			<button
				type="button"
				class="pptx-svelte-ribbon-share"
				class:pptx-svelte-ribbon-share-active={collabActive}
				title={t('pptx.toolbar.share')}
				aria-label={t('pptx.toolbar.share')}
				onclick={onshare}
			>
				<svg viewBox="0 0 16 16" aria-hidden="true"><circle cx="4" cy="8" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><circle cx="12" cy="3.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><circle cx="12" cy="12.5" r="1.6" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M5.4 7.2 10.6 4.3M5.4 8.8 10.6 11.7" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" /></svg>
				<span>{t('pptx.toolbar.share')}</span>
			</button>
		{/if}
	</div>
</div>

<style>
	.pptx-svelte-ribbon-tabrow {
		display: flex;
		align-items: center;
		gap: 8px;
		border-top: 1px solid var(--pptx-border, #33334d);
		border-bottom: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-ribbon-tabs {
		display: flex;
		flex: 1;
		align-items: center;
		gap: 2px;
		min-width: 0;
		padding: 0 8px;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: none;
	}

	.pptx-svelte-ribbon-tabs::-webkit-scrollbar {
		display: none;
	}

	.pptx-svelte-ribbon-tabrow-actions {
		display: flex;
		align-items: center;
		gap: 4px;
		padding-right: 6px;
	}

	.pptx-svelte-ribbon-record,
	.pptx-svelte-ribbon-share {
		display: inline-flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border: none;
		border-radius: 4px;
		font: inherit;
		font-size: 11px;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
	}

	.pptx-svelte-ribbon-record {
		background: transparent;
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.pptx-svelte-ribbon-record:hover {
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-ribbon-record-dot {
		width: 7px;
		height: 7px;
		border-radius: 50%;
		background: #ef4444;
	}

	.pptx-svelte-ribbon-share {
		background: var(--pptx-primary, #6366f1);
		color: var(--pptx-primary-foreground, #fff);
	}

	.pptx-svelte-ribbon-share:hover {
		filter: brightness(1.1);
	}

	.pptx-svelte-ribbon-share-active {
		background: #16a34a;
	}

	.pptx-svelte-ribbon-share svg {
		width: 12px;
		height: 12px;
	}

	.pptx-svelte-ribbon-tab {
		padding: 6px 12px;
		border: none;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		font: inherit;
		font-size: 12.5px;
		font-weight: 500;
		white-space: nowrap;
		cursor: pointer;
		position: relative;
	}

	.pptx-svelte-ribbon-tab:hover {
		color: var(--pptx-card-foreground, #e2e8f0);
		background: var(--pptx-accent, #33334d);
	}

	.pptx-svelte-ribbon-tab-active {
		color: var(--pptx-primary, #6366f1);
	}

	.pptx-svelte-ribbon-tab-active::after {
		content: '';
		position: absolute;
		left: 8px;
		right: 8px;
		bottom: -1px;
		height: 2px;
		background: var(--pptx-primary, #6366f1);
	}
</style>
