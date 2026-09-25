/**
 * Reads what the `.ppt` main master needs from the deck's own source slide
 * master in a saved `.pptx`: its placeholder frames, its `p:txStyles` and
 * `p:clrMap`, and its theme (the XML itself, plus the 8 ColorSchemeAtom
 * colours PowerPoint derives from it).
 *
 * The master is the first slide's (a `.ppt` written here has one master),
 * found through the package's own relationships, falling back to
 * `ppt/slideMasters/slideMaster1.xml`.
 *
 * @module ppt/writer/master-roundtrip-source
 */

import type JSZip from 'jszip';

import { parseRels, resolveTarget } from './metro-blob-source';
import type { WMasterPlaceholder, WMasterPlaceholderKind } from './write-model';

/** The source master's parts, as found in the package. */
export interface MasterRoundTripSource {
	placeholders: WMasterPlaceholder[];
	/** `p:txStyles`, with the master root's namespace declarations added. */
	txStylesXml?: string;
	/** `p:clrMap` attributes (`bg1="lt1"` ...), verbatim. */
	clrMapAttributes?: string;
	themeXml?: string;
	/** ColorSchemeAtom colours: bg1, tx1, bg2, tx2, accent1, accent2, hlink, folHlink. */
	schemeColors?: string[];
	/** The theme's major / minor Latin faces, for `+mj-lt` / `+mn-lt` style fonts. */
	themeFonts: { major?: string; minor?: string };
}

const REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const FALLBACK_MASTER = 'ppt/slideMasters/slideMaster1.xml';
const PLACEHOLDER_KINDS: Record<string, WMasterPlaceholderKind> = {
	title: 'title',
	body: 'body',
	dt: 'date',
	ftr: 'footer',
	sldNum: 'slideNumber',
};

function relsPath(partPath: string): string {
	const slash = partPath.lastIndexOf('/');
	return `${partPath.slice(0, slash)}/_rels/${partPath.slice(slash + 1)}.rels`;
}

async function readText(zip: JSZip, path: string): Promise<string | undefined> {
	return zip.file(path)?.async('string');
}

/** Follow `from`'s first relationship of `type` to its part path. */
async function followRel(zip: JSZip, from: string, type: string): Promise<string | undefined> {
	const rels = await readText(zip, relsPath(from));
	const rel = rels ? parseRels(rels).find((r) => r.type === `${REL}/${type}`) : undefined;
	return rel && !rel.external ? resolveTarget(from, rel.target) : undefined;
}

async function firstSlideMasterPath(zip: JSZip): Promise<string> {
	const presentation = 'ppt/presentation.xml';
	const xml = await readText(zip, presentation);
	const firstSlideRid = xml ? /<p:sldId\b[^>]*\br:id="([^"]+)"/u.exec(xml)?.[1] : undefined;
	const rels = await readText(zip, relsPath(presentation));
	const slideRel = rels ? parseRels(rels).find((r) => r.id === firstSlideRid) : undefined;
	const slide = slideRel ? resolveTarget(presentation, slideRel.target) : undefined;
	const layout = slide ? await followRel(zip, slide, 'slideLayout') : undefined;
	const master = layout ? await followRel(zip, layout, 'slideMaster') : undefined;
	return master && zip.file(master) ? master : FALLBACK_MASTER;
}

function num(xml: string, pattern: RegExp): number | undefined {
	const value = pattern.exec(xml)?.[1];
	return value === undefined ? undefined : Number(value);
}

/** Every placeholder `p:sp` on the master with a frame, keyed by its kind. */
function readPlaceholders(masterXml: string): WMasterPlaceholder[] {
	const out: WMasterPlaceholder[] = [];
	for (const [sp] of masterXml.matchAll(/<p:sp\b[\s\S]*?<\/p:sp>/gu)) {
		const phType = /<p:ph\b([^>]*)>/u.exec(sp)?.[1];
		if (phType === undefined) {
			continue;
		}
		const kind = PLACEHOLDER_KINDS[/\btype="([^"]+)"/u.exec(phType)?.[1] ?? 'body'];
		const x = num(sp, /<a:off\b[^>]*\bx="(-?\d+)"/u);
		const y = num(sp, /<a:off\b[^>]*\by="(-?\d+)"/u);
		const w = num(sp, /<a:ext\b[^>]*\bcx="(\d+)"/u);
		const h = num(sp, /<a:ext\b[^>]*\bcy="(\d+)"/u);
		if (
			!kind ||
			x === undefined ||
			y === undefined ||
			!w ||
			!h ||
			out.some((p) => p.kind === kind)
		) {
			continue;
		}
		const size = num(sp, /<a:lvl1pPr\b[\s\S]*?<a:defRPr\b[^>]*\bsz="(\d+)"/u);
		out.push({ kind, rect: { x, y, w, h }, ...(size ? { sizePt: size / 100 } : {}) });
	}
	return out;
}

