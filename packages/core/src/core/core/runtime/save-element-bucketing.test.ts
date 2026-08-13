/**
 * Shape-tree bucketing on save: the tag a slide element is emitted under must
 * match the markup it actually carries.
 *
 * The defect this pins: `parseShapeWithImageFill` reports a `<p:sp>` whose
 * `p:spPr` carries an `<a:blipFill>` (a shape with a picture FILL) as
 * `type: 'picture'`, and the save writer bucketed on that type alone. The
 * shape body was therefore re-labelled `<p:pic>` while keeping `p:nvSpPr`,
 * `p:style` and `p:txBody` and carrying no `p:blipFill` at all - three
 * simultaneous violations of `CT_Picture` (ECMA-376 S19.3.1.37, whose content
 * model is the sequence `nvPicPr, blipFill, spPr`). PowerPoint refused to open
 * the whole package.
 *
 * These drive the real `PptxHandler` against a real fixture rather than
 * re-implementing the bucketing, because the bug was invisible at the unit
 * level: every factory produced correct markup, and only the routing between
 * them was wrong.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import JSZip from 'jszip';
import { beforeAll, describe, expect, it } from 'vitest';

import { PptxHandler } from '../../PptxHandler';

/** Same deck as `issue-132-hr-deck.pptx`, slimmed of its media payloads. */
const FIXTURE = 'issue-132-gradient-fill.pptx';

/** Slide part -> `p:cNvPr/@id` of the blipFill-filled `<p:sp>` it contains. */
const BLIP_FILLED_SHAPES: ReadonlyArray<{ part: string; shapeId: string; geometry: string }> = [
	{ part: 'ppt/slides/slide18.xml', shapeId: '52', geometry: 'ellipse' },
	{ part: 'ppt/slides/slide20.xml', shapeId: '44', geometry: 'rect' },
];

function fixturePath(name: string): string {
	return fileURLToPath(new URL(`../../../../../../e2e/fixtures/${name}`, import.meta.url));
}

async function saveFixture(): Promise<JSZip> {
	const bytes = readFileSync(fixturePath(FIXTURE));
	const handler = new PptxHandler();
	const data = await handler.load(
		bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer,
	);
	return JSZip.loadAsync(await handler.save(data.slides));
}

/** Every slide part in a saved package, keyed by part name. */
async function slideParts(zip: JSZip): Promise<Map<string, string>> {
	const parts = new Map<string, string>();
	for (const name of Object.keys(zip.files)) {
		if (zip.files[name].dir || !/^ppt\/slides\/slide\d+\.xml$/u.test(name)) {
			continue;
		}
		parts.set(name, await zip.files[name].async('string'));
	}
	return parts;
}

/**
 * Bodies of every `<p:pic>` in a slide part. The serializer emits no
 * whitespace between tags, so a simple depth scan is exact.
 */
function pictureBodies(xml: string): string[] {
	const bodies: string[] = [];
	let cursor = 0;
	for (;;) {
		const start = xml.indexOf('<p:pic>', cursor);
		if (start < 0) {
			return bodies;
		}
		let depth = 0;
		let i = start;
		while (i < xml.length) {
			if (xml.startsWith('<p:pic>', i)) {
				depth += 1;
				i += '<p:pic>'.length;
				continue;
			}
			if (xml.startsWith('</p:pic>', i)) {
				depth -= 1;
				i += '</p:pic>'.length;
				if (depth === 0) {
					break;
				}
				continue;
			}
			i += 1;
		}
		bodies.push(xml.slice(start + '<p:pic>'.length, i - '</p:pic>'.length));
		cursor = i;
	}
}

describe('save shape-tree bucketing', () => {
	// One load -> save for the whole suite: the fixture is a real 29-slide deck
	// and re-saving it per assertion overran the default 5s test timeout when
	// the file ran alongside the rest of the package.
	let parts: Map<string, string>;
	beforeAll(async () => {
		parts = await slideParts(await saveFixture());
	}, 60000);

	it('keeps a picture-FILLED shape as <p:sp>, not <p:pic>', () => {
		for (const { part, shapeId, geometry } of BLIP_FILLED_SHAPES) {
			const xml = parts.get(part);
			expect(xml, `${part} missing from the saved package`).toBeDefined();
			const owner = pictureBodies(xml!).find((body) => body.includes(`<p:cNvPr id="${shapeId}"`));
			expect(
				owner,
				`${part}: the ${geometry} with a picture fill (cNvPr id=${shapeId}) was emitted as <p:pic>`,
			).toBeUndefined();
			expect(xml).toContain(`<p:cNvPr id="${shapeId}"`);
		}
	});

	it('emits no <p:pic> that violates CT_Picture', () => {
		// CT_Picture is the sequence `nvPicPr, blipFill, spPr`. A shape's
		// non-visual container, style or text body inside one means a `<p:sp>`
		// was re-labelled rather than converted.
		const FOREIGN_MEMBERS = ['<p:nvSpPr>', '<p:style>', '<p:txBody>'];
		const violations: string[] = [];
		let inspected = 0;
		for (const [part, xml] of parts) {
			for (const body of pictureBodies(xml)) {
				inspected += 1;
				for (const member of FOREIGN_MEMBERS) {
					if (body.includes(member)) {
						violations.push(`${part}: <p:pic> carries ${member}`);
					}
				}
				if (!body.includes('<p:nvPicPr>')) {
					violations.push(`${part}: <p:pic> has no p:nvPicPr`);
				}
			}
		}
		expect(violations).toStrictEqual([]);
		expect(inspected, 'fixture produced no <p:pic> to inspect').toBeGreaterThan(0);
	});

	it('emits no negative @dir anywhere (ST_PositiveFixedAngle)', () => {
		for (const [part, xml] of parts) {
			expect(xml.match(/ dir="-\d+"/gu), `${part}: negative @dir`).toBeNull();
		}
	});
});
