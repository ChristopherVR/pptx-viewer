/**
 * Generates `run-program-action.pptx` - a single slide holding one rectangle
 * whose click action is PowerPoint's "Run program" (`ppaction://program`),
 * for `e2e/run-program-notice.spec.ts`.
 *
 * `pptx-viewer-core`'s SDK builder has no dedicated helper for authoring an
 * Action Settings click (there is no `ShapeOptions.actionClick`), so the
 * shape is built plain and then patched with `actionClick` directly before
 * being pushed onto the slide, mirroring the round-trip shape
 * `elementActionToPptxAction` produces for `ElementActionType: 'runProgram'`
 * (`packages/core/src/core/utils/element-actions.ts`): `action:
 * 'ppaction://program'` plus a `url` carrying the free-text "Program to
 * run:" command string PowerPoint stores as one opaque string (no separate
 * arguments field).
 *
 * Re-runnable; `global-setup.ts` invokes it on every Playwright run.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

import {
	RUN_PROGRAM_COMMAND,
	RUN_PROGRAM_SHAPE_SIZE,
	RUN_PROGRAM_SHAPE_X,
	RUN_PROGRAM_SHAPE_Y,
} from './run-program-fixture-constants';
import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function generateRunProgramFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Run Program Action Fixture',
		initialSlideCount: 0,
	});

	// The action shape is added FIRST, so it is `-shape-0` and the spec can
	// address it without guessing at element numbering.
	const slide = createSlide('Blank')
		.addShape('rect', {
			x: RUN_PROGRAM_SHAPE_X,
			y: RUN_PROGRAM_SHAPE_Y,
			width: RUN_PROGRAM_SHAPE_SIZE,
			height: RUN_PROGRAM_SHAPE_SIZE,
			fill: { type: 'solid', color: '#2E7D32' },
		})
		.addText('Run Program Action', {
			x: 60,
			y: 40,
			width: 600,
			height: 60,
			fontSize: 28,
			bold: true,
		})
		.build();

	const shape = slide.elements[0];
	shape.actionClick = { action: 'ppaction://program', url: RUN_PROGRAM_COMMAND };
	data.slides.push(slide);

	const bytes = await handler.save(data.slides);

	const outPath = resolve(__dirname, 'run-program-action.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

// Allow running directly (basename comparison; see the format-painter generator).
const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-run-program-fixture.ts');
if (invokedDirectly) {
	generateRunProgramFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
