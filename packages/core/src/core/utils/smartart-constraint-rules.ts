import type {
	PptxSmartArtConstraint,
	PptxSmartArtConstraintOperator,
	PptxSmartArtConstraintPointType,
	PptxSmartArtConstraintRelationship,
	PptxSmartArtLayoutNode,
	PptxSmartArtNumericRule,
	XmlObject,
} from '../types';
import { cloneXmlObject } from './clone-utils';
import {
	SMART_ART_CONSTRAINT_OPERATORS,
	SMART_ART_CONSTRAINT_TYPES,
	SMART_ART_POINT_TYPES,
	SMART_ART_RELATIONSHIPS,
} from './smartart-constraint-values';

type LocalName = (key: string) => string;

function keyOf(node: XmlObject, name: string, localName: LocalName): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}

function child(node: XmlObject, name: string, localName: LocalName): XmlObject | undefined {
	const key = keyOf(node, name, localName);
	const value = key ? node[key] : undefined;
	return value && typeof value === 'object' && !Array.isArray(value)
		? (value as XmlObject)
		: undefined;
}

function children(node: XmlObject, name: string, localName: LocalName): XmlObject[] {
	const key = keyOf(node, name, localName);
	const value = key ? node[key] : undefined;
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

function attr(node: XmlObject, name: string, localName: LocalName): string | undefined {
	const key = Object.keys(node).find(
		(candidate) => candidate.startsWith('@_') && localName(candidate.replace(/^@_/u, '')) === name,
	);
	return key && node[key] !== undefined ? String(node[key]) : undefined;
}

function xsdDouble(value: string | undefined): number | undefined {
	if (value === undefined || value.trim() === '') {
		return undefined;
	}
	if (value === 'NaN') {
		return Number.NaN;
	}
	if (value === 'INF') {
		return Number.POSITIVE_INFINITY;
	}
	if (value === '-INF') {
		return Number.NEGATIVE_INFINITY;
	}
	const parsed = Number(value);
	return Number.isNaN(parsed) ? undefined : parsed;
}

function parseTarget(node: XmlObject, localName: LocalName) {
	return {
		for: attr(node, 'for', localName) as PptxSmartArtConstraintRelationship | undefined,
		forName: attr(node, 'forName', localName),
		pointType: attr(node, 'ptType', localName) as PptxSmartArtConstraintPointType | undefined,
	};
}

function parseConstraint(node: XmlObject, localName: LocalName): PptxSmartArtConstraint {
	return {
		type: attr(node, 'type', localName) ?? '',
		...parseTarget(node, localName),
		referenceType: attr(node, 'refType', localName),
		referenceFor: attr(node, 'refFor', localName) as PptxSmartArtConstraintRelationship | undefined,
		referenceForName: attr(node, 'refForName', localName),
		referencePointType: attr(node, 'refPtType', localName) as
			| PptxSmartArtConstraintPointType
			| undefined,
		operator: attr(node, 'op', localName) as PptxSmartArtConstraintOperator | undefined,
		value: xsdDouble(attr(node, 'val', localName)),
		factor: xsdDouble(attr(node, 'fact', localName)),
		rawXml: cloneXmlObject(node),
	};
}

function parseRule(node: XmlObject, localName: LocalName): PptxSmartArtNumericRule {
	return {
		type: attr(node, 'type', localName) ?? '',
		...parseTarget(node, localName),
		value: xsdDouble(attr(node, 'val', localName)),
		factor: xsdDouble(attr(node, 'fact', localName)),
		max: xsdDouble(attr(node, 'max', localName)),
		rawXml: cloneXmlObject(node),
	};
}

/** Parse the constraint and numeric-rule children of CT_LayoutNode. */
export function parseSmartArtConstraintRules(
	node: XmlObject,
	localName: LocalName,
): Pick<PptxSmartArtLayoutNode, 'constraints' | 'rules'> {
	const constraintList = child(node, 'constrLst', localName);
	const ruleList = child(node, 'ruleLst', localName);
	return {
		constraints: constraintList
			? children(constraintList, 'constr', localName).map((item) =>
					parseConstraint(item, localName),
				)
			: undefined,
		rules: ruleList
			? children(ruleList, 'rule', localName).map((item) => parseRule(item, localName))
			: undefined,
	};
}

function validateTarget(
	value: PptxSmartArtConstraint | PptxSmartArtNumericRule,
	path: string,
): string[] {
	const errors: string[] = [];
	if (!SMART_ART_CONSTRAINT_TYPES.has(value.type)) {
		errors.push(`${path}.type is invalid`);
	}
	if (value.for !== undefined && !SMART_ART_RELATIONSHIPS.has(value.for)) {
		errors.push(`${path}.for is invalid`);
	}
	if (value.pointType !== undefined && !SMART_ART_POINT_TYPES.has(value.pointType)) {
		errors.push(`${path}.pointType is invalid`);
	}
	return errors;
}

export function validateSmartArtConstraintRules(value: PptxSmartArtLayoutNode): string[] {
	const errors: string[] = [];
	value.constraints?.forEach((item, index) => {
		const path = `constraints[${index}]`;
		errors.push(...validateTarget(item, path));
		if (item.referenceType !== undefined && !SMART_ART_CONSTRAINT_TYPES.has(item.referenceType)) {
			errors.push(`${path}.referenceType is invalid`);
		}
		if (item.referenceFor !== undefined && !SMART_ART_RELATIONSHIPS.has(item.referenceFor)) {
			errors.push(`${path}.referenceFor is invalid`);
		}
		if (
			item.referencePointType !== undefined &&
			!SMART_ART_POINT_TYPES.has(item.referencePointType)
		) {
			errors.push(`${path}.referencePointType is invalid`);
		}
		if (item.operator !== undefined && !SMART_ART_CONSTRAINT_OPERATORS.has(item.operator)) {
			errors.push(`${path}.operator is invalid`);
		}
	});
	value.rules?.forEach((item, index) => errors.push(...validateTarget(item, `rules[${index}]`)));
	return errors;
}

function formatDouble(value: number): string {
	if (Number.isNaN(value)) {
		return 'NaN';
	}
	if (value === Number.POSITIVE_INFINITY) {
		return 'INF';
	}
	if (value === Number.NEGATIVE_INFINITY) {
		return '-INF';
	}
	return String(value);
}

function setAttr(
	node: XmlObject,
	name: string,
	value: string | number | undefined,
	localName: LocalName,
): void {
	const key =
		Object.keys(node).find(
			(candidate) =>
				candidate.startsWith('@_') && localName(candidate.replace(/^@_/u, '')) === name,
		) ?? `@_${name}`;
	if (value === undefined) {
		delete node[key];
	} else {
		node[key] = typeof value === 'number' ? formatDouble(value) : value;
	}
}

function applyTarget(
	node: XmlObject,
	value: PptxSmartArtConstraint | PptxSmartArtNumericRule,
	localName: LocalName,
): void {
	setAttr(node, 'type', value.type, localName);
	setAttr(node, 'for', value.for, localName);
	setAttr(node, 'forName', value.forName, localName);
	setAttr(node, 'ptType', value.pointType, localName);
	setAttr(node, 'val', value.value, localName);
	setAttr(node, 'fact', value.factor, localName);
}

function itemPrefix(listKey: string | undefined): string {
	return listKey?.includes(':') ? `${listKey.slice(0, listKey.indexOf(':'))}:` : 'dgm:';
}

/** Merge typed constraints and rules without dropping foreign attributes or extension content. */
export function applySmartArtConstraintRules(
	node: XmlObject,
	value: PptxSmartArtLayoutNode,
	localName: LocalName,
): boolean {
	if (validateSmartArtConstraintRules(value).length > 0) {
		return false;
	}
	for (const [listName, itemName, values] of [
		['constrLst', 'constr', value.constraints],
		['ruleLst', 'rule', value.rules],
	] as const) {
		if (values === undefined) {
			continue;
		}
		const listKey = keyOf(node, listName, localName) ?? `dgm:${listName}`;
		const list = child(node, listName, localName) ?? {};
		const oldItems = children(list, itemName, localName);
		const itemKey = keyOf(list, itemName, localName) ?? `${itemPrefix(listKey)}${itemName}`;
		for (const key of Object.keys(list)) {
			if (localName(key) === itemName) {
				delete list[key];
			}
		}
		list[itemKey] = values.map((item, index) => {
			const target = cloneXmlObject(oldItems[index]) ?? cloneXmlObject(item.rawXml) ?? {};
			applyTarget(target, item, localName);
			if (itemName === 'constr') {
				const constraint = item as PptxSmartArtConstraint;
				setAttr(target, 'refType', constraint.referenceType, localName);
				setAttr(target, 'refFor', constraint.referenceFor, localName);
				setAttr(target, 'refForName', constraint.referenceForName, localName);
				setAttr(target, 'refPtType', constraint.referencePointType, localName);
				setAttr(target, 'op', constraint.operator, localName);
			} else {
				setAttr(target, 'max', (item as PptxSmartArtNumericRule).max, localName);
			}
			return target;
		});
		node[listKey] = list;
	}
	return true;
}
