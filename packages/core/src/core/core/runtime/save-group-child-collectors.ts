/**
 * Scratch collectors used to serialise a single `<p:grpSp>` child through the
 * ordinary element writer.
 *
 * Group children used to be written straight from their own `rawXml` with only
 * the transform patched, so every other model-level edit (text, fill, stroke,
 * geometry, effects, locks, alt text, image crop) was silently discarded on
 * save: the UI showed the change, the file did not have it. Routing each child
 * through `processSlideElement` instead reuses the exact same rawXml-patching
 * discipline top-level shapes get, rather than regenerating the child.
 *
 * `processSlideElement` reports its result by pushing into one of the slide's
 * collector arrays, so a child is serialised by handing it a fresh, empty set
 * and reading back whichever bucket it landed in.
 */
import type { XmlObject } from '../../types';
import type { GroupChildEntry, GroupChildTag } from './save-group-shape-xml';
import { classifyGroupChildTag } from './save-group-shape-xml';

/**
 * Structural mirror of `SlideShapeCollectors`
 * (`PptxHandlerRuntimeSaveElementWriter`). Declared here rather than imported
 * so this module stays free of the mixin chain; the runtime assigns the
 * factory result to the real type, so tsc still catches any drift.
 */
export interface GroupChildCollectors {
	readonly shapes: XmlObject[];
	readonly pics: XmlObject[];
	readonly connectors: XmlObject[];
	readonly graphicFrames: XmlObject[];
	readonly groups: XmlObject[];
	readonly model3ds: XmlObject[];
	readonly contentParts: XmlObject[];
	readonly zooms: XmlObject[];
}

/** Collector bucket -> `CT_GroupShape` child tag. */
const TAG_BY_COLLECTOR: Record<Exclude<keyof GroupChildCollectors, 'zooms'>, GroupChildTag> = {
	shapes: 'p:sp',
	pics: 'p:pic',
	connectors: 'p:cxnSp',
	graphicFrames: 'p:graphicFrame',
	groups: 'p:grpSp',
	model3ds: 'p16:model3D',
	contentParts: 'p:contentPart',
};

/** A fresh, empty collector set for one child. */
export function createGroupChildCollectors(): GroupChildCollectors {
	return {
		shapes: [],
		pics: [],
		connectors: [],
		graphicFrames: [],
		groups: [],
		model3ds: [],
		contentParts: [],
		zooms: [],
	};
}

/**
 * Read back the single node the element writer produced, tagged with the
 * `CT_GroupShape` child element it must be written under.
 *
 * @returns `null` when the writer skipped the element (it reports its own
 *   `SAVE_ELEMENT_SKIPPED` warning in that case).
 */
export function pickGroupChildFromCollectors(
	collectors: GroupChildCollectors,
): GroupChildEntry | null {
	for (const key of Object.keys(TAG_BY_COLLECTOR) as (keyof typeof TAG_BY_COLLECTOR)[]) {
		const xml = collectors[key][0];
		if (xml) {
			return { tag: TAG_BY_COLLECTOR[key], xml };
		}
	}
	// The zoom family shares one collector but three tags, so fall back to the
	// structural classifier for it.
	const zoom = collectors.zooms[0];
	if (zoom) {
		const tag = classifyGroupChildTag('zoom', zoom);
		return tag ? { tag, xml: zoom } : null;
	}
	return null;
}
