import type { XmlObject } from '../../types';

/** Persist the selected layout for both newly attached and existing slides. */
export function updateSlideLayoutRelationship(
	relationships: XmlObject[],
	layoutPath: string | undefined,
	relationshipType: string,
): void {
	if (!layoutPath) {
		return;
	}
	const target = `../${layoutPath.replace(/^\/?ppt\//, '')}`;
	const existing = relationships.find((rel) => String(rel['@_Type']).endsWith('/slideLayout'));
	if (existing) {
		existing['@_Target'] = target;
		delete existing['@_TargetMode'];
		return;
	}
	const ids = new Set(relationships.map((rel) => String(rel['@_Id'])));
	let id = 1;
	while (ids.has(`rId${id}`)) {
		id++;
	}
	relationships.push({ '@_Id': `rId${id}`, '@_Type': relationshipType, '@_Target': target });
}
