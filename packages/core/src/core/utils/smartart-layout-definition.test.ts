import { describe, expect, it } from 'vitest';

import type { XmlObject } from '../types';
import {
	applySmartArtLayoutDefinition,
	parseSmartArtLayoutDefinition,
	validateSmartArtLayoutDefinition,
} from './smartart-layout-definition';

const localName = (key: string): string => key.split(':').pop() ?? key;

function fixture(): XmlObject {
	return {
		'@_uniqueId': 'urn:old',
		'@_minVer': '12.0',
		'x:title': { '@_lang': 'en-US', '@_val': 'Old title', '@_vendor': 'keep' },
		'x:desc': { '@_val': 'Old description' },
		'x:catLst': { 'x:cat': { '@_type': 'list', '@_pri': 1, '@_custom': 'keep' } },
		'x:layoutNode': {
			'@_name': 'root',
			'@_styleLbl': 'oldStyle',
			'x:alg': {
				'@_type': 'lin',
				'@_rev': 2,
				'x:param': [
					{ '@_type': 'linDir', '@_val': 'fromL', '@_vendor': 'keep' },
					{ '@_type': 'pyraAcctPos', '@_val': 'bef' },
				],
				'x:extLst': { 'a:ext': { '@_uri': '{algorithm-vendor}' } },
			},
			'x:forEach': {
				'@_name': 'items',
				'@_axis': 'ch des',
				'@_hideLastTrans': '0 1',
				'@_st': '-1 0',
				'@_cnt': '2 3',
				'@_step': '1 2',
				'x:shape': { '@_type': 'rect' },
			},
			'x:choose': {
				'@_name': 'branch',
				'x:if': {
					'@_func': 'cnt',
					'@_arg': 'ch',
					'@_op': 'gte',
					'@_val': '2',
					'x:layoutNode': { '@_name': 'chosen' },
				},
				'x:else': { '@_name': 'fallback', 'x:shape': { '@_type': 'ellipse' } },
			},
			'x:layoutNode': { '@_name': 'child', 'x:shape': { '@_type': 'rect' } },
			'x:extLst': { 'a:ext': { '@_uri': '{vendor}' } },
		},
		'x:extLst': { 'a:ext': { '@_uri': '{root-vendor}' } },
	};
}

