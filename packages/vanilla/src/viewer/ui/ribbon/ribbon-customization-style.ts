import type { ResolvedCustomization } from 'pptx-viewer-shared';
import {
	EMPTY_RESOLVED_CUSTOMIZATION,
	RIBBON_SCOPE_ATTR,
	ribbonCustomizationCss,
} from 'pptx-viewer-shared';

let scopeCounter = 0;

/** A per-viewer token for `data-pptx-ribbon-scope` (unique per chrome mount). */
export function nextRibbonScopeToken(): string {
	scopeCounter += 1;
	return `pptxv-ribbon-${scopeCounter}`;
}

export interface RibbonCustomizationStyle {
	el: HTMLStyleElement;
	token: string;
	/** Re-render the rules for a changed customisation. */
	update(resolved: ResolvedCustomization | undefined): void;
}

/**
 * Scope `root` with a fresh {@link RIBBON_SCOPE_ATTR} token and append the ONE
 * `<style>` element whose text is the shared `ribbonCustomizationCss` for
 * it, which hides every ribbon group / control the host named. A
 * customisation change rebuilds the chrome (and so this element); `update`
 * re-renders in place for callers that keep the chrome.
 */
export function mountRibbonCustomizationStyle(
	doc: Document,
	root: HTMLElement,
	resolved: ResolvedCustomization | undefined,
): RibbonCustomizationStyle {
	const token = nextRibbonScopeToken();
	root.setAttribute(RIBBON_SCOPE_ATTR, token);
	const el = doc.createElement('style');
	el.dataset.pptxRibbonCustomization = '';
	const update = (next: ResolvedCustomization | undefined): void => {
		el.textContent = ribbonCustomizationCss(next ?? EMPTY_RESOLVED_CUSTOMIZATION, token);
	};
	update(resolved);
	root.appendChild(el);
	return { el, token, update };
}
