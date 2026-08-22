/**
 * Text body 3D scene (camera/light rig) CSS builder, shared by every
 * binding's text renderer.
 *
 * Pure, framework-agnostic. {@link buildTextBody3DSceneStyle} maps a text
 * body's `a:scene3d` camera/light rig to a neutral CSS record (perspective +
 * rotate transform). Each binding casts the record into its own style type.
 *
 * A per-run extrusion/bevel `text-shadow` builder used to live here
 * (`buildText3DShadowCss`), but `a:sp3d`/`a:scene3d`/`a:flatTx` are only ever
 * children of `a:bodyPr` (`CT_TextBodyProperties`, `EG_Text3D`) in ECMA-376;
 * `a:rPr`/`a:defRPr`/`a:endParaRPr` (`CT_TextCharacterProperties`) admit no
 * such children. Nothing in this repo's parser ever set `TextStyle.text3d` on
 * a run's own style (only `parseTextBodySp3d` does, and only from `bodyPr`,
 * onto the text BODY's style), and the corpus under `e2e/fixtures` has no
 * `a:sp3d`/`a:scene3d` inside an `a:rPr` either - the one fixture that carries
 * either (`shape-3d-compound.pptx`) has them on `p:spPr` (shape 3D), not text.
 * The function's only caller was the per-run `buildTextShadowCss`
 * (`text-effects.ts`), so it could never produce a defined value in any
 * binding. It was removed rather than kept as dead coverage; see
 * `text-effects.ts` for where the 3D layer used to be spliced in.
 */
import type { TextStyle } from 'pptx-viewer-core';

import type { TextCssProperties } from './text-fill';

// ── Text body 3D scene style ─────────────────────────────────────────────

/**
 * Camera preset configuration: CSS perspective distance and base rotation
 * angles (in degrees). Mirrors the shape-level CAMERA_PRESET_MAP but with
 * reduced rotation values for text (text 3D is typically subtler).
 */
interface TextCameraPresetConfig {
	perspective?: string;
	rotateX: number;
	rotateY: number;
	rotateZ: number;
}

const TEXT_CAMERA_PRESET_MAP: Record<string, TextCameraPresetConfig> = {
	orthographicFront: { rotateX: 0, rotateY: 0, rotateZ: 0 },
	perspectiveFront: { perspective: '800px', rotateX: 0, rotateY: 0, rotateZ: 0 },
	perspectiveAbove: { perspective: '800px', rotateX: -12, rotateY: 0, rotateZ: 0 },
	perspectiveBelow: { perspective: '800px', rotateX: 12, rotateY: 0, rotateZ: 0 },
	perspectiveLeft: { perspective: '800px', rotateX: 0, rotateY: 12, rotateZ: 0 },
	perspectiveRight: { perspective: '800px', rotateX: 0, rotateY: -12, rotateZ: 0 },
	perspectiveAboveLeftFacing: { perspective: '800px', rotateX: -12, rotateY: 15, rotateZ: 0 },
	perspectiveAboveRightFacing: { perspective: '800px', rotateX: -12, rotateY: -15, rotateZ: 0 },
	perspectiveContrastingLeftFacing: { perspective: '700px', rotateX: -10, rotateY: 20, rotateZ: 0 },
	perspectiveContrastingRightFacing: {
		perspective: '700px',
		rotateX: -10,
		rotateY: -20,
		rotateZ: 0,
	},
	perspectiveHeroicLeftFacing: { perspective: '600px', rotateX: -8, rotateY: 25, rotateZ: 0 },
	perspectiveHeroicRightFacing: { perspective: '600px', rotateX: -8, rotateY: -25, rotateZ: 0 },
	perspectiveHeroicExtremeLeftFacing: {
		perspective: '500px',
		rotateX: -6,
		rotateY: 30,
		rotateZ: 0,
	},
	perspectiveHeroicExtremeRightFacing: {
		perspective: '500px',
		rotateX: -6,
		rotateY: -30,
		rotateZ: 0,
	},
	perspectiveRelaxed: { perspective: '1000px', rotateX: -6, rotateY: 0, rotateZ: 0 },
	perspectiveRelaxedModerately: { perspective: '1200px', rotateX: -3, rotateY: 0, rotateZ: 0 },
	isometricLeftDown: { perspective: '1000px', rotateX: -20, rotateY: 25, rotateZ: 0 },
	isometricRightUp: { perspective: '1000px', rotateX: -20, rotateY: -25, rotateZ: 0 },
	isometricTopUp: { perspective: '1000px', rotateX: -30, rotateY: 0, rotateZ: 25 },
	isometricTopDown: { perspective: '1000px', rotateX: -30, rotateY: 0, rotateZ: -25 },
	isometricBottomUp: { perspective: '1000px', rotateX: 30, rotateY: 0, rotateZ: 25 },
	isometricBottomDown: { perspective: '1000px', rotateX: 30, rotateY: 0, rotateZ: -25 },
	obliqueTopLeft: { perspective: '800px', rotateX: -12, rotateY: 12, rotateZ: 0 },
	obliqueTop: { perspective: '800px', rotateX: -15, rotateY: 0, rotateZ: 0 },
	obliqueTopRight: { perspective: '800px', rotateX: -12, rotateY: -12, rotateZ: 0 },
	obliqueLeft: { perspective: '800px', rotateX: 0, rotateY: 15, rotateZ: 0 },
	obliqueRight: { perspective: '800px', rotateX: 0, rotateY: -15, rotateZ: 0 },
	obliqueBottomLeft: { perspective: '800px', rotateX: 12, rotateY: 12, rotateZ: 0 },
	obliqueBottom: { perspective: '800px', rotateX: 15, rotateY: 0, rotateZ: 0 },
	obliqueBottomRight: { perspective: '800px', rotateX: 12, rotateY: -12, rotateZ: 0 },
};

