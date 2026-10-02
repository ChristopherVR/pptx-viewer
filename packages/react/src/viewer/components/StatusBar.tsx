import { resolveStatusBarSave, statusBarViewMode } from 'pptx-viewer-shared';
import type { PptxUiStatusBarElement, StatusBarRequestEvent } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

import type { AutosaveStatus } from '../hooks/useAutosave';

export interface StatusBarProps {
	slideCount: number;
	activeSlideIndex: number;
	isDirty: boolean;
	autosaveStatus?: AutosaveStatus;
	/** Current zoom scale (0-1+ range, e.g. 1.0 = 100%). */
	scale?: number;
	/** Callback to zoom in. */
	onZoomIn?: () => void;
	/** Callback to zoom out. */
	onZoomOut?: () => void;
	/** Callback to zoom to fit. */
	onZoomToFit?: () => void;
	/** Whether the notes panel is expanded. */
	isNotesExpanded?: boolean;
	/** Toggle the notes panel. */
	onToggleNotes?: () => void;
	/** Current viewer mode. */
	mode?: string;
	/** Callback to switch viewer mode. */
	onSetMode?: (mode: 'edit' | 'present') => void;
	/** Callback to toggle slide sorter view. */
	onToggleSlideSorter?: () => void;
	/** Optional collaboration status indicator rendered inline. */
	collaborationSlot?: React.ReactNode;
	/** Hides the zoom in/out/to-fit control cluster. Maps to `hiddenActions: ['zoom']`. */
	hideZoomControls?: boolean;
	/** Hides the notes-panel toggle button. Maps to `hiddenActions: ['notes']`. */
	hideNotesToggle?: boolean;
	/** Hides the quick "Slide Show" (fullscreen present) toggle button. Maps to `hiddenActions: ['fullscreen']`. */
	hideFullscreenToggle?: boolean;
}

/**
 * Thin adapter around the shared `pptx-ui-status-bar`: it maps viewer state to the
 * element's controlled state and routes `status-request` intents to the handlers.
 */
export function StatusBar(p: StatusBarProps): React.ReactElement {
	const { t } = useTranslation();
	const ref = useRef<PptxUiStatusBarElement>(null);
	const save = resolveStatusBarSave(t, p.autosaveStatus, p.isDirty);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		host.state = {
			slideCount: p.slideCount,
			activeSlideIndex: p.activeSlideIndex,
			saveText: save.text,
			saveKind: save.kind,
			zoomPercent: p.scale !== undefined && !p.hideZoomControls ? (p.scale ?? 1) * 100 : undefined,
			showNotes: Boolean(p.onToggleNotes) && !p.hideNotesToggle,
			notesExpanded: p.isNotesExpanded === true,
			showViewModes: Boolean(p.onSetMode),
			showSorter: Boolean(p.onToggleSlideSorter),
			showSlideShow: !p.hideFullscreenToggle,
			viewMode: statusBarViewMode(p.mode),
			translate: t,
		};
	}, [p, save.text, save.kind, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) => {
			switch ((event as StatusBarRequestEvent).detail.id) {
				case 'notes':
					p.onToggleNotes?.();
					break;
				case 'normal':
					p.onSetMode?.('edit');
					break;
				case 'sorter':
					p.onToggleSlideSorter?.();
					break;
				case 'slideShow':
					p.onSetMode?.('present');
					break;
				case 'zoomOut':
					p.onZoomOut?.();
					break;
				case 'zoomFit':
					p.onZoomToFit?.();
					break;
				case 'zoomIn':
					p.onZoomIn?.();
			}
		};
		host.addEventListener('status-request', request);
		return () => host.removeEventListener('status-request', request);
	}, [p]);
	return (
		<pptx-ui-status-bar ref={ref}>
			{p.collaborationSlot ? (
				<div slot='collaboration' style={{ display: 'contents' }}>
					{p.collaborationSlot}
				</div>
			) : null}
		</pptx-ui-status-bar>
	);
}
