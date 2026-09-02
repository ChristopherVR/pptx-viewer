/**
 * Insert/Duplicate/Delete/Rename Slide Master. Split out of
 * {@link module:sdk/master-layout-crud} purely for file size; see that
 * module's header for the overall strategy (save -> ZIP surgery -> reload).
 *
 * @module sdk/master-layout-crud-master
 */
import { PptxHandler } from '../../PptxHandler';
import type { PptxData } from '../../types/presentation';
import {
	addLayoutContentType,
	addLayoutToSlideMaster,
	countExistingLayouts,
	generateLayoutXml,
	layoutRelsXml,
} from './layout-operations';
import { findMaster, NOT_FOUND } from './master-layout-crud-lookup';
import { collectMasterNames, uniquePrefixedName } from './master-layout-crud-names';
import {
	addMasterContentType,
	addMasterToPresentation,
	countExistingMasters,
	newMasterXmlFromSource,
	relsPathFor,
	reload,
	removeContentTypeOverride,
	removeMasterFromPresentation,
	saveToZip,
	withCSldName,
} from './master-layout-crud-xml';
import type { MasterLayoutCrudFailure, MasterLayoutCrudResult } from './master-layout-crud-xml';
import { STANDARD_LAYOUTS } from './PresentationBuilder';

/** {@link duplicateSlideMaster} / {@link insertSlideMaster} success: the new master's id. */
export interface DuplicateMasterSuccess {
	ok: true;
	handler: PptxHandler;
	data: PptxData;
	masterId: string;
}
export type DuplicateMasterResult = DuplicateMasterSuccess | MasterLayoutCrudFailure;

/**
 * Deep-copy a slide master together with every layout it owns, naming it
 * with PowerPoint's "duplicate master" convention ({@link uniquePrefixedName}).
 * The new master shares its source's theme part rather than forking a copy.
 */
export async function duplicateSlideMaster(
	handler: PptxHandler,
	data: PptxData,
	masterId: string,
): Promise<DuplicateMasterResult> {
	const source = findMaster(data, masterId);
	if (!source) {
		return NOT_FOUND;
	}

	const zip = await saveToZip(handler, data);
	const sourceXml = await zip.file(masterId)?.async('string');
	const sourceRels = await zip.file(relsPathFor(masterId))?.async('string');
	if (!sourceXml || !sourceRels) {
		return NOT_FOUND;
	}

	const masterIndex = countExistingMasters(zip) + 1;
	const newMasterPath = `ppt/slideMasters/slideMaster${masterIndex}.xml`;
	const layoutBase = countExistingLayouts(zip);

	let newRels = sourceRels;
	const sourceLayoutPaths = (source.layouts ?? []).map((l) => l.path);
	for (let i = 0; i < sourceLayoutPaths.length; i++) {
		const oldPath = sourceLayoutPaths[i];
		const newPath = `ppt/slideLayouts/slideLayout${layoutBase + i + 1}.xml`;

		const layoutXml = await zip.file(oldPath)?.async('string');
		if (!layoutXml) {
			continue;
		}
		// Layout content (elements, background, placeholders) is byte-identical
		// to the source; only the backlink to the new master needs retargeting.
		zip.file(newPath, layoutXml);
		const layoutRels = await zip.file(relsPathFor(oldPath))?.async('string');
		if (layoutRels) {
			zip.file(
				relsPathFor(newPath),
				layoutRels.replace(
					/Target="\.\.\/slideMasters\/slideMaster\d+\.xml"/,
					`Target="../slideMasters/slideMaster${masterIndex}.xml"`,
				),
			);
		}
		await addLayoutContentType(zip, layoutBase + i + 1);

		const oldTarget = `Target="../${oldPath.replace(/^ppt\//, '')}"`;
		const newTarget = `Target="../${newPath.replace(/^ppt\//, '')}"`;
		newRels = newRels.split(oldTarget).join(newTarget);
	}
	zip.file(relsPathFor(newMasterPath), newRels);

	const newName = uniquePrefixedName(collectMasterNames(data), source.name ?? 'Office Theme');
	zip.file(newMasterPath, withCSldName(sourceXml, newName));

	await addMasterContentType(zip, masterIndex);
	await addMasterToPresentation(zip, newMasterPath);

	const result = await reload(zip);
	return { ...result, masterId: newMasterPath };
}

