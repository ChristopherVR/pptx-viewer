import type JSZip from 'jszip';

import {
	directChildren,
	ECMA_NAMESPACES,
	elementXml,
	namespaces,
	rootAttributes,
	rootTag,
} from './pptx-validator-conformance-xml';
import { readZipText } from './pptx-validator-helpers';
import type { ValidationIssue } from './pptx-validator-types';

interface PartContract {
	path: RegExp;
	root: string;
	namespace: 'p' | 'a' | 'c' | 'd';
	required?: string[];
}

const PART_NAMESPACES = {
	p: [ECMA_NAMESPACES.transitionalP, ECMA_NAMESPACES.strictP],
	a: [ECMA_NAMESPACES.transitionalA, ECMA_NAMESPACES.strictA],
	c: [
		'http://schemas.openxmlformats.org/drawingml/2006/chart',
		'http://purl.oclc.org/ooxml/drawingml/chart',
	],
	d: [
		'http://schemas.openxmlformats.org/drawingml/2006/diagram',
		'http://purl.oclc.org/ooxml/drawingml/diagram',
	],
} as const;

const CONTRACTS: PartContract[] = [
	{
		path: /^ppt\/slideMasters\/slideMaster\d+\.xml$/,
		root: 'sldMaster',
		namespace: 'p',
		required: ['cSld', 'clrMap'],
	},
	{
		path: /^ppt\/slideLayouts\/slideLayout\d+\.xml$/,
		root: 'sldLayout',
		namespace: 'p',
		required: ['cSld'],
	},
	{
		path: /^ppt\/notesMasters\/notesMaster\d+\.xml$/,
		root: 'notesMaster',
		namespace: 'p',
		required: ['cSld', 'clrMap'],
	},
	{
		path: /^ppt\/notesSlides\/notesSlide\d+\.xml$/,
		root: 'notes',
		namespace: 'p',
		required: ['cSld'],
	},
	{
		path: /^ppt\/handoutMasters\/handoutMaster\d+\.xml$/,
		root: 'handoutMaster',
		namespace: 'p',
		required: ['cSld', 'clrMap'],
	},
	{
		path: /^ppt\/theme\/theme\d+\.xml$/,
		root: 'theme',
		namespace: 'a',
		required: ['themeElements'],
	},
	{ path: /^ppt\/charts\/chart\d+\.xml$/, root: 'chartSpace', namespace: 'c', required: ['chart'] },
	{ path: /^ppt\/diagrams\/data\d+\.xml$/, root: 'dataModel', namespace: 'd', required: ['ptLst'] },
	{
		path: /^ppt\/diagrams\/layout\d+\.xml$/,
		root: 'layoutDef',
		namespace: 'd',
		required: ['layoutNode'],
	},
	{
		path: /^ppt\/diagrams\/quickStyle\d+\.xml$/,
		root: 'styleDef',
		namespace: 'd',
		required: ['styleLbl'],
	},
	{ path: /^ppt\/diagrams\/colors\d+\.xml$/, root: 'colorsDef', namespace: 'd' },
	{ path: /^ppt\/comments\/comment\d+\.xml$/, root: 'cmLst', namespace: 'p' },
	{ path: /^ppt\/commentAuthors\.xml$/, root: 'cmAuthorLst', namespace: 'p' },
	{ path: /^ppt\/presProps\.xml$/, root: 'presentationPr', namespace: 'p' },
	{ path: /^ppt\/viewProps\.xml$/, root: 'viewPr', namespace: 'p' },
	{ path: /^ppt\/tableStyles\.xml$/, root: 'tblStyleLst', namespace: 'a' },
];

function add(issues: ValidationIssue[], path: string, code: string, message: string): void {
	issues.push({ severity: 'error', code, message, path });
}

function validateRequiredChildren(
	xml: string,
	contract: PartContract,
	path: string,
	issues: ValidationIssue[],
): void {
	const children = directChildren(xml);
	for (const required of contract.required ?? []) {
		if (!children.includes(required)) {
			add(
				issues,
				path,
				'MISSING_REQUIRED_PART_ELEMENT',
				`<${contract.root}> must contain <${required}> as a direct child`,
			);
		}
	}
}

function validateThemeElements(xml: string, path: string, issues: ValidationIssue[]): void {
	const elements = elementXml(xml, 'themeElements');
	if (!elements) {
		return;
	}
	const children = directChildren(elements);
	for (const required of ['clrScheme', 'fontScheme', 'fmtScheme']) {
		if (!children.includes(required)) {
			add(
				issues,
				path,
				'MISSING_REQUIRED_PART_ELEMENT',
				`<themeElements> must contain <${required}>`,
			);
		}
	}
}

