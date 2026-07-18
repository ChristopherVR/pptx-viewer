<script lang="ts">
	/**
	 * React-aligned command row above the ribbon tabs (`ToolbarPrimaryRow`
	 * port): slides-pane toggle on the left; comments, Present split button,
	 * "+ Show" (custom shows), inspector toggle, settings gear, and the export
	 * overflow menu on the right. Save/undo/redo stay in the title bar.
	 */
	import Settings from '@lucide/svelte/icons/settings';
	import { isActionHidden } from 'pptx-viewer-shared';
	import type { ToolbarActionId } from 'pptx-viewer-shared';
	import { useTranslator } from '../../../i18n/context';
	import type { ChromeUiState } from '../../state/chrome-ui.svelte';
	import type { ExportUiState } from '../../export/export-ui.svelte';
	import PresentSplitButton from './PresentSplitButton.svelte';
	import RibbonOverflowMenu from './RibbonOverflowMenu.svelte';

	const {
		chromeUi,
		readOnly = false,
		commentCount = 0,
		onpresent,
		onpresenter,
		onrehearse,
		onsetup,
		onbroadcast,
		onsubtitles,
		subtitlesEnabled = false,
		oncustomshows,
		onsettings,
		exportUi,
		hiddenActions,
	}: {
		chromeUi?: ChromeUiState;
		readOnly?: boolean;
		commentCount?: number;
		onpresent: () => void;
		onpresenter?: () => void;
		onrehearse?: () => void;
		onsetup?: () => void;
		onbroadcast?: () => void;
		onsubtitles?: () => void;
		subtitlesEnabled?: boolean;
		oncustomshows?: () => void;
		onsettings?: () => void;
		exportUi?: ExportUiState;
		hiddenActions?: ToolbarActionId[];
	} = $props();

	const t = useTranslator();
</script>

<div class="pptx-svelte-ribbon-primary" role="group" aria-label={t('pptx.toolbar.presentationToolbarAria')}>
	{#if chromeUi}
		<button
			type="button"
			class:pptx-svelte-ribbon-primary-on={!chromeUi.sidebarCollapsed}
			aria-label={t('pptx.toolbar.toggleSlidesPanel')}
			title={t('pptx.toolbar.toggleSlidesPanel')}
			aria-pressed={!chromeUi.sidebarCollapsed}
			onclick={() => chromeUi.toggleSidebar()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M6 2.5v11" stroke="currentColor" stroke-width="1.3" /></svg>
		</button>
	{/if}
	<span class="pptx-svelte-ribbon-primary-spacer"></span>
	{#if chromeUi}
		<button
			type="button"
			class="pptx-svelte-ribbon-primary-comments"
			class:pptx-svelte-ribbon-primary-on={chromeUi.commentsOpen}
			aria-label={t('pptx.toolbar.comments')}
			title={t('pptx.toolbar.comments')}
			aria-pressed={chromeUi.commentsOpen}
			onclick={() => chromeUi.toggleComments()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M2.5 3.5h11v7h-6l-3 3v-3h-2z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" /></svg>
			{#if commentCount > 0}<span class="pptx-svelte-ribbon-primary-badge">{commentCount}</span>{/if}
		</button>
	{/if}
	<PresentSplitButton
		{onpresent}
		{onpresenter}
		{onrehearse}
		{onsetup}
		{onbroadcast}
		{onsubtitles}
		{subtitlesEnabled}
	/>
	{#if oncustomshows}
		<button
			type="button"
			class="pptx-svelte-ribbon-primary-shows"
			aria-label={t('pptx.customShows.createTooltip')}
			title={t('pptx.customShows.createTooltip')}
			onclick={oncustomshows}
		>
			{t('pptx.customShows.addShow')}
		</button>
	{/if}
	<span class="pptx-svelte-ribbon-primary-sep" aria-hidden="true"></span>
	{#if chromeUi}
		<button
			type="button"
			class:pptx-svelte-ribbon-primary-on={chromeUi.inspectorOpen}
			aria-label={t('pptx.toolbar.toggleInspector')}
			title={t('pptx.toolbar.toggleInspector')}
			aria-pressed={chromeUi.inspectorOpen}
			onclick={() => chromeUi.toggleInspector()}
		>
			<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="2.5" width="13" height="11" rx="1.5" fill="none" stroke="currentColor" stroke-width="1.3" /><path d="M10 2.5v11" stroke="currentColor" stroke-width="1.3" /></svg>
		</button>
	{/if}
	{#if onsettings}
		<button
			type="button"
			aria-label={t('pptx.toolbar.settings')}
			title={t('pptx.toolbar.settingsShortcuts')}
			onclick={onsettings}
		>
			<Settings size={15} strokeWidth={1.7} aria-hidden="true" />
		</button>
	{/if}
	{#if exportUi && !isActionHidden('export', hiddenActions)}
		<RibbonOverflowMenu {exportUi} />
	{/if}
	{#if readOnly}
		<span class="pptx-svelte-ribbon-primary-readonly">{t('pptx.toolbar.readOnly')}</span>
	{/if}
</div>

<style>
	.pptx-svelte-ribbon-primary {
		display: flex;
		align-items: center;
		gap: 4px;
		padding: 3px 10px;
		border-top: 1px solid var(--pptx-border, #33334d);
	}

	.pptx-svelte-ribbon-primary-spacer {
		flex: 1;
	}

	.pptx-svelte-ribbon-primary-sep {
		width: 1px;
		align-self: stretch;
		margin: 2px 4px;
		background: var(--pptx-border, #33334d);
	}

	.pptx-svelte-ribbon-primary button {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		min-width: 26px;
		height: 26px;
		border: none;
		border-radius: var(--pptx-radius, 6px);
		background: transparent;
		color: var(--pptx-muted-foreground, #94a3b8);
		cursor: pointer;
		font: inherit;
	}

	.pptx-svelte-ribbon-primary button:hover:not(:disabled) {
		background: var(--pptx-accent, #33334d);
		color: var(--pptx-accent-foreground, #f8fafc);
	}

	.pptx-svelte-ribbon-primary button:disabled {
		opacity: 0.4;
		cursor: default;
	}

	.pptx-svelte-ribbon-primary svg {
		width: 15px;
		height: 15px;
	}

	.pptx-svelte-ribbon-primary-on {
		color: var(--pptx-card-foreground, #e2e8f0);
	}

	.pptx-svelte-ribbon-primary-comments {
		position: relative;
	}

	.pptx-svelte-ribbon-primary-badge {
		position: absolute;
		top: -2px;
		right: -2px;
		display: grid;
		place-items: center;
		width: 14px;
		height: 14px;
		border-radius: 50%;
		background: var(--pptx-primary, #6366f1);
		color: #fff;
		font-size: 8px;
		line-height: 1;
	}

	.pptx-svelte-ribbon-primary-shows {
		padding: 0 8px;
		font-size: 11px;
		white-space: nowrap;
		background: var(--pptx-muted, #2a2a3d);
	}

	.pptx-svelte-ribbon-primary-readonly {
		display: inline-flex;
		align-items: center;
		padding: 1px 8px;
		border-radius: 3px;
		background: color-mix(in srgb, #d97706 90%, transparent);
		color: #fffbeb;
		font-size: 10px;
		white-space: nowrap;
	}
</style>
