<script lang="ts">
	/**
	 * Ribbon: the tabbed editing chrome shown in place of `ViewerToolbar` while
	 * `editable` is on (React parity: quick-access primary row + tab bar +
	 * per-tab content). Mirrors React's tab order/labels, but only renders the
	 * tabs this binding currently has content for (File / Home / Insert /
	 * View); the compact nav row (prev/next/counter) stays visible regardless
	 * of the active tab, matching React's layout and the vanilla binding's
	 * "core viewing features a read-only viewer still needs" rationale.
	 */
	import { useTranslator } from '../../../i18n/context';
	import AnimationsTab from './animations/AnimationsTab.svelte';
	import DesignTab from './design/DesignTab.svelte';
	import DrawTab from './draw/DrawTab.svelte';
	import FileTab from './file/FileTab.svelte';
	import FindReplacePanel from './FindReplacePanel.svelte';
	import HomeTab from './home/HomeTab.svelte';
	import InsertTab from './insert/InsertTab.svelte';
	import RibbonNavRow from './RibbonNavRow.svelte';
	import RibbonPrimaryRow from './RibbonPrimaryRow.svelte';
	import RibbonTabBar from './RibbonTabBar.svelte';
	import { DEFAULT_RIBBON_TAB } from './ribbon-tabs';
	import type { RibbonProps } from './ribbon-types';
	import TransitionsTab from './transitions/TransitionsTab.svelte';
	import ViewTab from './view/ViewTab.svelte';

	const props: RibbonProps = $props();
	const t = useTranslator();

	let activeTab = $state(DEFAULT_RIBBON_TAB);

	function selectTab(id: typeof activeTab): void {
		activeTab = id;
	}
</script>

<div class="pptx-svelte-ribbon" role="region" aria-label={t('pptx.toolbar.presentationToolbarAria')}>
	<RibbonNavRow
		current={props.current}
		total={props.total}
		onprev={props.onprev}
		onnext={props.onnext}
		zoomPercent={props.zoomPercent}
		onzoomin={props.onzoomin}
		onzoomout={props.onzoomout}
		onzoomfit={props.onzoomfit}
		isFullscreen={props.isFullscreen}
		onfullscreen={props.onfullscreen}
		showNotes={props.showNotes}
		notesExpanded={props.notesExpanded}
		onnotestoggle={props.onnotestoggle}
	/>
	<RibbonPrimaryRow
		canUndo={props.canUndo}
		canRedo={props.canRedo}
		dirty={props.dirty}
		onundo={props.onundo}
		onredo={props.onredo}
		onsave={props.onsave}
		ondownload={props.ondownload}
		autosaveStatus={props.autosaveStatus}
		autosaveDirty={props.autosaveDirty}
	/>
	<RibbonTabBar active={activeTab} onselect={selectTab} />
	<FindReplacePanel findReplace={props.findReplace} editable={props.editor.editable} />
	<div class="pptx-svelte-ribbon-content">
		{#if activeTab === 'file'}
			<FileTab ondownload={props.ondownload} exportUi={props.exportUi} />
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
		padding: 6px 10px;
	}
</style>
