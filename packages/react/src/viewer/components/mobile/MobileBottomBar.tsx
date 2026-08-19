import type { ActionDescriptor } from 'pptx-viewer-shared';
import { buildBarActions } from 'pptx-viewer-shared';
import React from 'react';
import { useTranslation } from 'react-i18next';
import { LuLayers, LuMessageSquare, LuPlus, LuSettings2, LuStickyNote } from 'react-icons/lu';

import { cn } from '../../utils';

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

type ActionKey = NonNullable<MobileBottomBarProps['activeSheet']>;

interface Action {
	key: ActionKey;
	label: string;
	icon: React.ComponentType<{ className?: string }>;
	onClick: () => void;
	disabled: boolean;
	badge?: number;
}

function isActionKey(key: ActionDescriptor['key']): key is ActionKey {
	return (
		key === 'slides' ||
		key === 'insert' ||
		key === 'inspector' ||
		key === 'comments' ||
		key === 'notes'
	);
}

const LABEL_BY_KEY: Record<ActionKey, string> = {
		slides: 'pptx.sections.slides',
		insert: 'pptx.mobileBar.insert',
		inspector: 'pptx.field.format',
		comments: 'pptx.toolbar.comments',
		notes: 'pptx.notes.title',
	},
	ICON_BY_KEY: Record<ActionKey, React.ComponentType<{ className?: string }>> = {
		slides: LuLayers,
		insert: LuPlus,
		inspector: LuSettings2,
		comments: LuMessageSquare,
		notes: LuStickyNote,
	};

/**
 * Persistent mobile bottom action bar: five primary navigation targets that
 * each open a bottom sheet (slides / inspector / comments / notes) or trigger
 * an action (insert). Mirrors the navigation pattern of Office Mobile and
 * Google Slides on small screens.
 */
export function MobileBottomBar({
	slideCount,
	onOpenSlides,
	onOpenInsert,
	onOpenInspector,
	onOpenComments,
	onToggleNotes,
	activeSheet,
	commentCount,
}: MobileBottomBarProps): React.ReactElement {
	// Shared `buildBarActions` decides which slots are disabled (no slides
	// loaded); this binding only maps the resulting descriptor onto its own
	// icons, labels and click handlers.
	const { t } = useTranslation(),
		onClickByKey: Record<ActionKey, () => void> = {
			slides: onOpenSlides,
			insert: onOpenInsert,
			inspector: onOpenInspector,
			comments: onOpenComments,
			notes: onToggleNotes,
		},
		actions: Action[] = buildBarActions({ slideCount })
			.filter((descriptor) => isActionKey(descriptor.key))
			.map((descriptor) => {
				const key = descriptor.key as ActionKey;
				return {
					key,
					label: LABEL_BY_KEY[key],
					icon: ICON_BY_KEY[key],
					onClick: onClickByKey[key],
					disabled: descriptor.disabled,
					badge: key === 'comments' ? commentCount : undefined,
				};
			});

	return (
		<nav
			aria-label={t('pptx.mobileBar.ariaLabel')}
			// Visibility is owned by the parent (rendered only when `isMobile`), so
			// no width-based `md:hidden` here; that would wrongly hide the bar on a
			// wide-but-short landscape phone, which is still mobile.
			className='flex items-stretch justify-around border-t border-border bg-secondary/80 backdrop-blur supports-[backdrop-filter]:bg-secondary/60 pb-[max(env(safe-area-inset-bottom),0px)]'
		>
			{actions.map(({ key, label, icon: Icon, onClick, disabled, badge }) => {
				const active = activeSheet === key;
				return (
					<button
						key={key}
						type='button'
						onClick={onClick}
						disabled={disabled}
						className={cn(
							'relative flex flex-col items-center justify-center gap-0.5 flex-1 min-h-[56px] py-1.5 text-[10px] font-medium transition-colors active:scale-95 disabled:opacity-40 disabled:pointer-events-none',
							active ? 'text-primary' : 'text-muted-foreground hover:text-foreground',
						)}
						aria-pressed={active}
						aria-label={key === 'notes' ? t('pptx.statusBar.toggleNotes') : undefined}
					>
						<Icon className='w-5 h-5' />
						<span>{t(label)}</span>
						{badge !== undefined && badge > 0 && (
							<span className='absolute top-1 right-1/4 flex items-center justify-center min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-semibold text-white'>
								{badge > 99 ? '99+' : badge}
							</span>
						)}
						{active && (
							<span className='absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-full bg-primary' />
						)}
					</button>
				);
			})}
		</nav>
	);
}
