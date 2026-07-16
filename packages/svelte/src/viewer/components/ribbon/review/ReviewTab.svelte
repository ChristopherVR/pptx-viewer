<script lang="ts">
	/**
	 * ReviewTab: presentation-wide accessibility audit. The checking and
	 * grouping functions live in `pptx-viewer-shared`, keeping the Svelte view
	 * to stateful presentation and issue-to-slide navigation only.
	 */
	import type { PptxSlide } from 'pptx-viewer-core';
	import {
		collectAccessibilityIssues,
		countAccessibilityIssues,
		groupIssuesBySeverity,
		issueTrackKey,
		issueTypeLabel,
	} from 'pptx-viewer-shared';

	import { useTranslator } from '../../../../i18n/context';
	import type { EditorState } from '../../../editor/editor-state.svelte';
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

	let hasRun = $state(false);
	let activePanel = $state<'accessibility' | 'comments' | null>(null);
	let issues = $state.raw<ReturnType<typeof collectAccessibilityIssues>>([]);
	const groups = $derived(groupIssuesBySeverity(issues));

	function setPanel(panel: 'accessibility' | 'comments' | null): void {
		activePanel = panel;
	}

	function runCheck(): void {
		issues = collectAccessibilityIssues(slides);
		hasRun = true;
	}

	function severityIcon(severity: 'error' | 'warning' | 'tip'): string {
		return severity === 'error' ? '!' : severity === 'warning' ? '!' : 'i';
	}
</script>

