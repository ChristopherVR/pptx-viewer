import { allNamespaceDeclarations, ECMA_NAMESPACES } from './pptx-validator-conformance-xml';
import {
	BLACK_WHITE,
	ENUMS,
	FIXED_PERCENT,
	POSITIVE_PERCENT,
} from './pptx-validator-facet-constants';
import type { ValidationIssue } from './pptx-validator-types';

interface XmlElement {
	local: string;
	prefix: string;
	attributes: string;
}

function elements(xml: string): XmlElement[] {
	return [...xml.matchAll(/<(?!\/|\?|!)(?:([\w.-]+):)?([\w.-]+)\b([^>]*)>/g)].map((match) => ({
		prefix: match[1] ?? '',
		local: match[2],
		attributes: match[3],
	}));
}

function attribute(attributes: string, name: string): string | undefined {
	return attributes.match(new RegExp(`(?:^|\\s)${name}\\s*=\\s*["']([^"']*)["']`))?.[1];
}

function add(
	issues: ValidationIssue[],
	path: string,
	element: string,
	attributeName: string,
	value: string,
	expected: string,
): void {
	issues.push({
		severity: 'error',
		code: 'INVALID_SIMPLE_TYPE_FACET',
		message: `<${element}> ${attributeName}="${value}" must be ${expected}`,
		path,
	});
}

function numericValue(value: string): number | undefined {
	if (/^-?\d+$/.test(value)) {
		return Number(value);
	}
	if (/^-?(?:\d+(?:\.\d+)?|\.\d+)%$/.test(value)) {
		return Number(value.slice(0, -1)) * 1000;
	}
	return undefined;
}

function validatePercentage(element: XmlElement, path: string, issues: ValidationIssue[]): void {
	const positive = POSITIVE_PERCENT.has(element.local);
	if (!positive && !FIXED_PERCENT.has(element.local)) {
		return;
	}
	const value = attribute(element.attributes, 'val');
	if (value === undefined) {
		return;
	}
	const numeric = numericValue(value);
	const min = positive ? 0 : -100000;
	if (numeric === undefined || numeric < min || numeric > 100000) {
		add(
			issues,
			path,
			element.local,
			'val',
			value,
			`${positive ? 'a positive fixed' : 'a fixed'} percentage from ${min} through 100000`,
		);
	}
}

function coordinateValue(value: string): number | undefined {
	if (/^-?\d+$/.test(value)) {
		return Number(value);
	}
	if (/^-?(?:\d+(?:\.\d+)?|\.\d+)(?:mm|cm|in|pt|pc|pi)$/.test(value)) {
		return Number(value.match(/^-?(?:\d+(?:\.\d+)?|\.\d+)/)![0]);
	}
	return undefined;
}

function validateCoordinates(element: XmlElement, path: string, issues: ValidationIssue[]): void {
	const positive = element.local === 'ext' || element.local === 'chExt';
	if (!positive && element.local !== 'off' && element.local !== 'chOff') {
		return;
	}
	for (const name of ['x', 'y', 'cx', 'cy']) {
		const value = attribute(element.attributes, name);
		if (value === undefined) {
			continue;
		}
		const numeric = coordinateValue(value);
		const min = positive ? 0 : -27273042329600;
		if (numeric === undefined || numeric < min || numeric > 27273042316900) {
			add(
				issues,
				path,
				element.local,
				name,
				value,
				`${positive ? 'a positive ' : 'a '}coordinate in the ECMA-376 range`,
			);
		}
	}
}

function validateAngles(element: XmlElement, path: string, issues: ValidationIssue[]): void {
	const rules: Array<[string, number, number]> = [];
	if (element.local === 'xfrm' || element.local === 'bodyPr') {
		rules.push(['rot', -2147483648, 2147483647]);
	}
	if (element.local === 'lin') {
		rules.push(['ang', 0, 21599999]);
	}
	if (element.local === 'hue') {
		rules.push(['val', 0, 21599999]);
	}
	if (element.local === 'hueOff') {
		rules.push(['val', -2147483648, 2147483647]);
	}
	for (const [name, min, max] of rules) {
		const value = attribute(element.attributes, name);
		if (
			value !== undefined &&
			(!/^-?\d+$/.test(value) || Number(value) < min || Number(value) > max)
		) {
			add(issues, path, element.local, name, value, `an angle from ${min} through ${max}`);
		}
	}
}

function validateLanguage(element: XmlElement, path: string, issues: ValidationIssue[]): void {
	for (const name of element.local === 'lang' ? ['val'] : ['lang', 'altLang']) {
		const value = attribute(element.attributes, name);
		if (value !== undefined && !/^[A-Za-z]{1,8}(?:-[A-Za-z\d]{1,8})*$/.test(value)) {
			add(
				issues,
				path,
				element.local,
				name,
				value,
				'a language tag composed of hyphen-separated language subtags',
			);
		}
	}
}

function validateEnums(element: XmlElement, path: string, issues: ValidationIssue[]): void {
	for (const [key, values] of Object.entries(ENUMS)) {
		const [local, name] = key.split('@');
		if (local !== element.local) {
			continue;
		}
		const value = attribute(element.attributes, name);
		if (value !== undefined && !values.includes(value)) {
			add(issues, path, local, name, value, `one of: ${values.join(', ')}`);
		}
	}
	const bwMode = attribute(element.attributes, 'bwMode');
	if (bwMode !== undefined && !BLACK_WHITE.includes(bwMode)) {
		add(issues, path, element.local, 'bwMode', bwMode, `one of: ${BLACK_WHITE.join(', ')}`);
	}
}

function validateRelationshipIds(
	xml: string,
	ns: Map<string, string>,
	path: string,
	issues: ValidationIssue[],
): void {
	for (const [prefix, uri] of ns) {
		if (uri !== ECMA_NAMESPACES.strictR && uri !== ECMA_NAMESPACES.transitionalR) {
			continue;
		}
		if (!prefix) {
			continue;
		}
		const qualifier = prefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
		for (const match of xml.matchAll(
			new RegExp(`\\b${qualifier}:id\\s*=\\s*["']([^"']*)["']`, 'g'),
		)) {
			if (!/^[A-Za-z_][\w.-]*$/.test(match[1])) {
				add(
					issues,
					path,
					'relationship reference',
					`${prefix}:id`,
					match[1],
					'a non-empty XML ID token',
				);
			}
		}
	}
}

export function validateSimpleTypeFacets(
	xml: string,
	path: string,
	issues: ValidationIssue[],
): void {
	const ns = allNamespaceDeclarations(xml);
	const drawingOrPresentation = new Set<string>([
		ECMA_NAMESPACES.strictA,
		ECMA_NAMESPACES.transitionalA,
		ECMA_NAMESPACES.strictP,
		ECMA_NAMESPACES.transitionalP,
	]);
	for (const element of elements(xml)) {
		if (!drawingOrPresentation.has(ns.get(element.prefix) ?? '')) {
			continue;
		}
		validatePercentage(element, path, issues);
		validateCoordinates(element, path, issues);
		validateAngles(element, path, issues);
		validateLanguage(element, path, issues);
		validateEnums(element, path, issues);
	}
	validateRelationshipIds(xml, ns, path, issues);
}
