import { describe, expect, it } from 'vitest';

import {
	getBevelLightingFilterId,
	getBevelLightingFilterMarkup,
	getBevelLightingSvgFilter,
} from './visual-3d-bevel-lighting';

describe('getBevelLightingFilterMarkup', () => {
	it('returns undefined for no shape3d', () => {
		expect(getBevelLightingFilterMarkup('el1', undefined, undefined)).toBeUndefined();
	});

	it('returns undefined when neither bevel is set', () => {
		expect(
			getBevelLightingFilterMarkup('el1', { presetMaterial: 'metal' }, undefined),
		).toBeUndefined();
	});

	it('returns undefined when both bevels are explicitly "none"', () => {
		expect(
			getBevelLightingFilterMarkup(
				'el1',
				{ bevelTopType: 'none', bevelBottomType: 'none' },
				undefined,
			),
		).toBeUndefined();
	});

	it('produces a deterministic id from the element id', () => {
		const def = getBevelLightingFilterMarkup(
			'shape-42',
			{ bevelTopType: 'circle', bevelTopWidth: 76200, bevelTopHeight: 76200 },
			undefined,
		);
		expect(def?.id).toBe(getBevelLightingFilterId('shape-42'));
		expect(def?.cssReference).toBe(`url(#${def?.id})`);
	});

	it('builds one feDiffuseLighting/feSpecularLighting stage for a top-only bevel', () => {
		const def = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle', bevelTopWidth: 76200, bevelTopHeight: 76200 },
			undefined,
		);
		expect(def).toBeDefined();
		const markup = def!.filterMarkup;
		expect(markup).toContain('<filter id="bevel-light-el1"');
		expect(markup.match(/<feDiffuseLighting /g) ?? []).toHaveLength(1);
		expect(markup.match(/<feSpecularLighting /g) ?? []).toHaveLength(1);
		expect(markup.match(/<feDistantLight /g) ?? []).toHaveLength(2);
		expect(markup).toContain('SourceGraphic');
		expect(markup).toContain('SourceAlpha');
	});

	it('chains two stages (top then bottom) when both bevels are present', () => {
		const def = getBevelLightingFilterMarkup(
			'el1',
			{
				bevelTopType: 'circle',
				bevelTopWidth: 76200,
				bevelTopHeight: 76200,
				bevelBottomType: 'angle',
				bevelBottomWidth: 38100,
				bevelBottomHeight: 38100,
			},
			undefined,
		);
		expect(def).toBeDefined();
		const markup = def!.filterMarkup;
		expect(markup.match(/<feDiffuseLighting /g) ?? []).toHaveLength(2);
		expect(markup.match(/<feSpecularLighting /g) ?? []).toHaveLength(2);
		// Second stage's diffuse layer reads the first stage's output, not
		// SourceGraphic directly, so the two stages actually chain.
		expect(markup).toContain('in="afterSpecular0"');
	});

	it('adds a feMorphology erode step only for faceted/steep profiles, not smooth ones', () => {
		const smooth = getBevelLightingFilterMarkup('el1', { bevelTopType: 'circle' }, undefined);
		const faceted = getBevelLightingFilterMarkup('el1', { bevelTopType: 'hardEdge' }, undefined);
		expect(smooth?.filterMarkup).not.toContain('feMorphology');
		expect(faceted?.filterMarkup).toContain('feMorphology');
	});

	it('resolves azimuth from the cardinal light-rig direction, matching the COM-measured bevel-light mapping', () => {
		// dir="r" -> COM-measured highlight vector {dx:1,dy:0} -> SVG azimuth 0deg.
		const right = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle' },
			{ lightRigDirection: 'r' },
		);
		expect(right?.filterMarkup).toContain('azimuth="0.0"');
		// dir="b" -> {dx:0,dy:1} -> azimuth 90deg.
		const bottom = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle' },
			{ lightRigDirection: 'b' },
		);
		expect(bottom?.filterMarkup).toContain('azimuth="90.0"');
	});

	it('inverts azimuth by 180deg for softRound, matching its COM-measured opposite-edge highlight', () => {
		const circle = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle' },
			{ lightRigDirection: 't' },
		);
		const softRound = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'softRound' },
			{ lightRigDirection: 't' },
		);
		const azimuthOf = (markup: string | undefined): string =>
			/azimuth="([\d.]+)"/u.exec(markup ?? '')?.[1] ?? '';
		const a = Number(azimuthOf(circle?.filterMarkup));
		const b = Number(azimuthOf(softRound?.filterMarkup));
		const normalizedDiff = (((a - b) % 360) + 360) % 360;
		expect(Math.abs(normalizedDiff - 180)).toBeLessThan(0.01);
	});

	// `circle` (not used here) is `metal|circle`-routed to the legacy
	// box-shadow model (see `visual-3d-bevel-lighting-routing.ts`), so this
	// uses `angle`, which is not routed.
	it('flips azimuth 180deg for a COM-measured invertedDirection rig (morning), matching a plain circle at the opposite dir', () => {
		// `morning` is COM-measured `invertedDirection: true` (see
		// visual-3d-bevel-lighting-tables.ts): its highlight under dir="t"
		// lands where a non-inverted rig's highlight would land under dir="b".
		const azimuthOf = (markup: string | undefined): number =>
			Number(/azimuth="([\d.]+)"/u.exec(markup ?? '')?.[1] ?? Number.NaN);
		const morningTop = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle' },
			{ lightRigType: 'morning', lightRigDirection: 't' },
		);
		const threePtBottom = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle' },
			{ lightRigType: 'threePt', lightRigDirection: 'b' },
		);
		expect(azimuthOf(morningTop?.filterMarkup)).toBeCloseTo(
			azimuthOf(threePtBottom?.filterMarkup),
			5,
		);
	});

	it('does not flip azimuth for a non-inverted rig (threePt)', () => {
		const azimuthOf = (markup: string | undefined): number =>
			Number(/azimuth="([\d.]+)"/u.exec(markup ?? '')?.[1] ?? Number.NaN);
		const noRig = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle' },
			{ lightRigDirection: 't' },
		);
		const threePt = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle' },
			{ lightRigType: 'threePt', lightRigDirection: 't' },
		);
		expect(azimuthOf(threePt?.filterMarkup)).toBeCloseTo(azimuthOf(noRig?.filterMarkup), 5);
	});

	it('gives metal a sharper specularExponent than matte for the same profile/direction', () => {
		const matte = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'angle', presetMaterial: 'matte' },
			{ lightRigDirection: 't' },
		);
		const metal = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'angle', presetMaterial: 'metal' },
			{ lightRigDirection: 't' },
		);
		const exponentOf = (markup: string | undefined): number =>
			Number(/specularExponent="(\d+)"/u.exec(markup ?? '')?.[1] ?? 0);
		expect(exponentOf(metal?.filterMarkup)).toBeGreaterThan(exponentOf(matte?.filterMarkup));
	});

	it('routes metal|circle to the legacy box-shadow model (undefined filter markup)', () => {
		const routed = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle', presetMaterial: 'metal' },
			{ lightRigDirection: 't' },
		);
		expect(routed).toBeUndefined();
	});

	it('does not route matte|circle (only metal|circle is routed)', () => {
		const notRouted = getBevelLightingFilterMarkup(
			'el1',
			{ bevelTopType: 'circle', presetMaterial: 'matte' },
			{ lightRigDirection: 't' },
		);
		expect(notRouted).toBeDefined();
	});

	it('keeps the two COM-measured "no clean directional signal" profiles physically low-relief', () => {
		// slope/hardEdge get a reduced surfaceScale + heavy erode (see
		// visual-3d-bevel-lighting-tables), reproducing their measured
		// near-uniform brightness rather than guessing a highlight side.
		const slope = getBevelLightingFilterMarkup('el1', { bevelTopType: 'slope' }, undefined);
		const circle = getBevelLightingFilterMarkup('el1', { bevelTopType: 'circle' }, undefined);
		const scaleOf = (markup: string | undefined): number =>
			Number(/surfaceScale="([\d.]+)"/u.exec(markup ?? '')?.[1] ?? 0);
		expect(scaleOf(slope?.filterMarkup)).toBeLessThan(scaleOf(circle?.filterMarkup));
	});
});

describe('getBevelLightingSvgFilter', () => {
	it('returns undefined for a non-shape element', () => {
		expect(
			getBevelLightingSvgFilter({
				id: 'el1',
				type: 'group',
			} as unknown as Parameters<typeof getBevelLightingSvgFilter>[0]),
		).toBeUndefined();
	});
});
