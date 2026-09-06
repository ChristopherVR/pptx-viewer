import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { ContentPartInkStroke, XmlObject } from '../types';
import { buildInkMlContent, parseInkMlContent } from './inkml-content-part';

// Mirror the loader's parser options (see PptxRuntimeDependencyFactory): keep
// attribute prefixes and preserve element text verbatim so trace strings such
// as "128 240" survive intact.
const parser = new XMLParser({
	ignoreAttributes: false,
	attributeNamePrefix: '@_',
	parseAttributeValue: false,
	parseTagValue: false,
	trimValues: false,
});

function parse(xml: string): XmlObject {
	return parser.parse(xml) as XmlObject;
}

describe('parseInkMlContent - real PowerPoint InkML', () => {
	it('decodes a raw traceFormat/trace part into an SVG M..L.. path', () => {
		const xml = `<?xml version="1.0" encoding="UTF-8"?>
<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML">
  <inkml:definitions>
    <inkml:context xml:id="ctx0">
      <inkml:inkSource xml:id="inkSrc0">
        <inkml:traceFormat>
          <inkml:channel name="X" type="decimal"/>
          <inkml:channel name="Y" type="decimal"/>
          <inkml:channel name="F" type="integer" max="32767"/>
        </inkml:traceFormat>
      </inkml:inkSource>
    </inkml:context>
  </inkml:definitions>
  <inkml:trace>128 240 16383, 130 242 32767, 133 245 8191</inkml:trace>
</inkml:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		expect(strokes).toHaveLength(1);
		const [stroke] = strokes;
		expect(stroke.path).toBe('M 128 240 L 130 242 L 133 245');
		// The path must be usable SVG (starts with a moveto, only M/L/number).
		expect(stroke.path).toMatch(/^M[\s\d.-]+(?:L[\s\d.-]+)+$/);
		// F channel normalised to 0-1 from the 0..32767 integer range.
		expect(stroke.pressures).toBeDefined();
		expect(stroke.pressures?.[1]).toBeCloseTo(1, 3);
		expect(stroke.pressures?.[0]).toBeCloseTo(0.5, 2);
	});

	it('reads channel order from traceFormat (Y before X)', () => {
		const xml = `<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML">
  <inkml:traceFormat>
    <inkml:channel name="Y" type="decimal"/>
    <inkml:channel name="X" type="decimal"/>
  </inkml:traceFormat>
  <inkml:trace>10 20, 11 21</inkml:trace>
</inkml:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		// With Y first, the first column is Y and the second is X.
		expect(strokes[0].path).toBe('M 20 10 L 21 11');
	});

	it('defaults to X Y order when no traceFormat is present', () => {
		const xml = `<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML">
  <inkml:trace>5 6, 7 8</inkml:trace>
</inkml:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		expect(strokes[0].path).toBe('M 5 6 L 7 8');
	});

	it('decodes single-difference (velocity) encoded values', () => {
		// First point explicit, subsequent X/Y prefixed with a single quote
		// mean "add this delta to the previous value".
		const xml = `<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML">
  <inkml:traceFormat>
    <inkml:channel name="X"/>
    <inkml:channel name="Y"/>
  </inkml:traceFormat>
  <inkml:trace>100 100, '5 '10, '5 '10</inkml:trace>
</inkml:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		expect(strokes[0].path).toBe('M 100 100 L 105 110 L 110 120');
	});
});

