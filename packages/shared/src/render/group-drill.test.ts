import type { PptxElement } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import {
	drillSelectionForClick,
	drillSelectionForDoubleClick,
	findElementPath,
	isGroupMember,
	memberChainAtPoint,
	parentSelection,
	slideSpaceElement,
	slideSpaceMembers,
	updateElementInTree,
} from './group-drill';

const shape = (
	id: string,
	x: number,
	y: number,
	w = 100,
	h = 60,
	extra: Record<string, unknown> = {},
) => ({ id, type: 'shape', x, y, width: w, height: h, ...extra }) as unknown as PptxElement;
const group = (
	id: string,
	x: number,
	y: number,
	children: PptxElement[],
	extra: Record<string, unknown> = {},
) =>
	({
		id,
		type: 'group',
		x,
		y,
		width: 400,
		height: 300,
		children,
		...extra,
	}) as unknown as PptxElement;

// A cards diagram: a group at (100, 200) with two cards, the second holding a nested group.
const title = shape('title', 40, 20, 800, 80);
const inner = group('inner', 10, 10, [shape('icon', 5, 5, 20, 20)]);
const cards = group('cards', 100, 200, [
	shape('card-a', 0, 0, 180, 120),
	group('card-b', 200, 0, [shape('label', 0, 0, 80, 20), inner]),
]);
const slide: PptxElement[] = [title, cards];

describe('group drill-in', () => {
	it('finds a member at any depth, outermost first', () => {
		expect(findElementPath(slide, 'icon')?.map((e) => e.id)).toStrictEqual([
			'cards',
			'card-b',
			'inner',
			'icon',
		]);
		expect(findElementPath(slide, 'title')?.map((e) => e.id)).toStrictEqual(['title']);
		expect(findElementPath(slide, 'nope')).toBeNull();
		expect(isGroupMember(slide, 'card-a')).toBeTruthy();
		expect(isGroupMember(slide, 'cards')).toBeFalsy();
	});

	it('gives members in slide space, for the chrome and the inline editor', () => {
		expect(slideSpaceElement(slide, 'card-a')).toMatchObject({ x: 100, y: 200 });
		expect(slideSpaceElement(slide, 'icon')).toMatchObject({
			x: 100 + 200 + 10 + 5,
			y: 200 + 0 + 10 + 5,
		});
		expect(slideSpaceElement(slide, 'title')).toBe(title);
		const members = slideSpaceMembers(slide);
		expect([...members.keys()].sort()).toStrictEqual([
			'card-a',
			'card-b',
			'icon',
			'inner',
			'label',
		]);
		expect(members.get('label')).toMatchObject({ x: 300, y: 200 });
	});

	it("doesn't enter a rotated or flipped group", () => {
		const rotated = [group('g', 50, 50, [shape('m', 0, 0)], { rotation: 30 })];
		expect(slideSpaceElement(rotated, 'm')).toBeNull();
		expect(slideSpaceMembers(rotated).size).toBe(0);
		expect(memberChainAtPoint(rotated, 'g', { x: 60, y: 60 })).toStrictEqual(['g']);
	});

	it('writes a slide-space move back into the group and keeps other branches', () => {
		const next = updateElementInTree(slide, 'label', { x: 350, y: 260 } as Partial<PptxElement>);
		expect(slideSpaceElement(next, 'label')).toMatchObject({ x: 350, y: 260 });
		expect(findElementPath(next, 'label')?.at(-1)).toMatchObject({ x: 50, y: 60 });
		expect(next[0]).toBe(title);
		expect(updateElementInTree(slide, 'nope', { x: 1 } as Partial<PptxElement>)).toBe(slide);
	});

	it('hit-tests by geometry, topmost member first', () => {
		expect(memberChainAtPoint(slide, 'cards', { x: 150, y: 250 })).toStrictEqual([
			'card-a',
			'cards',
		]);
		expect(memberChainAtPoint(slide, 'cards', { x: 318, y: 218 })).toStrictEqual([
			'icon',
			'inner',
			'card-b',
			'cards',
		]);
		// On the group's box but between its members.
		expect(memberChainAtPoint(slide, 'cards', { x: 290, y: 480 })).toStrictEqual(['cards']);
		expect(memberChainAtPoint(slide, 'missing', { x: 0, y: 0 })).toStrictEqual([]);
	});

	it('clicks like PowerPoint: the group first, then a member, then its siblings', () => {
		const chainA = ['card-a', 'cards'];
		const chainLabel = ['label', 'card-b', 'cards'];
		const path = (id: string) => findElementPath(slide, id);
		expect(drillSelectionForClick(chainA, null)).toBe('cards');
		expect(drillSelectionForClick(chainA, path('title'))).toBe('cards');
		expect(drillSelectionForClick(chainA, path('cards'))).toBe('card-a');
		expect(drillSelectionForClick(chainA, path('card-a'))).toBe('card-a');
		// Another card of the entered group.
		expect(drillSelectionForClick(chainLabel, path('card-a'))).toBe('card-b');
		// Deeper: card-b selected, click its label.
		expect(drillSelectionForClick(chainLabel, path('card-b'))).toBe('label');
		// On the group between members: stays on the group.
		expect(drillSelectionForClick(['cards'], path('card-a'))).toBe('cards');
	});

	it('double-clicks straight to the innermost shape, and Escape steps out', () => {
		expect(drillSelectionForDoubleClick(['label', 'card-b', 'cards'])).toBe('label');
		expect(drillSelectionForDoubleClick([])).toBeNull();
		expect(parentSelection(slide, 'label')).toBe('card-b');
		expect(parentSelection(slide, 'card-b')).toBe('cards');
		expect(parentSelection(slide, 'cards')).toBeNull();
	});

	it('does not drill into a member locked with noSelect: the group answers instead', () => {
		const locked = group('cards', 100, 200, [
			shape('card-a', 0, 0, 180, 120, { locks: { noSelect: true } }),
			shape('card-c', 200, 0, 100, 60),
		]);
		expect(memberChainAtPoint([locked], 'cards', { x: 150, y: 250 })).toStrictEqual(['cards']);
		// An unlocked sibling still resolves.
		expect(memberChainAtPoint([locked], 'cards', { x: 350, y: 230 })).toStrictEqual([
			'card-c',
			'cards',
		]);
		// A locked nested member stops the walk at its parent.
		const deep = group('cards', 100, 200, [
			group('card-b', 0, 0, [shape('label', 0, 0, 80, 20, { locks: { noSelect: true } })]),
		]);
		expect(memberChainAtPoint([deep], 'cards', { x: 120, y: 210 })).toStrictEqual([
			'card-b',
			'cards',
		]);
	});

	it('does not drill into a group locked with noDrilldown: it selects as one', () => {
		const sealed = group('cards', 100, 200, [shape('card-a', 0, 0, 180, 120)], {
			locks: { noDrilldown: true },
		});
		expect(memberChainAtPoint([sealed], 'cards', { x: 150, y: 250 })).toStrictEqual(['cards']);
		const nested = group('cards', 100, 200, [
			group('card-b', 0, 0, [shape('label', 0, 0, 80, 20)], { locks: { noDrilldown: true } }),
		]);
		expect(memberChainAtPoint([nested], 'cards', { x: 120, y: 210 })).toStrictEqual([
			'card-b',
			'cards',
		]);
	});
});
