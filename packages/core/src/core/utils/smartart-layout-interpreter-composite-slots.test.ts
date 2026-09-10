import { describe, expect, it } from 'vitest';

import type { PptxSmartArtLayoutDefinition, PptxSmartArtLayoutNode } from '../types';
import { buildConstraintIndex, EMPTY_CONSTRAINT_INDEX } from './smartart-constraint-solver';
import { readSlots } from './smartart-layout-interpreter-composite-slots';

const box = { width: 800, height: 400 };

/**
 * Round 32: `continuous-arrow-process--hier5.pptx`'s `parTx` shape - a
 * plain pass-through node (`linV`) sits BETWEEN a leaf role (`parTx`) and
 * the ancestor (`linH`) that declares one of its dimensions via `for="des"`,
 * while `linV` itself separately declares another dimension via its OWN
 * `for="ch"`. Neither ancestor alone has the full picture, so `readSlots`
 * needs the WHOLE ancestor chain (nearest first), not just the nearest
 * role, to resolve both.
 */
describe('readSlots declaringRole chain (round 32)', () => {
	function definitionOf(root: PptxSmartArtLayoutNode): PptxSmartArtLayoutDefinition {
		return { rootNode: root } as PptxSmartArtLayoutDefinition;
	}

	it('resolves a dimension declared by the NEAREST role in the chain', () => {
		const parTx: PptxSmartArtLayoutNode = { name: 'parTx' };
		const linV: PptxSmartArtLayoutNode = {
			name: 'linV',
			allConstraints: [{ type: 'w', for: 'ch', forName: 'parTx', factor: 0.6 }],
			children: [parTx],
		};
		const index = buildConstraintIndex(definitionOf(linV));
		const [slotted] = readSlots([parTx], box, index, ['linV']);
		expect(slotted.dims.w).toStrictEqual({ px: 0.6 * box.width });
		expect(slotted.dims.h).toBeUndefined();
	});

	it('falls through to a FARTHER role in the chain for a dimension the nearest role does not declare', () => {
		const parTx: PptxSmartArtLayoutNode = { name: 'parTx' };
		const linV: PptxSmartArtLayoutNode = {
			name: 'linV',
			allConstraints: [{ type: 'w', for: 'ch', forName: 'parTx', factor: 0.6 }],
			children: [parTx],
		};
		const linH: PptxSmartArtLayoutNode = {
			name: 'linH',
			// A `for="des"` declaration reaches PAST the immediate parent (`linV`)
			// straight to `parTx`, exactly like `linH`'s own real `h` for
			// `parTx`/`desTx` in the fixture.
			allConstraints: [{ type: 'h', for: 'des', forName: 'parTx', factor: 0.32 }],
			children: [linV],
		};
		const index = buildConstraintIndex(definitionOf(linH));
		const [slotted] = readSlots([parTx], box, index, ['linV', 'linH']);
		expect(slotted.dims.w).toStrictEqual({ px: 0.6 * box.width });
		expect(slotted.dims.h).toStrictEqual({ px: 0.32 * box.height });
	});

	it('a single-element chain (a plain string) behaves exactly like before this round', () => {
		const parTx: PptxSmartArtLayoutNode = { name: 'parTx' };
		const linV: PptxSmartArtLayoutNode = {
			name: 'linV',
			allConstraints: [{ type: 'w', for: 'ch', forName: 'parTx', factor: 0.6 }],
			children: [parTx],
		};
		const index = buildConstraintIndex(definitionOf(linV));
		const [byString] = readSlots([parTx], box, index, 'linV');
		const [byChain] = readSlots([parTx], box, index, ['linV']);
		expect(byString.dims).toStrictEqual(byChain.dims);
	});

	it('resolves nothing (undefined dims, dropped from the result) with no matching declaringRole anywhere', () => {
		const parTx: PptxSmartArtLayoutNode = { name: 'parTx' };
		expect(readSlots([parTx], box, EMPTY_CONSTRAINT_INDEX, ['linV', 'linH'])).toStrictEqual([]);
	});
});