describe('diagramML layout-definition metadata', () => {
	it('parses CT_DiagramDefinition and recursive CT_LayoutNode with arbitrary prefixes', () => {
		const parsed = parseSmartArtLayoutDefinition(fixture(), localName);
		expect(parsed).toMatchObject({
			uniqueId: 'urn:old',
			minimumVersion: '12.0',
			titles: [{ language: 'en-US', value: 'Old title' }],
			categories: [{ type: 'list', priority: 1 }],
			rootNode: {
				name: 'root',
				styleLabel: 'oldStyle',
				algorithm: {
					type: 'lin',
					revision: 2,
					parameters: [
						{ type: 'linDir', value: 'fromL' },
						{ type: 'pyraAcctPos', value: 'bef' },
					],
				},
				forEach: [
					{
						name: 'items',
						axis: ['ch', 'des'],
						hideLastTransition: [false, true],
						start: [-1, 0],
						count: [2, 3],
						step: [1, 2],
					},
				],
				choose: [
					{
						name: 'branch',
						when: [{ function: 'cnt', argument: 'ch', operator: 'gte', value: '2' }],
						otherwise: { name: 'fallback' },
					},
				],
				children: [{ name: 'chosen' }, { name: 'child' }],
			},
		});
	});

	// cycle-matrix--fallback-n2.pptx's `child1group`..`child4group`: each
	// choose-flattened via a `dgm:if`, gated on a DIFFERENT condition -
	// `nestedLayoutNodes` must tag each with the guarding if's OWN condition,
	// not a shared/blank one, and leave a direct (non-choose) sibling
	// untouched.
	it('tags a choose-flattened layoutNode with its enclosing if condition (chooseGuard), as a one-entry chain', () => {
		const parsed = parseSmartArtLayoutDefinition(fixture(), localName)!;
		const [chosen, child] = parsed.rootNode.children!;
		expect(chosen.name).toBe('chosen');
		expect(chosen.chooseGuard).toHaveLength(1);
		expect(chosen.chooseGuard?.[0]).toMatchObject({
			function: 'cnt',
			argument: 'ch',
			operator: 'gte',
			value: '2',
		});
		expect(child.name).toBe('child');
		expect(child.chooseGuard).toBeUndefined();
	});

	/**
	 * `sub-step-process--hier5.pptx`'s exact shape: `chLin1`..`chLin7` each
	 * sit inside BOTH an outer `dgm:if func="pos" op="equ" val="N"` (which
	 * one of the 7 hand-duplicated per-position templates this is) AND an
	 * inner, nearly-vacuous `dgm:if func="cnt" op="gte" val="1"` (has >= 1
	 * point at all). Keeping only the nearest (inner) condition loses the
	 * ONE piece of information that actually discriminates `chLin1` from
	 * `chLin2` - `chooseGuard` must capture BOTH, outermost first.
	 */
	it('chains EVERY enclosing if condition, outermost first, for a layoutNode nested inside TWO chooses', () => {
		const nested: XmlObject = {
			'x:layoutNode': {
				'@_name': 'root',
				'x:choose': {
					'x:if': {
						'@_func': 'pos',
						'@_op': 'equ',
						'@_val': '1',
						'x:choose': {
							'x:if': {
								'@_func': 'cnt',
								'@_op': 'gte',
								'@_val': '1',
								'x:layoutNode': { '@_name': 'chLin1' },
							},
						},
					},
				},
			},
		};
		const parsed = parseSmartArtLayoutDefinition(nested, localName)!;
		const [chLin1] = parsed.rootNode.children!;
		expect(chLin1.name).toBe('chLin1');
		expect(chLin1.chooseGuard).toStrictEqual([
			expect.objectContaining({ function: 'pos', operator: 'equ', value: '1' }),
			expect.objectContaining({ function: 'cnt', operator: 'gte', value: '1' }),
		]);
	});

	it('an else branch contributes no condition of its own but keeps any OUTER ancestor guard already accumulated', () => {
		const nested: XmlObject = {
			'x:layoutNode': {
				'@_name': 'root',
				'x:choose': {
					'x:if': {
						'@_func': 'pos',
						'@_op': 'equ',
						'@_val': '1',
						'x:choose': {
							'x:if': {
								'@_func': 'cnt',
								'@_op': 'gte',
								'@_val': '99',
								'x:layoutNode': { '@_name': 'liveBranch' },
							},
							'x:else': { 'x:layoutNode': { '@_name': 'elseBranch' } },
						},
					},
				},
			},
		};
		const parsed = parseSmartArtLayoutDefinition(nested, localName)!;
		// Both branches are flattened unconditionally (`nestedLayoutNodes`
		// does not evaluate `dgm:choose` conditions at parse time - the
		// pre-existing "flatten every branch" convention).
		const [, elseBranch] = parsed.rootNode.children!;
		expect(elseBranch.name).toBe('elseBranch');
		// The inner if/else's own condition is absent (else has none), but the
		// OUTER pos==1 guard still applies.
		expect(elseBranch.chooseGuard).toStrictEqual([
			expect.objectContaining({ function: 'pos', operator: 'equ', value: '1' }),
		]);
	});

	/**
	 * `balance--hier5.pptx`'s exact shape: a `dgm:choose` with 2+ `dgm:if`
	 * siblings - `chooseGroups` must tag each with the SAME group id and an
	 * increasing ordinal (0-based, document order), so a consumer
	 * (`smartart-layout-interpreter-composite-choose-groups.ts`'s
	 * `selectFirstMatchChildren`) can recover real `dgm:choose` first-match-
	 * wins semantics from the flattened `.children` array.
	 */
	it('tags every dgm:if/dgm:else sibling with the SAME chooseGroups id and an increasing ordinal', () => {
		const nested: XmlObject = {
			'x:layoutNode': {
				'@_name': 'root',
				'x:choose': {
					'x:if': [
						{
							'@_func': 'cnt',
							'@_op': 'equ',
							'@_val': '1',
							'x:layoutNode': { '@_name': 'first' },
						},
						{
							'@_func': 'cnt',
							'@_op': 'equ',
							'@_val': '2',
							'x:layoutNode': { '@_name': 'second' },
						},
					],
					'x:else': { 'x:layoutNode': { '@_name': 'third' } },
				},
			},
		};
		const parsed = parseSmartArtLayoutDefinition(nested, localName)!;
		const [first, second, third] = parsed.rootNode.children!;
		// `origin` is `undefined` throughout: this fixture has no enclosing
		// `dgm:forEach` at all (see `chooseGroups`'s own doc comment, ROUND 42).
		expect(first.chooseGroups).toStrictEqual([
			{
				id: expect.any(String),
				ordinal: 0,
				guard: expect.objectContaining({ value: '1' }),
				origin: undefined,
			},
		]);
		expect(second.chooseGroups).toStrictEqual([
			{
				id: first.chooseGroups![0].id,
				ordinal: 1,
				guard: expect.objectContaining({ value: '2' }),
				origin: undefined,
			},
		]);
		// dgm:else has no condition of its own (matches chooseGuard's own
		// convention) - its own chooseGroups entry carries no `guard`.
		expect(third.chooseGroups).toStrictEqual([
			{ id: first.chooseGroups![0].id, ordinal: 2, origin: undefined },
		]);
	});

	it('gives TWO nested dgm:choose instances DIFFERENT group ids, chained outermost first', () => {
		const nested: XmlObject = {
			'x:layoutNode': {
				'@_name': 'root',
				'x:choose': {
					'x:if': {
						'@_func': 'pos',
						'@_op': 'equ',
						'@_val': '1',
						'x:choose': {
							'x:if': {
								'@_func': 'cnt',
								'@_op': 'gte',
								'@_val': '1',
								'x:layoutNode': { '@_name': 'deep' },
							},
						},
					},
				},
			},
		};
		const parsed = parseSmartArtLayoutDefinition(nested, localName)!;
		const [deep] = parsed.rootNode.children!;
		expect(deep.chooseGroups).toHaveLength(2);
		expect(deep.chooseGroups![0].id).not.toBe(deep.chooseGroups![1].id);
		expect(deep.chooseGroups![0].ordinal).toBe(0);
		expect(deep.chooseGroups![1].ordinal).toBe(0);
	});

	it('a direct (non-choose) child has no chooseGroups at all', () => {
		const parsed = parseSmartArtLayoutDefinition(fixture(), localName)!;
		const [, child] = parsed.rootNode.children!;
		expect(child.name).toBe('child');
		expect(child.chooseGroups).toBeUndefined();
	});

	it('surgically edits typed fields and preserves algorithms, unknown data, and extLst', () => {
		const xml = fixture();
		const value = parseSmartArtLayoutDefinition(xml, localName)!;
		value.uniqueId = 'urn:new';
		value.defaultStyle = 'urn:style';
		value.titles = [{ language: 'fr-FR', value: 'Nouveau' }];
		value.categories = [{ type: 'process', priority: 7 }];
		value.rootNode.styleLabel = 'newStyle';
		value.rootNode.childOrder = 't';
		value.rootNode.algorithm = {
			type: 'snake',
			revision: 3,
			parameters: [{ type: 'grDir', value: 'tR' }],
		};
		value.rootNode.forEach![0].count = [4];
		value.rootNode.choose![0].when[0].value = '3';
		value.rootNode.choose![0].otherwise = null;
		value.rootNode.children![1].moveWith = 'root';

		expect(applySmartArtLayoutDefinition(xml, value, localName)).toBeTruthy();
		expect(xml).toMatchObject({
			'@_uniqueId': 'urn:new',
			'@_defStyle': 'urn:style',
			'x:title': [{ '@_lang': 'fr-FR', '@_val': 'Nouveau', '@_vendor': 'keep' }],
			'x:catLst': { 'x:cat': [{ '@_type': 'process', '@_pri': '7', '@_custom': 'keep' }] },
			'x:layoutNode': {
				'@_styleLbl': 'newStyle',
				'@_chOrder': 't',
				'x:alg': {
					'@_type': 'snake',
					'@_rev': '3',
					'x:param': [{ '@_type': 'grDir', '@_val': 'tR', '@_vendor': 'keep' }],
					'x:extLst': { 'a:ext': { '@_uri': '{algorithm-vendor}' } },
				},
				'x:forEach': [
					{
						'@_cnt': '4',
						'x:shape': { '@_type': 'rect' },
					},
				],
				'x:choose': [
					{
						'x:if': [
							{
								'@_val': '3',
								'x:layoutNode': { '@_name': 'chosen' },
							},
						],
					},
				],
				'x:layoutNode': { '@_moveWith': 'root', 'x:shape': { '@_type': 'rect' } },
				'x:extLst': { 'a:ext': { '@_uri': '{vendor}' } },
			},
			'x:extLst': { 'a:ext': { '@_uri': '{root-vendor}' } },
		});
	});

	it('creates and removes CT_Algorithm in CT_LayoutNode schema order', () => {
		const xml: XmlObject = {
			'@_name': 'root',
			'x:shape': { '@_type': 'rect' },
			'x:extLst': { 'a:ext': { '@_uri': '{vendor}' } },
		};
		const definition: XmlObject = { 'x:layoutNode': xml };
		const value = parseSmartArtLayoutDefinition(definition, localName)!;
		value.rootNode.algorithm = {
			type: 'cycle',
			parameters: [{ type: 'stElem', value: 'node' }],
		};

		expect(applySmartArtLayoutDefinition(definition, value, localName)).toBeTruthy();
		expect(Object.keys(xml)).toStrictEqual(['@_name', 'dgm:alg', 'x:shape', 'x:extLst']);
		expect(xml['dgm:alg']).toMatchObject({
			'@_type': 'cycle',
			'dgm:param': [{ '@_type': 'stElem', '@_val': 'node' }],
		});

		value.rootNode.algorithm = undefined;
		expect(applySmartArtLayoutDefinition(definition, value, localName)).toBeTruthy();
		expect(xml['dgm:alg']).toBeUndefined();
	});

	it('creates and removes typed forEach and choose branches', () => {
		const definition: XmlObject = { 'x:layoutNode': { '@_name': 'root' } };
		const value = parseSmartArtLayoutDefinition(definition, localName)!;
		value.rootNode.forEach = [{ reference: 'parent', pointTypes: ['node'], count: [1] }];
		value.rootNode.choose = [
			{
				when: [{ function: 'var', operator: 'equ', value: 'true' }],
				otherwise: { name: 'fallback' },
			},
		];

		expect(applySmartArtLayoutDefinition(definition, value, localName)).toBeTruthy();
		expect(definition['x:layoutNode']).toMatchObject({
			'dgm:forEach': [{ '@_ref': 'parent', '@_ptType': 'node', '@_cnt': '1' }],
			'dgm:choose': [
				{
					'dgm:if': [{ '@_func': 'var', '@_op': 'equ', '@_val': 'true' }],
					'dgm:else': { '@_name': 'fallback' },
				},
			],
		});

		value.rootNode.forEach = [];
		value.rootNode.choose = [];
		expect(applySmartArtLayoutDefinition(definition, value, localName)).toBeTruthy();
		expect(definition['x:layoutNode']).toStrictEqual({ '@_name': 'root' });
	});

	it('rejects invalid required values and unsigned integer facets', () => {
		expect(
			validateSmartArtLayoutDefinition({
				rootNode: {
					algorithm: {
						type: '',
						revision: -1,
						parameters: [{ type: '' }],
					},
					choose: [{ when: [{ function: '', operator: '', value: '' }] }],
					forEach: [{ count: [-1], start: [2_147_483_648], step: [] }],
				},
				titles: [{ value: ' ' }],
				categories: [{ type: '', priority: 4294967296 }],
			}),
		).toStrictEqual([
			'rootNode.algorithm.type is required',
			'rootNode.algorithm.revision must be an unsigned 32-bit integer',
			'rootNode.algorithm.parameters[0].type is required',
			'rootNode.forEach[0].start values must be signed 32-bit integers',
			'rootNode.forEach[0].count values must be unsigned 32-bit integers',
			'rootNode.choose[0].when[0].function is required',
			'rootNode.choose[0].when[0].operator is required',
			'rootNode.choose[0].when[0].value is required',
			'categories[0].type is required',
			'categories[0].priority must be an unsigned 32-bit integer',
			'titles[0].value is required',
		]);
	});
});

