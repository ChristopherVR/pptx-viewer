// ---------------------------------------------------------------------------
// Bevel type options (used by the Bevel/3D effect)
//
// NOTE: `label` keeps the English fallback text (existing consumers still
// render `option.label` directly). Each option also carries an `i18nKey`
// pointing at the shared i18n dictionary, matching the `{ value, i18nKey }`
// convention already used elsewhere in this codebase, so a render site can
// switch to `t(option.i18nKey)` without a data-shape change.
// ---------------------------------------------------------------------------

export const BEVEL_TYPE_OPTIONS = [
	{ value: 'circle', label: 'Circle', i18nKey: 'pptx.bevelTypes.circle' },
	{ value: 'relaxedInset', label: 'Relaxed Inset', i18nKey: 'pptx.bevelTypes.relaxedInset' },
	{ value: 'cross', label: 'Cross', i18nKey: 'pptx.bevelTypes.cross' },
	{ value: 'slope', label: 'Slope', i18nKey: 'pptx.bevelTypes.slope' },
	{ value: 'convex', label: 'Convex', i18nKey: 'pptx.bevelTypes.convex' },
	{ value: 'coolSlant', label: 'Cool Slant', i18nKey: 'pptx.bevelTypes.coolSlant' },
	{ value: 'angle', label: 'Angle', i18nKey: 'pptx.bevelTypes.angle' },
	{ value: 'softRound', label: 'Soft Round', i18nKey: 'pptx.bevelTypes.softRound' },
	{ value: 'riblet', label: 'Riblet', i18nKey: 'pptx.bevelTypes.riblet' },
	{ value: 'hardEdge', label: 'Hard Edge', i18nKey: 'pptx.bevelTypes.hardEdge' },
	{ value: 'artDeco', label: 'Art Deco', i18nKey: 'pptx.bevelTypes.artDeco' },
	{ value: 'divot', label: 'Divot', i18nKey: 'pptx.bevelTypes.divot' },
];
