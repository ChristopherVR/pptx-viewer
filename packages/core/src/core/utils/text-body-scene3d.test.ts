import { describe, expect, it } from 'vitest';

import type { TextStyle, XmlObject } from '../types';
import { applyTextBodyScene3d, parseTextBodyScene3d } from './text-body-scene3d';

const findChild = (node: XmlObject, local: string): XmlObject | undefined => {
	const key = Object.keys(node).find((candidate) => candidate.split(':').pop() === local);
	return key ? (node[key] as XmlObject) : undefined;
};

describe('text body CT_Scene3D round-trip', () => {
	it('parses all typed camera, light-rig, and backdrop fields with alternate prefixes', () => {
		const bodyPr: XmlObject = {
			'd:scene3d': {
				'd:camera': {
					'@_prst': 'perspectiveFront',
					'@_fov': '5400000',
					'@_zoom': '125000',
					'd:rot': { '@_lat': '100', '@_lon': '200', '@_rev': '300' },
				},
				'd:lightRig': {
					'@_rig': 'threePt',
					'@_dir': 'tr',
					'd:rot': { '@_lat': '400', '@_lon': '500', '@_rev': '600' },
				},
				'd:backdrop': {
					'd:anchor': { '@_x': '1', '@_y': '2', '@_z': '3' },
					'd:norm': { '@_dx': '4', '@_dy': '5', '@_dz': '6' },
					'd:up': { '@_dx': '7', '@_dy': '8', '@_dz': '9' },
				},
				'd:extLst': { 'd:ext': { '@_uri': '{SCENE-EXT}', 'x:payload': { '@_v': '1' } } },
			},
		};
		const style: TextStyle = {};

		parseTextBodyScene3d(bodyPr, style);

		expect(style.textBodyScene3d).toStrictEqual({
			cameraPreset: 'perspectiveFront',
			cameraFieldOfView: 5400000,
			cameraZoom: 1.25,
			cameraRotX: 100,
			cameraRotY: 200,
			cameraRotZ: 300,
			lightRigType: 'threePt',
			lightRigDirection: 'tr',
			lightRigRotX: 400,
			lightRigRotY: 500,
			lightRigRotZ: 600,
			hasBackdrop: true,
			backdropAnchorX: 1,
			backdropAnchorY: 2,
			backdropAnchorZ: 3,
			backdropNormalX: 4,
			backdropNormalY: 5,
			backdropNormalZ: 6,
			backdropUpX: 7,
			backdropUpY: 8,
			backdropUpZ: 9,
		});
		expect(style.textBodyScene3dXml).toStrictEqual(bodyPr['d:scene3d']);
		expect(style.textBodyScene3dXml).not.toBe(bodyPr['d:scene3d']);
	});

	it('applies edits while preserving prefixes, unknown attributes, and extLst', () => {
		const source: XmlObject = {
			'd:scene3d': {
				'@_vendor': 'keep',
				'd:camera': { '@_prst': 'orthographicFront' },
				'd:lightRig': { '@_rig': 'soft', '@_dir': 'b' },
				'd:extLst': { 'd:ext': { '@_uri': '{KEEP}', 'x:data': { '@_ok': '1' } } },
			},
		};
		const style: TextStyle = {};
		parseTextBodyScene3d(source, style);
		style.textBodyScene3d = {
			...style.textBodyScene3d,
			cameraPreset: 'perspectiveRelaxed',
			cameraFieldOfView: 6000000,
			cameraZoom: 0.8,
			lightRigType: 'balanced',
			lightRigDirection: 'tl',
			lightRigRotX: 10,
		};
		const saved: XmlObject = {};

		applyTextBodyScene3d(saved, style);

		const sceneKey = Object.keys(saved)[0];
		const scene = saved[sceneKey] as XmlObject;
		expect(sceneKey).toBe('a:scene3d');
		expect(Object.keys(scene).filter((key) => !key.startsWith('@_'))).toStrictEqual([
			'd:camera',
			'd:lightRig',
			'd:extLst',
		]);
		expect(scene['@_vendor']).toBe('keep');
		expect(findChild(scene, 'camera')).toMatchObject({
			'@_prst': 'perspectiveRelaxed',
			'@_fov': '6000000',
			'@_zoom': '80000',
		});
		expect(findChild(scene, 'lightRig')).toMatchObject({ '@_rig': 'balanced', '@_dir': 'tl' });
		expect(findChild(scene, 'extLst')).toStrictEqual(
			findChild(source['d:scene3d'] as XmlObject, 'extLst'),
		);
	});

	it('creates a schema-ordered scene and complete backdrop from typed data', () => {
		const bodyPr: XmlObject = {};
		applyTextBodyScene3d(bodyPr, {
			textBodyScene3d: {
				cameraPreset: 'orthographicFront',
				cameraRotZ: 30,
				lightRigType: 'brightRoom',
				lightRigDirection: 'r',
				hasBackdrop: true,
				backdropAnchorX: 1,
				backdropAnchorY: 2,
				backdropAnchorZ: 3,
				backdropNormalX: 0,
				backdropNormalY: 0,
				backdropNormalZ: 1,
				backdropUpX: 0,
				backdropUpY: -1,
				backdropUpZ: 0,
			},
		});

		const scene = bodyPr['a:scene3d'] as XmlObject;
		expect(Object.keys(scene)).toStrictEqual(['a:camera', 'a:lightRig', 'a:backdrop']);
		const backdrop = scene['a:backdrop'] as XmlObject;
		expect(Object.keys(backdrop)).toStrictEqual(['a:anchor', 'a:norm', 'a:up']);
		// `a:anchor` is CT_Point3D (x/y/z); `a:norm`/`a:up` are CT_Vector3D
		// (dx/dy/dz) - NOT interchangeable, per ECMA-376.
		expect(findChild(backdrop, 'anchor')).toStrictEqual({ '@_x': '1', '@_y': '2', '@_z': '3' });
		expect(findChild(backdrop, 'norm')).toStrictEqual({ '@_dx': '0', '@_dy': '0', '@_dz': '1' });
		expect(findChild(backdrop, 'up')).toStrictEqual({ '@_dx': '0', '@_dy': '-1', '@_dz': '0' });
		expect(findChild(findChild(scene, 'camera')!, 'rot')).toStrictEqual({ '@_rev': '30' });
	});

	it('scales a fractional (normalised) backdrop direction to valid integer ST_Coordinate values instead of corrupting or dropping it', () => {
		const bodyPr: XmlObject = {};
		applyTextBodyScene3d(bodyPr, {
			textBodyScene3d: {
				cameraPreset: 'orthographicFront',
				lightRigType: 'brightRoom',
				lightRigDirection: 'r',
				hasBackdrop: true,
				backdropAnchorX: 0,
				backdropAnchorY: 0,
				backdropAnchorZ: 0,
				// A normalised unit vector tilted toward +X/+Y, as a caller
				// reaching for the public API (rather than round-tripping a
				// parsed file) would naturally write.
				backdropNormalX: 0.7071,
				backdropNormalY: 0.7071,
				backdropNormalZ: 0,
				backdropUpX: 0,
				backdropUpY: 1,
				backdropUpZ: 0,
			},
		});

		const scene = bodyPr['a:scene3d'] as XmlObject;
		const backdrop = scene['a:backdrop'] as XmlObject;
		const norm = findChild(backdrop, 'norm')!;
		for (const attr of ['@_dx', '@_dy', '@_dz']) {
			expect(Number.isInteger(Number(norm[attr]))).toBeTruthy();
		}
		// The ratio between dx and dy is preserved (both components equal).
		expect(norm['@_dx']).toBe(norm['@_dy']);
		expect(norm['@_dz']).toBe('0');
	});

	it('validates enum and range values without destroying preserved XML', () => {
		const bodyPr: XmlObject = {
			'x:scene3d': {
				'x:camera': { '@_prst': 'vendorCamera', '@_fov': '10800001', '@_zoom': '0' },
				'x:lightRig': { '@_rig': 'vendorRig', '@_dir': 'center' },
				'x:extLst': { 'x:ext': { '@_uri': '{VENDOR}' } },
			},
		};
		const style: TextStyle = {};
		parseTextBodyScene3d(bodyPr, style);

		expect(style.textBodyScene3d).toStrictEqual({
			cameraPreset: undefined,
			lightRigType: undefined,
			lightRigDirection: undefined,
		});
		const saved: XmlObject = {};
		applyTextBodyScene3d(saved, style);
		expect(saved['a:scene3d']).toStrictEqual(bodyPr['x:scene3d']);
	});

	it('does not emit an invalid new scene without required enum values', () => {
		const bodyPr: XmlObject = {};
		applyTextBodyScene3d(bodyPr, { textBodyScene3d: { cameraPreset: 'not-a-camera' } });
		expect(bodyPr).toStrictEqual({});
	});
});
