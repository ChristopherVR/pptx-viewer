import type {
	ContentPartPptxElement,
	InkPptxElement,
	PptxElement,
	ShapeStyle,
} from 'pptx-viewer-core';
import {
	filterRenderedElements,
	getGroupChildParentFill,
	getOleAriaLabel,
	getOleBadgeLabel,
	getOleDisplayName,
	getOleTypeColor,
	getOleTypeLabel,
	resolveGroupChildFill,
	resolveOleType,
} from 'pptx-viewer-shared';
import type { ResolvedOleType } from 'pptx-viewer-shared';
import { translationsEn } from 'pptx-viewer-shared/i18n';

import { DEFAULT_TEXT_COLOR, MIN_ELEMENT_SIZE } from '../../constants';
import {
	getElementTransform,
	getImageRenderStyle,
	getImageSurfaceStyle,
	getImageTilingStyle,
	getShapeVisualStyle,
	getTextStyleForElement,
	isEditableTextElement,
	isImageTiled,
	renderTextSegments,
	renderVectorShape,
} from '../../utils';
import {
	buildContentPartStrokes,
	buildInkGroupStrokes,
	getInkReplayStyles,
	getContentPartReplayStyles,
	INK_REPLAY_KEYFRAMES,
} from '../../utils/ink-rendering';
import type {
	InkReplayConfig,
	InkStrokeView,
	NibMark,
	PressureCircle,
} from '../../utils/ink-rendering';
import { shapeParams } from '../ElementRenderer';
import { ShapeEffectOverlay } from './ShapeEffectOverlay';

// Re-export the shared OLE type-resolution helpers so existing consumers (and
// the colocated tests) keep importing them from this module.
export { getOleAriaLabel, getOleDisplayName, getOleTypeColor, getOleTypeLabel, resolveOleType };
export type { ResolvedOleType };

/**
 * Options for ink rendering.
 */
export interface InkRenderOptions {
	/** When true, animate strokes sequentially (ink replay). */
	replay?: boolean;
	/** Configuration for replay animation timing. */
	replayConfig?: InkReplayConfig;
	/** When true, render pressure-sensitive variable-width strokes. */
	pressureSensitive?: boolean;
}

/**
 * Render pressure-sensitive circles for a single (already-decided) stroke.
 * This produces a series of SVG `<circle>` elements with varying radii
 * to simulate pressure variation along the stroke.
 */
function renderPressureStroke(
	circles: PressureCircle[],
	color: string,
	opacity: number,
	keyPrefix: string,
) {
	return (
		<g opacity={opacity}>
			{circles.map((c, j) => (
				<circle key={`${keyPrefix}-pc-${j}`} cx={c.cx} cy={c.cy} r={c.r} fill={color} />
			))}
		</g>
	);
}

/**
 * Render calligraphic nib marks for a single (already-decided) stroke: an
 * ellipse per point, widened perpendicular to the pen's tilt-lean direction
 * (a chisel-tip look). The tilt counterpart of {@link renderPressureStroke}.
 */
function renderNibMarkStroke(marks: NibMark[], color: string, opacity: number, keyPrefix: string) {
	return (
		<g opacity={opacity}>
			{marks.map((m, j) => (
				<ellipse
					key={`${keyPrefix}-nib-${j}`}
					cx={m.cx}
					cy={m.cy}
					rx={m.rPerp}
					ry={m.rTilt}
					transform={`rotate(${m.rotationDeg} ${m.cx} ${m.cy})`}
					fill={color}
				/>
			))}
		</g>
	);
}

/**
 * Render one already-decided stroke view (plain path, pressure circles, or
 * nib marks). Exported so the Draw tool's live in-progress preview
 * (`DrawingOverlaySvg`) can paint its own `InkStrokeView` (built by the shared
 * `buildLiveInkStrokeView`) with the exact same calligraphic-nib /
 * pressure-circle mapping a committed stroke gets, instead of a hand-rolled
 * plain `<path>`.
 */
