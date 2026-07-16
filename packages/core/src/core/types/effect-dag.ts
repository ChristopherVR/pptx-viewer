import type { XmlObject } from './common';

export type EffectDagBlendMode = 'darken' | 'lighten' | 'mult' | 'over' | 'screen';
export type EffectDagContainerType = 'sib' | 'tree';

export type EffectDagNode =
	| EffectDagContainer
	| EffectDagBlend
	| EffectDagXfrm
	| EffectDagRelOff
	| EffectDagBlur
	| EffectDagAlphaOutset
	| EffectDagPresetShadow
	| EffectDagRawLeaf;

export interface EffectDagContainer {
	kind: 'cont';
	type: EffectDagContainerType;
	name?: string;
	children: EffectDagNode[];
}

export interface EffectDagBlend {
	kind: 'blend';
	mode: EffectDagBlendMode;
	container: EffectDagContainer;
}

export interface EffectDagXfrm {
	kind: 'xfrmEffect';
	sx?: number;
	sy?: number;
	kx?: number;
	ky?: number;
	tx?: number;
	ty?: number;
}

export interface EffectDagRelOff {
	kind: 'relOff';
	tx?: number;
	ty?: number;
}

/** Typed CT_BlurEffect with its original payload retained for lossless edits. */
export interface EffectDagBlur {
	kind: 'blur';
	radiusEmu?: number;
	grow?: boolean;
	xml: XmlObject;
}

/** Typed CT_AlphaOutsetEffect with original XML retained for lossless edits. */
export interface EffectDagAlphaOutset {
	kind: 'alphaOutset';
	radiusEmu?: number;
	xml: XmlObject;
}

/** Typed CT_PresetShadowEffect with colour and extension XML retained verbatim. */
export interface EffectDagPresetShadow {
	kind: 'prstShdw';
	preset?: `shdw${number}`;
	distanceEmu?: number;
	direction?: number;
	xml: XmlObject;
}

export interface EffectDagRawLeaf {
	kind: 'raw';
	tag: string;
	xml: Record<string, unknown>;
}
