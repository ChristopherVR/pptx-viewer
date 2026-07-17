/**
 * ChromeUiState: reactive open/collapsed state for the editing chrome's side
 * panels, mirroring React's `useViewerState` flags (`isSidebarCollapsed`,
 * `isInspectorPaneOpen`, `inspectorTab`). Owned by `PowerPointViewer` and
 * threaded to both the ribbon's primary row (the toggle buttons) and
 * `ViewerBody` (which gates the thumbnail rail and inspector pane on it).
 */

/** The inspector pane's tab strip, matching React's `InspectorTab`. */
export type InspectorTabId = 'elements' | 'properties' | 'comments';

export class ChromeUiState {
	/** Left thumbnail rail visibility (React: `isSidebarCollapsed`). */
	sidebarCollapsed = $state(false);
	/** Right inspector pane visibility (React: `isInspectorPaneOpen`). */
	inspectorOpen = $state(true);
	/** Active inspector tab (React defaults to Properties). */
	inspectorTab = $state<InspectorTabId>('properties');

	toggleSidebar(): void {
		this.sidebarCollapsed = !this.sidebarCollapsed;
	}

	toggleInspector(): void {
		this.inspectorOpen = !this.inspectorOpen;
	}

	setInspectorTab(tab: InspectorTabId): void {
		this.inspectorTab = tab;
	}

	/** Comments toolbar button: toggle the inspector's Comments tab. */
	toggleComments(): void {
		if (this.inspectorOpen && this.inspectorTab === 'comments') {
			this.inspectorOpen = false;
			return;
		}
		this.inspectorTab = 'comments';
		this.inspectorOpen = true;
	}

	/** True when the inspector is showing the Comments tab. */
	get commentsOpen(): boolean {
		return this.inspectorOpen && this.inspectorTab === 'comments';
	}
}
