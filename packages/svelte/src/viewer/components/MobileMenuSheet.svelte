<script lang="ts">
	/**
	 * MobileMenuSheet: Svelte port of React's
	 * `components/mobile/MobileMenuSheet.tsx` (and Vue's `MobileMenuSheet.vue`).
	 *
	 * Drawer-style sheet exposing every ribbon tab in a single mobile-friendly
	 * scroll, opened from `MobileChrome`'s hamburger button. Tapping a chip
	 * selects it; the matching desktop ribbon tab component then renders below
	 * in a wrapping, larger-touch-target layout. The tab components are reused
	 * verbatim (same prop contract as `Ribbon.svelte`), so behaviour matches the
	 * desktop ribbon exactly - this binding has no separate "Section" layer
	 * beneath its tabs the way React/Vue do, so the tabs themselves are the
	 * reusable unit here.
	 *
	 * The host (`ViewerChrome.svelte`) passes the same `RibbonProps` bundle it
	 * already assembles for `<Ribbon>`, plus a `close` callback, exactly like
	 * the other four bindings thread their ribbon prop bundle twice.
	 */
	import { collectUsedFonts, createBackstagePresentation, filterVisibleTabs } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import AnimationsTab from './ribbon/animations/AnimationsTab.svelte';
	import DesignTab from './ribbon/design/DesignTab.svelte';
	import DrawTab from './ribbon/draw/DrawTab.svelte';
	import DigitalSignaturesDialog from './ribbon/file/DigitalSignaturesDialog.svelte';
	import DocumentPropertiesDialog from './ribbon/file/DocumentPropertiesDialog.svelte';
	import FileTab from './ribbon/file/FileTab.svelte';
	import FontEmbeddingPanel from './ribbon/file/FontEmbeddingPanel.svelte';
	import PasswordProtectionDialog from './ribbon/file/PasswordProtectionDialog.svelte';
	import HelpTab from './ribbon/help/HelpTab.svelte';
	import HomeTab from './ribbon/home/HomeTab.svelte';
	import InsertTab from './ribbon/insert/InsertTab.svelte';
	import RecordTab from './ribbon/record/RecordTab.svelte';
	import ReviewTab from './ribbon/review/ReviewTab.svelte';
	import { RIBBON_TABS } from './ribbon/ribbon-tabs';
	import type { RibbonTabId } from './ribbon/ribbon-tabs';
	import type { RibbonProps } from './ribbon/ribbon-types';
	import SlideShowTab from './ribbon/slideshow/SlideShowTab.svelte';
	import TransitionsTab from './ribbon/transitions/TransitionsTab.svelte';
	import ViewTab from './ribbon/view/ViewTab.svelte';
	import MobileSheet from './MobileSheet.svelte';

	interface Props extends RibbonProps {
		onclose: () => void;
	}

	const props: Props = $props();
	const t = useTranslator();

	const visibleTabs = $derived(filterVisibleTabs(RIBBON_TABS, props.hiddenActions));

	let active = $state<RibbonTabId>('home');
	function toggle(id: RibbonTabId): void {
		active = active === id ? 'home' : id;
	}

	// File tab sub-dialogs: owned here (not by `Ribbon.svelte`) since the File
	// chip can be opened while the desktop ribbon is hidden/collapsed on mobile.
	let propertiesOpen = $state(false);
	let fontsOpen = $state(false);
	let signaturesOpen = $state(false);
	let protectionOpen = $state(false);
	let passwordProtected = $state(false);
	$effect(() => {
		if (props.isPasswordProtected) {
			passwordProtected = true;
		}
	});
	const fontEmbedding = $derived(props.editor.fontEmbedding);
	const usedFontFamilies = $derived(collectUsedFonts(props.editor.slides));

	/**
	 * Design > Slide Size: same redirect to the inspector's Properties card that
	 * `Ribbon.svelte` uses (there is no other slide-size control in this
	 * binding).
	 */
	function openSlideSize(): void {
		props.editor.selection.clear();
		props.chromeUi?.setInspectorTab('properties');
		if (props.chromeUi && !props.chromeUi.inspectorOpen) {
			props.chromeUi.toggleInspector();
		}
	}
</script>

