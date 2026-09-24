/**
 * Text effect CSS builders (shadow / inner-shadow / glow / blur / HSL /
 * alpha), shared by every binding's text renderer.
 *
 * Pure, framework-agnostic: each builder returns a neutral CSS string (or a
 * number for opacity), or `undefined` when the effect is absent. The 3D scene
 * builder lives in {@link ./text-effects-3d}; the gradient/pattern text-fill
 * builder lives in {@link ./text-fill}. Reflection (`a:reflection`) is NOT a
 * CSS builder here: it renders as a mirrored-sibling wrapper, like a
 * shape/picture's, via {@link ./reflection}'s `getTextReflectionWrapperStyle`
 * (`-webkit-box-reflect` never rendered in Firefox at all).
 */
import type { TextStyle } from 'pptx-viewer-core';

import { normalizeHexColor } from './fill-style';

/** Build a CSS `text-shadow` value from text shadow properties. */
export function buildTextShadowCss(style: TextStyle): string | undefined {
	const shadows: string[] = [];

	// Regular text shadow
	const hasShadow =
		style.textShadowColor || (typeof style.textShadowBlur === 'number' && style.textShadowBlur > 0);
	if (hasShadow) {
		const ox = style.textShadowOffsetX ?? 0;
		const oy = style.textShadowOffsetY ?? 0;
		const blur = style.textShadowBlur ?? 4;
		const color = normalizeHexColor(style.textShadowColor, '#000000');
		const opacity = style.textShadowOpacity ?? 0.5;
		const r = parseInt(color.slice(1, 3), 16);
		const g = parseInt(color.slice(3, 5), 16);
		const b = parseInt(color.slice(5, 7), 16);
		shadows.push(`${ox}px ${oy}px ${blur}px rgba(${r},${g},${b},${opacity})`);
	}

	// Preset shadow (approximate as outer shadow with preset-derived offsets)
	if (style.textPresetShadowName && style.textPresetShadowColor) {
		const dist = style.textPresetShadowDistance ?? 3;
		const dir = style.textPresetShadowDirection ?? 315;
		const dirRad = (dir * Math.PI) / 180;
		const psOx = Math.round(Math.cos(dirRad) * dist * 100) / 100;
		const psOy = Math.round(Math.sin(dirRad) * dist * 100) / 100;
		const psColor = normalizeHexColor(style.textPresetShadowColor, '#000000');
		const psOpacity = style.textPresetShadowOpacity ?? 0.5;
		const psR = parseInt(psColor.slice(1, 3), 16);
		const psG = parseInt(psColor.slice(3, 5), 16);
		const psB = parseInt(psColor.slice(5, 7), 16);
		shadows.push(`${psOx}px ${psOy}px 4px rgba(${psR},${psG},${psB},${psOpacity})`);
	}

	return shadows.length > 0 ? shadows.join(', ') : undefined;
}

/**
 * Build a CSS `box-shadow` value for a text run's inner shadow (`a:innerShdw`).
 *
 * `filter: drop-shadow(...)` (the pre-fix implementation) is ALWAYS an OUTER
 * shadow: it silhouettes the element's rendered alpha and paints the shadow
 * around the OUTSIDE of it, CSS's only inset primitive that also fragments
 * correctly per line for an inline element - `box-shadow: inset` - does. It
 * is a coarser approximation than a true per-glyph inset (it shades the run's
 * own line-fragment BOX, not each glyph's individual outline), but it is
 * unambiguously "inside" rather than a halo bleeding outward, which is what
 * `a:innerShdw` means (COM-verified against `audit-text` slide 14:
 * PowerPoint's "INNERSHDW" run shows a subtle shading tucked against the
 * inside of the letterforms, nothing bleeding past their edges, while the old
 * `drop-shadow` painted a diffuse blurred halo OUTSIDE every glyph). `inset`
 * on a plain (non-block) element still fragments per line box in every
 * evergreen browser, the same way `background`/`border` do, so this needs no
 * wrapper element and does not disturb line wrapping.
 */
export function buildTextInnerShadowCss(style: TextStyle): string | undefined {
	const has =
		style.textInnerShadowColor ||
		(typeof style.textInnerShadowBlur === 'number' && style.textInnerShadowBlur > 0);
	if (!has) {
		return undefined;
	}
	const ox = style.textInnerShadowOffsetX ?? 0;
	const oy = style.textInnerShadowOffsetY ?? 0;
	const blur = style.textInnerShadowBlur ?? 3;
	const color = normalizeHexColor(style.textInnerShadowColor, '#000000');
	const opacity = style.textInnerShadowOpacity ?? 0.5;
	const r = parseInt(color.slice(1, 3), 16);
	const g = parseInt(color.slice(3, 5), 16);
	const b = parseInt(color.slice(5, 7), 16);
	return `inset ${ox}px ${oy}px ${blur}px rgba(${r},${g},${b},${opacity})`;
}