<div class="pptx-svelte-review-shell">
	<section class="pptx-svelte-review-actions" aria-label={t('pptx.ribbon.tab.review')}>
		<button type="button" onclick={() => setPanel('comments')}>
			{t('pptx.comments.slideComments')}
		</button>
		<button type="button" onclick={() => setPanel('accessibility')}>
			{t('pptx.review.accessibilityCheck')}
		</button>
		{#if oncompare}<button type="button" disabled={!editor?.editable} onclick={oncompare}>{t('pptx.compare.title')}</button>{/if}
		<button type="button" aria-pressed={spellCheck} class:active={spellCheck} onclick={() => onspellcheckchange?.(!spellCheck)}>{t('pptx.settings.spellCheck')}</button>
		{#if onlanguage}<button type="button" title={t('pptx.review.languageTooltip')} onclick={onlanguage}>{t('pptx.review.language')}</button>{/if}
	</section>

	{#if activePanel}
		<div class="pptx-svelte-review-panel" role="dialog" aria-label={t('pptx.ribbon.tab.review')}>
			<button
				type="button"
				class="pptx-svelte-review-close"
				aria-label={t('pptx.common.close')}
				onclick={() => setPanel(null)}>x</button
			>
			{#if activePanel === 'accessibility'}
				<section class="pptx-svelte-review" aria-label={t('pptx.ribbon.tab.review')}>
	<div class="pptx-svelte-review-heading">
		<div>
			<span class="pptx-svelte-review-eyebrow">{t('pptx.ribbon.tab.review')}</span>
			<h3>{t('pptx.accessibility.title')}</h3>
		</div>
		<button type="button" onclick={runCheck}>{t('pptx.review.accessibilityCheck')}</button>
	</div>

	{#if hasRun}
		<p class="pptx-svelte-review-summary" aria-live="polite">
			{t('pptx.accessibility.issueCount', { count: countAccessibilityIssues(issues) })}
		</p>
		{#if issues.length === 0}
			<div class="pptx-svelte-review-success" role="status">
				<strong>{t('pptx.accessibility.noIssuesFound')}</strong>
				<span>{t('pptx.accessibility.noIssuesHint')}</span>
			</div>
		{:else}
			<div class="pptx-svelte-review-list" aria-label={t('pptx.accessibility.issuesList')}>
				{#each groups as group}
					<section class="pptx-svelte-review-group">
						<h4>{t(`pptx.accessibility.severity${group.label}`)}</h4>
						{#each group.issues as issue, index (issueTrackKey(issue, index))}
							<button
								type="button"
								class={`pptx-svelte-review-issue pptx-svelte-review-${issue.severity}`}
								onclick={() => onnavigate(issue.slideIndex, issue.elementId)}
							>
								<span class="pptx-svelte-review-icon" aria-hidden="true">{severityIcon(issue.severity)}</span>
								<span class="pptx-svelte-review-copy">
									<strong>{issueTypeLabel(issue.type)}</strong>
									<span>{issue.message}</span>
									<small>Slide {issue.slideIndex + 1}. {issue.suggestion}</small>
								</span>
							</button>
						{/each}
					</section>
				{/each}
			</div>
		{/if}
	{/if}
				</section>

			{:else if editor}
				<ReviewCommentsPanel {editor} />
			{/if}
		</div>
	{/if}
</div>

<style>
	.pptx-svelte-review-shell { position: relative; display: flex; align-items: center; min-width: 0; }
	.pptx-svelte-review-actions { display: flex; align-items: center; gap: 6px; }
	.pptx-svelte-review-actions button { height: 28px; padding: 0 10px; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-muted, #2a2a3d); color: inherit; cursor: pointer; font: inherit; font-size: 12px; }
	.pptx-svelte-review-actions button.active { background: var(--pptx-primary); color: var(--pptx-primary-foreground); }
	.pptx-svelte-review-panel { position: absolute; z-index: 40; top: calc(100% + 8px); left: 0; display: flex; gap: 12px; width: min(920px, calc(100vw - 32px)); max-height: min(520px, calc(100vh - 180px)); padding: 12px; overflow: auto; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-card, #1e1e2e); box-shadow: 0 12px 32px rgb(0 0 0 / 35%); }
	.pptx-svelte-review-close { position: absolute; top: 6px; right: 8px; border: 0; background: transparent; color: inherit; cursor: pointer; font: inherit; }
	.pptx-svelte-review { display: flex; flex-direction: column; gap: 8px; width: min(560px, 100%); }
	.pptx-svelte-review-heading { display: flex; justify-content: space-between; align-items: center; gap: 14px; }
	.pptx-svelte-review-eyebrow { display: block; color: var(--pptx-muted-foreground, #94a3b8); font-size: 10px; font-weight: 700; letter-spacing: .08em; text-transform: uppercase; }
	.pptx-svelte-review h3 { margin: 1px 0 0; font-size: 13px; }
	.pptx-svelte-review-heading button { height: 28px; padding: 0 10px; border: none; border-radius: var(--pptx-radius, 6px); background: var(--pptx-primary, #6366f1); color: var(--pptx-primary-foreground, white); cursor: pointer; font: inherit; font-size: 12px; font-weight: 600; }
	.pptx-svelte-review-heading button:hover { filter: brightness(1.12); }
	.pptx-svelte-review-summary { margin: 0; color: var(--pptx-muted-foreground, #94a3b8); font-size: 11px; }
	.pptx-svelte-review-success { display: grid; gap: 2px; padding: 10px; border: 1px solid #238636; border-radius: var(--pptx-radius, 6px); background: color-mix(in srgb, #238636 18%, transparent); color: #9be9a8; font-size: 12px; }
	.pptx-svelte-review-success span { color: var(--pptx-muted-foreground, #94a3b8); }
	.pptx-svelte-review-list { display: grid; gap: 8px; max-height: 240px; overflow-y: auto; }
	.pptx-svelte-review-group { display: grid; gap: 3px; }
	.pptx-svelte-review-group h4 { margin: 0; color: var(--pptx-muted-foreground, #94a3b8); font-size: 10px; letter-spacing: .06em; text-transform: uppercase; }
	.pptx-svelte-review-issue { display: flex; align-items: flex-start; gap: 8px; width: 100%; padding: 7px; border: 1px solid var(--pptx-border, #33334d); border-radius: var(--pptx-radius, 6px); background: var(--pptx-muted, #2a2a3d); color: inherit; cursor: pointer; font: inherit; text-align: left; }
	.pptx-svelte-review-issue:hover { background: var(--pptx-accent, #33334d); }
	.pptx-svelte-review-icon { display: grid; place-items: center; flex: none; width: 15px; height: 15px; border-radius: 50%; font-size: 10px; font-weight: 800; }
	.pptx-svelte-review-error .pptx-svelte-review-icon { background: #e5484d; color: white; }
	.pptx-svelte-review-warning .pptx-svelte-review-icon { background: #d97706; color: white; }
	.pptx-svelte-review-tip .pptx-svelte-review-icon { background: #2563eb; color: white; }
	.pptx-svelte-review-copy { display: grid; gap: 1px; min-width: 0; font-size: 11.5px; }
	.pptx-svelte-review-copy span, .pptx-svelte-review-copy small { color: var(--pptx-muted-foreground, #94a3b8); }
	.pptx-svelte-review-copy small { font-size: 10.5px; }
</style>
