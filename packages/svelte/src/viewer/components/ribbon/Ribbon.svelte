<script lang="ts">
	/**
	 * Ribbon: the tabbed editing chrome shown in place of `ViewerToolbar` while
	 * `editable` is on. Slide navigation, slide position, and zoom live in the
	 * bottom status bar, matching React instead of adding a duplicate row above
	 * the ribbon tabs.
	 */
	import { useTranslator } from '../../../i18n/context';
	import { collectUsedFonts, createBackstagePresentation, isActionHidden } from 'pptx-viewer-shared';
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
	let passwordProtected = $state(false);
	// File > Fonts: seeded from (and stored on) the editor, because the save path
	// reads it there. Held locally this component could move the switch but not
	// change a single byte of the saved file.
	const fontEmbedding = $derived(props.editor.fontEmbedding);
	const usedFontFamilies = $derived(collectUsedFonts(props.editor.slides));
	const slideCommentCount = $derived(props.slides[props.current]?.comments?.length ?? 0);
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

	/**
	 * Design > Slide Size. The only slide-size control this binding has is the
	 * inspector's SLIDE SIZE card, which the Properties tab renders when nothing
	 * is selected, so drop the selection and open the pane there. It used to open
	 * the Document Properties dialog, which has no slide-size control in it at
	 * all - the same mis-wiring Angular and Vanilla carried.
	 */
	function openSlideSize(): void {
		props.editor.selection.clear();
		props.chromeUi?.setInspectorTab('properties');
		if (props.chromeUi && !props.chromeUi.inspectorOpen) {
			props.chromeUi.toggleInspector();
		}
	}
</script>

