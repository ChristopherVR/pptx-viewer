import type { RunProgramNotice } from 'pptx-viewer-shared';
import { canUseClipboard, runProgramNoticeStackStyle } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

/**
 * RunProgramNotices: the toast stack shown during a running show for
 * `ppaction://program` ("Run program") clicks. A browser cannot launch a
 * local executable, so this names the exact command PowerPoint would have
 * run and offers a Copy button, non-blocking (no `window.confirm`/`alert`).
 *
 * Mirrors `CompatibilityToasts`' card markup and per-toast `pointer-events`
 * scoping (so the empty stack never blocks clicks through to the show
 * beneath it), but is positioned by the shared `runProgramNoticeStackStyle()`
 * rather than `compatToastStackStyle()`: the latter anchors above the editing
 * chrome's status bar and sat UNDER the show stage, which intercepted every
 * click on the Copy button (caught by `e2e/run-program-notice.spec.ts`).
 */
export interface RunProgramNoticesProps {
	notices: RunProgramNotice[];
	onDismiss: (id: string) => void;
}

export function RunProgramNotices({ notices, onDismiss }: RunProgramNoticesProps) {
	const { t } = useTranslation();

	if (notices.length === 0) {
		return null;
	}

	const clipboardAvailable = canUseClipboard(
		typeof navigator === 'undefined' ? undefined : navigator,
	);

	return (
		<div
			data-testid='pptx-run-program-notices'
			className='max-h-[60%] overflow-y-auto'
			style={runProgramNoticeStackStyle()}
		>
			{notices.map((notice) => (
				<div
					key={notice.id}
					data-testid='pptx-run-program-notice'
					data-target={notice.target}
					className='flex items-start gap-2 rounded border border-border bg-card p-2 text-[11px] shadow-md'
					style={{ pointerEvents: 'auto' }}
				>
					<span className='flex-1 min-w-0'>{t(notice.messageKey, { target: notice.target })}</span>
					{clipboardAvailable && (
						<button
							type='button'
							data-testid='pptx-run-program-notice-copy'
							onClick={() => {
								void navigator.clipboard.writeText(notice.target);
							}}
							className='shrink-0 text-muted-foreground underline-offset-2 hover:underline hover:text-foreground'
						>
							{t(notice.copyLabelKey)}
						</button>
					)}
					<button
						type='button'
						data-testid='pptx-run-program-notice-dismiss'
						onClick={() => onDismiss(notice.id)}
						aria-label={t('pptx.compatibility.dismiss')}
						className='shrink-0 text-muted-foreground hover:text-foreground'
					>
						×
					</button>
				</div>
			))}
		</div>
	);
}
