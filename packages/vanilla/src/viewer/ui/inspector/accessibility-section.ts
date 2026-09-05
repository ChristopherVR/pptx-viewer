import type { Translator } from '../../i18n';
import { createEl } from '../../render';
import type { InspectorHandlers, InspectorState } from './types';

export interface AccessibilitySection {
	el: HTMLElement;
	update(state: InspectorState): void;
}

/**
 * The Accessibility section: alt text / title editor for a plain shape, text
 * box or connector, at parity with React's `AccessibilityTextSection`, Vue's
 * `AccessibilityPanel.vue`, Angular's `AccessibilityTextPanelComponent`, and
 * Svelte's (now type-generic) `AltTextSection.svelte`.
 *
 * A picture's own alt text field lives in `image-section.ts`; this section
 * is restricted to `state.isTextShapeOrConnector` so it does not duplicate
 * a table/chart/smartArt/media/ole panel's own alt-text UI. Committed on
 * change, not per keystroke, matching the image section's alt-text field.
 */
export function createAccessibilitySection(
	doc: Document,
	t: Translator,
	section: (label: string) => HTMLElement,
	handlers: InspectorHandlers,
): AccessibilitySection {
	const el = section(t('pptx.accessibility.heading'));

	const altLabel = createEl(doc, 'label', 'pptxv-field pptxv-accessibility-alt');
	const altCaption = createEl(doc, 'span', 'pptxv-field-label');
	altCaption.textContent = t('pptx.elementAccessibility.altText');
	const alt = doc.createElement('textarea');
	alt.rows = 2;
	alt.className = 'pptxv-accessibility-alt-input';
	alt.placeholder = t('pptx.elementAccessibility.altTextPlaceholder');
	alt.setAttribute('aria-label', t('pptx.elementAccessibility.altText'));
	alt.addEventListener('keydown', (event) => event.stopPropagation());
	alt.addEventListener('change', () => handlers.setAltText(alt.value));
	altLabel.append(altCaption, alt);
	el.appendChild(altLabel);

	const titleLabel = createEl(doc, 'label', 'pptxv-field pptxv-accessibility-title');
	const titleCaption = createEl(doc, 'span', 'pptxv-field-label');
	titleCaption.textContent = t('pptx.elementAccessibility.title');
	const title = doc.createElement('input');
	title.type = 'text';
	title.className = 'pptxv-accessibility-title-input';
	title.placeholder = t('pptx.elementAccessibility.titlePlaceholder');
	title.setAttribute('aria-label', t('pptx.elementAccessibility.title'));
	title.addEventListener('keydown', (event) => event.stopPropagation());
	title.addEventListener('change', () => handlers.setTitle(title.value));
	titleLabel.append(titleCaption, title);
	el.appendChild(titleLabel);

	return {
		el,
		update(state) {
			el.hidden = !state.hasSelection || !state.isTextShapeOrConnector;
			if (doc.activeElement !== alt) {
				alt.value = state.altText;
			}
			if (doc.activeElement !== title) {
				title.value = state.title;
			}
			alt.disabled = !state.isTextShapeOrConnector;
			title.disabled = !state.isTextShapeOrConnector;
		},
	};
}
