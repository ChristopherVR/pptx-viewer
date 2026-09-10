/**
 * Builds the document-level `ExObjListContainer`: the `ExObjListAtom` plus
 * every registered hyperlink (`hyperlink-writer.ts`) and OLE embed
 * (`ole-writer.ts`) as sibling `ExObjListSubContainer` children. Split out
 * from both so neither needs to import the other (`OleCollector` allocates
 * its ids through `HyperlinkCollector`, see that class's doc comment, which
 * is a one-way dependency this module does not need to add to).
 *
 * @module ppt/writer/ex-obj-list-writer
 */

import { RT } from '../record-types';
import { ByteWriter, record } from './byte-writer';
import { buildExHyperlinkContainer } from './hyperlink-writer';
import type { HyperlinkCollector } from './hyperlink-writer';
import { buildExOleEmbedContainer } from './ole-writer';
import type { OleCollector } from './ole-writer';

/**
 * Build the document-level `ExObjListContainer`, or `undefined` when
 * nothing was registered in either collector.
 *
 * @param ole - Every entry MUST already have `persistIdRef` set (assigned
 *   by `document-stream-layout.ts` once every embed's `ExOleObjStg` has
 *   been laid out and given a persist id).
 */
export function buildExObjList(
	hyperlinks: HyperlinkCollector,
	ole: OleCollector | undefined,
): Uint8Array | undefined {
	const oleEntries = ole?.all ?? [];
	if (hyperlinks.isEmpty && oleEntries.length === 0) {
		return undefined;
	}
	const seed = Math.max(hyperlinks.peekNextId(), ...oleEntries.map((e) => e.exObjId + 1), 1);
	const atomData = new ByteWriter().i32(seed).toBytes();
	const w = new ByteWriter().bytes(record(RT.ExternalObjectListAtom, atomData, 0, false, 0));
	for (const entry of hyperlinks.all) {
		w.bytes(buildExHyperlinkContainer(entry.id, entry.kind));
	}
	for (const entry of oleEntries) {
		if (entry.persistIdRef === undefined) {
			throw new Error(
				`OLE embed exObjId=${entry.exObjId} has no persistIdRef; document-stream-layout.ts must assign one before calling buildExObjList`,
			);
		}
		w.bytes(buildExOleEmbedContainer(entry.exObjId, entry.persistIdRef));
	}
	return record(RT.ExternalObjectList, w.toBytes(), 0, true);
}
