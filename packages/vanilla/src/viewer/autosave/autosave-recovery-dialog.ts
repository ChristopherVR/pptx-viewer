import type { AutosaveRecoveryPrompt } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { appendDialogFooter } from '../ui/dialog-footer';

/**
 * The crash-recovery prompt.
 *
 * Until now the vanilla viewer only forwarded a found snapshot to the host's
 * `onAutosaveRecovery` callback, so an embedder that wired nothing had INVISIBLE
 * crash recovery: the data was in IndexedDB and the user was never asked. This
 * renders the shared `AutosaveRecoveryPrompt` descriptor (see
 * `pptx-viewer-shared/render/autosave-recovery`), which every binding now shows,
 * so the wording, the age text and the two choices are identical everywhere.
 *
 * DOM/class conventions follow `presentation-annotations/keep-annotations-dialog`
 * (the `pptxv-parity-*` dialog shell).
 */
export type AutosaveRecoveryChoice = 'restore' | 'discard' | 'dismiss';

/**
 * Open the prompt; resolves with the user's choice.
 *
 * Escape resolves `'dismiss'`, NOT `'discard'`: discarding deletes the snapshot,
 * and dismissing a dialog must never be a destructive answer. The snapshot then
 * stays on disk and is simply not offered again in this tab.
 */
export function openAutosaveRecoveryDialog(
	doc: Document,
	t: Translator,
	prompt: AutosaveRecoveryPrompt,
	onDiscard?: () => Promise<void>,
): Promise<AutosaveRecoveryChoice> {
	return new Promise((resolve) => {
		let busy = false;
		let settled = false;
		const title = t(prompt.titleKey);
		const backdrop = doc.createElement('div');
		backdrop.className = 'pptxv-parity-backdrop pptxv-autosave-recovery';
		const dialog = doc.createElement('section');
		dialog.className = 'pptxv-parity-dialog';
		dialog.setAttribute('role', 'dialog');
		dialog.setAttribute('aria-modal', 'true');
		dialog.setAttribute('aria-label', title);
		// Neutral cross-binding e2e contract (the five bindings all mark the
		// prompt with this attribute, whatever their own class names are).
		dialog.setAttribute('data-pptx-autosave-recovery', 'true');

		const header = doc.createElement('header');
		header.className = 'pptxv-parity-header';
		const heading = doc.createElement('h2');
		heading.textContent = title;
		header.append(heading);

		const body = doc.createElement('div');
		body.className = 'pptxv-parity-body';
		const message = doc.createElement('p');
		message.className = 'pptxv-autosave-recovery-message';
		message.textContent = t(prompt.messageKey, prompt.messageParams);
		const age = doc.createElement('p');
		age.className = 'pptxv-autosave-recovery-age';
		age.textContent = t('pptx.autosave.recovery.savedLabel', {
			when: t(prompt.ageKey, prompt.ageParams),
		});
		body.append(message, age);

		const footer = doc.createElement('footer');
		footer.className = 'pptxv-parity-footer';
		const footerActions = (disabled: boolean) => [
			{ id: 'discard', label: t(prompt.discardKey), disabled },
			{ id: 'restore', label: t(prompt.restoreKey), variant: 'primary' as const, disabled },
		];

		const finish = (choice: AutosaveRecoveryChoice): void => {
			if (settled) {
				return;
			}
			settled = true;
			doc.removeEventListener('keydown', onKeyDown);
			backdrop.remove();
			resolve(choice);
		};
		const onKeyDown = (event: KeyboardEvent): void => {
			if (event.key === 'Escape' && !busy) {
				finish('dismiss');
			}
		};
		const discardSnapshot = (): void => {
			if (busy) {
				return;
			}
			busy = true;
			dialog.setAttribute('aria-busy', 'true');
			actions.state = { actions: footerActions(true) };
			void (async () => {
				try {
					await onDiscard?.();
					finish('discard');
				} catch {
					busy = false;
					dialog.removeAttribute('aria-busy');
					actions.state = { actions: footerActions(false) };
				}
			})();
		};
		const actions = appendDialogFooter(doc, footer, footerActions(false), (id) => {
			if (id === 'restore') {
				if (!busy) {
					finish('restore');
				}
			} else {
				discardSnapshot();
			}
		});
		doc.addEventListener('keydown', onKeyDown);

		dialog.append(header, body, footer);
		backdrop.append(dialog);
		doc.body.append(backdrop);
		queueMicrotask(() => actions.focusAction('restore'));
	});
}
