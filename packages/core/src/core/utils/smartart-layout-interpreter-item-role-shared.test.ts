import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import { hasAmbiguousTopLevelRoles } from './smartart-layout-interpreter-item-role-shared';

describe('hasAmbiguousTopLevelRoles', () => {
	it('declines a `self` role paired with a FLAT `desOrSelf` role (Converging Radial)', () => {
		// `converging-radial--hier5.pptx`: the hub-only `centerShape` (`self`)
		// and the satellite-only `node` role (`desOrSelf`) are flattened
		// siblings of the SAME `dgm:choose`-branch-flattening shape the
		// descendant-axis check already guards - `node`'s `forEachOrigin` here
		// is `axis="self"` (trivially "the current point"), not a genuine
		// per-child repeat, so it must decline.
		const centerShape: PptxSmartArtLayoutNode = {
			name: 'centerShape',
			presentationOf: { axis: ['self'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'], count: [1] },
		};
		const node: PptxSmartArtLayoutNode = {
			name: 'node',
			presentationOf: { axis: ['desOrSelf'] },
			forEachOrigin: { axis: ['self'], pointTypes: ['node'] },
		};
		expect(hasAmbiguousTopLevelRoles([centerShape, node])).toBeTruthy();
	});

	it('does NOT decline a `desOrSelf` role reached through a genuine recursive `axis="ch"` forEach (Vertical Circle List)', () => {
		// `vertical-circle-list--hier5.pptx`: `txLvl3` (`desOrSelf`) is reached
		// through `axis="ch"` with NO count limit - a true per-CHILD repeat
		// (one row per indent level), not a flattened choose alternative to
		// its `self` sibling `txLvl2`. Declining here regressed the shape
		// count from 5 to 3 (both rows folded back into one).
		const txLvl2: PptxSmartArtLayoutNode = {
			name: 'txLvl2',
			presentationOf: { axis: ['self'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'] },
		};
		const txLvl3: PptxSmartArtLayoutNode = {
			name: 'txLvl3',
			presentationOf: { axis: ['desOrSelf'] },
			forEachOrigin: { axis: ['ch'], pointTypes: ['node'] },
		};
		expect(hasAmbiguousTopLevelRoles([txLvl2, txLvl3])).toBeFalsy();
	});

	it('declines two `des`-axis roles regardless of forEachOrigin (Continuous Cycle)', () => {
		const node1: PptxSmartArtLayoutNode = { name: 'node1', presentationOf: { axis: ['ch'] } };
		const node2: PptxSmartArtLayoutNode = { name: 'node2', presentationOf: { axis: ['des'] } };
		expect(hasAmbiguousTopLevelRoles([node1, node2])).toBeTruthy();
	});

	it('is false for a single role', () => {
		const parentText: PptxSmartArtLayoutNode = {
			name: 'parentText',
			presentationOf: { axis: ['self'] },
		};
		expect(hasAmbiguousTopLevelRoles([parentText])).toBeFalsy();
	});

	it('is false for a complementary self + non-desOrSelf descendant pair (Radial List)', () => {
		const parentNode: PptxSmartArtLayoutNode = {
			name: 'parentNode',
			presentationOf: { axis: ['self'] },
		};
		const childNode: PptxSmartArtLayoutNode = {
			name: 'childNode',
			presentationOf: { axis: ['des'] },
		};
		expect(hasAmbiguousTopLevelRoles([parentNode, childNode])).toBeFalsy();
	});
});
