<script setup lang="ts">
import type {
	PptxElement,
	PptxSmartArtChrome,
	PptxSmartArtDrawingShape,
	PptxSmartArtNode,
	SmartArtStyle,
} from 'pptx-viewer-core';
import { setSmartArtNodeStyle } from 'pptx-viewer-core';
import {
	buildSmartArtA11y,
	computeDrawingViewBox,
	projectDrawingShapes,
	resolvePalette,
	revealedSmartArtNodeCount,
	shouldCommitSmartArtNodeText,
	smartArtConnectorPaint,
	smartArtNodeLabel,
	styleShadowFilter,
} from 'pptx-viewer-shared';
import type {
	ElementAnimationState,
	RenderedShape,
	SmartArtConnectorPaint,
	SmartArtNodeLabel,
} from 'pptx-viewer-shared';
import type { CSSProperties } from 'vue';
import { computed, nextTick, ref } from 'vue';
import { useI18n } from 'vue-i18n';

import { getContainerStyle } from '../composables/element-style';
import {
	inlineEditorRect,
	nodeIdsInRenderOrder,
	textNodeIdsInRenderOrder,
	useSmartArtInlineEditState,
} from '../composables/smartart-inline-edit';
import type {
	RenderedCircleNode,
	RenderedPolygonNode,
	RenderedRectNode,
	SmartArtLayoutResult as ComputedLayout,
} from '../composables/smartart-layout';
import { computeSmartArtLayout } from '../composables/smartart-layout';
import { injectSmartArtNodeEdit } from '../composables/smartart-node-edit';
import { useSmartArtHoverRect } from '../composables/useSmartArtHoverRect';
import SmartArtNodeStyleBar from './SmartArtNodeStyleBar.vue';

/**
 * SmartArtRenderer - Vue port of the React SmartArt renderer
 * (`viewer/utils/smartart*.tsx`).
 *
 * Data path: this component renders from the **pre-computed drawing shapes**
 * (`smartArtData.drawingShapes`) extracted by the core engine from
 * `ppt/diagrams/drawing*.xml`, mirroring React's `smartart-drawing.tsx`.
 * That is the path React prefers when drawing shapes are present, and it
 * avoids reimplementing the ~2800 LOC of layout math in the
 * `smartart-cycle/process/hierarchy/...` family.
 *
 * Fallbacks (mirroring `renderSmartArtElement`'s early returns):
 *  - No `smartArtData` or zero nodes → a small "SmartArt" placeholder.
 *  - Nodes present but no drawing shapes → a simple stacked block list of the
 *    node text (the common-case fallback; the full per-family layout renderers
 *    are out of scope per the porting brief).
 *
 * The whole graphic is wrapped in chrome (background / outline) when present.
 */
const props = defineProps<{
	element: PptxElement;
	mediaDataUrls?: Map<string, string>;
	zIndex: number;
	/**
	 * True only for the main editable canvas instance. The `data-testid` layout
	 * hooks are emitted solely when interactive so the identical mini-renders in
	 * the thumbnail rail / slide sorter / presenter don't duplicate the id and
	 * break single-element test locators.
	 */
	interactive?: boolean;
	/** Emit the data-pptx-element marker even when not interactive (template layer). */
	marked?: boolean;
	/**
	 * Native-animation playback state. A staged diagram build
	 * (`build.kind === 'diagram'`) reveals the leading nodes / drawing shapes for
	 * the current progress; absent or non-diagram state renders every node.
	 */
	animationState?: ElementAnimationState;
}>();

const { t } = useI18n();

// ── Resolved SmartArt data ───────────────────────────────────────────────────

const smartArtData = computed(() =>
	props.element.type === 'smartArt' ? props.element.smartArtData : undefined,
);

const nodes = computed<PptxSmartArtNode[]>(() => smartArtData.value?.nodes ?? []);

