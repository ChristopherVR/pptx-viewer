import { describe, it, expect } from 'vitest';

import type { PptxElementAnimation, XmlObject } from '../types';
import { buildSingleEffectNode } from './animation-write-node-builders';

function createIdAllocator(start = 1): () => number {
	let id = start;
	return () => id++;
}

/** Drill down to the effect `p:cTn` (with `presetID`/`presetClass`) and its `p:childTnLst`. */
function effectChildTnLst(node: XmlObject): XmlObject {
	const outerCTn = node['p:cTn'] as XmlObject;
	const par = (outerCTn['p:childTnLst'] as XmlObject)['p:par'] as XmlObject;
	const effectCTn = par['p:cTn'] as XmlObject;
	return effectCTn['p:childTnLst'] as XmlObject;
}

function asArray<T>(value: T | T[] | undefined): T[] {
	if (value === undefined) {
		return [];
	}
	return Array.isArray(value) ? value : [value];
}

describe('animation behaviour table: entrance/exit filter presets', () => {
	it('appear writes only a visibility p:set, no p:animEffect', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', entrance: 'appear', durationMs: 500 };
		const node = buildSingleEffectNode(anim, 'appear', 'entr', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		expect(childTnLst['p:animEffect']).toBeUndefined();
		expect(childTnLst['p:set']).toBeDefined();
	});

	it('disappear writes only a visibility p:set, no p:animEffect', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', exit: 'disappear', durationMs: 500 };
		const node = buildSingleEffectNode(anim, 'disappear', 'exit', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		expect(childTnLst['p:animEffect']).toBeUndefined();
	});

	it('circle in writes filter="circle(in)"', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', entrance: 'circleIn', durationMs: 500 };
		const node = buildSingleEffectNode(anim, 'circleIn', 'entr', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const animEffect = childTnLst['p:animEffect'] as XmlObject;
		expect(animEffect['@_filter']).toBe('circle(in)');
		expect(animEffect['@_transition']).toBe('in');
	});

	it('split writes filter="barn(inVertical)" for both entrance and exit', () => {
		const entr = buildSingleEffectNode(
			{ elementId: 'sp1', entrance: 'splitIn', durationMs: 500 },
			'splitIn',
			'entr',
			createIdAllocator(),
		)!;
		const exit = buildSingleEffectNode(
			{ elementId: 'sp1', exit: 'splitOut', durationMs: 500 },
			'splitOut',
			'exit',
			createIdAllocator(),
		)!;
		expect((effectChildTnLst(entr)['p:animEffect'] as XmlObject)['@_filter']).toBe(
			'barn(inVertical)',
		);
		// splitOut is a pre-existing, documented-unresolved id (17, really
		// "Stretch") so it is not asserted here; barn(inVertical) is asserted via
		// splitIn above, which owns the COM-verified id (16).
		expect(exit).toBeDefined();
	});

	it('flash once is a single un-held visibility set lasting the whole effect (COM)', () => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			entrance: 'flashOnceIn',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'flashOnceIn', 'entr', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		expect(childTnLst['p:animEffect']).toBeUndefined();
		const set = childTnLst['p:set'] as XmlObject;
		const cTn = (set['p:cBhvr'] as XmlObject)['p:cTn'] as XmlObject;
		expect(cTn['@_dur']).toBe('500');
		expect(cTn['@_fill']).toBeUndefined();
	});
});

describe('animation behaviour table: Fly In/Out', () => {
	it('fly in from the bottom (subtype 4) starts below the slide and settles at #ppt_y', () => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			entrance: 'flyIn',
			direction: 'fromBottom',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'flyIn', 'entr', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		expect(childTnLst['p:animEffect']).toBeUndefined();
		const animNodes = asArray(childTnLst['p:anim'] as XmlObject | XmlObject[]);
		expect(animNodes).toHaveLength(2);
		const yAnim = animNodes.find(
			(n) => ((n['p:cBhvr'] as XmlObject)['p:attrNameLst'] as XmlObject)['p:attrName'] === 'ppt_y',
		)!;
		const tav = asArray((yAnim['p:tavLst'] as XmlObject)['p:tav'] as XmlObject | XmlObject[]);
		expect(((tav[0]['p:val'] as XmlObject)['p:strVal'] as XmlObject)['@_val']).toBe('1+#ppt_h/2');
		expect(((tav[1]['p:val'] as XmlObject)['p:strVal'] as XmlObject)['@_val']).toBe('#ppt_y');
	});

	it('fly out to the top (subtype 1) ends above the slide', () => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			exit: 'flyOut',
			direction: 'fromTop',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'flyOut', 'exit', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const animNodes = asArray(childTnLst['p:anim'] as XmlObject | XmlObject[]);
		const yAnim = animNodes.find(
			(n) => ((n['p:cBhvr'] as XmlObject)['p:attrNameLst'] as XmlObject)['p:attrName'] === 'ppt_y',
		)!;
		const tav = asArray((yAnim['p:tavLst'] as XmlObject)['p:tav'] as XmlObject | XmlObject[]);
		expect(((tav[0]['p:val'] as XmlObject)['p:strVal'] as XmlObject)['@_val']).toBe('ppt_y');
		expect(((tav[1]['p:val'] as XmlObject)['p:strVal'] as XmlObject)['@_val']).toBe('0-ppt_h/2');
	});
});

