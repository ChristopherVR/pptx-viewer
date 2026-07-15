import type { XmlObject } from '../../types';

type UnparsedNodesByPart = Map<string, Map<string, XmlObject[]>>;

const unparsedNodesByRuntime = new WeakMap<object, UnparsedNodesByPart>();

export function rememberAuxiliaryMasterUnparsedNodes(
	runtime: object,
	partPath: string,
	nodesByTag: Map<string, XmlObject[]>,
): void {
	let byPart = unparsedNodesByRuntime.get(runtime);
	if (!byPart) {
		byPart = new Map();
		unparsedNodesByRuntime.set(runtime, byPart);
	}
	byPart.set(partPath, nodesByTag);
}

export function getAuxiliaryMasterUnparsedNodes(
	runtime: object,
	partPath: string,
): Map<string, XmlObject[]> | undefined {
	return unparsedNodesByRuntime.get(runtime)?.get(partPath);
}
