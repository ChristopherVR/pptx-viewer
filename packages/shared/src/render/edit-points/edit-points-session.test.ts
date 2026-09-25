import type { ShapePptxElement } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import type { EditPointsElementPatch } from './edit-points-export';
import { EditPointsSession } from './edit-points-session';

function rect(): ShapePptxElement {
	return { id: 'r1', type: 'shape', x: 100, y: 100, width: 200, height: 100, shapeType: 'rect' };
}

function start(element: ShapePptxElement = rect()) {
	const commits: EditPointsElementPatch[] = [];
	const onExit = vi.fn();
	const session = new EditPointsSession(element, {
		onCommit: (patch) => commits.push(patch),
		onExit,
	});
	return { session, commits, onExit };
}

describe('editPointsSession', () => {
	it('describes every vertex and segment in slide space', () => {
		const { session } = start();
		const view = session.view(2);
		expect(view.nodes.map((n) => [n.x, n.y])).toStrictEqual([
			[100, 100],
			[300, 100],
			[300, 200],
			[100, 200],
		]);
		expect(view.nodes[0].target).toBe('node:0:0');
		expect(view.segments).toHaveLength(4);
		// Sizes are divided by the zoom so they stay constant on screen.
		expect(view.nodes[0].size).toBe(4);
		expect(view.outlineD.startsWith('M 100 100')).toBeTruthy();
	});

	it('drags a vertex and commits once, on release', () => {
		const { session, commits } = start();
		session.pointerDown({ x: 300, y: 200, target: 'node:0:2' });
		session.pointerMove({ x: 340, y: 230 });
		session.pointerMove({ x: 350, y: 240 });
		expect(commits).toHaveLength(0);
		expect(session.view().nodes[2]).toMatchObject({ x: 350, y: 240, selected: true });
		session.pointerUp({ x: 350, y: 240 });
		expect(commits).toHaveLength(1);
		expect(commits[0]).toMatchObject({
			x: 100,
			y: 100,
			width: 250,
			height: 140,
			shapeType: 'custom',
		});
	});

	it('treats a press without movement as a selection, not an edit', () => {
		const { session, commits } = start();
		session.pointerDown({ x: 300, y: 200, target: 'node:0:2' });
		session.pointerUp({ x: 300, y: 200 });
		expect(commits).toHaveLength(0);
		expect(session.view().nodes[2].selected).toBeTruthy();
	});

	it('bends a segment into a curve', () => {
		const { session, commits } = start();
		session.pointerDown({ x: 200, y: 100, target: 'segment:0:0' });
		session.pointerMove({ x: 200, y: 60 });
		session.pointerUp({ x: 200, y: 60 });
		expect(commits).toHaveLength(1);
		expect(commits[0].customGeometryPaths?.[0].segments[1].type).toBe('cubicBezTo');
		expect(commits[0].y).toBeLessThan(100);
	});

	it('adds and deletes points with Ctrl+click', () => {
		const { session, commits } = start();
		session.pointerDown({ x: 200, y: 100, target: 'segment:0:0', ctrlKey: true });
		expect(session.view().nodes).toHaveLength(5);
		session.pointerDown({ x: 200, y: 100, target: 'node:0:1', ctrlKey: true });
		expect(session.view().nodes).toHaveLength(4);
		expect(commits).toHaveLength(2);
	});

	it('opens a vertex menu and runs a command from it', () => {
		const { session, commits } = start();
		const opened = session.contextMenu({
			x: 300,
			y: 100,
			target: 'node:0:1',
			clientX: 40,
			clientY: 50,
		});
		expect(opened).toBeTruthy();
		const menu = session.view().menu!;
		expect(menu).toMatchObject({ clientX: 40, clientY: 50 });
		expect(menu.entries.map((e) => e.id)).toStrictEqual([
			'add-point',
			'delete-point',
			'open-path',
			'smooth-point',
			'straight-point',
			'corner-point',
			'exit',
		]);
		expect(menu.entries.find((e) => e.id === 'corner-point')?.checked).toBeTruthy();
		session.runCommand('smooth-point');
		expect(session.view().menu).toBeNull();
		expect(commits).toHaveLength(1);
		expect(commits[0].customGeometryPaths?.[0].segments[1].type).toBe('cubicBezTo');
	});

	it('hides host-hidden menu commands', () => {
		const session = new EditPointsSession(rect(), {
			onCommit: () => undefined,
			onExit: () => undefined,
			hiddenCommands: new Set(['open-path', 'smooth-point', 'straight-point', 'corner-point']),
		});
		session.contextMenu({ x: 300, y: 100, target: 'node:0:1', clientX: 0, clientY: 0 });
		const entries = session.view().menu!.entries;
		expect(entries.map((e) => e.id)).toStrictEqual(['add-point', 'delete-point', 'exit']);
		expect(entries[2].separatorBefore).toBeTruthy();
	});

	it('exits on Escape, on a click away, and from the menu', () => {
		const a = start();
		expect(a.session.keyDown('Escape')).toBeTruthy();
		expect(a.onExit).toHaveBeenCalledOnce();
		expect(a.session.isEnded).toBeTruthy();

		const b = start();
		expect(b.session.pointerDown({ x: 5, y: 5, target: null })).toBeFalsy();
		expect(b.onExit).toHaveBeenCalledOnce();

		const c = start();
		c.session.contextMenu({ x: 200, y: 100, target: 'segment:0:0', clientX: 0, clientY: 0 });
		c.session.runCommand('exit');
		expect(c.onExit).toHaveBeenCalledOnce();
	});

	it('escape closes an open menu before leaving the mode', () => {
		const { session, onExit } = start();
		session.contextMenu({ x: 300, y: 100, target: 'node:0:1', clientX: 0, clientY: 0 });
		session.keyDown('Escape');
		expect(session.view().menu).toBeNull();
		expect(onExit).not.toHaveBeenCalled();
	});

	it('deletes the selected vertex with the Delete key', () => {
		const { session, commits } = start();
		session.pointerDown({ x: 300, y: 100, target: 'node:0:1' });
		session.pointerUp();
		expect(session.keyDown('Delete')).toBeTruthy();
		expect(commits).toHaveLength(1);
		expect(session.view().nodes).toHaveLength(3);
		expect(session.keyDown('Delete')).toBeFalsy();
	});

	it('ignores its own commits but reloads after an outside change', () => {
		const element = rect();
		const { session, commits } = start(element);
		session.pointerDown({ x: 300, y: 200, target: 'node:0:2' });
		session.pointerMove({ x: 400, y: 260 });
		session.pointerUp();
		session.reconcile({ ...element, ...commits[0] });
		expect(session.view().nodes[2]).toMatchObject({ x: 400, y: 260 });
		// An undo puts the original rectangle back.
		session.reconcile(element);
		expect(session.view().nodes[2]).toMatchObject({ x: 300, y: 200 });
	});

	it('keeps the frame of a rotated shape across commits', () => {
		const element = { ...rect(), rotation: 90 };
		const { session, commits } = start(element);
		const before = session.view().nodes[0];
		session.pointerDown({ x: before.x, y: before.y, target: 'node:0:0' });
		session.pointerMove({ x: before.x + 10, y: before.y });
		session.pointerUp();
		const after = session.view().nodes[0];
		expect(after.x).toBeCloseTo(before.x + 10, 6);
		expect(after.y).toBeCloseTo(before.y, 6);
		expect(commits[0].width).toBeCloseTo(200, 6);
		expect(commits[0].height).toBeCloseTo(110, 6);
	});
});
