<script setup lang="ts">
/**
 * ReflectionMirrorContent: the mirrored CONTENT painted inside a
 * `pptx-vue-reflection` wrapper (see `ShapeEffectOverlay.vue`), rendering the
 * element's own fill, outline, text body and (for a group) its children -
 * not just its resolved fill the way `-webkit-box-reflect` and this app's
 * earlier reflection wrapper both only ever managed.
 *
 * Reuses the SAME pure style builders and presentational components the
 * element's real render uses (`getShapeFillStrokeStyle`, `getTextBlockStyle`,
 * `buildParagraphs`, `SlideTextBlock`), so the mirror never drifts from what
 * is actually on screen. Everything here is `aria-hidden`/inert: no
 * `data-element-id`, no interactive handlers, no `elementId` passed to
 * `SlideTextBlock` (which is what a live text-build animation keys off), so a
 * mirror never doubles up in accessibility, hit-testing, collaboration or
 * selection code that counts or targets elements by id.
 *
 * `ShapeEffectOverlay` is re-mounted for each mirrored node too (with
 * `suppressReflection` set from {@link topLevel}) so the mirror also carries
 * the fill-overlay tint, gradient/pattern SVG outline and soft-edge feather
 * the real element paints - and, for a descendant, its OWN reflection too.
 */
import type { GroupPptxElement, PptxElement, ShapeStyle } from 'pptx-viewer-core';
import { isImageLikeElement } from 'pptx-viewer-core';
import {
	buildParagraphs,
	getContainerStyle,
	getGroupChildParentFill,
	getImageFitStyle,
	getImageSrc as sharedGetImageSrc,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { getShapeFillStrokeStyle, getTextBlockStyle } from '../composables/element-style';
import ShapeEffectOverlay from './ShapeEffectOverlay.vue';
import SlideTextBlock from './SlideTextBlock.vue';

const props = withDefaults(
	defineProps<{
		element: PptxElement;
		mediaDataUrls?: Map<string, string>;
		/**
		 * The enclosing (mirrored) group's fill, for a child painted with
		 * `a:grpFill`. `a:grpFill` children reflect as transparent when the TOP
		 * reflected element is itself the plain shape (no enclosing group inside
		 * the mirror), matching the resolved-fill-only behaviour this replaces.
		 */
		parentGroupFill?: ShapeStyle;
		/**
		 * `true` only for the element `ShapeEffectOverlay` is building THIS
		 * mirror for; `false` for every recursive descendant rendered inside it.
		 * Controls `suppressReflection` on this node's own `ShapeEffectOverlay`:
		 * the top element must not grow a mirror of its own mirror, but a
		 * descendant is not the element being mirrored, so a child (or nested
		 * group) that carries its OWN `a:reflection` must still show it - see
		 * `reflection-content-parity.spec.ts`'s nested-reflection case.
		 */
		topLevel?: boolean;
	}>(),
	{ topLevel: true },
);

const isGroup = computed(() => props.element.type === 'group');
const isImage = computed(() => isImageLikeElement(props.element));
const mediaMap = computed(() => props.mediaDataUrls ?? new Map<string, string>());

// `getShapeFillStrokeStyle` branches on `el.type === 'group'` itself (shadow /
// glow / soft-edge filter for the group's own composite raster; no fill /
// border, since a group paints neither), so this needs no group ternary here.
const boxStyle = computed<CSSProperties>(
	() => getShapeFillStrokeStyle(props.element, props.parentGroupFill) as CSSProperties,
);

const paragraphs = computed(() => buildParagraphs(props.element));
const hasText = computed(() => paragraphs.value.some((p) => p.runs.length > 0));
const textStyle = computed<CSSProperties>(() => getTextBlockStyle(props.element) as CSSProperties);

const imageSrc = computed(() =>
	isImage.value ? sharedGetImageSrc(props.element, mediaMap.value) : undefined,
);
const imageFitStyle = computed<CSSProperties>(
	() => getImageFitStyle(props.element) as CSSProperties,
);

/** Chained `a:grpFill` resolution for this (mirrored) group's own children. */
const childParentGroupFill = computed<ShapeStyle | undefined>(() =>
	getGroupChildParentFill(props.element, props.parentGroupFill),
);
const children = computed<PptxElement[]>(() =>
	isGroup.value ? ((props.element as GroupPptxElement).children ?? []) : [],
);
</script>

<template>
	<div v-if="isGroup" style="position: relative; width: 100%; height: 100%" :style="boxStyle">
		<ShapeEffectOverlay
			:element="element"
			:media-data-urls="mediaDataUrls"
			:suppress-reflection="topLevel"
		/>
		<div v-for="(child, i) in children" :key="child.id" :style="getContainerStyle(child, i)">
			<ReflectionMirrorContent
				:element="child"
				:media-data-urls="mediaDataUrls"
				:parent-group-fill="childParentGroupFill"
				:top-level="false"
			/>
		</div>
	</div>
	<div v-else style="width: 100%; height: 100%" :style="boxStyle">
		<ShapeEffectOverlay
			:element="element"
			:media-data-urls="mediaDataUrls"
			:suppress-reflection="topLevel"
		/>
		<img
			v-if="imageSrc"
			:src="imageSrc"
			alt=""
			draggable="false"
			:style="{ width: '100%', height: '100%', ...imageFitStyle }"
		/>
		<SlideTextBlock v-else-if="hasText" :paragraphs="paragraphs" :text-style="textStyle" />
	</div>
</template>
