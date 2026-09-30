import { buildReviewRibbon } from 'pptx-viewer-shared';
import type { RibbonControlId } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';

import { WebRibbonSection } from './WebRibbonSection';

export interface ReviewSectionProps {
	canEdit: boolean;
	spellCheckEnabled: boolean;
	onSetSpellCheckEnabled: (enabled: boolean) => void;
	onToggleComments?: () => void;
	isCommentsPanelOpen?: boolean;
	slideCommentCount?: number;
	onCompare?: () => void;
	onOpenAccessibilityCheck?: () => void;
	onSetLanguage?: () => void;
}

export function ReviewSection(p: ReviewSectionProps): React.ReactElement {
	const { t } = useTranslation();
	const groups = buildReviewRibbon(t, {
		editable: p.canEdit,
		spellCheck: p.spellCheckEnabled,
		canAccessibility: Boolean(p.onOpenAccessibilityCheck),
		canLanguage: Boolean(p.onSetLanguage),
		canCompare: Boolean(p.onCompare),
		canComments: Boolean(p.onToggleComments),
		commentsOpen: p.isCommentsPanelOpen,
		commentCount: p.slideCommentCount,
	});
	const request = (id: RibbonControlId) => {
		switch (id) {
			case 'review.proofing.spelling':
				p.onSetSpellCheckEnabled(!p.spellCheckEnabled);
				break;
			case 'review.accessibility.check':
				p.onOpenAccessibilityCheck?.();
				break;
			case 'review.language.language':
				p.onSetLanguage?.();
				break;
			case 'review.compare.compare':
				if (p.canEdit) {
					p.onCompare?.();
				}
				break;
			case 'review.comments.newComment':
			case 'review.comments.showComments':
				p.onToggleComments?.();
				break;
		}
	};
	return <WebRibbonSection groups={groups} onCommand={request} />;
}
