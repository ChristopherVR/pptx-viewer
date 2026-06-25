/**
 * Text fill + text effect CSS builders.
 *
 * The implementations are framework-agnostic and now live in
 * `pptx-viewer-shared`:
 *   - `render/text-fill`       → gradient/pattern `background-clip:text` fill
 *   - `render/text-effects`    → shadow/inner-shadow/glow/blur/HSL/reflection/alpha
 *   - `render/text-effects-3d` → 3D extrusion/bevel text-shadow + scene style
 *
 * This module re-exports them so existing React import paths (`./text-effects`)
 * keep working. The two style-record builders (`buildTextFillCss`,
 * `buildTextBody3DSceneStyle`) return a neutral `Record<string, string |
 * number>` in shared; the thin wrappers below cast that to `React.CSSProperties`
 * at the binding boundary so React call sites are unchanged.
 */
import type { TextStyle } from 'pptx-viewer-core';
import {
	buildTextFillCss as sharedBuildTextFillCss,
	buildTextBody3DSceneStyle as sharedBuildTextBody3DSceneStyle,
} from 'pptx-viewer-shared';
import type React from 'react';

export {
	buildText3DShadowCss,
	buildTextShadowCss,
	buildTextInnerShadowCss,
	buildTextBlurFilter,
	buildTextHslFilter,
	getTextAlphaOpacity,
	buildTextGlowFilter,
	buildTextReflectionCss,
	buildTextRunFilterChain,
} from 'pptx-viewer-shared';

/** Build CSS properties for gradient or pattern text fills. */
export function buildTextFillCss(style: TextStyle): React.CSSProperties | undefined {
	return sharedBuildTextFillCss(style) as React.CSSProperties | undefined;
}

/** Build CSS properties for 3D scene rendering on a text body. */
export function buildTextBody3DSceneStyle(
	textStyle: TextStyle | undefined,
): React.CSSProperties | undefined {
	return sharedBuildTextBody3DSceneStyle(textStyle) as React.CSSProperties | undefined;
}
