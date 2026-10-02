/**
 * mobile-toolbar.component.ts: Compact mobile top toolbar.
 *
 * Ported from: packages/react/src/viewer/components/mobile/MobileToolbar.tsx
 *
 * A single compact row that replaces the desktop ribbon below the 768px
 * breakpoint. Renders the essential always-available controls:
 *
 *   Menu · Undo · Redo · [spacer] · AI · Save · Present · Share
 *
 * A thin adapter around the shared `pptx-ui-mobile-toolbar`, which owns the
 * `role="toolbar"` with `aria-label="Toolbar"` (the framework-neutral
 * accessibility contract the e2e specs assert against, via
 * `getByRole('toolbar', { name: 'Toolbar' })`) and the slot order, icons and
 * gating. This maps the inputs onto its state and re-emits its typed intents as
 * the outputs the viewer already wires.
 *
 * Section-specific functionality (Insert/Design/Export/etc.) lives in the
 * `MobileMenuSheetComponent` that opens from the Menu button; per-selection
 * actions live in the `MobileBottomBarComponent` at the bottom of the screen.
 *
 * Each input/output is documented on its own declaration below.
 */

import {
	ChangeDetectionStrategy,
	Component,
	computed,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	input,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { isActionHidden } from '../internal/shared';
import type {
	MobileToolbarId,
	MobileToolbarRequestEvent,
	MobileToolbarViewState,
	ToolbarActionId,
} from '../internal/shared';
import { translationsSignal } from './translations-signal';

@Component({
	selector: 'pptx-mobile-toolbar',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `
		<pptx-ui-mobile-toolbar [state]="view()" (mobile-toolbar-request)="request($event)" />
	`,
	styles: [':host { display: block; }'],
})
export class MobileToolbarComponent {
	// ── Inputs ────────────────────────────────────────────────────────────────

	/** Whether Undo is available. */
	readonly canUndo = input<boolean>(false);
	/** Whether Redo is available. */
	readonly canRedo = input<boolean>(false);
	/** Whether Present can start (a deck with at least one slide is open). */
	readonly canPresent = input<boolean>(true);
	/** Whether the deck is editable; gates Menu, Undo/Redo, AI and Share. */
	readonly canEdit = input<boolean>(false);
	/** Whether the section menu sheet is open (reflected as `aria-expanded`). */
	readonly menuOpen = input<boolean>(false);
	/** Whether the host opted into the AI assistant. */
	readonly aiEnabled = input<boolean>(false);
	/** Whether the AI panel is open (reflected as `aria-pressed`). */
	readonly aiPanelOpen = input<boolean>(false);
	/** Toolbar buttons the host wants hidden (undo / redo / fullscreen / share). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);

	// ── Outputs ───────────────────────────────────────────────────────────────

	readonly toggleMenu = output<void>();
	readonly toggleAiPanel = output<void>();
	readonly undo = output<void>();
	readonly redo = output<void>();
	readonly share = output<void>();
	readonly save = output<void>();
	readonly present = output<void>();

	private readonly translate = inject(TranslateService);
	private readonly translations = translationsSignal(this.translate);

	private readonly emitters: Record<MobileToolbarId, () => void> = {
		menu: () => this.toggleMenu.emit(),
		undo: () => this.undo.emit(),
		redo: () => this.redo.emit(),
		ai: () => this.toggleAiPanel.emit(),
		save: () => this.save.emit(),
		present: () => this.present.emit(),
		share: () => this.share.emit(),
	};

	protected readonly view = computed<MobileToolbarViewState>(() => {
		this.translations();
		const actions = this.hiddenActions();
		const hidden: MobileToolbarId[] = [];
		if (isActionHidden('undo', actions)) {
			hidden.push('undo');
		}
		if (isActionHidden('redo', actions)) {
			hidden.push('redo');
		}
		if (isActionHidden('fullscreen', actions)) {
			hidden.push('present');
		}
		if (isActionHidden('share', actions)) {
			hidden.push('share');
		}
		return {
			editable: this.canEdit(),
			canUndo: this.canUndo(),
			canRedo: this.canRedo(),
			aiVisible: this.aiEnabled(),
			aiActive: this.aiPanelOpen(),
			menuOpen: this.menuOpen(),
			hidden,
			disabled: this.canPresent() ? [] : ['present'],
			translate: (key, params) => this.translate.instant(key, params),
		};
	});

	protected request(event: Event): void {
		this.emitters[(event as MobileToolbarRequestEvent).detail.id]();
	}
}
