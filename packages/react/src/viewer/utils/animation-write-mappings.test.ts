import { describe, it, expect, beforeEach } from 'vitest';
import { PRESET_TO_OOXML } from 'pptx-viewer-core';
import { PRESET_ID_TO_EFFECT } from './animation-presets';
import { buildSingleEffectNode } from 'pptx-viewer-core';
import type { PptxElementAnimation, XmlObject } from 'pptx-viewer-core';
import { PptxAnimationWriteService } from 'pptx-viewer-core';

describe('PRESET_TO_OOXML', () => {
	it('should cover all entrance effects from the rendering engine', () => {
		const renderEntrIds = Object.keys(PRESET_ID_TO_EFFECT.entr);
		const writeEntrIds = Object.values(PRESET_TO_OOXML)
			.filter((m) => m.presetClass === 'entr')
			.map((m) => String(m.presetId));

		for (const renderId of renderEntrIds) {
			expect(
				writeEntrIds.includes(renderId),
				`entrance presetId=${renderId} is rendered but not writable`,
			).toBe(true);
		}
	});

	it('should cover all exit effects from the rendering engine', () => {
		const renderExitIds = Object.keys(PRESET_ID_TO_EFFECT.exit);
		const writeExitIds = Object.values(PRESET_TO_OOXML)
			.filter((m) => m.presetClass === 'exit')
			.map((m) => String(m.presetId));

		for (const renderId of renderExitIds) {
			expect(
				writeExitIds.includes(renderId),
				`exit presetId=${renderId} is rendered but not writable`,
			).toBe(true);
		}
	});

	it('should cover all emphasis effects from the rendering engine', () => {
		const renderEmphIds = Object.keys(PRESET_ID_TO_EFFECT.emph);
		const writeEmphIds = Object.values(PRESET_TO_OOXML)
			.filter((m) => m.presetClass === 'emph')
			.map((m) => String(m.presetId));

		for (const renderId of renderEmphIds) {
			expect(
				writeEmphIds.includes(renderId),
				`emphasis presetId=${renderId} is rendered but not writable`,
			).toBe(true);
		}
	});

	it('should have valid preset IDs (positive integers)', () => {
		for (const [name, mapping] of Object.entries(PRESET_TO_OOXML)) {
			expect(
				mapping.presetId,
				`${name} presetId should be positive`,
			).toBeGreaterThan(0);
			expect(
				Number.isInteger(mapping.presetId),
				`${name} presetId should be integer`,
			).toBe(true);
		}
	});

	it('should have valid preset classes', () => {
		const validClasses = ['entr', 'exit', 'emph', 'path'];
		for (const [name, mapping] of Object.entries(PRESET_TO_OOXML)) {
			expect(
				validClasses.includes(mapping.presetClass),
				`${name} presetClass "${mapping.presetClass}" is invalid`,
			).toBe(true);
		}
	});

	it('should have non-negative default subtypes', () => {
		for (const [name, mapping] of Object.entries(PRESET_TO_OOXML)) {
			expect(
				mapping.defaultSubtype,
				`${name} defaultSubtype should be >= 0`,
			).toBeGreaterThanOrEqual(0);
		}
	});

	it('should have no duplicate presetId within the same class', () => {
		const byClass = new Map<string, Map<number, string[]>>();
		for (const [name, mapping] of Object.entries(PRESET_TO_OOXML)) {
			if (!byClass.has(mapping.presetClass)) {
				byClass.set(mapping.presetClass, new Map());
			}
			const classMap = byClass.get(mapping.presetClass)!;
			const existing = classMap.get(mapping.presetId) ?? [];
			existing.push(name);
			classMap.set(mapping.presetId, existing);
		}
		for (const [cls, idMap] of byClass) {
			for (const [id, names] of idMap) {
				expect(
					names.length,
					`${cls} presetId=${id} is mapped by multiple presets: ${names.join(', ')}`,
				).toBeLessThanOrEqual(2); // Allow aliases (e.g., bounce/pulse)
			}
		}
	});

	it('should map all rendered preset IDs', () => {
		const totalRendered =
			Object.keys(PRESET_ID_TO_EFFECT.entr).length +
			Object.keys(PRESET_ID_TO_EFFECT.exit).length +
			Object.keys(PRESET_ID_TO_EFFECT.emph).length;

		const totalWritable = Object.keys(PRESET_TO_OOXML).length;
		expect(totalWritable).toBeGreaterThanOrEqual(totalRendered);
	});
});

