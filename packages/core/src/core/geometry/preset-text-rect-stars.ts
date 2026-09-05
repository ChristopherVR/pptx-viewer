/**
 * Text-inset rects for the star family: `star4`, `star5`, `star6`, `star7`,
 * `star8`, `star10`, `star12`, `star16`, `star24`, `star32`.
 *
 * Transcribed verbatim from ECMA-376's `presetShapeDefinitions.xml` `<rect>`
 * element (the same source, same method as `preset-connection-sites-*.ts`).
 * See `preset-text-rect-types.ts` for why this is a separate override table
 * rather than an edit to `preset-shape-definitions-*.ts`.
 *
 * @module render/preset-text-rect-stars
 */
import { gd } from './preset-connection-sites-types';
import type { PresetTextRectDefinition } from './preset-text-rect-types';

export const STAR_TEXT_RECTS: Record<string, PresetTextRectDefinition> = {
	star4: {
		avLst: { adj: 12500 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('iwd2', '*/ wd2 a 50000'),
			gd('ihd2', '*/ hd2 a 50000'),
			gd('sdx', 'cos iwd2 2700000'),
			gd('sdy', 'sin ihd2 2700000'),
			gd('sx1', '+- hc 0 sdx'),
			gd('sx2', '+- hc sdx 0'),
			gd('sy1', '+- vc 0 sdy'),
			gd('sy2', '+- vc sdy 0'),
		],
		rect: { l: 'sx1', t: 'sy1', r: 'sx2', b: 'sy2' },
	},

	star5: {
		avLst: { vf: 110557, adj: 19098, hf: 105146 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('swd2', '*/ wd2 hf 100000'),
			gd('shd2', '*/ hd2 vf 100000'),
			gd('svc', '*/ vc  vf 100000'),
			gd('iwd2', '*/ swd2 a 50000'),
			gd('ihd2', '*/ shd2 a 50000'),
			gd('sdx1', 'cos iwd2 20520000'),
			gd('sdy1', 'sin ihd2 3240000'),
			gd('sx1', '+- hc 0 sdx1'),
			gd('sx4', '+- hc sdx1 0'),
			gd('sy1', '+- svc 0 sdy1'),
			gd('sy3', '+- svc ihd2 0'),
		],
		rect: { l: 'sx1', t: 'sy1', r: 'sx4', b: 'sy3' },
	},

	star6: {
		avLst: { hf: 115470, adj: 28868 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('swd2', '*/ wd2 hf 100000'),
			gd('iwd2', '*/ swd2 a 50000'),
			gd('ihd2', '*/ hd2 a 50000'),
			gd('sx1', '+- hc 0 iwd2'),
			gd('sx4', '+- hc iwd2 0'),
			gd('sdy1', 'sin ihd2 3600000'),
			gd('sy1', '+- vc 0 sdy1'),
			gd('sy2', '+- vc sdy1 0'),
		],
		rect: { l: 'sx1', t: 'sy1', r: 'sx4', b: 'sy2' },
	},

	star7: {
		avLst: { vf: 105210, hf: 102572, adj: 34601 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('swd2', '*/ wd2 hf 100000'),
			gd('shd2', '*/ hd2 vf 100000'),
			gd('svc', '*/ vc  vf 100000'),
			gd('iwd2', '*/ swd2 a 50000'),
			gd('ihd2', '*/ shd2 a 50000'),
			gd('sdx2', '*/ iwd2 78183 100000'),
			gd('sx2', '+- hc 0 sdx2'),
			gd('sx5', '+- hc sdx2 0'),
			gd('sdy1', '*/ ihd2 90097 100000'),
			gd('sdy3', '*/ ihd2 62349 100000'),
			gd('sy1', '+- svc 0 sdy1'),
			gd('sy3', '+- svc sdy3 0'),
		],
		rect: { l: 'sx2', t: 'sy1', r: 'sx5', b: 'sy3' },
	},

	star8: {
		avLst: { adj: 37500 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('iwd2', '*/ wd2 a 50000'),
			gd('ihd2', '*/ hd2 a 50000'),
			gd('sdx1', '*/ iwd2 92388 100000'),
			gd('sdy1', '*/ ihd2 92388 100000'),
			gd('sx1', '+- hc 0 sdx1'),
			gd('sx4', '+- hc sdx1 0'),
			gd('sy1', '+- vc 0 sdy1'),
			gd('sy4', '+- vc sdy1 0'),
		],
		rect: { l: 'sx1', t: 'sy1', r: 'sx4', b: 'sy4' },
	},

	star10: {
		avLst: { hf: 105146, adj: 42533 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('swd2', '*/ wd2 hf 100000'),
			gd('iwd2', '*/ swd2 a 50000'),
			gd('ihd2', '*/ hd2 a 50000'),
			gd('sdx1', '*/ iwd2 80902 100000'),
			gd('sdy2', '*/ ihd2 58779 100000'),
			gd('sx2', '+- hc 0 sdx1'),
			gd('sx5', '+- hc sdx1 0'),
			gd('sy2', '+- vc 0 sdy2'),
			gd('sy3', '+- vc sdy2 0'),
		],
		rect: { l: 'sx2', t: 'sy2', r: 'sx5', b: 'sy3' },
	},

	star12: {
		avLst: { adj: 37500 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('iwd2', '*/ wd2 a 50000'),
			gd('ihd2', '*/ hd2 a 50000'),
			gd('sdx2', 'cos iwd2 2700000'),
			gd('sdy2', 'sin ihd2 2700000'),
			gd('sx2', '+- hc 0 sdx2'),
			gd('sx5', '+- hc sdx2 0'),
			gd('sy2', '+- vc 0 sdy2'),
			gd('sy5', '+- vc sdy2 0'),
		],
		rect: { l: 'sx2', t: 'sy2', r: 'sx5', b: 'sy5' },
	},

	star16: {
		avLst: { adj: 37500 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('iwd2', '*/ wd2 a 50000'),
			gd('ihd2', '*/ hd2 a 50000'),
			gd('idx', 'cos iwd2 2700000'),
			gd('idy', 'sin ihd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('it', '+- vc 0 idy'),
			gd('ir', '+- hc idx 0'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	star24: {
		avLst: { adj: 37500 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('iwd2', '*/ wd2 a 50000'),
			gd('ihd2', '*/ hd2 a 50000'),
			gd('idx', 'cos iwd2 2700000'),
			gd('idy', 'sin ihd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('it', '+- vc 0 idy'),
			gd('ir', '+- hc idx 0'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},

	star32: {
		avLst: { adj: 37500 },
		gdLst: [
			gd('a', 'pin 0 adj 50000'),
			gd('iwd2', '*/ wd2 a 50000'),
			gd('ihd2', '*/ hd2 a 50000'),
			gd('idx', 'cos iwd2 2700000'),
			gd('idy', 'sin ihd2 2700000'),
			gd('il', '+- hc 0 idx'),
			gd('it', '+- vc 0 idy'),
			gd('ir', '+- hc idx 0'),
			gd('ib', '+- vc idy 0'),
		],
		rect: { l: 'il', t: 'it', r: 'ir', b: 'ib' },
	},
};
