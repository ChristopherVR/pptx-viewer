import { flushPromises, mount } from '@vue/test-utils';
import type { CollaborationConfig, ExternalCollaborationSession } from 'pptx-viewer-shared';
import { readSlidesFromYDoc, reconcileSlidesInYDoc } from 'pptx-viewer-shared';
import { describe, expect, it, vi } from 'vitest';
import { Doc, Map as YMap, Array as YArray, Text as YText } from 'yjs';

import ComparePanel from './components/ComparePanel.vue';
import VersionHistoryPanel from './components/VersionHistoryPanel.vue';
import ViewerCanvasOverlays from './components/ViewerCanvasOverlays.vue';
import PowerPointViewer from './PowerPointViewer.vue';
import type { PowerPointViewerExpose } from './types';

/**
 * Smoke test for the editing wiring. With no `content`, `useLoadContent` settles
 * to an empty (non-loading) presentation, so the viewer chrome renders. The
 * desktop chrome is the Office-style ribbon (`RibbonToolbar`); its ribbon tab
 * content only appears in edit/master mode, so it gates on `canEdit`.
 */
describe('powerPointViewer editing wiring', () => {
	it('keeps a host-owned viewer session locally read-only and restores collaborator editing', async () => {
		const doc = new Doc();
		let synced = true;
		const listeners = new Set<() => void>();
		const externalSession: ExternalCollaborationSession = {
			doc,
			awareness: {
				clientID: doc.clientID,
				getLocalState: () => null,
				setLocalState: () => {},
				setLocalStateField: () => {},
				getStates: () => new Map(),
				on: () => {},
				off: () => {},
			},
			getSnapshot: () => ({ status: 'connected', synced }),
			subscribe: (listener) => {
				listeners.add(listener);
				return () => {
					listeners.delete(listener);
				};
			},
		};
		const collaboration: CollaborationConfig = {
			roomId: 'external',
			serverUrl: '',
			userName: 'Reader',
			role: 'viewer',
			externalSession,
		};
		const wrapper = mount(PowerPointViewer, {
			props: { content: null, canEdit: true, collaboration },
		});
		try {
			await flushPromises();
			const viewer = wrapper.vm as unknown as PowerPointViewerExpose;
			expect(wrapper.find('.pptx-vue-main').classes()).not.toContain('is-editable');
			// Host-side deck creation remains available in read-only mode; actual
			// editing surfaces and insertion must still honor the viewer role.
			viewer.addSlide();
			await flushPromises();
			expect(
				viewer.addElement({
					type: 'shape',
					id: 'shape',
					x: 0,
					y: 0,
					width: 40,
					height: 40,
					rotation: 0,
				}),
			).toBeUndefined();
			expect(viewer.getElements()).toStrictEqual([]);
			await wrapper.setProps({ collaboration: { ...collaboration, role: 'collaborator' } });
			await flushPromises();
			expect(wrapper.find('.pptx-vue-main').classes()).toContain('is-editable');
			expect(
				viewer.addElement({
					type: 'shape',
					id: 'shape',
					x: 0,
					y: 0,
					width: 40,
					height: 40,
					rotation: 0,
				}),
			).toBeTruthy();
			await flushPromises();
			const textId = viewer.addElement({
				type: 'text',
				id: 'draft',
				x: 0,
				y: 0,
				width: 200,
				height: 50,
				text: 'Original',
			});
			await flushPromises();
			const inlineEdit = wrapper.getComponent(ViewerCanvasOverlays).props('inlineEdit');
			inlineEdit.enterInlineEdit(textId!);
			await flushPromises();
			const draftNode = wrapper.get('[data-inline-editor]').element as HTMLElement;
			draftNode.innerText = 'Accepted draft';
			draftNode.dispatchEvent(new Event('input', { bubbles: true }));
			synced = false;
			for (const listener of listeners) {
				listener();
			}
			await flushPromises();
			expect(viewer.getElements().find((element) => element.id === textId)).toMatchObject({
				text: 'Accepted draft',
			});
			expect(wrapper.find('[data-inline-editor]').exists()).toBeFalsy();
			expect(wrapper.find('.pptx-vue-main').classes()).not.toContain('is-editable');
			expect(
				viewer.addElement({
					type: 'shape',
					id: 'unsynced-shape',
					x: 0,
					y: 0,
					width: 40,
					height: 40,
				}),
			).toBeUndefined();
			const remote = readSlidesFromYDoc(doc);
			const remoteText = remote
				.flatMap((slide) => slide.elements)
				.find((element) => element.id === textId)!;
			Object.assign(remoteText, {
				text: 'Remote replacement',
				textSegments: [{ text: 'Remote replacement', style: {} }],
			});
			reconcileSlidesInYDoc(
				remote,
				doc,
				{
					createMap: () => new YMap(),
					createArray: () => new YArray(),
					createText: () => new YText(),
				},
				'peer',
			);
			synced = true;
			for (const listener of listeners) {
				listener();
			}
			await flushPromises();
			draftNode.dispatchEvent(new Event('blur'));
			await flushPromises();
			expect(viewer.getElements().find((element) => element.id === textId)).toMatchObject({
				text: 'Remote replacement',
			});
			expect(wrapper.find('.pptx-vue-main').classes()).toContain('is-editable');
			await wrapper.setProps({ collaboration: undefined });
			await flushPromises();
			expect(wrapper.find('.pptx-vue-main').classes()).toContain('is-editable');
			expect(listeners.size).toBe(0);
		} finally {
			wrapper.unmount();
			doc.destroy();
		}
	});

	it.each([
		{ afterIndex: -1, active: 2, inserted: 0 },
		{ afterIndex: 0, active: 2, inserted: 1 },
		{ afterIndex: 1, active: 0, inserted: 2 },
		{ afterIndex: 2, active: 0, inserted: 3 },
		{ afterIndex: 99, active: 0, inserted: 3 },
		{ afterIndex: undefined, active: 0, inserted: 1 },
	])(
		'addSlide($afterIndex) inserts at $inserted with slide $active active',
		async ({ afterIndex, active, inserted }) => {
			const wrapper = mount(PowerPointViewer, { props: { canEdit: true } });
			try {
				await flushPromises();
				const viewer = wrapper.vm as unknown as PowerPointViewerExpose;
				for (let index = 0; index < 3; index++) {
					viewer.addSlide();
					await flushPromises();
				}
				viewer.goTo(active);
				await flushPromises();
				const original = viewer.getSlides().map((slide) => slide.id);
				viewer.addSlide(afterIndex);
				await flushPromises();
				const slides = viewer.getSlides();
				expect(slides).toHaveLength(4);
				expect(original).not.toContain(slides[inserted].id);
				expect(
					slides.filter((_, index) => index !== inserted).map((slide) => slide.id),
				).toStrictEqual(original);
				expect(viewer.getActiveSlideIndex()).toBe(inserted);
				expect(viewer.isDirty()).toBeTruthy();
				expect(viewer.canUndo()).toBeTruthy();
				const addedIds = slides.map((slide) => slide.id);
				viewer.undo();
				await flushPromises();
				expect(viewer.getSlides().map((slide) => slide.id)).toStrictEqual(original);
				viewer.redo();
				await flushPromises();
				expect(viewer.getSlides().map((slide) => slide.id)).toStrictEqual(addedIds);
			} finally {
				wrapper.unmount();
			}
		},
	);

	it('hides the ribbon tab content when not editable', async () => {
		const wrapper = mount(PowerPointViewer, { props: { canEdit: false } });
		await flushPromises();
		// The ribbon's quick-access row still renders, but in preview mode there
		// are no ribbon tabs (and no selection overlay).
		expect(wrapper.find('button[aria-label="Toggle inspector"]').exists()).toBeFalsy();
		expect(wrapper.find('.pptx-vue-selection-overlay').exists()).toBeFalsy();
	});

	// Regression test: File ▸ Version History and its restore/compare view were
	// fully wired up (state, ribbon action, restore/compare handlers) but the
	// two panels were never mounted in the template, so the feature was
	// unreachable. Both panels gate their own root element on an `open` prop,
	// so they should always be present in the tree (just hidden) once mounted.
	it('mounts the version-history and compare panels', async () => {
		const wrapper = mount(PowerPointViewer, { props: { canEdit: true } });
		await flushPromises();
		expect(wrapper.findComponent(VersionHistoryPanel).exists()).toBeTruthy();
		expect(wrapper.findComponent(ComparePanel).exists()).toBeTruthy();
	});

	// Regression test: `ribbonProps` does not carry the AI bindings, and the
	// template passed them only to the desktop <RibbonToolbar>, so on a phone
	// viewport the mobile toolbar's `aiEnabled` stayed undefined and the
	// "Toggle AI assistant" button never rendered: the assistant was
	// unreachable on mobile even with `ai` configured.
	it('wires the AI toggle into the mobile toolbar when ai is configured', async () => {
		// Force the mobile chrome: no ResizeObserver in jsdom, so useIsMobile
		// falls back to matchMedia; a matching stub flips isMobile on.
		const mql = {
			matches: true,
			media: '(max-width: 767px)',
			addEventListener: () => {},
			removeEventListener: () => {},
		};
		vi.stubGlobal('matchMedia', () => mql);
		try {
			const wrapper = mount(PowerPointViewer, {
				props: {
					canEdit: true,
					ai: { connection: { kind: 'endpoint', api: '/ai' } },
				},
			});
			await flushPromises();
			expect(wrapper.find('button[aria-label="Toggle AI assistant"]').exists()).toBeTruthy();
		} finally {
			vi.unstubAllGlobals();
		}
	});

	it('matches the React 20% to 500% imperative zoom range', async () => {
		const wrapper = mount(PowerPointViewer);
		await flushPromises();
		const viewer = wrapper.vm as unknown as {
			getZoom(): number;
			setZoom(level: number): void;
		};

		viewer.setZoom(10);
		expect(viewer.getZoom()).toBe(5);
		viewer.setZoom(0);
		expect(viewer.getZoom()).toBe(0.2);
	});
});
