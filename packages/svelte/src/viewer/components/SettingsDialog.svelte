<script lang="ts">
	import { untrack } from 'svelte';
	import { DEFAULT_QUICK_ACCESS_COMMAND_IDS, VIEWER_OPTIONS_TABS } from 'pptx-viewer-shared';
	import type {
		ThemeCatalogEntry,
		ViewerAddinStatus,
		ViewerOptions,
		ViewerOptionsSection,
		ViewerOptionsTabId,
	} from 'pptx-viewer-shared';
	import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
	import { useTranslator } from '../../i18n/context';
	import type { ViewerOptionsState } from '../state/viewer-options.svelte';
	import SettingsAppearanceTab from './SettingsAppearanceTab.svelte';
	import SettingsLanguageTab from './SettingsLanguageTab.svelte';
	import OptionsAddInsPane from './settings/OptionsAddInsPane.svelte';
	import OptionsPane from './settings/OptionsPane.svelte';
	import OptionsQuickAccessPane from './settings/OptionsQuickAccessPane.svelte';
	import OptionsRibbonPane from './settings/OptionsRibbonPane.svelte';

	const {
		optionsState,
		onclose,
		themeKey,
		themeCatalog,
		onsetthemekey,
		locale,
		availableLocales,
		onsetlocale,
		addinStatus,
	}: {
		/** The shared File > Options state (store + behavior projections). */
		optionsState: ViewerOptionsState;
		onclose: () => void;
		themeKey: string;
		themeCatalog: readonly ThemeCatalogEntry[];
		onsetthemekey: (key: string) => void;
		locale: string;
		availableLocales?: readonly LocaleCatalogEntry[];
		onsetlocale: (code: string) => void;
		addinStatus?: ViewerAddinStatus;
	} = $props();

	const t = useTranslator();
	// eslint-disable-next-line prefer-const -- reassigned in the nav markup below
	let activeTabId = $state<ViewerOptionsTabId>('general');
	const activeTab = $derived(
		VIEWER_OPTIONS_TABS.find((entry) => entry.id === activeTabId) ?? VIEWER_OPTIONS_TABS[0],
	);
	const options = $derived<ViewerOptions>(optionsState.options);

	// Snapshot taken when the dialog mounts; Cancel restores it wholesale.
	// Deliberately the value at open time, so read outside reactive tracking.
	const snapshot = untrack(() => optionsState.options);

	function onchange(group: Parameters<ViewerOptionsState['setValue']>[0], key: string, value: boolean | number | string): void {
		optionsState.setValue(group, key, value);
	}
	function cancel(): void {
		optionsState.restore(snapshot);
		onclose();
	}
	function isSpecial(section: ViewerOptionsSection): boolean {
		return section.special === 'themePicker' || section.special === 'clearCache';
	}
</script>

