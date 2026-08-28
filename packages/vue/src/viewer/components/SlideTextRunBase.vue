<script setup lang="ts">
/**
 * SlideTextRunBase - one rendered run of a paragraph, WITHOUT its optional
 * `a:reflection` mirrored sibling (see `SlideTextRun.vue`, which wraps this).
 *
 * A run is normally a `<span>`, but the shared model marks three kinds that need
 * a different element around them: a HYPERLINK run (an `<a href>`), an inline
 * EQUATION run (MathML, whose text is empty), and a RUBY run (a phonetic guide
 * over the base text). All three used to be dropped here - `buildParagraphs`
 * returned `{ text, style }` only, so a linked run rendered as ordinary text, an
 * inline `m:oMath` rendered as nothing at all, and a furigana reading vanished.
 */
import type { ParagraphRun } from 'pptx-viewer-shared';
import {
	DEFAULT_VIEWER_OPTIONS,
	runEquationMathMl,
	shouldConfirmExternalHyperlink,
} from 'pptx-viewer-shared';
import { computed, inject } from 'vue';
import { useI18n } from 'vue-i18n';

import { ViewerOptionsKey } from '../composables/useViewerOptionsStore';
import SlideTextRunContent from './SlideTextRunContent.vue';

const props = defineProps<{ run: ParagraphRun }>();

const { t } = useI18n();
// Absent when this run renders outside a `PowerPointViewer` (an isolated test
// fixture, a thumbnail-only mount): the Trust Center default then applies.
const viewerOptions = inject(ViewerOptionsKey, undefined);

/** Sanitised MathML for an equation run, or `''` when the OMML yields nothing. */
const mathml = computed(() => (props.run.equation ? runEquationMathMl(props.run.equation) : ''));

/**
 * Trust Center gate on the run's own `<a href>`: `run.hyperlink.href` is
 * already filtered to a safe external URL at build time (an internal
 * `ppaction://` jump resolves to no href), so this only has to decide whether
 * to ask before letting the browser follow it, in both editing/view mode and
 * inside a running slide show (this renderer is shared by both).
 */
function onLinkClick(event: MouseEvent): void {
	const href = props.run.hyperlink?.href;
	if (!href) {
		return;
	}
	const options = viewerOptions?.value ?? DEFAULT_VIEWER_OPTIONS;
	if (
		shouldConfirmExternalHyperlink(options, href) &&
		!window.confirm(`${t('pptx.options.trust.confirmHyperlinks')}\n\n${href}`)
	) {
		event.preventDefault();
	}
}
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
		@click="onLinkClick"
		><SlideTextRunContent :run="run"
	/></a>
	<!-- `a:ruby`: the phonetic guide sits above its base text. The `<rp>`
		     parentheses are what a browser without ruby support falls back to. -->
	<ruby v-else-if="run.ruby" :style="run.style"
		><SlideTextRunContent :run="run" /><rp>(</rp><rt :style="run.ruby.style">{{ run.ruby.text }}</rt
		><rp>)</rp></ruby
	>
	<span v-else :style="run.style"><SlideTextRunContent :run="run" /></span>
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
