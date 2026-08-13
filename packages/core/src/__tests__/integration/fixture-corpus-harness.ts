/**
 * The mechanics behind `fixture-corpus-roundtrip.test.ts`.
 *
 * Everything here operates on real bytes: a fixture is read from disk, pushed
 * through the public `PptxHandler` API, and the resulting archive is inspected
 * as a package rather than as a model. That distinction is the whole point. A
 * model-level assertion cannot see a duplicated `<p:transition>`, a shape tree
 * regrouped by tag, or a `val="true"` that lost its value, because re-parsing
 * our own output forgives all three.
 *
 * @module __tests__/integration/fixture-corpus-harness
 */
import { readFileSync } from 'node:fs';

import { XMLValidator } from 'fast-xml-parser';
import JSZip from 'jszip';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxSlide } from '../../core/types/presentation';
import { validatePptx } from '../../core/utils/pptx-validator';
import type { ValidationIssue } from '../../core/utils/pptx-validator';
import { fixturePath } from './fixture-corpus-manifest';
import type { FixtureEntry } from './fixture-corpus-manifest';

export function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

export function readFixture(entry: FixtureEntry): ArrayBuffer {
	return toArrayBuffer(readFileSync(fixturePath(entry)));
}

export interface RoundTrip {
	readonly originalBytes: ArrayBuffer;
	readonly savedBytes: ArrayBuffer;
	readonly original: PptxSlide[];
	readonly reloaded: PptxSlide[];
	readonly before: JSZip;
	readonly after: JSZip;
}

/** Load a fixture, save it unmodified, reload the saved bytes, keep both zips. */
export async function roundTrip(entry: FixtureEntry): Promise<RoundTrip> {
	const originalBytes = readFixture(entry);
	const handler = new PptxHandler();
	const original = (await handler.load(originalBytes)).slides;
	const saved = await handler.save(original);
	const savedBytes = toArrayBuffer(saved);
	const reloaded = (await new PptxHandler().load(savedBytes)).slides;
	return {
		originalBytes,
		savedBytes,
		original,
		reloaded,
		before: await JSZip.loadAsync(originalBytes),
		after: await JSZip.loadAsync(savedBytes),
	};
}

/** Every non-directory entry in a package, sorted. */
export function partNames(zip: JSZip): string[] {
	return Object.keys(zip.files)
		.filter((name) => !zip.files[name].dir)
		.sort();
}

const XML_PART = /\.(?:xml|rels)$/i;

/**
 * Parts that are not well-formed XML, using fast-xml-parser's strict validator
 * rather than a regex, so unbalanced tags, bad entities and duplicated
 * attributes are all caught.
 */
export async function malformedParts(zip: JSZip): Promise<string[]> {
	const bad: string[] = [];
	for (const name of partNames(zip).filter((n) => XML_PART.test(n))) {
		const xml = await zip.file(name)!.async('string');
		const result = XMLValidator.validate(xml, { allowBooleanAttributes: false });
		if (result !== true) {
			bad.push(`${name}: ${result.err.code} ${result.err.msg} (line ${result.err.line})`);
		}
	}
	return bad;
}

/** Error-severity issues from the in-repo package validator. */
export async function validationErrors(bytes: ArrayBuffer): Promise<ValidationIssue[]> {
	return (await validatePptx(bytes)).issues.filter((issue) => issue.severity === 'error');
}

/** Compact `CODE path: message` lines, for a readable assertion failure. */
export function describeIssues(issues: readonly ValidationIssue[]): string[] {
	return issues.map((i) => `${i.code} ${i.path ?? ''}: ${i.message}`);
}

/** Slide part paths in `ppt/slides/`, numerically ordered. */
export function slidePartPaths(zip: JSZip): string[] {
	return partNames(zip)
		.filter((n) => /^ppt\/slides\/slide\d+\.xml$/.test(n))
		.sort((a, b) => Number(/(\d+)/.exec(a)![1]) - Number(/(\d+)/.exec(b)![1]));
}

/** Every `p:sldLayout` / `p:sldMaster` part path. */
export function templatePartPaths(zip: JSZip): string[] {
	return partNames(zip).filter((n) =>
		/^ppt\/(?:slideLayouts\/slideLayout|slideMasters\/slideMaster)\d+\.xml$/.test(n),
	);
}

/**
 * The tag sequence of the DIRECT children of `<p:spTree>`, which is the paint
 * order of the slide. fast-xml-parser is configured without `preserveOrder`,
 * so this has to be read off the raw markup: a parsed model has already lost
 * the interleaving.
 */
export function spTreeChildOrder(xml: string): string[] {
	const start = xml.indexOf('<p:spTree');
	if (start < 0) {
		return [];
	}
	const tagRe = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
	tagRe.lastIndex = xml.indexOf('>', start) + 1;
	const order: string[] = [];
	let depth = 0;
	let match: RegExpExecArray | null;
	while ((match = tagRe.exec(xml))) {
		const [, closing, tag, , selfClosing] = match;
		if (closing) {
			if (depth === 0 && tag === 'p:spTree') {
				break;
			}
			depth--;
			continue;
		}
		if (depth === 0) {
			order.push(tag);
		}
		if (!selfClosing) {
			depth++;
		}
	}
	return order;
}

