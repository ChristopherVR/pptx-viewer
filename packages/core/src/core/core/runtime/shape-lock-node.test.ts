/**
 * `a:picLocks/@noCrop` (`CT_PictureLocking`'s one addition to `AG_Locking`)
 * was never modelled: the picture container permitted only the shared lock
 * set, so `element.locks.noCrop` could neither be read nor written, and the
 * attribute only survived a save as a carried-over unknown.
 */
import { describe, it, expect } from 'vitest';

import { parseShapeLocksFromNode, SHAPE_LOCK_CONTAINERS } from './shape-lock-containers';
import { buildShapeLockNode, LOCK_ATTRIBUTE } from './shape-lock-node';

const PIC = SHAPE_LOCK_CONTAINERS['p:pic'];
const SP = SHAPE_LOCK_CONTAINERS['p:sp'];

describe('a:picLocks/@noCrop', () => {
	it('is a modelled attribute of the picture container only', () => {
		expect(LOCK_ATTRIBUTE.noCrop).toBe('@_noCrop');
		expect(PIC.permitted).toContain('noCrop');
		expect(SP.permitted).not.toContain('noCrop');
		expect(SHAPE_LOCK_CONTAINERS['p:graphicFrame'].permitted).not.toContain('noCrop');
	});

	it('parses noCrop off a picture', () => {
		const pic = {
			'p:nvPicPr': {
				'p:cNvPr': { '@_id': '4', '@_name': 'Picture 3' },
				'p:cNvPicPr': { 'a:picLocks': { '@_noCrop': '1', '@_noChangeAspect': '1' } },
				'p:nvPr': '',
			},
		};
		expect(parseShapeLocksFromNode(pic, PIC)).toStrictEqual({
			noCrop: true,
			noChangeAspect: true,
		});
	});

	it('writes noCrop from the model in both states', () => {
		expect(buildShapeLockNode({ noCrop: true }, PIC, undefined)).toStrictEqual({
			'@_noCrop': '1',
		});
		expect(buildShapeLockNode({ noCrop: false, noMove: true }, PIC, undefined)).toStrictEqual({
			'@_noMove': '1',
			'@_noCrop': '0',
		});
	});

	it('round-trips parse -> build without loss', () => {
		const authored = { '@_noCrop': '1', '@_noSelect': '1' };
		const locks = parseShapeLocksFromNode(
			{ 'p:nvPicPr': { 'p:cNvPicPr': { 'a:picLocks': authored } } },
			PIC,
		);
		expect(buildShapeLockNode(locks, PIC, authored)).toStrictEqual(authored);
	});

	it('keeps an authored noCrop when the model is silent about it', () => {
		// The regular picture parse path reads a fixed attribute list that does
		// not include @noCrop, so a model that never learnt the flag must not
		// erase it on save.
		const node = buildShapeLockNode({ noMove: true }, PIC, { '@_noCrop': '1' });
		expect(node).toStrictEqual({ '@_noMove': '1', '@_noCrop': '1' });
	});

	it('never emits noCrop on a shape, where the schema rejects it', () => {
		expect(buildShapeLockNode({ noCrop: true, noMove: true }, SP, undefined)).toStrictEqual({
			'@_noMove': '1',
		});
	});
});
