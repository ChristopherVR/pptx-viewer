/**
 * Low-level ZIP/XML surgery shared by {@link module:sdk/master-layout-crud}.
 *
 * Every operation here works the same way `createLayout` (layout-operations.ts)
 * already does: save the handler to get a fully-serialised, guaranteed-valid
 * ZIP, mutate it with JSZip + string surgery, then reload through a fresh
 * `PptxHandler` so every derived/cached field (layoutXmlMap, layoutOptions,
 * slideMasters[].layouts, ...) is recomputed from the result rather than
 * hand-patched and risking drift.
 *
 * @module sdk/master-layout-crud-xml
 */
import JSZip from 'jszip';

import { escAttr } from '../../ppt/pptx/xml-utils';
import { PptxHandler } from '../../PptxHandler';
import type { PptxData } from '../../types/presentation';

// ---------------------------------------------------------------------------
// Save / reload
// ---------------------------------------------------------------------------

/** Serialise the current handler state and reopen it as a mutable JSZip. */
export async function saveToZip(handler: PptxHandler, data: PptxData): Promise<JSZip> {
	const bytes = await handler.save(data.slides);
	return JSZip.loadAsync(bytes);
}

/** Result of a successful master/layout CRUD operation. */
export interface MasterLayoutCrudSuccess {
	ok: true;
	handler: PptxHandler;
	data: PptxData;
}

/** Result of a rejected master/layout CRUD operation. */
export interface MasterLayoutCrudFailure {
	ok: false;
	/** `notFound`: the id did not resolve. `inUse`: a slide references the
	 * part. `lastMaster`: refusing to delete the presentation's only master. */
	reason: 'notFound' | 'inUse' | 'lastMaster';
}

export type MasterLayoutCrudResult = MasterLayoutCrudSuccess | MasterLayoutCrudFailure;

/** Regenerate the ZIP bytes and load them into a brand-new handler. */
export async function reload(zip: JSZip): Promise<MasterLayoutCrudSuccess> {
	const buffer = await zip.generateAsync({ type: 'arraybuffer' });
	const handler = new PptxHandler();
	const data = await handler.load(buffer);
	return { ok: true, handler, data };
}

// ---------------------------------------------------------------------------
// Path helpers
// ---------------------------------------------------------------------------

/** The `_rels/*.rels` path for an archive part, e.g. `ppt/slideMasters/slideMaster1.xml`
 * -> `ppt/slideMasters/_rels/slideMaster1.xml.rels`. */
export function relsPathFor(partPath: string): string {
	const slash = partPath.lastIndexOf('/');
	const dir = partPath.slice(0, slash);
	const file = partPath.slice(slash + 1);
	return `${dir}/_rels/${file}.rels`;
}

/** The 1-based index encoded in a `slideMaster<N>.xml` path, or `undefined`. */
export function masterIndexFromPath(masterPath: string): number | undefined {
	const match = masterPath.match(/slideMaster(\d+)\.xml$/);
	return match ? parseInt(match[1], 10) : undefined;
}

/** Count existing slide masters in the ZIP by scanning file paths. */
export function countExistingMasters(zip: JSZip): number {
	let count = 0;
	zip.forEach((relativePath) => {
		if (/^ppt\/slideMasters\/slideMaster\d+\.xml$/.test(relativePath)) {
			count++;
		}
	});
	return count;
}

