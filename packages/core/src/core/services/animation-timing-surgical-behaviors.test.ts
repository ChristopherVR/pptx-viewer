import { describe, expect, it } from 'vitest';

import type { PptxElementAnimation, XmlObject } from '../types';
import {
	refreshEffectBehaviors,
	resolveDirectionSubtype,
} from './animation-timing-surgical-behaviors';
import { PRESET_TO_OOXML } from './animation-write-mappings';
import { buildSingleEffectNode } from './animation-write-node-builders';

function ids(): () => number {
	let id = 100;
	return () => id++;
}

function list<T>(value: T | T[] | undefined): T[] {
	return value === undefined ? [] : Array.isArray(value) ? value : [value];
}

/** The effect `p:cTn` the full writer builds for `anim`. */
function writtenEffect(anim: PptxElementAnimation): XmlObject {
	const preset = anim.entrance ?? anim.exit!;
	const cls = anim.entrance ? 'entr' : 'exit';
	const node = buildSingleEffectNode(anim, preset, cls, ids())!;
	const outer = node['p:cTn'] as XmlObject;
	return ((outer['p:childTnLst'] as XmlObject)['p:par'] as XmlObject)['p:cTn'] as XmlObject;
}

function filters(cTn: XmlObject): string[] {
	const children = cTn['p:childTnLst'] as XmlObject;
	return list(children['p:animEffect'] as XmlObject | XmlObject[]).map((node) =>
		String(node['@_filter']),
	);
}

function behaviourTimings(cTn: XmlObject, tag: string): Array<{ dur?: string; delay?: string }> {
	const children = cTn['p:childTnLst'] as XmlObject;
	return list(children[tag] as XmlObject | XmlObject[]).map((node) => {
		const inner = (node['p:cBhvr'] as XmlObject)['p:cTn'] as XmlObject;
		const cond = (inner['p:stCondLst'] as XmlObject | undefined)?.['p:cond'] as
			| XmlObject
			| undefined;
		return {
			dur: inner['@_dur'] as string | undefined,
			delay: cond?.['@_delay'] as string | undefined,
		};
	});
}

describe('resolveDirectionSubtype', () => {
	it('maps the editor direction onto the codes PowerPoint writes', () => {
		expect(resolveDirectionSubtype(PRESET_TO_OOXML.wipeIn, 'fromLeft')).toBe(8);
		expect(resolveDirectionSubtype(PRESET_TO_OOXML.peekIn, 'fromTop')).toBe(1);
		expect(resolveDirectionSubtype(PRESET_TO_OOXML.stretchIn, 'fromRight')).toBe(2);
		expect(resolveDirectionSubtype(PRESET_TO_OOXML.flyIn, 'fromTopLeft')).toBe(9);
	});

	it('falls back to the preset default for a direction PowerPoint does not offer', () => {
		// Wipe has no diagonal variant; Stretch's default is "Across" (10).
		expect(resolveDirectionSubtype(PRESET_TO_OOXML.wipeIn, 'fromTopLeft')).toBe(4);
		expect(resolveDirectionSubtype(PRESET_TO_OOXML.stretchIn, undefined)).toBe(10);
	});
});

describe('refreshEffectBehaviors (surgical save of an existing effect)', () => {
	const base: PptxElementAnimation = {
		elementId: '5',
		entrance: 'wipeIn',
		direction: 'fromBottom',
		durationMs: 500,
	};

	it('rebuilds the wipe filter when the direction changes', () => {
		const cTn = writtenEffect(base);
		expect(filters(cTn)).toStrictEqual(['wipe(down)']);
		const next = { ...base, direction: 'fromLeft' as const };
		refreshEffectBehaviors(cTn, next, 'wipeIn', PRESET_TO_OOXML.wipeIn, '5', ids());
		expect(cTn['@_presetSubtype']).toBe('8');
		expect(filters(cTn)).toStrictEqual(['wipe(left)']);
	});

	it("replaces the old preset's behaviours when the preset changes", () => {
		const cTn = writtenEffect(base);
		const next: PptxElementAnimation = { ...base, entrance: 'peekIn', direction: 'fromTop' };
		refreshEffectBehaviors(cTn, next, 'peekIn', PRESET_TO_OOXML.peekIn, '5', ids());
		// Peek from the top: slides down, revealed from its bottom edge.
		expect(cTn['@_presetSubtype']).toBe('1');
		expect(filters(cTn)).toStrictEqual(['wipe(down)']);
		expect((cTn['p:childTnLst'] as XmlObject)['p:anim']).toBeDefined();
	});

	it('rescales every behaviour when only the duration changes', () => {
		const exit: PptxElementAnimation = { elementId: '5', exit: 'flyOut', durationMs: 500 };
		const cTn = writtenEffect(exit);
		delete cTn['@_dur'];
		refreshEffectBehaviors(
			cTn,
			{ ...exit, durationMs: 2000 },
			'flyOut',
			PRESET_TO_OOXML.flyOut,
			'5',
			ids(),
		);
		expect(behaviourTimings(cTn, 'p:anim').map((t) => t.dur)).toStrictEqual(['2000', '2000']);
		// The closing visibility set still closes the effect.
		expect(behaviourTimings(cTn, 'p:set')).toStrictEqual([{ dur: '1', delay: '1999' }]);
	});

	it('leaves an unchanged effect exactly as authored', () => {
		const cTn = writtenEffect(base);
		const before = JSON.stringify(cTn);
		refreshEffectBehaviors(cTn, base, 'wipeIn', PRESET_TO_OOXML.wipeIn, '5', ids());
		expect(JSON.stringify(cTn)).toBe(before);
	});

	it('writes an explicit timing curve onto the effect', () => {
		const cTn = writtenEffect(base);
		refreshEffectBehaviors(
			cTn,
			{ ...base, timingCurve: 'ease-out' },
			'wipeIn',
			PRESET_TO_OOXML.wipeIn,
			'5',
			ids(),
		);
		expect(cTn['@_decel']).toBe('100000');
		expect(cTn['@_accel']).toBeUndefined();
	});
});
