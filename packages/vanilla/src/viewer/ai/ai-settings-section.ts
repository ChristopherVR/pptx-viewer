/**
 * File > Options > AI: a technical section that exports the full chat history,
 * including every tool call's input/output, as a downloadable JSON or Markdown
 * log for debugging. Built into the vanilla settings dialog only when the host
 * enables the `ai` option. Vanilla counterpart of React's `SettingsAiTab`.
 */
import { downloadBlob } from 'pptx-viewer-shared';
import type { AiLogFormat, PptxAiChatStore, SaveChatLogFile } from 'pptx-viewer-shared/ai';
import {
	collectStoredChats,
	createChatHistoryStore,
	exportAiChatLogs,
} from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from '../ui/icons';

/** {@link SaveChatLogFile} implementation: wraps the body in a `Blob` and downloads it. */
const saveChatLogFile: SaveChatLogFile = (filename, content, mime) => {
	downloadBlob(new Blob([content], { type: mime }), filename);
};

export interface AiSettingsSectionDeps {
	doc: Document;
	t: Translator;
	/** Chat store to read from. Defaults to the shared `createChatHistoryStore()`. */
	store?: PptxAiChatStore;
}

/** Build the AI export section element (self-contained; loads its count async). */
export function createAiSettingsSection(deps: AiSettingsSectionDeps): HTMLElement {
	const { doc, t } = deps;
	const store = deps.store ?? createChatHistoryStore();
	const section = createEl(doc, 'section', 'pptxv-ai-settings');

	const intro = createEl(doc, 'div', 'pptxv-ai-settings-intro');
	const introText = createEl(doc, 'div');
	const introTitle = createEl(doc, 'p');
	introTitle.textContent = t('pptx.ai.settingsSectionTitle');
	const introHint = createEl(doc, 'p', 'pptxv-ai-settings-count');
	introHint.textContent = t('pptx.ai.exportLogsHint');
	introText.append(introTitle, introHint);
	intro.append(createIcon(doc, 'bug'), introText);

	const count = createEl(doc, 'p', 'pptxv-ai-settings-count');
	count.textContent = t('pptx.ai.exportLogsCounting');

	const detailedLabel = createEl(doc, 'label', 'pptxv-ai-settings-detailed');
	const detailed = createEl(doc, 'input');
	detailed.type = 'checkbox';
	detailed.checked = true;
	detailedLabel.append(detailed, doc.createTextNode(t('pptx.ai.exportLogsDetailed')));

	const actions = createEl(doc, 'div', 'pptxv-ai-settings-actions');
	const status = createEl(doc, 'p', 'pptxv-ai-settings-status');
	status.setAttribute('role', 'status');
	status.hidden = true;

	const exportButton = (labelKey: string, format: AiLogFormat): HTMLButtonElement => {
		const btn = createEl(doc, 'button', 'pptxv-ai-settings-btn');
		btn.type = 'button';
		btn.append(createIcon(doc, 'download'), doc.createTextNode(t(labelKey)));
		btn.addEventListener('click', () => {
			void runExport(format, btn);
		});
		return btn;
	};

	const runExport = async (format: AiLogFormat, btn: HTMLButtonElement): Promise<void> => {
		const buttons = actions.querySelectorAll('button');
		for (const b of buttons) {
			b.disabled = true;
		}
		try {
			const chats = await collectStoredChats(store);
			const exported = exportAiChatLogs(
				chats,
				{ format, detailed: detailed.checked },
				saveChatLogFile,
			);
			status.hidden = false;
			status.textContent =
				exported > 0
					? t('pptx.ai.exportLogsDone', { count: exported })
					: t('pptx.ai.noChatsToExport');
		} finally {
			for (const b of buttons) {
				b.disabled = false;
			}
			void btn;
		}
	};

	actions.append(
		exportButton('pptx.ai.exportLogsJson', 'json'),
		exportButton('pptx.ai.exportLogsMarkdown', 'markdown'),
	);
	section.append(intro, count, detailedLabel, actions, status);

	// Load the stored-chat count without blocking the dialog open.
	void (async (): Promise<void> => {
		let total = 0;
		try {
			total = (await store.listChats()).length;
		} catch {
			total = 0;
		}
		count.textContent = t('pptx.ai.exportLogsStoredCount', { count: total });
	})();

	return section;
}