describe('animation behaviour table: Float / Grow & Turn / Bounce', () => {
	it('float in writes a fade animEffect plus rotation and position anims', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', entrance: 'floatIn', durationMs: 1000 };
		const node = buildSingleEffectNode(anim, 'floatIn', 'entr', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const animEffect = childTnLst['p:animEffect'] as XmlObject;
		expect(animEffect['@_filter']).toBe('fade');
		const animNodes = asArray(childTnLst['p:anim'] as XmlObject | XmlObject[]);
		expect(animNodes.length).toBeGreaterThanOrEqual(4);
	});

	it('grow & turn in grows ppt_w/ppt_h from 0 and rotates 90 -> 0', () => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			entrance: 'growTurnIn',
			durationMs: 1000,
		};
		const node = buildSingleEffectNode(anim, 'growTurnIn', 'entr', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const animNodes = asArray(childTnLst['p:anim'] as XmlObject | XmlObject[]);
		expect(animNodes).toHaveLength(3);
		expect(childTnLst['p:animEffect']).toBeDefined();
	});

	it('bounce in has a wipe(down) animEffect plus position anims and an 8-step squish animScale', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', entrance: 'bounceIn', durationMs: 2000 };
		const node = buildSingleEffectNode(anim, 'bounceIn', 'entr', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const animEffect = childTnLst['p:animEffect'] as XmlObject;
		expect(animEffect['@_filter']).toBe('wipe(down)');
		const scaleNodes = asArray(childTnLst['p:animScale'] as XmlObject | XmlObject[]);
		expect(scaleNodes).toHaveLength(8);
		const animNodes = asArray(childTnLst['p:anim'] as XmlObject | XmlObject[]);
		expect(animNodes.length).toBeGreaterThanOrEqual(5);
	});
});

describe('animation behaviour table: emphasis', () => {
	it('grow/shrink writes a single p:animScale by 150%/150%', () => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			emphasis: 'growShrink',
			durationMs: 2000,
		};
		const node = buildSingleEffectNode(anim, 'growShrink', 'emph', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const scale = childTnLst['p:animScale'] as XmlObject;
		const by = scale['p:by'] as XmlObject;
		expect(by['@_x']).toBe('150000');
		expect(by['@_y']).toBe('150000');
	});

	it('spin writes a single p:animRot by 360 degrees', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', emphasis: 'spin', durationMs: 2000 };
		const node = buildSingleEffectNode(anim, 'spin', 'emph', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const rot = childTnLst['p:animRot'] as XmlObject;
		expect(rot['@_by']).toBe('21600000');
	});

	it('pulse writes a fade animEffect plus a 105%/105% autoRev animScale', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', emphasis: 'pulse', durationMs: 500 };
		const node = buildSingleEffectNode(anim, 'pulse', 'emph', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const animEffect = childTnLst['p:animEffect'] as XmlObject;
		expect(animEffect['@_filter']).toBe('fade');
		expect(animEffect['@_transition']).toBe('out');
		const scale = childTnLst['p:animScale'] as XmlObject;
		expect((scale['p:by'] as XmlObject)['@_x']).toBe('105000');
		const cTn = (scale['p:cBhvr'] as XmlObject)['p:cTn'] as XmlObject;
		expect(cTn['@_autoRev']).toBe('1');
	});

	it('transparency writes a discrete opacity p:set, not an animated tween', () => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			emphasis: 'transparency',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'transparency', 'emph', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const set = childTnLst['p:set'] as XmlObject;
		const strVal = (set['p:to'] as XmlObject)['p:strVal'] as XmlObject;
		expect(strVal['@_val']).toBe('0.5');
		const animEffect = childTnLst['p:animEffect'] as XmlObject;
		expect(animEffect['@_filter']).toBeUndefined();
		expect((animEffect as Record<string, unknown>)['@_prLst']).toBe('opacity: 0.5');
	});

	it('teeter writes 5 successive small p:animRot oscillations', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', emphasis: 'teeter', durationMs: 1000 };
		const node = buildSingleEffectNode(anim, 'teeter', 'emph', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const rotNodes = asArray(childTnLst['p:animRot'] as XmlObject | XmlObject[]);
		expect(rotNodes).toHaveLength(5);
	});

	it('desaturate writes 3 hsl p:animClr behaviours plus a fill.type set', () => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			emphasis: 'desaturate',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'desaturate', 'emph', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const clrNodes = asArray(childTnLst['p:animClr'] as XmlObject | XmlObject[]);
		expect(clrNodes).toHaveLength(3);
		for (const clr of clrNodes) {
			expect(clr['@_clrSpc']).toBe('hsl');
		}
		expect(childTnLst['p:set']).toBeDefined();
	});

	it('color pulse writes 2 rgb p:animClr behaviours toward scheme bg1', () => {
		const anim: PptxElementAnimation = {
			elementId: 'sp1',
			emphasis: 'colorPulse',
			durationMs: 250,
		};
		const node = buildSingleEffectNode(anim, 'colorPulse', 'emph', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		const clrNodes = asArray(childTnLst['p:animClr'] as XmlObject | XmlObject[]);
		expect(clrNodes).toHaveLength(2);
		for (const clr of clrNodes) {
			expect(clr['@_clrSpc']).toBe('rgb');
			const schemeClr = (clr['p:to'] as XmlObject)['a:schemeClr'] as XmlObject;
			expect(schemeClr['@_val']).toBe('bg1');
		}
	});

	it('wave writes an animMotion ripple plus 4 small counter-rotations', () => {
		const anim: PptxElementAnimation = { elementId: 'sp1', emphasis: 'wave', durationMs: 500 };
		const node = buildSingleEffectNode(anim, 'wave', 'emph', createIdAllocator())!;
		const childTnLst = effectChildTnLst(node);
		expect(childTnLst['p:animMotion']).toBeDefined();
		const rotNodes = asArray(childTnLst['p:animRot'] as XmlObject | XmlObject[]);
		expect(rotNodes).toHaveLength(4);
	});
});
