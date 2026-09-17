import {
	DestroyRef,
	Injector,
	runInInjectionContext,
	signal,
	ɵChangeDetectionScheduler as ChangeDetectionScheduler,
	ɵEffectScheduler as EffectScheduler,
} from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it, vi } from 'vitest';

import { CollaborationService } from './collaboration.service';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import type { CollaborationConfig } from './types';
import { ViewerCanvasEditingService } from './viewer-canvas-editing.service';
import { ViewerCollabCursorService } from './viewer-collab-cursor.service';
import { ViewerCollaborationSessionService } from './viewer-collaboration-session.service';
import { ViewerCollaborationShellService } from './viewer-collaboration-shell.service';

function harness() {
	const queued = new Set<{ run(): void }>();
	const effects = {
		add: (item: { run(): void }) => queued.add(item),
		schedule: (item: { run(): void }) => queued.add(item),
		remove: (item: { run(): void }) => queued.delete(item),
		flush: () => {
			while (queued.size) {
				for (const item of [...queued]) {
					queued.delete(item);
					item.run();
				}
			}
		},
	};
	const collab = {
		active: signal(false),
		activeRole: signal<string | undefined>(undefined),
		readOnly: signal(false),
		status: signal('disconnected'),
		presence: signal([]),
		broadcastSlides: vi.fn(),
		adoptDocSlidesAfterLoad: vi.fn(),
		setSelection: vi.fn(),
		setActiveSlide: vi.fn(),
	};
	const editor = new EditorStateService();
	const loader = {
		slides: signal<PptxSlide[]>([]),
		sections: signal([]),
		loading: signal(false),
		error: signal<string | null>(null),
		canvasSize: signal({ width: 960, height: 540 }),
		load: vi.fn(async (_source: unknown) => undefined),
		saveSlides: vi.fn(async () => new Uint8Array([8])),
		getSaveOptions: vi.fn(() => ({ embedFonts: false })),
		bindPendingInlineEdit: vi.fn(),
	};
	const canvas = {
		bind: vi.fn(),
		suspendInlineEdit: vi.fn(),
		readInlineSnapshot: vi.fn(),
		editingId: signal(null),
	};
	const cursor = { bind: vi.fn(), cursors: signal([]), onPointerMove: vi.fn() };
	const session = { bind: vi.fn(), syncHostConfig: vi.fn() };
	const injector = Injector.create({
		providers: [
			{ provide: DestroyRef, useValue: { onDestroy: () => () => {} } },
			{ provide: ChangeDetectionScheduler, useValue: { notify: () => {} } },
			{ provide: EffectScheduler, useValue: effects },
			{ provide: CollaborationService, useValue: collab },
			{ provide: EditorStateService, useValue: editor },
			{ provide: LoadContentService, useValue: loader },
			{ provide: ViewerCanvasEditingService, useValue: canvas },
			{ provide: ViewerCollabCursorService, useValue: cursor },
			{ provide: ViewerCollaborationSessionService, useValue: session },
		],
	});
	const shell = runInInjectionContext(injector, () => new ViewerCollaborationShellService());
	const config = signal<CollaborationConfig | undefined>(undefined);
	const content = signal<Uint8Array | null>(null);
	const authorized = signal(true);
	shell.bind({
		content,
		collaboration: config,
		canEdit: authorized,
		stageElement: () => undefined,
	});
	effects.flush();
	return {
		shell,
		config,
		content,
		authorized,
		collab,
		editor,
		loader,
		canvas,
		session,
		flush: effects.flush,
	};
}

const config: CollaborationConfig = { roomId: 'room', userName: 'Editor', serverUrl: '' };

