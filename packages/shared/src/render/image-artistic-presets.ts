/**
 * Artistic image-effect presets for the image inspector's "Artistic Effects"
 * gallery. Each entry is a tuple `[effectName, i18nKey, cssFilter]`:
 *  - `effectName` is the stored `imageEffects.artisticEffect` value (`'none'`
 *    clears it),
 *  - `i18nKey` is the translation key for the label/tooltip,
 *  - `cssFilter` is the CSS `filter` string used for the live thumbnail preview.
 *
 * Framework-free pure data, consumed by every binding's artistic-effects gallery
 * (React / Vue / Angular) so the catalogue stays in one place.
 */
export const ARTISTIC_EFFECTS = [
	['none', 'pptx.image.effectNone', ''],
	['blur', 'pptx.image.effectBlur', 'blur(4px)'],
	['grayscale', 'pptx.image.effectGrayscale', 'grayscale(100%)'],
	['sepia', 'pptx.image.effectSepia', 'sepia(100%)'],
	[
		'pencilSketch',
		'pptx.image.effectPencilSketch',
		'grayscale(100%) contrast(150%) brightness(80%)',
	],
	['lineDrawing', 'pptx.image.effectLineDrawing', 'grayscale(100%) contrast(150%)'],
	['watercolorSponge', 'pptx.image.effectWatercolor', 'saturate(150%) blur(1px)'],
	['paintStrokes', 'pptx.image.effectPaintStrokes', 'blur(3px) saturate(140%)'],
	['glow_edges', 'pptx.image.effectGlowEdges', 'contrast(180%) invert(5%) brightness(110%)'],
	['glowDiffused', 'pptx.image.effectGlowDiffused', 'blur(3px) brightness(120%)'],
	['cement', 'pptx.image.effectCement', 'contrast(200%) brightness(60%)'],
	['photocopy', 'pptx.image.effectPhotocopy', 'grayscale(100%) contrast(200%) brightness(120%)'],
	['filmGrain', 'pptx.image.effectFilmGrain', 'contrast(110%) brightness(105%)'],
	['mosaic', 'pptx.image.effectMosaic', 'blur(8px) contrast(105%)'],
	['chalkSketch', 'pptx.image.effectChalk', 'grayscale(80%) contrast(140%) brightness(110%)'],
	['marker', 'pptx.image.effectMarker', 'contrast(130%) saturate(130%)'],
	['cutout', 'pptx.image.effectCutout', 'contrast(300%) brightness(120%)'],
	['pastelsSmooth', 'pptx.image.effectPastels', 'blur(4px) saturate(120%)'],
	['paint', 'pptx.image.effectPaint', 'blur(3px) saturate(160%) contrast(110%)'],
	['plasticWrap', 'pptx.image.effectPlasticWrap', 'contrast(150%) brightness(115%) saturate(80%)'],
	['lightScreen', 'pptx.image.effectLightScreen', 'brightness(130%) contrast(80%)'],
	['sharpen', 'pptx.image.effectSharpen', 'contrast(160%) brightness(105%)'],
	['texturizer', 'pptx.image.effectTexturizer', 'contrast(110%) brightness(105%)'],
	['crisscrossEtching', 'pptx.image.effectCrisscross', 'grayscale(60%) contrast(120%)'],
] as const;
