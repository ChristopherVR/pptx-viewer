import type {
	PptxSmartArtChoose,
	PptxSmartArtForEach,
	PptxSmartArtIteratorAttributes,
	PptxSmartArtLayoutNode,
	PptxSmartArtWhen,
	XmlObject,
} from '../types';

type LocalName = (key: string) => string;
const UINT_MAX = 4_294_967_295;

function children(node: XmlObject, name: string, localName: LocalName): XmlObject[] {
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return Array.isArray(value) ? value : value && typeof value === 'object' ? [value] : [];
}

function optionalString(value: unknown): string | undefined {
	const result = String(value ?? '').trim();
	return result.length > 0 ? result : undefined;
}

function strings(value: unknown): string[] | undefined {
	const values = optionalString(value)?.split(/\s+/u);
	return values?.length ? values : undefined;
}

function booleans(value: unknown): boolean[] | undefined {
	const values = strings(value);
	if (!values || values.some((entry) => !['0', '1', 'true', 'false'].includes(entry))) {
		return undefined;
	}
	return values.map((entry) => entry === '1' || entry === 'true');
}

function integers(value: unknown, unsigned = false): number[] | undefined {
	const values = strings(value);
	if (!values) {
		return undefined;
	}
	const parsed = values.map(Number);
	if (
		parsed.some(
			(entry) =>
				!Number.isInteger(entry) ||
				entry < (unsigned ? 0 : -2_147_483_648) ||
				entry > (unsigned ? UINT_MAX : 2_147_483_647),
		)
	) {
		return undefined;
	}
	return parsed;
}

function parseIterator(node: XmlObject): PptxSmartArtIteratorAttributes {
	return {
		name: optionalString(node['@_name']),
		reference: optionalString(node['@_ref']),
		axis: strings(node['@_axis']),
		pointTypes: strings(node['@_ptType']),
		hideLastTransition: booleans(node['@_hideLastTrans']),
		start: integers(node['@_st']),
		count: integers(node['@_cnt'], true),
		step: integers(node['@_step']),
	};
}

function parseWhen(node: XmlObject): PptxSmartArtWhen | undefined {
	const func = optionalString(node['@_func']);
	const operator = optionalString(node['@_op']);
	const value = optionalString(node['@_val']);
	return func && operator && value
		? {
				...parseIterator(node),
				function: func,
				argument: optionalString(node['@_arg']),
				operator,
				value,
				rawXml: node,
			}
		: undefined;
}

export function parseSmartArtControlFlow(
	node: XmlObject,
	localName: LocalName,
): Pick<PptxSmartArtLayoutNode, 'forEach' | 'choose'> {
	const forEach = children(node, 'forEach', localName).map(
		(entry): PptxSmartArtForEach => ({ ...parseIterator(entry), rawXml: entry }),
	);
	const choose = children(node, 'choose', localName).map((entry): PptxSmartArtChoose => {
		const otherwiseNode = children(entry, 'else', localName)[0];
		return {
			name: optionalString(entry['@_name']),
			when: children(entry, 'if', localName)
				.map(parseWhen)
				.filter((value) => value !== undefined),
			otherwise: otherwiseNode
				? { name: optionalString(otherwiseNode['@_name']), rawXml: otherwiseNode }
				: undefined,
			rawXml: entry,
		};
	});
	return {
		...(forEach.length ? { forEach } : {}),
		...(choose.length ? { choose } : {}),
	};
}

function set(node: XmlObject, name: string, value: string | undefined): void {
	if (value === undefined) {
		delete node[`@_${name}`];
	} else {
		node[`@_${name}`] = value;
	}
}

function applyIterator(node: XmlObject, value: PptxSmartArtIteratorAttributes): void {
	set(node, 'name', value.name);
	set(node, 'ref', value.reference);
	set(node, 'axis', value.axis?.join(' '));
	set(node, 'ptType', value.pointTypes?.join(' '));
	set(
		node,
		'hideLastTrans',
		value.hideLastTransition?.map((entry) => (entry ? '1' : '0')).join(' '),
	);
	set(node, 'st', value.start?.join(' '));
	set(node, 'cnt', value.count?.join(' '));
	set(node, 'step', value.step?.join(' '));
}

function applyWhen(value: PptxSmartArtWhen): XmlObject {
	const node = { ...(value.rawXml ?? {}) };
	applyIterator(node, value);
	set(node, 'func', value.function);
	set(node, 'arg', value.argument);
	set(node, 'op', value.operator);
	set(node, 'val', value.value);
	return node;
}

function applyChoose(value: PptxSmartArtChoose, localName: LocalName): XmlObject {
	const node = { ...(value.rawXml ?? {}) };
	set(node, 'name', value.name);
	const ifKey = Object.keys(node).find((key) => localName(key) === 'if') ?? 'dgm:if';
	node[ifKey] = value.when.map(applyWhen);
	const elseKey = Object.keys(node).find((key) => localName(key) === 'else') ?? 'dgm:else';
	if (value.otherwise === null) {
		delete node[elseKey];
	} else if (value.otherwise) {
		const otherwise = { ...(value.otherwise.rawXml ?? {}) };
		set(otherwise, 'name', value.otherwise.name);
		node[elseKey] = otherwise;
	}
	return node;
}

function replaceChildren(
	node: XmlObject,
	name: string,
	values: XmlObject[] | undefined,
	localName: LocalName,
): void {
	if (values === undefined) {
		return;
	}
	const key = Object.keys(node).find((candidate) => localName(candidate) === name) ?? `dgm:${name}`;
	if (values.length === 0) {
		delete node[key];
	} else {
		node[key] = values;
	}
}

export function applySmartArtControlFlow(
	node: XmlObject,
	value: PptxSmartArtLayoutNode,
	localName: LocalName,
): void {
	replaceChildren(
		node,
		'forEach',
		value.forEach?.map((entry) => {
			const target = { ...(entry.rawXml ?? {}) };
			applyIterator(target, entry);
			return target;
		}),
		localName,
	);
	replaceChildren(
		node,
		'choose',
		value.choose?.map((entry) => applyChoose(entry, localName)),
		localName,
	);
}

export function validateSmartArtControlFlow(node: PptxSmartArtLayoutNode): string[] {
	const errors: string[] = [];
	const validateIterator = (value: PptxSmartArtIteratorAttributes, path: string): void => {
		for (const field of ['start', 'step'] as const) {
			if (
				value[field]?.some(
					(entry) => !Number.isInteger(entry) || entry < -2_147_483_648 || entry > 2_147_483_647,
				)
			) {
				errors.push(`${path}.${field} values must be signed 32-bit integers`);
			}
		}
		if (value.count?.some((entry) => !Number.isInteger(entry) || entry < 0 || entry > UINT_MAX)) {
			errors.push(`${path}.count values must be unsigned 32-bit integers`);
		}
	};
	node.forEach?.forEach((value, index) => validateIterator(value, `forEach[${index}]`));
	node.choose?.forEach((choose, chooseIndex) => {
		if (choose.when.length === 0) {
			errors.push(`choose[${chooseIndex}].when requires at least one branch`);
		}
		choose.when.forEach((branch, branchIndex) => {
			const path = `choose[${chooseIndex}].when[${branchIndex}]`;
			validateIterator(branch, path);
			for (const field of ['function', 'operator', 'value'] as const) {
				if (!branch[field].trim()) {
					errors.push(`${path}.${field} is required`);
				}
			}
		});
	});
	return errors;
}