/**
 * The shape-bearing children of `<p:spTree>` at EVERY depth, each tagged with
 * its nesting level, so the sequence inside a `p:grpSp` is compared too.
 *
 * {@link spTreeChildOrder} only sees the top level, which is enough for the
 * classic z-order defect but blind to a group whose own children get regrouped
 * by tag. Paint order applies at every depth, not just the outermost one.
 *
 * `mc:AlternateContent` counts as a child here: an envelope that is unwrapped
 * on save changes the sequence, and that is exactly the defect
 * `template-mce.pptx` exists to witness.
 */
export function spTreeDeepChildOrder(xml: string): string[] {
	const start = xml.indexOf('<p:spTree');
	if (start < 0) {
		return [];
	}
	const shapeLike =
		/^(?:p:sp|p:pic|p:cxnSp|p:graphicFrame|p:grpSp|p:contentPart|mc:AlternateContent)$/;
	const tagRe = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
	tagRe.lastIndex = xml.indexOf('>', start) + 1;
	const order: string[] = [];
	let depth = 0;
	let match: RegExpExecArray | null;
	while ((match = tagRe.exec(xml))) {
		const [, closing, tag, , selfClosing] = match;
		if (closing) {
			if (depth === 0 && tag === 'p:spTree') {
				break;
			}
			depth--;
			continue;
		}
		if (shapeLike.test(tag)) {
			order.push(`${depth}:${tag}`);
		}
		if (!selfClosing) {
			depth++;
		}
	}
	return order;
}

/** Count of `<tag>` occurrences (open or self-closing) in a raw part. */
export function countTag(xml: string, tag: string): number {
	return (xml.match(new RegExp(`<${tag.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s/>]`, 'g')) ?? [])
		.length;
}

/** Direct children of `<p:sld>`, so `CT_Slide` cardinality can be asserted. */
export function slideChildTags(xml: string): string[] {
	const start = xml.indexOf('<p:sld ');
	if (start < 0) {
		return [];
	}
	const tagRe = /<(\/?)([A-Za-z_][\w.:-]*)([^>]*?)(\/?)>/g;
	tagRe.lastIndex = xml.indexOf('>', start) + 1;
	const tags: string[] = [];
	let depth = 0;
	let match: RegExpExecArray | null;
	while ((match = tagRe.exec(xml))) {
		const [, closing, tag, , selfClosing] = match;
		if (closing) {
			if (depth === 0 && tag === 'p:sld') {
				break;
			}
			depth--;
			continue;
		}
		if (depth === 0) {
			tags.push(tag);
		}
		if (!selfClosing) {
			depth++;
		}
	}
	return tags;
}

/** The root element's qualified name, ignoring the XML declaration. */
export function rootElement(xml: string): string | undefined {
	return /<([A-Za-z_][\w.:-]*)[\s/>]/.exec(xml.replace(/<\?[^?]*\?>/g, ''))?.[1];
}

/** Content-type overrides declared in `[Content_Types].xml`, by part name. */
export async function contentTypeOverrides(zip: JSZip): Promise<Map<string, string>> {
	const xml = (await zip.file('[Content_Types].xml')?.async('string')) ?? '';
	const map = new Map<string, string>();
	for (const m of xml.matchAll(/<Override\s+PartName="([^"]+)"\s+ContentType="([^"]+)"/g)) {
		map.set(m[1].replace(/^\//, ''), m[2]);
	}
	return map;
}

/** Relationship ids declared by a `.rels` part. */
export async function relationshipIds(zip: JSZip, relsPath: string): Promise<string[]> {
	const xml = (await zip.file(relsPath)?.async('string')) ?? '';
	return [...xml.matchAll(/<Relationship\b[^>]*\bId="([^"]+)"/g)].map((m) => m[1]).sort();
}

/**
 * A chart part whose declared content type disagrees with the namespace of its
 * root element.
 *
 * This is the exact shape of the corruption that made `chart-gallery.pptx`
 * un-openable in PowerPoint before we ever touched it: four `cx:chartSpace`
 * (2014 chartex) parts were declared as classic `drawingml.chart+xml`, so
 * PowerPoint validated them against the `c:` schema and refused the package.
 * It costs nothing to check and it is invisible at the model level.
 */
export async function chartFlavourMismatches(zip: JSZip): Promise<string[]> {
	const overrides = await contentTypeOverrides(zip);
	const problems: string[] = [];
	for (const name of partNames(zip).filter((n) => /^ppt\/charts\/chart\d+\.xml$/.test(n))) {
		const xml = await zip.file(name)!.async('string');
		const prefix = rootElement(xml)?.split(':')[0] ?? '';
		const isChartEx = new RegExp(`xmlns:${prefix}="[^"]*2014/chartex"`).test(xml);
		const declared = overrides.get(name) ?? '(none)';
		const expected = isChartEx
			? 'application/vnd.ms-office.chartex+xml'
			: 'application/vnd.openxmlformats-officedocument.drawingml.chart+xml';
		if (declared !== expected) {
			problems.push(
				`${name}: root is ${isChartEx ? 'cx:' : 'c:'}chartSpace but declared ${declared}`,
			);
		}
	}
	return problems;
}