<MobileSheet title={t('pptx.mobileToolbar.menu')} onclose={props.onclose}>
	<div class="pptx-svelte-mobile-menu">
		<div class="pptx-svelte-mobile-menu-chips">
			{#each visibleTabs as tab (tab.id)}
				<button
					type="button"
					class="pptx-svelte-mobile-menu-chip"
					class:is-active={active === tab.id}
					aria-pressed={active === tab.id}
					onclick={() => toggle(tab.id)}
				>
					{t(tab.labelKey)}
				</button>
			{/each}
		</div>

		<div class="pptx-svelte-mobile-menu-body">
			{#if active === 'home'}
				<HomeTab editor={props.editor} findReplace={props.findReplace} onnavigateslide={props.onnavigateslide} />
			{:else if active === 'insert'}
				<InsertTab editor={props.editor} canvasSize={props.canvasSize} onheaderfooter={props.onheaderfooter} />
			{:else if active === 'draw'}
				<DrawTab editor={props.editor} />
			{:else if active === 'design'}
				<DesignTab editor={props.editor} theme={props.theme} onsettheme={props.onsettheme} onslidesize={openSlideSize} />
			{:else if active === 'transitions'}
				<TransitionsTab editor={props.editor} chromeUi={props.chromeUi} />
			{:else if active === 'animations'}
				<AnimationsTab editor={props.editor} chromeUi={props.chromeUi} />
			{:else if active === 'slideShow'}
				<SlideShowTab
					editor={props.editor}
					onfrombeginning={props.onfrombeginning}
					onfromcurrent={props.onfromcurrent}
					onpresenter={props.onpresenter}
					onsetup={props.onsetupslideshow}
					onrehearse={props.onrehearse}
					onsubtitles={props.onsubtitles}
					oncustomshows={props.oncustomshows}
					onhideslide={props.onhideslide}
					activeSlideHidden={Boolean(props.slides?.[props.current]?.hidden)}
					subtitlesEnabled={props.subtitlesEnabled}
					onbroadcast={props.onbroadcast}
				/>
			{:else if active === 'review'}
				<ReviewTab
					slides={props.slides}
					onnavigate={props.onnavigatetoissue}
					editor={props.editor}
					oncompare={props.oncompare}
					onlanguage={props.onsettings}
					spellCheck={props.preferences.spellCheck}
					onspellcheckchange={(enabled) => props.onpreferenceschange({ ...props.preferences, spellCheck: enabled })}
				/>
			{:else if active === 'record'}
				<RecordTab onfrombeginning={props.onrecordfrombeginning} onfromcurrent={props.onrecordfromcurrent} />
			{:else if active === 'view'}
				<ViewTab
					editor={props.editor}
					preferences={props.preferences}
					onpreferenceschange={props.onpreferenceschange}
					showGuides={props.showGuides}
					onshowguideschange={props.onshowguideschange}
					snapToShape={props.snapToShape}
					onsnapToShapechange={props.onsnapToShapechange}
					onaddguide={props.onaddguide}
					onzoomfit={props.onzoomfit}
					onnormal={props.onnormal}
					editTemplateMode={props.editor.editTemplateMode}
					onsettemplateediting={(enabled) => props.editor.setTemplateEditing(enabled)}
					onentermasterview={props.onentermasterview}
					onselectionpane={props.onselectionpane}
					onslidesorter={props.onslidesorter}
					onoutlineview={props.onoutlineview}
					onreadingview={props.onreadingview}
				/>
			{:else if active === 'help'}
				<HelpTab onaccessibility={() => (active = 'review')} onshortcuts={props.onshortcuts} onsettings={props.onsettings} />
			{:else if active === 'file'}
				<FileTab
					fileName={props.fileName}
					onclose={() => (active = 'home')}
					oncreatepresentation={(templateId) => props.editor.setSlides(createBackstagePresentation(templateId))}
					ondownload={props.ondownload}
					ondownloadppsx={props.ondownloadppsx}
					ondownloadpptm={props.ondownloadpptm}
					hasMacros={props.hasMacros}
					onopenfile={props.onopenfile}
					onopenrecent={props.onopenrecent}
					exportUi={props.exportUi}
					onproperties={() => (propertiesOpen = true)}
					onfonts={() => (fontsOpen = true)}
					onsignatures={() => (signaturesOpen = true)}
					onprotect={() => (protectionOpen = true)}
					onversionhistory={props.onversionhistory}
					onshare={props.onshare}
					onprint={props.onprintsettings}
					onsettings={props.onsettings}
					accountAuth={props.accountAuth}
				/>
			{/if}
		</div>
	</div>
</MobileSheet>

{#if fontsOpen}
	<FontEmbeddingPanel
		usedFontFamilies={usedFontFamilies}
		embeddedFonts={props.embeddedFontNames}
		enabled={props.editor.embedFonts}
		canEmbed={fontEmbedding.interactive}
		unavailableKey={fontEmbedding.disabledReasonKey}
		ontoggle={(enabled) => (props.editor.embedFonts = enabled)}
		onclose={() => (fontsOpen = false)}
	/>
{/if}
{#if signaturesOpen}
	<DigitalSignaturesDialog
		hasSignatures={props.hasDigitalSignatures}
		signatureCount={props.digitalSignatureCount}
		onclose={() => (signaturesOpen = false)}
	/>
{/if}
{#if protectionOpen}
	<PasswordProtectionDialog
		protected={passwordProtected}
		onset={(password) => {
			props.editor.setSavePassword(password);
			passwordProtected = true;
		}}
		onremove={() => {
			props.editor.clearSavePassword();
			passwordProtected = false;
		}}
		onclose={() => (protectionOpen = false)}
	/>
{/if}
{#if propertiesOpen}
	<DocumentPropertiesDialog editor={props.editor} onclose={() => (propertiesOpen = false)} />
{/if}

<style>
	.pptx-svelte-mobile-menu {
		display: flex;
		flex-direction: column;
	}

	.pptx-svelte-mobile-menu-chips {
		position: sticky;
		top: 0;
		z-index: 1;
		display: flex;
		flex-wrap: wrap;
		gap: 6px;
		padding: 8px 12px;
		border-bottom: 1px solid var(--pptx-border, #33334d);
		background: var(--pptx-background, #11111b);
	}

	.pptx-svelte-mobile-menu-chip {
		display: inline-flex;
		align-items: center;
		flex-shrink: 0;
		min-height: 36px;
		padding: 8px 12px;
		border: 1px solid var(--pptx-border, #33334d);
		border-radius: 999px;
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		font: inherit;
		font-size: 12px;
		font-weight: 500;
		touch-action: manipulation;
	}

	.pptx-svelte-mobile-menu-chip:hover {
		color: var(--pptx-card-foreground, #e2e8f0);
		background: color-mix(in srgb, var(--pptx-accent, #33334d) 40%, transparent);
	}

	.pptx-svelte-mobile-menu-chip.is-active {
		border-color: var(--pptx-primary, #6366f1);
		background: var(--pptx-primary, #6366f1);
		color: #fff;
	}

	.pptx-svelte-mobile-menu-body {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		gap: 8px;
		padding: 12px;
	}
</style>
