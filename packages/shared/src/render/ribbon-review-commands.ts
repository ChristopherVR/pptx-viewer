import type { RibbonCommandView, RibbonGroupView } from './ribbon-command-view';

export interface ReviewRibbonState {
	editable: boolean;
	spellCheck: boolean;
	canSpellCheck?: boolean;
	canAccessibility?: boolean;
	accessibilityOpen?: boolean;
	canLanguage?: boolean;
	languageHidden?: boolean;
	canCompare?: boolean;
	canComments?: boolean;
	commentsOpen?: boolean;
	commentCount?: number;
}

type Translate = (key: string) => string;

/** Seven canonical groups with host-controlled availability and native intents. */
export function buildReviewRibbon(t: Translate, state: ReviewRibbonState): RibbonGroupView[] {
	const label = (key: string, fallback: string) => {
		const value = t(key);
		return value && value !== key ? value : fallback;
	};
	const command = (
		id: RibbonCommandView['id'],
		key: string,
		fallback: string,
		icon: string,
		options: Partial<RibbonCommandView> = {},
	): RibbonCommandView => ({ id, label: label(key, fallback), icon, ...options });
	const group = (
		id: RibbonGroupView['id'],
		key: string,
		fallback: string,
		commands: RibbonCommandView[],
	): RibbonGroupView => ({ id, label: label(key, fallback), commands });
	return [
		group('review.proofing', 'pptx.review.proofing', 'Proofing', [
			command('review.proofing.spelling', 'pptx.review.spelling', 'Spelling', 'spelling', {
				active: state.spellCheck,
				pressed: state.spellCheck,
				disabled: state.canSpellCheck === false,
				title: label('pptx.review.toggleSpellCheck', 'Toggle spell check'),
			}),
			command('review.proofing.thesaurus', 'pptx.review.thesaurus', 'Thesaurus', 'book', {
				disabled: true,
			}),
		]),
		group('review.accessibility', 'pptx.review.accessibility', 'Accessibility', [
			command(
				'review.accessibility.check',
				'pptx.review.accessibilityCheck',
				'Check Accessibility',
				'shield',
				{ disabled: state.canAccessibility === false, active: state.accessibilityOpen },
			),
		]),
		group('review.language', 'pptx.review.language', 'Language', [
			command('review.language.translate', 'pptx.review.translate', 'Translate', 'languages', {
				disabled: true,
			}),
			command('review.language.language', 'pptx.review.language', 'Language', 'globe', {
				disabled: !state.canLanguage,
				hidden: state.languageHidden,
			}),
		]),
		group('review.compare', 'pptx.review.changes', 'Changes', [
			command('review.compare.markAllRead', 'pptx.review.markAllRead', 'Mark All as Read', 'copy', {
				disabled: true,
			}),
			command('review.compare.compare', 'pptx.ribbon.compare', 'Compare', 'compare', {
				disabled: !state.editable || !state.canCompare,
				hidden: !state.canCompare,
				title: label('pptx.ribbon.compareTitle', 'Compare presentations'),
			}),
		]),
		group('review.comments', 'pptx.toolbar.comments', 'Comments', [
			command(
				'review.comments.newComment',
				'pptx.review.newComment',
				'New Comment',
				'messagePlus',
				{
					disabled: !state.canComments,
					active: state.commentsOpen,
					expanded: state.commentsOpen,
					badge: state.commentCount,
					title: label('pptx.review.toggleComments', 'Toggle comments'),
				},
			),
			command('review.comments.delete', 'pptx.common.delete', 'Delete', 'trash', {
				disabled: true,
			}),
			command('review.comments.previous', 'pptx.common.previous', 'Previous', 'chevronLeft', {
				disabled: true,
			}),
			command('review.comments.next', 'pptx.common.next', 'Next', 'chevronRight', {
				disabled: true,
			}),
			command(
				'review.comments.showComments',
				'pptx.review.showComments',
				'Show Comments',
				'message',
				{
					disabled: !state.canComments,
					active: state.commentsOpen,
					expanded: state.commentsOpen,
				},
			),
		]),
		group('review.protect', 'pptx.review.protect', 'Protect', [
			command('review.protect.readOnly', 'pptx.review.readOnly', 'Always Open Read-only', 'lock', {
				disabled: true,
			}),
			command(
				'review.protect.restrictPermission',
				'pptx.review.restrictPermission',
				'Restrict Permission',
				'shield',
				{ disabled: true },
			),
		]),
		group('review.ink', 'pptx.review.ink', 'Ink', [
			command('review.ink.hideInk', 'pptx.review.hideInk', 'Hide Ink', 'eyeOff', {
				disabled: true,
			}),
		]),
	];
}
