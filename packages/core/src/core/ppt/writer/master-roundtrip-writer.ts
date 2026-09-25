/**
 * Serialises the main master's round-trip atoms the way PowerPoint 2007+
 * writes them into a 97-2003 `.ppt` (measured against its own SaveAs
 * format 1 of the same deck):
 *
 * - RoundTripOArtTextStyles12Atom: a zipped package whose root part
 *   `drs/slideMasters/slideMaster1.xml` is the master's bare `p:txStyles`;
 * - RoundTripTheme12Atom: a zipped package `theme/theme/themeManager.xml`
 *   (an empty `a:themeManager`) relating to `theme/theme/theme1.xml`;
 * - RoundTripColorMapping12Atom: the master's `a:clrMap` as plain XML.
 *
 * COM-measured, PowerPoint takes the theme's fonts and effects from these
 * (without them it synthesises a theme from the binary records); the colour
 * scheme it reports comes from the ColorSchemeAtom, which the writer derives
 * from the same theme.
 *
 * @module ppt/writer/master-roundtrip-writer
 */

import JSZip from 'jszip';

import { readMasterRoundTripSource } from './master-roundtrip-source';
import type { MasterRoundTripSource } from './master-roundtrip-source';
import type { WMasterRoundTrip } from './write-model';

const XML_DECL = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const CT_NS = 'http://schemas.openxmlformats.org/package/2006/content-types';
const REL_NS = 'http://schemas.openxmlformats.org/package/2006/relationships';
const OFFICE_REL = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';
const A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main';
const PML_CT = 'application/vnd.openxmlformats-officedocument';

function contentTypes(overrides: Array<[string, string]>): string {
	const parts = overrides
		.map(([name, type]) => `<Override PartName="/${name}" ContentType="${PML_CT}.${type}"/>`)
		.join('');
	return (
		`${XML_DECL}\r\n<Types xmlns="${CT_NS}"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
		`<Default Extension="xml" ContentType="application/xml"/>${parts}</Types>`
	);
}

function relationships(type: string, target: string): string {
	return `${XML_DECL}\r\n<Relationships xmlns="${REL_NS}"><Relationship Id="rId1" Type="${OFFICE_REL}/${type}" Target="${target}"/></Relationships>`;
}

function withDeclaration(xml: string): string {
	const body = xml.replace(/^﻿?<\?xml[^>]*\?>\s*/u, '');
	return `${XML_DECL}\r\n${body}`;
}

async function zipParts(parts: Array<[string, string]>): Promise<Uint8Array> {
	const zip = new JSZip();
	for (const [name, text] of parts) {
		zip.file(name, text);
	}
	return zip.generateAsync({ type: 'uint8array', compression: 'DEFLATE' });
}

/** Zipped `p:txStyles` package (RoundTripOArtTextStyles12Atom payload). */
export function buildOArtTextStylesPackage(txStylesXml: string): Promise<Uint8Array> {
	const part = 'drs/slideMasters/slideMaster1.xml';
	return zipParts([
		['[Content_Types].xml', contentTypes([[part, 'presentationml.slideMaster+xml']])],
		['_rels/.rels', relationships('slideMaster', part)],
		[part, withDeclaration(txStylesXml)],
	]);
}

/** Zipped theme package (RoundTripTheme12Atom payload). */
export function buildThemePackage(themeXml: string): Promise<Uint8Array> {
	const manager = 'theme/theme/themeManager.xml';
	return zipParts([
		[
			'[Content_Types].xml',
			contentTypes([
				[manager, 'themeManager+xml'],
				['theme/theme/theme1.xml', 'theme+xml'],
			]),
		],
		['_rels/.rels', relationships('officeDocument', manager)],
		[manager, `${XML_DECL}\r\n<a:themeManager xmlns:a="${A_NS}"/>`],
		['theme/theme/_rels/themeManager.xml.rels', relationships('theme', 'theme1.xml')],
		['theme/theme/theme1.xml', withDeclaration(themeXml)],
	]);
}

/** `a:clrMap` XML (RoundTripColorMapping12Atom payload). */
export function buildColorMapping(clrMapAttributes: string): Uint8Array {
	const attributes = clrMapAttributes.replace(/\s*xmlns(?::\w+)?="[^"]*"/gu, '').trim();
	return new TextEncoder().encode(`${XML_DECL}\r\n<a:clrMap xmlns:a="${A_NS}" ${attributes}/>`);
}

/** Serialise everything `source` holds into the writer's master model. */
export async function buildMasterRoundTrip(
	source: MasterRoundTripSource,
): Promise<WMasterRoundTrip> {
	return {
		placeholders: source.placeholders,
		schemeColors: source.schemeColors,
		themeFonts: source.themeFonts,
		oartTextStyles: source.txStylesXml
			? await buildOArtTextStylesPackage(source.txStylesXml)
			: undefined,
		theme: source.themeXml ? await buildThemePackage(source.themeXml) : undefined,
		colorMapping: source.clrMapAttributes ? buildColorMapping(source.clrMapAttributes) : undefined,
	};
}

/** Read the first slide's master out of a saved `.pptx` and serialise it for the `.ppt` master. */
export async function buildMasterRoundTripFromPptx(
	pptxBytes: Uint8Array,
): Promise<WMasterRoundTrip> {
	return buildMasterRoundTrip(await readMasterRoundTripSource(await JSZip.loadAsync(pptxBytes)));
}
