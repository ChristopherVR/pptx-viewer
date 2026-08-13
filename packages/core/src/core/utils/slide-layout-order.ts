import type { XmlObject } from '../types';
import { xmlAttr, xmlChild } from './xml-access';

/**
 * Order a master's layout parts the way PowerPoint's gallery does.
 *
 * The `.rels` part is an unordered bag: iterating it yields layouts in
 * whatever order the producing application happened to write the
 * relationships, which is frequently alphabetical by `rId` and therefore
 * lists `rId10` before `rId2`. The authored order lives in the master's
 * `<p:sldLayoutIdLst>`, and that is what the New Slide / Layout galleries
 * must follow.
 *
 * Relationships that no `<p:sldLayoutId>` points at are appended in
 * relationship order instead of being discarded, so a malformed deck still
 * exposes every layout it actually contains.
 *
 * @param sldMaster - Parsed slide master part.
 * @param relationships - `<Relationship>` nodes from the master's `.rels`.
 * @param resolveTarget - Resolves a relationship target to an archive path.
 * @returns Layout archive paths in gallery order, without duplicates.
 */
export function resolveSlideLayoutOrder(
	sldMaster: XmlObject | undefined,
	relationships: readonly XmlObject[],
	resolveTarget: (target: string) => string,
): string[] {
	const layoutRels = relationships.filter((rel) =>
		String(rel['@_Type'] ?? '').includes('/slideLayout'),
	);

	const targetByRelId = new Map<string, string>();
	for (const rel of layoutRels) {
		const id = String(rel['@_Id'] ?? '');
		const target = String(rel['@_Target'] ?? '');
		if (id && target) {
			targetByRelId.set(id, target);
		}
	}

	const layoutIdNodes = sldMaster
		? toArray(xmlChild(sldMaster, 'p:sldLayoutIdLst')?.['p:sldLayoutId'])
		: [];

	const ordered: string[] = [];
	const seenPaths = new Set<string>();
	const consumedRelIds = new Set<string>();

	const push = (relId: string, target: string): void => {
		const path = resolveTarget(target);
		// A master may reference the same layout twice; the gallery shows it once.
		if (!path || seenPaths.has(path)) {
			return;
		}
		seenPaths.add(path);
		consumedRelIds.add(relId);
		ordered.push(path);
	};

	for (const node of layoutIdNodes) {
		const relId = xmlAttr(node, 'r:id');
		const target = relId ? targetByRelId.get(relId) : undefined;
		if (relId && target) {
			push(relId, target);
		}
	}

	for (const rel of layoutRels) {
		const id = String(rel['@_Id'] ?? '');
		const target = String(rel['@_Target'] ?? '');
		if (target && !consumedRelIds.has(id)) {
			push(id, target);
		}
	}

	return ordered;
}

function toArray(value: unknown): XmlObject[] {
	if (value === undefined || value === null) {
		return [];
	}
	return (Array.isArray(value) ? value : [value]) as XmlObject[];
}
