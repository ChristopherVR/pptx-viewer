/**
 * master-view.ts: the framework-neutral rules behind View > Slide Master.
 *
 * Every binding had its own copy of "turn the selected master/layout/notes/
 * handout part into a pseudo-slide the ordinary canvas can paint", and they
 * had drifted: React and Svelte painted a layout without its master's artwork
 * behind it, React keyed its pseudo-slide so the save path could never match
 * it, Angular dropped every edit made on the Slides tab, and Vue offered no
 * edit at all. The decisions live here instead, and each binding maps the
 * returned descriptors onto its own state container.
 *
 * @module render/master-view
 */
import type {
	MasterViewTab,
	PptxElement,
	PptxHandoutMaster,
	PptxImageProperties,
	PptxNotesMaster,
	PptxSlide,
	PptxSlideLayout,
	PptxSlideMaster,
} from 'pptx-viewer-core';

/** Which part the master view is currently pointed at. */
export interface MasterViewTarget {
	tab: MasterViewTab;
	masterIndex: number;
	/** `null` selects the master itself rather than one of its layouts. */
	layoutIndex: number | null;
}

/** The parts a master view can reach, however the binding stores them. */
export interface MasterViewDocument {
	slideMasters: readonly PptxSlideMaster[];
	notesMaster?: PptxNotesMaster | undefined;
	handoutMaster?: PptxHandoutMaster | undefined;
}

/** Which model an element belongs to, so a write can be routed back to it. */
export type MasterViewPartKind = 'master' | 'layout' | 'notes' | 'handout';

/** One part contributing elements to the master-view canvas. */
export interface MasterViewPart {
	kind: MasterViewPartKind;
	/** Archive path of the part (`ppt/slideLayouts/slideLayout3.xml`). */
	path: string;
	/** Index into `slideMasters`, for `master` and `layout` parts. */
	masterIndex?: number;
	/** Index into that master's `layouts`, for `layout` parts. */
	layoutIndex?: number;
	elements: readonly PptxElement[];
	backgroundColor?: string | undefined;
	backgroundImage?: string | undefined;
	backgroundImageProperties?: PptxImageProperties | undefined;
}

/** A write-back for one master-view edit; only the touched models are set. */
export interface MasterViewWrite {
	slideMasters?: PptxSlideMaster[];
	notesMaster?: PptxNotesMaster;
	handoutMaster?: PptxHandoutMaster;
}

/**
 * The parts painted for this target, back to front.
 *
 * Selecting a layout also paints its master underneath, which is what
 * PowerPoint shows and what the master's `p:spTree` is for. The last entry is
 * the *primary* part: the one a newly drawn shape belongs to.
 */
export function masterViewParts(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
): MasterViewPart[] {
	if (!target) {
		return [];
	}
	if (target.tab === 'notes') {
		return auxiliaryParts('notes', document.notesMaster);
	}
	if (target.tab === 'handout') {
		return auxiliaryParts('handout', document.handoutMaster);
	}
	const master = document.slideMasters[target.masterIndex];
	if (!master) {
		return [];
	}
	const masterPart: MasterViewPart = {
		kind: 'master',
		path: master.path,
		masterIndex: target.masterIndex,
		elements: master.elements ?? [],
		backgroundColor: master.backgroundColor,
		backgroundImage: master.backgroundImage,
		backgroundImageProperties: master.backgroundImageProperties,
	};
	const layout = target.layoutIndex === null ? undefined : master.layouts?.[target.layoutIndex];
	if (!layout || target.layoutIndex === null) {
		return [masterPart];
	}
	return [
		masterPart,
		{
			kind: 'layout',
			path: layout.path,
			masterIndex: target.masterIndex,
			layoutIndex: target.layoutIndex,
			elements: layout.elements ?? [],
			backgroundColor: layout.backgroundColor ?? master.backgroundColor,
			backgroundImage: layout.backgroundImage ?? master.backgroundImage,
			backgroundImageProperties: layout.backgroundImage
				? layout.backgroundImageProperties
				: master.backgroundImageProperties,
		},
	];
}

function auxiliaryParts(
	kind: 'notes' | 'handout',
	part: PptxNotesMaster | PptxHandoutMaster | undefined,
): MasterViewPart[] {
	return part
		? [
				{
					kind,
					path: part.path,
					elements: part.elements ?? [],
					backgroundColor: part.backgroundColor,
					backgroundImage: part.backgroundImage,
					backgroundImageProperties: part.backgroundImageProperties,
				},
			]
		: [];
}

/** The part a newly drawn or unrecognised element belongs to. */
export function primaryMasterViewPart(
	parts: readonly MasterViewPart[],
): MasterViewPart | undefined {
	return parts[parts.length - 1];
}

/**
 * The selected part rendered as a slide, so the ordinary canvas can paint it.
 *
 * The id is the part's archive path. That is deliberate: it is the key the
 * save writer matches parts on, and it must never collide with a real
 * `PptxSlide.id`.
 */
