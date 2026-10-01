import type { PptxUiRibbonViewElement, RibbonViewRequestEvent } from 'pptx-viewer-shared';
import React, { useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';

export interface ViewSectionProps {
	canEdit: boolean;
	editTemplateMode: boolean;
	onSetEditTemplateMode: (mode: boolean) => void;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	showGrid: boolean;
	showRulers: boolean;
	showGuides: boolean;
	snapToGrid: boolean;
	snapToShape: boolean;
	onSetShowGrid: (enabled: boolean) => void;
	onSetShowRulers: (enabled: boolean) => void;
	onSetShowGuides: (enabled: boolean) => void;
	onSetSnapToGrid: (enabled: boolean) => void;
	onSetSnapToShape: (enabled: boolean) => void;
	onAddGuide: (axis: 'h' | 'v') => void;
	onEnterMasterView: () => void;
	isSelectionPaneOpen?: boolean;
	onToggleSelectionPane?: () => void;
	eyedropperActive?: boolean;
	onToggleEyedropper?: () => void;
	onToggleSlideSorter?: () => void;
	/**
	 * View > Normal: leave whichever alternate view (slide sorter, reading,
	 * outline, master) is open and return to the ordinary editing canvas.
	 */
	onGoToNormalView?: () => void;
	/** Enter PowerPoint's Reading View (full window, not the fullscreen show). */
	onOpenReadingView?: () => void;
	/** Enter PowerPoint's Outline view: the deck as editable indented text. */
	onOpenOutlineView?: () => void;
	onZoomToFit?: () => void;
}

export function ViewSection(p: ViewSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const ref = useRef<PptxUiRibbonViewElement>(null);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		host.state = {
			editable: p.canEdit,
			showRulers: p.showRulers,
			showGrid: p.showGrid,
			showGuides: p.showGuides,
			snapToGrid: p.snapToGrid,
			snapToShape: p.snapToShape,
			templateEditing: p.editTemplateMode,
			selectionPaneOpen: p.isSelectionPaneOpen,
			eyedropperActive: p.eyedropperActive,
			translate: t,
		};
	}, [p, t]);
	useEffect(() => {
		const host = ref.current;
		if (!host) {
			return;
		}
		const request = (event: Event) => {
			const intent = (event as RibbonViewRequestEvent).detail;
			if (intent.kind === 'guide') {
				p.onAddGuide(intent.axis);
			} else if (intent.kind === 'option') {
				const setters = {
					showRulers: p.onSetShowRulers,
					showGrid: p.onSetShowGrid,
					showGuides: p.onSetShowGuides,
					snapToGrid: p.onSetSnapToGrid,
					snapToShape: p.onSetSnapToShape,
					templateEditing: p.onSetEditTemplateMode,
				};
				setters[intent.value](intent.enabled);
			} else {
				const commands = {
					normal: p.onGoToNormalView,
					slideSorter: p.onToggleSlideSorter,
					outline: p.onOpenOutlineView,
					readingView: p.onOpenReadingView,
					slideMaster: p.onEnterMasterView,
					selectionPane: p.onToggleSelectionPane,
					eyedropper: p.onToggleEyedropper,
					zoomToFit: p.onZoomToFit,
				};
				commands[intent.value]?.();
			}
		};
		host.addEventListener('view-request', request);
		return () => host.removeEventListener('view-request', request);
	}, [p]);
	return <pptx-ui-ribbon-view ref={ref} />;
}
