/**
 * viewer-inspector-panel.service.test.ts: Unit tests for
 * `ViewerInspectorPanelService`, focused on the mobile-vs-desktop initial
 * state of the format pane: on mobile it must start closed (so the pane's tab
 * strip, which carries its own Comments button, never collides with the
 * mobile bottom bar's Comments button), and the bottom bar's "Format" slot
 * opens it explicitly via `openFormatPanel()`. Mirrors React's
 * `isInspectorPaneOpen` initializer (open on desktop, closed on mobile).
 *
 * The service is constructed inside a minimal injection context via
 * `Injector.create` with a stubbed `IsMobileService` (same pattern as
 * `print.service.test.ts`).
 */
import { Injector, runInInjectionContext, signal } from '@angular/core';
import type { PptxSlide } from 'pptx-viewer-core';
import { describe, expect, it } from 'vitest';

import { IsMobileService } from './is-mobile';
import { ViewerInspectorPanelService } from './viewer-inspector-panel.service';

function createService(isMobile: boolean): ViewerInspectorPanelService {
	const mobileStub = { isMobile: signal(isMobile) } as unknown as IsMobileService;
	const injector = Injector.create({
		providers: [
			{ provide: IsMobileService, useValue: mobileStub },
			{ provide: ViewerInspectorPanelService, useClass: ViewerInspectorPanelService },
		],
	});
	const svc = runInInjectionContext(injector, () => injector.get(ViewerInspectorPanelService));
	svc.bind({
		canEdit: () => true,
		selectedElement: () => null,
		activeSlide: () => ({ id: 's1', rId: 'r1', slideNumber: 1, elements: [] }) as PptxSlide,
	});
	return svc;
}

describe('viewerInspectorPanelService', () => {
	it('starts with the format pane open on desktop', () => {
		const svc = createService(false);
		expect(svc.formatPanelClosed()).toBeFalsy();
		expect(svc.visibleInspectorKind()).toBe('slide');
		expect(svc.inspectorPaneOpen()).toBeTruthy();
	});

	it('starts with the format pane closed on mobile (canvas owns first paint)', () => {
		const svc = createService(true);
		expect(svc.formatPanelClosed()).toBeTruthy();
		expect(svc.visibleInspectorKind()).toBeNull();
		expect(svc.inspectorPaneOpen()).toBeFalsy();
	});

	it('still shows explicit tool panels on mobile while the format pane is closed', () => {
		const svc = createService(true);
		svc.togglePanel('comments');
		expect(svc.visibleInspectorKind()).toBe('comments');
		svc.togglePanel('comments');
		expect(svc.visibleInspectorKind()).toBeNull();
	});

	it('openFormatPanel opens the format pane and clears tool panel + swipe dismissal', () => {
		const svc = createService(true);
		svc.togglePanel('comments');
		svc.mobileInspectorHidden.set(true);
		svc.openFormatPanel();
		expect(svc.activePanel()).toBeNull();
		expect(svc.formatPanelClosed()).toBeFalsy();
		expect(svc.mobileInspectorHidden()).toBeFalsy();
		expect(svc.visibleInspectorKind()).toBe('slide');
	});

	it('toggleFormatPanel still toggles the pane after the mobile-closed default', () => {
		const svc = createService(true);
		svc.toggleFormatPanel();
		expect(svc.visibleInspectorKind()).toBe('slide');
		svc.toggleFormatPanel();
		expect(svc.visibleInspectorKind()).toBeNull();
	});
});