// ── Accessibility (shared view-model) ────────────────────────────────────────
//
// The generated SVG is opaque to assistive technology, so we derive a
// screen-reader description for the whole diagram (`role="img"` + aria-label on
// the chrome container) and a per-node label looked up by node id, via the
// framework-agnostic `buildSmartArtA11y` from pptx-viewer-shared.

const a11y = computed(() =>
	smartArtData.value ? buildSmartArtA11y(smartArtData.value) : undefined,
);

const nodeLabels = computed<Map<string, string>>(() => {
	const map = new Map<string, string>();
	for (const n of a11y.value?.nodes ?? []) {
		map.set(n.id, n.label);
	}
	return map;
});

/** Per-node ARIA label / SVG <title> text, by node id (empty when unknown). */
function nodeLabel(nodeId: string | undefined): string | undefined {
	return nodeId ? nodeLabels.value.get(nodeId) : undefined;
}

const palette = computed<string[]>(() => resolvePalette(smartArtData.value));

const style = computed<SmartArtStyle>(() => smartArtData.value?.style ?? 'flat');

const chrome = computed<PptxSmartArtChrome | undefined>(() => smartArtData.value?.chrome);

const containerStyle = computed<CSSProperties>(() =>
	getContainerStyle(props.element, props.zIndex),
);

/**
 * `pointer-events: none` on the root while not interactive, mirroring
 * React's `pointer-events-none` class / Angular's `rootPointerEvents`. The
 * inner `.pptx-vue-smartart-svg` is already `pointer-events: none` by default
 * CSS (with editable node groups opting back in via
 * `.pptx-vue-smartart-editable`), but nothing previously gated the OUTER
 * `pptx-vue-smartart` box itself, so its background/chrome area stayed
 * clickable even while `marked` locked the element (e.g. a template/master
 * diagram with `editTemplateMode` off). `null` while interactive so the
 * style-array merge leaves any pre-existing `pointerEvents` untouched.
 */
const rootPointerEvents = computed<CSSProperties | null>(() =>
	props.interactive ? null : { pointerEvents: 'none' },
);

const chromeStyle = computed<CSSProperties>(() => {
	const c = chrome.value;
	const s: CSSProperties = { width: '100%', height: '100%' };
	if (!c) {
		return s;
	}
	if (c.backgroundColor) {
		s.backgroundColor = c.backgroundColor;
	}
	if (c.outlineColor) {
		s.border = `${c.outlineWidth ?? 1}px solid ${c.outlineColor}`;
	}
	return s;
});

// ── Drawing-shape path (mirrors smartart-drawing.tsx) ────────────────────────

const drawingShapes = computed<PptxSmartArtDrawingShape[]>(
	() => smartArtData.value?.drawingShapes ?? [],
);

const hasDrawingShapes = computed(() => drawingShapes.value.length > 0);

// ── Staged diagram build (p:bldDgm) reveal ──────────────────────────────────
//
// When an active native animation carries a staged diagram build, reveal only
// the leading nodes / drawing shapes for the current progress; the view box is
// still computed from the FULL shape set so the diagram does not rescale as it
// builds. Mirrors React's `SmartArtRenderer` reveal slice.

const diagramBuild = computed(() => {
	const build = props.animationState?.build;
	return build?.kind === 'diagram' ? build : undefined;
});

const shownNodeCount = computed(() =>
	diagramBuild.value
		? revealedSmartArtNodeCount(nodes.value, diagramBuild.value)
		: nodes.value.length,
);

const isPartialBuild = computed(
	() => diagramBuild.value !== undefined && shownNodeCount.value < nodes.value.length,
);

/** Leading node prefix revealed so far (full list when no partial build). */
const revealedNodes = computed<PptxSmartArtNode[]>(() =>
	isPartialBuild.value ? nodes.value.slice(0, shownNodeCount.value) : nodes.value,
);

