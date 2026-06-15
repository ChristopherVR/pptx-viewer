<script setup lang="ts">
import DOMPurify from 'dompurify';
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getContainerStyle } from '../composables/element-style';
import type { OmmlNode } from '../composables/omml-to-mathml';
import { convertOmmlToMathMl } from '../composables/omml-to-mathml';

/**
 * EquationRenderer — renders an element's math equation(s) as inline MathML.
 *
 * Vue port of the React equation rendering path
 * (`text-segment-helpers.tsx#renderEquationSegment`). Equations live on text
 * elements as {@link TextSegment} entries whose `equationXml` field holds the
 * parsed OMML (`m:oMathPara` / `m:oMath`) tree. Each such segment is converted
 * to MathML via {@link convertOmmlToMathMl}, sanitised, and injected with
 * `v-html` — MathML is namespaced HTML, so browsers render `<math>` natively.
 *
 * The wrapper uses {@link getContainerStyle} for absolute positioning, matching
 * every other element renderer.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

/** One rendered equation: sanitised MathML markup + optional equation number. */
interface RenderedEquation {
	key: string;
	mathml: string;
	number?: string;
}

/**
 * Sanitise a MathML markup string. Falls back to the raw input when
 * `DOMPurify.sanitize` is unavailable (e.g. non-DOM test environments); the
 * XSS surface only matters in real browsers. MathML + SVG profiles are enabled
 * so `<math>` / `<mfrac>` / `<msqrt>` … survive sanitisation.
 */
function sanitizeMathMl(markup: string): string {
	const purify = DOMPurify as unknown as {
		sanitize?: (dirty: string, cfg?: Record<string, unknown>) => string;
	};
	if (typeof purify.sanitize !== 'function') {
		return markup;
	}
	return purify.sanitize(markup, { USE_PROFILES: { mathMl: true, svg: true } });
}

/** Extract + convert every equation segment on the element. */
const equations = computed<RenderedEquation[]>(() => {
	const el = props.element;
	if (!hasTextProperties(el)) {
		return [];
	}
	const segments: TextSegment[] = el.textSegments ?? [];
	const out: RenderedEquation[] = [];
	segments.forEach((seg, i) => {
		if (!seg.equationXml) {
			return;
		}
		const mathml = convertOmmlToMathMl(seg.equationXml as OmmlNode);
		if (!mathml) {
			return;
		}
		out.push({
			key: `${el.id}-eq-${i}`,
			mathml: sanitizeMathMl(mathml),
			number: seg.equationNumber,
		});
	});
	return out;
});

/** True when the element carries at least one renderable equation. */
const hasEquationContent = computed(() => equations.value.length > 0);
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-equation-wrapper"
		:style="containerStyle"
		:data-element-id="element.id"
	>
		<template v-if="hasEquationContent">
			<template v-for="eq in equations" :key="eq.key">
				<!-- Numbered equation: centered with the number right-aligned. -->
				<span v-if="eq.number" class="pptx-vue-equation-numbered">
					<span class="pptx-vue-equation-number-spacer" aria-hidden="true">({{ eq.number }})</span>
					<span class="pptx-vue-equation pptx-vue-equation-centered" v-html="eq.mathml" />
					<span class="pptx-vue-equation-number">({{ eq.number }})</span>
				</span>

				<!-- Plain inline equation. -->
				<span v-else class="pptx-vue-equation" v-html="eq.mathml" />
			</template>
		</template>
	</div>
</template>

<style scoped>
.pptx-vue-equation-wrapper {
	display: flex;
	flex-wrap: wrap;
	align-items: center;
	gap: 0.25em;
}

.pptx-vue-equation {
	display: inline-block;
	vertical-align: middle;
	font-family: 'Cambria Math', 'STIX Two Math', serif;
}

.pptx-vue-equation-numbered {
	display: flex;
	justify-content: space-between;
	align-items: center;
	width: 100%;
}

.pptx-vue-equation-centered {
	flex: 1;
	text-align: center;
}

.pptx-vue-equation-number-spacer {
	visibility: hidden;
	white-space: nowrap;
}

.pptx-vue-equation-number {
	white-space: nowrap;
	font-family: 'Cambria Math', 'STIX Two Math', serif;
}
</style>
