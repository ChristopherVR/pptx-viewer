import React from 'react';
import { useTranslation } from 'react-i18next';
import {
	LuBookOpen,
	LuChevronLeft,
	LuChevronRight,
	LuCopy,
	LuEyeOff,
	LuGitCompare,
	LuGlobe,
	LuLanguages,
	LuLockKeyhole,
	LuMessageSquare,
	LuMessageSquarePlus,
	LuShieldCheck,
	LuSpellCheck,
	LuTrash2,
} from 'react-icons/lu';

import { RibbonCommand, RibbonCommandStack, RibbonGroup } from './PowerPointRibbonControls';

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
	return (
		<>
			<RibbonGroup label={t('pptx.review.proofing', { defaultValue: 'Proofing' })}>
				<RibbonCommand
					label={t('pptx.review.spelling')}
					icon={<LuSpellCheck />}
					onClick={() => p.onSetSpellCheckEnabled(!p.spellCheckEnabled)}
					active={p.spellCheckEnabled}
					title='Toggle spell check'
				/>
				<RibbonCommand
					label={t('pptx.review.thesaurus', { defaultValue: 'Thesaurus' })}
					icon={<LuBookOpen />}
					disabled
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.review.accessibility', { defaultValue: 'Accessibility' })}>
				<RibbonCommand
					label={t('pptx.review.accessibilityCheck')}
					icon={<LuShieldCheck />}
					onClick={p.onOpenAccessibilityCheck}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.review.language')}>
				<RibbonCommand
					label={t('pptx.review.translate', { defaultValue: 'Translate' })}
					icon={<LuLanguages />}
					disabled
				/>
				<RibbonCommand
					label={t('pptx.review.language')}
					icon={<LuGlobe />}
					onClick={p.onSetLanguage}
				/>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.review.changes', { defaultValue: 'Changes' })}>
				<RibbonCommand
					label={t('pptx.review.markAllRead', { defaultValue: 'Mark All as Read' })}
					icon={<LuCopy />}
					disabled
				/>
				{p.onCompare && (
					<RibbonCommand
						label={t('pptx.ribbon.compare')}
						icon={<LuGitCompare />}
						onClick={p.onCompare}
						disabled={!p.canEdit}
						title='Compare with another presentation'
					/>
				)}
			</RibbonGroup>
			<RibbonGroup label={t('pptx.toolbar.comments')}>
				{p.onToggleComments && (
					<div className='relative'>
						<RibbonCommand
							label={t('pptx.toolbar.comments')}
							icon={<LuMessageSquarePlus />}
							onClick={p.onToggleComments}
							active={p.isCommentsPanelOpen}
							title='Toggle comments panel'
						/>
						{Boolean(p.slideCommentCount) && (
							<span className='absolute right-0 top-0 rounded-full bg-primary px-1 text-[9px] text-white'>
								{p.slideCommentCount}
							</span>
						)}
					</div>
				)}
				<RibbonCommandStack>
					<RibbonCommand
						compact
						label={t('pptx.common.delete', { defaultValue: 'Delete' })}
						icon={<LuTrash2 />}
						disabled
					/>
					<RibbonCommand
						compact
						label={t('pptx.common.previous', { defaultValue: 'Previous' })}
						icon={<LuChevronLeft />}
						disabled
					/>
				</RibbonCommandStack>
				<RibbonCommandStack>
					<RibbonCommand
						compact
						label={t('pptx.common.next', { defaultValue: 'Next' })}
						icon={<LuChevronRight />}
						disabled
					/>
					<RibbonCommand
						compact
						label={t('pptx.review.showComments', { defaultValue: 'Show Comments' })}
						icon={<LuMessageSquare />}
						onClick={p.onToggleComments}
					/>
				</RibbonCommandStack>
			</RibbonGroup>
			<RibbonGroup label={t('pptx.review.protect', { defaultValue: 'Protect' })}>
				<RibbonCommand
					label={t('pptx.review.readOnly', { defaultValue: 'Always Open Read-only' })}
					icon={<LuLockKeyhole />}
					disabled
				/>
				<RibbonCommand
					label={t('pptx.review.restrictPermission', { defaultValue: 'Restrict Permission' })}
					icon={<LuShieldCheck />}
					disabled
				/>
				<RibbonCommand
					label={t('pptx.review.hideInk', { defaultValue: 'Hide Ink' })}
					icon={<LuEyeOff />}
					disabled
				/>
			</RibbonGroup>
		</>
	);
}