/** Leading drawing-shape prefix revealed so far (proportional to nodes). */
const revealedShapeList = computed<PptxSmartArtDrawingShape[]>(() => {
	if (!isPartialBuild.value || drawingShapes.value.length === 0) {
		return drawingShapes.value;
	}
	const count = Math.ceil(
		(shownNodeCount.value / Math.max(nodes.value.length, 1)) * drawingShapes.value.length,
	);
	return drawingShapes.value.slice(0, count);
});

/** Shape descriptor plus the source node id used for inline editing. */
type EditableShape = RenderedShape & { nodeId?: string };

const drawingViewBox = computed(() => computeDrawingViewBox(drawingShapes.value));

const renderedShapes = computed<EditableShape[]>(() => {
	// Text-bearing shapes map positionally to text-bearing source nodes so a
	// double-click on a labelled shape targets the right node id.
	const textIds = textNodeIdsInRenderOrder(nodes.value);
	let textShapeIndex = 0;

	return projectDrawingShapes(
		props.element.id,
		revealedShapeList.value,
		drawingViewBox.value,
		palette.value,
		style.value,
	).map((shape, i) => ({
		...shape,
		nodeId: revealedShapeList.value[i]?.text ? textIds[textShapeIndex++] : undefined,
	}));
});

/**
 * Seed text for an inline edit. The rendered lines are a wrapped view of the
 * authored string, so they are joined back with spaces rather than newlines to
 * avoid writing the wrap points into the node.
 */
function shapeEditText(shape: EditableShape): string {
	return shape.textLines.map((line) => line.text).join(' ');
}

const shadowFilter = computed(() => styleShadowFilter(style.value));

// ── SVG layout fallback (no drawing shapes) ──────────────────────────────────
//
// When drawing shapes are absent the component runs the pure-geometry layout
// engine from `smartart-layout.ts` to produce an SVG approximation.

const fallbackLayout = computed<ComputedLayout | undefined>(() => {
	if (hasDrawingShapes.value || nodes.value.length === 0) {
		return undefined;
	}
	const data = smartArtData.value;
	return computeSmartArtLayout(
		revealedNodes.value,
		{ width: props.element.width, height: props.element.height },
		palette.value,
		style.value,
		props.element.id,
		data?.resolvedLayoutType,
		data?.layout,
		undefined,
		data?.layoutDefinition,
		data?.presLayoutVars,
	);
});

// ── Fallback-layout label / connector paint ──────────────────────────────────
//
// The layout descriptor's optional fields (per-node font colour / weight /
// style, off-centre label anchors for target leaders, gear legend rows and
// timeline captions, and per-connector stroke) are resolved by the shared
// decision functions below. The template binds the result and computes nothing.

/** Resolved connector paint, index-aligned with `fallbackLayout.connectors`. */
const fallbackConnectors = computed<SmartArtConnectorPaint[]>(() =>
	(fallbackLayout.value?.connectors ?? []).map((conn) => smartArtConnectorPaint(conn)),
);

/** Resolved label descriptors, index-aligned with `fallbackLayout.nodes`. */
const fallbackLabels = computed<SmartArtNodeLabel[]>(() =>
	(fallbackLayout.value?.nodes ?? []).map((node) => smartArtNodeLabel(node)),
);

const isEmpty = computed(() => nodes.value.length === 0 && !hasDrawingShapes.value);

// ── Inline on-canvas node text editing ───────────────────────────────────────
//
// A node-edit context, when provided by the host (edit mode, not presenting),
// lets a double-click on a node open an inline <textarea> over it. Commit flows
// through the SAME core op the inspector uses (`updateSmartArtNodeText` via
// `updateElement`), so undo/redo and save round-trip are identical.

const nodeEdit = injectSmartArtNodeEdit();
const editable = computed(() => Boolean(nodeEdit?.canEdit()));

/**
 * Source node ids in fallback render order (index-aligned with layout nodes).
 * Flattened over the REVEALED prefix, since that is what the layout engine was
 * handed: a staged diagram build otherwise mapped ids past the reveal point.
 */
const fallbackNodeIds = computed<string[]>(() =>
	fallbackLayout.value ? nodeIdsInRenderOrder(revealedNodes.value) : [],
);

