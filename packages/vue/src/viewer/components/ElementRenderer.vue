<script setup lang="ts">
import type { PptxElement, TextSegment } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';
import { getComputedImageStyle, hasTextWarp } from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed } from 'vue';

import { resolveParagraphBullet, resolveParagraphIndent } from '../composables/bullet-list';
import {
	getContainerStyle,
	getImageSrc,
	getShapeFillStrokeStyle,
	getTextBlockStyle,
} from '../composables/element-style';
import ChartRenderer from './ChartRenderer.vue';
import ConnectorRenderer from './ConnectorRenderer.vue';
import EquationRenderer from './EquationRenderer.vue';
import InkRenderer from './InkRenderer.vue';
import Model3DRenderer from './Model3DRenderer.vue';
import OleRenderer from './OleRenderer.vue';
import SmartArtRenderer from './SmartArtRenderer.vue';
import TableRenderer from './TableRenderer.vue';
import WordArtText from './WordArtText.vue';
import ZoomRenderer from './ZoomRenderer.vue';

/**
 * ElementRenderer — Vue port of the React `ElementRenderer.tsx`.
 *
 * Renders a single slide element by its `type` discriminant. Each non-trivial
 * type delegates to a dedicated renderer component:
 *  - `text` / `shape`        → positioned box with fill/stroke/effects + rich text
 *  - `picture` / `image`     → `<img>`
 *  - `media`                 → poster frame (`<img>`) — playback TODO
 *  - `group`                 → recursive children
 *  - `connector`             → `ConnectorRenderer` (SVG)
 *  - `table` / `chart`       → `TableRenderer` / `ChartRenderer`
 *  - `smartArt`              → `SmartArtRenderer`
 *  - `ink` / `ole` / `model3d` / `zoom` → dedicated renderers
 *  - anything else           → labelled placeholder (TODO, see PORTING.md)
 *
 * Interaction (selection, resize handles, inline editing) is not yet ported.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls: Map<string, string>;
	zIndex: number;
	/**
	 * When true, emit the `data-pptx-element` test/interaction hook. Only the
	 * primary editable canvas sets this — thumbnails, the sorter, the export
	 * stage and presentation mode render the same elements without it, so the
	 * e2e selectors resolve to exactly the on-canvas elements.
	 */
	interactive?: boolean;
}>();

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);
const shapeStyle = computed<CSSProperties>(() => getShapeFillStrokeStyle(props.element));
/**
 * Merge container + shape styles for the shape box. The shape style may carry a
 * 3D `transform` (from `visual-3d`); compose it with the container's
 * rotation/flip transform instead of letting the spread clobber it.
 */
const shapeDivStyle = computed<CSSProperties>(() => {
	const c = containerStyle.value;
	const s = shapeStyle.value;
	const merged: CSSProperties = { ...c, ...s };
	if (c.transform && s.transform) {
		merged.transform = `${c.transform} ${s.transform}`;
	}
	return merged;
});
const textStyle = computed<CSSProperties>(() => getTextBlockStyle(props.element));
const imageSrc = computed(() => getImageSrc(props.element, props.mediaDataUrls));
/** Playable source (mediaData URL or resolved mediaPath) for a media element. */
const mediaSrc = computed(() => {
	const el = props.element;
	if (el.type !== 'media') {
		return undefined;
	}
	return el.mediaData ?? (el.mediaPath ? props.mediaDataUrls.get(el.mediaPath) : undefined);
});
/** Media kind (`video`/`audio`) for picking the playback element. */
const mediaKind = computed(() =>
	props.element.type === 'media' ? props.element.mediaType : undefined,
);
/** Computed CSS filter + SVG `<filter>` defs for picture/image effects. */
const imageFx = computed(() => getComputedImageStyle(props.element));

const isShapeLike = computed(() => props.element.type === 'text' || props.element.type === 'shape');
const isImageLike = computed(
	() => props.element.type === 'picture' || props.element.type === 'image',
);

