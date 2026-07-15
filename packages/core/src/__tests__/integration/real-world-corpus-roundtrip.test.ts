import { describe, expect, it } from 'vitest';

import type { ChartPptxElement, MediaPptxElement, OlePptxElement } from '../../core/types/elements';
import type { PptxSlide } from '../../core/types/presentation';
import {
	elementText,
	elementTypes,
	expectCloseGeometry,
	findAllElements,
	listCorpusFixtures,
	loadSaveReload,
	REQUIRED_CORPUS_FIXTURES,
} from './real-world-corpus-helpers';

/**
 * Real-world corpus round-trip harness.
 *
 * Every fixture under `fixtures/corpus/` is a genuine `.pptx` authored by
 * PowerPoint itself via COM automation (`PowerPoint.Application`), not a
 * synthetic `PresentationBuilder` deck. Unlike the rest of this directory
 * (which builds minimal in-memory decks and therefore only proves the code
 * round-trips its own assumptions), this suite loads real OpenXML emitted by
 * real PowerPoint, saves it back out through the public `PptxHandler` API,
 * reloads the saved bytes, and diffs the two loads structurally. See
 * `fixtures/corpus/README.md` for what each fixture covers.
 *
 * A mismatch here that is not called out as an intentional, narrow exception
 * below is a genuine fidelity bug, not a test bug.
 */
