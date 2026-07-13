<script lang="ts">
	/** RibbonTabBar: the File/Home/Insert/View tab strip, driven by the registry. */
	import { useTranslator } from '../../../i18n/context';
	import { RIBBON_TABS } from './ribbon-tabs';
	import type { RibbonTabId } from './ribbon-tabs';

	const { active, onselect }: { active: RibbonTabId; onselect: (id: RibbonTabId) => void } =
		$props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-ribbon-tabs" role="group" aria-label={t('pptx.ribbon.tab.home')}>
	{#each RIBBON_TABS as tab (tab.id)}
		<button
			type="button"
			class="pptx-svelte-ribbon-tab"
			class:pptx-svelte-ribbon-tab-active={active === tab.id}
			aria-pressed={active === tab.id}
			onclick={() => onselect(tab.id)}
		>
			{t(tab.labelKey)}
		</button>
	{/each}
</div>

<style>
	.pptx-svelte-ribbon-tabs {
		display: flex;
		align-items: center;
		gap: 2px;
		padding: 0 8px;
		border-top: 1px solid var(--pptx-border, #33334d);
		border-bottom: 1px solid var(--pptx-border, #33334d);
		overflow-x: auto;
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