/** Build a CSS `filter` for text blur effect (`a:blur`). */
export function buildTextBlurFilter(style: TextStyle): string | undefined {
	if (typeof style.textBlurRadius !== 'number' || style.textBlurRadius <= 0) {
		return undefined;
	}
	return `blur(${Math.round(style.textBlurRadius)}px)`;
}

/**
 * Build a CSS `filter` for a text run's soft edge (`a:softEdge`).
 *
 * `a:softEdge` was never parsed onto `TextStyle` before `textSoftEdgeRadius`
 * existed (see that field's doc comment), so this had no caller and a run's
 * soft edge silently did nothing. `blur()` is the same primitive `a:blur`
 * uses; the two are still kept as separate style fields (`a:blur` blurs the
 * whole run including its colour, `a:softEdge` only feathers the alpha edge),
 * but for a solid-filled run - the common case - the CSS result is the same
 * uniform edge blur, so this reuses the identical formula.
 */
export function buildTextSoftEdgeFilter(style: TextStyle): string | undefined {
	if (typeof style.textSoftEdgeRadius !== 'number' || style.textSoftEdgeRadius <= 0) {
		return undefined;
	}
	return `blur(${Math.round(style.textSoftEdgeRadius)}px)`;
}

/**
 * Build a CSS `filter` for text HSL modifications.
 * Maps OOXML hue/saturation/luminance adjustments to CSS filter functions.
 */
export function buildTextHslFilter(style: TextStyle): string | undefined {
	const parts: string[] = [];
	if (typeof style.textHslHue === 'number' && style.textHslHue !== 0) {
		parts.push(`hue-rotate(${style.textHslHue}deg)`);
	}
	if (typeof style.textHslSaturation === 'number' && style.textHslSaturation !== 100) {
		parts.push(`saturate(${style.textHslSaturation / 100})`);
	}
	if (typeof style.textHslLuminance === 'number' && style.textHslLuminance !== 0) {
		parts.push(`brightness(${1 + style.textHslLuminance / 100})`);
	}
	return parts.length > 0 ? parts.join(' ') : undefined;
}

/** Compute CSS opacity from text alpha modification effects. */
export function getTextAlphaOpacity(style: TextStyle): number | undefined {
	if (typeof style.textAlphaModFix === 'number') {
		return Math.max(0, Math.min(1, style.textAlphaModFix / 100));
	}
	if (typeof style.textAlphaMod === 'number') {
		return Math.max(0, Math.min(1, style.textAlphaMod / 100));
	}
	return undefined;
}

/**
 * Build a CSS `filter` value for a text run's glow (`a:glow`).
 *
 * A single `drop-shadow(0 0 <radius>px ...)` is one Gaussian blur pass, which
 * spreads the colour into a soft, low-opacity cloud reaching all the way out
 * to `radius` - visibly more diffuse than PowerPoint's glow, which reads as a
 * fairly solid, uniform-width halo hugging the glyph before fading out only
 * near the outer edge (COM-verified against `audit-text` slide 14's "GLOW"
 * run). Stacking three `drop-shadow()`s at increasing radius and decreasing
 * opacity - the same 0.33/0.66/1.0 radius and opacity falloff
 * {@link getGlowBoxShadowCss} already uses for a SHAPE's glow (`box-shadow`
 * layers) - builds up a denser core near the glyph with a shorter actual
 * fade tail, matching PowerPoint's tighter halo far more closely than one
 * wide blur.
 */
export function buildTextGlowFilter(style: TextStyle): string | undefined {
	const hasGlow =
		style.textGlowColor || (typeof style.textGlowRadius === 'number' && style.textGlowRadius > 0);
	if (!hasGlow) {
		return undefined;
	}
	const radius = style.textGlowRadius ?? 6;
	const color = normalizeHexColor(style.textGlowColor, '#ffff00');
	const opacity = style.textGlowOpacity ?? 0.6;
	const r = parseInt(color.slice(1, 3), 16);
	const g = parseInt(color.slice(3, 5), 16);
	const b = parseInt(color.slice(5, 7), 16);
	const layers = [
		{ fraction: 0.33, opacityScale: 1 },
		{ fraction: 0.66, opacityScale: 0.6 },
		{ fraction: 1, opacityScale: 0.3 },
	];
	return layers
		.map(({ fraction, opacityScale }) => {
			const layerRadius = Math.max(0, Math.round(radius * fraction));
			const layerOpacity = Math.min(1, opacity * opacityScale);
			return `drop-shadow(0 0 ${layerRadius}px rgba(${r},${g},${b},${layerOpacity}))`;
		})
		.join(' ');
}
