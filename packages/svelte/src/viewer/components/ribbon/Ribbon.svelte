<script lang="ts">
	/**
	 * Ribbon: the tabbed editing chrome shown in place of `ViewerToolbar` while
	 * `editable` is on. Slide navigation, slide position, and zoom live in the
	 * bottom status bar, matching React instead of adding a duplicate row above
	 * the ribbon tabs.
	 */
	import { useTranslator } from '../../../i18n/context';
	import { collectUsedFonts, createBackstagePresentation } from 'pptx-viewer-shared';
	import AnimationsTab from './animations/AnimationsTab.svelte';
	import DesignTab from './design/DesignTab.svelte';
	import DrawTab from './draw/DrawTab.svelte';
	import FileTab from './file/FileTab.svelte';
	import DocumentPropertiesDialog from './file/DocumentPropertiesDialog.svelte';
	import DigitalSignaturesDialog from './file/DigitalSignaturesDialog.svelte';
	import FontEmbeddingPanel from './file/FontEmbeddingPanel.svelte';
	import PasswordProtectionDialog from './file/PasswordProtectionDialog.svelte';
	import FindReplacePanel from './FindReplacePanel.svelte';
	import HomeTab from './home/HomeTab.svelte';
	import InsertTab from './insert/InsertTab.svelte';
	import RibbonPrimaryRow from './RibbonPrimaryRow.svelte';
	import RibbonTabBar from './RibbonTabBar.svelte';
	import SlideShowTab from './slideshow/SlideShowTab.svelte';
	import ReviewTab from './review/ReviewTab.svelte';
	import RecordTab from './record/RecordTab.svelte';
	import HelpTab from './help/HelpTab.svelte';
	import { DEFAULT_RIBBON_TAB } from './ribbon-tabs';
	import type { RibbonProps } from './ribbon-types';
	import TransitionsTab from './transitions/TransitionsTab.svelte';
	import ViewTab from './view/ViewTab.svelte';

	const props: RibbonProps = $props();
	const t = useTranslator();

	let activeTab = $state(DEFAULT_RIBBON_TAB);
	let propertiesOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let fontsOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let signaturesOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let protectionOpen = $state(false);
	// eslint-disable-next-line prefer-const
	let embedFontsEnabled = $state(false);
	let passwordProtected = $state(false);
	// eslint-disable-next-line prefer-const
	let presentationPassword = $state<string | null>(null);
	const usedFontFamilies = $derived(collectUsedFonts(props.editor.slides));
	$effect(() => {
		if (props.isPasswordProtected) {
			passwordProtected = true;
		}
	});
	$effect(() => {
		if (props.editor.equationOps.editingId) {
			activeTab = 'insert';
		}
	});

	function selectTab(id: typeof activeTab): void {
		activeTab = id;
	}

	function setPropertiesOpen(open: boolean): void {
		propertiesOpen = open;
	}
</script>

