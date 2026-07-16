import { describe, it, expect } from 'vitest';

import { parseViewProperties, buildViewPropertiesXml } from './pptx-view-props-helpers';

// ---------------------------------------------------------------------------
// parseViewProperties
// ---------------------------------------------------------------------------
describe('parseViewProperties', () => {
	// -- Empty / minimal root --
	describe('empty root', () => {
		it('should return empty props (plus rawXml) when the root is empty', () => {
			const result = parseViewProperties({});
			expect(result.lastView).toBeUndefined();
			expect(result.showComments).toBeUndefined();
			expect(result.normalViewPr).toBeUndefined();
			expect(result.slideViewPr).toBeUndefined();
			expect(result.outlineViewPr).toBeUndefined();
			expect(result.notesTextViewPr).toBeUndefined();
			expect(result.sorterViewPr).toBeUndefined();
			expect(result.notesViewPr).toBeUndefined();
		});

		it('should always set rawXml to the input root', () => {
			const root = {};
			const result = parseViewProperties(root);
			expect(result.rawXml).toBe(root);
		});
	});

	// -- @_lastView attribute --
	describe('@_lastView', () => {
		it('should parse lastView "sldView"', () => {
			const result = parseViewProperties({ '@_lastView': 'sldView' });
			expect(result.lastView).toBe('sldView');
		});

		it('should parse lastView "sldMasterView"', () => {
			const result = parseViewProperties({ '@_lastView': 'sldMasterView' });
			expect(result.lastView).toBe('sldMasterView');
		});

		it('should parse lastView "notesView"', () => {
			const result = parseViewProperties({ '@_lastView': 'notesView' });
			expect(result.lastView).toBe('notesView');
		});

		it('should parse lastView "handoutView"', () => {
			const result = parseViewProperties({ '@_lastView': 'handoutView' });
			expect(result.lastView).toBe('handoutView');
		});

		it('should parse lastView "sldSorterView"', () => {
			const result = parseViewProperties({ '@_lastView': 'sldSorterView' });
			expect(result.lastView).toBe('sldSorterView');
		});

		it('should omit lastView when attribute is empty string', () => {
			const result = parseViewProperties({ '@_lastView': '' });
			expect(result.lastView).toBeUndefined();
		});

		it('should omit lastView when attribute is whitespace only', () => {
			const result = parseViewProperties({ '@_lastView': '  ' });
			expect(result.lastView).toBeUndefined();
		});
	});

	// -- @_showComments attribute --
	describe('@_showComments', () => {
		it('should parse showComments true when value is true', () => {
			const result = parseViewProperties({ '@_showComments': true });
			expect(result.showComments).toBeTruthy();
		});

		it('should parse showComments true when value is "1"', () => {
			const result = parseViewProperties({ '@_showComments': '1' });
			expect(result.showComments).toBeTruthy();
		});

		it('should parse showComments false when value is "0"', () => {
			const result = parseViewProperties({ '@_showComments': '0' });
			expect(result.showComments).toBeFalsy();
		});

		it('should leave showComments undefined when attribute is absent', () => {
			const result = parseViewProperties({});
			expect(result.showComments).toBeUndefined();
		});
	});

	// -- p:normalViewPr --
	describe('p:normalViewPr', () => {
		it('should parse restoredLeft with sz and autoAdjust', () => {
			const result = parseViewProperties({
				'p:normalViewPr': {
					'p:restoredLeft': { '@_sz': '15620', '@_autoAdjust': '0' },
				},
			});
			expect(result.normalViewPr).toBeDefined();
			expect(result.normalViewPr!.restoredLeft).toStrictEqual({
				sz: 15620,
				autoAdjust: false,
			});
		});

		it('should parse restoredTop with sz and autoAdjust true', () => {
			const result = parseViewProperties({
				'p:normalViewPr': {
					'p:restoredTop': { '@_sz': '94660', '@_autoAdjust': '1' },
				},
			});
			expect(result.normalViewPr!.restoredTop).toStrictEqual({
				sz: 94660,
				autoAdjust: true,
			});
		});

		it('should parse restoredLeft with autoAdjust undefined when absent', () => {
			const result = parseViewProperties({
				'p:normalViewPr': {
					'p:restoredLeft': { '@_sz': '5000' },
				},
			});
			expect(result.normalViewPr!.restoredLeft!.autoAdjust).toBeUndefined();
		});

		it('should parse showOutlineIcons boolean attribute', () => {
			const result = parseViewProperties({
				'p:normalViewPr': { '@_showOutlineIcons': '1' },
			});
			expect(result.normalViewPr!.showOutlineIcons).toBeTruthy();
		});

		it('should parse showOutlineIcons false for "0"', () => {
			const result = parseViewProperties({
				'p:normalViewPr': { '@_showOutlineIcons': '0' },
			});
			expect(result.normalViewPr!.showOutlineIcons).toBeFalsy();
		});

		it('should parse snapVertSplitter', () => {
			const result = parseViewProperties({
				'p:normalViewPr': { '@_snapVertSplitter': '1' },
			});
			expect(result.normalViewPr!.snapVertSplitter).toBeTruthy();
		});

		it('should parse vertBarState and horzBarState', () => {
			const result = parseViewProperties({
				'p:normalViewPr': {
					'@_vertBarState': 'maximized',
					'@_horzBarState': 'minimized',
				},
			});
			expect(result.normalViewPr!.vertBarState).toBe('maximized');
			expect(result.normalViewPr!.horzBarState).toBe('minimized');
		});

		it('should parse both restoredLeft and restoredTop', () => {
			const result = parseViewProperties({
				'p:normalViewPr': {
					'p:restoredLeft': { '@_sz': '15620' },
					'p:restoredTop': { '@_sz': '94660' },
				},
			});
			expect(result.normalViewPr!.restoredLeft!.sz).toBe(15620);
			expect(result.normalViewPr!.restoredTop!.sz).toBe(94660);
		});

		it('should default sz to 0 for non-numeric value', () => {
			const result = parseViewProperties({
				'p:normalViewPr': {
					'p:restoredLeft': { '@_sz': 'abc' },
				},
			});
			expect(result.normalViewPr!.restoredLeft!.sz).toBe(0);
		});
	});

	// -- p:slideViewPr --
	describe('p:slideViewPr', () => {
		it('should parse slideViewPr from p:cSldViewPr', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': {
						'@_snapToGrid': '0',
					},
				},
			});
			expect(result.slideViewPr).toBeDefined();
			expect(result.slideViewPr!.snapToGrid).toBeFalsy();
		});

		it('should parse snapToObjects', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': { '@_snapToObjects': '1' },
				},
			});
			expect(result.slideViewPr!.snapToObjects).toBeTruthy();
		});

		it('should parse showGuides', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': { '@_showGuides': '1' },
				},
			});
			expect(result.slideViewPr!.showGuides).toBeTruthy();
		});

		it('should parse origin x and y', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': {
						'p:origin': { '@_x': '-1392', '@_y': '-96' },
					},
				},
			});
			expect(result.slideViewPr!.origin).toStrictEqual({ x: -1392, y: -96 });
		});

		it('should omit slideViewPr when p:cSldViewPr is missing', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {},
			});
			expect(result.slideViewPr).toBeUndefined();
		});
	});

	// -- p:outlineViewPr --
	describe('p:outlineViewPr', () => {
		it('should parse outlineViewPr from nested p:cSldViewPr', () => {
			const result = parseViewProperties({
				'p:outlineViewPr': {
					'p:cSldViewPr': { '@_snapToGrid': '1' },
				},
			});
			expect(result.outlineViewPr).toBeDefined();
			expect(result.outlineViewPr!.snapToGrid).toBeTruthy();
		});

		it('should omit outlineViewPr when p:cSldViewPr is missing', () => {
			const result = parseViewProperties({
				'p:outlineViewPr': {},
			});
			expect(result.outlineViewPr).toBeUndefined();
		});
	});

	// -- p:notesTextViewPr --
	describe('p:notesTextViewPr', () => {
		it('should parse notesTextViewPr from nested p:cSldViewPr', () => {
			const result = parseViewProperties({
				'p:notesTextViewPr': {
					'p:cSldViewPr': { '@_showGuides': '0' },
				},
			});
			expect(result.notesTextViewPr).toBeDefined();
			expect(result.notesTextViewPr!.showGuides).toBeFalsy();
		});

		it('should omit notesTextViewPr when p:cSldViewPr is missing', () => {
			const result = parseViewProperties({
				'p:notesTextViewPr': {},
			});
			expect(result.notesTextViewPr).toBeUndefined();
		});
	});

	// -- p:sorterViewPr --
	describe('p:sorterViewPr', () => {
		it('should parse sorterViewPr with scale', () => {
			const result = parseViewProperties({
				'p:sorterViewPr': {
					'p:cSldViewPr': {
						'p:scale': {
							'a:sx': { '@_n': '66', '@_d': '100' },
							'a:sy': { '@_n': '66', '@_d': '100' },
						},
					},
				},
			});
			expect(result.sorterViewPr).toBeDefined();
			expect(result.sorterViewPr!.scale).toStrictEqual({ n: 66, d: 100 });
		});

		it('should set scale undefined when p:cSldViewPr missing', () => {
			const result = parseViewProperties({
				'p:sorterViewPr': {},
			});
			expect(result.sorterViewPr).toBeDefined();
			expect(result.sorterViewPr!.scale).toBeUndefined();
		});

		it('should set scale undefined when p:scale missing', () => {
			const result = parseViewProperties({
				'p:sorterViewPr': {
					'p:cSldViewPr': {},
				},
			});
			expect(result.sorterViewPr!.scale).toBeUndefined();
		});
	});

	// -- p:notesViewPr --
	describe('p:notesViewPr', () => {
		it('should parse notesViewPr from nested p:cSldViewPr', () => {
			const result = parseViewProperties({
				'p:notesViewPr': {
					'p:cSldViewPr': {
						'@_snapToGrid': '1',
						'p:origin': { '@_x': '0', '@_y': '0' },
					},
				},
			});
			expect(result.notesViewPr).toBeDefined();
			expect(result.notesViewPr!.snapToGrid).toBeTruthy();
			expect(result.notesViewPr!.origin).toStrictEqual({ x: 0, y: 0 });
		});

		it('should omit notesViewPr when p:cSldViewPr is missing', () => {
			const result = parseViewProperties({
				'p:notesViewPr': {},
			});
			expect(result.notesViewPr).toBeUndefined();
		});
	});

	// -- View scale parsing --
	describe('view scale parsing', () => {
		it('should parse scale with n and d attributes from a:sx', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': {
						'p:scale': {
							'a:sx': { '@_n': '100', '@_d': '100' },
							'a:sy': { '@_n': '100', '@_d': '100' },
						},
					},
				},
			});
			expect(result.slideViewPr!.scale).toStrictEqual({ n: 100, d: 100 });
		});

		it('should return undefined scale when a:sx is missing', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': {
						'p:scale': {
							'a:sy': { '@_n': '100', '@_d': '100' },
						},
					},
				},
			});
			expect(result.slideViewPr!.scale).toBeUndefined();
		});

		it('should return undefined scale when d is 0', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': {
						'p:scale': {
							'a:sx': { '@_n': '100', '@_d': '0' },
						},
					},
				},
			});
			expect(result.slideViewPr!.scale).toBeUndefined();
		});

		it('should parse fractional scale like n=33 d=100', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': {
						'p:scale': {
							'a:sx': { '@_n': '33', '@_d': '100' },
						},
					},
				},
			});
			expect(result.slideViewPr!.scale).toStrictEqual({ n: 33, d: 100 });
		});

		it('should return undefined scale when p:scale is absent', () => {
			const result = parseViewProperties({
				'p:slideViewPr': {
					'p:cSldViewPr': {},
				},
			});
			expect(result.slideViewPr!.scale).toBeUndefined();
		});
	});

	// -- Full round-trip structure --
	describe('full OOXML structure', () => {
		it('should parse a complete p:viewPr element', () => {
			const fullRoot = {
				'@_lastView': 'sldView',
				'@_showComments': '1',
				'p:normalViewPr': {
					'@_showOutlineIcons': '0',
					'@_vertBarState': 'restored',
					'@_horzBarState': 'maximized',
					'p:restoredLeft': { '@_sz': '15620', '@_autoAdjust': '0' },
					'p:restoredTop': { '@_sz': '94660' },
				},
				'p:slideViewPr': {
					'p:cSldViewPr': {
						'@_snapToGrid': '0',
						'p:origin': { '@_x': '-1392', '@_y': '-96' },
						'p:scale': {
							'a:sx': { '@_n': '110', '@_d': '100' },
							'a:sy': { '@_n': '110', '@_d': '100' },
						},
					},
				},
			};
			const result = parseViewProperties(fullRoot);

			expect(result.lastView).toBe('sldView');
			expect(result.showComments).toBeTruthy();
			expect(result.normalViewPr!.showOutlineIcons).toBeFalsy();
			expect(result.normalViewPr!.vertBarState).toBe('restored');
			expect(result.normalViewPr!.horzBarState).toBe('maximized');
			expect(result.normalViewPr!.restoredLeft).toStrictEqual({ sz: 15620, autoAdjust: false });
			expect(result.normalViewPr!.restoredTop).toStrictEqual({ sz: 94660, autoAdjust: undefined });
			expect(result.slideViewPr!.snapToGrid).toBeFalsy();
			expect(result.slideViewPr!.origin).toStrictEqual({ x: -1392, y: -96 });
			expect(result.slideViewPr!.scale).toStrictEqual({ n: 110, d: 100 });
		});
	});
});

