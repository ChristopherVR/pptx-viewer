<script lang="ts">
	/**
	 * ReviewTab: the ribbon's Review tab, at React's `ReviewSection` control set
	 * (Proofing / Accessibility / Language / Changes / Comments / Protect).
	 *
	 * The tab is thin presentation: the audit itself lives in
	 * `ReviewAccessibilityPanel.svelte` (which calls the shared
	 * `collectAccessibilityIssues`), and comment threading lives in
	 * `ReviewCommentsPanel.svelte`. Both open in the same docked popover, so
	 * only one panel is on screen at a time.
	 *
	 * Thesaurus, Translate, Mark All Read, Delete/Previous/Next comment, Read
	 * Only, Restrict Permission and Hide Ink are disabled placeholders in every
	 * binding including React. They are rendered rather than dropped so a user
	 * on Svelte sees the same tab a user on React does; see `RecordTab.svelte`
	 * for why the placeholder labels resolve through `keyToLabel`.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
	import RibbonCommand from '../RibbonCommand.svelte';
	import RibbonCommandStack from '../RibbonCommandStack.svelte';
	import RibbonGroup from '../RibbonGroup.svelte';
	import ReviewAccessibilityPanel from './ReviewAccessibilityPanel.svelte';
	import ReviewCommentsPanel from './ReviewCommentsPanel.svelte';

	const {
		slides,
		onnavigate,
		editor,
		oncompare,
		onlanguage,
		spellCheck = false,
		onspellcheckchange,
	}: {
		slides: readonly PptxSlide[];
		onnavigate: (slideIndex: number, elementId?: string) => void;
		editor?: EditorState;
		oncompare?: () => void;
		onlanguage?: () => void;
		spellCheck?: boolean;
		onspellcheckchange?: (enabled: boolean) => void;
	} = $props();
	const t = useTranslator();

	let activePanel = $state<'accessibility' | 'comments' | null>(null);

	function setPanel(panel: 'accessibility' | 'comments' | null): void {
		activePanel = panel;
	}
</script>

<div class="pptx-svelte-review-shell">
	<div class="pptx-svelte-review-groups">
		<RibbonGroup label={t('pptx.review.proofing')}>
			<RibbonCommand
				label={t('pptx.review.spelling')}
				title={t('pptx.settings.spellCheck')}
				active={spellCheck}
				onclick={() => onspellcheckchange?.(!spellCheck)}
			>
				{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M2 14 6 5l4 9M3.4 11.4h5.2M12 13.5l2 2 4-4.5" /></svg>{/snippet}
			</RibbonCommand>
			<RibbonCommand label={t('pptx.review.thesaurus')} disabled>
				{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M3 4h5a2 2 0 0 1 2 2v10a2 2 0 0 0-2-2H3zM17 4h-5a2 2 0 0 0-2 2v10a2 2 0 0 1 2-2h5z" /></svg>{/snippet}
			</RibbonCommand>
		</RibbonGroup>

		<RibbonGroup label={t('pptx.review.accessibility')}>
			<RibbonCommand
				label={t('pptx.review.accessibilityCheck')}
				active={activePanel === 'accessibility'}
				onclick={() => setPanel('accessibility')}
			>
				{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M10 3 3.5 5.5v4.2c0 3.4 2.7 6.1 6.5 7.3 3.8-1.2 6.5-3.9 6.5-7.3V5.5z" /><path d="m7.3 10 2 2 3.4-3.6" /></svg>{/snippet}
			</RibbonCommand>
		</RibbonGroup>

		<RibbonGroup label={t('pptx.review.language')}>
			<RibbonCommand label={t('pptx.review.translate')} disabled>
				{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M2.5 4.5h7M6 3v1.5M8 4.5c0 3-2.4 5.5-5.5 6M4 7.5c.9 1.9 2.6 3.2 4.6 3.6M10.5 17l3.2-8 3.3 8M11.8 14.4h4.4" /></svg>{/snippet}
			</RibbonCommand>
			<RibbonCommand
				label={t('pptx.review.language')}
				title={t('pptx.review.languageTooltip')}
				disabled={!onlanguage}
				onclick={onlanguage}
			>
				{#snippet icon()}<svg viewBox="0 0 20 20"><circle cx="10" cy="10" r="7" /><path d="M3 10h14M10 3c1.9 2 2.9 4.4 2.9 7s-1 5-2.9 7c-1.9-2-2.9-4.4-2.9-7s1-5 2.9-7z" /></svg>{/snippet}
			</RibbonCommand>
		</RibbonGroup>

		<RibbonGroup label={t('pptx.review.changes')}>
			<RibbonCommand label={t('pptx.review.markAllRead')} disabled>
				{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M7 5h9v11H7z" /><path d="M4 15V4h9" /></svg>{/snippet}
			</RibbonCommand>
			{#if oncompare}
				<RibbonCommand
					label={t('pptx.ribbon.compare')}
					title={t('pptx.compare.title')}
					disabled={!editor?.editable}
					onclick={oncompare}
				>
					{#snippet icon()}<svg viewBox="0 0 20 20"><circle cx="5.5" cy="15" r="2.2" /><circle cx="5.5" cy="5" r="2.2" /><path d="M5.5 7.2v5.6M14.5 5h-4v10h4" /><circle cx="14.5" cy="15" r="2.2" /></svg>{/snippet}
				</RibbonCommand>
			{/if}
		</RibbonGroup>

		<RibbonGroup label={t('pptx.toolbar.comments')}>
			<RibbonCommand
				label={t('pptx.toolbar.comments')}
				title={t('pptx.comments.slideComments')}
				active={activePanel === 'comments'}
				onclick={() => setPanel('comments')}
			>
				{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M3 4h14v9H8l-5 4z" /><path d="M10 6v5M7.5 8.5h5" /></svg>{/snippet}
			</RibbonCommand>
			<RibbonCommandStack>
				<RibbonCommand compact label={t('pptx.common.delete')} disabled>
					{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M4 6h12M8 6V4h4v2M6 6l.8 10h6.4L14 6" /></svg>{/snippet}
				</RibbonCommand>
				<RibbonCommand compact label={t('pptx.common.previous')} disabled>
					{#snippet icon()}<svg viewBox="0 0 20 20"><path d="m12 4-6 6 6 6" /></svg>{/snippet}
				</RibbonCommand>
			</RibbonCommandStack>
			<RibbonCommandStack>
				<RibbonCommand compact label={t('pptx.common.next')} disabled>
					{#snippet icon()}<svg viewBox="0 0 20 20"><path d="m8 4 6 6-6 6" /></svg>{/snippet}
				</RibbonCommand>
				<RibbonCommand compact label={t('pptx.review.showComments')} onclick={() => setPanel('comments')}>
					{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M3 4h14v9H8l-5 4z" /></svg>{/snippet}
				</RibbonCommand>
			</RibbonCommandStack>
		</RibbonGroup>

		<RibbonGroup label={t('pptx.review.protect')}>
			<RibbonCommand label={t('pptx.review.readOnly')} disabled>
				{#snippet icon()}<svg viewBox="0 0 20 20"><rect x="4" y="9" width="12" height="8" rx="1.5" /><path d="M7 9V6.5a3 3 0 0 1 6 0V9" /></svg>{/snippet}
			</RibbonCommand>
			<RibbonCommand label={t('pptx.review.restrictPermission')} disabled>
				{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M10 3 4 5.4v4.1c0 3.3 2.5 6 6 7.1 3.5-1.1 6-3.8 6-7.1V5.4z" /></svg>{/snippet}
			</RibbonCommand>
			<RibbonCommand label={t('pptx.review.hideInk')} disabled>
				{#snippet icon()}<svg viewBox="0 0 20 20"><path d="M2.5 10S5.5 5 10 5s7.5 5 7.5 5-3 5-7.5 5-7.5-5-7.5-5z" /><path d="m4 4 12 12" /></svg>{/snippet}
			</RibbonCommand>
		</RibbonGroup>
	</div>

	{#if activePanel}
		<!-- Named after the panel, never after the tab: the cross-binding ribbon
		     inventory treats a `role="dialog"` carrying the ACTIVE TAB's name as a
		     backstage overlay and reads the tab's controls out of it instead of
		     out of the ribbon row. -->
		<div
			class="pptx-svelte-review-panel"
			role="dialog"
			aria-label={activePanel === 'accessibility'
				? t('pptx.accessibility.title')
				: t('pptx.comments.slideComments')}
		>
			<button
				type="button"
				class="pptx-svelte-review-close"
				aria-label={t('pptx.common.close')}
				onclick={() => setPanel(null)}>x</button
			>
			{#if activePanel === 'accessibility'}
				<ReviewAccessibilityPanel {slides} {onnavigate} />
			{:else if editor}
				<ReviewCommentsPanel {editor} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-review-shell { position: relative; display: flex; align-items: stretch; min-width: 0; }
	.pptx-svelte-review-groups { display: flex; align-items: stretch; flex-wrap: nowrap; }
	.pptx-svelte-review-panel { position: absolute; z-index: 40; top: calc(100% + 8px); left: 0; display: flex; gap: 12px; width: min(920px, calc(100vw - 32px)); max-height: min(520px, calc(100vh - 180px)); padding: 12px; overflow: auto; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 12px 32px rgb(0 0 0 / 35%); }
	.pptx-svelte-review-close { position: absolute; top: 6px; right: 8px; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
</style>
