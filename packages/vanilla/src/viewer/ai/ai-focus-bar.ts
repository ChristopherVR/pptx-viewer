/**
 * The strip under the AI panel header showing the assistant's current focused
 * targets as chips (live from the canvas selection, pinned, or picked). It also
 * hosts the crosshair "Point at a slide element" affordance that enters PICK
 * MODE, a "Merge selected tables" directive when the focus is exactly two
 * tables, and pin / clear controls. Vanilla counterpart of React's `AiFocusBar`,
 * driven by the framework-free {@link AiFocusController}.
 */
import type { PptxSlide } from 'pptx-viewer-core';
import { focusTargetChips, isTwoTableFocus, mergeTablesDirective } from 'pptx-viewer-shared/ai';

import type { Translator } from '../i18n';
import { createEl } from '../render';
import { createIcon } from '../ui/icons';
import type { AiFocusController } from './ai-panel-controller';

export interface AiFocusBarDeps {
	doc: Document;
	t: Translator;
	controller: AiFocusController;
	getSlides(): PptxSlide[];
	/** Send a chat directive (fires the merge without a confirmation round-trip). */
	onSendDirective(text: string): void;
}

export interface AiFocusBar {
	el: HTMLElement;
	destroy(): void;
}

/** Build the focus bar and keep it in sync with the controller. */
export function createAiFocusBar(deps: AiFocusBarDeps): AiFocusBar {
	const { doc, t, controller } = deps;
	const el = createEl(doc, 'div', 'pptxv-ai-focus');

	const iconButton = (
		icon: Parameters<typeof createIcon>[1],
		label: string,
		onClick: () => void,
	) => {
		const btn = createEl(doc, 'button', 'pptxv-ai-focus-btn');
		btn.type = 'button';
		btn.title = label;
		btn.setAttribute('aria-label', label);
		btn.appendChild(createIcon(doc, icon));
		btn.addEventListener('click', onClick);
		return btn;
	};

	const render = (): void => {
		el.replaceChildren();
		const targets = controller.getEffectiveTargets();
		const hasPicks = controller.hasPicks();
		const isPinned = controller.isPinned();
		const pickMode = controller.isPicking();

		const bar = createEl(doc, 'div', 'pptxv-ai-focus-row');
		const scope = createEl(doc, 'span', 'pptxv-ai-focus-label');
		scope.textContent = t('pptx.ai.focusScope');
		bar.appendChild(scope);

		for (const chip of focusTargetChips(targets, deps.getSlides())) {
			const span = createEl(doc, 'span', 'pptxv-ai-focus-chip');
			if (hasPicks || isPinned) {
				span.classList.add('is-strong');
			}
			span.title = chip.title;
			span.textContent = chip.label;
			bar.appendChild(span);
		}
		if (isPinned) {
			const pinned = createEl(doc, 'span', 'pptxv-ai-focus-pinned');
			pinned.textContent = t('pptx.ai.pinnedFocus');
			bar.appendChild(pinned);
		}

		const actions = createEl(doc, 'div', 'pptxv-ai-focus-actions');
		const twoTables = isTwoTableFocus(targets, deps.getSlides());
		if (twoTables) {
			const merge = createEl(doc, 'button', 'pptxv-ai-focus-merge');
			merge.type = 'button';
			merge.append(
				createIcon(doc, 'git-merge'),
				doc.createTextNode(t('pptx.ai.mergeSelectedTables')),
			);
			merge.addEventListener('click', () =>
				deps.onSendDirective(
					mergeTablesDirective(twoTables.slideIndex, twoTables.elementIdA, twoTables.elementIdB),
				),
			);
			actions.appendChild(merge);
		}

		const pick = iconButton('crosshair', t('pptx.ai.pickElement'), () =>
			pickMode ? controller.stopPicking() : controller.startPicking(),
		);
		pick.setAttribute('aria-pressed', String(pickMode));
		pick.classList.toggle('is-active', pickMode);
		actions.appendChild(pick);

		if (hasPicks) {
			actions.appendChild(
				iconButton('close', t('pptx.ai.pickClear'), () => controller.clearPicks()),
			);
		} else if (isPinned) {
			actions.appendChild(
				iconButton('pin-off', t('pptx.ai.clearFocus'), () => controller.clearPinnedFocus()),
			);
		} else {
			actions.appendChild(iconButton('pin', t('pptx.ai.pinFocus'), () => controller.pinFocus()));
		}
		bar.appendChild(actions);
		el.appendChild(bar);

		if (pickMode) {
			const banner = createEl(doc, 'div', 'pptxv-ai-focus-pick');
			const dot = createIcon(doc, 'crosshair');
			dot.classList.add('pptxv-ai-focus-pick-icon');
			const hint = createEl(doc, 'span', 'pptxv-ai-focus-pick-hint');
			hint.textContent = t('pptx.ai.pickElementHint');
			const done = createEl(doc, 'button', 'pptxv-ai-focus-pick-done');
			done.type = 'button';
			done.textContent = t('pptx.ai.pickDone');
			done.addEventListener('click', () => controller.stopPicking());
			banner.append(dot, hint, done);
			el.appendChild(banner);
		}
	};

	const unsubscribe = controller.subscribe(render);
	render();

	return {
		el,
		destroy() {
			unsubscribe();
			el.remove();
		},
	};
}