export function renderStrokeView(
	view: InkStrokeView,
	pressureSensitive: boolean,
	replayStyle:
		| { strokeDasharray: string; strokeDashoffset: string; animation: string; pathLength: number }
		| undefined,
	key: string,
) {
	// Tilt-driven nib rendering is unconditional (matches this module's
	// original contentPart behaviour): it degrades to a plain circle wherever
	// tilt magnitude is 0, so it is safe even when `pressureSensitive` is
	// explicitly disabled. Only the pressure-circle branch is gated by it.
	if (view.nibMarks) {
		return <g key={key}>{renderNibMarkStroke(view.nibMarks, view.color, view.opacity, key)}</g>;
	}
	if (pressureSensitive && view.circles) {
		return <g key={key}>{renderPressureStroke(view.circles, view.color, view.opacity, key)}</g>;
	}
	return (
		<path
			key={key}
			d={view.d}
			fill='none'
			stroke={view.color}
			strokeWidth={view.width}
			strokeOpacity={view.opacity}
			strokeLinecap='round'
			strokeLinejoin='round'
			vectorEffect='non-scaling-stroke'
			{...(replayStyle
				? {
						strokeDasharray: replayStyle.strokeDasharray,
						strokeDashoffset: replayStyle.strokeDashoffset,
						style: {
							animation: replayStyle.animation,
							'--ink-path-length': replayStyle.pathLength,
						} as React.CSSProperties,
					}
				: {})}
		/>
	);
}

export function renderInk(el: InkPptxElement, options?: InkRenderOptions) {
	const replay = options?.replay ?? false;
	const strokes = buildInkGroupStrokes(el, { color: '#000', width: 3 });
	// Enable pressure/tilt-sensitive rendering by default when any stroke
	// actually decided to render as circles or nib marks (per-point pressure
	// or tilt data with real variation/lean; see `buildInkGroupStrokes`).
	const hasVariableStroke = strokes.some((s) => s.circles || s.nibMarks);
	const pressureSensitive = options?.pressureSensitive ?? hasVariableStroke;
	const replayStyles = replay ? getInkReplayStyles(el, options?.replayConfig) : null;

	return (
		<svg
			className='w-full h-full pointer-events-none'
			viewBox={`0 0 ${Math.max(el.width, 1)} ${Math.max(el.height, 1)}`}
			preserveAspectRatio='none'
		>
			{replay && <style>{INK_REPLAY_KEYFRAMES}</style>}
			{strokes.map((s, i) =>
				renderStrokeView(s, pressureSensitive, replayStyles?.[i], `${el.id}-ink-${i}`),
			)}
		</svg>
	);
}

/**
 * Fallback painter for a group's children, used when `renderBody` is called
 * without a `renderGroupChild` dispatcher (the prop is optional, so this is the
 * behaviour any such caller gets; both viewer renderers supply one).
 *
 * It builds its own boxes rather than delegating to `ElementRenderer`, so every
 * rule the main path gets for free has to be restated here: the Selection Pane
 * hide filter, document-order z-indexing, and `a:grpFill` inheritance. It also
 * has to recurse, because a `p:grpSp` inside a `p:grpSp` now loads as a nested
 * group rather than being flattened into the parent's child list; painting a
 * group child as a leaf drew an empty box where the whole sub-group belonged.
 */
