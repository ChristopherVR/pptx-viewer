/**
 * A subtle, non-technical "activity" row describing one thing the assistant did,
 * e.g. "Looked at slide 5" / "Merged two tables", with a friendly icon and a
 * Working / Done / Failed status. The raw tool name + argument summary is hidden
 * behind a collapsed `<details>` disclosure for power users, and no element ids
 * are ever shown by default. Vanilla counterpart of React's `AiToolCallCard`,
 * built on the shared {@link describeToolActivity} / {@link summarizeToolArgs}.
 */

import type { RenderableToolPart, ToolActivityIcon } from 'pptx-viewer-shared/ai';
import { describeToolActivity, summarizeToolArgs, toolLabel } from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import type { IconName } from '../ui/icons';
import { createIcon } from '../ui/icons';

/** Map a shared icon category to a concrete vanilla glyph. */
const ICONS: Record<ToolActivityIcon, IconName> = {
	view: 'eye',
	text: 'text-box',
	shape: 'shapes',
	theme: 'font-color',
	table: 'table',
	slide: 'layout',
	chart: 'chart',
	move: 'move-right',
	delete: 'trash',
	search: 'search',
	nav: 'move-right',
	animation: 'play',
	notes: 'sticky-note',
	tool: 'wrench',
};

/** Build one friendly tool-activity card for a rendered tool part. */
export function renderToolCard(
	doc: Document,
	part: RenderableToolPart,
	t: Translator,
): HTMLElement {
	const failed = part.state === 'output-error';
	const done = part.state === 'output-available';
	const running = !failed && !done;

	const activity = describeToolActivity(part.toolName, part.input, running ? 'present' : 'past');
	const card = createEl(doc, 'div', 'pptxv-ai-tool');

	const head = createEl(doc, 'div', 'pptxv-ai-tool-head');
	const icon = createIcon(doc, ICONS[activity.icon] ?? 'wrench');
	icon.classList.add('pptxv-ai-tool-icon');
	const label = createEl(doc, 'span', 'pptxv-ai-tool-name');
	label.textContent = activity.label;

	const status = createEl(doc, 'span', 'pptxv-ai-tool-state');
	if (failed) {
		status.classList.add('is-error');
		status.append(createIcon(doc, 'alert'), doc.createTextNode(t('pptx.ai.toolFailed')));
	} else if (done) {
		status.classList.add('is-done');
		status.append(createIcon(doc, 'check'), doc.createTextNode(t('pptx.ai.toolDone')));
	} else {
		status.classList.add('is-running');
		status.textContent = t('pptx.ai.toolRunning');
	}
	head.append(icon, label, status);
	card.appendChild(head);

	if (failed && part.errorText) {
		const err = createEl(doc, 'div', 'pptxv-ai-tool-error');
		err.textContent = part.errorText;
		card.appendChild(err);
	}

	// Raw name + argument summary is opt-in, never element ids and never shown by
	// default: it lives behind a collapsed disclosure for power users only.
	const rawSummary = summarizeToolArgs(part.input);
	if (rawSummary) {
		const details = createEl(doc, 'details', 'pptxv-ai-tool-details');
		const summary = createEl(doc, 'summary');
		summary.textContent = t('pptx.ai.toolDetails');
		const body = createEl(doc, 'div', 'pptxv-ai-tool-raw');
		body.textContent = `${toolLabel(part.toolName)}: ${rawSummary}`;
		details.append(summary, body);
		card.appendChild(details);
	}

	return card;
}