describe('parseInkMlContent - pen tilt channels', () => {
	it('decodes OTx/OTy tilt-offset channels into per-point angle + magnitude', () => {
		const xml = `<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML">
  <inkml:traceFormat>
    <inkml:channel name="X" type="decimal"/>
    <inkml:channel name="Y" type="decimal"/>
    <inkml:channel name="OTx" type="decimal"/>
    <inkml:channel name="OTy" type="decimal"/>
  </inkml:traceFormat>
  <inkml:trace>0 0 10 0, 10 0 0 20, 20 0 0 0</inkml:trace>
</inkml:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		expect(strokes).toHaveLength(1);
		const [stroke] = strokes;
		expect(stroke.tiltAngles).toBeDefined();
		expect(stroke.tiltAngles).toHaveLength(3);
		// Point 0 leans purely along +X (OTx=10, OTy=0) => angle 0.
		expect(stroke.tiltAngles?.[0]).toBeCloseTo(0, 5);
		// Point 1 leans purely along +Y (OTx=0, OTy=20), the largest magnitude
		// in the trace => angle pi/2 and normalised magnitude 1.
		expect(stroke.tiltAngles?.[1]).toBeCloseTo(Math.PI / 2, 5);
		expect(stroke.tiltMagnitudes?.[1]).toBeCloseTo(1, 5);
		// Point 2 has no tilt offset at all => magnitude 0.
		expect(stroke.tiltMagnitudes?.[2]).toBeCloseTo(0, 5);
		// Point 0's magnitude is half of point 1's (10 vs 20 device units).
		expect(stroke.tiltMagnitudes?.[0]).toBeCloseTo(0.5, 5);
		// OTx/OTy is the default encoding: `tiltEncoding` is left unset for it
		// (only the non-default AZIMUTH/ALTITUDE case is flagged).
		expect(stroke.tiltEncoding).toBeUndefined();
	});

	it('decodes AZIMUTH/ALTITUDE channels into angle + magnitude', () => {
		const xml = `<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML">
  <inkml:traceFormat>
    <inkml:channel name="X" type="decimal"/>
    <inkml:channel name="Y" type="decimal"/>
    <inkml:channel name="AZIMUTH" type="decimal"/>
    <inkml:channel name="ALTITUDE" type="decimal"/>
  </inkml:traceFormat>
  <inkml:trace>0 0 90 45, 10 0 180 90</inkml:trace>
</inkml:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		const [stroke] = strokes;
		expect(stroke.tiltAngles).toHaveLength(2);
		// 90 degrees azimuth => pi/2 radians.
		expect(stroke.tiltAngles?.[0]).toBeCloseTo(Math.PI / 2, 5);
		// altitude 45 => magnitude 1 - 45/90 = 0.5.
		expect(stroke.tiltMagnitudes?.[0]).toBeCloseTo(0.5, 5);
		// altitude 90 (pen fully upright) => magnitude 0.
		expect(stroke.tiltMagnitudes?.[1]).toBeCloseTo(0, 5);
		// Recorded so a rewrite can re-declare AZIMUTH/ALTITUDE instead of
		// silently converting to OTx/OTy (see `buildInkMlContent`).
		expect(stroke.tiltEncoding).toBe('azimuthAltitude');
	});

	it('leaves tiltAngles undefined when the file declares no tilt channel', () => {
		const xml = `<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML">
  <inkml:trace>5 6, 7 8</inkml:trace>
</inkml:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		expect(strokes[0].tiltAngles).toBeUndefined();
		expect(strokes[0].tiltMagnitudes).toBeUndefined();
	});
});

describe('parseInkMlContent - authored (own) format', () => {
	it('uses the pre-built pva:path attribute verbatim', () => {
		const xml = `<ink:ink xmlns:ink="http://www.w3.org/2003/InkML" xmlns:pva="https://pptx-viewer.dev/inkml/metadata">
  <ink:traceFormat>
    <ink:channel name="X"/>
    <ink:channel name="Y"/>
    <ink:channel name="F"/>
  </ink:traceFormat>
  <ink:brush ink:id="brush1">
    <ink:brushProperty ink:name="color" ink:value="#ff0000"/>
    <ink:brushProperty ink:name="width" ink:value="3"/>
    <ink:brushProperty ink:name="opacity" ink:value="0.8"/>
  </ink:brush>
  <ink:trace ink:brushRef="#brush1" pva:path="M 1 2 L 3 4">1 2 0.5, 3 4 0.5</ink:trace>
</ink:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		expect(strokes).toHaveLength(1);
		expect(strokes[0].path).toBe('M 1 2 L 3 4');
		expect(strokes[0].color).toBe('#ff0000');
		expect(strokes[0].width).toBe(3);
		expect(strokes[0].opacity).toBeCloseTo(0.8, 5);
		// This trace's authored text has only the `x y pressure` triple (no
		// trailing `ox oy` pair), so it decodes with no tilt data, same as
		// before the OTx/OTy writer existed.
		expect(strokes[0].tiltAngles).toBeUndefined();
	});

	it('decodes a trailing ox/oy pair as authored tilt data', () => {
		const xml = `<ink:ink xmlns:ink="http://www.w3.org/2003/InkML" xmlns:pva="https://pptx-viewer.dev/inkml/metadata">
  <ink:trace pva:path="M 1 2 L 3 4">1 2 0.5 1 0, 3 4 0.5 0 1</ink:trace>
</ink:ink>`;
		const { strokes } = parseInkMlContent(parse(xml));
		expect(strokes[0].tiltAngles).toHaveLength(2);
		expect(strokes[0].tiltAngles?.[0]).toBeCloseTo(0, 5);
		expect(strokes[0].tiltAngles?.[1]).toBeCloseTo(Math.PI / 2, 5);
		expect(strokes[0].tiltMagnitudes?.[0]).toBeCloseTo(1, 5);
		expect(strokes[0].tiltMagnitudes?.[1]).toBeCloseTo(1, 5);
	});
});

