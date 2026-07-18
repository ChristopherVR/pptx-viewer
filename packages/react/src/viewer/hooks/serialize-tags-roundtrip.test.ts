/**
 * serialize-tags-roundtrip.test.ts: pins the tag-persistence contract that
 * `useSerialize` / `useExportSaveAs` rely on.
 *
 * The hooks build their save options as plain object variables (and
 * `useExportSaveAs` casts them), so a renamed or dropped `tags` key would not
 * fail the typecheck. This test saves through `handler.save()` with the exact
 * `tags` option shape the hooks now forward from viewer state, reparses the
 * bytes, and asserts the tag collections survive; a companion type assertion
 * keeps `tagCollections` a required member of the hook inputs.
 */
import type { PptxHandlerSaveOptions, PptxTagCollection } from 'pptx-viewer-core';
import { PptxHandler } from 'pptx-viewer-core';
import { describe, expect, expectTypeOf, it } from 'vitest';

import type { UseExportHandlersInput } from './export-handler-types';
import type { UseSerializeInput } from './useSerialize';

/** Copy a saved Uint8Array into a standalone ArrayBuffer for reloading. */
function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('tag persistence through handler.save', () => {
	it('round-trips tag collections passed via the tags save option', async () => {
		const { handler, data } = await PptxHandler.create({ initialSlideCount: 1 });
		try {
			const tagCollections: PptxTagCollection[] = [
				{
					path: 'ppt/tags/tag1.xml',
					tags: [{ name: 'REVIEW_STATUS', value: 'approved' }],
				},
			];
			// Exactly the option key useSerialize/useExportSaveAs forward.
			const saveOptions: PptxHandlerSaveOptions = { tags: tagCollections };
			const savedBytes = await handler.save(data.slides, saveOptions);

			const reparser = new PptxHandler();
			try {
				const reparsed = await reparser.load(toArrayBuffer(savedBytes));
				const savedTags = (reparsed.tags ?? []).flatMap((col) => col.tags);
				expect(
					savedTags.some((t) => t.name === 'REVIEW_STATUS' && t.value === 'approved'),
				).toBeTruthy();
			} finally {
				reparser.dispose();
			}
		} finally {
			handler.dispose();
		}
	});

	it('keeps tagCollections a required member of the serialize/export inputs', () => {
		expectTypeOf<UseSerializeInput['tagCollections']>().toEqualTypeOf<PptxTagCollection[]>();
		expectTypeOf<UseExportHandlersInput['tagCollections']>().toEqualTypeOf<
			Array<Record<string, unknown>>
		>();
	});
});