describe('buildSingleEffectNode', () => {
	let nextId = 1;
	const allocateId = (): number => nextId++;

	beforeEach(() => {
		nextId = 1;
	});

	it('should produce p:animRot for spin emphasis', () => {
		const anim: PptxElementAnimation = {
			elementId: 'shape1',
			emphasis: 'spin',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'spin', 'emph', allocateId);
		expect(node).toBeDefined();

		const effectPar = (node!['p:cTn'] as XmlObject)['p:childTnLst'] as XmlObject;
		const innerPar = effectPar['p:par'] as XmlObject;
		const innerCTn = innerPar['p:cTn'] as XmlObject;
		const childTnLst = innerCTn['p:childTnLst'] as XmlObject;
		expect(childTnLst['p:animRot']).toBeDefined();
		expect(childTnLst['p:animEffect']).toBeUndefined();
	});

	it('should produce p:animScale for growShrink emphasis', () => {
		const anim: PptxElementAnimation = {
			elementId: 'shape1',
			emphasis: 'growShrink',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'growShrink', 'emph', allocateId);
		expect(node).toBeDefined();

		const effectPar = (node!['p:cTn'] as XmlObject)['p:childTnLst'] as XmlObject;
		const innerPar = effectPar['p:par'] as XmlObject;
		const innerCTn = innerPar['p:cTn'] as XmlObject;
		const childTnLst = innerCTn['p:childTnLst'] as XmlObject;
		expect(childTnLst['p:animScale']).toBeDefined();
		expect(childTnLst['p:animEffect']).toBeUndefined();
	});

	it('should produce p:anim for transparency emphasis', () => {
		const anim: PptxElementAnimation = {
			elementId: 'shape1',
			emphasis: 'transparency',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'transparency', 'emph', allocateId);
		expect(node).toBeDefined();

		const effectPar = (node!['p:cTn'] as XmlObject)['p:childTnLst'] as XmlObject;
		const innerPar = effectPar['p:par'] as XmlObject;
		const innerCTn = innerPar['p:cTn'] as XmlObject;
		const childTnLst = innerCTn['p:childTnLst'] as XmlObject;
		expect(childTnLst['p:anim']).toBeDefined();
		expect(childTnLst['p:animEffect']).toBeUndefined();
	});

	it('should produce p:animEffect for entrance effects', () => {
		const anim: PptxElementAnimation = {
			elementId: 'shape1',
			entrance: 'fadeIn',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'fadeIn', 'entr', allocateId);
		expect(node).toBeDefined();

		const effectPar = (node!['p:cTn'] as XmlObject)['p:childTnLst'] as XmlObject;
		const innerPar = effectPar['p:par'] as XmlObject;
		const innerCTn = innerPar['p:cTn'] as XmlObject;
		const childTnLst = innerCTn['p:childTnLst'] as XmlObject;
		expect(childTnLst['p:animEffect']).toBeDefined();
		expect(childTnLst['p:set']).toBeDefined(); // visibility set
	});

	it('should produce visibility set for exit effects', () => {
		const anim: PptxElementAnimation = {
			elementId: 'shape1',
			exit: 'fadeOut',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'fadeOut', 'exit', allocateId);
		expect(node).toBeDefined();

		const effectPar = (node!['p:cTn'] as XmlObject)['p:childTnLst'] as XmlObject;
		const innerPar = effectPar['p:par'] as XmlObject;
		const innerCTn = innerPar['p:cTn'] as XmlObject;
		const childTnLst = innerCTn['p:childTnLst'] as XmlObject;
		expect(childTnLst['p:animEffect']).toBeDefined();
		expect(childTnLst['p:set']).toBeDefined(); // visibility set to hidden
	});

	it('should return undefined for unmapped presets', () => {
		const anim: PptxElementAnimation = {
			elementId: 'shape1',
			entrance: 'none',
			durationMs: 500,
		};
		const node = buildSingleEffectNode(anim, 'none', 'entr', allocateId);
		expect(node).toBeUndefined();
	});
});

describe('PptxAnimationWriteService round-trip', () => {
	it('should produce valid timing XML for each entrance preset', () => {
		const service = new PptxAnimationWriteService();
		const entrPresets = Object.entries(PRESET_TO_OOXML)
			.filter(([, m]) => m.presetClass === 'entr')
			.map(([name]) => name);

		for (const preset of entrPresets) {
			const anim: PptxElementAnimation = {
				elementId: 'shape1',
				entrance: preset as PptxElementAnimation['entrance'],
				durationMs: 500,
			};
			const xml = service.buildTimingXml([anim], undefined);
			expect(xml, `${preset} should produce timing XML`).toBeDefined();
			expect(
				xml!['p:tnLst'],
				`${preset} should have p:tnLst`,
			).toBeDefined();
		}
	});

	it('should produce valid timing XML for each exit preset', () => {
		const service = new PptxAnimationWriteService();
		const exitPresets = Object.entries(PRESET_TO_OOXML)
			.filter(([, m]) => m.presetClass === 'exit')
			.map(([name]) => name);

		for (const preset of exitPresets) {
			const anim: PptxElementAnimation = {
				elementId: 'shape1',
				exit: preset as PptxElementAnimation['exit'],
				durationMs: 500,
			};
			const xml = service.buildTimingXml([anim], undefined);
			expect(xml, `${preset} should produce timing XML`).toBeDefined();
		}
	});

	it('should produce valid timing XML for each emphasis preset', () => {
		const service = new PptxAnimationWriteService();
		const emphPresets = Object.entries(PRESET_TO_OOXML)
			.filter(([, m]) => m.presetClass === 'emph')
			.map(([name]) => name);

		for (const preset of emphPresets) {
			const anim: PptxElementAnimation = {
				elementId: 'shape1',
				emphasis: preset as PptxElementAnimation['emphasis'],
				durationMs: 500,
			};
			const xml = service.buildTimingXml([anim], undefined);
			expect(xml, `${preset} should produce timing XML`).toBeDefined();
		}
	});

	it('should preserve direction subtype for flyIn', () => {
		const service = new PptxAnimationWriteService();
		const anim: PptxElementAnimation = {
			elementId: 'shape1',
			entrance: 'flyIn',
			direction: 'fromLeft',
			durationMs: 500,
		};
		const xml = service.buildTimingXml([anim], undefined);
		expect(xml).toBeDefined();
		const xmlStr = JSON.stringify(xml);
		// fromLeft maps to subtype 8
		expect(xmlStr).toContain('"@_presetSubtype":"8"');
	});
});
