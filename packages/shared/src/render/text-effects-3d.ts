/**
 * Text body 3D scene (camera/light rig) CSS builder, shared by every
 * binding's text renderer.
 *
 * Pure, framework-agnostic. {@link buildTextBody3DSceneStyle} maps a text
 * body's `a:scene3d` camera/light rig to a neutral CSS record (perspective +
 * rotate transform, or a COM-measured exact `matrix3d(...)` homography).
 * Each binding casts the record into its own style type.
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
 *
 * 2026-09: this module used to carry its own hand-tuned `rotateX`/`rotateY`
 * preset table (`TEXT_CAMERA_PRESET_MAP`), independent of - and drifted from
 * - the shape-level camera math. `a:bodyPr/a:scene3d` (`CT_Scene3D`) is the
 * IDENTICAL schema type used for `a:spPr/a:scene3d`: nothing in ECMA-376
 * suggests PowerPoint's camera projection differs between a shape and a text
 * body under the same preset. This now calls the shape-level
 * {@link getCameraTransform} directly (COM-measured homographies from
 * `visual-3d-camera-homography` for `perspective*`/`isometric*`, identity for
 * `oblique*`/`legacyOblique*`/`legacyPerspective*`/`orthographicFront`, the
 * FOV-derived perspective/rotation fallback for an explicit `a:camera/a:rot`
 * override or an unrecognised preset) rather than reimplementing a second,
 * approximate model, so a WordArt text box under `perspectiveHeroicLeftFacing`
 * produces the exact same `matrix3d(...)` a shape of the same rendered size
 * would (COM-verified via the shape measurement: `a:scene3d/a:camera` has no
 * shape-vs-text-specific rendering path in real PowerPoint). This also fixes
 * every `isometricOffAxis*` preset, which the old table omitted entirely (no
 * camera effect at all on a text body), and every `oblique*`/`legacyOblique*`/
 * `legacyPerspective*` preset, which the old table wrongly rotated the front
 * face for (see `visual-3d-camera-homography`'s module doc comment: these only
 * skew an EXTRUDED shape's side panels, never the front face).
 *
 * @module render/text-effects-3d
 */
import type { TextStyle } from 'pptx-viewer-core';

import type { TextCssProperties } from './text-fill';
import { getCameraTransform } from './visual-3d-camera';
import type { ElementSizePx } from './visual-3d-camera';

// ── Text body 3D scene style ─────────────────────────────────────────────

/**
 * Build CSS properties for 3D scene rendering on a text body.
 *
 * Maps `a:bodyPr/a:scene3d` camera presets and explicit rotations to CSS
 * `perspective` + `transform` (a COM-measured exact `matrix3d(...)` when the
 * preset has ground truth, otherwise `rotateX`/`rotateY`/`rotateZ`) plus
 * `transform-style: preserve-3d`, via the same {@link getCameraTransform}
 * shapes use. Returns `undefined` when no scene3d (or no effective rotation/
 * perspective) is present. Applied as a wrapper style on the text body
 * container.
 *
 * `elementSize`, when provided, re-projects a non-homography camera's field
 * of view onto the text body's actual rendered size instead of a fixed
 * reference size (see {@link getCameraTransform}); omitting it reproduces the
 * legacy behaviour for callers that have not been updated to pass it.
 */
export function buildTextBody3DSceneStyle(
	textStyle: TextStyle | undefined,
	elementSize?: ElementSizePx,
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

	const {
		perspective,
		perspectiveOrigin,
		matrix3d,
		transformOrigin,
		cameraFlatFace,
		rotateX,
		rotateY,
		rotateZ,
	} = getCameraTransform(scene3d, elementSize);

	const hasRotation =
		Boolean(matrix3d) || (!cameraFlatFace && (rotateX !== 0 || rotateY !== 0 || rotateZ !== 0));
	const hasScene = hasRotation || Boolean(perspective);

	if (!hasScene) {
		return undefined;
	}

	const style: TextCssProperties = {};

	if (perspective) {
		style.perspective = perspective;
	}
	if (perspectiveOrigin) {
		style.perspectiveOrigin = perspectiveOrigin;
	}
	// `'0 0'` for a COM-measured homography (see `visual-3d-camera-homography`'s
	// module doc comment: the matrix already encodes translation relative to
	// the element's own un-rotated top-left corner, so a non-zero origin would
	// double-apply it); omitted otherwise, keeping the default centred origin.
	if (transformOrigin) {
		style.transformOrigin = transformOrigin;
	}

	if (matrix3d) {
		style.transform = matrix3d;
	} else if (!cameraFlatFace) {
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
		if (transforms.length > 0) {
			style.transform = transforms.join(' ');
		}
	}

	// Preserve 3D space for child elements
	style.transformStyle = 'preserve-3d';

	return style;
}
