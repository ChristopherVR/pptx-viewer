/**
 * Shared lookups for {@link module:sdk/master-layout-crud-layout} and
 * {@link module:sdk/master-layout-crud-master}.
 *
 * @module sdk/master-layout-crud-lookup
 */
import type { PptxData } from '../../types/presentation';
import type { MasterLayoutCrudFailure } from './master-layout-crud-xml';

export const NOT_FOUND: MasterLayoutCrudFailure = { ok: false, reason: 'notFound' };

export function findMaster(data: PptxData, masterId: string) {
	return data.slideMasters?.find((master) => master.path === masterId);
}

export function findLayoutOwner(data: PptxData, layoutId: string) {
	for (const master of data.slideMasters ?? []) {
		const layout = master.layouts?.find((l) => l.path === layoutId);
		if (layout) {
			return { master, layout };
		}
	}
	return undefined;
}
