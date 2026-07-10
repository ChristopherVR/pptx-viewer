import type { PptxElement, PptxSlide } from 'pptx-viewer-core';
import type { CollaborationConfig, YDocLike, YjsFactories } from 'pptx-viewer-shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { flushSync } from 'svelte';
import { describe, expect, it, vi } from 'vitest';
import * as Y from 'yjs';

import { EditorState } from '../editor/editor-state.svelte';
import type { CollabSession, CollabSessionFactory } from './collaboration-session';
import { CollaborationController } from './collaboration.svelte';

/**
 * `.svelte.test.ts` so the runes runtime compiles `CollaborationController`'s
 * constructor `$effect`s. A real in-memory `Y.Doc` (with a fake, network-free
 * provider handle) exercises the shared reconcile/observe path end to end, so
 * the tests assert real publish/remote-apply behaviour, not mock call counts.
 */

const CONFIG: CollaborationConfig = {
	roomId: 'test-room',
	serverUrl: '',
	transport: 'webrtc',
	userName: 'Tester',
};

function shape(id: string): PptxElement {
	return { type: 'shape', id, x: 0, y: 0, width: 10, height: 10, rotation: 0 } as PptxElement;
}
function slide(id: string, elements: PptxElement[]): PptxSlide {
	return { id, rId: `rId-${id}`, slideNumber: 1, elements };
}

function realFactories(): YjsFactories {
	return {
		createMap: () => new Y.Map(),
		createArray: () => new Y.Array(),
		createText: () => new Y.Text(),
	};
}

/** A fake session backed by a real Y.Doc; `syncedNow` controls the sync gate. */
function fakeSessionFactory(doc: Y.Doc, syncedNow = true): CollabSessionFactory {
	return async (): Promise<CollabSession> => ({
		ydoc: doc as unknown as YDocLike,
		factories: realFactories(),
		provider: {
			onStatus: () => {},
			connectedNow: true,
			onSynced: () => {},
			syncedNow,
			destroy: vi.fn(),
		},
		destroy: vi.fn(),
	});
}

function makeEditor(initial: PptxSlide[]): EditorState {
	const editor = new EditorState({ getCurrent: () => 0, getHandler: () => null });
	editor.editable = true;
	editor.setSlides(initial);
	return editor;
}

/**
 * Run `body` inside a live `$effect.root`, keeping the root alive until the
 * async assertions settle (disposing it early would tear down the controller's
 * publish effect before the edit under test lands).
 */
function inRoot(body: () => Promise<void>): Promise<void> {
	return new Promise<void>((resolve, reject) => {
		let dispose = (): void => {};
		dispose = $effect.root(() => {
			void (async () => {
				try {
					await body();
					resolve();
				} catch (err) {
					reject(err instanceof Error ? err : new Error(String(err)));
				} finally {
					dispose();
				}
			})();
		});
	});
}

describe('collaborationController', () => {
	it('publishes the local slides into the doc once the sync gate opens', async () => {
		const doc = new Y.Doc();
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			// getConfig returns the started config so the auto start/stop effect
			// treats the manual `start` below as already-current (no restart/stop).
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => editor.applyRemoteSlides(s),
				getConfig: () => CONFIG,
				createSession: fakeSessionFactory(doc, true),
			});
			await collab.start(CONFIG);

			// Gate opened during start (syncedNow), seeding the doc.
			expect(readSlidesFromYDoc(doc as unknown as YDocLike).map((s) => s.id)).toStrictEqual(['s1']);

			// A subsequent edit republishes granularly.
			editor.setSlides([slide('s1', [shape('e1'), shape('e2')])]);
			flushSync();
			const after = readSlidesFromYDoc(doc as unknown as YDocLike);
			expect(after[0].elements.map((e) => e.id)).toStrictEqual(['e1', 'e2']);
			collab.stop();
		});
	});

	it('applies a remote peer edit through applyRemoteSlides (granular reconcile)', async () => {
		const doc = new Y.Doc();
		const applySpy = vi.fn();
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => {
					applySpy(s);
					editor.applyRemoteSlides(s);
				},
				getConfig: () => CONFIG,
				createSession: fakeSessionFactory(doc, true),
			});
			await collab.start(CONFIG);

			// Simulate a remote peer's write (a non-local transaction origin).
			reconcileSlidesInYDoc(
				[slide('s1', [shape('e1'), shape('remote')])],
				doc as unknown as YDocLike,
				realFactories(),
				'remote-peer',
			);
			expect(applySpy).toHaveBeenCalledOnce();
			const applied = applySpy.mock.calls[0][0] as PptxSlide[];
			expect(applied[0].elements.map((e) => e.id)).toStrictEqual(['e1', 'remote']);
			collab.stop();
		});
	});

	it('enforces the viewer role: read-only and never publishes local edits', async () => {
		const doc = new Y.Doc();
		const viewerConfig: CollaborationConfig = { ...CONFIG, role: 'viewer' };
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: (s) => editor.applyRemoteSlides(s),
				getConfig: () => viewerConfig,
				createSession: fakeSessionFactory(doc, true),
			});
			await collab.start(viewerConfig);

			expect(collab.readOnly).toBeTruthy();
			editor.setSlides([slide('s1', [shape('e1'), shape('e2')])]);
			flushSync();
			// A viewer must not write to the shared doc.
			expect(readSlidesFromYDoc(doc as unknown as YDocLike)).toHaveLength(0);
			collab.stop();
			expect(collab.readOnly).toBeFalsy();
		});
	});

	it('goes to error status on an invalid room id', async () => {
		await inRoot(async () => {
			const editor = makeEditor([slide('s1', [shape('e1')])]);
			const collab = new CollaborationController({
				getSlides: () => editor.slides,
				applyRemoteSlides: () => {},
				getConfig: () => undefined,
				createSession: fakeSessionFactory(new Y.Doc(), true),
			});
			await collab.start({ ...CONFIG, roomId: 'bad room!' });
			expect(collab.status).toBe('error');
			expect(collab.active).toBeFalsy();
		});
	});
});
