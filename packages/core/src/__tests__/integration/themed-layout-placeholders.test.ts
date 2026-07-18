import fs from 'node:fs';
import path from 'node:path';

import { beforeAll, describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxData, PptxElement } from '../../core/types';

/**
 * Integration regression for issue #66 ("The background theme does not load
 * when this slide is opened", Algebra 1.pptx).
 *
 * Two distinct bugs dropped content from this "Balloons"-themed deck:
 *
 *  1. The themed background artwork is a top-level `<p:grpSp>` on the slide
 *     layout / master. Layout & master element parsing skipped `p:grpSp`
 *     entirely, so the decorative background never rendered.
 *
 *  2. The layout placeholders carry an empty `<p:spPr/>` (no `a:xfrm`) and
 *     inherit their geometry from the master placeholder. The layout/master
 *     placeholder merge let that empty string clobber the master's populated
 *     `p:spPr`, so slide placeholders resolved no position and every slide's
 *     title/body text box was dropped.
 */
describe('themed layout placeholders + grouped background (issue #66)', () => {
	const fixturePath = path.resolve(__dirname, '../fixtures/themed-layout-placeholders.pptx');
	const hasFixture = fs.existsSync(fixturePath);

	// Parse the deck once: the 111 KB "Balloons" master/layout are expensive to
	// re-parse and doing it per-test times out under full-suite CPU contention.
	let data: PptxData;
	beforeAll(async () => {
		if (!hasFixture) {
			return;
		}
		const bytes = fs.readFileSync(fixturePath);
		const buffer = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
		data = await new PptxHandler().load(buffer);
	}, 30_000);

	function ownText(element: PptxElement): string {
		if (element.type !== 'text') {
			return '';
		}
		const segments = (element as { segments?: Array<{ text?: string }> }).segments;
		if (segments) {
			return segments.map((s) => s.text ?? '').join('');
		}
		return (element as { text?: string }).text ?? '';
	}

	function countLeaves(element: PptxElement): number {
		if (element.type === 'group') {
			const children = (element as { children?: PptxElement[] }).children ?? [];
			return children.reduce((sum, child) => sum + countLeaves(child), 0);
		}
		return 1;
	}

	it.skipIf(!hasFixture)(
		'renders every slide placeholder text box (inherited master geometry)',
		() => {
			expect(data.slides).toHaveLength(10);

			for (const [index, slide] of data.slides.entries()) {
				const ownElements = slide.elements.filter(
					(element) => !/^(layout|master)-/u.test(element.id),
				);
				// Every slide in this deck has a title + body placeholder. Before
				// the fix, empty-spPr layout placeholders wiped the inherited
				// master geometry and these were dropped (0 own elements).
				expect(
					ownElements.length,
					`slide ${index + 1} lost its placeholder text boxes`,
				).toBeGreaterThanOrEqual(2);
				const text = ownElements.map(ownText).join(' ');
				expect(text.trim().length, `slide ${index + 1} has no rendered text`).toBeGreaterThan(0);
			}
		},
	);

	it.skipIf(!hasFixture)('renders the grouped themed background from the layout/master', () => {
		for (const [index, slide] of data.slides.entries()) {
			const backgroundGroups = slide.elements.filter(
				(element) => element.type === 'group' && /^(layout|master)-/u.test(element.id),
			);
			expect(
				backgroundGroups.length,
				`slide ${index + 1} is missing its themed background group`,
			).toBeGreaterThanOrEqual(1);
			const decorativeShapes = backgroundGroups.reduce((sum, group) => sum + countLeaves(group), 0);
			expect(decorativeShapes, `slide ${index + 1} background group is empty`).toBeGreaterThan(10);
		}
	});

	it.skipIf(!hasFixture)('keeps complete custom-geometry paths on the balloon freeforms', () => {
		// The balloon freeforms are custGeom paths with dozens of lnTo segments.
		// A command-order misalignment used to truncate them to ~4 points, so
		// they rendered as tiny slivers. Assert at least one background shape
		// keeps its full path.
		const groups = data.slides[0].elements.filter(
			(element) => element.type === 'group' && /^(layout|master)-/u.test(element.id),
		);
		let maxSegments = 0;
		const visit = (element: PptxElement): void => {
			if (element.type === 'group') {
				for (const child of (element as { children?: PptxElement[] }).children ?? []) {
					visit(child);
				}
				return;
			}
			const geometryPaths = (element as { customGeometryPaths?: Array<{ segments?: unknown[] }> })
				.customGeometryPaths;
			for (const geometryPath of geometryPaths ?? []) {
				maxSegments = Math.max(maxSegments, geometryPath.segments?.length ?? 0);
			}
		};
		for (const group of groups) {
			visit(group);
		}
		expect(maxSegments, 'balloon custom-geometry path was truncated').toBeGreaterThan(30);
	});

	it.skipIf(!hasFixture)('parses each large layout/master part once, not per slide', async () => {
		// Background resolution used to re-read and re-parse the (large) layout
		// and master XML for every slide, making themed-deck load O(slides) in
		// the ~200 KB master (~28 large parses for these 10 slides). It is now a
		// small constant (the master and layout1 are each parsed a few times by
		// distinct one-time consumers), independent of slide count. A bound well
		// under the per-slide count guards against the regression returning.
		const bytes = fs.readFileSync(fixturePath);
		const buffer = bytes.buffer.slice(
			bytes.byteOffset,
			bytes.byteOffset + bytes.byteLength,
		) as ArrayBuffer;
		const handler = new PptxHandler();
		const runtime = (
			handler as unknown as {
				runtime: { parser: { parse(xml: string, opt?: unknown): unknown } };
			}
		).runtime;
		const originalParse = runtime.parser.parse.bind(runtime.parser);
		let largeParses = 0;
		runtime.parser.parse = (xml: string, opt?: unknown): unknown => {
			if (typeof xml === 'string' && xml.length > 100_000) {
				largeParses += 1;
			}
			return opt === undefined ? originalParse(xml) : originalParse(xml, opt);
		};
		await handler.load(buffer);
		expect(largeParses, 'large layout/master XML was re-parsed per slide').toBeLessThanOrEqual(8);
	});
});