describe('real-world corpus round-trip', () => {
	const fixtures = listCorpusFixtures();

	it('contains every required PowerPoint-authored interoperability deck', () => {
		expect(fixtures).toStrictEqual([...REQUIRED_CORPUS_FIXTURES]);
	});

	describe.each(fixtures)('%s', (fileName) => {
		it('preserves slide count, element counts/types, geometry, and text', async () => {
			const { original, reloaded } = await loadSaveReload(fileName);

			expect(reloaded).toHaveLength(original.length);

			for (let i = 0; i < original.length; i++) {
				const origSlide = original[i];
				const reloadedSlide = reloaded[i];
				const ctx = `${fileName} slide ${i + 1}`;

				expect(reloadedSlide.elements).toHaveLength(origSlide.elements.length);
				expect(elementTypes(reloadedSlide), `${ctx} element types`).toStrictEqual(
					elementTypes(origSlide),
				);

				for (let j = 0; j < origSlide.elements.length; j++) {
					const a = origSlide.elements[j];
					const b = reloadedSlide.elements[j];
					const elCtx = `${ctx} element ${j} (${a.type})`;

					expectCloseGeometry(b.x, a.x, `${elCtx} x`);
					expectCloseGeometry(b.y, a.y, `${elCtx} y`);
					expectCloseGeometry(b.width, a.width, `${elCtx} width`);
					expectCloseGeometry(b.height, a.height, `${elCtx} height`);

					const origText = elementText(a);
					if (origText !== undefined) {
						expect(elementText(b), `${elCtx} text`).toBe(origText);
					}
				}
			}
		});
	});

	// -------------------------------------------------------------------------
	// Fixture-specific invariants
	// -------------------------------------------------------------------------

	const hasFixture = (name: string): boolean => fixtures.includes(name);

	it.skipIf(!hasFixture('smartart-chart-table-mix.pptx'))(
		'smartArt + chart + table deck: chart series, table cells, and SmartArt node text survive',
		async () => {
			const { original, reloaded } = await loadSaveReload('smartart-chart-table-mix.pptx');

			const chartA = findAllElements(original, 'chart')[0] as ChartPptxElement | undefined;
			const chartB = findAllElements(reloaded, 'chart')[0] as ChartPptxElement | undefined;
			expect(chartA?.chartData?.categories).toStrictEqual(chartB?.chartData?.categories);
			expect(chartA?.chartData?.series).toStrictEqual(chartB?.chartData?.series);

			const tableA = findAllElements(original, 'table')[0];
			const tableB = findAllElements(reloaded, 'table')[0];
			const cellTexts = (el: typeof tableA) =>
				el && 'tableData' in el
					? el.tableData?.rows.flatMap((r) => r.cells.map((c) => c.text))
					: undefined;
			expect(cellTexts(tableB)).toStrictEqual(cellTexts(tableA));

			const smartArtsA = findAllElements(original, 'smartArt');
			const smartArtsB = findAllElements(reloaded, 'smartArt');
			expect(smartArtsB).toHaveLength(smartArtsA.length);
			expect(smartArtsA.length).toBeGreaterThanOrEqual(4); // process, cycle, hierarchy, pyramid
			for (let i = 0; i < smartArtsA.length; i++) {
				const drawingShapesA =
					'smartArtData' in smartArtsA[i] ? smartArtsA[i].smartArtData?.drawingShapes : undefined;
				const drawingShapesB =
					'smartArtData' in smartArtsB[i] ? smartArtsB[i].smartArtData?.drawingShapes : undefined;
				expect(drawingShapesA?.length, `smartArt #${i} original cached shapes`).toBeGreaterThan(0);
				expect(
					drawingShapesB?.map((shape) => shape.shapeType),
					`smartArt #${i} cached geometry`,
				).toStrictEqual(drawingShapesA?.map((shape) => shape.shapeType));
				const nodesA =
					'smartArtData' in smartArtsA[i]
						? smartArtsA[i].smartArtData?.nodes.map((n) => n.text)
						: undefined;
				const nodesB =
					'smartArtData' in smartArtsB[i]
						? smartArtsB[i].smartArtData?.nodes.map((n) => n.text)
						: undefined;
				expect(nodesB, `smartArt #${i} node text`).toStrictEqual(nodesA);
			}
		},
	);

	it.skipIf(!hasFixture('master-layout-inheritance-fills.pptx'))(
		'master/layout deck: gradient and pattern fills survive on inherited-layout slides',
		async () => {
			const { original, reloaded } = await loadSaveReload('master-layout-inheritance-fills.pptx');

			const shapesA = findAllElements(original, 'shape');
			const shapesB = findAllElements(reloaded, 'shape');
			expect(shapesB).toHaveLength(shapesA.length);

			const gradientShapesA = shapesA.filter((s) => s.shapeStyle?.fillMode === 'gradient');
			const gradientShapesB = shapesB.filter((s) => s.shapeStyle?.fillMode === 'gradient');
			expect(gradientShapesB).toHaveLength(gradientShapesA.length);
			expect(gradientShapesA.length).toBeGreaterThanOrEqual(2);
			for (let i = 0; i < gradientShapesA.length; i++) {
				expect(gradientShapesB[i].shapeStyle?.fillGradientStops?.length).toBe(
					gradientShapesA[i].shapeStyle?.fillGradientStops?.length,
				);
			}

			const patternShapesA = shapesA.filter((s) => s.shapeStyle?.fillMode === 'pattern');
			const patternShapesB = shapesB.filter((s) => s.shapeStyle?.fillMode === 'pattern');
			expect(patternShapesB).toHaveLength(patternShapesA.length);
			expect(patternShapesA.length).toBeGreaterThanOrEqual(1);
			expect(patternShapesB[0].shapeStyle?.fillPatternPreset).toBe(
				patternShapesA[0].shapeStyle?.fillPatternPreset,
			);
		},
	);

	it.skipIf(!hasFixture('animations-transitions-multislide.pptx'))(
		'animations/transitions deck: per-slide transition type and native animation count survive',
		async () => {
			const { original, reloaded } = await loadSaveReload('animations-transitions-multislide.pptx');

			const transitionSlidesA = original.filter((s) => s.transition);
			const transitionSlidesB = reloaded.filter((s) => s.transition);
			// 5 of the 6 slides in this deck carry a distinct transition; the
			// title slide intentionally has none.
			expect(transitionSlidesA.length).toBeGreaterThanOrEqual(5);
			expect(transitionSlidesB).toHaveLength(transitionSlidesA.length);

			for (let i = 0; i < original.length; i++) {
				expect(reloaded[i].transition?.type, `slide ${i + 1} transition type`).toBe(
					original[i].transition?.type,
				);
				expect(reloaded[i].nativeAnimations?.length, `slide ${i + 1} native animation count`).toBe(
					original[i].nativeAnimations?.length,
				);
			}

			// Animation-to-shape linkage: every native animation must target a
			// shape that exists on the slide, keyed by the loaded `element.id`.
			// A real PowerPoint deck references shapes by their OOXML
			// `p:cNvPr/@id`; the loader reconciles that to the positional
			// `element.id` so playback can match an animation to its element.
			// This invariant must hold on the *reloaded* deck too, or the
			// linkage was lost across the save/reload round trip.
			const assertLinkage = (slides: PptxSlide[], label: string): number => {
				let checked = 0;
				for (let i = 0; i < slides.length; i++) {
					const elementIds = new Set(slides[i].elements.map((el) => el.id));
					for (const anim of slides[i].nativeAnimations ?? []) {
						if (anim.targetId === undefined) {
							continue;
						}
						expect(
							elementIds.has(anim.targetId),
							`${label} slide ${i + 1}: animation targetId "${anim.targetId}" resolves to an element.id`,
						).toBeTruthy();
						checked += 1;
					}
				}
				return checked;
			};

			const linkedOriginal = assertLinkage(original, 'original');
			// The deck genuinely animates shapes; guard against a vacuous pass.
			expect(linkedOriginal).toBeGreaterThanOrEqual(3);
			expect(assertLinkage(reloaded, 'reloaded')).toBe(linkedOriginal);
		},
	);

	it.skipIf(!hasFixture('ole-embedded-media.pptx'))(
		'ole/media deck: progId + embedded payload and media type survive (not "unknown"/"shape")',
		async () => {
			const { original, reloaded } = await loadSaveReload('ole-embedded-media.pptx');

			const olesA = findAllElements(original, 'ole') as OlePptxElement[];
			const olesB = findAllElements(reloaded, 'ole') as OlePptxElement[];
			expect(olesA.length).toBeGreaterThanOrEqual(2); // Excel + Word
			expect(olesB).toHaveLength(olesA.length);
			for (let i = 0; i < olesA.length; i++) {
				expect(olesB[i].oleProgId, `ole #${i} progId`).toBe(olesA[i].oleProgId);
				expect(Boolean(olesB[i].oleEmbeddedData), `ole #${i} embedded payload present`).toBe(
					Boolean(olesA[i].oleEmbeddedData),
				);
			}

			const mediaA = findAllElements(original, 'media') as MediaPptxElement[];
			const mediaB = findAllElements(reloaded, 'media') as MediaPptxElement[];
			expect(mediaA.length).toBeGreaterThanOrEqual(2); // video + audio
			expect(mediaB).toHaveLength(mediaA.length);
			for (let i = 0; i < mediaA.length; i++) {
				expect(mediaB[i].mediaType, `media #${i} mediaType`).toBe(mediaA[i].mediaType);
			}

			// Regression guard: real PowerPoint represents video/audio as
			// `<p:pic>` (poster blip + p14:media extension), not
			// `<p:graphicFrame>`. Confirm neither slide degrades into a
			// generic "shape" or "unknown" element on reload.
			const typesAfter = reloaded.flatMap((s: PptxSlide) => elementTypes(s));
			expect(typesAfter).not.toContain('unknown');
		},
	);

	it.skipIf(!hasFixture('preset-geometry-wordart.pptx'))(
		'preset geometry + WordArt deck: uncommon autoshape presets and text-warp geometry survive',
		async () => {
			const { original, reloaded } = await loadSaveReload('preset-geometry-wordart.pptx');

			const shapesA = findAllElements(original, 'shape');
			const shapesB = findAllElements(reloaded, 'shape');
			const presetsA = shapesA.map((s) => s.shapeType).filter(Boolean);
			const presetsB = shapesB.map((s) => s.shapeType).filter(Boolean);
			expect(presetsB).toStrictEqual(presetsA);
			// Uncommon presets exercised via real msoAutoShapeType ids (arrows,
			// callouts, stars, banners, ribbons).
			expect(presetsA).toStrictEqual(
				expect.arrayContaining([
					'rightArrow',
					'star5',
					'wedgeRectCallout',
					'wedgeRoundRectCallout',
					'ribbon2',
					'chevron',
				]),
			);

			const textsA = findAllElements(original, 'text');
			const textsB = findAllElements(reloaded, 'text');
			const warpsA = textsA.map((t) => t.textStyle?.textWarpPreset).filter(Boolean);
			const warpsB = textsB.map((t) => t.textStyle?.textWarpPreset).filter(Boolean);
			expect(warpsB).toStrictEqual(warpsA);
			// Real `TextFrame2.WarpFormat`-authored presets (the legacy
			// `AddTextEffect` WordArt gallery does not emit `a:prstTxWarp` at
			// all -- see fixtures/corpus/README.md).
			expect(warpsA.length).toBeGreaterThanOrEqual(5);
		},
	);
});
