<script lang="ts">
	import { VIEWER_PREFERENCE_TOGGLES, VIEWER_SHORTCUT_REFERENCE, updateViewerPreference } from 'pptx-viewer-shared';
	import type { ThemeCatalogEntry, ViewerPreferences } from 'pptx-viewer-shared';
	import type { LocaleCatalogEntry } from 'pptx-viewer-shared/i18n';
	import { useTranslator } from '../../i18n/context';
	import SettingsAppearanceTab from './SettingsAppearanceTab.svelte';
	import SettingsLanguageTab from './SettingsLanguageTab.svelte';

	const {
		preferences,
		onclose,
		onchange,
		themeKey,
		themeCatalog,
		onsetthemekey,
		locale,
		availableLocales,
		onsetlocale,
	}: {
		preferences: ViewerPreferences;
		onclose: () => void;
		onchange: (next: ViewerPreferences) => void;
		/** Currently-selected `themeCatalog` key (File > Options > Appearance). */
		themeKey: string;
		/** Theme choices offered by the Appearance tab. */
		themeCatalog: readonly ThemeCatalogEntry[];
		onsetthemekey: (key: string) => void;
		/** Currently-effective locale code (File > Options > Language). */
		locale: string;
		/** Language choices offered by the Language tab; defaults to every registered locale when unset. */
		availableLocales?: readonly LocaleCatalogEntry[];
		onsetlocale: (code: string) => void;
	} = $props();
	const t = useTranslator();
	// eslint-disable-next-line prefer-const
	let tab = $state<'general' | 'appearance' | 'language' | 'shortcuts'>('general');
</script>
<div class="backdrop"><button class="scrim" type="button" aria-label={t('pptx.settings.closeSettings')} onclick={onclose}></button>
	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<section role="dialog" tabindex="-1" aria-modal="true" aria-labelledby="settings-title"><header><div><b>⚙</b><h2 id="settings-title">{t('pptx.settings.title')}</h2></div><button type="button" aria-label={t('pptx.settings.close')} onclick={onclose}>×</button></header>
		<nav aria-label={t('pptx.settings.title')}><button class:active={tab === 'general'} onclick={() => (tab = 'general')}>{t('pptx.settings.general')}</button><button class:active={tab === 'appearance'} onclick={() => (tab = 'appearance')}>{t('pptx.settings.appearance')}</button><button class:active={tab === 'language'} onclick={() => (tab = 'language')}>{t('pptx.settings.language')}</button><button class:active={tab === 'shortcuts'} onclick={() => (tab = 'shortcuts')}>{t('pptx.settings.keyboardShortcuts')}</button></nav>
		<div class="body">{#if tab === 'general'}{#each VIEWER_PREFERENCE_TOGGLES as item}<label><span>{t(item.labelKey)}</span><button class:enabled={preferences[item.key]} role="switch" aria-checked={preferences[item.key]} aria-label={t(item.labelKey)} onclick={() => onchange(updateViewerPreference(preferences, item.key, !preferences[item.key]))}><i></i></button></label>{/each}{:else if tab === 'appearance'}<SettingsAppearanceTab {themeKey} {themeCatalog} onselect={onsetthemekey} />{:else if tab === 'language'}<SettingsLanguageTab {locale} {availableLocales} onselect={onsetlocale} />{:else}{#each VIEWER_SHORTCUT_REFERENCE as shortcut, index}<p class:stripe={index % 2 === 0}><span>{t(shortcut.actionKey)}</span><kbd>{shortcut.shortcut}</kbd></p>{/each}{/if}</div>
	</section>
</div>
<style>
	.backdrop{position:fixed;inset:0;z-index:1200;display:grid;place-items:center;background:#0009}.scrim{position:absolute;inset:0;border:0;background:transparent}section{position:relative;width:min(512px,calc(100vw - 32px));overflow:hidden;border:1px solid var(--pptx-border,#3f3f52);border-radius:13px;background:var(--pptx-card,#1e1e2e);box-shadow:0 24px 80px #0009}header,header div{display:flex;align-items:center}header{justify-content:space-between;padding:14px 18px;border-bottom:1px solid var(--pptx-border,#3f3f52)}header div{gap:9px}h2{margin:0;font-size:14px}header b{color:var(--pptx-primary,#c43b32)}header>button{border:0;background:transparent;color:inherit;font-size:20px}nav{display:flex;flex-wrap:wrap;padding:0 18px;border-bottom:1px solid var(--pptx-border,#3f3f52)}nav button{position:relative;border:0;padding:10px;background:transparent;color:var(--pptx-muted-foreground,#94a3b8);font-size:12px}.active{color:var(--pptx-primary,#c43b32)!important}.active:after{position:absolute;right:0;bottom:0;left:0;height:2px;background:currentColor;content:''}.body{max-height:60vh;overflow:auto;padding:14px 18px}.body label,.body p{display:flex;align-items:center;justify-content:space-between;gap:12px;margin:0;padding:9px 11px;border-radius:6px;font-size:12px}.body label button{position:relative;width:36px;height:20px;border:0;border-radius:12px;background:#687080}.body label button.enabled{background:var(--pptx-primary,#c43b32)}.body label i{position:absolute;top:3px;left:3px;width:14px;height:14px;border-radius:50%;background:#fff;transition:transform .15s}.body label button.enabled i{transform:translateX(16px)}.stripe{background:var(--pptx-muted,#2a2a3d)}kbd{color:var(--pptx-muted-foreground,#94a3b8);font:11px ui-monospace,monospace;white-space:nowrap}@media(max-width:600px){section{position:fixed;inset:auto 0 0;width:100%;max-height:88dvh;border-radius:16px 16px 0 0}}
</style>