// ---------------------------------------------------------------------------
// buildViewPropertiesXml
// ---------------------------------------------------------------------------
describe('buildViewPropertiesXml', () => {
	it('should wrap output in p:viewPr root element', () => {
		const xml = buildViewPropertiesXml({});
		expect(xml).toHaveProperty('p:viewPr');
	});

	it('should include namespace attributes when no rawXml', () => {
		const xml = buildViewPropertiesXml({});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['@_xmlns:p']).toBe('http://schemas.openxmlformats.org/presentationml/2006/main');
		expect(root['@_xmlns:a']).toBe('http://schemas.openxmlformats.org/drawingml/2006/main');
	});

	it('should set @_lastView when lastView is provided', () => {
		const xml = buildViewPropertiesXml({ lastView: 'notesView' });
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['@_lastView']).toBe('notesView');
	});

	it('should set @_showComments "1" for true', () => {
		const xml = buildViewPropertiesXml({ showComments: true });
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['@_showComments']).toBe('1');
	});

	it('should set @_showComments "0" for false', () => {
		const xml = buildViewPropertiesXml({ showComments: false });
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['@_showComments']).toBe('0');
	});

	it('should build normalViewPr with restoredLeft and restoredTop', () => {
		const xml = buildViewPropertiesXml({
			normalViewPr: {
				restoredLeft: { sz: 15620, autoAdjust: false },
				restoredTop: { sz: 94660, autoAdjust: true },
			},
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		const normalViewPr = root['p:normalViewPr'] as Record<string, unknown>;
		expect(normalViewPr['p:restoredLeft']).toStrictEqual({ '@_sz': '15620', '@_autoAdjust': '0' });
		expect(normalViewPr['p:restoredTop']).toStrictEqual({ '@_sz': '94660', '@_autoAdjust': '1' });
	});

	it('should build slideViewPr with cSldViewPr wrapper', () => {
		const xml = buildViewPropertiesXml({
			slideViewPr: { snapToGrid: true },
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		const slideViewPr = root['p:slideViewPr'] as Record<string, unknown>;
		expect(slideViewPr).toHaveProperty('p:cSldViewPr');
		const cSldViewPr = slideViewPr['p:cSldViewPr'] as Record<string, unknown>;
		expect(cSldViewPr['@_snapToGrid']).toBe('1');
	});

	it('should build scale XML with a:sx and a:sy', () => {
		const xml = buildViewPropertiesXml({
			slideViewPr: { scale: { n: 66, d: 100 } },
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		const cSldViewPr = (root['p:slideViewPr'] as Record<string, unknown>)['p:cSldViewPr'] as Record<
			string,
			unknown
		>;
		const cViewPr = cSldViewPr['p:cViewPr'] as Record<string, unknown>;
		const scale = cViewPr['p:scale'] as Record<string, unknown>;
		expect(scale['a:sx']).toStrictEqual({ '@_n': '66', '@_d': '100' });
		expect(scale['a:sy']).toStrictEqual({ '@_n': '66', '@_d': '100' });
	});

	it('should build origin XML with x and y', () => {
		const xml = buildViewPropertiesXml({
			slideViewPr: { origin: { x: -100, y: 200 } },
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		const cSldViewPr = (root['p:slideViewPr'] as Record<string, unknown>)['p:cSldViewPr'] as Record<
			string,
			unknown
		>;
		const cViewPr = cSldViewPr['p:cViewPr'] as Record<string, unknown>;
		expect(cViewPr['p:origin']).toStrictEqual({ '@_x': '-100', '@_y': '200' });
	});

	it('should build outlineViewPr with cSldViewPr', () => {
		const xml = buildViewPropertiesXml({
			outlineViewPr: { snapToObjects: true },
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['p:outlineViewPr']).toHaveProperty('p:cSldViewPr');
	});

	it('should build notesTextViewPr with schema-correct cViewPr', () => {
		const xml = buildViewPropertiesXml({
			notesTextViewPr: { showGuides: false },
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['p:notesTextViewPr']).toHaveProperty('p:cViewPr');
	});

	it('should build sorterViewPr with scale only', () => {
		const xml = buildViewPropertiesXml({
			sorterViewPr: { scale: { n: 80, d: 100 } },
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		const sorter = root['p:sorterViewPr'] as Record<string, unknown>;
		const cViewPr = sorter['p:cViewPr'] as Record<string, unknown>;
		expect(cViewPr['p:scale']).toBeDefined();
	});

	it('should build notesViewPr with cSldViewPr', () => {
		const xml = buildViewPropertiesXml({
			notesViewPr: { snapToGrid: false },
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['p:notesViewPr']).toHaveProperty('p:cSldViewPr');
	});

	it('should use rawXml as base when present', () => {
		const rawXml = {
			'@_lastView': 'sldView',
			'@_showComments': '1',
			'p:normalViewPr': { 'p:restoredLeft': { '@_sz': '15620' } },
		};
		const xml = buildViewPropertiesXml({
			lastView: 'notesView',
			rawXml,
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		// lastView should be overridden
		expect(root['@_lastView']).toBe('notesView');
		// The raw normalViewPr should persist
		expect(root['p:normalViewPr']).toBeDefined();
	});

	it('should override showComments on rawXml', () => {
		const rawXml = { '@_showComments': '1' };
		const xml = buildViewPropertiesXml({
			showComments: false,
			rawXml,
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['@_showComments']).toBe('0');
	});

	it('should build normalViewPr showOutlineIcons and snapVertSplitter', () => {
		const xml = buildViewPropertiesXml({
			normalViewPr: {
				showOutlineIcons: true,
				snapVertSplitter: false,
				vertBarState: 'restored',
				horzBarState: 'maximized',
				preferSingleView: true,
			},
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		const nvp = root['p:normalViewPr'] as Record<string, unknown>;
		expect(nvp['@_showOutlineIcons']).toBe('1');
		expect(nvp['@_snapVertSplitter']).toBe('0');
		expect(nvp['@_vertBarState']).toBe('restored');
		expect(nvp['@_horzBarState']).toBe('maximized');
		expect(nvp['@_preferSingleView']).toBe('1');
	});

	it('should omit sorterViewPr when scale is undefined', () => {
		const xml = buildViewPropertiesXml({
			sorterViewPr: { scale: undefined },
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['p:sorterViewPr']).toBeUndefined();
	});

	it('should omit normalViewPr when not provided', () => {
		const xml = buildViewPropertiesXml({ lastView: 'sldView' });
		const root = xml['p:viewPr'] as Record<string, unknown>;
		expect(root['p:normalViewPr']).toBeUndefined();
	});

	it('should build restoredRegion without autoAdjust when undefined', () => {
		const xml = buildViewPropertiesXml({
			normalViewPr: {
				restoredLeft: { sz: 5000, autoAdjust: undefined },
			},
		});
		const root = xml['p:viewPr'] as Record<string, unknown>;
		const nvp = root['p:normalViewPr'] as Record<string, unknown>;
		const rl = nvp['p:restoredLeft'] as Record<string, unknown>;
		expect(rl['@_sz']).toBe('5000');
		expect(rl).not.toHaveProperty('@_autoAdjust');
	});
});
