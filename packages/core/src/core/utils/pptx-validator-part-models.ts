import type JSZip from 'jszip';

import {
	directChildren,
	elementXml,
	rootAttributes,
	rootTag,
} from './pptx-validator-conformance-xml';
import { readZipText } from './pptx-validator-helpers';
import type { ValidationIssue } from './pptx-validator-types';

interface PartContract {
	path: RegExp;
	root: string;
	required?: string[];
}

const CONTRACTS: PartContract[] = [
	{
		path: /^ppt\/slideMasters\/slideMaster\d+\.xml$/,
		root: 'sldMaster',
		required: ['cSld', 'clrMap'],
	},
	{ path: /^ppt\/slideLayouts\/slideLayout\d+\.xml$/, root: 'sldLayout', required: ['cSld'] },
	{
		path: /^ppt\/notesMasters\/notesMaster\d+\.xml$/,
		root: 'notesMaster',
		required: ['cSld', 'clrMap'],
	},
	{
		path: /^ppt\/notesSlides\/notesSlide\d+\.xml$/,
		root: 'notes',
		required: ['cSld'],
	},
	{
		path: /^ppt\/handoutMasters\/handoutMaster\d+\.xml$/,
		root: 'handoutMaster',
		required: ['cSld', 'clrMap'],
	},
	{ path: /^ppt\/theme\/theme\d+\.xml$/, root: 'theme', required: ['themeElements'] },
	{ path: /^ppt\/charts\/chart\d+\.xml$/, root: 'chartSpace', required: ['chart'] },
	{ path: /^ppt\/diagrams\/data\d+\.xml$/, root: 'dataModel', required: ['ptLst'] },
	{ path: /^ppt\/diagrams\/layout\d+\.xml$/, root: 'layoutDef', required: ['layoutNode'] },
	{ path: /^ppt\/diagrams\/quickStyle\d+\.xml$/, root: 'styleDef', required: ['styleLbl'] },
	{ path: /^ppt\/diagrams\/colors\d+\.xml$/, root: 'colorsDef' },
	{ path: /^ppt\/comments\/comment\d+\.xml$/, root: 'cmLst' },
	{ path: /^ppt\/commentAuthors\.xml$/, root: 'cmAuthorLst' },
	{ path: /^ppt\/presProps\.xml$/, root: 'presentationPr' },
	{ path: /^ppt\/viewProps\.xml$/, root: 'viewPr' },
	{ path: /^ppt\/tableStyles\.xml$/, root: 'tblStyleLst' },
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

function validateSpecialRules(
	xml: string,
	contract: PartContract,
	path: string,
	issues: ValidationIssue[],
): void {
	if (contract.root === 'theme') {
		validateThemeElements(xml, path, issues);
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
		validateRequiredChildren(xml, contract, path, issues);
		validateSpecialRules(xml, contract, path, issues);
	}
}