const edit = useSmartArtInlineEditState();
const rootEl = ref<HTMLElement | null>(null);
const editorEl = ref<HTMLTextAreaElement | null>(null);
// Anchors the style-bar popover; mousemove events landing inside it must not
// clear the hover state, or the popover would unmount as soon as the pointer
// reaches the swatches it needs to be clicked.
const styleBarEl = ref<HTMLElement | null>(null);
const {
	hoveredNodeId,
	hoveredNodeRect,
	onMouseMove: onHoverMouseMove,
	onMouseLeave,
} = useSmartArtHoverRect(rootEl);

function onMouseMove(event: MouseEvent): void {
	onHoverMouseMove(event, styleBarEl.value);
}

/** Approximate rendered size of the style bar (6 swatches + padding/border). */
const STYLE_BAR_WIDTH = 168;
const STYLE_BAR_HEIGHT = 40;

/** Style-bar position, clamped so it stays within the chrome's clipped bounds. */
const styleBarStyle = computed<CSSProperties | undefined>(() => {
	const rect = hoveredNodeRect.value;
	const container = rootEl.value;
	if (!rect || !container) {
		return undefined;
	}
	const maxLeft = Math.max(0, container.clientWidth - STYLE_BAR_WIDTH);
	const maxTop = Math.max(0, container.clientHeight - STYLE_BAR_HEIGHT);
	return {
		position: 'absolute',
		left: `${Math.min(maxLeft, Math.max(0, rect.left + rect.width - STYLE_BAR_WIDTH))}px`,
		top: `${Math.min(maxTop, Math.max(0, rect.top - 22))}px`,
		zIndex: 25,
	};
});

/**
 * Enter edit mode for a node. Projects the double-clicked SVG node's on-screen
 * rect into container-relative pixels (shared `computeInlineEditorRect`) so the
 * overlay textarea sits exactly over the node, independent of canvas zoom.
 */
function beginEdit(nodeId: string | undefined, text: string, event: Event): void {
	if (!editable.value || !nodeId) {
		return;
	}
	const target = event.currentTarget as Element | null;
	const host = rootEl.value;
	if (!target || !host) {
		return;
	}
	const rect = inlineEditorRect(target.getBoundingClientRect(), host.getBoundingClientRect());
	edit.begin(nodeId, text, rect);
	void nextTick(() => {
		editorEl.value?.focus();
		editorEl.value?.select();
	});
}

/** Commit the draft text through the host op, skipping no-op edits. */
function commitEdit(): void {
	const nodeId = edit.editingNodeId.value;
	const data = smartArtData.value;
	if (nodeId && data && nodeEdit && shouldCommitSmartArtNodeText(data, nodeId, edit.draft.value)) {
		nodeEdit.commit(props.element.id, nodeId, edit.draft.value);
	}
	edit.cancel();
}

function cancelEdit(): void {
	edit.cancel();
}

/** Apply a fill colour to a node by id, routing through the host commitStyle op. */
function handleChangeNodeStyle(nodeId: string, fill: string): void {
	const data = smartArtData.value;
	if (!data || !nodeEdit) {
		return;
	}
	const next = setSmartArtNodeStyle(data, nodeId, { fillColor: fill });
	if (next !== data) {
		nodeEdit.commitStyle?.(props.element.id, { smartArtData: next } as Partial<PptxElement>);
	}
}

/**
 * Stop all keydown bubbling so parent shortcuts (Delete, arrow keys, etc.)
 * do not fire while typing in the editor. Enter commits; Shift+Enter inserts
 * a newline; Escape cancels.
 */
function onEditorKeydown(event: KeyboardEvent): void {
	event.stopPropagation();
	if (event.key === 'Enter' && !event.shiftKey) {
		event.preventDefault();
		commitEdit();
	} else if (event.key === 'Escape') {
		event.preventDefault();
		cancelEdit();
	}
}
</script>

