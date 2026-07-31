import {
	deleteAutosaveSnapshot,
	formatBackstageSize,
	formatRelativeTime,
	formatVersionTimestamp,
	getAutosaveSnapshot,
} from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface VersionHistoryOptions {
	filePath: string;
	onRestore(data: Uint8Array): void | Promise<void>;
}

/** Mount the React-compatible recovery panel against the viewer edge. */
export function openVersionHistoryPanel(
	doc: Document,
	mount: HTMLElement,
	t: Translator,
	options: VersionHistoryOptions,
): HTMLElement {
	mount.querySelector('.pptxv-version-history')?.remove();
	const panel = createEl(doc, 'aside', 'pptxv-version-history');
	panel.setAttribute('aria-label', t('pptx.versionHistory.title'));
	const header = createEl(doc, 'header');
	const icon = createEl(doc, 'span');
	icon.textContent = '◷';
	const title = createEl(doc, 'h2');
	title.textContent = t('pptx.versionHistory.title');
	const close = createEl(doc, 'button');
	close.type = 'button';
	close.textContent = '×';
	close.setAttribute('aria-label', t('pptx.common.close'));
	close.addEventListener('click', () => panel.remove());
	header.append(icon, title, close);
	const content = createEl(doc, 'div', 'pptxv-version-content');
	content.textContent = t('pptx.common.loading');
	panel.append(header, content);
	mount.appendChild(panel);

	void getAutosaveSnapshot(options.filePath)
		.then((version) => {
			content.replaceChildren();
			if (!version) {
				const empty = createEl(doc, 'p', 'pptxv-version-empty');
				empty.textContent = t('pptx.versionHistory.noVersions');
				content.appendChild(empty);
				return undefined;
			}
			const card = createEl(doc, 'article');
			const timestamp = createEl(doc, 'strong');
			timestamp.textContent = formatVersionTimestamp(version.timestamp);
			const relative = createEl(doc, 'small');
			relative.textContent = formatRelativeTime(version.timestamp);
			const size = createEl(doc, 'p');
			size.textContent = formatBackstageSize(version.size);
			const actions = createEl(doc, 'footer');
			const restore = createEl(doc, 'button', 'is-primary');
			restore.type = 'button';
			restore.textContent = t('pptx.versionHistory.restore');
			restore.addEventListener('click', () => {
				void Promise.resolve(options.onRestore(version.data)).then(() => panel.remove());
			});
			const remove = createEl(doc, 'button', 'is-danger');
			remove.type = 'button';
			remove.textContent = t('pptx.common.delete');
			remove.addEventListener('click', () => {
				void deleteAutosaveSnapshot(version.key).then(() => card.remove());
			});
			actions.append(restore, remove);
			card.append(timestamp, relative, size, actions);
			content.appendChild(card);
			return undefined;
		})
		.catch(() => {
			content.replaceChildren();
			const empty = createEl(doc, 'p', 'pptxv-version-empty');
			empty.textContent = t('pptx.versionHistory.noVersions');
			content.appendChild(empty);
			return undefined;
		});
	return panel;
}
