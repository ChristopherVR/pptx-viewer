<script lang="ts">
	/**
	 * Ribbon: the tabbed editing chrome shown in place of `ViewerToolbar` while
	 * `editable` is on. Slide navigation, slide position, and zoom live in the
	 * bottom status bar, matching React instead of adding a duplicate row above
	 * the ribbon tabs.
	 */
	import { useTranslator } from '../../../i18n/context';
	import AnimationsTab from './animations/AnimationsTab.svelte';
	import DesignTab from './design/DesignTab.svelte';
	import DrawTab from './draw/DrawTab.svelte';
	import FileTab from './file/FileTab.svelte';
	import FindReplacePanel from './FindReplacePanel.svelte';
	import HomeTab from './home/HomeTab.svelte';
	import InsertTab from './insert/InsertTab.svelte';
	import RibbonPrimaryRow from './RibbonPrimaryRow.svelte';
	import RibbonTabBar from './RibbonTabBar.svelte';
	import SlideShowTab from './slideshow/SlideShowTab.svelte';
	import ReviewTab from './review/ReviewTab.svelte';
	import { DEFAULT_RIBBON_TAB } from './ribbon-tabs';
	import type { RibbonProps } from './ribbon-types';
	import TransitionsTab from './transitions/TransitionsTab.svelte';
	import ViewTab from './view/ViewTab.svelte';

	const props: RibbonProps = $props();
	const t = useTranslator();

	let activeTab = $state(DEFAULT_RIBBON_TAB);
	$effect(() => {
		if (props.editor.equationOps.editingId) {
			activeTab = 'insert';
		}
	});

	function selectTab(id: typeof activeTab): void {
		activeTab = id;
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
			<FileTab ondownload={props.ondownload} onopenfile={props.onopenfile} exportUi={props.exportUi} />
		{:else if activeTab === 'home'}
			<HomeTab editor={props.editor} findReplace={props.findReplace} onnavigateslide={props.onnavigateslide} />
		{:else if activeTab === 'insert'}
			<InsertTab editor={props.editor} canvasSize={props.canvasSize} />
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
				onbroadcast={props.onbroadcast}
			/>
		{:else if activeTab === 'review'}
			<ReviewTab slides={props.slides} onnavigate={props.onnavigatetoissue} editor={props.editor} />
		{:else if activeTab === 'view'}
			<ViewTab
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
			/>
		{/if}
	</div>
</div>

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