<template>
	<div
		class="pptx-vue-element pptx-vue-smartart"
		:style="[containerStyle, rootPointerEvents]"
		:data-element-id="element.id"
		:data-pptx-element="props.interactive || props.marked ? 'true' : undefined"
		aria-roledescription="diagram"
	>
		<div
			ref="rootEl"
			class="pptx-vue-smartart-chrome"
			:style="chromeStyle"
			:role="a11y ? 'img' : undefined"
			:aria-label="a11y?.label"
			@mousemove="onMouseMove"
			@mouseleave="onMouseLeave"
		>
			<!-- Empty / no-data placeholder -->
			<div v-if="isEmpty" class="pptx-vue-smartart-placeholder">
				{{ t('pptx.smartArt.placeholder') }}
			</div>

			<!-- Pre-computed drawing shapes (preferred path) -->
			<svg
				v-else-if="hasDrawingShapes"
				class="pptx-vue-smartart-svg"
				:data-testid="props.interactive ? 'smartart-drawing-shapes' : undefined"
				:viewBox="`0 0 ${drawingViewBox.width} ${drawingViewBox.height}`"
				preserveAspectRatio="xMidYMid meet"
			>
				<g
					v-for="shape in renderedShapes"
					:key="shape.key"
					:class="{ 'pptx-vue-smartart-editable': editable && shape.nodeId }"
					:data-node-id="shape.nodeId"
					:data-smartart-node-id="shape.nodeId || undefined"
					:tabindex="editable && shape.nodeId ? 0 : undefined"
					:role="nodeLabel(shape.nodeId) ? 'img' : undefined"
					:aria-label="nodeLabel(shape.nodeId)"
					:style="shadowFilter ? { filter: shadowFilter } : undefined"
					@dblclick="beginEdit(shape.nodeId, shapeEditText(shape), $event)"
					@keydown.enter.prevent="beginEdit(shape.nodeId, shapeEditText(shape), $event)"
				>
					<title v-if="nodeLabel(shape.nodeId)">{{ nodeLabel(shape.nodeId) }}</title>
					<defs v-if="shape.gradient">
						<radialGradient
							v-if="shape.gradient.kind === 'radial'"
							:id="shape.gradient.id"
							:cx="shape.gradient.cx"
							:cy="shape.gradient.cy"
							:r="shape.gradient.r"
						>
							<stop
								v-for="(stop, si) in shape.gradient.stops"
								:key="si"
								:offset="stop.offset"
								:stop-color="stop.color"
								:stop-opacity="stop.opacity"
							/>
						</radialGradient>
						<linearGradient
							v-else
							:id="shape.gradient.id"
							:x1="shape.gradient.x1"
							:y1="shape.gradient.y1"
							:x2="shape.gradient.x2"
							:y2="shape.gradient.y2"
						>
							<stop
								v-for="(stop, si) in shape.gradient.stops"
								:key="si"
								:offset="stop.offset"
								:stop-color="stop.color"
								:stop-opacity="stop.opacity"
							/>
						</linearGradient>
					</defs>
					<image
						v-if="shape.kind === 'image'"
						:x="shape.x"
						:y="shape.y"
						:width="shape.width"
						:height="shape.height"
						:href="shape.imageUrl"
						preserveAspectRatio="xMidYMid meet"
						:transform="shape.transform"
					/>
					<ellipse
						v-else-if="shape.kind === 'ellipse'"
						:cx="shape.cx"
						:cy="shape.cy"
						:rx="shape.width / 2"
						:ry="shape.height / 2"
						:fill="shape.fill"
						:stroke="shape.stroke"
						:stroke-width="shape.strokeWidth"
						:transform="shape.transform"
					/>
					<polygon
						v-else-if="shape.kind === 'polygon'"
						:points="shape.points"
						:fill="shape.fill"
						:stroke="shape.stroke"
						:stroke-width="shape.strokeWidth"
						:transform="shape.transform"
					/>
					<rect
						v-else
						:x="shape.x"
						:y="shape.y"
						:width="shape.width"
						:height="shape.height"
						:rx="shape.rx"
						:fill="shape.fill"
						:stroke="shape.stroke"
						:stroke-width="shape.strokeWidth"
						:transform="shape.transform"
					/>
					<text
						v-if="shape.textLines.length > 0"
						:x="shape.textX"
						text-anchor="middle"
						dominant-baseline="central"
						:fill="shape.fontColor"
						:font-size="shape.fontSize"
					>
						<tspan v-for="(line, li) in shape.textLines" :key="li" :x="shape.textX" :y="line.y">
							{{ line.text }}
						</tspan>
					</text>
				</g>
			</svg>

			<!-- Fallback: SVG layout computed from node tree -->
			<svg
				v-else-if="fallbackLayout"
				class="pptx-vue-smartart-svg"
				:viewBox="fallbackLayout.viewBox"
				preserveAspectRatio="xMidYMid meet"
				:data-testid="props.interactive ? `smartart-${fallbackLayout.family}` : undefined"
				:data-layout-family="fallbackLayout.family"
			>
				<!-- Connectors (render first so they appear behind nodes) -->
				<path
					v-for="(conn, ci) in fallbackLayout.connectors"
					:key="conn.key"
					:d="fallbackConnectors[ci]!.d"
					fill="none"
					:stroke="fallbackConnectors[ci]!.stroke"
					:stroke-width="fallbackConnectors[ci]!.strokeWidth"
					:opacity="fallbackConnectors[ci]!.opacity"
					:stroke-dasharray="fallbackConnectors[ci]!.dash"
				/>
				<!-- Rendered nodes -->
				<g
					v-for="(node, i) in fallbackLayout.nodes"
					:key="node.key"
					:class="{ 'pptx-vue-smartart-editable': editable && fallbackNodeIds[i] }"
					:data-node-id="fallbackNodeIds[i]"
					:data-smartart-node-id="fallbackNodeIds[i] || undefined"
					:tabindex="editable && fallbackNodeIds[i] ? 0 : undefined"
					:role="nodeLabel(fallbackNodeIds[i]) ? 'img' : undefined"
					:aria-label="nodeLabel(fallbackNodeIds[i])"
					:style="fallbackLayout.shadowFilter ? { filter: fallbackLayout.shadowFilter } : undefined"
					@dblclick="beginEdit(fallbackNodeIds[i], node.text, $event)"
					@keydown.enter.prevent="beginEdit(fallbackNodeIds[i], node.text, $event)"
				>
					<title v-if="nodeLabel(fallbackNodeIds[i])">{{ nodeLabel(fallbackNodeIds[i]) }}</title>
					<!-- Circle nodes (cycle, radial, venn, target, gear, timeline) -->
					<circle
						v-if="node.kind === 'circle'"
						:cx="(node as RenderedCircleNode).cx"
						:cy="(node as RenderedCircleNode).cy"
						:r="(node as RenderedCircleNode).r"
						:fill="node.fill"
						:stroke="node.stroke"
						:stroke-width="node.strokeWidth"
						:opacity="node.opacity"
					/>
					<!-- Polygon nodes (process, pyramid, funnel) -->
					<polygon
						v-else-if="node.kind === 'polygon'"
						:points="(node as RenderedPolygonNode).points"
						:fill="node.fill"
						:stroke="node.stroke"
						:stroke-width="node.strokeWidth"
						:opacity="node.opacity"
					/>
					<!-- Rect nodes (list, matrix, hierarchy) -->
					<rect
						v-else
						:x="(node as RenderedRectNode).x"
						:y="(node as RenderedRectNode).y"
						:width="(node as RenderedRectNode).width"
						:height="(node as RenderedRectNode).height"
						:rx="(node as RenderedRectNode).rx"
						:fill="node.fill"
						:stroke="node.stroke"
						:stroke-width="node.strokeWidth"
						:opacity="node.opacity"
					/>
					<!--
						Label: placement, colour, weight and baseline all arrive decided
						from shared, so an off-centre caption (target leader, gear legend
						row, timeline caption above / below the axis) lands beside its
						node rather than on top of it.
					-->
					<text
						v-if="fallbackLabels[i]!.visible"
						:x="fallbackLabels[i]!.x"
						:text-anchor="fallbackLabels[i]!.textAnchor"
						:dominant-baseline="fallbackLabels[i]!.dominantBaseline"
						:fill="fallbackLabels[i]!.fill"
						:font-size="fallbackLabels[i]!.fontSize"
						:font-weight="fallbackLabels[i]!.fontWeight"
						:font-style="fallbackLabels[i]!.fontStyle"
					>
						<tspan
							v-for="(line, li) in fallbackLabels[i]!.lines"
							:key="li"
							:x="fallbackLabels[i]!.x"
							:y="line.y"
						>
							{{ line.text }}
						</tspan>
					</text>
				</g>
			</svg>

			<!-- Per-node fill colour picker (hover swatch bar, edit mode only) -->
			<div
				v-if="editable && hoveredNodeId && !edit.isEditing.value && hoveredNodeRect"
				ref="styleBarEl"
				:style="styleBarStyle"
			>
				<SmartArtNodeStyleBar
					:palette="palette"
					@pick-fill="handleChangeNodeStyle(hoveredNodeId!, $event)"
				/>
			</div>

			<!-- Inline node text editor overlay (edit mode only) -->
			<textarea
				v-if="edit.isEditing.value && edit.rect.value"
				ref="editorEl"
				v-model="edit.draft.value"
				class="pptx-vue-smartart-node-editor"
				spellcheck="false"
				:aria-label="t('pptx.smartArt.editNodeText')"
				:style="{
					left: `${edit.rect.value.left}px`,
					top: `${edit.rect.value.top}px`,
					width: `${edit.rect.value.width}px`,
					height: `${edit.rect.value.height}px`,
				}"
				@keydown="onEditorKeydown"
				@mousedown.stop
				@click.stop
				@dblclick.stop
				@blur="commitEdit"
			/>
		</div>
	</div>
