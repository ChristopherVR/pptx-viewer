/**
 * extrusion-3d-overlay.component.test.ts: real CSS 3D extrusion side panels
 * for `a:sp3d/@extrusionH`, Angular binding.
 *
 * No Angular TestBed (see `vitest.config.ts`): the component is instantiated
 * directly, inputs are stubbed as signals, matching
 * `activex-controls-overlay.component.test.ts`.
 *
 * Before this component existed, Angular vendored shared's
 * `build3DExtrusionData` (`../internal/shared-src/render/visual-3d-extrusion.ts`)
 * but no template ever called it, so an extruded shape rendered only the flat
 * `box-shadow` approximation here, while React/Vue/Svelte/Vanilla additionally
 * painted these camera-rotated 3D panels on top.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';

import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { InputSignal } from '@angular/core';
import { describe, expect, it } from 'vitest';

import { build3DExtrusionData } from '../internal/shared';
import type { Extrusion3DData } from '../internal/shared';
import { Extrusion3DOverlayComponent } from './extrusion-3d-overlay.component';

function read(file: string): string {
	return readFileSync(path.join(__dirname, file), 'utf8');
}

/** EMU per CSS pixel at 96 DPI; a 20px-deep extrusion is 20 * 9525 EMU. */
const EMU_PER_PX = 9525;

function createOverlay(data: Extrusion3DData): Extrusion3DOverlayComponent {
	const overlay = runInInjectionContext(
		Injector.create({ providers: [] }),
		() => new Extrusion3DOverlayComponent(),
	);
	Object.assign(overlay, { data: signal(data) as unknown as InputSignal<Extrusion3DData> });
	return overlay;
}

describe('extrusion3DOverlayComponent', () => {
	it('coerces the shared builder bare numeric lengths to px strings', () => {
		const data = build3DExtrusionData(
			{ extrusionHeight: 20 * EMU_PER_PX },
			undefined,
			'#4472c4',
			100,
			60,
		);
		const overlay = createOverlay(data);

		const panels = overlay.panels();
		expect(panels.length).toBeGreaterThan(0);
		// The shared builder emits raw numbers for lengths; this binding must
		// coerce them to `px` strings the same way Vue's `toCss` does, or the
		// browser drops the (unitless, invalid) dimension entirely.
		const widths = panels.map((p) => p.style['width']);
		expect(widths.some((w) => w === '100px')).toBeTruthy();
		expect(widths.every((w) => typeof w !== 'number')).toBeTruthy();
	});

	it('kebab-cases camelCase keys to match this bindings StyleMap convention', () => {
		const data = build3DExtrusionData(
			{ extrusionHeight: 20 * EMU_PER_PX },
			undefined,
			'#4472c4',
			100,
			60,
		);
		const overlay = createOverlay(data);
		const wrapper = overlay.wrapperStyle();
		expect(wrapper['transform-style']).toBe('preserve-3d');
		expect(wrapper['pointer-events']).toBe('none');
	});

	it('produces no material overlay style when the shape has no material preset', () => {
		const data = build3DExtrusionData(
			{ extrusionHeight: 20 * EMU_PER_PX },
			undefined,
			'#4472c4',
			100,
			60,
		);
		const overlay = createOverlay(data);
		expect(overlay.materialOverlayStyle()).toBeUndefined();
	});

	it('builds a material overlay style, with the front face matrix3d transform, for a preset material', () => {
		const data = build3DExtrusionData(
			{ extrusionHeight: 20 * EMU_PER_PX, presetMaterial: 'metal' },
			{ cameraPreset: 'perspectiveAbove' },
			'#4472c4',
			100,
			60,
		);
		const overlay = createOverlay(data);
		const materialStyle = overlay.materialOverlayStyle();
		expect(materialStyle?.['background-image']).toContain('linear-gradient');
		expect(materialStyle?.['mix-blend-mode']).toBe('normal');
		// 2026-09 off-axis-camera homography wave: an exact COM-measured
		// `matrix3d(...)` replaces the old `rotateX(20deg)` (see shared
		// `visual-3d-camera-homography`'s module doc comment).
		expect(String(materialStyle?.['transform'] ?? '')).toContain('matrix3d(');
	});

	it('has no panels when the shape has no extrusion depth', () => {
		const data = build3DExtrusionData(undefined, undefined, '#4472c4', 100, 60);
		const overlay = createOverlay(data);
		expect(overlay.panels()).toHaveLength(0);
	});
});

/**
 * Before this component existed, `../internal/shared-src/render/visual-3d-extrusion.ts`
 * (the vendored copy of shared's `build3DExtrusionData`) was reachable from
 * this package's build, but no template ever mounted a component that called
 * it: every rendered shape only got the flat `box-shadow` extrusion
 * approximation. These checks pin BOTH ends of the wire so that regresses
 * silently again (a template edit removing the mount point, or a signal
 * rename breaking the input binding) fails a test, not just a demo screenshot.
 */
// The shape branch (text/shape) is split out to `ElementRendererShapeComponent`.
describe('wiring into element-renderer-shape.component (shape 3D extrusion parity)', () => {
	it('mounts pptx-extrusion-3d-overlay in the shape branch of the template', () => {
		const html = read('element-renderer-shape.component.html');
		expect(html).toContain('<pptx-extrusion-3d-overlay [data]="extrusionData()" />');
	});

	it('declares the extrusionData computed and imports the overlay component', () => {
		const source = read('element-renderer-shape.component.ts');
		expect(source).toContain(
			"import { Extrusion3DOverlayComponent } from './extrusion-3d-overlay.component';",
		);
		expect(source).toContain('Extrusion3DOverlayComponent,');
		expect(source).toMatch(/readonly extrusionData = computed<Extrusion3DData>/u);
		expect(source).toContain('build3DExtrusionData(ss?.shape3d, ss?.scene3d, ss?.fillColor');
	});
});
