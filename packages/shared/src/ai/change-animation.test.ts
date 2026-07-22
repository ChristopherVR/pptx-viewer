import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { changeGhostStyle } from './change-animation-css';
import { createAiChangeAnimator } from './change-animator';
import { diffChangedElements } from './change-diff';
import { makeMockBridge, makeSlide, textElement } from './mock-bridge';
import { ProposalStore } from './proposals';

function deck(...slides: PptxSlide[]): PptxSlide[] {
	return slides;
}

describe('diffChangedElements', () => {
	it('detects added, removed, moved and restyled elements', () => {
		const before = deck(makeSlide(0, [textElement('a', 'Keep'), textElement('b', 'Gone')]));
		const afterSlide = makeSlide(0, [textElement('a', 'Keep'), textElement('c', 'New')]);
		// Move element a, restyle nothing else.
		afterSlide.elements[0].x = 400;
		const after = deck(afterSlide);

		const changes = diffChangedElements(before, after);
		const byId = new Map(changes.map((c) => [c.elementId, c]));
		expect(byId.get('a')?.kind).toBe('moved');
		expect(byId.get('a')?.from?.x).toBe(40);
		expect(byId.get('a')?.to?.x).toBe(400);
		expect(byId.get('c')?.kind).toBe('added');
		expect(byId.get('b')?.kind).toBe('removed');
	});

	it('detects a text change', () => {
		const before = deck(makeSlide(0, [textElement('a', 'Old')]));
		const after = deck(makeSlide(0, [textElement('a', 'New text')]));
		expect(diffChangedElements(before, after)[0]).toMatchObject({ elementId: 'a', kind: 'text' });
	});

	it('returns nothing when unchanged', () => {
		const s = deck(makeSlide(0, [textElement('a', 'Same')]));
		expect(diffChangedElements(s, structuredClone(s))).toHaveLength(0);
	});
});

describe('createAiChangeAnimator', () => {
	const before = deck(makeSlide(0, [textElement('a', 'A')]));
	const moved = (): PptxSlide[] => {
		const s = makeSlide(0, [textElement('a', 'A')]);
		s.elements[0].x = 200;
		return deck(s);
	};

	it('publishes a batch and notifies subscribers', () => {
		const animator = createAiChangeAnimator(undefined, () => () => {});
		const seen: unknown[] = [];
		animator.subscribe((b) => seen.push(b));
		const batch = animator.publish(before, moved());
		expect(batch?.changes[0]).toMatchObject({ elementId: 'a', kind: 'moved' });
		expect(batch?.slideIndex).toBe(0);
		expect(seen).toHaveLength(1);
		expect(animator.current()?.nonce).toBe(batch?.nonce);
	});

	it('is a no-op when disabled or when nothing changed', () => {
		const off = createAiChangeAnimator({ enabled: false }, () => () => {});
		expect(off.publish(before, moved())).toBeNull();
		const on = createAiChangeAnimator(undefined, () => () => {});
		expect(on.publish(before, structuredClone(before))).toBeNull();
	});

	it('clears the batch when the scheduled timer fires', () => {
		let fire = (): void => {};
		const animator = createAiChangeAnimator({ durationMs: 100 }, (fn) => {
			fire = fn;
			return () => {};
		});
		animator.publish(before, moved());
		expect(animator.current()).not.toBeNull();
		fire();
		expect(animator.current()).toBeNull();
	});
});

describe('proposalStore integration', () => {
	it('publishes changed elements to the animator on apply', () => {
		const bridge = makeMockBridge();
		const animator = createAiChangeAnimator(undefined, () => () => {});
		const spy = vi.spyOn(animator, 'publish');
		const store = new ProposalStore(bridge, animator);
		store.stage('Move title', (slides) => {
			slides[0].elements[0].x = 300;
			return slides;
		});
		store.apply(store.list()[0].id);
		expect(spy).toHaveBeenCalledOnce();
		expect(animator.current()?.changes[0]).toMatchObject({ kind: 'moved' });
	});
});

describe('changeGhostStyle', () => {
	it('positions a moved ghost at from-bounds on start and to-bounds on end', () => {
		const change = {
			slideIndex: 0,
			elementId: 'a',
			kind: 'moved' as const,
			from: { x: 40, y: 40, width: 100, height: 20 },
			to: { x: 300, y: 40, width: 100, height: 20 },
		};
		const cfg = { enabled: true, durationMs: 900, glow: true, tween: true, color: 'blue' };
		expect(changeGhostStyle(change, 'start', cfg).left).toBe(37);
		expect(changeGhostStyle(change, 'end', cfg).left).toBe(297);
	});
});
