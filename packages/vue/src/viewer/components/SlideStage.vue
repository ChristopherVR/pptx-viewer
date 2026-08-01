<script setup lang="ts">
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import {
	actionAffordanceLabels,
	applyElementActionAffordances,
	applyRenderedElementAccessibility,
	getSlideBackgroundStyle,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, ref, watchPostEffect } from 'vue';
import { useI18n } from 'vue-i18n';

import { provideSlideFieldContext } from '../composables/field-context';
import { provideSlideElements } from '../composables/slide-elements';
import { stripElementIdMarkers } from '../composables/stage-element-markers';
import type { CanvasSize } from '../types';
import ElementRenderer from './ElementRenderer.vue';

/**
 * SlideStage - the fixed-size slide surface (background + absolutely-positioned
 * elements) rendered at a given `scale`.
 *
 * Extracted so it can be reused at full size by `SlideCanvas` and at tiny scale
 * by the thumbnail rail. It owns no chrome (no centering, margins, or shadow);
 * the host decides layout.
 *
 * Template (master/layout) elements are rendered in a DEDICATED layer behind the
 * slide content (lower z), supplied separately via `templateElements`. They are
 * interactive (and gain the editable affordance) only while `editTemplateMode`
 * is on; otherwise they render but are locked.
 *
 * Accessibility contract: exactly ONE `aria-roledescription="slide"` region
 * exists per surface. On the editable canvas that region is the `SlideCanvas`
 * wrapper (which also paints the resolved background), mirroring React's
 * `SlideCanvas.tsx`, so the interactive stage itself stays unlabelled. Only the
 * standalone live presentation stage (`presenting`, no wrapper) self-labels.
 * Static stages (thumbnails, sorter, previews, export) are `aria-hidden` and
 * additionally have their `data-element-id` markers stripped post-render (see
 * `stripElementIdMarkers`) so element queries always hit the real canvas copy.
 */
const props = withDefaults(
	defineProps<{
		slide: PptxSlide | undefined;
		canvasSize: CanvasSize;
		mediaDataUrls: Map<string, string>;
		scale?: number;
		/** Mark elements with the `data-pptx-element` interaction hook (main canvas only). */
		interactive?: boolean;
		/**
		 * Master/layout elements pulled out of the slide at load time, rendered in a
		 * dedicated layer behind the slide content.
		 */
		templateElements?: PptxElement[];
		/**
		 * When on, the template-layer elements become interactive and gain a visual
		 * affordance; when off they render but are locked. Only the main editable
		 * canvas threads this through.
		 */
		editTemplateMode?: boolean;
		/**
		 * True only for the live presentation stage: slide-content media autoplays
		 * (as in a real slideshow). Left false for thumbnails, the sorter, presenter
		 * previews and transition snapshots so their media stays quiet.
		 */
		presenting?: boolean;
		/**
		 * Keep the `data-element-id` markers on an otherwise-static stage.
		 *
		 * Only the Morph transition layers set this: their per-element CSS is
		 * keyed on those markers. It does not create a duplicate marked copy,
		 * because the host hides its own stage while the overlay is mounted.
		 */
		preserveElementIds?: boolean;
		/**
		 * Render the elements with NO slide background at all.
		 *
		 * `getSlideBackgroundStyle` always resolves to an opaque paint (it falls
		 * back to `DEFAULT_SLIDE_BACKGROUND` when the slide declares none), which is
		 * right for a real surface and fatal for a stage stacked over another one.
		 * The morph transition's departing-shape layer is exactly that: it sits on
		 * top of the incoming slide, so its background would hide the whole morph
		 * behind a flat slab for the entire transition.
		 */
		transparentBackground?: boolean;
	}>(),
	{ scale: 1 },
);
const { t } = useI18n();
const stageRef = ref<HTMLElement | null>(null);

// Re-point the deck-wide field context at THIS stage's slide before the element
// renderers read it: date / header / footer / document-property fields are
// presentation-wide, but the slide number and title are not, so a thumbnail,
// presenter preview or export stage must resolve them from the slide it paints
// rather than from the active one.
provideSlideFieldContext(() => props.slide);

// Publish THIS stage's sibling list so a text box in an `a:linkedTxbx` chain can
// find the rest of its chain and render only its own slice of the overflow.
// Template elements are included because a chain may be authored on a layout.
provideSlideElements(() => [...(props.templateElements ?? []), ...(props.slide?.elements ?? [])]);

