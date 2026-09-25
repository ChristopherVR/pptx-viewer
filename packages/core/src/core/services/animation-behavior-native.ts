/**
 * PowerPoint's captured behaviour tree for a preset, parsed into the same
 * {@link PptxNativeAnimation} shape a loaded deck produces.
 *
 * WHY: playback interprets a deck's real behaviour nodes (`p:anim` formulas,
 * `p:animScale`, `p:animEffect` filters...). An effect whose `p:cTn` names a
 * preset but carries no usable tree (a file from a tool that writes only the
 * preset id, or a hand-trimmed timing tree) used to fall back to a canned
 * keyframe that only approximates the preset. Building PowerPoint's own tree
 * for it, then running it through the very parser a loaded deck goes
 * through, lets playback treat it exactly like a PowerPoint-authored effect,
 * and keeps the writer and the player on one table.
 *
 * @module services/animation-behavior-native
 */
import type { PptxNativeAnimation, XmlObject } from '../types';
import { getCapturedTree } from './animation-behavior-captured';
import { buildCapturedBehaviorNodes } from './animation-behavior-captured-xml';
import { groupBehaviorChildren } from './animation-write-child-groups';
import { PptxNativeAnimationService } from './PptxNativeAnimationService';

const SHAPE_ID = '2';
const cache = new Map<string, PptxNativeAnimation | null>();

function wrapInSlide(effectCTn: XmlObject): XmlObject {
	const par = (cTn: XmlObject): XmlObject => ({ 'p:cTn': cTn });
	return {
		'p:sld': {
			'p:timing': {
				'p:tnLst': {
					'p:par': par({
						'@_id': '1',
						'@_dur': 'indefinite',
						'@_restart': 'never',
						'@_nodeType': 'tmRoot',
						'p:childTnLst': {
							'p:seq': {
								'@_concurrent': '1',
								'@_nextAc': 'seek',
								'p:cTn': {
									'@_id': '2',
									'@_dur': 'indefinite',
									'@_nodeType': 'mainSeq',
									'p:childTnLst': {
										'p:par': par({
											'@_id': '3',
											'@_fill': 'hold',
											'p:stCondLst': { 'p:cond': { '@_delay': 'indefinite' } },
											'p:childTnLst': {
												'p:par': par({
													'@_id': '4',
													'@_fill': 'hold',
													'p:stCondLst': { 'p:cond': { '@_delay': '0' } },
													'p:childTnLst': { 'p:par': par(effectCTn) },
												}),
											},
										}),
									},
								},
							},
						},
					}),
				},
			},
		},
	};
}

/**
 * The native animation PowerPoint's own tree for `(class, id, subtype)`
 * parses to, at `durationMs`. `undefined` when PowerPoint has no such
 * preset. Results are cached per key; callers get a fresh shallow copy.
 */
export function capturedPresetNativeAnimation(
	presetClass: 'entr' | 'exit',
	presetId: number,
	presetSubtype: number | undefined,
	durationMs?: number,
): PptxNativeAnimation | undefined {
	const captured = getCapturedTree(presetClass, presetId, presetSubtype);
	if (!captured) {
		return undefined;
	}
	const dur = durationMs ?? captured.preset.durMs;
	const key = `${presetClass}.${presetId}.${captured.subtype}.${dur}`;
	let parsed = cache.get(key);
	if (parsed === undefined) {
		let nextId = 10;
		const children = buildCapturedBehaviorNodes(captured.nodes, SHAPE_ID, dur, () => nextId++);
		const effectCTn: XmlObject = {
			'@_id': '5',
			'@_presetID': String(presetId),
			'@_presetClass': presetClass,
			'@_presetSubtype': String(captured.subtype),
			'@_fill': 'hold',
			'@_nodeType': 'clickEffect',
			...(captured.preset.effect?.accel ? { '@_accel': captured.preset.effect.accel } : {}),
			...(captured.preset.effect?.decel ? { '@_decel': captured.preset.effect.decel } : {}),
			'p:stCondLst': { 'p:cond': { '@_delay': '0' } },
			'p:childTnLst': groupBehaviorChildren(children),
		};
		const animations = new PptxNativeAnimationService().parseNativeAnimations(
			wrapInSlide(effectCTn),
		);
		parsed = animations?.find((anim) => anim.presetId === presetId) ?? null;
		cache.set(key, parsed);
	}
	return parsed ? { ...parsed } : undefined;
}