function escapeRegex(value: string): string {
	return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ---------------------------------------------------------------------------
// [Content_Types].xml
// ---------------------------------------------------------------------------

/** Add the slide-master content-type override to `[Content_Types].xml`. */
export async function addMasterContentType(zip: JSZip, masterIndex: number): Promise<void> {
	const ctPath = '[Content_Types].xml';
	const ctContent = await zip.file(ctPath)?.async('string');
	if (!ctContent) {
		throw new Error('Content types file not found');
	}
	const override = `  <Override PartName="/ppt/slideMasters/slideMaster${masterIndex}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/>`;
	zip.file(ctPath, ctContent.replace('</Types>', `${override}\n</Types>`));
}

/** Remove one part's content-type override, if present. No-op otherwise. */
export async function removeContentTypeOverride(zip: JSZip, partPath: string): Promise<void> {
	const ctPath = '[Content_Types].xml';
	const ctContent = await zip.file(ctPath)?.async('string');
	if (!ctContent) {
		return;
	}
	const re = new RegExp(`\\s*<Override PartName="/${escapeRegex(partPath)}"[^>]*/>`);
	zip.file(ctPath, ctContent.replace(re, ''));
}

// ---------------------------------------------------------------------------
// Master <-> layout wiring
// ---------------------------------------------------------------------------

/**
 * Remove one layout's relationship + `<p:sldLayoutId>` entry from its owning
 * master. Mirrors `addLayoutToSlideMaster` in layout-operations.ts in reverse.
 */
export async function removeLayoutFromMaster(
	zip: JSZip,
	masterPath: string,
	layoutPath: string,
): Promise<void> {
	const masterRelsPath = relsPathFor(masterPath);
	const relsContent = await zip.file(masterRelsPath)?.async('string');
	if (!relsContent) {
		return;
	}
	const target = `../${layoutPath.replace(/^ppt\//, '')}`;
	const match = relsContent.match(
		new RegExp(`<Relationship Id="(rId\\d+)"[^>]*Target="${escapeRegex(target)}"[^>]*/>`),
	);
	if (!match) {
		return;
	}
	zip.file(masterRelsPath, relsContent.replace(match[0], ''));

	const masterContent = await zip.file(masterPath)?.async('string');
	if (!masterContent) {
		return;
	}
	const idRe = new RegExp(`\\s*<p:sldLayoutId[^>]*r:id="${match[1]}"[^>]*/>`);
	zip.file(masterPath, masterContent.replace(idRe, ''));
}

// ---------------------------------------------------------------------------
// presentation.xml <-> master wiring
// ---------------------------------------------------------------------------

/** Register a newly-created master in `presentation.xml` / its rels. */
export async function addMasterToPresentation(zip: JSZip, masterPath: string): Promise<void> {
	const relsPath = 'ppt/_rels/presentation.xml.rels';
	const relsContent = await zip.file(relsPath)?.async('string');
	if (!relsContent) {
		throw new Error('presentation.xml.rels not found');
	}
	const rIdMatches = [...relsContent.matchAll(/rId(\d+)/g)];
	const maxRId = rIdMatches.reduce((max, m) => Math.max(max, parseInt(m[1], 10)), 0);
	const newRId = `rId${maxRId + 1}`;
	const target = masterPath.replace(/^ppt\//, '');
	const newRel = `  <Relationship Id="${newRId}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="${target}"/>`;
	zip.file(relsPath, relsContent.replace('</Relationships>', `${newRel}\n</Relationships>`));

	const presPath = 'ppt/presentation.xml';
	const presContent = await zip.file(presPath)?.async('string');
	if (!presContent) {
		throw new Error('presentation.xml not found');
	}
	const idMatches = [...presContent.matchAll(/sldMasterId\s+id="(\d+)"/g)];
	const maxId = idMatches.reduce((max, m) => Math.max(max, parseInt(m[1], 10)), 2147483647);
	const newEntry = `    <p:sldMasterId id="${maxId + 1}" r:id="${newRId}"/>`;
	zip.file(
		presPath,
		presContent.replace('</p:sldMasterIdLst>', `${newEntry}\n  </p:sldMasterIdLst>`),
	);
}

/** Remove a master's relationship + `<p:sldMasterId>` entry from `presentation.xml`. */
export async function removeMasterFromPresentation(zip: JSZip, masterPath: string): Promise<void> {
	const relsPath = 'ppt/_rels/presentation.xml.rels';
	const relsContent = await zip.file(relsPath)?.async('string');
	if (!relsContent) {
		return;
	}
	const target = masterPath.replace(/^ppt\//, '');
	const match = relsContent.match(
		new RegExp(`<Relationship Id="(rId\\d+)"[^>]*Target="${escapeRegex(target)}"[^>]*/>`),
	);
	if (!match) {
		return;
	}
	zip.file(relsPath, relsContent.replace(match[0], ''));

	const presPath = 'ppt/presentation.xml';
	const presContent = await zip.file(presPath)?.async('string');
	if (!presContent) {
		return;
	}
	const idRe = new RegExp(`\\s*<p:sldMasterId[^>]*r:id="${match[1]}"[^>]*/>`);
	zip.file(presPath, presContent.replace(idRe, ''));
}

// ---------------------------------------------------------------------------
// `p:cSld/@name` rewrite (shared by layout and master parts)
// ---------------------------------------------------------------------------

/** Set (or replace) the `<p:cSld name="...">` attribute in a raw part's XML. */
export function withCSldName(xml: string, name: string): string {
	const escaped = escAttr(name);
	if (/<p:cSld[^>]*\sname="/.test(xml)) {
		return xml.replace(/(<p:cSld[^>]*\sname=")[^"]*(")/, `$1${escaped}$2`);
	}
	return xml.replace(/<p:cSld(?=[\s>])/, `<p:cSld name="${escaped}"`);
}

// ---------------------------------------------------------------------------
// Fresh master shell (insertSlideMaster)
// ---------------------------------------------------------------------------

const MASTER_XMLNS =
	'xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" ' +
	'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" ' +
	'xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"';

const FALLBACK_CLR_MAP =
	'<p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/>';

const FALLBACK_TX_STYLES =
	'<p:txStyles><p:titleStyle><a:lvl1pPr algn="l"><a:defRPr sz="4400" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mj-lt"/></a:defRPr></a:lvl1pPr></p:titleStyle><p:bodyStyle><a:lvl1pPr algn="l"><a:defRPr sz="3200" kern="1200"><a:solidFill><a:schemeClr val="tx1"/></a:solidFill><a:latin typeface="+mn-lt"/></a:defRPr></a:lvl1pPr></p:bodyStyle><p:otherStyle><a:defPPr><a:defRPr lang="en-US"/></a:defPPr></p:otherStyle></p:txStyles>';

function extractTag(xml: string, tag: string): string {
	const container = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?>[^]*?</${tag}>`));
	if (container) {
		return container[0];
	}
	const selfClosed = xml.match(new RegExp(`<${tag}(?:\\s[^>]*)?/>`));
	return selfClosed ? selfClosed[0] : '';
}

/**
 * Build a new `p:sldMaster` part with a blank shape tree and the supplied
 * `<p:sldLayoutId>` entries, reusing the colour map and text styles
 * byte-copied from an existing master so PowerPoint-authored formatting
 * (and any wave-4-out-of-scope customisation) survives into the new one.
 */
export function newMasterXmlFromSource(sourceMasterXml: string, sldLayoutIdLst: string): string {
	const clrMap = extractTag(sourceMasterXml, 'p:clrMap') || FALLBACK_CLR_MAP;
	const txStyles = extractTag(sourceMasterXml, 'p:txStyles') || FALLBACK_TX_STYLES;
	return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sldMaster ${MASTER_XMLNS}>
  <p:cSld>
    <p:spTree>
      <p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr>
      <p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr>
    </p:spTree>
  </p:cSld>
  ${clrMap}
  <p:sldLayoutIdLst>
${sldLayoutIdLst}
  </p:sldLayoutIdLst>
  ${txStyles}
</p:sldMaster>`;
}
