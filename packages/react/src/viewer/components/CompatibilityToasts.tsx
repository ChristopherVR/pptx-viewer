import type { CompatibilityWarningToast } from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

/**
 * CompatibilityToasts: load-diagnostic toast stack for
 * `getCompatibilityWarnings()`-shaped warnings (deck + slide), computed via
 * the shared `compatibilityWarningToasts`. These do not auto-hide (they are
 * diagnostics, not transient notifications) and are cleared wholesale on the
 * next load.
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
			className='absolute bottom-3 right-3 z-50 flex max-h-[60%] w-80 flex-col gap-2 overflow-y-auto'
		>
			<div className='flex items-center justify-between px-1'>
				<span className='text-[11px] font-medium uppercase tracking-wide text-muted-foreground'>
					{t('pptx.compatibility.toastTitle')}
				</span>
				{toasts.length > 1 && (
					<button
						type='button'
						data-testid='pptx-compat-toasts-dismiss-all'
						onClick={onDismissAll}
						className='text-[11px] text-muted-foreground underline-offset-2 hover:underline'
					>
						{t('pptx.compatibility.dismissAll')}
					</button>
				)}
			</div>
			{toasts.map((toast) => (
				<div
					key={toast.id}
					data-testid='pptx-compat-toast'
					data-code={toast.code}
					data-severity={toast.severity}
					className='flex items-start gap-2 rounded border border-border bg-card p-2 text-[11px] shadow-md'
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