/**
 * Remove a slide master and every layout it owns. Refuses when it is the
 * presentation's only master (`lastMaster`) or a slide still uses one of its
 * layouts (`inUse`).
 */
export async function deleteSlideMaster(
	handler: PptxHandler,
	data: PptxData,
	masterId: string,
): Promise<MasterLayoutCrudResult> {
	const masters = data.slideMasters ?? [];
	if (masters.length <= 1) {
		return { ok: false, reason: 'lastMaster' };
	}
	const master = masters.find((m) => m.path === masterId);
	if (!master) {
		return NOT_FOUND;
	}
	const layoutPaths = new Set((master.layouts ?? []).map((l) => l.path));
	const inUse = data.slides.some(
		(slide) => slide.layoutPath !== undefined && layoutPaths.has(slide.layoutPath),
	);
	if (inUse) {
		return { ok: false, reason: 'inUse' };
	}

	const zip = await saveToZip(handler, data);
	await removeMasterFromPresentation(zip, masterId);
	await removeContentTypeOverride(zip, masterId);
	zip.remove(masterId);
	zip.remove(relsPathFor(masterId));
	for (const layoutPath of layoutPaths) {
		await removeContentTypeOverride(zip, layoutPath);
		zip.remove(layoutPath);
		zip.remove(relsPathFor(layoutPath));
	}

	return reload(zip);
}

/** Rename a slide master (`p:cSld/@name`) via the existing typed-model save path. */
export async function renameSlideMaster(
	handler: PptxHandler,
	data: PptxData,
	masterId: string,
	name: string,
): Promise<MasterLayoutCrudResult> {
	const master = findMaster(data, masterId);
	if (!master) {
		return NOT_FOUND;
	}
	const slideMasters = (data.slideMasters ?? []).map((m) =>
		m.path === masterId ? { ...m, name } : m,
	);
	const bytes = await handler.save(data.slides, { slideMasters });
	const newHandler = new PptxHandler();
	const newData = await newHandler.load(bytes.buffer as ArrayBuffer);
	return { ok: true, handler: newHandler, data: newData };
}

/**
 * Insert a brand-new slide master: PowerPoint's own eleven standard layouts
 * ({@link STANDARD_LAYOUTS}, the same set `PresentationBuilder` seeds a
 * from-scratch deck with), the first master's colour map and text styles
 * byte-copied across, sharing its theme part.
 */
export async function insertSlideMaster(
	handler: PptxHandler,
	data: PptxData,
): Promise<DuplicateMasterResult> {
	const firstMaster = data.slideMasters?.[0];
	if (!firstMaster) {
		return NOT_FOUND;
	}

	const zip = await saveToZip(handler, data);
	const sourceMasterXml = await zip.file(firstMaster.path)?.async('string');
	if (!sourceMasterXml) {
		return NOT_FOUND;
	}

	const masterIndex = countExistingMasters(zip) + 1;
	const newMasterPath = `ppt/slideMasters/slideMaster${masterIndex}.xml`;
	const themeTarget = `../${(firstMaster.themePath ?? 'ppt/theme/theme1.xml').replace(/^ppt\//, '')}`;

	zip.file(newMasterPath, newMasterXmlFromSource(sourceMasterXml, ''));
	zip.file(
		relsPathFor(newMasterPath),
		`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="${themeTarget}"/>\n</Relationships>`,
	);
	await addMasterContentType(zip, masterIndex);

	const layoutBase = countExistingLayouts(zip);
	for (let i = 0; i < STANDARD_LAYOUTS.length; i++) {
		const newIndex = layoutBase + i + 1;
		const layoutPath = `ppt/slideLayouts/slideLayout${newIndex}.xml`;
		zip.file(layoutPath, generateLayoutXml(STANDARD_LAYOUTS[i]));
		zip.file(relsPathFor(layoutPath), layoutRelsXml(masterIndex));
		await addLayoutToSlideMaster(zip, newIndex, masterIndex);
		await addLayoutContentType(zip, newIndex);
	}

	await addMasterToPresentation(zip, newMasterPath);

	const result = await reload(zip);
	return { ...result, masterId: newMasterPath };
}
