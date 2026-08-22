/**
 * `dgm:pt/@type="parTrans"` connector text: parse + render-model + save
 * round-trip.
 *
 * `PptxHandlerRuntimeSmartArt.ts` excluded `parTrans`/`sibTrans` points from
 * `nodes` (correctly - they carry no user-editable CONTENT), but their text
 * was preserved XML-verbatim only, invisible to any typed consumer. This
 * exercises the fix (`smartart-connector-labels.ts` parsing/writing the
 * label, `smartart-hierarchy-shared.ts` surfacing it on the rendered
 * connector) against a REAL PowerPoint-authored hierarchy diagram
 * (`smartart-chart-table-mix.pptx`, `ppt/diagrams/data3.xml` /
 * `layout3.xml`).
 *
 * That real fixture's own `parTrans` points carry NO text (PowerPoint users
 * essentially never type onto a connector), so the actual LABEL VALUE is
 * injected by this test rather than being present in the fixture; only the
 * surrounding data-model SHAPE (real `parTrans`/`sibTrans`/`cxn` structure)
 * comes from the real file.
 */

import { describe, expect, it } from 'vitest';

import { PptxHandler } from '../../core/PptxHandler';
import type { PptxElement, SmartArtPptxElement } from '../../core/types/elements';
import type { PptxSlide } from '../../core/types/presentation';
import { interpretSmartArtLayout } from '../../core/utils';
import { readCorpusFixture } from './real-world-corpus-helpers';

function everySmartArt(slides: PptxSlide[]): SmartArtPptxElement[] {
	const found: SmartArtPptxElement[] = [];
	for (const slide of slides) {
		for (const element of slide.elements as PptxElement[]) {
			if (element.type === 'smartArt') {
				found.push(element);
			}
		}
	}
	return found;
}

/** The hierarchy-family SmartArt in the fixture (`layout3.xml`, `hierRoot`/`hierChild`). */
function hierarchySmartArt(slides: PptxSlide[]): SmartArtPptxElement {
	const hierarchy = everySmartArt(slides).find(
		(el) => el.smartArtData?.resolvedLayoutType === 'hierarchy',
	);
	if (!hierarchy) {
		throw new Error('Fixture no longer contains a hierarchy SmartArt on layout3.xml');
	}
	return hierarchy;
}

describe('smartArt connector labels: real fixture (smartart-chart-table-mix.pptx)', () => {
	it('parses a parTrans connector label and surfaces it on the rendered connector', async () => {
		const handler = new PptxHandler();
		const loaded = await handler.load(readCorpusFixture('smartart-chart-table-mix.pptx'));
		const element = hierarchySmartArt(loaded.slides);
		const data = element.smartArtData!;
		const parOf = data.connections?.find(
			(c) => (!c.type || c.type === 'parOf') && c.parentTransitionId,
		);
		expect(parOf).toBeDefined();

		// Simulate the label a user typed onto this connector in PowerPoint's
		// own diagram editor (the real fixture's own parTrans points are empty).
		parOf!.label = 'reports to';

		const flat = data.nodes;
		const result = interpretSmartArtLayout({
			layoutDefinition: data.layoutDefinition,
			nodes: data.nodes,
			flat,
			box: { width: element.width, height: element.height },
			palette: ['#4472C4'],
			style: data.style ?? 'flat',
			elementId: 'test',
			presLayoutVars: data.presLayoutVars,
			connections: data.connections,
		});

		expect(result).toBeDefined();
		const labelled = result!.connectors.find((c) => c.text === 'reports to');
		expect(labelled).toBeDefined();
	});

	it('writes an edited connector label back onto the parTrans point and survives a save + reload', async () => {
		const handler = new PptxHandler();
		const loaded = await handler.load(readCorpusFixture('smartart-chart-table-mix.pptx'));
		const element = hierarchySmartArt(loaded.slides);
		const data = element.smartArtData!;
		const parOf = data.connections!.find(
			(c) => (!c.type || c.type === 'parOf') && c.parentTransitionId,
		)!;
		parOf.label = 'reports to';

		const saved = await handler.save(loaded.slides);
		const reloaded = await new PptxHandler().load(saved.buffer as ArrayBuffer);
		const reloadedElement = hierarchySmartArt(reloaded.slides);
		const reloadedConnection = reloadedElement.smartArtData!.connections!.find(
			(c) => c.parentTransitionId === parOf.parentTransitionId,
		);

		expect(reloadedConnection?.label).toBe('reports to');
	});
});