describe('buildInkMlContent - OTx/OTy tilt authoring', () => {
	it('serialises byte-identically to before this feature when no stroke has tilt', () => {
		const strokes: ContentPartInkStroke[] = [
			{ path: 'M 1 2 L 3 4', color: '#000000', width: 2, opacity: 1, pressures: [0.2, 0.9] },
		];
		const built = buildInkMlContent(strokes);
		const root = built['ink:ink'] as XmlObject;
		const channels = (
			(
				((root['ink:definitions'] as XmlObject)['ink:context'] as XmlObject)[
					'ink:inkSource'
				] as XmlObject
			)['ink:traceFormat'] as XmlObject
		)['ink:channel'] as XmlObject[];
		expect(channels).toHaveLength(3);
		expect(channels.map((c) => c['@_name'])).toStrictEqual(['X', 'Y', 'F']);
		const trace = (root['ink:trace'] as XmlObject[])[0];
		expect(trace['#text']).toBe('1 2 0.2, 3 4 0.9');
	});

	it('declares OTx/OTy and authors per-point values when a stroke has tilt', () => {
		const strokes: ContentPartInkStroke[] = [
			{
				path: 'M 0 0 L 10 0 L 20 0',
				color: '#000000',
				width: 2,
				opacity: 1,
				tiltAngles: [0, Math.PI / 2, 0],
				tiltMagnitudes: [0.5, 1, 0],
			},
		];
		const built = buildInkMlContent(strokes);
		const root = built['ink:ink'] as XmlObject;
		const channels = (
			(
				((root['ink:definitions'] as XmlObject)['ink:context'] as XmlObject)[
					'ink:inkSource'
				] as XmlObject
			)['ink:traceFormat'] as XmlObject
		)['ink:channel'] as XmlObject[];
		expect(channels.map((c) => c['@_name'])).toStrictEqual(['X', 'Y', 'F', 'OTx', 'OTy']);

		// Round-trip through the reader: the same inverse mapping this project's
		// authored dialect uses (`traceTilt`) must recover the same angle and
		// magnitude the writer was given.
		const { strokes: reread } = parseInkMlContent(built);
		expect(reread[0].tiltAngles?.[0]).toBeCloseTo(0, 5);
		expect(reread[0].tiltAngles?.[1]).toBeCloseTo(Math.PI / 2, 5);
		expect(reread[0].tiltMagnitudes?.[0]).toBeCloseTo(0.5, 5);
		expect(reread[0].tiltMagnitudes?.[1]).toBeCloseTo(1, 5);
		expect(reread[0].tiltMagnitudes?.[2]).toBeCloseTo(0, 5);
	});

	it('a stroke with no tilt in a tilt-bearing document authors "0 0" (no visible lean)', () => {
		const strokes: ContentPartInkStroke[] = [
			{
				path: 'M 0 0 L 10 0',
				color: '#000000',
				width: 2,
				opacity: 1,
				tiltAngles: [0, Math.PI / 2],
				tiltMagnitudes: [0.5, 1],
			},
			{ path: 'M 5 5 L 6 6', color: '#111111', width: 1, opacity: 1 },
		];
		const built = buildInkMlContent(strokes);
		const root = built['ink:ink'] as XmlObject;
		const plainTrace = (root['ink:trace'] as XmlObject[])[1];
		expect(plainTrace['#text']).toBe('5 5 0.5 0 0, 6 6 0.5 0 0');
	});
});

