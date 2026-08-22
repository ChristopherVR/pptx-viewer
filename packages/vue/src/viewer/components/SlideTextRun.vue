<script setup lang="ts">
/**
 * SlideTextRun - one rendered run of a paragraph, plus its optional
 * `a:reflection` mirrored-sibling wrapper.
 *
 * The run itself (equation / hyperlink / ruby / plain span) is
 * `SlideTextRunBase`. Reflection is wrapped HERE, around the whole base run,
 * rather than inside each of `SlideTextRunBase`'s branches: a `<ruby>` run's
 * own `display: ruby` (which positions the annotation above its base text)
 * would break if forced to `display: inline-block` to host an absolutely
 * positioned mirror, so the positioning box has to be an outer element that
 * leaves the base run's own tag untouched.
 *
 * Cross-browser (unlike the `-webkit-box-reflect` this replaced, which
 * Firefox never implemented): the wrapper style comes from shared's
 * `getTextReflectionWrapperStyle`, the text-run counterpart of a
 * shape/picture's `ShapeEffectOverlay` reflection - reused, not forked.
 */
import type { ParagraphRun } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';

import SlideTextRunBase from './SlideTextRunBase.vue';
import SlideTextRunContent from './SlideTextRunContent.vue';

const props = defineProps<{ run: ParagraphRun }>();
</script>

<template>
	<span v-if="run.reflection" style="position: relative; display: inline-block">
		<SlideTextRunBase :run="run" />
		<span
			class="pptx-vue-text-reflection"
			aria-hidden="true"
			:style="run.reflection as CSSProperties"
			><span :style="run.style"><SlideTextRunContent :run="run" /></span
		></span>
	</span>
	<SlideTextRunBase v-else :run="run" />
</template>