describe('custom-shell collaboration wiring', () => {
	it('keeps blank and no-config editing compatible without inventing a pending source', () => {
		const h = harness();
		expect(h.shell.state().canEdit).toBeTruthy();
		h.loader.loading.set(true);
		h.loader.error.set('unrelated load error');
		expect(h.shell.canEdit()).toBeTruthy();
		h.authorized.set(false);
		expect(h.shell.canEdit()).toBeFalsy();
	});

	it('projects active readiness and role without overriding host permission', () => {
		const h = harness();
		h.config.set(config);
		h.collab.active.set(true);
		h.collab.status.set('connected');
		h.collab.readOnly.set(true);
		h.flush();
		expect(h.shell.canEdit()).toBeFalsy();
		expect(h.canvas.suspendInlineEdit).toHaveBeenCalledWith();
		h.collab.readOnly.set(false);
		expect(h.shell.canEdit()).toBeTruthy();
		h.authorized.set(false);
		expect(h.shell.canEdit()).toBeFalsy();
		h.authorized.set(true);
		h.collab.status.set('disconnected');
		expect(h.shell.canEdit()).toBeTruthy(); // Host still permits local edits while offline.
		expect(h.shell.state().connectedCount).toBe(0);
	});

	it('releases a failed inactive session instead of trusting its requested role', () => {
		const h = harness();
		h.config.set({ ...config, role: 'viewer' });
		h.collab.status.set('error');
		h.collab.readOnly.set(false);
		h.flush();
		expect(h.shell.canEdit()).toBeTruthy();
	});

	it('blocks configured editing until the actual source finishes and after a load error', async () => {
		const h = harness();
		h.config.set(config);
		h.content.set(new Uint8Array([1]));
		h.flush();
		expect(h.shell.canEdit()).toBeFalsy();
		await Promise.resolve();
		expect(h.shell.canEdit()).toBeTruthy();
		h.loader.error.set('Invalid file');
		expect(h.shell.canEdit()).toBeFalsy();
	});

	it('seeds loaded slides then delegates authoritative adoption before broadcasting', () => {
		const h = harness();
		h.config.set(config);
		h.collab.active.set(true);
		const slides = [{ id: 'slide', elements: [] }] as PptxSlide[];
		h.loader.slides.set(slides);
		h.flush();
		expect(h.editor.slides()).toStrictEqual(slides);
		expect(h.collab.adoptDocSlidesAfterLoad).toHaveBeenCalledWith('bootstrap');
		expect(h.collab.broadcastSlides).toHaveBeenLastCalledWith(h.editor.slides());
		expect(h.session.syncHostConfig).toHaveBeenLastCalledWith(config);
	});

	it('does not let stale source completion re-block an already loaded replacement', async () => {
		const h = harness();
		h.config.set(config);
		let finishFirst!: () => void;
		let finishSecond!: () => void;
		h.loader.load
			.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						finishFirst = resolve;
					}),
			)
			.mockImplementationOnce(
				() =>
					new Promise<void>((resolve) => {
						finishSecond = resolve;
					}),
			);
		h.content.set(new Uint8Array([1]));
		h.flush();
		h.content.set(new Uint8Array([2]));
		h.flush();
		expect(h.shell.canEdit()).toBeFalsy();
		finishSecond();
		await Promise.resolve();
		expect(h.shell.canEdit()).toBeTruthy();
		finishFirst();
		await Promise.resolve();
		expect(h.shell.canEdit()).toBeTruthy();
	});

	it('renders separated template elements and merges them for manual and owner saves', async () => {
		const h = harness();
		const decoration = {
			id: 'master-decoration',
			type: 'shape',
			x: 0,
			y: 0,
			width: 20,
			height: 20,
		};
		const own = { ...decoration, id: 'own-shape' };
		h.loader.slides.set([{ id: 'slide', elements: [decoration, own] }] as PptxSlide[]);
		h.flush();
		expect(h.editor.slides()[0].elements).toStrictEqual([own]);
		expect(h.shell.activeTemplateElements()).toStrictEqual([decoration]);
		const host = h.session.bind.mock.calls[0][0];
		expect(host.getTemplateElements()).toStrictEqual({ slide: [decoration] });
		await h.shell.getContent();
		expect(h.loader.saveSlides.mock.calls[0][0][0].elements).toStrictEqual([decoration, own]);
	});

	it('saves the live editable deck even when readonly and retains session metadata', async () => {
		const h = harness();
		h.authorized.set(false);
		h.editor.setSlides([{ id: 'live', elements: [] }] as PptxSlide[]);
		await expect(h.shell.getContent()).resolves.toStrictEqual(new Uint8Array([8]));
		expect(h.loader.saveSlides).toHaveBeenCalledWith(
			h.editor.slides(),
			'pptx',
			h.editor.sections(),
		);
		const host = h.session.bind.mock.calls[0][0];
		expect(host.getSaveOptions()).toStrictEqual({ embedFonts: false });
		host.applyRemoteSlides([{ id: 'remote', elements: [] }]);
		expect(h.editor.slides()[0].id).toBe('remote');
	});

	it('delegates selection and active-slide presence and hides stale users after removal', () => {
		const h = harness();
		h.config.set(config);
		h.collab.active.set(true);
		h.collab.status.set('connected');
		h.shell.activeSlideIndex.set(2);
		h.editor.selectedIds.set(['shape']);
		h.flush();
		expect(h.collab.setSelection).toHaveBeenLastCalledWith('shape', 2);
		expect(h.collab.setActiveSlide).toHaveBeenLastCalledWith(2);
		expect(h.shell.state().connectedCount).toBe(1);
		h.config.set(undefined);
		expect(h.shell.state()).toMatchObject({
			status: 'disconnected',
			remoteUsers: [],
			connectedCount: 0,
		});
	});
});