describe('dgm:presOf and choose-nested dgm:constrLst', () => {
	it('parses dgm:presOf into presentationOf, omitting an empty/bare one', () => {
		const parsed = parseSmartArtLayoutDefinition(
			{
				'x:layoutNode': {
					'@_name': 'root',
					'x:presOf': { '@_axis': 'des', '@_ptType': 'node' },
					'x:layoutNode': { '@_name': 'decorative', 'x:presOf': '' },
				},
			},
			localName,
		);
		expect(parsed?.rootNode.presentationOf).toMatchObject({ axis: ['des'], pointTypes: ['node'] });
		expect(parsed?.rootNode.children?.[0].presentationOf).toBeUndefined();
	});

	it('reaches a dgm:constrLst declared inside a dgm:choose wrapping the SAME layoutNode', () => {
		// `gear`'s composite has no direct constrLst at all: its slot
		// positioning is entirely inside a count-decidable dgm:choose.
		const parsed = parseSmartArtLayoutDefinition(
			{
				'x:layoutNode': {
					'@_name': 'composite',
					'x:choose': {
						'x:if': {
							'@_func': 'cnt',
							'@_op': 'lte',
							'@_val': '1',
							'x:constrLst': { 'x:constr': { '@_type': 'w', '@_for': 'ch', '@_forName': 'gear1' } },
						},
						'x:else': {
							'x:constrLst': { 'x:constr': { '@_type': 'w', '@_for': 'ch', '@_forName': 'gear2' } },
						},
					},
					'x:layoutNode': { '@_name': 'gear1' },
				},
			},
			localName,
		);
		// Both branches are blindly unioned (this interpreter never evaluates
		// the choose condition when indexing constraints), and `constraints`
		// (the node's own DIRECT constrLst, round-tripped by `apply*`) stays
		// undefined - only `allConstraints` (interpretation-only) sees these.
		expect(parsed?.rootNode.constraints).toBeUndefined();
		expect(parsed?.rootNode.allConstraints).toMatchObject([
			{ type: 'w', for: 'ch', forName: 'gear1' },
			{ type: 'w', for: 'ch', forName: 'gear2' },
		]);
	});
});