export function masterViewPseudoSlide(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
): PptxSlide | undefined {
	const parts = masterViewParts(document, target);
	const primary = primaryMasterViewPart(parts);
	if (!primary) {
		return undefined;
	}
	return {
		id: primary.path,
		rId: '',
		slideNumber: 0,
		elements: parts.flatMap((part) => [...part.elements]),
		backgroundColor: primary.backgroundColor,
		backgroundImage: primary.backgroundImage,
		backgroundImageProperties: primary.backgroundImageProperties,
	};
}

/** Every element the master-view canvas is currently painting. */
export function masterViewElements(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
): PptxElement[] {
	return masterViewParts(document, target).flatMap((part) => [...part.elements]);
}

/** The part that owns one element id, or the primary part when it is new. */
export function masterViewPartForElement(
	parts: readonly MasterViewPart[],
	elementId: string,
): MasterViewPart | undefined {
	return (
		parts.find((part) => part.elements.some((element) => element.id === elementId)) ??
		primaryMasterViewPart(parts)
	);
}

/**
 * Split a flat element list back into the parts it came from.
 *
 * The canvas hands back one array, but a layout view paints two parts, so an
 * edit has to be routed by ownership rather than dropped into whichever model
 * the binding happens to hold. Elements the loader never produced (a shape the
 * user just drew) land on the primary part.
 */
export function partitionMasterViewElements(
	parts: readonly MasterViewPart[],
	elements: readonly PptxElement[],
): Map<string, PptxElement[]> {
	const byPath = new Map<string, PptxElement[]>();
	for (const part of parts) {
		byPath.set(part.path, []);
	}
	const primary = primaryMasterViewPart(parts);
	for (const element of elements) {
		const owner = masterViewPartForElement(parts, element.id) ?? primary;
		if (!owner) {
			continue;
		}
		byPath.get(owner.path)?.push(element);
	}
	return byPath;
}

/**
 * Replace the master view's element list, routing each element back to the
 * part that owns it. Returns only the models that changed, or `null` when the
 * target resolves to nothing.
 */
export function replaceMasterViewElements(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
	elements: readonly PptxElement[],
): MasterViewWrite | null {
	const parts = masterViewParts(document, target);
	if (parts.length === 0) {
		return null;
	}
	const byPath = partitionMasterViewElements(parts, elements);
	if (parts[0].kind === 'notes') {
		return document.notesMaster
			? { notesMaster: { ...document.notesMaster, elements: byPath.get(parts[0].path) ?? [] } }
			: null;
	}
	if (parts[0].kind === 'handout') {
		return document.handoutMaster
			? { handoutMaster: { ...document.handoutMaster, elements: byPath.get(parts[0].path) ?? [] } }
			: null;
	}
	return { slideMasters: writeSlideMasterParts(document.slideMasters, parts, byPath) };
}

function writeSlideMasterParts(
	slideMasters: readonly PptxSlideMaster[],
	parts: readonly MasterViewPart[],
	byPath: ReadonlyMap<string, PptxElement[]>,
): PptxSlideMaster[] {
	return slideMasters.map((master, masterIndex) => {
		const masterPart = parts.find(
			(part) => part.kind === 'master' && part.masterIndex === masterIndex,
		);
		const layoutPart = parts.find(
			(part) => part.kind === 'layout' && part.masterIndex === masterIndex,
		);
		if (!masterPart && !layoutPart) {
			return master;
		}
		const next: PptxSlideMaster = masterPart
			? { ...master, elements: byPath.get(masterPart.path) ?? [] }
			: { ...master };
		if (layoutPart) {
			next.layouts = master.layouts?.map((layout: PptxSlideLayout, layoutIndex: number) =>
				layoutIndex === layoutPart.layoutIndex
					? { ...layout, elements: byPath.get(layoutPart.path) ?? [] }
					: layout,
			);
		}
		return next;
	});
}

/**
 * Apply a partial update to one element in the master view.
 *
 * This is the shape every binding's canvas needs: a drag, a rotate or a text
 * commit arrives as `{ id, patch }` and has to reach whichever part owns that
 * id, which is not necessarily the part the sidebar has selected.
 */
export function updateMasterViewElement(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
	elementId: string,
	patch: Partial<PptxElement>,
): MasterViewWrite | null {
	const parts = masterViewParts(document, target);
	if (parts.length === 0) {
		return null;
	}
	const owner = parts.find((part) => part.elements.some((element) => element.id === elementId));
	if (!owner) {
		return null;
	}
	const next = masterViewElements(document, target).map((element) =>
		element.id === elementId ? ({ ...element, ...patch } as PptxElement) : element,
	);
	return replaceMasterViewElements(document, target, next);
}

/** True when the master view is pointed at a part that has something to edit. */
export function isMasterViewEditable(
	document: MasterViewDocument,
	target: MasterViewTarget | null | undefined,
): boolean {
	return masterViewParts(document, target).length > 0;
}
