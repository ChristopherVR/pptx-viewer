import { describe, it, expect } from 'vitest';
import type React from 'react';

import { apply3dEffects } from './shape-visual-3d';

describe('apply3dEffects', () => {
	it('should not modify base when no 3D params provided', () => {
		const base: React.CSSProperties = { backgroundColor: 'red' };
		apply3dEffects(base, undefined, undefined);
		expect(base.perspective).toBeUndefined();
		expect(base.transform).toBeUndefined();
	});

	it('should apply perspective and rotateX for camera X rotation', () => {
		const base: React.CSSProperties = {};
		apply3dEffects(base, { cameraRotX: 1800000 }, undefined);
		expect(base.perspective).toBe('800px');
		// 1800000 / 60000 = 30 degrees
		expect(base.transform).toContain('rotateX(-30deg)');
	});

	it('should apply rotateY for camera Y rotation', () => {
		const base: React.CSSProperties = {};
		apply3dEffects(base, { cameraRotY: 2700000 }, undefined);
		// 2700000 / 60000 = 45 degrees
		expect(base.transform).toContain('rotateY(45deg)');
	});

	it('should apply rotateZ for camera Z rotation', () => {
		const base: React.CSSProperties = {};
		apply3dEffects(base, { cameraRotZ: 5400000 }, undefined);
		// 5400000 / 60000 = 90 degrees
		expect(base.transform).toContain('rotateZ(90deg)');
	});

	it('should combine multiple rotation axes', () => {
		const base: React.CSSProperties = {};
		apply3dEffects(
			base,
			{
				cameraRotX: 600000,
				cameraRotY: 1200000,
				cameraRotZ: 1800000,
			},
			undefined,
		);
		expect(base.perspective).toBe('800px');
		expect(base.transform).toContain('rotateX(-10deg)');
		expect(base.transform).toContain('rotateY(20deg)');
		expect(base.transform).toContain('rotateZ(30deg)');
	});

	it('should add extrusion depth as stacked box-shadows', () => {
		const base: React.CSSProperties = {};
		// 9525 EMU = 1px, so 95250 = 10px depth
		apply3dEffects(base, undefined, {
			extrusionHeight: 95250,
			extrusionColor: '#888888',
		});
		expect(base.boxShadow).toBeDefined();
		expect(base.boxShadow).toContain('#888888');
		// Should have multiple shadow layers
		const layers = (base.boxShadow as string).split(',');
		expect(layers.length).toBeGreaterThan(1);
	});

	it('should add bevel top as inset highlight/shadow', () => {
		const base: React.CSSProperties = {};
		apply3dEffects(base, undefined, {
			bevelTopType: 'circle',
			bevelTopWidth: 28575,
			bevelTopHeight: 28575,
		});
		expect(base.boxShadow).toBeDefined();
		expect(base.boxShadow).toContain('inset');
		expect(base.boxShadow).toContain('rgba(255,255,255,0.3)');
	});

	it('should add backdrop ground-plane shadow', () => {
		const base: React.CSSProperties = {};
		apply3dEffects(base, { hasBackdrop: true }, undefined);
		expect(base.boxShadow).toBeDefined();
		expect(base.boxShadow).toContain('rgba(0,0,0,0.25)');
	});

	it('should apply material preset CSS overrides', () => {
		const base: React.CSSProperties = {};
		apply3dEffects(base, undefined, { presetMaterial: 'metal' });
		expect(base.filter).toContain('brightness');
		expect(base.filter).toContain('contrast');
		expect(base.boxShadow).toContain('inset');
	});

	it('should apply material opacity for clear material', () => {
		const base: React.CSSProperties = {};
		apply3dEffects(base, undefined, { presetMaterial: 'clear' });
		expect(base.opacity).toBe(0.7);
	});
});
