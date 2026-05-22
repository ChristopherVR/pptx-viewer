/**
 * Generates `format-painter.pptx` — a single-slide deck with two distinctly
 * styled rectangle shapes used by the format-painter e2e spec.
 *
 *   SOURCE: red fill, navy stroke, bold white text.
 *   TARGET: plain grey fill, default stroke.
 *
 * Re-runnable; the spec invokes it from globalSetup.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function generateFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Format Painter Fixture',
		initialSlideCount: 0,
	});

	data.slides.push(
		createSlide('Blank')
			.addShape('rect', {
				x: 100,
				y: 100,
				width: 200,
				height: 150,
				fill: { type: 'solid', color: '#FF0000' },
				stroke: { color: '#001F3F', width: 3 },
				text: 'SOURCE',
				textStyle: { bold: true, color: '#FFFFFF', fontSize: 28 },
			})
			.addShape('rect', {
				x: 500,
				y: 100,
				width: 200,
				height: 150,
				fill: { type: 'solid', color: '#CCCCCC' },
				text: 'TARGET',
			})
			.build(),
	);

	const bytes = await handler.save(data.slides);
	const outPath = resolve(__dirname, 'format-painter.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	writeFileSync(outPath, bytes);
	return outPath;
}

// Allow running directly. The `import.meta.url` vs `process.argv[1]` shape
// differs subtly on Windows, so we just check whether this module is the
// entrypoint by comparing basenames.
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-format-painter-fixture.ts');
if (invokedDirectly) {
	generateFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
