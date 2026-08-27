import { XMLParser } from 'fast-xml-parser';
import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import { parseInkMlContent } from './inkml-content-part';

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
		// The library's own authored format never carries a tilt channel.
		expect(strokes[0].tiltAngles).toBeUndefined();
	});
});
