<script lang="ts">
	/**
	 * RibbonTabContent: the ribbon's tab-body switch (one row of groups for the
	 * active fixed or contextual tab). Split out of `Ribbon.svelte` to keep the
	 * shell under the file-size budget; it owns no state and reads everything
	 * off the shell's own props.
	 */
	import type { RibbonContextualTabId } from 'pptx-viewer-shared';
	import { RIBBON_CONTEXTUAL_TABS } from 'pptx-viewer-shared';

	import AnimationsTab from './animations/AnimationsTab.svelte';
	import DesignTab from './design/DesignTab.svelte';
	import DrawTab from './draw/DrawTab.svelte';
	import ContextualTab from './galleries/ContextualTab.svelte';
	import HelpTab from './help/HelpTab.svelte';
	import HomeTab from './home/HomeTab.svelte';
	import InsertTab from './insert/InsertTab.svelte';
	import RecordTab from './record/RecordTab.svelte';
	import ReviewTab from './review/ReviewTab.svelte';
	import type { RibbonTabId } from './ribbon-tabs';
	import type { RibbonProps } from './ribbon-types';
	import SlideShowTab from './slideshow/SlideShowTab.svelte';
	import TransitionsTab from './transitions/TransitionsTab.svelte';
	import ViewTab from './view/ViewTab.svelte';

	const {
		ribbon,
		tab,
		onselecttab,
		onslidesize,
	}: {
		ribbon: RibbonProps;
		tab: RibbonTabId | RibbonContextualTabId;
		onselecttab: (id: RibbonTabId | RibbonContextualTabId) => void;
		onslidesize: () => void;
	} = $props();

	function isContextualTab(id: string): id is RibbonContextualTabId {
		return RIBBON_CONTEXTUAL_TABS.some((entry) => entry.id === id);
	}
</script>

<div class="pptx-svelte-ribbon-content">
	{#if tab === 'home'}
		<HomeTab editor={ribbon.editor} findReplace={ribbon.findReplace} onnavigateslide={ribbon.onnavigateslide} hiddenActions={ribbon.hiddenActions} />
	{:else if tab === 'insert'}
		<InsertTab editor={ribbon.editor} canvasSize={ribbon.canvasSize} onheaderfooter={ribbon.onheaderfooter} />
	{:else if tab === 'draw'}
		<DrawTab editor={ribbon.editor} />
	{:else if tab === 'design'}
		<DesignTab editor={ribbon.editor} {onslidesize} />
	{:else if tab === 'transitions'}
		<TransitionsTab editor={ribbon.editor} chromeUi={ribbon.chromeUi} />
	{:else if tab === 'animations'}
		<AnimationsTab editor={ribbon.editor} chromeUi={ribbon.chromeUi} />
	{:else if tab === 'slideShow'}
		<SlideShowTab
			editor={ribbon.editor}
			onfrombeginning={ribbon.onfrombeginning}
			onfromcurrent={ribbon.onfromcurrent}
			onpresenter={ribbon.onpresenter}
			onsetup={ribbon.onsetupslideshow}
			onrehearse={ribbon.onrehearse}
			onsubtitles={ribbon.onsubtitles}
			oncustomshows={ribbon.oncustomshows}
			onhideslide={ribbon.onhideslide}
			activeSlideHidden={Boolean(ribbon.slides?.[ribbon.current]?.hidden)}
			subtitlesEnabled={ribbon.subtitlesEnabled}
			onbroadcast={ribbon.onbroadcast}
		/>
	{:else if tab === 'review'}
		<ReviewTab slides={ribbon.slides} onnavigate={ribbon.onnavigatetoissue} editor={ribbon.editor} oncompare={ribbon.oncompare} onlanguage={ribbon.onsettings} spellCheck={ribbon.preferences.spellCheck} onspellcheckchange={(enabled) => ribbon.onpreferenceschange({ ...ribbon.preferences, spellCheck: enabled })} />
	{:else if tab === 'record'}
		<RecordTab onfrombeginning={ribbon.onrecordfrombeginning} onfromcurrent={ribbon.onrecordfromcurrent} />
	{:else if tab === 'view'}
		<ViewTab
			editor={ribbon.editor}
			preferences={ribbon.preferences}
			onpreferenceschange={ribbon.onpreferenceschange}
			showGuides={ribbon.showGuides}
			onshowguideschange={ribbon.onshowguideschange}
			snapToShape={ribbon.snapToShape}
			onsnapToShapechange={ribbon.onsnapToShapechange}
			onaddguide={ribbon.onaddguide}
			onzoomfit={ribbon.onzoomfit}
			onnormal={ribbon.onnormal}
			editTemplateMode={ribbon.editor.editTemplateMode}
			onsettemplateediting={(enabled) => ribbon.editor.setTemplateEditing(enabled)}
			onentermasterview={ribbon.onentermasterview}
			onselectionpane={ribbon.onselectionpane}
			onslidesorter={ribbon.onslidesorter}
			onoutlineview={ribbon.onoutlineview}
			onreadingview={ribbon.onreadingview}
		/>
	{:else if tab === 'help'}
		<HelpTab onaccessibility={() => onselecttab('review')} onshortcuts={ribbon.onshortcuts} onsettings={ribbon.onsettings} />
	{:else if isContextualTab(tab)}
		<ContextualTab {tab} />
	{/if}
</div>

<style>
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

	/* Stretch the tab wrapper, but keep its plain controls centered. Labelled
	   RibbonGroups opt into stretching so their captions share a baseline. */
	.pptx-svelte-ribbon-content > :global(*) {
		align-self: stretch;
		align-items: center;
	}
</style>
