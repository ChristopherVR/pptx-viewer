import type { MobileBarIntent, PptxUiMobileBarElement } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { useWebControl } from '../../hooks/useWebControl';

export interface MobileBottomBarProps {
	/** Total number of slides in the presentation; every action disables at 0. */
	slideCount: number;
	/** Open the slides panel sheet. */
	onOpenSlides: () => void;
	/** Open the insert sheet (also reachable from menu). */
	onOpenInsert: () => void;
	/** Open the inspector / properties sheet. */
	onOpenInspector: () => void;
	/** Open the comments / review sheet. */
	onOpenComments: () => void;
	/** Toggle the notes drawer. */
	onToggleNotes: () => void;
	/** Currently-active sheet, for highlighting the bar button. */
	activeSheet: 'slides' | 'insert' | 'inspector' | 'comments' | 'notes' | null;
	/** Number of comments on the active slide (for the badge). */
	commentCount?: number;
}

/**
 * Persistent mobile bottom action bar: five primary navigation targets that
 * each open a bottom sheet (slides / inspector / comments / notes) or trigger
 * an action (insert). Mirrors the navigation pattern of Office Mobile and
 * Google Slides on small screens.
 *
 * A thin adapter around the shared `pptx-ui-mobile-bar`: the element owns the
 * markup, the no-slides gating, the pressed state and the comment badge; this
 * maps props onto its state and routes its `mobile-bar-request` intents to the
 * handlers. Visibility is owned by the parent (rendered only when `isMobile`),
 * so there is no width-based hiding here: that would wrongly hide the bar on a
 * wide-but-short landscape phone, which is still mobile.
 */
export function MobileBottomBar(p: MobileBottomBarProps): React.ReactElement {
	const { t } = useTranslation();
	const handlers = {
		slides: p.onOpenSlides,
		insert: p.onOpenInsert,
		inspector: p.onOpenInspector,
		comments: p.onOpenComments,
		notes: p.onToggleNotes,
	};
	const ref = useWebControl<PptxUiMobileBarElement>(
		{
			slideCount: p.slideCount,
			activeSheet: p.activeSheet,
			commentCount: p.commentCount,
			translate: t,
		},
		{
			'mobile-bar-request': (event) => handlers[(event.detail as MobileBarIntent).id](),
		},
	);
	return <pptx-ui-mobile-bar ref={ref} />;
}