/**
 * Whether this element carries math equation segments (OMML). Equation text
 * boxes are typically equation-only, so they delegate wholesale to
 * `EquationRenderer` (which self-positions). Mirrors the React equation path.
 */
const hasEquation = computed(
	() =>
		hasTextProperties(props.element) &&
		(props.element.textSegments ?? []).some((s) => s.equationXml),
);

/** Whether this element's text is warped (WordArt / `prstTxWarp`). */
const isWarpedText = computed(() => hasTextWarp(props.element));

/** Per-run inline style derived from a TextSegment's style. */
function segmentStyle(seg: TextSegment): CSSProperties {
	const s = seg.style ?? {};
	const style: CSSProperties = {};
	if (s.fontFamily) {
		style.fontFamily = s.fontFamily;
	}
	// px, not pt — the parsed value is the CSS px size (matches React + the
	// inline text editor). Appending `pt` inflates every run by ~1.33×.
	if (typeof s.fontSize === 'number') {
		style.fontSize = `${s.fontSize}px`;
	}
	if (s.color) {
		style.color = s.color;
	}
	if (s.bold) {
		style.fontWeight = 'bold';
	}
	if (s.italic) {
		style.fontStyle = 'italic';
	}
	const deco: string[] = [];
	if (s.underline) {
		deco.push('underline');
	}
	if (s.strikethrough) {
		deco.push('line-through');
	}
	if (deco.length > 0) {
		style.textDecoration = deco.join(' ');
	}
	return style;
}

/** A single rendered run within a paragraph. */
interface ParagraphRun {
	text: string;
	style: CSSProperties;
}

/**
 * A rendered paragraph: its runs plus resolved bullet + hanging-indent
 * metadata. Mirrors React's `text-paragraph-render.tsx` paragraph model.
 */
interface Paragraph {
	runs: ParagraphRun[];
	/** Bullet glyph / number to render before the runs (or `undefined`). */
	bulletMarker?: string;
	/** Inline style for the bullet marker span (font / size / colour). */
	bulletStyle: CSSProperties;
	/** `margin-left` in px for the whole paragraph (hanging-indent layout). */
	marginLeftPx?: number;
	/** `text-indent` in px (first-line / hanging indent). */
	textIndentPx?: number;
}

/**
 * Group text segments into paragraphs of runs, enriching each paragraph with
 * its leading segment's bullet glyph (or auto-number), bullet font/size/colour,
 * and marginLeft/text-indent (hanging-indent) layout — mirroring React's
 * `renderTextSegments` in `text-paragraph-render.tsx`.
 *
 * Paragraph separators are either `isParagraphBreak` segments (post-edit remap)
 * or bare `"\n"` text segments (the slide-load path). Soft line breaks insert a
 * newline within a paragraph. The core-inserted bullet segment (the first
 * segment carrying `bulletInfo`, whose text is the precomputed marker) is
 * skipped from the runs because the marker is rendered separately so it can pick
 * up the bullet font/size/colour. Bullets are suppressed for paragraphs with no
 * visible text content (matching PowerPoint / React).
 */
