/**
 * Insert/Duplicate/Delete/Rename Layout. Split out of
 * {@link module:sdk/master-layout-crud} purely for file size; see that
 * module's header for the overall strategy (save -> ZIP surgery -> reload).
 *
 * @module sdk/master-layout-crud-layout
 */
import { PptxHandler } from '../../PptxHandler';
import type { PptxData } from '../../types/presentation';
import {
	addLayoutContentType,
	addLayoutToSlideMaster,
	countExistingLayouts,
	createLayout,
} from './layout-operations';
import type { LayoutDefinition, PlaceholderDefinition } from './layout-operations';
import { findLayoutOwner, findMaster, NOT_FOUND } from './master-layout-crud-lookup';
import { collectLayoutNames, uniqueDisplayName } from './master-layout-crud-names';
import {
	masterIndexFromPath,
	relsPathFor,
	reload,
	removeContentTypeOverride,
	removeLayoutFromMaster,
	saveToZip,
	withCSldName,
} from './master-layout-crud-xml';
import type { MasterLayoutCrudFailure, MasterLayoutCrudResult } from './master-layout-crud-xml';

/** {@link duplicateLayout} / {@link insertLayout} success: the new layout's id. */
export interface DuplicateLayoutSuccess {
	ok: true;
	handler: PptxHandler;
	data: PptxData;
	layoutId: string;
}
export type DuplicateLayoutResult = DuplicateLayoutSuccess | MasterLayoutCrudFailure;

/** A title placeholder roughly matching PowerPoint's own "Insert Layout" default. */
const DEFAULT_INSERT_LAYOUT_PLACEHOLDERS: PlaceholderDefinition[] = [
	{ type: 'title', x: 38, y: 17, width: 884, height: 82 },
];

/**
 * Deep-copy a layout (elements, background, placeholders, and any part it
 * references, such as an embedded picture) within its own master, naming it
 * with PowerPoint's "duplicate" convention ({@link uniqueDisplayName}).
 */
export async function duplicateLayout(
	handler: PptxHandler,
	data: PptxData,
	layoutId: string,
): Promise<DuplicateLayoutResult> {
	const owner = findLayoutOwner(data, layoutId);
	if (!owner) {
		return NOT_FOUND;
	}
	const masterIndex = masterIndexFromPath(owner.master.path);
	if (masterIndex === undefined) {
		return NOT_FOUND;
	}

	const zip = await saveToZip(handler, data);
	const sourceXml = await zip.file(layoutId)?.async('string');
	if (!sourceXml) {
		return NOT_FOUND;
	}
	const sourceRels = await zip.file(relsPathFor(layoutId))?.async('string');

	const newIndex = countExistingLayouts(zip) + 1;
	const newPath = `ppt/slideLayouts/slideLayout${newIndex}.xml`;
	const newName = uniqueDisplayName(collectLayoutNames(data), owner.layout.name ?? 'Layout');
	zip.file(newPath, withCSldName(sourceXml, newName));
	if (sourceRels) {
		// The source layout's own rels already point at the correct (unchanged)
		// master and any media/hyperlinks it uses, so they carry over verbatim.
		zip.file(relsPathFor(newPath), sourceRels);
	}

	await addLayoutToSlideMaster(zip, newIndex, masterIndex);
	await addLayoutContentType(zip, newIndex);

	const result = await reload(zip);
	return { ...result, layoutId: newPath };
}

/**
 * Remove a layout. Refuses when a slide still references it (`inUse`) or the
 * id does not resolve (`notFound`); the caller should re-point or delete
 * those slides first.
 */
export async function deleteLayout(
	handler: PptxHandler,
	data: PptxData,
	layoutId: string,
): Promise<MasterLayoutCrudResult> {
	const owner = findLayoutOwner(data, layoutId);
	if (!owner) {
		return NOT_FOUND;
	}
	if (data.slides.some((slide) => slide.layoutPath === layoutId)) {
		return { ok: false, reason: 'inUse' };
	}

	const zip = await saveToZip(handler, data);
	await removeLayoutFromMaster(zip, owner.master.path, layoutId);
	await removeContentTypeOverride(zip, layoutId);
	zip.remove(layoutId);
	zip.remove(relsPathFor(layoutId));

	return reload(zip);
}

/** Rename a layout (`p:cSld/@name`) via the existing typed-model save path. */
export async function renameLayout(
	handler: PptxHandler,
	data: PptxData,
	layoutId: string,
	name: string,
): Promise<MasterLayoutCrudResult> {
	const owner = findLayoutOwner(data, layoutId);
	if (!owner) {
		return NOT_FOUND;
	}
	const slideMasters = (data.slideMasters ?? []).map((master) =>
		master.path !== owner.master.path
			? master
			: {
					...master,
					layouts: master.layouts?.map((layout) =>
						layout.path === layoutId ? { ...layout, name } : layout,
					),
				},
	);
	const bytes = await handler.save(data.slides, { slideMasters });
	const newHandler = new PptxHandler();
	const newData = await newHandler.load(bytes.buffer as ArrayBuffer);
	return { ok: true, handler: newHandler, data: newData };
}

/**
 * Add a new layout to a master. Delegates to {@link createLayout}; when no
 * `definition` is supplied a default title-only layout is generated, named
 * with {@link uniqueDisplayName}.
 */
export async function insertLayout(
	handler: PptxHandler,
	data: PptxData,
	masterId: string,
	definition?: LayoutDefinition,
): Promise<DuplicateLayoutResult> {
	const master = findMaster(data, masterId);
	if (!master) {
		return NOT_FOUND;
	}
	const masterIndex = masterIndexFromPath(masterId);
	if (masterIndex === undefined) {
		return NOT_FOUND;
	}
	const def: LayoutDefinition = definition ?? {
		name: uniqueDisplayName(collectLayoutNames(data), 'Custom Layout'),
		type: 'blank',
		placeholders: DEFAULT_INSERT_LAYOUT_PLACEHOLDERS,
	};
	const created = await createLayout(handler, data, def, masterIndex);
	return { ok: true, handler: created.handler, data: created.data, layoutId: created.layoutPath };
}
