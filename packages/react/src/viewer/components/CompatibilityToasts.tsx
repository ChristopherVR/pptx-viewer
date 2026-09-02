import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import { compatToastStackStyle } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

/**
 * CompatibilityToasts: load-diagnostic toast stack for
 * `getCompatibilityWarnings()`-shaped warnings (deck + slide), computed via
 * the shared `compatibilityWarningToasts`. These do not auto-hide (they are
 * diagnostics, not transient notifications) and are cleared wholesale on the
 * next load.
 *
 * Position comes from the shared `compatToastStackStyle()` (right/bottom
 * inset, width, z-index, `pointer-events: none` on the stack itself so it
 * never blocks clicks through its empty margins). The caller positions this
 * against the viewer ROOT, not the measured toolbar/canvas container: the
 * container's own bottom edge sits behind the status bar, so a toast rooted
 * there covered the "Slide show" button.
 */
export interface CompatibilityToastsProps {
	toasts: CompatibilityWarningToast[];
	onDismiss: (id: string) => void;
	onDismissAll: () => void;
}

export function CompatibilityToasts({ toasts, onDismiss, onDismissAll }: CompatibilityToastsProps) {
	const { t } = useTranslation();

	if (toasts.length === 0) {
		return null;
	}

	return (
		<div
			data-testid='pptx-compat-toasts'
			className='max-h-[60%] overflow-y-auto'
			style={compatToastStackStyle()}
		>
			<div className='flex items-center justify-between px-1' style={{ pointerEvents: 'auto' }}>
				<span className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
					{t('pptx.compatibility.toastTitle')}
				</span>
				<button
					type='button'
					data-testid='pptx-compat-toasts-dismiss-all'
					onClick={onDismissAll}
					className='text-[11px] text-muted-foreground underline-offset-2 hover:underline'
				>
					{t('pptx.compatibility.dismissAll')}
				</button>
			</div>
			{toasts.map((toast) => (
				<div
					key={toast.id}
					data-testid='pptx-compat-toast'
					data-code={toast.code}
					data-severity={toast.severity}
					className='flex items-start gap-2 rounded border border-border bg-card p-2 text-[11px] shadow-md'
					style={{ pointerEvents: 'auto' }}
				>
					<span className='flex-1 min-w-0'>{t(toast.messageKey, toast.params)}</span>
					<button
						type='button'
						data-testid='pptx-compat-toast-dismiss'
						onClick={() => onDismiss(toast.id)}
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