describe('buildInkMlContent - AZIMUTH/ALTITUDE channel preservation', () => {
	it('re-declares AZIMUTH/ALTITUDE (not OTx/OTy) when every tilt-carrying stroke was decoded from that pair', () => {
		const strokes: ContentPartInkStroke[] = [
			{
				path: 'M 0 0 L 10 0 L 20 0',
				color: '#000000',
				width: 2,
				opacity: 1,
				tiltAngles: [0, Math.PI / 2, 0],
				tiltMagnitudes: [0.5, 1, 0],
				tiltEncoding: 'azimuthAltitude',
			},
		];
		const built = buildInkMlContent(strokes);
		const root = built['ink:ink'] as XmlObject;
		const channels = (
			((root['ink:definitions'] as XmlObject)['ink:context'] as XmlObject)[
				'ink:inkSource'
			] as XmlObject
		)['ink:traceFormat'] as XmlObject;
		const channelNames = (channels['ink:channel'] as XmlObject[]).map((c) => c['@_name']);
		expect(channelNames).toStrictEqual(['X', 'Y', 'F', 'AZIMUTH', 'ALTITUDE']);
		expect(channelNames).not.toContain('OTx');
	});

	it('round-trips angle/magnitude losslessly through a full parse -> build -> parse cycle starting from a real AZIMUTH/ALTITUDE file', () => {
		const xml = `<inkml:ink xmlns:inkml="http://www.w3.org/2003/InkML">
  <inkml:traceFormat>
    <inkml:channel name="X" type="decimal"/>
    <inkml:channel name="Y" type="decimal"/>
    <inkml:channel name="AZIMUTH" type="decimal"/>
    <inkml:channel name="ALTITUDE" type="decimal"/>
  </inkml:traceFormat>
  <inkml:trace>0 0 90 45, 10 0 45 10, 20 0 0 0</inkml:trace>
</inkml:ink>`;
		const loaded = parseInkMlContent(parse(xml));
		expect(loaded.strokes[0].tiltEncoding).toBe('azimuthAltitude');

		// A save that edits something else in the part rebuilds it from the
		// decoded strokes; the rebuilt part must keep declaring AZIMUTH/ALTITUDE,
		// not silently convert to OTx/OTy.
		const rebuilt = buildInkMlContent(loaded.strokes);
		const root = rebuilt['ink:ink'] as XmlObject;
		const channelNames = (
			(
				((root['ink:definitions'] as XmlObject)['ink:context'] as XmlObject)[
					'ink:inkSource'
				] as XmlObject
			)['ink:traceFormat'] as XmlObject
		)['ink:channel'] as XmlObject[];
		expect(channelNames.map((c) => c['@_name'])).toStrictEqual([
			'X',
			'Y',
			'F',
			'AZIMUTH',
			'ALTITUDE',
		]);

		// All three points here carry a non-zero magnitude (altitude < 90), so
		// the angle is meaningful and must round-trip too; a magnitude-0 (fully
		// upright) point's azimuth is physically degenerate and is intentionally
		// NOT preserved (see `azimuthAltitudeAt`'s "0 90" default), matching the
		// pre-existing OTx/OTy round-trip test's own convention of only
		// asserting magnitude, not angle, for such a point.
		const reread = parseInkMlContent(rebuilt).strokes;
		for (const index of [0, 1, 2]) {
			expect(reread[0].tiltAngles?.[index]).toBeCloseTo(
				loaded.strokes[0].tiltAngles?.[index] ?? NaN,
				5,
			);
			expect(reread[0].tiltMagnitudes?.[index]).toBeCloseTo(
				loaded.strokes[0].tiltMagnitudes?.[index] ?? NaN,
				5,
			);
		}
		expect(reread[0].tiltEncoding).toBe('azimuthAltitude');
	});

	it('falls back to OTx/OTy when strokes mix AZIMUTH/ALTITUDE with vector (or captured) tilt', () => {
		const strokes: ContentPartInkStroke[] = [
			{
				path: 'M 0 0 L 10 0',
				color: '#000000',
				width: 2,
				opacity: 1,
				tiltAngles: [0, Math.PI / 2],
				tiltMagnitudes: [0.5, 1],
				tiltEncoding: 'azimuthAltitude',
			},
			{
				path: 'M 5 5 L 6 6',
				color: '#111111',
				width: 1,
				opacity: 1,
				tiltAngles: [0, Math.PI],
				tiltMagnitudes: [1, 1],
				// No `tiltEncoding`: this library's own OTx/OTy-equivalent capture.
			},
		];
		const built = buildInkMlContent(strokes);
		const root = built['ink:ink'] as XmlObject;
		const channelNames = (
			(
				((root['ink:definitions'] as XmlObject)['ink:context'] as XmlObject)[
					'ink:inkSource'
				] as XmlObject
			)['ink:traceFormat'] as XmlObject
		)['ink:channel'] as XmlObject[];
		expect(channelNames.map((c) => c['@_name'])).toStrictEqual(['X', 'Y', 'F', 'OTx', 'OTy']);
	});
});
