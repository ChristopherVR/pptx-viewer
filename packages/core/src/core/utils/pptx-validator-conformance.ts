import type JSZip from 'jszip';

import {
	directChildren,
	ECMA_NAMESPACES as NS,
	elementXml,
	namespaces,
	rootAttributes,
	rootTag,
} from './pptx-validator-conformance-xml';
import { readZipText } from './pptx-validator-helpers';
import type { ValidationConformance, ValidationIssue } from './pptx-validator-types';

type Dialect = ValidationConformance['dialect'];

const PRESENTATION_ORDER = [
	'sldMasterIdLst',
	'notesMasterIdLst',
	'handoutMasterIdLst',
	'sldIdLst',
	'sldSz',
	'notesSz',
	'smartTags',
	'embeddedFontLst',
	'custShowLst',
	'photoAlbum',
	'custDataLst',
	'kiosk',
	'defaultTextStyle',
	'modifyVerifier',
	'extLst',
];
const SLIDE_ORDER = ['cSld', 'clrMapOvr', 'transition', 'timing', 'extLst'];
const COMMON_SLIDE_ORDER = ['bg', 'spTree', 'custDataLst', 'controls', 'extLst'];
const SHAPE_TREE_START = ['nvGrpSpPr', 'grpSpPr'];

function issue(
	issues: ValidationIssue[],
	path: string,
	code: string,
	message: string,
	severity: ValidationIssue['severity'] = 'error',
): void {
	issues.push({ severity, code, message, path });
}

function validateOrder(
	xml: string,
	allowed: string[],
	path: string,
	context: string,
	issues: ValidationIssue[],
): void {
	let last = -1;
	for (const child of directChildren(xml)) {
		const index = allowed.indexOf(child);
		if (index < 0) {
			continue;
		}
		if (index < last) {
			issue(
				issues,
				path,
				'INVALID_CONTENT_ORDER',
				`${context} child <${child}> is out of ECMA-376 sequence order`,
			);
			return;
		}
		last = index;
	}
}

function validateShapeTree(xml: string, path: string, issues: ValidationIssue[]): void {
	const tree = elementXml(xml, 'spTree');
	if (!tree) {
		issue(issues, path, 'MISSING_REQUIRED_ELEMENT', '<p:cSld> must contain <p:spTree>');
		return;
	}
	const children = directChildren(tree);
	for (let i = 0; i < SHAPE_TREE_START.length; i++) {
		if (children[i] !== SHAPE_TREE_START[i]) {
			issue(
				issues,
				path,
				'INVALID_SHAPE_TREE',
				`<p:spTree> child ${i + 1} must be <p:${SHAPE_TREE_START[i]}>`,
			);
		}
	}
}

function validatePresentation(xml: string, path: string, issues: ValidationIssue[]): void {
	if (!/:presentation\b/.test(rootTag(xml) ?? '')) {
		issue(
			issues,
			path,
			'INVALID_PRESENTATION_ROOT',
			'Presentation part must have a p:presentation root',
		);
		return;
	}
	validateOrder(xml, PRESENTATION_ORDER, path, '<p:presentation>', issues);
	for (const match of xml.matchAll(/<p:sldMasterId\b[^>]*\sid\s*=\s*["']([^"']+)["']/g)) {
		const value = Number(match[1]);
		if (!Number.isInteger(value) || value < 2147483648 || value > 4294967295) {
			issue(
				issues,
				path,
				'INVALID_DATATYPE',
				`Slide master id "${match[1]}" is not an unsigned integer from 2147483648 through 4294967295`,
			);
		}
	}
	for (const match of xml.matchAll(/<p:sldId\b[^>]*\sid\s*=\s*["']([^"']+)["']/g)) {
		const value = Number(match[1]);
		if (!Number.isInteger(value) || value < 256 || value > 2147483647) {
			issue(
				issues,
				path,
				'INVALID_DATATYPE',
				`Slide id "${match[1]}" is outside the ECMA-376 range 256 through 2147483647`,
			);
		}
	}
}

function validateSlide(xml: string, path: string, issues: ValidationIssue[]): void {
	if (!/:sld\b/.test(rootTag(xml) ?? '')) {
		issue(issues, path, 'INVALID_SLIDE_ROOT', 'Slide part must have a p:sld root');
		return;
	}
	validateOrder(xml, SLIDE_ORDER, path, '<p:sld>', issues);
	const common = elementXml(xml, 'cSld');
	if (!common) {
		issue(issues, path, 'MISSING_REQUIRED_ELEMENT', '<p:sld> must contain <p:cSld>');
	} else {
		validateOrder(common, COMMON_SLIDE_ORDER, path, '<p:cSld>', issues);
		validateShapeTree(common, path, issues);
	}
}