<div class="backdrop">
	<button class="scrim" type="button" aria-label={t('pptx.settings.closeSettings')} onclick={onclose}></button>
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<section role="dialog" tabindex="-1" aria-modal="true" aria-label={t('pptx.options.title')}>
		<header>
			<div><b>⚙</b><h2>{t('pptx.options.title')}</h2></div>
			<button type="button" aria-label={t('pptx.settings.close')} onclick={onclose}>×</button>
		</header>
		<div class="layout">
			<nav aria-label={t('pptx.options.title')}>
				{#each VIEWER_OPTIONS_TABS as tab (tab.id)}
					<button class:active={activeTabId === tab.id} onclick={() => (activeTabId = tab.id)}>{t(tab.labelKey)}</button>
				{/each}
			</nav>
			<div class="body">
				{#if activeTab.custom === 'language'}
					<p class="headline">{t(activeTab.descriptionKey)}</p>
					<section class="lang">
						<h3>{t('pptx.options.language.displayLanguage')}</h3>
						<p class="hint">{t('pptx.options.language.displayLanguageDescription')}</p>
						<SettingsLanguageTab {locale} {availableLocales} onselect={onsetlocale} />
					</section>
				{:else if activeTab.custom === 'ribbon'}
					<p class="headline">{t(activeTab.descriptionKey)}</p>
					<OptionsRibbonPane {options} ontabhiddenchange={(id, hidden) => optionsState.setRibbonTabHidden(id, hidden)} onreset={() => optionsState.reset('ribbon')} />
				{:else if activeTab.custom === 'addIns'}
					<p class="headline">{t(activeTab.descriptionKey)}</p>
					<OptionsAddInsPane {addinStatus} />
				{:else}
					<OptionsPane tab={activeTab} {options} {onchange}>
						{#snippet special(section)}
							{#if section.special === 'themePicker'}
								<SettingsAppearanceTab {themeKey} {themeCatalog} onselect={onsetthemekey} />
							{:else if section.special === 'clearCache'}
								<p class="hint">{t('pptx.options.save.clearCacheDescription')}</p>
								<button type="button" class="ghost" onclick={() => void optionsState.clearCache()}>{t('pptx.options.save.clearCacheNow')}</button>
							{/if}
						{/snippet}
						{#if activeTab.custom === 'quickAccess'}
							<OptionsQuickAccessPane {options} oncommandschange={(ids) => optionsState.setQuickAccessCommands(ids)} onreset={() => optionsState.setQuickAccessCommands([...DEFAULT_QUICK_ACCESS_COMMAND_IDS])} />
						{/if}
					</OptionsPane>
				{/if}
			</div>
		</div>
		<footer>
			<button type="button" class="ghost" onclick={() => optionsState.reset()}>{t('pptx.options.resetAll')}</button>
			<div class="actions">
				<button type="button" class="ghost" onclick={cancel}>{t('pptx.common.cancel')}</button>
				<button type="button" class="primary" onclick={onclose}>{t('pptx.common.ok')}</button>
			</div>
		</footer>
	</section>
</div>

<style>
	.backdrop { position: fixed; inset: 0; z-index: 1200; display: grid; place-items: center; background: #0009; }
	.scrim { position: absolute; inset: 0; border: 0; background: transparent; }
	section[role='dialog'] { position: relative; display: flex; flex-direction: column; width: min(56rem, calc(100vw - 32px)); max-height: 85vh; overflow: hidden; border: 1px solid var(--pptx-border, #3f3f52); border-radius: 13px; background: var(--pptx-card, #1e1e2e); box-shadow: 0 24px 80px #0009; }
	header, header div { display: flex; align-items: center; }
	header { justify-content: space-between; padding: 14px 18px; border-bottom: 1px solid var(--pptx-border, #3f3f52); }
	header div { gap: 9px; }
	h2 { margin: 0; font-size: 14px; color: var(--pptx-foreground, #e2e8f0); }
	header b { color: var(--pptx-primary, #c43b32); }
	header > button { border: 0; background: transparent; color: inherit; font-size: 20px; cursor: pointer; }
	.layout { display: flex; min-height: 0; flex: 1; }
	nav { display: flex; flex-direction: column; width: 176px; flex-shrink: 0; gap: 2px; overflow-y: auto; padding: 8px; border-right: 1px solid var(--pptx-border, #3f3f52); }
	nav button { border: 0; border-radius: 6px; padding: 8px 12px; background: transparent; color: var(--pptx-foreground, #e2e8f0); font-size: 13px; text-align: left; white-space: nowrap; cursor: pointer; }
	nav button:hover { background: var(--pptx-muted, #2a2a3d); }
	nav button.active { background: color-mix(in srgb, var(--pptx-primary, #c43b32) 16%, transparent); color: var(--pptx-primary, #c43b32); font-weight: 600; }
	.body { min-height: 0; flex: 1; overflow-y: auto; padding: 16px 20px; }
	.headline { margin: 0 0 14px; color: var(--pptx-foreground, #e2e8f0); font-size: 12.5px; font-weight: 600; }
	.lang h3 { margin: 0 0 4px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 10.5px; font-weight: 700; letter-spacing: 0.05em; text-transform: uppercase; }
	.hint { margin: 0 0 8px; color: var(--pptx-muted-foreground, #94a3b8); font-size: 11px; }
	footer { display: flex; align-items: center; justify-content: space-between; gap: 8px; padding: 12px 18px; border-top: 1px solid var(--pptx-border, #3f3f52); }
	.actions { display: flex; gap: 8px; }
	button.ghost { border: 1px solid var(--pptx-border, #3f3f52); border-radius: 6px; padding: 6px 14px; background: transparent; color: var(--pptx-foreground, #e2e8f0); font-size: 12px; cursor: pointer; }
	button.primary { border: 0; border-radius: 6px; padding: 6px 16px; background: var(--pptx-primary, #c43b32); color: #fff; font-size: 12px; font-weight: 600; cursor: pointer; }
	@media (max-width: 600px) {
		section[role='dialog'] { position: fixed; inset: auto 0 0; width: 100%; max-height: 88dvh; border-radius: 16px 16px 0 0; }
		.layout { flex-direction: column; }
		nav { flex-direction: row; width: 100%; overflow-x: auto; border-right: 0; border-bottom: 1px solid var(--pptx-border, #3f3f52); }
	}
</style>
