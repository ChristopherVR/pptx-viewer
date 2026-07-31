<script lang="ts">
	/**
	 * ViewerChrome: the viewer's top chrome stack, mobile command bar | title bar
	 * | ribbon (or the compact `ViewerToolbar` before a deck is loaded). Split out
	 * of `PowerPointViewer.svelte` to keep that file under the repo's file-size
	 * budget.
	 *
	 * It owns no state: everything comes off the `ViewerStateBag` the root builds
	 * with `createViewerState`, so this file is purely the (large) mapping from
	 * that bag onto the three chrome components' prop contracts. Handing it the
	 * whole bag rather than ~40 individual props is deliberate; the bag is the
	 * viewer's single composition root and the chrome reads most of it.
	 */
	import { readBackstageRecentFile, toggleSheet } from 'pptx-viewer-shared';
	import type { AccountAuthConfig, ToolbarActionId, ViewerTheme } from 'pptx-viewer-shared';

	import type { ViewerStateBag } from '../state/create-viewer-state-types';
	import Ribbon from './ribbon/Ribbon.svelte';
	import TitleBar from './TitleBar.svelte';
	import MobileChrome from './MobileChrome.svelte';
	import ViewerToolbar from './ViewerToolbar.svelte';

	interface ViewerChromeProps {
		vm: ViewerStateBag;
		fileName?: string;
		/** Host `showNotes` prop; the notes toggle also needs a loaded deck. */
		showNotes: boolean;
		hiddenActions?: ToolbarActionId[];
		accountAuth?: AccountAuthConfig;
		/** The resolved chrome theme (Design tab gallery selection). */
		theme: ViewerTheme | undefined;
		onsettheme: (next: ViewerTheme | undefined) => void;
		/** Whether the host enabled the AI assistant (the `ai` prop). */
		aiEnabled: boolean;
		/** Enter the presenter view (a root-owned overlay, not part of the chrome). */
		onpresenter: () => void;
	}

	const {
		vm,
		fileName,
		showNotes,
		hiddenActions,
		accountAuth,
		theme,
		onsettheme,
		aiEnabled,
		onpresenter,
	}: ViewerChromeProps = $props();

	// Stable controller references (the bag is built once and never reassigned).
	// svelte-ignore state_referenced_locally
	const { loader, viewer, editor, parityUi, chromeUi, findReplace, collab, dialogs, autosaveCtl, exportUi, ai } = vm;

	const notesAvailable = $derived(showNotes && loader.slides.length > 0);
	const autosaveStatus = $derived(vm.autosaveActive ? autosaveCtl.status : undefined);
	// React parity: the full ribbon renders for read-only decks too (with a
	// read-only badge and inert edits), so it is gated on a loaded deck, not on
	// `editable`; the badge itself is what reflects the read-only state.
	const ribbonReadOnly = $derived(!vm.editable || collab.readOnly);
	const toggleAi = $derived(aiEnabled ? () => (ai.panelOpen = !ai.panelOpen) : undefined);
</script>

<MobileChrome
	editable={vm.editingActive}
	canUndo={editor.canUndo}
	canRedo={editor.canRedo}
	onmenu={() => vm.setActiveMobileSheet(toggleSheet(vm.activeMobileSheet, 'menu'))}
	onundo={() => editor.undo()}
	onredo={() => editor.redo()}
	onsave={() => void vm.downloadPptx()}
	onpresent={vm.onFullscreenToggle}
	onshare={() => dialogs.openShare()}
	onai={toggleAi}
	aiActive={ai.panelOpen}
	{hiddenActions}
/>
<TitleBar
	{fileName}
	editable={vm.editingActive}
	isDirty={editor.dirty}
	autosaveEnabled={vm.autosaveEnabled}
	{autosaveStatus}
	canUndo={editor.canUndo}
	canRedo={editor.canRedo}
	findReplaceOpen={findReplace.open}
	onautosavetoggle={() => vm.setAutosaveEnabled(!vm.autosaveEnabled)}
	onsave={() => void vm.downloadPptx()}
	onundo={() => editor.undo()}
	onredo={() => editor.redo()}
	onfindreplace={() => findReplace.toggle()}
	onquickcommand={vm.runQuickAccessCommand}