const paragraphs = computed<Paragraph[]>(() => {
	const el = props.element;
	if (!hasTextProperties(el)) {
		return [];
	}
	const segments = el.textSegments;
	if (!segments || segments.length === 0) {
		return el.text ? [{ runs: [{ text: el.text, style: {} }], bulletStyle: {} }] : [];
	}

	const paragraphIndents = el.paragraphIndents;
	const out: Array<{ paraSegments: TextSegment[] }> = [{ paraSegments: [] }];
	for (const seg of segments) {
		// Both the load path (`"\n"` text segments) and the edit-remap path
		// (`isParagraphBreak`) terminate a paragraph.
		if (seg.isParagraphBreak || (seg.text === '\n' && !seg.isLineBreak)) {
			out.push({ paraSegments: [] });
			continue;
		}
		out[out.length - 1].paraSegments.push(seg);
	}

	const result: Paragraph[] = out.map(({ paraSegments }, paraIndex) => {
		const firstSeg = paraSegments[0];
		const bulletResult = resolveParagraphBullet(firstSeg);

		// The core slide-load path inserts a *dedicated* marker segment whose
		// text is the precomputed glyph/number (e.g. "• " / "1."). We render the
		// marker ourselves (so it can pick up bullet font/size/colour), so that
		// dedicated segment must be dropped from the runs to avoid a doubled
		// marker. A run that merely *carries* `bulletInfo` but holds real content
		// text (the edit-remap path) is kept.
		const markerSegment =
			bulletResult && firstSeg?.bulletInfo && firstSeg.text.trim() === bulletResult.marker.trim()
				? firstSeg
				: undefined;

		// Build runs, skipping the dedicated bullet-marker segment.
		const runs: ParagraphRun[] = [];
		for (const seg of paraSegments) {
			if (seg === markerSegment) {
				continue;
			}
			const text = seg.isLineBreak ? '\n' : seg.text;
			if (text) {
				runs.push({ text, style: segmentStyle(seg) });
			}
		}

		// Suppress bullets for paragraphs with no visible text content (matches
		// PowerPoint / React: empty bullet paragraphs render no glyph).
		const hasVisibleTextContent = paraSegments.some(
			(seg) => seg !== markerSegment && Boolean(seg.text) && seg.text.trim().length > 0,
		);
		const bullet = hasVisibleTextContent ? bulletResult : undefined;

		const bulletStyle: CSSProperties = {};
		if (bullet) {
			if (bullet.color) {
				bulletStyle.color = bullet.color;
			}
			if (bullet.fontFamily) {
				bulletStyle.fontFamily = bullet.fontFamily;
			}
			// Bullet size: explicit points, else a percentage of the run font size.
			const runFontSize = firstSeg?.style?.fontSize;
			if (typeof bullet.sizePts === 'number') {
				bulletStyle.fontSize = `${bullet.sizePts}px`;
			} else if (typeof bullet.sizePercent === 'number' && typeof runFontSize === 'number') {
				bulletStyle.fontSize = `${runFontSize * (bullet.sizePercent / 100)}px`;
			}
		}

		const indent = resolveParagraphIndent(paragraphIndents?.[paraIndex], firstSeg?.paragraphLevel);

		return {
			runs,
			bulletMarker: bullet?.marker,
			bulletStyle,
			marginLeftPx: indent.marginLeftPx,
			textIndentPx: indent.textIndentPx,
		};
	});

	return result.filter(
		(p) => p.runs.length > 0 || p.bulletMarker !== undefined || result.length === 1,
	);
});

const hasText = computed(() =>
	paragraphs.value.some((p) => p.runs.length > 0 || p.bulletMarker !== undefined),
);

/** Friendly label for the placeholder rendered for not-yet-ported types. */
const placeholderLabel = computed(() => {
	const map: Record<string, string> = {
		media: 'Media',
	};
	return map[props.element.type] ?? props.element.type;
});
</script>

