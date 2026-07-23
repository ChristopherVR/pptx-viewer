<script lang="ts">
	/**
	 * TextBlock: renders an element's rich text as paragraphs of styled runs
	 * with bullet markers + hanging indents. The paragraph model is built by
	 * the shared, framework-agnostic `buildParagraphs`; this component is pure
	 * presentation (the Svelte port of Vue's `SlideTextBlock`).
	 */
	import { styleToString } from '../style';
	import type { TextBlockProps } from './props';
	import type { RenderParagraph } from 'pptx-viewer-shared';

	const { paragraphs, textStyle }: TextBlockProps = $props();

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
				>{/if}{#each para.runs as run, ri (ri)}{#if run.text === '\n'}<br />{:else}<span
						style={styleToString(run.style)}>{run.text}</span
					>{/if}{/each}
		</p>
	{/each}
</div>
