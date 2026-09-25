/**
 * Generates `ribbon-galleries.pptx`: one slide with a red rectangle
 * ("GALLERY SHAPE"), a 3x3 table and a clustered column chart, so the
 * ribbon-galleries spec can bring up the Shape Format, Table Design and
 * Chart Design contextual tabs in every binding.
 *
 * Re-runnable; globalSetup invokes it.
 */
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { PptxHandler } from 'pptx-viewer-core';

import { writeFixtureDeterministic } from './write-fixture';

const __dirname = dirname(fileURLToPath(import.meta.url));

export async function generateRibbonGalleriesFixture(): Promise<string> {
	const { handler, data, createSlide } = await PptxHandler.createBlank({
		title: 'Ribbon Galleries Fixture',
		initialSlideCount: 0,
	});
	const cells = (row: string) => ['A', 'B', 'C'].map((col) => ({ text: `${row}${col}` }));
	data.slides.push(
		createSlide('Blank')
			.addShape('rect', {
				x: 60,
				y: 60,
				width: 240,
				height: 140,
				fill: { type: 'solid', color: '#FF0000' },
				text: 'GALLERY SHAPE',
			})
			.addTable(
				{ rows: [1, 2, 3].map((r) => ({ cells: cells(String(r)) })) },
				{
					x: 360,
					y: 60,
					width: 300,
					height: 140,
				},
			)
			.addChart(
				'bar',
				{
					categories: ['Q1', 'Q2', 'Q3'],
					series: [
						{ name: 'North', values: [4, 5, 6] },
						{ name: 'South', values: [3, 2, 5] },
						{ name: 'West', values: [6, 4, 3] },
					],
				},
				{ x: 60, y: 260, width: 400, height: 240 },
			)
			.build(),
	);
	const bytes = await handler.save(data.slides);
	const outPath = resolve(__dirname, 'ribbon-galleries.pptx');
	mkdirSync(dirname(outPath), { recursive: true });
	await writeFixtureDeterministic(outPath, bytes);
	return outPath;
}

const invokedDirectly =
	typeof process !== 'undefined' &&
	process.argv[1] &&
	process.argv[1].endsWith('generate-ribbon-galleries-fixture.ts');
if (invokedDirectly) {
	generateRibbonGalleriesFixture()
		.then((p) => console.log(`Wrote ${p}`))
		.catch((err) => {
			console.error(err);
			process.exit(1);
		});
}