describe('forEachOrigin: the enclosing dgm:forEach a layoutNode was reached through', () => {
	it("tags a layoutNode found via dgm:forEach with that forEach's iterator attributes", () => {
		// `lProcess1`'s `child` shape: found through `<dgm:forEach axis="ch"
		// ptType="node">`, so it carries that axis/ptType on its own
		// `forEachOrigin` - the marker `smartart-layout-interpreter-item-
		// roles-recursive.ts` uses to tell a genuinely repeated per-child
		// template apart from a direct, once-only child.
		const parsed = parseSmartArtLayoutDefinition(
			{
				'x:layoutNode': {
					'@_name': 'vertFlow',
					'x:forEach': {
						'@_axis': 'ch',
						'@_ptType': 'node',
						'x:layoutNode': { '@_name': 'child' },
					},
				},
			},
			localName,
		);
		expect(parsed?.rootNode.children?.[0].name).toBe('child');
		expect(parsed?.rootNode.children?.[0].forEachOrigin).toMatchObject({
			axis: ['ch'],
			pointTypes: ['node'],
		});
	});

	it('leaves forEachOrigin undefined for a direct child or one reached only through dgm:choose', () => {
		const parsed = parseSmartArtLayoutDefinition(
			{
				'x:layoutNode': {
					'@_name': 'root',
					'x:layoutNode': { '@_name': 'direct' },
					'x:choose': { 'x:if': { 'x:layoutNode': { '@_name': 'chosen' } } },
				},
			},
			localName,
		);
		const byName = new Map(parsed?.rootNode.children?.map((c) => [c.name, c]));
		expect(byName.get('direct')?.forEachOrigin).toBeUndefined();
		expect(byName.get('chosen')?.forEachOrigin).toBeUndefined();
	});

	it('uses the NEAREST enclosing forEach when one forEach nests inside another', () => {
		// `LinedList`'s `vert1`/`vert2` shape: an outer `axis="ch"` forEach
		// wraps `horz2`, which itself wraps an inner `axis="followSib"
		// ptType="sibTrans"` forEach around `thinLine3` - `thinLine3` must
		// carry the INNER (nearest) iterator, not the outer one.
		const parsed = parseSmartArtLayoutDefinition(
			{
				'x:layoutNode': {
					'@_name': 'vert1',
					'x:forEach': {
						'@_axis': 'ch',
						'@_ptType': 'node',
						'x:layoutNode': {
							'@_name': 'horz2',
							'x:forEach': {
								'@_axis': 'followSib',
								'@_ptType': 'sibTrans',
								'@_cnt': '1',
								'x:layoutNode': { '@_name': 'thinLine3' },
							},
						},
					},
				},
			},
			localName,
		);
		const horz2 = parsed?.rootNode.children?.[0];
		expect(horz2?.name).toBe('horz2');
		expect(horz2?.forEachOrigin).toMatchObject({ axis: ['ch'], pointTypes: ['node'] });
		const thinLine3 = horz2?.children?.[0];
		expect(thinLine3?.name).toBe('thinLine3');
		expect(thinLine3?.forEachOrigin).toMatchObject({
			axis: ['followSib'],
			pointTypes: ['sibTrans'],
			count: [1],
		});
	});

	/**
	 * Round 39: `basic-venn--flat3.pptx`'s exact shape - a composite's
	 * `constrLst` declares a DIFFERENT `ctrX` fact for the SAME role
	 * (`circ1`) per data-point-count branch. `constraintCandidates` must
	 * capture EVERY branch, each tagged with its own guard chain, so a
	 * choose-aware caller (`smartart-constraint-branch-index.ts`) can pick
	 * the one genuinely live for the current diagram instead of
	 * `allConstraints`'s pre-existing blind union of all of them.
	 */
	it('tags every choose-guarded dgm:constr with its own guard chain (constraintCandidates)', () => {
		const nested: XmlObject = {
			'x:layoutNode': {
				'@_name': 'composite',
				'x:choose': {
					'x:if': {
						'@_func': 'cnt',
						'@_axis': 'ch',
						'@_op': 'equ',
						'@_val': '2',
						'x:constrLst': {
							'x:constr': {
								'@_type': 'ctrX',
								'@_for': 'ch',
								'@_forName': 'circ1',
								'@_fact': '0.3',
							},
						},
					},
					'x:else': {
						'x:constrLst': {
							'x:constr': {
								'@_type': 'ctrX',
								'@_for': 'ch',
								'@_forName': 'circ1',
								'@_fact': '0.5',
							},
						},
					},
				},
			},
		};
		const parsed = parseSmartArtLayoutDefinition(nested, localName)!;
		const candidates = parsed.rootNode.constraintCandidates!;
		expect(candidates).toHaveLength(2);
		expect(candidates[0].guard).toStrictEqual([
			expect.objectContaining({ function: 'cnt', operator: 'equ', value: '2' }),
		]);
		expect(candidates[0].constraint).toMatchObject({ type: 'ctrX', forName: 'circ1', factor: 0.3 });
		// The else branch keeps no condition of its own (matches `chooseGuard`'s
		// own convention).
		expect(candidates[1].guard).toStrictEqual([]);
		expect(candidates[1].constraint).toMatchObject({ type: 'ctrX', forName: 'circ1', factor: 0.5 });
		// `allConstraints` still carries BOTH branches blindly unioned - the
		// pre-existing consumer is unaffected by this new field's presence.
		expect(parsed.rootNode.allConstraints).toHaveLength(2);
	});

	it('leaves constraintCandidates undefined for a plain, unwrapped constrLst (nothing to choose between)', () => {
		const plain: XmlObject = {
			'x:layoutNode': {
				'@_name': 'root',
				'x:constrLst': {
					'x:constr': { '@_type': 'w', '@_for': 'ch', '@_forName': 'node', '@_fact': '1' },
				},
			},
		};
		const parsed = parseSmartArtLayoutDefinition(plain, localName)!;
		expect(parsed.rootNode.constraintCandidates).toBeUndefined();
		expect(parsed.rootNode.allConstraints).toHaveLength(1);
	});
});
