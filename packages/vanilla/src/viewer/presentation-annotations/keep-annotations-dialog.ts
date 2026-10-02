import type { Translator } from '../i18n';
import { appendDialogFooter } from '../ui/dialog-footer';

export type KeepAnnotationsChoice = 'keep' | 'discard';

/** Open the exit prompt used when a slide show contains temporary ink. */
export function promptKeepAnnotations(
	doc: Document,
	t: Translator,
	annotationCount: number,
	slideCount: number,
): Promise<KeepAnnotationsChoice> {
	return new Promise((resolve) => {
		const backdrop = doc.createElement('div');
		backdrop.className = 'pptxv-parity-backdrop pptxv-keep-annotations';
		const dialog = doc.createElement('section');
		dialog.className = 'pptxv-parity-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		const title = doc.createElement('h2');
		title.textContent = t('pptx.keepAnnotations.title');
		const body = doc.createElement('div');
		body.className = 'pptxv-parity-body';
		body.textContent = t('pptx.keepAnnotations.description', {
			count: annotationCount,
			slides: slideCount,
		});
		const footer = doc.createElement('footer');
		footer.className = 'pptxv-parity-footer';
		const finish = (choice: KeepAnnotationsChoice): void => {
			doc.removeEventListener('keydown', onKeyDown);
			backdrop.remove();
			resolve(choice);
		};
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape') {
				finish('discard');
			}
		};
		doc.addEventListener('keydown', onKeyDown);
		const actions = appendDialogFooter(
			doc,
			footer,
			[
				{ id: 'discard', label: t('pptx.keepAnnotations.discard') },
				{ id: 'keep', label: t('pptx.keepAnnotations.keep'), variant: 'primary' },
			],
			(id) => finish(id === 'keep' ? 'keep' : 'discard'),
		);
		dialog.append(title, body, footer);
		backdrop.append(dialog);
		doc.body.append(backdrop);
		queueMicrotask(() => actions.focusAction('keep'));
	});
}
