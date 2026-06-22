/**
 * clone.ts: pure, immutable deep-clone builders for editor state.
 *
 * Each binding's editor copies `PptxElement` / `PptxSlide` / style objects and
 * history snapshots when pushing undo/redo state. The cloning is framework
 * agnostic, so it lives here and every binding imports it.
 *
 * @module render/clone
 */
import type {
	PptxChartData,
	PptxElement,
	PptxElementAnimation,
	PptxSlide,
	PptxSlideTransition,
	PptxSmartArtData,
	ShapeStyle,
	TextStyle,
	XmlObject,
} from 'pptx-viewer-core';

/**
 * The structural shape of an editor history snapshot that {@link cloneHistorySnapshot}
 * reads and rebuilds. Declared from core types only (no binding import) so each
 * binding's own `EditorHistorySnapshot` (which may add e.g. an `actionLabel`)
 * assigns to and from it.
 */
export interface HistorySnapshotLike {
	width: number;
	height: number;
	activeSlideIndex: number;
	slides: PptxSlide[];
	templateElementsBySlideId: Record<string, PptxElement[]>;
}

export function cloneTextStyle(style?: TextStyle): TextStyle | undefined {
	if (!style) {
		return undefined;
	}
	return { ...style };
}

export function cloneShapeStyle(style?: ShapeStyle): ShapeStyle | undefined {
	if (!style) {
		return undefined;
	}
	return {
		...style,
		...(style.fillGradientStops
			? { fillGradientStops: style.fillGradientStops.map((stop) => ({ ...stop })) }
			: {}),
	};
}

export function cloneSlideTransition(
	transition: PptxSlideTransition | undefined,
): PptxSlideTransition | undefined {
	if (!transition) {
		return undefined;
	}
	return { ...transition };
}

export function cloneElementAnimation(animation: PptxElementAnimation): PptxElementAnimation {
	return { ...animation };
}

export function cloneChartData(data: PptxChartData | undefined): PptxChartData | undefined {
	if (!data) {
		return undefined;
	}
	return {
		...data,
		categories: [...(data.categories || [])],
		series: (data.series || []).map((series) => ({
			...series,
			values: [...(series.values || [])],
		})),
	};
}

export function cloneSmartArtData(
	data: PptxSmartArtData | undefined,
): PptxSmartArtData | undefined {
	if (!data) {
		return undefined;
	}
	return {
		...data,
		nodes: (data.nodes || []).map((node) => ({ ...node })),
	};
}

export function cloneElement(element: PptxElement): PptxElement {
	switch (element.type) {
		case 'text':
		case 'shape':
			return {
				...element,
				...(element.textStyle ? { textStyle: cloneTextStyle(element.textStyle) } : {}),
				...(element.shapeStyle ? { shapeStyle: cloneShapeStyle(element.shapeStyle) } : {}),
				...(element.shapeAdjustments ? { shapeAdjustments: { ...element.shapeAdjustments } } : {}),
				...(element.textSegments
					? {
							textSegments: element.textSegments.map((segment) => ({
								...segment,
								style: cloneTextStyle(segment.style) || {},
							})),
						}
					: {}),
			};
		case 'connector':
		case 'image':
		case 'picture':
			return {
				...element,
				...(element.shapeStyle ? { shapeStyle: cloneShapeStyle(element.shapeStyle) } : {}),
				...(element.shapeAdjustments ? { shapeAdjustments: { ...element.shapeAdjustments } } : {}),
			};
		case 'table':
			return { ...element };
		case 'chart':
			return {
				...element,
				chartData: cloneChartData(element.chartData),
			};
		case 'smartArt':
			return {
				...element,
				smartArtData: cloneSmartArtData(element.smartArtData),
			};
		case 'ole':
		case 'media':
		case 'group':
		case 'ink':
		case 'zoom':
		case 'contentPart':
		case 'unknown':
		case 'model3d':
			return { ...element };
		default: {
			const _exhaustive: never = element;
			return _exhaustive;
		}
	}
}

export function cloneSlide(slide: PptxSlide): PptxSlide {
	return {
		...slide,
		transition: cloneSlideTransition(slide.transition),
		animations: slide.animations?.map(cloneElementAnimation),
		comments: slide.comments?.map((comment) => ({ ...comment })),
		warnings: slide.warnings?.map((warning) => ({ ...warning })),
		elements: slide.elements.map(cloneElement),
	};
}

export function cloneTemplateElementsBySlideId(
	templateElementsBySlideId: Record<string, PptxElement[]>,
): Record<string, PptxElement[]> {
	const cloned: Record<string, PptxElement[]> = {};
	Object.entries(templateElementsBySlideId).forEach(([slideId, elements]) => {
		cloned[slideId] = elements.map(cloneElement);
	});
	return cloned;
}

/**
 * Deep-clone the cloneable fields of a history snapshot. Note: matches the
 * original React behaviour by NOT copying any binding-specific extras (e.g.
 * `actionLabel`); only the structural {@link HistorySnapshotLike} fields are
 * rebuilt.
 */
export function cloneHistorySnapshot(snapshot: HistorySnapshotLike): HistorySnapshotLike {
	return {
		width: snapshot.width,
		height: snapshot.height,
		activeSlideIndex: snapshot.activeSlideIndex,
		slides: snapshot.slides.map(cloneSlide),
		templateElementsBySlideId: cloneTemplateElementsBySlideId(snapshot.templateElementsBySlideId),
	};
}

export function cloneXmlObject(value: XmlObject | undefined): XmlObject | undefined {
	if (!value) {
		return undefined;
	}
	try {
		return JSON.parse(JSON.stringify(value)) as XmlObject;
	} catch {
		return undefined;
	}
}