/**
 * Build CSS properties for 3D scene rendering on a text body.
 *
 * Maps `a:bodyPr/a:scene3d` camera presets and explicit rotations to CSS
 * `perspective` + `transform` (rotateX/Y/Z) plus `transform-style:
 * preserve-3d`. Returns `undefined` when no scene3d (or no effective rotation/
 * perspective) is present. Applied as a wrapper style on the text body
 * container.
 */
export function buildTextBody3DSceneStyle(
	textStyle: TextStyle | undefined,
): TextCssProperties | undefined {
	// `a:flatTx` is an explicit "render flat" override (mutually exclusive with
	// `a:sp3d`/`a:scene3d` in OOXML): short-circuit here so an inherited/stale
	// `textBodyScene3d` can never leak through it.
	if (textStyle?.flatText) {
		return undefined;
	}
	const scene3d = textStyle?.textBodyScene3d;
	if (!scene3d) {
		return undefined;
	}

	const preset = scene3d.cameraPreset ? TEXT_CAMERA_PRESET_MAP[scene3d.cameraPreset] : undefined;

	let perspective = preset?.perspective;
	let rotateX = preset?.rotateX ?? 0;
	let rotateY = preset?.rotateY ?? 0;
	let rotateZ = preset?.rotateZ ?? 0;

	// Explicit rotation angles override preset defaults (values in 1/60000 degrees)
	if (scene3d.cameraRotX) {
		rotateX = -(scene3d.cameraRotX / 60000);
	}
	if (scene3d.cameraRotY) {
		rotateY = scene3d.cameraRotY / 60000;
	}
	if (scene3d.cameraRotZ) {
		rotateZ = scene3d.cameraRotZ / 60000;
	}

	if (!perspective && (rotateX !== 0 || rotateY !== 0 || rotateZ !== 0)) {
		perspective = '800px';
	}

	const hasRotation = rotateX !== 0 || rotateY !== 0 || rotateZ !== 0;
	const hasScene = hasRotation || Boolean(perspective);

	if (!hasScene) {
		return undefined;
	}

	const style: TextCssProperties = {};

	if (perspective) {
		style.perspective = perspective;
	}

	if (hasRotation) {
		const transforms: string[] = [];
		if (rotateX !== 0) {
			transforms.push(`rotateX(${rotateX}deg)`);
		}
		if (rotateY !== 0) {
			transforms.push(`rotateY(${rotateY}deg)`);
		}
		if (rotateZ !== 0) {
			transforms.push(`rotateZ(${rotateZ}deg)`);
		}
		style.transform = transforms.join(' ');
	}

	// Preserve 3D space for child elements
	style.transformStyle = 'preserve-3d';

	return style;
}
