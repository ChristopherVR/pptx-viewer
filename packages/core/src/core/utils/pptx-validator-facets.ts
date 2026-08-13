import { allNamespaceDeclarations, ECMA_NAMESPACES } from './pptx-validator-conformance-xml';
import {
	BLACK_WHITE,
	ENUMS,
	FIXED_PERCENT,
	POSITIVE_PERCENT,
	POSITIVE_UNBOUNDED_PERCENT,
	UNBOUNDED_PERCENT,
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

/** `xsd:int` bounds, the value space of an uncapped `ST_Percentage`. */
const INT_MIN = -2147483648;
const INT_MAX = 2147483647;

/** The facet bounds and prose label for a percentage element, if it has any. */
function percentageFacet(local: string): { min: number; max: number; label: string } | undefined {
	if (POSITIVE_PERCENT.has(local)) {
		return { min: 0, max: 100000, label: 'a positive fixed percentage from 0 through 100000' };
	}
	if (FIXED_PERCENT.has(local)) {
		return { min: -100000, max: 100000, label: 'a fixed percentage from -100000 through 100000' };
	}
	if (POSITIVE_UNBOUNDED_PERCENT.has(local)) {
		return { min: 0, max: INT_MAX, label: 'a non-negative percentage' };
	}
	if (UNBOUNDED_PERCENT.has(local)) {
		return { min: INT_MIN, max: INT_MAX, label: 'a percentage in the signed 32-bit range' };
	}
	return undefined;
}

function validatePercentage(element: XmlElement, path: string, issues: ValidationIssue[]): void {
	const facet = percentageFacet(element.local);
	if (!facet) {
		return;
	}
	const value = attribute(element.attributes, 'val');
	if (value === undefined) {
		return;
	}
	const numeric = numericValue(value);
	if (numeric === undefined || numeric < facet.min || numeric > facet.max) {
		add(issues, path, element.local, 'val', value, facet.label);
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

/**
 * Elements on which an EMPTY `r:id` is legal and routinely emitted.
 *
 * `CT_Hyperlink/@r:id` is optional, and when the hyperlink is an internal
 * PowerPoint action rather than an external target there is no relationship to
 * point at. PowerPoint writes the attribute anyway with an empty value:
 * `<a:hlinkClick r:id="" action="ppaction://noaction"/>` appears on 11 of the
 * 14 slides of `e2e/fixtures/solution-explorer.pptx` and in the COM-authored
 * `ole-embedded-media.pptx` corpus deck. Rejecting it made the validator
 * unusable as a save gate on genuine decks.
 */
const EMPTY_REL_ID_ALLOWED = new Set(['hlinkClick', 'hlinkHover', 'hlinkMouseOver']);

function validateRelationshipIds(
	xml: string,
	ns: Map<string, string>,
	path: string,
	issues: ValidationIssue[],
): void {
	const relPrefixes = [...ns]
		.filter(
			([prefix, uri]) =>
				prefix !== '' && (uri === ECMA_NAMESPACES.strictR || uri === ECMA_NAMESPACES.transitionalR),
		)
		.map(([prefix]) => prefix);
	if (relPrefixes.length === 0) {
		return;
	}
	for (const element of elements(xml)) {
		for (const prefix of relPrefixes) {
			const value = attribute(element.attributes, `${prefix}:id`);
			if (value === undefined || /^[A-Za-z_][\w.-]*$/.test(value)) {
				continue;
			}
			if (value === '' && EMPTY_REL_ID_ALLOWED.has(element.local)) {
				continue;
			}
			add(
				issues,
				path,
				'relationship reference',
				`${prefix}:id`,
				value,
				'a non-empty XML ID token',
			);
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
