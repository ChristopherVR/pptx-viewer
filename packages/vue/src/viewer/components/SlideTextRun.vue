<script setup lang="ts">
/**
 * SlideTextRun - one rendered run of a paragraph.
 *
 * A run is normally a `<span>`, but the shared model marks two kinds that need
 * a different element around them: a HYPERLINK run (an `<a href>`) and an
 * inline EQUATION run (MathML, whose text is empty). Both used to be dropped
 * here - `buildParagraphs` returned `{ text, style }` only, so a linked run
 * rendered as ordinary text and an inline `m:oMath` rendered as nothing at all.
 */
import type { ParagraphRun } from 'pptx-viewer-shared';
import { runEquationMathMl } from 'pptx-viewer-shared';
import { computed } from 'vue';

const props = defineProps<{ run: ParagraphRun }>();

/** Sanitised MathML for an equation run, or `''` when the OMML yields nothing. */
const mathml = computed(() => (props.run.equation ? runEquationMathMl(props.run.equation) : ''));
</script>

<template>
	<!-- Inline equation (`m:oMath`): rendered as browser-native MathML. -->
	<span v-if="run.equation" class="pptx-vue-inline-equation" :style="run.style">
		<span v-if="mathml" class="pptx-vue-equation" v-html="mathml" />
		<span v-else class="pptx-vue-equation-fallback">&#8230;</span>
		<span v-if="run.equation.number" class="pptx-vue-equation-number"
			>({{ run.equation.number }})</span
		>
	</span>
	<!-- A safe external target renders as a real link; an internal `ppaction://`
	     jump resolves to no href and falls through to the plain span. -->
	<a
		v-else-if="run.hyperlink?.href"
		class="pptx-vue-link"
		:href="run.hyperlink.href"
		target="_blank"
		rel="noopener noreferrer"
		:title="run.hyperlink.tooltip"
		:style="run.style"
		>{{ run.text }}</a
	>
	<span v-else :style="run.style">{{ run.text }}</span>
</template>

<style scoped>
.pptx-vue-equation {
	display: inline-block;
	vertical-align: middle;
	font-family: 'Cambria Math', 'STIX Two Math', serif;
}

.pptx-vue-equation-number {
	margin-inline-start: 0.5em;
	white-space: nowrap;
	font-family: 'Cambria Math', 'STIX Two Math', serif;
}

.pptx-vue-equation-fallback {
	opacity: 0.5;
	font-style: italic;
}

.pptx-vue-link {
	color: inherit;
}
</style>
