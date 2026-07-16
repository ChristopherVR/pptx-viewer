<script setup lang="ts">
/**
 * SlideTextBlock - renders an element's rich text as paragraphs of styled runs
 * with bullet markers + hanging indents. The paragraph model is built by the
 * shared, framework-agnostic `buildParagraphs`; this component is pure
 * presentation. Extracted from `ElementRenderer` to keep it thin.
 */
import type { RenderParagraph } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';

defineProps<{ paragraphs: RenderParagraph[]; textStyle: CSSProperties }>();
</script>

<template>
	<div class="pptx-vue-text" :style="textStyle">
		<p
			v-for="(para, pi) in paragraphs"
			:key="pi"
			class="pptx-vue-para"
			:style="{
				marginTop: 0,
				marginRight: 0,
				marginBottom: 0,
				marginLeft: para.marginLeftPx !== undefined ? `${para.marginLeftPx}px` : 0,
				textIndent: para.textIndentPx !== undefined ? `${para.textIndentPx}px` : undefined,
			}"
		>
			<img
				v-if="para.bulletPicture?.src"
				class="pptx-vue-bullet-image"
				:src="para.bulletPicture.src"
				:alt="para.bulletPicture.accessibleLabel"
				:style="{
					width: `${para.bulletPicture.sizePx}px`,
					height: `${para.bulletPicture.sizePx}px`,
					display: 'inline-block',
					verticalAlign: 'middle',
					marginInlineEnd: '4px',
					objectFit: 'contain',
				}"
			/>
			<span
				v-else-if="para.bulletMarker !== undefined"
				class="pptx-vue-bullet"
				:style="para.bulletStyle"
				:aria-label="para.bulletPicture?.accessibleLabel"
				>{{ para.bulletMarker }}&nbsp;</span
			>
			<template v-for="(run, ri) in para.runs" :key="ri">
				<br v-if="run.text === '\n'" />
				<span v-else :style="run.style">{{ run.text }}</span>
			</template>
		</p>
	</div>
</template>
