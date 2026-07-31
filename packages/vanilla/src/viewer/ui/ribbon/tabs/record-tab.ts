import type { Translator } from '../../../i18n';
import { createEl } from '../../../render';
import { makeButton } from '../../controls';
import type { RibbonSlideShowHandlers } from '../ribbon-types';

/**
 * The Record ribbon tab: Camera, Record, Manage and Help, matching React's
 * `RecordSection`. Only the two Record commands do anything (both drop into
 * rehearsal mode); the camera/manage/help commands are the disabled
 * placeholders PowerPoint's own tab shows when no cameo is configured, kept so
 * the tab is not three-quarters empty in this binding alone.
 */
export function createRecordTab(
	doc: Document,
	t: Translator,
	handlers: RibbonSlideShowHandlers,
): HTMLElement {
	const el = createEl(doc, 'div', 'pptxv-ribbon-tab-content');
	const dot = createEl(doc, 'span', 'pptxv-record-dot');
	dot.setAttribute('aria-hidden', 'true');

	const placeholder = (key: string): HTMLButtonElement => {
		const button = makeButton(doc, { label: t(key), text: t(key), onClick: () => {} });
		button.setDisabled(true);
		return button.btn;
	};

	const cameo = placeholder('pptx.record.cameo');
	const fromBeginning = makeButton(doc, {
		label: t('pptx.slideShow.fromBeginning'),
		text: t('pptx.slideShow.fromBeginning'),
		onClick: handlers.startRehearsal,
	});
	const fromCurrent = makeButton(doc, {
		label: t('pptx.slideShow.fromCurrent'),
		text: t('pptx.slideShow.fromCurrent'),
		onClick: handlers.startRehearsal,
	});
	el.append(
		dot,
		cameo,
		fromBeginning.btn,
		fromCurrent.btn,
		placeholder('pptx.record.clear'),
		placeholder('pptx.record.resetToCameo'),
		placeholder('pptx.record.learnMore'),
	);
	return el;
}
