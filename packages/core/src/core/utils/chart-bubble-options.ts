import type { PptxBubbleChartOptions, XmlObject } from '../types';

type LocalName = (key: string) => string;
const ORDER = [
	'varyColors',
	'ser',
	'dLbls',
	'bubble3D',
	'bubbleScale',
	'showNegBubbles',
	'sizeRepresents',
	'axId',
	'extLst',
] as const;

function findKey(node: XmlObject, name: string, localName: LocalName): string | undefined {
	return Object.keys(node).find((key) => localName(key) === name);
}
function boolValue(node: XmlObject | undefined): boolean | undefined {
	if (!node) {
		return undefined;
	}
	const value = node['@_val'];
	return value !== '0' && value !== 'false';
}

export function parseBubbleChartOptions(
	container: XmlObject | undefined,
	localName: LocalName,
): PptxBubbleChartOptions | undefined {
	if (!container) {
		return undefined;
	}
	const node = (name: string) => {
		const key = findKey(container, name, localName);
		return key ? (container[key] as XmlObject | undefined) : undefined;
	};
	const options: PptxBubbleChartOptions = {};
	const bubble3D = boolValue(node('bubble3D'));
	if (bubble3D !== undefined) {
		options.bubble3D = bubble3D;
	}
	const scaleNode = node('bubbleScale');
	if (scaleNode) {
		const scale = Number.parseFloat(String(scaleNode['@_val'] ?? '100').replace(/%$/u, ''));
		if (Number.isFinite(scale) && scale >= 0 && scale <= 300) {
			options.bubbleScale = scale;
		}
	}
	const showNegative = boolValue(node('showNegBubbles'));
	if (showNegative !== undefined) {
		options.showNegativeBubbles = showNegative;
	}
	const sizeNode = node('sizeRepresents');
	if (sizeNode) {
		const value = String(sizeNode['@_val'] ?? 'area');
		if (value === 'area' || value === 'w') {
			options.sizeRepresents = value;
		}
	}
	return Object.keys(options).length > 0 ? options : undefined;
}

function insertOrdered(
	container: XmlObject,
	name: (typeof ORDER)[number],
	value: XmlObject,
	localName: LocalName,
): void {
	const existingKey = findKey(container, name, localName);
	if (existingKey) {
		container[existingKey] = { ...(container[existingKey] as XmlObject), ...value };
		return;
	}
	const entries = Object.entries(container);
	const targetRank = ORDER.indexOf(name);
	const index = entries.findIndex(([key]) => {
		const rank = ORDER.indexOf(localName(key) as (typeof ORDER)[number]);
		return rank >= 0 && rank > targetRank;
	});
	entries.splice(index < 0 ? entries.length : index, 0, [`c:${name}`, value]);
	for (const key of Object.keys(container)) {
		delete container[key];
	}
	for (const [key, child] of entries) {
		container[key] = child;
	}
}

export function applyBubbleChartOptions(
	container: XmlObject,
	options: PptxBubbleChartOptions,
	localName: LocalName,
): void {
	if (options.bubble3D !== undefined) {
		insertOrdered(container, 'bubble3D', { '@_val': options.bubble3D ? '1' : '0' }, localName);
	}
	if (options.bubbleScale !== undefined) {
		if (
			!Number.isFinite(options.bubbleScale) ||
			options.bubbleScale < 0 ||
			options.bubbleScale > 300
		) {
			throw new RangeError('bubbleScale must be between 0 and 300');
		}
		insertOrdered(container, 'bubbleScale', { '@_val': `${options.bubbleScale}%` }, localName);
	}
	if (options.showNegativeBubbles !== undefined) {
		insertOrdered(
			container,
			'showNegBubbles',
			{ '@_val': options.showNegativeBubbles ? '1' : '0' },
			localName,
		);
	}
	if (options.sizeRepresents !== undefined) {
		insertOrdered(container, 'sizeRepresents', { '@_val': options.sizeRepresents }, localName);
	}
}
