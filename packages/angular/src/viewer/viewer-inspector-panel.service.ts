/**
 * viewer-inspector-panel.service.ts: Viewer-scoped state + logic for the
 * single right-docked inspector host: which explicit tool panel (comments /
 * accessibility / signatures / selection) is toggled on, the derived "what
 * should the host actually show" precedence (explicit panel → element →
 * slide default), its mobile-only swipe-to-dismiss drag, and the accessible
 * label per shown content.
 *
 * Extracted from {@link PowerPointViewerComponent}: the component binds the
 * accessors it alone owns (canEdit / selected-element / active-slide) via
 * {@link bind}; the template reads the signals/computeds off the injected
 * instance directly (same pattern as `session`/`xport`).
 *
 * Provide it once on the viewer component (`providers: [ViewerInspectorPanelService]`).
 */

import { computed, inject, Injectable, signal } from '@angular/core';
import type { PptxElement, PptxSlide } from 'pptx-viewer-core';

import { IsMobileService } from './is-mobile';
import { createSwipeDismissDrag } from './swipe-dismiss';

/** The explicit right-docked tool panels a ribbon/bottom-bar button can toggle. */
export type InspectorToolPanel = 'comments' | 'accessibility' | 'signatures' | 'selection';

/** What the single inspector host is actually showing, after precedence rules. */
export type InspectorContent = InspectorToolPanel | 'element' | 'slide' | null;

/** Live host accessors the content precedence needs. */
interface InspectorPanelHost {
	readonly canEdit: () => boolean;
	readonly selectedElement: () => PptxElement | null;
	readonly activeSlide: () => PptxSlide | undefined;
}

@Injectable()
export class ViewerInspectorPanelService {
	private readonly mobile = inject(IsMobileService);

	/** Active right-docked tool panel (comments / accessibility / selection), or null. */
	readonly activePanel = signal<InspectorToolPanel | null>(null);
	/** True once the user swiped the inspector away on mobile (until reopened). */
	readonly mobileInspectorHidden = signal(false);
	/**
	 * True once the user has explicitly closed the format (element/slide)
	 * panel via the ribbon toggle - independent of selection, mirroring
	 * React's/Vue's own open/closed toggle state. Never affects the explicit
	 * tool panels (comments/accessibility/signatures/selection), which show
	 * regardless of this flag.
	 */
	readonly formatPanelClosed = signal(false);
	/**
	 * Swipe-to-dismiss drag for the inspector host. The host docks in-flow below
	 * the canvas on mobile (same keyboard-reachability reason as the notes
	 * sheet), so the gesture is wired here rather than via a fixed-overlay
	 * dismiss. Clearing the past-threshold drag also closes any open tool panel.
	 */
	readonly inspectorDrag = createSwipeDismissDrag(() => {
		this.mobileInspectorHidden.set(true);
		this.activePanel.set(null);
	});

	private host: InspectorPanelHost | null = null;

	/** Wire the host accessors (called once from the component constructor). */
	bind(host: InspectorPanelHost): void {
		this.host = host;
	}

	private requireHost(): InspectorPanelHost {
		if (!this.host) {
			throw new Error('ViewerInspectorPanelService.bind() was not called');
		}
		return this.host;
	}

	/**
	 * Which panel the single inspector host should show, applying the original
	 * first-match precedence (explicit tool panels → element → slide default).
	 * `accessibility`/`signatures` render regardless of edit mode; the rest need
	 * `canEdit`.
	 */
	readonly inspectorContent = computed<InspectorContent>(() => {
		const host = this.requireHost();
		const panel = this.activePanel();
		if (panel === 'accessibility') {
			return 'accessibility';
		}
		if (panel === 'signatures') {
			return 'signatures';
		}
		if (!host.canEdit()) {
			return null;
		}
		if (panel === 'comments') {
			return 'comments';
		}
		if (panel === 'selection') {
			return 'selection';
		}
		if (host.selectedElement()) {
			return 'element';
		}
		if (host.activeSlide()) {
			return 'slide';
		}
		return null;
	});

	/**
	 * `inspectorContent`, but the format (element/slide) view collapses to
	 * `null` once the user has explicitly closed it via the ribbon toggle.
	 * Explicit tool panels (comments/accessibility/etc.) are untouched.
	 */
	private readonly formatPanelContent = computed<InspectorContent>(() => {
		const content = this.inspectorContent();
		if ((content === 'element' || content === 'slide') && this.formatPanelClosed()) {
			return null;
		}
		return content;
	});

	/**
	 * Whether the right-docked inspector is showing the format panel (element or
	 * slide properties). Drives the top-bar inspector-toggle active state.
	 */
	readonly inspectorPaneOpen = computed<boolean>(() => {
		const content = this.formatPanelContent();
		return content === 'element' || content === 'slide';
	});

	/** Inspector content, but null on mobile once the user has swiped it away. */
	readonly visibleInspectorKind = computed(() =>
		this.mobile.isMobile() && this.mobileInspectorHidden() ? null : this.formatPanelContent(),
	);

	/** Accessible-label translation key for the inspector host, by active content. */
	readonly inspectorLabel = computed(() => {
		switch (this.inspectorContent()) {
			case 'accessibility':
				return 'pptx.accessibility.title';
			case 'signatures':
				return 'pptx.viewer.digitalSignatures';
			case 'comments':
				return 'pptx.toolbar.comments';
			case 'selection':
				return 'pptx.selectionPane.title';
			case 'element':
				return 'pptx.inspector.properties';
			case 'slide':
				return 'pptx.inspector.properties';
			default:
				return '';
		}
	});

	/** Toggle a right-docked tool panel (clicking the active one closes it). */
	togglePanel(panel: InspectorToolPanel): void {
		this.activePanel.update((current) => (current === panel ? null : panel));
		// Tapping a panel button re-opens the host even after a swipe-dismiss.
		this.mobileInspectorHidden.set(false);
	}

	/**
	 * Ribbon "toggle inspector" action: if a tool panel is active, return to
	 * the format (element/slide) view; otherwise toggle the format view's
	 * open/closed state, matching React's and Vue's independent open/close
	 * toggle (closing/opening is not tied to selection changes).
	 */
	toggleFormatPanel(): void {
		if (this.activePanel() !== null) {
			this.activePanel.set(null);
			this.formatPanelClosed.set(false);
		} else {
			this.formatPanelClosed.update((closed) => !closed);
		}
	}
}
