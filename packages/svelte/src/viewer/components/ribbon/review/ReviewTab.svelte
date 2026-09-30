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
	import { buildReviewRibbon } from 'pptx-viewer-shared';
	import type { RibbonCommandRequestEvent } from 'pptx-viewer-shared';
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
 const groups = $derived(buildReviewRibbon(t, {
  editable: editor?.editable ?? false, spellCheck,
  canSpellCheck: Boolean(onspellcheckchange), canAccessibility: true, accessibilityOpen: activePanel === 'accessibility',
  canLanguage: Boolean(onlanguage), canCompare: Boolean(oncompare), canComments: Boolean(editor),
  commentsOpen: activePanel === 'comments',
 }));
 function request(event: Event): void {
  switch ((event as RibbonCommandRequestEvent).detail.id) {
   case 'review.proofing.spelling': onspellcheckchange?.(!spellCheck); break;
   case 'review.accessibility.check': setPanel(activePanel === 'accessibility' ? null : 'accessibility'); break;
   case 'review.language.language': onlanguage?.(); break;
   case 'review.compare.compare': if (editor?.editable) {oncompare?.();} break;
   case 'review.comments.newComment':
   case 'review.comments.showComments': if (editor) {setPanel(activePanel === 'comments' ? null : 'comments');} break;
  }
 }

</script>

<div class="pptx-svelte-review-shell">
	<pptx-ui-ribbon-section {groups} oncommand-request={request}></pptx-ui-ribbon-section>

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
	.pptx-svelte-review-panel { position: absolute; z-index: 40; top: calc(100% + 8px); left: 0; display: flex; gap: 12px; width: min(920px, calc(100vw - 32px)); max-height: min(520px, calc(100vh - 180px)); padding: 12px; overflow: auto; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 12px 32px rgb(0 0 0 / 35%); }
	.pptx-svelte-review-close { position: absolute; top: 6px; right: 8px; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
</style>
