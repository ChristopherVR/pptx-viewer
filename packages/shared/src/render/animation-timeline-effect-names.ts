/**
 * `animation-timeline-effect-names` - the {@link EffectName} catalog, split out
 * of `animation-timeline-types` to keep that module under the file-size limit.
 * Re-exported from `animation-timeline-types` so existing imports are unaffected.
 *
 * @module render/animation-timeline-effect-names
 */

/** Catalog of static effect keyframe short-names (without the `pptx-` prefix). */
export type EffectName =
	| 'appear'
	| 'fadeIn'
	| 'flyInLeft'
	| 'flyInRight'
	| 'flyInTop'
	| 'flyInBottom'
	| 'zoomIn'
	| 'bounceIn'
	| 'wipeIn'
	| 'splitIn'
	| 'dissolveIn'
	| 'wheelIn'
	| 'blindsIn'
	| 'boxIn'
	| 'circleIn'
	| 'floatIn'
	| 'riseUp'
	| 'swivel'
	| 'expandIn'
	| 'checkerboardIn'
	| 'flashIn'
	| 'peekIn'
	| 'randomBarsIn'
	| 'spinnerIn'
	| 'growTurnIn'
	| 'diamondIn'
	| 'plusIn'
	| 'wedgeIn'
	// entr.15/25/27/28/29/32/36/38/41/43/44/51/52/56/57/59: dedicated keyframes
	// for the "extended" (post-2007) entrance gallery families with no cheap
	// reuse of an existing static effect. COM-verified presetIDs 1-26 (which
	// this codebase already cross-checks against `ooxmlToPresetName`); ids
	// above 26 are mapped by NAME identity against the existing, previously
	// COM-verified authoring/catalog tables (`animation-write-mappings.ts`,
	// `animation-preset-catalog.ts`), not re-derived here (see
	// `animation-preset-ground-truth.ts` and the W3-A report for the COM
	// evidence and its limits: PowerPoint's `AddEffect` automation degrades
	// several 2013+ gallery effects to a plain `filter="fade"` reveal with no
	// child `p:animScale`/`p:animRot` richness, which is NOT proof of the real
	// authored visual, only proof of the numeric presetID and reveal filter).
	| 'spiralIn'
	| 'boomerangIn'
	| 'creditsIn'
	| 'floatUpIn'
	| 'pinwheelIn'
	| 'whipIn'
	| 'curveUpIn'
	| 'foldIn'
	| 'lightSpeedIn'
	| 'flipIn'
	| 'glideIn'
	| 'compressIn'
	| 'unfoldIn'
	| 'rotateIn'
	| 'centerRevolveIn'
	| 'dropIn'
	| 'cutIn'
	| 'stretchInLeft'
	| 'stretchInRight'
	| 'stretchInTop'
	| 'stretchInBottom'
	| 'newsflashIn'
	// `p:animEffect/@filter="pixelate"`: a mosaic grid reveal built from
	// discrete SVG `<filter>` data-URI steps (see `animation-pixelate-filter`).
	| 'pixelateIn'
	| 'disappear'
	| 'fadeOut'
	| 'flyOutLeft'
	| 'flyOutRight'
	| 'flyOutTop'
	| 'flyOutBottom'
	| 'zoomOut'
	| 'bounceOut'
	| 'sinkDown'
	| 'wipeOut'
	| 'shrinkOut'
	| 'dissolveOut'
	| 'cutOut'
	| 'stretchOutLeft'
	| 'stretchOutRight'
	| 'stretchOutTop'
	| 'stretchOutBottom'
	| 'newsflashOut'
	// Exit-side counterpart of `pixelateIn` (see above).
	| 'pixelateOut'
	| 'boxOut'
	| 'checkerboardOut'
	| 'blindsOut'
	| 'wheelOut'
	| 'randomBarsOut'
	| 'diamondOut'
	| 'plusOut'
	| 'wedgeOut'
	// Exit-side counterparts of the extended entrance families above, plus
	// `peekOut`/`splitOut` (exit.16/17: the Peek Out / Split exit forms, which
	// unlike their entrance counterparts had no dedicated exit keyframe at
	// all before this pass).
	| 'peekOut'
	| 'splitOut'
	| 'spiralOut'
	| 'boomerangOut'
	| 'creditsOut'
	| 'floatDownOut'
	| 'pinwheelOut'
	| 'spinnerOut'
	| 'whipOut'
	| 'curveDownOut'
	| 'unfoldOut'
	| 'lightSpeedOut'
	| 'flipOut'
	| 'glideOut'
	| 'foldOut'
	| 'rotateOut'
	| 'centerRevolveOut'
	| 'dropOut'
	// exit.11 (Flash Once) and exit.12 (Peek Out, presetSubtype 4 / bottom
	// edge, distinct from exit.16's own "Peek Out" naming mismatch - see the
	// note on `peekOutDown`'s keyframe): the last two of the 68 exit preset
	// ids to gain a dedicated playback keyframe.
	| 'flashOnceOut'
	| 'peekOutDown'
	| 'pulse'
	| 'blink'
	| 'shimmer'
	| 'spin'
	| 'teeter'
	| 'growShrink'
	| 'transparency'
	| 'boldFlash'
	| 'wave'
	| 'colorWave'
	| 'bounce'
	| 'flash';