<div class="pptx-svelte-ribbon" role="toolbar" aria-label={t('pptx.toolbar.presentationToolbarAria')}>
	<RibbonPrimaryRow
		chromeUi={props.chromeUi}
		readOnly={props.readOnly}
		commentCount={slideCommentCount}
		onpresent={props.onfromcurrent}
		onpresenter={props.onpresenter}
		onrehearse={props.onrehearse}
		onsetup={props.onsetupslideshow}
		onbroadcast={props.onbroadcast && !isActionHidden('broadcast', props.hiddenActions) ? props.onbroadcast : undefined}
		onsubtitles={props.onsubtitles}
		subtitlesEnabled={props.subtitlesEnabled}
		oncustomshows={props.oncustomshows}
		onsettings={props.onsettings}
		onai={props.onai}
		aiActive={props.aiActive}
		exportUi={props.exportUi}
		hiddenActions={props.hiddenActions}
		onsaveppsx={props.ondownloadppsx}
		onsavepptm={props.ondownloadpptm}
		oninfo={() => setPropertiesOpen(true)}
		ona11y={() => (activeTab = 'review')}
		onshortcuts={props.onshortcuts}
		onversionhistory={props.onversionhistory}
		onprotect={() => (protectionOpen = true)}
		onfonts={() => (fontsOpen = true)}
		onsignatures={() => (signaturesOpen = true)}
	/>
	<RibbonTabBar
		active={activeTab}
		onselect={selectTab}
		onrecord={props.onrehearse}
		onshare={props.onshare}
		collabActive={props.collabActive}
		hiddenActions={props.hiddenActions}
	/>
	<FindReplacePanel findReplace={props.findReplace} editable={props.editor.editable} />
	<!-- The File backstage is a full-screen `position: fixed` overlay, not a row
	     of ribbon groups, so it is deliberately a sibling of
	     `.pptx-svelte-ribbon-content`: that container's `> * { align-items:
	     flex-start }` rule (which top-aligns each tab's groups) otherwise landed
	     on the backstage flex row and stopped its left nav rail stretching to
	     the full window height. -->
	{#if activeTab === 'file'}
		<FileTab
			fileName={props.fileName}
			onclose={() => (activeTab = 'home')}
			oncreatepresentation={(templateId) => props.editor.setSlides(createBackstagePresentation(templateId))}
			ondownload={props.ondownload}
			ondownloadppsx={props.ondownloadppsx}
			ondownloadpptm={props.ondownloadpptm}
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
	{/if}
	<div class="pptx-svelte-ribbon-content">
		{#if activeTab === 'home'}
			<HomeTab editor={props.editor} findReplace={props.findReplace} onnavigateslide={props.onnavigateslide} />
		{:else if activeTab === 'insert'}
			<InsertTab editor={props.editor} canvasSize={props.canvasSize} onheaderfooter={props.onheaderfooter} />
		{:else if activeTab === 'draw'}
			<DrawTab editor={props.editor} />
		{:else if activeTab === 'design'}
			<DesignTab
				editor={props.editor}
				theme={props.theme}
				onsettheme={props.onsettheme}
				onslidesize={openSlideSize}
			/>
		{:else if activeTab === 'transitions'}
			<TransitionsTab editor={props.editor} chromeUi={props.chromeUi} />
		{:else if activeTab === 'animations'}
			<AnimationsTab editor={props.editor} chromeUi={props.chromeUi} />
		{:else if activeTab === 'slideShow'}
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
		{:else if activeTab === 'help'}
			<HelpTab onaccessibility={() => (activeTab = 'review')} onshortcuts={props.onshortcuts} onsettings={props.onsettings} />
		{/if}
	</div>
</div>

{#if fontsOpen}
	<FontEmbeddingPanel usedFontFamilies={usedFontFamilies} embeddedFonts={props.embeddedFontNames} enabled={props.editor.embedFonts} canEmbed={fontEmbedding.interactive} unavailableKey={fontEmbedding.disabledReasonKey} ontoggle={(enabled) => (props.editor.embedFonts = enabled)} onclose={() => (fontsOpen = false)} />
{/if}
{#if signaturesOpen}
	<DigitalSignaturesDialog hasSignatures={props.hasDigitalSignatures} signatureCount={props.digitalSignatureCount} onclose={() => (signaturesOpen = false)} />
{/if}
{#if protectionOpen}
	<!-- The secret lives on `EditorState`, not this component: the save path
	     reads it there and routes a protected deck through `saveEncrypted`. -->
	<PasswordProtectionDialog protected={passwordProtected} onset={(password) => { props.editor.setSavePassword(password); passwordProtected = true; }} onremove={() => { props.editor.clearSavePassword(); passwordProtected = false; }} onclose={() => (protectionOpen = false)} />
{/if}
{#if propertiesOpen}<DocumentPropertiesDialog editor={props.editor} onclose={() => setPropertiesOpen(false)} />{/if}

<style>
	.pptx-svelte-ribbon {
		display: flex;
		flex-direction: column;
		background: color-mix(in srgb, var(--pptx-secondary, #1e1e2e) 50%, transparent);
		color: var(--pptx-card-foreground, #e2e8f0);
		border-bottom: 1px solid var(--pptx-border, #33334d);
		font-family: system-ui, sans-serif;
		flex: none;
	}

	/* One horizontal, non-wrapping row of ribbon groups (React parity:
	   `flex min-h-[82px] items-center gap-0 px-1 py-0.5 overflow-x-auto
	   flex-nowrap`). `items-center` (not `stretch`): a plain single-row button
	   or group has no internal layout that uses extra height, so stretching it
	   to the row's full 82px just padded it out top and bottom into an
	   oversized pill. A group that genuinely wants the full height still gets
	   it via its own explicit sizing (e.g. a stacked icon-over-label button),
	   unaffected by this default. Narrow viewports scroll sideways. */
	.pptx-svelte-ribbon-content {
		display: flex;
		align-items: center;
		flex-wrap: nowrap;
		gap: 0;
		min-height: 82px;
		padding: 2px 4px;
		overflow-x: auto;
		overflow-y: hidden;
		scrollbar-width: thin;
	}

	/* Each active tab is the single direct child; stretch it to the full row
	   height and top-align its groups so controls sit at the top with labels
	   below (PowerPoint layout), rather than vertically centered. */
	.pptx-svelte-ribbon-content > :global(*) {
		align-self: stretch;
		align-items: flex-start;
	}

	/* Shared compact dark select for ribbon dropdowns (font family, change
	   case, character spacing, line spacing, ...), matching React's ribbon
	   select-style triggers: dark translucent background, subtle border,
	   small font, custom chevron instead of the native OS control chrome. */
	.pptx-svelte-ribbon :global(select.pptx-svelte-ribbon-select) {
		height: 24px;
		padding: 0 18px 0 8px;
		border: 1px solid color-mix(in srgb, var(--pptx-border, #33334d) 60%, transparent);
		border-radius: 4px;
		background-color: color-mix(in srgb, var(--pptx-background, #11111b) 60%, transparent);
		background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16'%3E%3Cpath d='M4 6l4 4 4-4' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E");
		background-repeat: no-repeat;
		background-position: right 5px center;
		background-size: 9px;
		color: var(--pptx-card-foreground, #e2e8f0);
		font: inherit;
		font-size: 11px;
		line-height: 1;
		appearance: none;
		cursor: pointer;
		transition: background-color 0.15s ease;
	}

	.pptx-svelte-ribbon :global(select.pptx-svelte-ribbon-select:hover:not(:disabled)) {
		background-color: color-mix(in srgb, var(--pptx-accent, #33334d) 40%, transparent);
	}

	.pptx-svelte-ribbon :global(select.pptx-svelte-ribbon-select:disabled) {
		opacity: 0.35;
		cursor: default;
	}

	.pptx-svelte-ribbon :global(select.pptx-svelte-ribbon-select option) {
		background: var(--pptx-popover, #111827);
		color: var(--pptx-popover-foreground, #f3f4f6);
	}

	@media (max-width: 767px), (max-width: 1023px) and (max-height: 520px) {
		.pptx-svelte-ribbon {
			display: none;
		}
	}
</style>
