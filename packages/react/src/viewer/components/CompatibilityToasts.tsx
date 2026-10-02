import type {
	CompatibilityWarningToast,
	CompatToastsIntent,
	PptxUiCompatToastsElement,
} from 'pptx-viewer-shared';
import { useTranslation } from 'react-i18next';

import { useWebControl } from '../hooks/useWebControl';

/**
 * CompatibilityToasts: load-diagnostic toast stack for
 * `getCompatibilityWarnings()`-shaped warnings (deck + slide), computed via
 * the shared `compatibilityWarningToasts`. These do not auto-hide (they are
 * diagnostics, not transient notifications) and are cleared wholesale on the
 * next load.
 *
 * A thin adapter around the shared `pptx-ui-compat-toasts`: the element renders
 * the stack and positions itself from the shared `compatToastStackStyle()`
 * (right/bottom inset, width, z-index, `pointer-events: none` on the stack so
 * it never blocks clicks through its empty margins). The caller positions this
 * against the viewer ROOT, not the measured toolbar/canvas container: the
 * container's own bottom edge sits behind the status bar, so a toast rooted
 * there covered the "Slide show" button.
 *
 * `rightInset` (default 0) is the width of whatever right-docked panel
 * (format/inspector or AI chat) is currently open: the viewer ROOT spans the
 * FULL chrome width including that panel, so without this the stack's
 * `right: 12px` lands under the panel's own content instead of clear of it
 * (it rendered on top of, and visually inside, the Properties panel).
 */
export interface CompatibilityToastsProps {
	toasts: CompatibilityWarningToast[];
	onDismiss: (id: string) => void;
	onDismissAll: () => void;
	rightInset?: number;
	/** Height of the docked notes strip; see {@link compatToastStackStyle}'s `extraBottomInset`. */
	bottomInset?: number;
}

export function CompatibilityToasts({
	toasts,
	onDismiss,
	onDismissAll,
	rightInset = 0,
	bottomInset = 0,
}: CompatibilityToastsProps) {
	const { t } = useTranslation();
	const ref = useWebControl<PptxUiCompatToastsElement>(
		{ toasts, rightInset, bottomInset, translate: t },
		{
			'compat-toasts-request': (event) => {
				const intent = event.detail as CompatToastsIntent;
				if (intent.id === 'dismissAll') {
					onDismissAll();
				} else {
					onDismiss(intent.toastId);
				}
			},
		},
	);
	if (toasts.length === 0) {
		return null;
	}
	return <pptx-ui-compat-toasts ref={ref} />;
}
