<script lang="ts">
	/**
	 * ReflectionMirrorContent: the mirrored CONTENT painted inside a
	 * `pptx-svelte-reflection` wrapper (see `ShapeEffectOverlay.svelte`),
	 * rendering the element's own fill, outline, text body and - for a group -
	 * its children, not just its resolved fill the way `-webkit-box-reflect`
	 * and this app's earlier reflection wrapper both only ever managed.
	 *
	 * Reuses the SAME pure style builders and presentational components the
	 * element's real render uses (`getShapeFillStrokeStyle`, `getTextBlockStyle`,
	 * `buildParagraphs`, `TextBlock`), so the mirror never drifts from what is
	 * actually on screen. Everything here is `aria-hidden`/inert: no
	 * `data-element-id`, no interactive handlers, no `elementId` passed to
	 * `TextBlock` (what a live text-build animation keys off), so a mirror
	 * never doubles up in accessibility, hit-testing, collaboration or
	 * selection code that counts or targets elements by id.
	 *
	 * `ShapeEffectOverlay` is re-mounted for each mirrored node too (with
	 * `suppressReflection` set from {@link topLevel}) so the mirror also
	 * carries the fill-overlay tint, gradient/pattern SVG outline and soft-edge
	 * feather the real element paints - and, for a descendant, its OWN
	 * reflection too.
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

	import { getShapeFillStrokeStyle, getTextBlockStyle, styleToString } from '../style';
	import ShapeEffectOverlay from './ShapeEffectOverlay.svelte';
	import TextBlock from './TextBlock.svelte';
	// Self-import: a mirrored group recurses into this same component (Svelte 5
	// pattern, same as `ElementRenderer.svelte`'s group branch).
	// eslint-disable-next-line import/no-self-import
	import ReflectionMirrorContent from './ReflectionMirrorContent.svelte';

	const {
		element,
		mediaDataUrls,
		parentGroupFill,
		topLevel = true,
	}: {
		element: PptxElement;
		mediaDataUrls: Map<string, string>;
		/** The enclosing (mirrored) group's fill, for an `a:grpFill` child. */
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
	} = $props();

	const isGroup = $derived(element.type === 'group');
	const isImage = $derived(isImageLikeElement(element));
	const children = $derived<PptxElement[]>(
		isGroup ? ((element as GroupPptxElement).children ?? []) : [],
	);
	/** Chained `a:grpFill` resolution for this (mirrored) group's own children. */
	const childParentGroupFill = $derived(getGroupChildParentFill(element, parentGroupFill));

	// `getShapeFillStrokeStyle` branches on `el.type === 'group'` itself (shadow /
	// glow / soft-edge filter for the group's own composite raster; no fill /
	// border, since a group paints neither), so this needs no group ternary here.
	const boxStyle = $derived(styleToString(getShapeFillStrokeStyle(element, parentGroupFill)));

	const paragraphs = $derived(buildParagraphs(element));
	const hasText = $derived(paragraphs.some((p) => p.runs.length > 0));
	const textStyle = $derived(styleToString(getTextBlockStyle(element)));

	const imageSrc = $derived(isImage ? sharedGetImageSrc(element, mediaDataUrls) : undefined);
	const imageFitStyle = $derived(styleToString(getImageFitStyle(element)));
</script>

{#if isGroup}
	<div style="position:relative;width:100%;height:100%;{boxStyle}">
		<ShapeEffectOverlay {element} {mediaDataUrls} zIndex={0} suppressReflection={topLevel} />
		{#each children as child, i (child.id)}
			<div style={styleToString(getContainerStyle(child, i))}>
				<ReflectionMirrorContent
					element={child}
					{mediaDataUrls}
					parentGroupFill={childParentGroupFill}
					topLevel={false}
				/>
			</div>
		{/each}
	</div>
{:else}
	<div style="width:100%;height:100%;{boxStyle}">
		<ShapeEffectOverlay {element} {mediaDataUrls} zIndex={0} suppressReflection={topLevel} />
		{#if imageSrc}
			<img src={imageSrc} alt="" draggable="false" style="width:100%;height:100%;{imageFitStyle}" />
		{:else if hasText}
			<TextBlock {paragraphs} {textStyle} />
		{/if}
	</div>
{/if}
