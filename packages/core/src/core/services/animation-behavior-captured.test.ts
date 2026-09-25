import { describe, expect, it } from 'vitest';

import type { PptxElementAnimation, XmlObject } from '../types';
import { ENTRANCE_PRESETS, EXIT_PRESETS } from '../utils/animation-preset-catalog';
import {
	capturedPresetIds,
	capturedSubtypes,
	getCapturedPreset,
	getCapturedTree,
} from './animation-behavior-captured';
import { capturedPresetNativeAnimation } from './animation-behavior-native';
import { getAnimationBehaviorNodes } from './animation-behavior-table';
import { buildSingleEffectNode } from './animation-write-node-builders';

function ids(): () => number {
	let id = 100;
	return () => id++;
}

function effectCTn(node: XmlObject): XmlObject {
	const outer = node['p:cTn'] as XmlObject;
	return ((outer['p:childTnLst'] as XmlObject)['p:par'] as XmlObject)['p:cTn'] as XmlObject;
}

function list<T>(value: T | T[] | undefined): T[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

function attrNames(node: XmlObject): string[] {
	const lst = (node['p:cBhvr'] as XmlObject)['p:attrNameLst'] as XmlObject | undefined;
	const raw = lst?.['p:attrName'];
	return list(raw as string | XmlObject | Array<string | XmlObject>).map((entry) =>
		typeof entry === 'string' ? entry : String(entry['#text']),
	);
}

describe('captured PowerPoint behaviour trees', () => {
	it('cover exactly the catalogue ids, for entrance and exit alike', () => {
		const catalogue = (presets: typeof ENTRANCE_PRESETS) =>
			presets.map((p) => Number(p.presetId.split('.')[1]));
		expect(capturedPresetIds('entr')).toStrictEqual(catalogue(ENTRANCE_PRESETS));
		expect(capturedPresetIds('exit')).toStrictEqual(catalogue(EXIT_PRESETS));
	});

	it('record every direction variant PowerPoint accepted (196 per class)', () => {
		const count = (cls: 'entr' | 'exit') =>
			capturedPresetIds(cls).reduce((sum, id) => sum + capturedSubtypes(cls, id).length, 0);
		expect(count('entr')).toBe(196);
		expect(count('exit')).toBe(196);
	});

	it('builds a node for every captured behaviour of every variant', () => {
		for (const cls of ['entr', 'exit'] as const) {
			for (const id of capturedPresetIds(cls)) {
				for (const sub of capturedSubtypes(cls, id)) {
					const tree = getCapturedTree(cls, id, sub)!;
					const built = getAnimationBehaviorNodes(cls, id, sub, '7', 1000, ids())!;
					expect(built.nodes, `${cls}.${id}/${sub}`).toHaveLength(tree.nodes.length);
					expect(built.presetSubtype).toBe(sub);
				}
			}
		}
	});

	it('falls back to the default subtype, never to another preset', () => {
		const wipe = getCapturedTree('entr', 22, 999)!;
		expect(wipe.subtype).toBe(getCapturedPreset('entr', 22)!.defaultSubtype);
		expect(getCapturedTree('entr', 44, 0)).toBeUndefined();
	});
});

describe('the writer emits PowerPoint trees instead of a fade placeholder', () => {
	const write = (
		token: string,
		cls: 'entr' | 'exit',
		extra: Partial<PptxElementAnimation> = {},
	) => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			...(cls === 'entr' ? { entrance: token } : { exit: token }),
			durationMs: 1000,
			...extra,
		} as PptxElementAnimation;
		return effectCTn(buildSingleEffectNode(anim, anim.entrance ?? anim.exit!, cls, ids())!);
	};

	it('crawl in moves from off-slide with p:anim, not a fade', () => {
		const cTn = write('crawlIn', 'entr');
		const children = cTn['p:childTnLst'] as XmlObject;
		expect(children['p:animEffect']).toBeUndefined();
		expect(list(children['p:anim'] as XmlObject[]).flatMap(attrNames)).toStrictEqual([
			'ppt_x',
			'ppt_y',
		]);
	});

	it('spiral in animates size and position', () => {
		const children = write('spiralIn', 'entr')['p:childTnLst'] as XmlObject;
		expect(list(children['p:anim'] as XmlObject[]).flatMap(attrNames)).toStrictEqual([
			'ppt_w',
			'ppt_h',
			'ppt_x',
			'ppt_y',
		]);
	});

	it.each([
		['stretchIn', 'entr', ['ppt_w', 'ppt_h']],
		['swivel', 'entr', ['ppt_w', 'ppt_h']],
		['zoomIn', 'entr', ['ppt_w', 'ppt_h']],
		[
			'boomerangIn',
			'entr',
			['style.rotation', 'ppt_w', 'ppt_w', 'ppt_h', 'ppt_x', 'ppt_y', 'ppt_y'],
		],
	] as const)('%s writes the real p:anim tree', (token, cls, names) => {
		const children = write(token, cls)['p:childTnLst'] as XmlObject;
		expect(list(children['p:anim'] as XmlObject[]).flatMap(attrNames)).toStrictEqual(names);
	});

	it('a catalogue pick (entr.41 Whip) is written, with its default letter iterate', () => {
		const cTn = write('entr.41', 'entr');
		expect(cTn['@_presetID']).toBe('41');
		expect(cTn['p:iterate']).toStrictEqual({ '@_type': 'lt', 'p:tmPct': { '@_val': '10000' } });
	});

	it("keeps PowerPoint's own speed curve unless the author picked one", () => {
		expect(write('entr.38', 'entr')['@_accel']).toBe('50000');
		expect(write('entr.38', 'entr', { timingCurve: 'linear' })['@_accel']).toBeUndefined();
	});

	it('scales every node with the requested duration and keeps 1 ms toggles absolute', () => {
		const cTn = write('flyIn', 'entr', { durationMs: 2000 });
		const children = cTn['p:childTnLst'] as XmlObject;
		const set = children['p:set'] as XmlObject;
		expect(((set['p:cBhvr'] as XmlObject)['p:cTn'] as XmlObject)['@_dur']).toBe('1');
		for (const anim of list(children['p:anim'] as XmlObject[])) {
			expect(((anim['p:cBhvr'] as XmlObject)['p:cTn'] as XmlObject)['@_dur']).toBe('2000');
		}
	});

	it('an exit hides 1 ms before its end, as PowerPoint writes it', () => {
		const children = write('fadeOut', 'exit', { durationMs: 800 })['p:childTnLst'] as XmlObject;
		const set = children['p:set'] as XmlObject;
		const cTn = (set['p:cBhvr'] as XmlObject)['p:cTn'] as XmlObject;
		expect((cTn['p:stCondLst'] as XmlObject)['p:cond']).toStrictEqual({ '@_delay': '799' });
	});
});

describe('capturedPresetNativeAnimation', () => {
	it('parses Crawl In into the ppt_x/ppt_y ramps a loaded deck would carry', () => {
		const anim = capturedPresetNativeAnimation('entr', 7, 4, 5000)!;
		expect(anim.presetClass).toBe('entr');
		expect(anim.presetId).toBe(7);
		expect(anim.attributeAnimations?.map((a) => a.attrName)).toStrictEqual(['ppt_x', 'ppt_y']);
	});

	it('parses Wipe from the left into its wipe(left) filter', () => {
		const wipe = capturedPresetNativeAnimation('entr', 22, 8)?.effectFilter;
		expect(wipe?.raw).toBe('wipe(left)');
		expect(wipe?.transition).toBe('in');
	});

	it('is undefined for an id PowerPoint has no preset for', () => {
		expect(capturedPresetNativeAnimation('entr', 44, 0)).toBeUndefined();
	});
});
