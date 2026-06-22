import { describe, it, expect } from 'vitest';

import { buildTokenMorphAnimations, diffTokens } from './morph-text-tokens';
import type { MorphTextToken } from './morph-types';

function tok(text: string, x = 0): MorphTextToken {
	return { text, x, y: 0.5, fontSize: 14, fontWeight: 'normal', color: '#000000' };
}

// ==========================================================================
// diffTokens
// ==========================================================================

describe('diffTokens', () => {
	it('marks all shared when texts are identical', () => {
		const from = [tok('Hello', 0), tok('World', 1)];
		const to = [tok('Hello', 0.2), tok('World', 0.8)];
		const ops = diffTokens(from, to);
		expect(ops).toHaveLength(2);
		expect(ops.every((o) => o.change === 'shared')).toBeTruthy();
		expect(ops[0].from!.text).toBe('Hello');
		expect(ops[0].to!.text).toBe('Hello');
	});

	it('classifies added tokens', () => {
		const from = [tok('A')];
		const to = [tok('A'), tok('B')];
		const ops = diffTokens(from, to);
		const added = ops.filter((o) => o.change === 'added');
		expect(added).toHaveLength(1);
		expect(added[0].to!.text).toBe('B');
		expect(added[0].fromIndex).toBe(-1);
	});

	it('classifies removed tokens', () => {
		const from = [tok('A'), tok('B')];
		const to = [tok('A')];
		const ops = diffTokens(from, to);
		const removed = ops.filter((o) => o.change === 'removed');
		expect(removed).toHaveLength(1);
		expect(removed[0].from!.text).toBe('B');
		expect(removed[0].toIndex).toBe(-1);
	});

	it('preserves order and handles middle insertion', () => {
		const from = [tok('the'), tok('cat')];
		const to = [tok('the'), tok('big'), tok('cat')];
		const ops = diffTokens(from, to);
		// the(shared), big(added), cat(shared)
		expect(ops.map((o) => o.change)).toStrictEqual(['shared', 'added', 'shared']);
		expect(ops[1].to!.text).toBe('big');
	});

	it('handles complete replacement', () => {
		const from = [tok('foo')];
		const to = [tok('bar')];
		const ops = diffTokens(from, to);
		expect(ops.some((o) => o.change === 'removed' && o.from!.text === 'foo')).toBeTruthy();
		expect(ops.some((o) => o.change === 'added' && o.to!.text === 'bar')).toBeTruthy();
	});

	it('handles repeated tokens via LCS (no double-match)', () => {
		const from = [tok('a'), tok('a'), tok('b')];
		const to = [tok('a'), tok('b')];
		const ops = diffTokens(from, to);
		const shared = ops.filter((o) => o.change === 'shared');
		const removed = ops.filter((o) => o.change === 'removed');
		// Exactly two shared (a, b) and one removed (the extra a).
		expect(shared).toHaveLength(2);
		expect(removed).toHaveLength(1);
		expect(removed[0].from!.text).toBe('a');
	});

	it('empty from yields all added', () => {
		const ops = diffTokens([], [tok('x'), tok('y')]);
		expect(ops).toHaveLength(2);
		expect(ops.every((o) => o.change === 'added')).toBeTruthy();
	});

	it('empty to yields all removed', () => {
		const ops = diffTokens([tok('x'), tok('y')], []);
		expect(ops).toHaveLength(2);
		expect(ops.every((o) => o.change === 'removed')).toBeTruthy();
	});
});

// ==========================================================================
// buildTokenMorphAnimations
// ==========================================================================

describe('buildTokenMorphAnimations', () => {
	it('builds a move keyframe for shared tokens', () => {
		const ops = diffTokens([tok('Hi', 0)], [tok('Hi', 1)]);
		const anims = buildTokenMorphAnimations(ops, 'from-id', 'to-id', 500, 0);
		expect(anims).toHaveLength(1);
		expect(anims[0].elementId).toBe('to-id__token_0');
		expect(anims[0].keyframes).toContain('left: 0%');
		expect(anims[0].keyframes).toContain('left: 100%');
		expect(anims[0].animation).toContain('500ms');
	});

	it('builds a fade-in for added tokens targeting the to element', () => {
		const ops = diffTokens([], [tok('New')]);
		const anims = buildTokenMorphAnimations(ops, 'from-id', 'to-id', 500, 1);
		expect(anims).toHaveLength(1);
		expect(anims[0].elementId).toBe('to-id__token_0');
		expect(anims[0].keyframes).toContain('opacity: 0');
		expect(anims[0].keyframes).toContain('opacity: 1');
	});

	it('builds a fade-out for removed tokens targeting the from element', () => {
		const ops = diffTokens([tok('Gone')], []);
		const anims = buildTokenMorphAnimations(ops, 'from-id', 'to-id', 500, 0);
		expect(anims).toHaveLength(1);
		expect(anims[0].elementId).toBe('from-id__token_0');
		expect(anims[0].keyframes).toContain('opacity: 1');
		expect(anims[0].keyframes).toContain('opacity: 0');
	});

	it('produces unique keyframe names per token', () => {
		const ops = diffTokens([tok('a'), tok('b')], [tok('a'), tok('b')]);
		const anims = buildTokenMorphAnimations(ops, 'f', 't', 500, 0);
		const names = anims.map((a) => a.animation.split(' ')[0]);
		expect(new Set(names).size).toBe(names.length);
	});
});