</template>

<style scoped>
.pptx-vue-smartart-chrome {
	position: relative;
	box-sizing: border-box;
	overflow: hidden;
}

.pptx-vue-smartart-svg {
	width: 100%;
	height: 100%;
	pointer-events: none;
}

/* Editable node groups opt back into pointer events so a double-click can
   enter inline edit mode without breaking element selection/drag elsewhere. */
.pptx-vue-smartart-editable {
	pointer-events: auto;
	cursor: text;
}

/* Hover ring: outline does not render on SVG <g> elements in all browsers,
   so drop-shadow is used as the visual confirmation that a node is editable. */
.pptx-vue-smartart-editable:hover {
	filter: drop-shadow(0 0 2px rgba(96, 165, 250, 0.8));
}

.pptx-vue-smartart-node-editor {
	position: absolute;
	z-index: 2;
	margin: 0;
	padding: 2px;
	border: 1px solid #2563eb;
	border-radius: 3px;
	box-sizing: border-box;
	resize: none;
	overflow: hidden;
	font: inherit;
	font-size: 12px;
	line-height: 1.2;
	text-align: center;
	color: #111;
	background: #fff;
}

.pptx-vue-smartart-placeholder {
	width: 100%;
	height: 100%;
	display: flex;
	align-items: center;
	justify-content: center;
	font-size: 11px;
	color: rgba(255, 255, 255, 0.8);
	pointer-events: none;
}

.pptx-vue-smartart-list {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 4px;
	box-sizing: border-box;
	overflow: hidden;
}

.pptx-vue-smartart-block {
	flex: 1 1 0;
	min-height: 0;
	display: flex;
	align-items: center;
	justify-content: center;
	padding: 2px 6px;
	border-radius: 4px;
	color: #fff;
	font-size: 12px;
	text-align: center;
	overflow: hidden;
}
</style>
