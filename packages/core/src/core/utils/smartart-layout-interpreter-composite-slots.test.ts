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

/**
 * Round 44: a `userS`-declared hub role (`radial-cluster--hier5.pptx`'s
 * `textCenter`) reads its own `w`/`h` facts against `sizeBox` (the
 * composite's `ar`-fit working rectangle) instead of the raw `box` a plain
 * slot uses - see `smartart-layout-interpreter-composite-aspect.ts`'s
 * `isUserSizeHubRole`/`fitAspectRatioBox`.
 */
describe('readSlots hub-scoped sizeBox (round 44)', () => {
	it("reads a userS-referenced hub role's w/h against sizeBox, not box", () => {
		const textCenter: PptxSmartArtLayoutNode = { name: 'textCenter' };
		const name0: PptxSmartArtLayoutNode = {
			name: 'Name0',
			constraints: [
				{ type: 'w', for: 'ch', forName: 'textCenter', referenceType: 'w', factor: 0.21 },
				{
					type: 'userS',
					for: 'des',
					pointType: 'node',
					referenceType: 'w',
					referenceFor: 'ch',
					referenceForName: 'textCenter',
					factor: 0.67,
				},
			],
			children: [textCenter],
		};
		const index = buildConstraintIndex({ rootNode: name0 } as PptxSmartArtLayoutDefinition);
		const sizeBox = { width: 533, height: 533 };
		const [slotted] = readSlots([textCenter], box, index, 'Name0', sizeBox);
		// 0.21 * 533 (sizeBox), NOT 0.21 * 800 (box).
		expect(slotted.dims.w).toStrictEqual({ px: 0.21 * sizeBox.width });
	});

	it('a plain (non-hub) slot keeps reading w/h against box even when a sizeBox is given', () => {
		const plainSlot: PptxSmartArtLayoutNode = { name: 'plainSlot' };
		const name0: PptxSmartArtLayoutNode = {
			name: 'Name0',
			constraints: [
				{ type: 'w', for: 'ch', forName: 'plainSlot', referenceType: 'w', factor: 0.5 },
			],
			children: [plainSlot],
		};
		const index = buildConstraintIndex({ rootNode: name0 } as PptxSmartArtLayoutDefinition);
		const sizeBox = { width: 533, height: 533 };
		const [slotted] = readSlots([plainSlot], box, index, 'Name0', sizeBox);
		expect(slotted.dims.w).toStrictEqual({ px: 0.5 * box.width });
	});

	it('omitting sizeBox defaults it to box (no regression for every pre-existing caller)', () => {
		const textCenter: PptxSmartArtLayoutNode = { name: 'textCenter' };
		const name0: PptxSmartArtLayoutNode = {
			name: 'Name0',
			constraints: [
				{ type: 'w', for: 'ch', forName: 'textCenter', referenceType: 'w', factor: 0.21 },
				{ type: 'userS', referenceType: 'w', referenceForName: 'textCenter', factor: 0.67 },
			],
			children: [textCenter],
		};
		const index = buildConstraintIndex({ rootNode: name0 } as PptxSmartArtLayoutDefinition);
		const [slotted] = readSlots([textCenter], box, index, 'Name0');
		expect(slotted.dims.w).toStrictEqual({ px: 0.21 * box.width });
	});
});
