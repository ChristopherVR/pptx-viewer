import type { AccessibilityIssue } from 'pptx-viewer-core';
import type { AccessibilityIssueGroup } from 'pptx-viewer-shared';
import { groupIssuesBySeverity, issueTrackKey, issueTypeLabel } from 'pptx-viewer-shared';

import type { Translator } from '../i18n';
import { createEl } from '../render';

export interface AccessibilityPanel {
	el: HTMLElement;
	open(issues: readonly AccessibilityIssue[]): void;
	close(): void;
}

/**
 * A keyboard-accessible, live accessibility checker result panel. It is kept
 * separate from the element inspector so it remains useful in read-only mode,
 * while the View ribbon is its discoverable entry point.
 */
export function createAccessibilityPanel(
	doc: Document,
	t: Translator,
	onSelectSlide: (index: number) => void,
): AccessibilityPanel {
	const el = createEl(doc, 'section', 'pptxv-accessibility-panel');
	el.hidden = true;
	el.setAttribute('role', 'dialog');
	el.setAttribute('aria-modal', 'false');
	el.setAttribute('aria-label', t('pptx.accessibility.title'));

	const header = createEl(doc, 'div', 'pptxv-accessibility-header');
	const title = createEl(doc, 'h2', 'pptxv-accessibility-title');
	title.textContent = t('pptx.accessibility.title');
	const closeButton = createEl(doc, 'button', 'pptxv-accessibility-close') as HTMLButtonElement;
	closeButton.type = 'button';
	closeButton.textContent = t('pptx.accessibility.close');
	closeButton.setAttribute('aria-label', t('pptx.accessibility.closePanel'));
	header.append(title, closeButton);
	el.appendChild(header);

	const summary = createEl(doc, 'p', 'pptxv-accessibility-summary');
	el.appendChild(summary);
	const list = createEl(doc, 'div', 'pptxv-accessibility-list');
	list.setAttribute('role', 'list');
	list.setAttribute('aria-label', t('pptx.accessibility.issuesList'));
	el.appendChild(list);

	const close = (): void => {
		el.hidden = true;
	};
	closeButton.addEventListener('click', close);

	const renderGroup = (group: AccessibilityIssueGroup): void => {
		const groupEl = createEl(doc, 'section', `pptxv-accessibility-group is-${group.severity}`);
		const heading = createEl(doc, 'h3', 'pptxv-accessibility-group-title');
		heading.textContent = `${group.label} (${group.issues.length})`;
		groupEl.appendChild(heading);
		for (const [index, issue] of group.issues.entries()) {
			const item = createEl(doc, 'button', 'pptxv-accessibility-issue') as HTMLButtonElement;
			item.type = 'button';
			item.setAttribute('role', 'listitem');
			item.dataset.issueKey = issueTrackKey(issue, index);
			const type = createEl(doc, 'strong', 'pptxv-accessibility-issue-type');
			type.textContent = issueTypeLabel(issue.type, (key) => t(key));
			const message = createEl(doc, 'span', 'pptxv-accessibility-issue-message');
			message.textContent = issue.message;
			const slide = createEl(doc, 'span', 'pptxv-accessibility-issue-slide');
			slide.textContent = t('pptx.notes.slideN', { n: issue.slideIndex + 1 });
			item.append(type, message, slide);
			item.addEventListener('click', () => onSelectSlide(issue.slideIndex));
			groupEl.appendChild(item);
		}
		list.appendChild(groupEl);
	};

	return {
		el,
		open(issues) {
			list.replaceChildren();
			summary.textContent = t('pptx.accessibility.issueCount', { count: issues.length });
			if (issues.length === 0) {
				const empty = createEl(doc, 'p', 'pptxv-accessibility-empty');
				empty.textContent = t('pptx.accessibility.noIssuesFound');
				list.appendChild(empty);
			} else {
				// Severity headings come from the shared key map; grouping without a
				// translator renders English into an otherwise translated panel.
				for (const group of groupIssuesBySeverity(issues, (key) => t(key))) {
					renderGroup(group);
				}
			}
			el.hidden = false;
			closeButton.focus();
		},
		close,
	};
}