/>
{#if vm.showRibbon}
	<Ribbon
		{fileName}
		{editor}
		readOnly={ribbonReadOnly}
		{findReplace}
		canvasSize={loader.canvasSize}
		current={viewer.current}
		total={viewer.slideCount}
		onprev={() => viewer.prev()}
		onnext={() => viewer.next()}
		onnavigateslide={(index) => viewer.goTo(index)}
		canUndo={editor.canUndo}
		canRedo={editor.canRedo}
		dirty={editor.dirty}
		onundo={() => editor.undo()}
		onredo={() => editor.redo()}
		onsave={() => void editor.save()}
		ondownload={() => void vm.downloadPptx()}
		ondownloadppsx={() => void vm.downloadAs('ppsx')}
		ondownloadpptm={() => void vm.downloadAs('pptm')}
		onpackage={() => void vm.editingApi.packageForSharing()}
		onversionhistory={() => (vm.versionHistoryOpen = true)}
		hasMacros={loader.hasMacros}
		embeddedFontNames={loader.embeddedFonts.map((font) => font.name)}
		hasDigitalSignatures={loader.hasDigitalSignatures}
		digitalSignatureCount={loader.digitalSignatureCount}
		isPasswordProtected={loader.isPasswordProtected}
		{autosaveStatus}
		autosaveDirty={autosaveCtl.isDirty}
		zoomPercent={vm.effectivePercent}
		onzoomin={() => viewer.zoomIn(vm.effectivePercent)}
		onzoomout={() => viewer.zoomOut(vm.effectivePercent)}
		onzoomfit={() => viewer.zoomToFit()}
		isFullscreen={viewer.isFullscreen}
		onfullscreen={vm.onFullscreenToggle}
		showNotes={notesAvailable}
		notesExpanded={vm.notesExpanded}
		onnotestoggle={vm.onNotesToggle}
		onshare={() => dialogs.openShare()}
		onbroadcast={() => dialogs.openBroadcast()}
		collabActive={collab.active}
		{chromeUi}
		subtitlesEnabled={parityUi.subtitlesEnabled}
		slides={vm.displaySlides}
		onnavigatetoissue={(slideIndex, elementId) => {
			viewer.goTo(slideIndex);
			if (elementId) editor.select(elementId);
		}}
		onfrombeginning={() => {
			viewer.goTo(0);
			vm.onFullscreenToggle();
		}}
		onfromcurrent={vm.onFullscreenToggle}
		{onpresenter}
		onsetupslideshow={() => (parityUi.setupSlideShowOpen = true)}
		onheaderfooter={() => (parityUi.headerFooterOpen = true)}
		oncompare={() => void parityUi.compare.chooseFile()}
		onshortcuts={() => (parityUi.shortcutsOpen = !parityUi.shortcutsOpen)}
		onai={toggleAi}
		aiActive={ai.panelOpen}
		onsettings={() => {
			parityUi.syncAutosave(vm.autosaveEnabled);
			parityUi.settingsOpen = true;
		}}
		onprintsettings={() => (parityUi.printSettingsOpen = true)}
		onrehearse={() => {
			parityUi.rehearse.start(viewer.current);
			vm.onFullscreenToggle();
		}}
		onrecordfrombeginning={() => {
			viewer.goTo(0);
			parityUi.rehearse.start(0);
			vm.onFullscreenToggle();
		}}
		onrecordfromcurrent={() => {
			parityUi.rehearse.start(viewer.current);
			vm.onFullscreenToggle();
		}}
		onsubtitles={() => (parityUi.subtitlesEnabled = !parityUi.subtitlesEnabled)}
		oncustomshows={() => (parityUi.customShowsOpen = true)}
		onselectionpane={() => (parityUi.selectionPaneOpen = !parityUi.selectionPaneOpen)}
		onslidesorter={() => (parityUi.slideSorterOpen = true)}
		onnormal={() => {
			if (viewer.isFullscreen) {
				vm.onFullscreenToggle();
			}
			parityUi.slideSorterOpen = false;
		}}
		preferences={parityUi.preferences}
		onpreferenceschange={(next) => {
			parityUi.preferences = next;
		}}
		showGuides={parityUi.showGuides}
		onshowguideschange={(next) => (parityUi.showGuides = next)}
		snapToShape={parityUi.snapToShape}
		onsnapToShapechange={(next) => (parityUi.snapToShape = next)}
		onaddguide={(axis) => {
			parityUi.guides = [
				...parityUi.guides,
				{
					axis,
					position: axis === 'v' ? loader.canvasSize.width / 2 : loader.canvasSize.height / 2,
				},
			];
			parityUi.showGuides = true;
		}}
		{exportUi}
		onopenfile={vm.openFile}
		onopenrecent={(key) => {
			void (async () => {
				const bytes = await readBackstageRecentFile(key);
				if (bytes) await loader.load(bytes);
			})();
		}}
		{theme}
		{onsettheme}
		{accountAuth}
		onentermasterview={() => editor.masterOps.enter()}
		{hiddenActions}
	/>
{:else}
	<ViewerToolbar
		current={viewer.current}
		total={viewer.slideCount}
		zoomPercent={vm.effectivePercent}
		isFullscreen={viewer.isFullscreen}
		onprev={() => viewer.prev()}
		onnext={() => viewer.next()}
		onzoomin={() => viewer.zoomIn(vm.effectivePercent)}
		onzoomout={() => viewer.zoomOut(vm.effectivePercent)}
		onzoomfit={() => viewer.zoomToFit()}
		onfullscreen={vm.onFullscreenToggle}
		showNotes={notesAvailable}
		notesExpanded={vm.notesExpanded}
		onnotestoggle={vm.onNotesToggle}
		exportUi={loader.slides.length > 0 ? exportUi : undefined}
		onshare={() => dialogs.openShare()}
		onbroadcast={() => dialogs.openBroadcast()}
		collabActive={collab.active}
		{hiddenActions}
	/>
{/if}
