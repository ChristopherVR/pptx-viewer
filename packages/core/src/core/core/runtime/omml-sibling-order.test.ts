import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../../types';
import { PptxRuntimeDependencyFactory } from '../factories/PptxRuntimeDependencyFactory';
import { annotateOmmlSiblingOrder } from './omml-sibling-order';

/**
 * Order restoration for parsed OMML: interleaved construct/run sequences must
 * keep their document order through the collapsed fast-xml-parser shape (via
 * `#pptx-order-N` key markers) and serialize back to the original XML.
 */

const factory = new PptxRuntimeDependencyFactory();

/** a^2 + b^2 = c^2 : the canonical interleaved content sequence. */
const INTERLEAVED_OMATH =
	'<m:oMath>' +
	'<m:sSup><m:e><m:r><m:t>a</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>' +
	'<m:r><m:t>+</m:t></m:r>' +
	'<m:sSup><m:e><m:r><m:t>b</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>' +
	'<m:r><m:t>=</m:t></m:r>' +
	'<m:sSup><m:e><m:r><m:t>c</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>' +
	'</m:oMath>';

function parseSlide(xml: string): XmlObject {
	return factory.createParser().parse(xml) as XmlObject;
}

function findOmath(parsed: XmlObject): XmlObject {
	const stack: unknown[] = [parsed];
	while (stack.length > 0) {
		const current = stack.pop();
		if (!current || typeof current !== 'object') {
			continue;
		}
		if (Array.isArray(current)) {
			stack.push(...current);
			continue;
		}
		for (const [key, value] of Object.entries(current as XmlObject)) {
			if (key === 'm:oMath') {
				return value as XmlObject;
			}
			stack.push(value);
		}
	}
	throw new Error('no m:oMath found');
}

describe('annotateOmmlSiblingOrder', () => {
	it('rewrites interleaved oMath children into ordered keys', () => {
		const xml = `<p:sp><p:txBody><a:p><a14:m>${INTERLEAVED_OMATH}</a14:m></a:p></p:txBody></p:sp>`;
		const oMath = findOmath(parseSlide(xml));

		const keys = Object.keys(oMath);
		expect(keys).toStrictEqual([
			'm:sSup#pptx-order-0',
			'm:r#pptx-order-1',
			'm:sSup#pptx-order-2',
			'm:r#pptx-order-3',
			'm:sSup#pptx-order-4',
		]);
		expect(((oMath['m:r#pptx-order-1'] as XmlObject)['m:t'] as string).trim()).toBe('+');
		expect(((oMath['m:r#pptx-order-3'] as XmlObject)['m:t'] as string).trim()).toBe('=');
	});

	it('leaves grouped-by-tag oMath children in the compact shape', () => {
		const xml =
			'<a:p><a14:m><m:oMath>' +
			'<m:r><m:t>x</m:t></m:r><m:r><m:t>=</m:t></m:r>' +
			'<m:f><m:num><m:r><m:t>1</m:t></m:r></m:num><m:den><m:r><m:t>2</m:t></m:r></m:den></m:f>' +
			'</m:oMath></a14:m></a:p>';
		const oMath = findOmath(parseSlide(xml));

		expect(Object.keys(oMath)).toStrictEqual(['m:r', 'm:f']);
		expect(Array.isArray(oMath['m:r'])).toBeTruthy();
	});

	it('rewrites interleaved sequences nested inside construct arguments', () => {
		// numerator: a + b^2 + c (run, sSup, run interleaving inside m:num)
		const xml =
			'<a:p><a14:m><m:oMath><m:f><m:num>' +
			'<m:r><m:t>a</m:t></m:r><m:r><m:t>+</m:t></m:r>' +
			'<m:sSup><m:e><m:r><m:t>b</m:t></m:r></m:e><m:sup><m:r><m:t>2</m:t></m:r></m:sup></m:sSup>' +
			'<m:r><m:t>+</m:t></m:r><m:r><m:t>c</m:t></m:r>' +
			'</m:num><m:den><m:r><m:t>d</m:t></m:r></m:den></m:f></m:oMath></a14:m></a:p>';
		const oMath = findOmath(parseSlide(xml));
		const num = (oMath['m:f'] as XmlObject)['m:num'] as XmlObject;

		// Single-occurrence tags keep their plain key; repeated interleaved tags
		// get position markers. Insertion order carries the full sequence.
		expect(Object.keys(num)).toStrictEqual([
			'm:r#pptx-order-0',
			'm:r#pptx-order-1',
			'm:sSup',
			'm:r#pptx-order-3',
			'm:r#pptx-order-4',
		]);
	});

	it('round-trips the interleaved sequence through the builder unchanged', () => {
		const xml = `<a:p><a14:m>${INTERLEAVED_OMATH}</a14:m></a:p>`;
		const parsed = parseSlide(xml);
		const rebuilt = factory.createBuilder().build(parsed) as string;

		expect(rebuilt).toBe(xml);
		expect(rebuilt).not.toContain('#pptx-order-');
	});

	it('bails out safely when the raw scan cannot be paired with the parse', () => {
		// Deliberately mismatched: annotate against a different document.
		const parsed = parseSlide(`<a:p><a14:m>${INTERLEAVED_OMATH}</a14:m></a:p>`);
		expect(() =>
			annotateOmmlSiblingOrder('<m:oMath><m:r><m:t>x</m:t></m:r><m:f/><m:r/></m:oMath>', parsed),
		).not.toThrow();
	});
});
