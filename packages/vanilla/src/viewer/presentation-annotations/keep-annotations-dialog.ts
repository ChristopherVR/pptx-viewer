import type { Translator } from '../i18n';

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
		const discard = doc.createElement('button');
		discard.type = 'button';
		discard.textContent = t('pptx.keepAnnotations.discard');
		const keep = doc.createElement('button');
		keep.type = 'button';
		keep.className = 'is-primary';
		keep.textContent = t('pptx.keepAnnotations.keep');
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
		discard.addEventListener('click', () => finish('discard'));
		keep.addEventListener('click', () => finish('keep'));
		doc.addEventListener('keydown', onKeyDown);
		footer.append(discard, keep);
		dialog.append(title, body, footer);
		backdrop.append(dialog);
		doc.body.append(backdrop);
		queueMicrotask(() => keep.focus());
	});
}
