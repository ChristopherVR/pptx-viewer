<script lang="ts">
	/**
	 * TextBlock: renders an element's rich text as paragraphs of styled runs
	 * with bullet markers + hanging indents. The paragraph model is built by
	 * the shared, framework-agnostic `buildParagraphs`; this component is pure
	 * presentation (the Svelte port of Vue's `SlideTextBlock`).
	 */
	import { styleToString } from '../style';
	import type { TextBlockProps } from './props';
	import { buildTextBuildSpec, textBuildSpanStyle } from 'pptx-viewer-shared';
	import type { CssStyleMap, RenderParagraph } from 'pptx-viewer-shared';
	import TextRun from './TextRun.svelte';

	const { paragraphs, textStyle, elementId, subElementAnimStates }: TextBlockProps = $props();

	/** A run whose text is exactly a newline is a hard line break, not content. */
	const NEWLINE_RUN = '\n';

	/**
	 * The split for each paragraph whose text is being revealed piece by piece,
	 * or `undefined` to render its runs normally. PowerPoint's "Animate text: By
	 * letter" needs the rendered text split to match the per-character
	 * sub-animations, otherwise the whole box just fades as one.
	 */
	const specs = $derived(
		paragraphs.map((para, paraIndex) =>
			elementId
				? buildTextBuildSpec(
						elementId,
						paraIndex,
						para.runs.filter((run) => run.text !== NEWLINE_RUN),
						subElementAnimStates,
					)
				: undefined,
		),
	);

	/**
	 * Per-paragraph inline style: hanging-indent margin-left + first-line
	 * text-indent, plus this paragraph's own line-height (`a:lnSpc`) and
	 * space-before/after (`a:spcBef` / `a:spcAft`) carried by the shared model.
	 * Only keys the paragraph overrides are emitted, so paragraphs without their
	 * own spacing inherit the body-level `textStyle`.
	 */
	function paraStyle(para: RenderParagraph): string {
		// Built as a MAP and serialised once, exactly as the other four bindings
		// assemble theirs. Hand-concatenating declaration strings fused shared's
		// `paragraphStyle` (which `styleToString` leaves unterminated) onto the
		// margin that followed it, and the browser dropped the whole invalid
		// declaration: the paragraph lost its hanging-indent `margin-left`, so
		// every bulleted run painted a full `marL` left of the other bindings and
		// the too-wide content box wrapped a word late.
		const style: CssStyleMap = {
			// This paragraph's own `text-align` / BiDi `direction` / kinsoku rules,
			// when it overrides the body's. Spread first so the explicit geometry
			// below always wins.
			...para.paragraphStyle,
			// `<p>` has a UA margin; zero it. Longhands rather than the `margin`
			// shorthand, because a shorthand serialised AFTER `margin-left` would
			// reset the indent again whatever order the keys land in.
			marginTop: `${para.spaceBeforePx ?? 0}px`,
			marginRight: '0px',
			marginBottom: `${para.spaceAfterPx ?? 0}px`,
			marginLeft: `${para.marginLeftPx ?? 0}px`,
		};
		if (para.lineHeight !== undefined) {
			style.lineHeight = para.lineHeight;
		}
		if (para.textIndentPx !== undefined) {
			style.textIndent = `${para.textIndentPx}px`;
		}
		if (para.strutFontSizePx !== undefined) {
			// Re-base the line box on this paragraph's own runs; every run span
			// carries an explicit font-size, so this only moves the CSS strut.
			style.fontSize = `${para.strutFontSizePx}px`;
		}
		return styleToString(style);
	}
</script>

<div class="pptx-svelte-text" style={textStyle}>
	{#each paragraphs as para, pi (pi)}
		<p class="pptx-svelte-para" style={paraStyle(para)}>
			{#if para.bulletPicture?.src}<img
					class="pptx-svelte-bullet-image"
					src={para.bulletPicture.src}
					alt={para.bulletPicture.accessibleLabel}
					style="width: {para.bulletPicture.sizePx}px; height: {para.bulletPicture
						.sizePx}px; display: inline-block; vertical-align: middle; margin-inline-end: 4px; object-fit: contain;"
				/>{:else if para.bulletMarker !== undefined}<span
					class="pptx-svelte-bullet"
					style={styleToString(para.bulletStyle)}
					aria-label={para.bulletPicture?.accessibleLabel}>{para.bulletMarker}</span
				>{/if}{#if specs[pi]}{#if specs[pi]!.granularity === 'paragraph'}<span
						data-anim-id={specs[pi]!.animId}
						style={styleToString(textBuildSpanStyle(specs[pi]!))}
					>{#each para.runs as run, ri (ri)}{#if run.text === '\n'}<br />{:else}<TextRun
								{run}
							/>{/if}{/each}</span
					>{:else}{#each specs[pi]!.spans ?? [] as span, si (si)}<span
							data-anim-id={span.animId}
							style={styleToString({ ...(span.style ?? {}), ...textBuildSpanStyle(span) })}
						>{span.text}</span
					>{/each}{/if}{:else}{#each para.runs as run, ri (ri)}{#if run.text === '\n'}<br
					/>{:else}<TextRun {run} />{/if}{/each}{/if}{#if para.isEmpty}<!-- An authored blank line has no runs, so
			     without this the <p> collapses to zero height and the gap a deck puts
			     between a heading and its bullet list disappears (issue #131). --><br
				/>{/if}
		</p>
	{/each}
</div>
