/**
 * `getMasterElements` must not replace the cached parse of a master part.
 *
 * This is the master-side twin of the layout defect fixed in
 * `getLayoutElements`: elements handed to the viewer keep `rawXml` nodes
 * belonging to whichever parse produced them, and the save writer routes an
 * inherited template edit back by patching that node IN PLACE. Re-parsing the
 * part and pointing `masterXmlMap` at the new tree makes every such edit a
 * silent no-op, because `ensureTemplateShapeAttached` matches the twin node in
 * the replacement tree by `p:cNvPr` identity and returns it, throwing the
 * patched one away.
 *
 * Nothing in the shipping code drops `masterCache` for a single path today
 * (unlike `getLayoutPreview`, which drops the layout element cache), so the
 * defect is latent rather than live. The test therefore drops the cache the way
 * a future caller would, which is exactly the reachability this guards against.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import { describe, it, expect } from 'vitest';

import type { PptxElement, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

/** Structural view of the internals under test. */
interface RuntimeWithMasterCaches {
	load(buffer: ArrayBuffer): Promise<unknown>;
	getMasterElements(layoutPath: string): Promise<PptxElement[]>;
	masterXmlMap: Map<string, XmlObject>;
	masterCache: Map<string, PptxElement[]>;
	slideRelsMap: Map<string, Map<string, string>>;
}

function fixtureBuffer(): ArrayBuffer {
	const path = join(__dirname, '../../../../../../e2e/fixtures/template-editing.pptx');
	const bytes = readFileSync(path);
	return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

describe('getMasterElements master-part parse caching', () => {
	it('reuses the cached parse instead of replacing masterXmlMap', async () => {
		const runtime = new PptxHandlerRuntime() as unknown as RuntimeWithMasterCaches;
		await runtime.load(fixtureBuffer());

		const layoutPath = [...runtime.slideRelsMap.keys()].find((p) =>
			p.includes('slideLayouts/slideLayout'),
		);
		expect(layoutPath).toBeDefined();

		await runtime.getMasterElements(layoutPath!);
		const masterPath = [...runtime.masterCache.keys()].find((p) => p.includes('slideMaster'));
		expect(masterPath).toBeDefined();

		const treeBefore = runtime.masterXmlMap.get(masterPath!);
		expect(treeBefore).toBeDefined();

		// Force the re-read path a future caller would take.
		runtime.masterCache.delete(masterPath!);
		await runtime.getMasterElements(layoutPath!);

		// Identity, not deep equality: a fresh parse is deep-equal and still
		// breaks in-place patching.
		expect(runtime.masterXmlMap.get(masterPath!)).toBe(treeBefore);
	});
});
