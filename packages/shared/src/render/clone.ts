/**
 * clone.ts: pure, immutable deep-clone builders for editor state.
 *
 * Each binding's editor copies `PptxElement` / `PptxSlide` / style objects and
 * history snapshots when pushing undo/redo state.
 *
 * The element/slide/style clones themselves live in `pptx-viewer-core`
 * (`core/utils/clone-utils`) and are re-exported here unchanged. This file used
 * to carry a near-identical SECOND copy of that logic, and the two drifted: the
 * core copy never deep-cloned chart or SmartArt data, this one never cloned a
 * group's `groupFill`, and NEITHER cloned table rows, ink stroke arrays or
 * paragraph indents. One implementation cannot drift from itself, and
 * `pptx-viewer-mcp` (which cannot depend on this private package) reaches the
 * same functions through core.
 *
 * What stays here is the part core has no reason to know about: the editor
 * history snapshot shape.
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
	XmlObject,
} from 'pptx-viewer-core';
import {
	cloneElement,
	cloneShapeStyle,
	cloneSlide,
	cloneTemplateElementsBySlideId,
	cloneTextStyle,
	deepCloneData,
} from 'pptx-viewer-core';

export {
	cloneElement,
	cloneShapeStyle,
	cloneSlide,
	cloneTemplateElementsBySlideId,
	cloneTextStyle,
};

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

export function cloneSlideTransition(
	transition: PptxSlideTransition | undefined,
): PptxSlideTransition | undefined {
	if (!transition) {
		return undefined;
	}
	return deepCloneData(transition);
}

export function cloneElementAnimation(animation: PptxElementAnimation): PptxElementAnimation {
	return deepCloneData(animation);
}

export function cloneChartData(data: PptxChartData | undefined): PptxChartData | undefined {
	if (!data) {
		return undefined;
	}
	return deepCloneData(data);
}

export function cloneSmartArtData(
	data: PptxSmartArtData | undefined,
): PptxSmartArtData | undefined {
	if (!data) {
		return undefined;
	}
	return deepCloneData(data);
}

/**
 * Deep-clone an XML tree, or `undefined` when it cannot be serialised.
 *
 * Deliberately NOT core's `cloneXmlObject`, which is the same function with a
 * `structuredClone` fast path: that one succeeds on a self-referencing object
 * where this one gives up, and the editor's contract (asserted by the React
 * binding) is that an unserialisable tree yields `undefined` rather than a
 * live-linked copy.
 */
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
