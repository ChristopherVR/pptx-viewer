import { readFile } from 'node:fs/promises';
import { basename } from 'node:path';

import { PptxHandler } from 'pptx-viewer-core';

/** Resolve the seed slide's actual layout instead of assuming the first layout. */
export async function readFixtureLayout(path: string): Promise<{
	name: string;
	path: string;
	stem: string;
}> {
	const handler = new PptxHandler();
	const data = await handler.load(new Uint8Array(await readFile(path)).buffer);
	const layout = data.slideMasters
		?.flatMap((master) => master.layouts ?? [])
		.find((candidate) => candidate.path === data.slides[0]?.layoutPath);
	if (!layout?.path || !layout.name) {
		throw new Error(`Fixture ${path} has no named layout for its seed slide`);
	}
	return { name: layout.name, path: layout.path, stem: basename(layout.path, '.xml') };
}