function validateDrawingDatatypes(xml: string, path: string, issues: ValidationIssue[]): void {
	for (const match of xml.matchAll(/<a:srgbClr\b[^>]*\bval\s*=\s*["']([^"']+)["']/g)) {
		if (!/^[0-9A-Fa-f]{6}$/.test(match[1])) {
			issue(
				issues,
				path,
				'INVALID_DATATYPE',
				`DrawingML sRGB colour "${match[1]}" must contain exactly six hexadecimal digits`,
			);
		}
	}
	for (const match of xml.matchAll(/<a:ext\b([^>]*)>/g)) {
		for (const attr of ['cx', 'cy']) {
			const value = match[1].match(new RegExp(`\\b${attr}\\s*=\\s*["']([^"']+)["']`))?.[1];
			if (value !== undefined && (!/^\d+$/.test(value) || Number(value) > 27273042329600)) {
				issue(
					issues,
					path,
					'INVALID_DATATYPE',
					`DrawingML extent ${attr}="${value}" must be a non-negative coordinate`,
				);
			}
		}
	}
}

function validateMce(xml: string, path: string, issues: ValidationIssue[]): void {
	const ns = namespaces(xml);
	const mcPrefixes = [...ns].filter(([, uri]) => uri === NS.mce).map(([prefix]) => prefix);
	const hasMceMarkup = /\bmc:|<mc:/.test(xml);
	if (hasMceMarkup && !mcPrefixes.length) {
		issue(
			issues,
			path,
			'UNDECLARED_MCE_NAMESPACE',
			'Markup Compatibility markup uses mc without declaring the MCE namespace',
		);
	}
	for (const match of rootAttributes(xml).matchAll(
		/\bmc:(Ignorable|ProcessContent|PreserveElements|PreserveAttributes)\s*=\s*["']([^"']*)["']/g,
	)) {
		for (const token of match[2].trim().split(/\s+/).filter(Boolean)) {
			const prefix = token.includes(':') ? token.split(':')[0] : token;
			if (!ns.has(prefix)) {
				issue(
					issues,
					path,
					'MCE_UNDECLARED_PREFIX',
					`mc:${match[1]} references undeclared prefix "${prefix}"`,
				);
			}
		}
	}
	for (const match of xml.matchAll(/<mc:Choice\b([^>]*)>/g)) {
		const requires = match[1].match(/\bRequires\s*=\s*["']([^"']*)["']/)?.[1].trim();
		if (!requires) {
			issue(
				issues,
				path,
				'MCE_MISSING_REQUIRES',
				'<mc:Choice> must have a non-empty Requires attribute',
			);
		} else {
			for (const prefix of requires.split(/\s+/)) {
				if (!ns.has(prefix)) {
					issue(
						issues,
						path,
						'MCE_UNDECLARED_PREFIX',
						`mc:Choice Requires references undeclared prefix "${prefix}"`,
					);
				}
			}
		}
	}
	for (const block of xml.matchAll(
		/<mc:AlternateContent\b[^>]*>([\s\S]*?)<\/mc:AlternateContent>/g,
	)) {
		const children = directChildren(`<root>${block[1]}</root>`);
		const fallback = children.indexOf('Fallback');
		if (!children.includes('Choice')) {
			issue(
				issues,
				path,
				'MCE_INVALID_ALTERNATE_CONTENT',
				'<mc:AlternateContent> must contain at least one <mc:Choice>',
			);
		}
		if (
			children.filter((name) => name === 'Fallback').length > 1 ||
			(fallback >= 0 && fallback !== children.length - 1)
		) {
			issue(
				issues,
				path,
				'MCE_INVALID_ALTERNATE_CONTENT',
				'<mc:Fallback> must occur at most once and after all <mc:Choice> elements',
			);
		}
	}
}

function dialectFor(xml: string): Dialect {
	const values = new Set(namespaces(xml).values());
	const strict = [NS.strictP, NS.strictA, NS.strictR].some((uri) => values.has(uri));
	const transitional = [NS.transitionalP, NS.transitionalA, NS.transitionalR].some((uri) =>
		values.has(uri),
	);
	if (strict && !transitional) {
		return 'strict';
	}
	if (transitional && !strict) {
		return 'transitional';
	}
	if (strict && transitional) {
		return 'mixed';
	}
	return 'unknown';
}

export async function validateEcmaRules(
	zip: JSZip,
	issues: ValidationIssue[],
): Promise<ValidationConformance> {
	const dialects = new Set<Dialect>();
	const paths = Object.keys(zip.files).filter(
		(path) => /^ppt\/.*\.xml$/.test(path) && !zip.files[path].dir,
	);
	for (const path of paths) {
		const xml = await readZipText(zip, path);
		if (!xml) {
			continue;
		}
		const dialect = dialectFor(xml);
		if (dialect !== 'unknown') {
			dialects.add(dialect);
		}
		validateMce(xml, path, issues);
		validateDrawingDatatypes(xml, path, issues);
		if (path === 'ppt/presentation.xml') {
			validatePresentation(xml, path, issues);
		}
		if (/^ppt\/slides\/slide\d+\.xml$/.test(path)) {
			validateSlide(xml, path, issues);
		}
	}
	const dialect: Dialect =
		dialects.has('mixed') || dialects.size > 1 ? 'mixed' : ([...dialects][0] ?? 'unknown');
	if (dialect === 'mixed') {
		issue(
			issues,
			'ppt/',
			'MIXED_CONFORMANCE_DIALECT',
			'Package mixes Strict and Transitional PresentationML or DrawingML namespaces',
		);
	}
	return {
		level: 'rule-checked',
		dialect,
		description:
			'Package, namespace, MCE, and selected ECMA-376 content-model/datatype rules checked; this is not exhaustive XSD validation.',
	};
}