export function renderGroup(children: PptxElement[], parentGroupFill?: ShapeStyle) {
	return (
		<div className='relative w-full h-full pointer-events-none'>
			{filterRenderedElements(children).map((c, childIndex) => {
				const { hf, fc, sw, sc } = shapeParams(c);
				const baseSs = getShapeVisualStyle(c, hf, fc, sw, sc);
				// `a:grpFill` child: inherit the enclosing group's resolved fill,
				// overriding the (group-mode, hence transparent) base fill.
				const inheritedFill = resolveGroupChildFill(c, parentGroupFill);
				const ss: React.CSSProperties = inheritedFill
					? {
							...baseSs,
							backgroundColor: inheritedFill.backgroundColor,
							backgroundImage: inheritedFill.backgroundImage,
							backgroundRepeat: inheritedFill.backgroundRepeat,
							backgroundSize: inheritedFill.backgroundSize,
							backgroundPosition: inheritedFill.backgroundPosition,
						}
					: baseSs;
				const isI = c.type === 'picture' || c.type === 'image';
				const vs = renderVectorShape(c, isI ? false : hf, fc, sw, sc);
				const ts = getTextStyleForElement(c, DEFAULT_TEXT_COLOR);
				const isTxt = isEditableTextElement(c);
				return (
					<div
						key={c.id}
						// A morph can pair a `!!`-named shape ACROSS a grouping boundary
						// (see shared `morph-flatten`), and its animation is keyed by
						// this child's own id, so the child has to be addressable in the
						// DOM rather than hidden inside the group's node.
						data-element-id={c.id}
						className='absolute'
						style={{
							left: c.x,
							top: c.y,
							width: Math.max(c.width, MIN_ELEMENT_SIZE),
							height: Math.max(c.height, MIN_ELEMENT_SIZE),
							transform: getElementTransform(c),
							transformOrigin: 'center',
							...ss,
							...(isI
								? {
										backgroundColor: 'transparent',
										backgroundImage: undefined,
										backgroundRepeat: undefined,
										backgroundSize: undefined,
										backgroundPosition: undefined,
										borderRadius: undefined,
										clipPath: undefined,
										overflow: 'visible',
									}
								: {}),
							// Explicit z-index preserves document order stacking within the
							// group: later children in the array (= later in p:grpSp XML)
							// render on top, matching PowerPoint's painter's algorithm.
							// Placed after ...ss to ensure it is never overwritten.
							zIndex: childIndex,
						}}
					>
						{/* Soft-edge <filter> defs + DAG fill-overlay tint layer. Required so
						    a soft-edged child's `filter: url(#soft-edge-<id>)` resolves. */}
						<ShapeEffectOverlay element={c} />
						{c.type === 'group' ? (
							// A nested group: recurse, chaining the inherited fill so a
							// `grpFill` shape under a fill-less sub-group still paints.
							renderGroup(c.children, getGroupChildParentFill(c, parentGroupFill))
						) : isI && (('svgData' in c && c.svgData) || ('imageData' in c && c.imageData)) ? (
							<div className='absolute inset-0 pointer-events-none' style={getImageSurfaceStyle(c)}>
								{isImageTiled(c) ? (
									<div
										className='pointer-events-none select-none w-full h-full'
										style={getImageTilingStyle(c)}
									/>
								) : (
									<img
										src={('svgData' in c && c.svgData ? c.svgData : c.imageData) as string}
										alt={translationsEn['pptx.ink.groupChildAlt']}
										className='pointer-events-none select-none'
										style={getImageRenderStyle(c)}
										draggable={false}
									/>
								)}
								{vs ? <div className='pointer-events-none absolute inset-0'>{vs}</div> : null}
							</div>
						) : (
							<>
								{vs}
								{isTxt ? (
									<div
										className='relative z-10 w-full h-full pointer-events-none whitespace-pre-wrap break-words leading-[1.3]'
										style={ts}
									>
										{renderTextSegments(c, DEFAULT_TEXT_COLOR)}
									</div>
								) : null}
							</>
						)}
					</div>
				);
			})}
		</div>
	);
}

export function renderContentPart(el: ContentPartPptxElement, options?: InkRenderOptions) {
	if (el.inkStrokes && el.inkStrokes.length > 0) {
		const replay = options?.replay ?? false;
		const pressureSensitive = options?.pressureSensitive ?? true;
		const strokes = buildContentPartStrokes(el);
		const replayStyles = replay
			? getContentPartReplayStyles(el.inkStrokes, options?.replayConfig)
			: null;

		return (
			<svg
				className='w-full h-full pointer-events-none'
				viewBox={`0 0 ${Math.max(el.width, 1)} ${Math.max(el.height, 1)}`}
				preserveAspectRatio='none'
			>
				{replay && <style>{INK_REPLAY_KEYFRAMES}</style>}
				{strokes.map((s, i) =>
					renderStrokeView(s, pressureSensitive, replayStyles?.[i], `${el.id}-cp-ink-${i}`),
				)}
			</svg>
		);
	}
	return (
		<div className='w-full h-full flex items-center justify-center text-[11px] text-white/80 pointer-events-none'>
			{translationsEn['pptx.ink.contentPartFallback']}
		</div>
	);
}

// ---------------------------------------------------------------------------
// Inline SVG icon functions (return JSX, not components)
// ---------------------------------------------------------------------------

/** Spreadsheet grid icon for Excel objects. */
export function ExcelIcon(color: string, size = 32) {
	return (
		<svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
			{/* Grid outline */}
			<rect
				x='3'
				y='3'
				width='18'
				height='18'
				rx='2'
				stroke={color}
				strokeWidth='1.5'
				fill='none'
			/>
			{/* Horizontal grid lines */}
			<line x1='3' y1='9' x2='21' y2='9' stroke={color} strokeWidth='1' />
			<line x1='3' y1='15' x2='21' y2='15' stroke={color} strokeWidth='1' />
			{/* Vertical grid lines */}
			<line x1='9' y1='3' x2='9' y2='21' stroke={color} strokeWidth='1' />
			<line x1='15' y1='3' x2='15' y2='21' stroke={color} strokeWidth='1' />
		</svg>
	);
}

/** Document with text lines icon for Word objects. */
export function WordIcon(color: string, size = 32) {
	return (
		<svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
			{/* Document outline */}
			<rect
				x='4'
				y='2'
				width='16'
				height='20'
				rx='2'
				stroke={color}
				strokeWidth='1.5'
				fill='none'
			/>
			{/* Text lines */}
			<line x1='7' y1='7' x2='17' y2='7' stroke={color} strokeWidth='1.5' strokeLinecap='round' />
			<line x1='7' y1='11' x2='17' y2='11' stroke={color} strokeWidth='1.5' strokeLinecap='round' />
			<line x1='7' y1='15' x2='13' y2='15' stroke={color} strokeWidth='1.5' strokeLinecap='round' />
		</svg>
	);
}