/** `p:txStyles` made standalone: the master root's `xmlns` declarations copied onto it. */
function readTxStyles(masterXml: string): string | undefined {
	const txStyles = /<p:txStyles\b[\s\S]*?<\/p:txStyles>/u.exec(masterXml)?.[0];
	const root = /<p:sldMaster\b[^>]*>/u.exec(masterXml)?.[0] ?? '';
	if (!txStyles) {
		return undefined;
	}
	const startTag = /^<p:txStyles\b[^>]*>/u.exec(txStyles)?.[0] ?? '';
	const declarations = [...root.matchAll(/\s(xmlns(?::\w+)?)="[^"]*"/gu)]
		.filter((m) => !startTag.includes(` ${m[1]}=`))
		.map((m) => m[0]);
	return txStyles.replace(/^<p:txStyles\b/u, `<p:txStyles${declarations.join('')}`);
}

/** A theme colour slot's RGB (`srgbClr/@val` or `sysClr/@lastClr`). */
function themeColor(themeXml: string, slot: string): string | undefined {
	const body = new RegExp(`<a:${slot}>([\\s\\S]*?)</a:${slot}>`, 'u').exec(themeXml)?.[1];
	if (!body) {
		return undefined;
	}
	return (/\bval="([0-9A-Fa-f]{6})"/u.exec(body) ??
		/\blastClr="([0-9A-Fa-f]{6})"/u.exec(body))?.[1];
}

/**
 * The ColorSchemeAtom PowerPoint writes for a theme: background, text,
 * shadow, title, fill, accent, hyperlink and followed hyperlink are the
 * theme's bg1, tx1, bg2, tx2 (through the master's `p:clrMap`), accent1,
 * accent2, hlink and folHlink (COM-measured against its SaveAs format 1).
 */
function schemeColorsFor(
	themeXml: string,
	clrMapAttributes: string | undefined,
): string[] | undefined {
	const mapped = (alias: string, fallback: string): string =>
		(clrMapAttributes && new RegExp(`\\b${alias}="(\\w+)"`, 'u').exec(clrMapAttributes)?.[1]) ||
		fallback;
	const slots = [
		mapped('bg1', 'lt1'),
		mapped('tx1', 'dk1'),
		mapped('bg2', 'lt2'),
		mapped('tx2', 'dk2'),
		'accent1',
		'accent2',
		'hlink',
		'folHlink',
	];
	const colors = slots.map((slot) => themeColor(themeXml, slot)?.toUpperCase());
	return colors.every((c): c is string => c !== undefined) ? colors : undefined;
}

/** A font scheme entry's Latin typeface. */
function latinFace(themeXml: string, scheme: 'majorFont' | 'minorFont'): string | undefined {
	const open = themeXml.indexOf(`<a:${scheme}>`);
	const close = open < 0 ? -1 : themeXml.indexOf(`</a:${scheme}>`, open);
	const body = close < 0 ? undefined : themeXml.slice(open, close);
	return (body && /<a:latin [^>]*typeface="([^"]+)"/u.exec(body)?.[1]) || undefined;
}

/** Read the first slide's master (and its theme) out of a saved `.pptx`. */
export async function readMasterRoundTripSource(zip: JSZip): Promise<MasterRoundTripSource> {
	const masterPath = await firstSlideMasterPath(zip);
	const masterXml = await readText(zip, masterPath);
	if (!masterXml) {
		return { placeholders: [], themeFonts: {} };
	}
	const clrMapAttributes = /<p:clrMap\b([^>]*?)\/?>/u.exec(masterXml)?.[1]?.trim();
	const themePath = await followRel(zip, masterPath, 'theme');
	const themeXml = themePath ? await readText(zip, themePath) : undefined;
	return {
		placeholders: readPlaceholders(masterXml),
		txStylesXml: readTxStyles(masterXml),
		clrMapAttributes,
		themeXml,
		schemeColors: themeXml ? schemeColorsFor(themeXml, clrMapAttributes) : undefined,
		themeFonts: {
			major: themeXml ? latinFace(themeXml, 'majorFont') : undefined,
			minor: themeXml ? latinFace(themeXml, 'minorFont') : undefined,
		},
	};
}
