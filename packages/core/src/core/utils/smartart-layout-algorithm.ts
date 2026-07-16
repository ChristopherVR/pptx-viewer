import type { PptxSmartArtLayoutAlgorithm, PptxSmartArtLayoutNode, XmlObject } from '../types';

type LocalName = (key: string) => string;

function child(node: XmlObject, name: string, localName: LocalName): XmlObject | undefined {
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	return Array.isArray(value)
		? (value[0] as XmlObject | undefined)
		: (value as XmlObject | undefined);
}

function children(node: XmlObject, name: string, localName: LocalName): XmlObject[] {
	const key = Object.keys(node).find((candidate) => localName(candidate) === name);
	const value = key ? node[key] : undefined;
	if (Array.isArray(value)) {
		return value as XmlObject[];
	}
	return value && typeof value === 'object' ? [value as XmlObject] : [];
}

function optionalString(value: unknown): string | undefined {
	const result = String(value ?? '').trim();
	return result.length > 0 ? result : undefined;
}

export function parseSmartArtLayoutAlgorithm(
	node: XmlObject,
	localName: LocalName,
): PptxSmartArtLayoutAlgorithm | undefined {
	const algorithm = child(node, 'alg', localName);
	const type = algorithm ? optionalString(algorithm['@_type']) : undefined;
	if (!algorithm || !type) {
		return undefined;
	}
	const revisionValue = Number(algorithm['@_rev']);
	const revision =
		Number.isInteger(revisionValue) && revisionValue >= 0 && revisionValue <= 4294967295
			? revisionValue
			: undefined;
	const parameters = children(algorithm, 'param', localName)
		.map((parameter) => {
			const parameterType = optionalString(parameter['@_type']);
			return parameterType
				? { type: parameterType, value: optionalString(parameter['@_val']) }
				: undefined;
		})
		.filter((parameter) => parameter !== undefined);
	return {
		type,
		...(revision === undefined ? {} : { revision }),
		...(parameters.length === 0 ? {} : { parameters }),
	};
}

export function validateSmartArtLayoutAlgorithm(node: PptxSmartArtLayoutNode): string[] {
	const algorithm = node.algorithm;
	if (!algorithm) {
		return [];
	}
	const errors: string[] = [];
	if (!algorithm.type.trim()) {
		errors.push('algorithm.type is required');
	}
	if (
		algorithm.revision !== undefined &&
		(!Number.isInteger(algorithm.revision) ||
			algorithm.revision < 0 ||
			algorithm.revision > 4294967295)
	) {
		errors.push('algorithm.revision must be an unsigned 32-bit integer');
	}
	algorithm.parameters?.forEach((parameter, index) => {
		if (!parameter.type.trim()) {
			errors.push(`algorithm.parameters[${index}].type is required`);
		}
	});
	return errors;
}

function insertAlgorithm(node: XmlObject, algorithm: XmlObject): void {
	const result: XmlObject = {};
	let inserted = false;
	for (const [key, value] of Object.entries(node)) {
		if (!inserted && !key.startsWith('@_')) {
			result['dgm:alg'] = algorithm;
			inserted = true;
		}
		result[key] = value;
	}
	if (!inserted) {
		result['dgm:alg'] = algorithm;
	}
	for (const key of Object.keys(node)) {
		delete node[key];
	}
	Object.assign(node, result);
}

export function applySmartArtLayoutAlgorithm(
	node: XmlObject,
	value: PptxSmartArtLayoutAlgorithm | undefined,
	localName: LocalName,
): void {
	const existingKey = Object.keys(node).find((candidate) => localName(candidate) === 'alg');
	if (!value) {
		if (existingKey) {
			delete node[existingKey];
		}
		return;
	}
	const algorithm = existingKey ? (node[existingKey] as XmlObject) : {};
	algorithm['@_type'] = value.type;
	if (value.revision === undefined) {
		delete algorithm['@_rev'];
	} else {
		algorithm['@_rev'] = String(value.revision);
	}
	if (value.parameters !== undefined) {
		const parameterKey =
			Object.keys(algorithm).find((candidate) => localName(candidate) === 'param') ?? 'dgm:param';
		const existing = children(algorithm, 'param', localName);
		algorithm[parameterKey] = value.parameters.map((parameter, index) => {
			const target = existing[index] ?? {};
			target['@_type'] = parameter.type;
			if (parameter.value === undefined) {
				delete target['@_val'];
			} else {
				target['@_val'] = parameter.value;
			}
			return target;
		});
	}
	if (!existingKey) {
		insertAlgorithm(node, algorithm);
	}
}