/** Document with "PDF" text icon for PDF objects. */
export function PdfIcon(color: string, size = 32) {
	return (
		<svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
			{/* Document outline */}
			<rect
				x='4'
				y='2'
				width='16'
				height='20'
				rx='2'
				stroke={color}
				strokeWidth='1.5'
				fill='none'
			/>
			{/* PDF text */}
			<text x='12' y='14' textAnchor='middle' fill={color} fontSize='7' fontWeight='bold'>
				{translationsEn['pptx.file.pdf']}
			</text>
		</svg>
	);
}

/** Simple hierarchy diagram icon for Visio objects. */
export function VisioIcon(color: string, size = 32) {
	return (
		<svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
			{/* Top box */}
			<rect x='8' y='2' width='8' height='5' rx='1' stroke={color} strokeWidth='1.5' fill='none' />
			{/* Connector lines */}
			<line x1='12' y1='7' x2='12' y2='10' stroke={color} strokeWidth='1.5' />
			<line x1='6' y1='10' x2='18' y2='10' stroke={color} strokeWidth='1.5' />
			<line x1='6' y1='10' x2='6' y2='13' stroke={color} strokeWidth='1.5' />
			<line x1='18' y1='10' x2='18' y2='13' stroke={color} strokeWidth='1.5' />
			{/* Bottom boxes */}
			<rect x='2' y='13' width='8' height='5' rx='1' stroke={color} strokeWidth='1.5' fill='none' />
			<rect
				x='14'
				y='13'
				width='8'
				height='5'
				rx='1'
				stroke={color}
				strokeWidth='1.5'
				fill='none'
			/>
		</svg>
	);
}

/** f(x) text icon for MathType objects. */
export function MathIcon(color: string, size = 32) {
	return (
		<svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
			{/* Container */}
			<rect
				x='2'
				y='4'
				width='20'
				height='16'
				rx='2'
				stroke={color}
				strokeWidth='1.5'
				fill='none'
			/>
			{/* f(x) text */}
			<text
				x='12'
				y='15'
				textAnchor='middle'
				fill={color}
				fontSize='9'
				fontStyle='italic'
				fontWeight='bold'
			>
				f(x)
			</text>
		</svg>
	);
}

/** Generic linked boxes icon for unrecognised OLE objects. */
export function GenericOleIcon(color: string, size = 32) {
	return (
		<svg width={size} height={size} viewBox='0 0 24 24' fill='none'>
			{/* Left box */}
			<rect
				x='2'
				y='5'
				width='9'
				height='7'
				rx='1.5'
				stroke={color}
				strokeWidth='1.5'
				fill='none'
			/>
			{/* Right box */}
			<rect
				x='13'
				y='12'
				width='9'
				height='7'
				rx='1.5'
				stroke={color}
				strokeWidth='1.5'
				fill='none'
			/>
			{/* Linking line */}
			<line
				x1='11'
				y1='8.5'
				x2='13'
				y2='15.5'
				stroke={color}
				strokeWidth='1.5'
				strokeLinecap='round'
			/>
		</svg>
	);
}

/**
 * Return the appropriate SVG icon JSX for the given OLE type.
 */
export function getOleIcon(type: ResolvedOleType, color: string, size = 32) {
	switch (type) {
		case 'excel':
			return ExcelIcon(color, size);
		case 'word':
			return WordIcon(color, size);
		case 'pdf':
			return PdfIcon(color, size);
		case 'visio':
			return VisioIcon(color, size);
		case 'mathtype':
			return MathIcon(color, size);
		case 'unknown':
		default:
			return GenericOleIcon(color, size);
	}
}

/**
 * Render an OLE badge overlay for preview images.
 */
export function renderOleBadge(oleType: ResolvedOleType) {
	const color = getOleTypeColor(oleType);
	const shortLabel = getOleBadgeLabel(oleType);
	return (
		<svg width='24' height='24' viewBox='0 0 24 24' className='absolute bottom-1 right-1 z-10'>
			<rect x='2' y='2' width='20' height='20' rx='3' fill={color} />
			<text
				x='12'
				y='16'
				textAnchor='middle'
				fill='white'
				fontSize={shortLabel.length > 4 ? '6' : '10'}
				fontWeight='bold'
			>
				{shortLabel}
			</text>
		</svg>
	);
}
