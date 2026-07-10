<script lang="ts">
	/**
	 * TextBlock: renders an element's rich text as paragraphs of styled runs
	 * with bullet markers + hanging indents. The paragraph model is built by
	 * the shared, framework-agnostic `buildParagraphs`; this component is pure
	 * presentation (the Svelte port of Vue's `SlideTextBlock`).
	 */
	import { styleToString } from '../style';
	import type { TextBlockProps } from './props';

	const { paragraphs, textStyle }: TextBlockProps = $props();
</script>

<div class="pptx-svelte-text" style={textStyle}>
	{#each paragraphs as para, pi (pi)}
		<p
			class="pptx-svelte-para"
			style="margin: 0 0 0 {para.marginLeftPx ?? 0}px;{para.textIndentPx !== undefined
				? ` text-indent: ${para.textIndentPx}px;`
				: ''}"
		>
			{#if para.bulletMarker !== undefined}<span
					class="pptx-svelte-bullet"
					style={styleToString(para.bulletStyle)}>{para.bulletMarker}&nbsp;</span
				>{/if}{#each para.runs as run, ri (ri)}{#if run.text === '\n'}<br />{:else}<span
						style={styleToString(run.style)}>{run.text}</span
					>{/if}{/each}
		</p>
	{/each}
</div>
