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
	import type { RenderParagraph } from 'pptx-viewer-shared';

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
		let css = `margin: 0 0 0 ${para.marginLeftPx ?? 0}px;`;
		if (para.spaceBeforePx !== undefined) {
			css += `margin-top: ${para.spaceBeforePx}px;`;
		}
		if (para.spaceAfterPx !== undefined) {
			css += `margin-bottom: ${para.spaceAfterPx}px;`;
		}
		if (para.lineHeight !== undefined) {
			css += `line-height: ${para.lineHeight};`;
		}
		if (para.textIndentPx !== undefined) {
			css += `text-indent: ${para.textIndentPx}px;`;
		}
		if (para.strutFontSizePx !== undefined) {
			// Re-base the line box on this paragraph's own runs; every run span
			// carries an explicit font-size, so this only moves the CSS strut.
			css += `font-size: ${para.strutFontSizePx}px;`;
		}
		return css;
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
					aria-label={para.bulletPicture?.accessibleLabel}>{para.bulletMarker}&nbsp;</span
				>{/if}{#if specs[pi]}{#if specs[pi]!.granularity === 'paragraph'}<span
						data-anim-id={specs[pi]!.animId}
						style={styleToString(textBuildSpanStyle(specs[pi]!))}
					>{#each para.runs as run, ri (ri)}{#if run.text === '\n'}<br />{:else}<span
								style={styleToString(run.style)}>{run.text}</span
							>{/if}{/each}</span
					>{:else}{#each specs[pi]!.spans ?? [] as span, si (si)}<span
							data-anim-id={span.animId}
							style={styleToString({ ...(span.style ?? {}), ...textBuildSpanStyle(span) })}
						>{span.text}</span
					>{/each}{/if}{:else}{#each para.runs as run, ri (ri)}{#if run.text === '\n'}<br />{:else}<span
						style={styleToString(run.style)}>{run.text}</span
					>{/if}{/each}{/if}
		</p>
	{/each}
</div>
