import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutNode } from '../types';
import {
	isColumnWrapper,
	resolveItemRoleLayoutScope,
} from './smartart-layout-interpreter-item-role-orientation';

/** "Vertical Bracket List"'s own real shape: `linNode` (`lin`, `linDir="fromL"`, choose-wrapped mirroring `dir`) wrapping `parTx` (no shape declared, defaults to rect) and `desTx` (explicit literal `rect`). */
function verticalBracketListWrapper(): {
	arranger: PptxSmartArtLayoutNode;
	linNode: PptxSmartArtLayoutNode;
	parTx: PptxSmartArtLayoutNode;
	desTx: PptxSmartArtLayoutNode;
} {
	const parTx: PptxSmartArtLayoutNode = { name: 'parTx', presentationOf: { axis: ['self'] } };
	const desTx: PptxSmartArtLayoutNode = {
		name: 'desTx',
		presentationOf: { axis: ['des'] },
		shape: { presetGeometry: 'rect' },
	};
	const bracket: PptxSmartArtLayoutNode = {
		name: 'bracket',
		shape: { presetGeometry: 'leftBrace' },
	};
	const linNode: PptxSmartArtLayoutNode = {
		name: 'linNode',
		choose: [
			{
				when: [{ function: 'var', argument: 'dir', operator: 'equ', value: 'norm' }],
			},
		],
		children: [parTx, bracket, desTx],
	};
	const arranger: PptxSmartArtLayoutNode = {
		name: 'Name0',
		algorithm: { type: 'lin' },
		children: [linNode],
	};
	return { arranger, linNode, parTx, desTx };
}

describe('isColumnWrapper', () => {
	it('is true for an explicit horizontal `lin` wrapping 2+ plain-rect roles (Vertical Bracket List), resolved through a choose via presLayoutVars', () => {
		const { linNode } = verticalBracketListWrapper();
		// The choose's own `<dgm:if func="var" arg="dir" op="equ" val="norm"><dgm:alg
		// type="lin"><dgm:param type="linDir" val="fromL"/>` branch is not itself
		// parsed into `PptxSmartArtChoose.when[].rawXml`/`otherwise` by this
		// synthetic fixture (that's `nestedLayoutNodes`'s own job at load time,
		// out of scope for a pure-function unit test) - this case exercises the
		// DIRECT `.algorithm`/`.shape` path instead (see the module's real-corpus
		// integration coverage via `smartart-gallery-ground-truth.test.ts` for the
		// full choose-resolution path).
		const directLinNode: PptxSmartArtLayoutNode = {
			...linNode,
			choose: undefined,
			algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromL' }] },
		};
		expect(isColumnWrapper(directLinNode, 5, undefined)).toBeTruthy();
	});

	it('is false for a `lin` wrapper with NO explicit `linDir` (the overwhelming majority of the gallery corpus)', () => {
		const { parTx, desTx } = verticalBracketListWrapper();
		const plainLin: PptxSmartArtLayoutNode = {
			name: 'plainLin',
			algorithm: { type: 'lin' },
			children: [parTx, desTx],
		};
		expect(isColumnWrapper(plainLin, 5, undefined)).toBeFalsy();
	});

	it("is false when a content role declares a ROTATED, non-rect shape (Vertical Block List's `round2SameRect` bracket connector) even though the wrapper itself is an explicit horizontal `lin` - the round-27 false-positive regression", () => {
		const parentText: PptxSmartArtLayoutNode = {
			name: 'parentText',
			presentationOf: { axis: ['self'] },
		};
		const descendantText: PptxSmartArtLayoutNode = {
			name: 'descendantText',
			presentationOf: { axis: ['des'] },
			shape: { presetGeometry: 'round2SameRect' },
		};
		const linNode: PptxSmartArtLayoutNode = {
			name: 'linNode',
			algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromL' }] },
			children: [parentText, descendantText],
		};
		expect(isColumnWrapper(linNode, 5, undefined)).toBeFalsy();
	});

	it('is false for a wrapper with fewer than 2 text roles', () => {
		const only: PptxSmartArtLayoutNode = { name: 'only', presentationOf: { axis: ['self'] } };
		const linNode: PptxSmartArtLayoutNode = {
			name: 'linNode',
			algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromR' }] },
			children: [only],
		};
		expect(isColumnWrapper(linNode, 5, undefined)).toBeFalsy();
	});
});

describe('resolveItemRoleLayoutScope', () => {
	it('resolves COLUMN orientation, scoped to the wrapper (not the outer arranger), for a genuine column item template', () => {
		const { arranger, linNode, parTx, desTx } = verticalBracketListWrapper();
		const directArranger: PptxSmartArtLayoutNode = {
			...arranger,
			children: [
				{
					...linNode,
					choose: undefined,
					algorithm: { type: 'lin', parameters: [{ type: 'linDir', value: 'fromL' }] },
				},
			],
		};
		const scope = resolveItemRoleLayoutScope(directArranger, 'Name0', [parTx, desTx], 5, undefined);
		expect(scope.orientation).toBe('column');
		expect(scope.declaringRole).toBe('linNode');
	});

	it('resolves ROW orientation (the outer arranger itself) for flat-sibling roles with no wrapper at all ("Vertical Bullet List"\'s own shape)', () => {
		const parentText: PptxSmartArtLayoutNode = {
			name: 'parentText',
			presentationOf: { axis: ['self'] },
		};
		const childText: PptxSmartArtLayoutNode = {
			name: 'childText',
			presentationOf: { axis: ['des'] },
		};
		const arranger: PptxSmartArtLayoutNode = {
			name: 'linear',
			algorithm: { type: 'lin' },
			children: [parentText, childText],
		};
		const scope = resolveItemRoleLayoutScope(arranger, 'linear', [parentText, childText]);
		expect(scope.orientation).toBe('row');
		expect(scope.declaringRole).toBe('linear');
	});

	it('resolves ROW orientation for a single resolved role (no split at all)', () => {
		const only: PptxSmartArtLayoutNode = { name: 'only', presentationOf: { axis: ['self'] } };
		const arranger: PptxSmartArtLayoutNode = {
			name: 'linear',
			algorithm: { type: 'lin' },
			children: [only],
		};
		const scope = resolveItemRoleLayoutScope(arranger, 'linear', [only]);
		expect(scope.orientation).toBe('row');
	});
});
