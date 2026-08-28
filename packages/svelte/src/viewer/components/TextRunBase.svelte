<script lang="ts">
	/**
	 * TextRunBase: one rendered run of a paragraph, WITHOUT its optional
	 * `a:reflection` mirrored sibling (see `TextRun.svelte`, which wraps this).
	 *
	 * A run is normally a `<span>`, but the shared model marks three kinds that
	 * need a different element around them: a HYPERLINK run (an `<a href>`), an
	 * inline EQUATION run (MathML, whose text is empty), and a RUBY run (a
	 * phonetic guide over the base text). All three used to be dropped here -
	 * `buildParagraphs` returned `{ text, style }` only, so a linked run rendered
	 * as ordinary text, an inline `m:oMath` as nothing, and furigana vanished.
	 */
	import type { ParagraphRun } from 'pptx-viewer-shared';
	import { runEquationMathMl } from 'pptx-viewer-shared';

	import { useTranslator } from '../../i18n/context';
	import { useViewerOptions } from '../state/viewer-options-context';
	import { styleToString } from '../style';
	import TextRunContent from './TextRunContent.svelte';

	const { run }: { run: ParagraphRun } = $props();
	const t = useTranslator();
	const optionsState = useViewerOptions();

	/** Sanitised MathML for an equation run, or `''` when the OMML yields nothing. */
	const mathml = $derived(run.equation ? runEquationMathMl(run.equation) : '');

	/**
	 * Trust Center gate: Options > Trust Center > "Confirm before opening
	 * external hyperlinks" blocks the browser's default navigation until the
	 * user confirms. `confirmHyperlink` no-ops (returns `true`) for internal
	 * `ppaction://` targets and non-http(s) hrefs, so slide jumps and
	 * mailto:/tel: links are unaffected.
	 */
	function onHyperlinkClick(event: MouseEvent): void {
		const href = run.hyperlink?.href;
		if (href && !optionsState.confirmHyperlink(href, t('pptx.options.trust.confirmHyperlinks'))) {
			event.preventDefault();
		}
	}
</script>

{#if run.equation}<span class="pptx-svelte-inline-equation" style={styleToString(run.style)}
		>{#if mathml}<span class="pptx-svelte-equation">{@html mathml}</span>{:else}<span
				class="pptx-svelte-equation-fallback">&hellip;</span
			>{/if}{#if run.equation.number}<span class="pptx-svelte-equation-number"
				>({run.equation.number})</span
			>{/if}</span
	>{:else if run.hyperlink?.href}<a
		class="pptx-svelte-link"
		href={run.hyperlink.href}
		target="_blank"
		rel="noopener noreferrer"
		title={run.hyperlink.tooltip}
		style={styleToString(run.style)}
		onclick={onHyperlinkClick}><TextRunContent {run} /></a
	>{:else if run.ruby}<ruby style={styleToString(run.style)}
		><TextRunContent {run} /><rp>(</rp><rt style={styleToString(run.ruby.style)}>{run.ruby.text}</rt
		><rp>)</rp></ruby
	>{:else}<span style={styleToString(run.style)}><TextRunContent {run} /></span>{/if}

<style>
	.pptx-svelte-equation {
		display: inline-block;
		vertical-align: middle;
		font-family: 'Cambria Math', 'STIX Two Math', serif;
	}

	.pptx-svelte-equation-number {
		margin-inline-start: 0.5em;
		white-space: nowrap;
		font-family: 'Cambria Math', 'STIX Two Math', serif;
	}

	.pptx-svelte-equation-fallback {
		opacity: 0.5;
		font-style: italic;
	}

	.pptx-svelte-link {
		color: inherit;
	}
</style>
