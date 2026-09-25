/**
 * Tests for `parseAction`/`parseElementActions` (issue G14: CT_Hyperlink's
 * `@endSnd`, PowerPoint's "Stop previous sound" checkbox, was read nowhere).
 *
 * `parseAction` is protected on a deeply chained mixin, so it is reached by
 * instantiating the concrete runtime, mirroring the sibling
 * `PptxHandlerRuntimeElementActions.test.ts`.
 */
import { describe, it, expect } from 'vitest';

import type { PptxAction, XmlObject } from '../../types';
import { PptxHandlerRuntime } from './PptxHandlerRuntimeImplementation';

interface RuntimeWithProtected {
	parseAction(
		hlinkNode: XmlObject | undefined,
		slideRelationshipMap: Map<string, string> | undefined,
		slidePaths: string[],
	): PptxAction | undefined;
}

const runtime = new PptxHandlerRuntime() as unknown as RuntimeWithProtected;
const parseAction = (hlinkNode: XmlObject | undefined) =>
	runtime.parseAction(hlinkNode, undefined, []);

describe('parseAction - a:hlinkClick/@endSnd (issue G14)', () => {
	it('parses endSnd="1" into action.endSnd', () => {
		const action = parseAction({ '@_r:id': 'rId3', '@_endSnd': '1' });
		expect(action?.endSnd).toBeTruthy();
	});

	it('parses endSnd="true" into action.endSnd', () => {
		const action = parseAction({ '@_r:id': 'rId3', '@_endSnd': 'true' });
		expect(action?.endSnd).toBeTruthy();
	});

	it('leaves endSnd unset when the attribute is absent', () => {
		const action = parseAction({ '@_r:id': 'rId3' });
		expect(action?.endSnd).toBeUndefined();
	});

	it('leaves endSnd unset for endSnd="0"', () => {
		const action = parseAction({ '@_r:id': 'rId3', '@_endSnd': '0' });
		expect(action?.endSnd).toBeUndefined();
	});

	it('recognises a node carrying only @_endSnd (no rId/action/tooltip)', () => {
		// The presence guard used to check only rId/action/tooltip, so a
		// stray hlinkClick with just endSnd would parse as "no action".
		const action = parseAction({ '@_endSnd': '1' });
		expect(action?.endSnd).toBeTruthy();
	});

	it('round-trips endSnd alongside highlightClick', () => {
		const action = parseAction({ '@_r:id': 'rId5', '@_highlightClick': '1', '@_endSnd': '1' });
		expect(action?.highlightClick).toBeTruthy();
		expect(action?.endSnd).toBeTruthy();
	});
});

interface RuntimeWithFillVariants {
	extractTextFillVariants(rPr: XmlObject | undefined): {
		textFillGradient?: string;
		textFillPattern?: string;
		textFillBlipXml?: XmlObject;
	};
}

const fillRuntime = new PptxHandlerRuntime() as unknown as RuntimeWithFillVariants;

describe('extractTextFillVariants - a:blipFill (picture text fill)', () => {
	// Regression: this method's own doc comment claimed "Handles gradient
	// fills, pattern fills, and image fills on text runs", but only the first
	// two branches existed; `a:blipFill` was silently dropped, so a
	// picture-filled run fell through to its plain `color` and rendered solid
	// black (COM-verified: audit-text slide 13's "PICTURE FILL" run).
	it('captures the raw a:blipFill node for later async resolution', () => {
		const blipFill: XmlObject = {
			'a:blip': { '@_r:embed': 'rIdImg' },
			'a:stretch': { 'a:fillRect': {} },
		};
		const result = fillRuntime.extractTextFillVariants({ 'a:blipFill': blipFill });
		expect(result.textFillBlipXml).toBe(blipFill);
	});

	it('leaves textFillBlipXml unset when the run has no a:blipFill', () => {
		const result = fillRuntime.extractTextFillVariants({ 'a:solidFill': {} });
		expect(result.textFillBlipXml).toBeUndefined();
	});
});