<template>
	<!-- Group: recurse into children -->
	<div
		v-if="element.type === 'group'"
		class="pptx-vue-element pptx-vue-group"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<ElementRenderer
			v-for="(child, i) in element.children ?? []"
			:key="child.id"
			:element="child"
			:media-data-urls="mediaDataUrls"
			:z-index="i"
			:interactive="interactive"
		/>
	</div>

	<!-- Image / picture -->
	<div
		v-else-if="isImageLike"
		class="pptx-vue-element pptx-vue-image"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<!-- SVG <filter> defs for duotone / advanced-alpha / artistic image effects. -->
		<svg
			v-for="f in imageFx.svgFilters"
			:key="f.id"
			width="0"
			height="0"
			aria-hidden="true"
			style="position: absolute; width: 0; height: 0; overflow: hidden"
		>
			<defs>
				<filter :id="f.id" color-interpolation-filters="sRGB" v-html="f.markup" />
			</defs>
		</svg>
		<img
			v-if="imageSrc"
			:src="imageSrc"
			alt=""
			:style="{
				width: '100%',
				height: '100%',
				objectFit: 'contain',
				display: 'block',
				filter: imageFx.filter,
				opacity: imageFx.opacity,
			}"
		/>
	</div>

	<!-- Media: play video/audio when a source is available, else poster, else placeholder.
	     In the interactive (edit) canvas, controls are suppressed + pointer-events off so
	     clicks select/move the element instead of scrubbing; preview/present play normally. -->
	<div
		v-else-if="element.type === 'media'"
		class="pptx-vue-element pptx-vue-media"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<video
			v-if="mediaSrc && mediaKind === 'video'"
			:src="mediaSrc"
			:controls="!interactive"
			preload="metadata"
			:style="{
				width: '100%',
				height: '100%',
				objectFit: 'contain',
				display: 'block',
				pointerEvents: interactive ? 'none' : 'auto',
			}"
		/>
		<audio
			v-else-if="mediaSrc && mediaKind === 'audio'"
			:src="mediaSrc"
			controls
			:style="{ width: '100%', pointerEvents: interactive ? 'none' : 'auto' }"
		/>
		<img
			v-else-if="imageSrc"
			:src="imageSrc"
			alt=""
			style="width: 100%; height: 100%; object-fit: contain; display: block"
		/>
		<div v-else class="pptx-vue-placeholder">{{ placeholderLabel }}</div>
	</div>

	<!-- Connector / line -->
	<ConnectorRenderer
		v-else-if="element.type === 'connector'"
		:element="element"
		:z-index="zIndex"
	/>

	<!-- Table -->
	<TableRenderer
		v-else-if="element.type === 'table'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Chart -->
	<ChartRenderer
		v-else-if="element.type === 'chart'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- SmartArt -->
	<SmartArtRenderer
		v-else-if="element.type === 'smartArt'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Ink -->
	<InkRenderer
		v-else-if="element.type === 'ink'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Embedded OLE object -->
	<OleRenderer
		v-else-if="element.type === 'ole'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- 3D model -->
	<Model3DRenderer
		v-else-if="element.type === 'model3d'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Zoom -->
	<ZoomRenderer
		v-else-if="element.type === 'zoom'"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Equation (OMML → MathML) — equation text boxes delegate wholesale -->
	<EquationRenderer
		v-else-if="hasEquation"
		:element="element"
		:media-data-urls="mediaDataUrls"
		:z-index="zIndex"
	/>

	<!-- Text / shape -->
	<div
		v-else-if="isShapeLike"
		class="pptx-vue-element pptx-vue-shape"
		:style="shapeDivStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<!-- Warped text (WordArt) renders as SVG textPath in place of plain runs -->
		<WordArtText v-if="isWarpedText" :element="element" :z-index="0" />
		<div v-else-if="hasText" class="pptx-vue-text" :style="textStyle">
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
				<span
					v-if="para.bulletMarker !== undefined"
					class="pptx-vue-bullet"
					:style="para.bulletStyle"
					>{{ para.bulletMarker }}&nbsp;</span
				>
				<template v-for="(run, ri) in para.runs" :key="ri">
					<br v-if="run.text === '\n'" />
					<span v-else :style="run.style">{{ run.text }}</span>
				</template>
			</p>
		</div>
	</div>

	<!-- Fallback placeholder for not-yet-ported element types -->
	<div
		v-else
		class="pptx-vue-element pptx-vue-unsupported"
		:style="containerStyle"
		:data-element-id="element.id"
		:data-pptx-element="interactive ? 'true' : undefined"
	>
		<div class="pptx-vue-placeholder">{{ placeholderLabel }}</div>
	</div>
</template>