<div class="pptx-svelte-ribbon" role="toolbar" aria-label={t('pptx.toolbar.presentationToolbarAria')}>
	<RibbonPrimaryRow
		onshare={props.onshare}
		onbroadcast={props.onbroadcast}
		collabActive={props.collabActive}
	/>
	<RibbonTabBar active={activeTab} onselect={selectTab} />
	<FindReplacePanel findReplace={props.findReplace} editable={props.editor.editable} />
	<div class="pptx-svelte-ribbon-content">
		{#if activeTab === 'file'}
				<FileTab
					fileName={props.fileName}
					onclose={() => (activeTab = 'home')}
					oncreatepresentation={(templateId) => props.editor.setSlides(createBackstagePresentation(templateId))}
					ondownload={props.ondownload}
					ondownloadppsx={props.ondownloadppsx}
					ondownloadpptm={props.ondownloadpptm}
					onpackage={props.onpackage}
					hasMacros={props.hasMacros}
				onopenfile={props.onopenfile}
				onopenrecent={props.onopenrecent}
					exportUi={props.exportUi}
				onproperties={() => setPropertiesOpen(true)}
				onfonts={() => (fontsOpen = true)}
				onsignatures={() => (signaturesOpen = true)}
				onprotect={() => (protectionOpen = true)}
				onversionhistory={props.onversionhistory}
					onshare={props.onshare}
					onprint={props.onprintsettings}
					onsettings={props.onsettings}
					accountAuth={props.accountAuth}
			/>
		{:else if activeTab === 'home'}
			<HomeTab editor={props.editor} findReplace={props.findReplace} onnavigateslide={props.onnavigateslide} />
		{:else if activeTab === 'insert'}
			<InsertTab editor={props.editor} canvasSize={props.canvasSize} onheaderfooter={props.onheaderfooter} />
		{:else if activeTab === 'draw'}
			<DrawTab editor={props.editor} />
		{:else if activeTab === 'design'}
			<DesignTab editor={props.editor} theme={props.theme} onsettheme={props.onsettheme} />
		{:else if activeTab === 'transitions'}
			<TransitionsTab editor={props.editor} />
		{:else if activeTab === 'animations'}
			<AnimationsTab editor={props.editor} />
		{:else if activeTab === 'slideShow'}
			<SlideShowTab
				onfrombeginning={props.onfrombeginning}
				onfromcurrent={props.onfromcurrent}
				onpresenter={props.onpresenter}
				onsetup={props.onsetupslideshow}
				onrehearse={props.onrehearse}
				onsubtitles={props.onsubtitles}
				oncustomshows={props.oncustomshows}
				onbroadcast={props.onbroadcast}
			/>
		{:else if activeTab === 'review'}
			<ReviewTab slides={props.slides} onnavigate={props.onnavigatetoissue} editor={props.editor} oncompare={props.oncompare} onlanguage={props.onsettings} spellCheck={props.preferences.spellCheck} onspellcheckchange={(enabled) => props.onpreferenceschange({ ...props.preferences, spellCheck: enabled })} />
		{:else if activeTab === 'record'}
			<RecordTab onfrombeginning={props.onrecordfrombeginning} onfromcurrent={props.onrecordfromcurrent} />
		{:else if activeTab === 'view'}
			<ViewTab
				editor={props.editor}
				preferences={props.preferences}
				onpreferenceschange={props.onpreferenceschange}
				showGuides={props.showGuides}
				onshowguideschange={props.onshowguideschange}
				snapToShape={props.snapToShape}
				onsnapToShapechange={props.onsnapToShapechange}
				onaddguide={props.onaddguide}
				zoomPercent={props.zoomPercent}
				onzoomin={props.onzoomin}
				onzoomout={props.onzoomout}
				onzoomfit={props.onzoomfit}
				isFullscreen={props.isFullscreen}
				onfullscreen={props.onfullscreen}
				showNotes={props.showNotes}
				notesExpanded={props.notesExpanded}
				onnotestoggle={props.onnotestoggle}
				editTemplateMode={props.editor.editTemplateMode}
				onsettemplateediting={(enabled) => props.editor.setTemplateEditing(enabled)}
				onentermasterview={props.onentermasterview}
				onselectionpane={props.onselectionpane}
				onslidesorter={props.onslidesorter}
			/>
		{:else if activeTab === 'help'}
			<HelpTab onaccessibility={() => (activeTab = 'review')} onshortcuts={props.onshortcuts} onsettings={props.onsettings} />
		{/if}
	</div>
</div>

{#if fontsOpen}
	<FontEmbeddingPanel usedFontFamilies={usedFontFamilies} embeddedFonts={props.embeddedFontNames} enabled={embedFontsEnabled} ontoggle={(enabled) => (embedFontsEnabled = enabled)} onclose={() => (fontsOpen = false)} />
{/if}
{#if signaturesOpen}
	<DigitalSignaturesDialog hasSignatures={props.hasDigitalSignatures} signatureCount={props.digitalSignatureCount} onclose={() => (signaturesOpen = false)} />
{/if}
{#if protectionOpen}
	<PasswordProtectionDialog protected={passwordProtected} onset={(password) => { presentationPassword = password; passwordProtected = true; }} onremove={() => { presentationPassword = null; passwordProtected = false; }} onclose={() => (protectionOpen = false)} />
{/if}
{#if propertiesOpen}<DocumentPropertiesDialog editor={props.editor} onclose={() => setPropertiesOpen(false)} />{/if}

<style>
	.pptx-svelte-ribbon {
		display: flex;
		flex-direction: column;
		background: var(--pptx-card, #1e1e2e);
		color: var(--pptx-card-foreground, #e2e8f0);
		border-bottom: 1px solid var(--pptx-border, #33334d);
		font-family: system-ui, sans-serif;
		flex: none;
	}

	.pptx-svelte-ribbon-content {
		display: flex;
		align-items: center;
		flex-wrap: wrap;
		gap: 6px;
		padding: 4px 8px;
	}

	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		.pptx-svelte-ribbon {
			display: none;
		}
	}
</style>
