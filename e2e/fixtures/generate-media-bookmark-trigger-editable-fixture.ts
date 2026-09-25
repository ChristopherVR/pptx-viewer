/**
 * Generates `media-bookmark-trigger-editable.pptx` for
 * `e2e/media-bookmark-trigger.spec.ts`: the COM-authored
 * `media-bookmark-trigger.pptx` (a video with bookmarks BM1/BM2, "Bookmark
 * Target" fading in on BM1) plus an editor-owned Fade entrance on "Second
 * Shape", so every binding's animation panel shows its timing controls for
 * that shape without the spec having to drive five different "add effect"
 * flows first.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

/** Text of the shape the spec re-triggers. */
export const BOOKMARK_SECOND_SHAPE_TEXT = 'Second';

export async function generateFixture(): Promise<string> {
	const source = readFileSync(resolve(__dirname, 'media-bookmark-trigger.pptx'));
	const handler = new PptxHandler();
	const data = await handler.load(
		source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength) as ArrayBuffer,
	);
	const slide = data.slides[0];
	const second = slide?.elements.find((element) => element.name === 'Second Shape');
	if (!slide || !second) {
		throw new Error('media-bookmark-trigger.pptx no longer has its "Second Shape"');
	}
	slide.animations = [
		{ elementId: second.id, entrance: 'fadeIn', trigger: 'onClick', durationMs: 500, order: 0 },
	];
	slide.isDirty = true;
	const bytes = await handler.save(data.slides);
	const outPath = resolve(__dirname, 'media-bookmark-trigger-editable.pptx');
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-media-bookmark-trigger-editable-fixture.ts');
if (invokedDirectly) {
	generateFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