function attributeValue(attributes: string, name: string): string | undefined {
	return attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`))?.[1];
}

function elementStartAttributes(xml: string, localName: string): string[] {
	return [...xml.matchAll(new RegExp(`<(?:[\\w.-]+:)?${localName}\\b([^>]*)>`, 'g'))].map(
		(match) => match[1],
	);
}

function validateRequiredAttributes(
	attributes: string,
	required: string[],
	element: string,
	path: string,
	issues: ValidationIssue[],
): void {
	for (const name of required) {
		if (attributeValue(attributes, name) === undefined) {
			add(
				issues,
				path,
				'MISSING_REQUIRED_PART_ATTRIBUTE',
				`<${element}> must have a ${name} attribute`,
			);
		}
	}
}

function validateComments(xml: string, path: string, issues: ValidationIssue[]): void {
	const ids = new Set<string>();
	for (const attributes of elementStartAttributes(xml, 'cm')) {
		validateRequiredAttributes(attributes, ['authorId', 'dt', 'idx'], 'cm', path, issues);
		const authorId = attributeValue(attributes, 'authorId');
		const idx = attributeValue(attributes, 'idx');
		if (authorId !== undefined && idx !== undefined) {
			const key = `${authorId}:${idx}`;
			if (ids.has(key)) {
				add(
					issues,
					path,
					'DUPLICATE_COMMENT_INDEX',
					`Comment index ${idx} is duplicated for author ${authorId}`,
				);
			}
			ids.add(key);
		}
	}
	for (const comment of xml.matchAll(/<(?:[\w.-]+:)?cm\b[^>]*>([\s\S]*?)<\/(?:[\w.-]+:)?cm>/g)) {
		const children = directChildren(`<cm>${comment[1]}</cm>`);
		if (!children.includes('pos') || !children.includes('text')) {
			add(issues, path, 'MISSING_REQUIRED_PART_ELEMENT', '<cm> must contain <pos> and <text>');
		}
	}
}

function validateCommentAuthors(xml: string, path: string, issues: ValidationIssue[]): void {
	const ids = new Set<string>();
	for (const attributes of elementStartAttributes(xml, 'cmAuthor')) {
		validateRequiredAttributes(
			attributes,
			['id', 'name', 'initials', 'lastIdx', 'clrIdx'],
			'cmAuthor',
			path,
			issues,
		);
		const id = attributeValue(attributes, 'id');
		if (id !== undefined && ids.has(id)) {
			add(issues, path, 'DUPLICATE_COMMENT_AUTHOR_ID', `Comment author id ${id} is duplicated`);
		}
		if (id !== undefined) {
			ids.add(id);
		}
	}
}

function validateSpecialRules(
	xml: string,
	contract: PartContract,
	path: string,
	issues: ValidationIssue[],
): void {
	if (contract.root === 'theme') {
		validateThemeElements(xml, path, issues);
	}
	if (contract.root === 'cmLst') {
		validateComments(xml, path, issues);
	}
	if (contract.root === 'cmAuthorLst') {
		validateCommentAuthors(xml, path, issues);
	}
	if (contract.root === 'tblStyleLst' && !/\bdef\s*=\s*["'][^"']+["']/.test(rootAttributes(xml))) {
		add(
			issues,
			path,
			'MISSING_REQUIRED_PART_ATTRIBUTE',
			'<tblStyleLst> must have a non-empty def attribute',
		);
	}
}

export async function validatePartModels(zip: JSZip, issues: ValidationIssue[]): Promise<void> {
	for (const path of Object.keys(zip.files).filter((entry) => entry.endsWith('.xml'))) {
		const contract = CONTRACTS.find((candidate) => candidate.path.test(path));
		if (!contract) {
			continue;
		}
		const xml = await readZipText(zip, path);
		if (!xml) {
			continue;
		}
		const actualRoot = rootTag(xml)?.split(':').pop();
		if (actualRoot !== contract.root) {
			add(
				issues,
				path,
				'INVALID_PART_ROOT',
				`Part must have <${contract.root}> root, found <${actualRoot ?? 'none'}>`,
			);
			continue;
		}
		const rootPrefix = rootTag(xml)?.includes(':') ? rootTag(xml)!.split(':')[0] : '';
		const rootNamespace = namespaces(xml).get(rootPrefix);
		if (!(PART_NAMESPACES[contract.namespace] as readonly string[]).includes(rootNamespace ?? '')) {
			add(
				issues,
				path,
				'INVALID_PART_ROOT_NAMESPACE',
				`<${contract.root}> uses unexpected namespace "${rootNamespace ?? ''}"`,
			);
			continue;
		}
		validateRequiredChildren(xml, contract, path, issues);
		validateSpecialRules(xml, contract, path, issues);
	}
}