/** Template elements render behind the slide content; default to none. */
const templateElements = computed<PptxElement[]>(() => props.templateElements ?? []);

/** Number of template elements, used to offset the main layer's z-index above them. */
const templateCount = computed(() => templateElements.value.length);
const accessibleElements = computed(() => [
	...templateElements.value,
	...(props.slide?.elements ?? []),
]);

/**
 * The template layer is interactive only when the canvas as a whole is
 * interactive AND edit-template mode is on. Computed here (not inline in the
 * template) so the SFC stays presentational. Declared above the post-render
 * effect below, which reads it.
 */
const templateLayerInteractive = computed(
	() => (props.interactive ?? false) && (props.editTemplateMode ?? false),
);

watchPostEffect(() => {
	const stage = stageRef.value;
	// Read the element list in both branches so structural changes re-trigger
	// this effect for static stages too (the strip must re-run after them).
	const elements = accessibleElements.value;
	if (!stage) {
		return;
	}
	if (props.interactive || props.presenting) {
		applyRenderedElementAccessibility(stage, elements, { presenting: props.presenting === true });
		// The on-canvas action affordances (amber badge + hover link tooltip) are
		// painted at the stage boundary rather than inside `ElementRenderer`,
		// because that component dispatches straight to a per-type view whose root
		// IS the element node, leaving no wrapper to hang the chrome off. A
		// template-layer element is only decorated while it is actually editable,
		// mirroring React's `canInteract` gate.
		applyElementActionAffordances(
			stage,
			[
				...(templateLayerInteractive.value ? templateElements.value : []),
				...(props.slide?.elements ?? []),
			],
			{
				canInteract: props.interactive === true,
				presenting: props.presenting === true,
				labels: actionAffordanceLabels((key) => t(key)),
			},
		);
	} else if (props.preserveElementIds) {
		// Morph drives per-element CSS keyed on `data-element-id`, so the two
		// transition layers must keep their markers. Safe because the host hides
		// its own stage while the overlay is mounted, so there is still exactly
		// one marked copy of each element on the page.
	} else {
		// Static surface (thumbnail, sorter, preview, export stage): remove the
		// `data-element-id` markers so only the real canvas / presentation stage
		// exposes them, matching React's marker-free static renderer.
		stripElementIdMarkers(stage);
	}
});

const stageStyle = computed<CSSProperties>(() => ({
	width: `${props.canvasSize.width}px`,
	height: `${props.canvasSize.height}px`,
	transform: `scale(${props.scale})`,
	transformOrigin: 'top left',
	position: 'relative',
	overflow: 'hidden',
	// Motion-path keyframes translate by a fraction of the SLIDE, so the stage
	// publishes its own size for those calc() offsets. Set on every stage (edit,
	// presentation, thumbnails) because the path fractions are slide-relative
	// regardless of the scale the stage happens to be drawn at.
	'--pptx-slide-w': `${props.canvasSize.width}px`,
	'--pptx-slide-h': `${props.canvasSize.height}px`,
	// Resolved slide background: image -> gradient -> pattern -> solid colour.
	// A stacked overlay layer opts out entirely and stays see-through.
	...(props.transparentBackground
		? { background: 'none', backgroundColor: 'transparent' }
		: (getSlideBackgroundStyle(props.slide) as CSSProperties)),
}));
</script>

<template>
	<div
		ref="stageRef"
		class="pptx-vue-stage"
		:style="stageStyle"
		:role="presenting ? 'region' : undefined"
		:aria-roledescription="presenting ? 'slide' : undefined"
		:aria-label="presenting ? t('pptx.canvas.slide') : undefined"
		:aria-hidden="!interactive && !presenting ? 'true' : undefined"
	>
		<!-- Template (master/layout) layer: behind the slide content (lower z). -->
		<ElementRenderer
			v-for="(element, index) in templateElements"
			:key="element.id"
			:element="element"
			:media-data-urls="mediaDataUrls"
			:z-index="index"
			:interactive="templateLayerInteractive"
			:template-editing="editTemplateMode ?? false"
		/>
		<!-- Slide content (template-free after the load-time partition). -->
		<ElementRenderer
			v-for="(element, index) in slide?.elements ?? []"
			:key="element.id"
			:element="element"
			:media-data-urls="mediaDataUrls"
			:z-index="index + templateCount"
			:interactive="interactive ?? false"
			:presenting="presenting ?? false"
		/>
		<!-- Optional editing overlay (selection handles, etc.) shares this scaled space -->
		<slot />
	</div>
</template>
