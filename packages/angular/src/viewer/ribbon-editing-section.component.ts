/**
 * ribbon-editing-section.component.ts: the Editing group in the Home ribbon tab
 * (Find, Replace, Select). Mirrors the React EditingSection and Vue
 * EditingSection components.
 *
 * Select is a split control, not a plain "Select All" button: React exposes a
 * `Select` trigger whose menu holds `Select All`, and product specs address
 * ribbon controls by accessible name, so a binding that labels the trigger
 * after its only menu entry is unreachable under the name every other binding
 * uses. The menu is hover-revealed (the pattern the rest of this ribbon uses),
 * which also keeps its entries out of the tab's control inventory until the
 * user actually opens it, exactly as a closed React menu does. It lives beside
 * the Find/Replace `pptx-rb-grp` rather than inside it: that class is
 * `overflow-hidden`, which would clip the popover.
 *
 * The whole group stays under ONE root element on purpose. The host is placed
 * inside a `flex-col` label stack by {@link RibbonHomeSectionComponent}, so a
 * second top-level sibling would drop onto its own row.
 */
import {
	ChangeDetectionStrategy,
	Component,
	CUSTOM_ELEMENTS_SCHEMA,
	inject,
	output,
} from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

import { editingHomeControls } from '../internal/shared';
import type { RibbonHomeRequestEvent } from '../internal/shared';
import { homeLanguage, homeTranslator } from './ribbon-home-lang';

@Component({
	selector: 'pptx-ribbon-editing-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	template: `<div class="flex items-center gap-1" data-pptx-chrome="editing-controls">
		<pptx-ui-ribbon-home-editing [state]="view()" (home-request)="request($event)" />
	</div>`,
})
export class RibbonEditingSectionComponent {
	private readonly translation = inject(TranslateService, { optional: true });
	private readonly language = homeLanguage(this.translation);

	readonly toggleFindReplace = output<void>();
	readonly selectAll = output<void>();

	/** State for the shared Editing strip: Find, Replace and the Select menu. */
	protected view() {
		return {
			controls: editingHomeControls(),
			translate: homeTranslator(this.translation, this.language, ['editing']),
		};
	}

	/** Select > Select All; Find and Replace both open the find panel. */
	protected request(event: Event): void {
		if ((event as RibbonHomeRequestEvent).detail.id === 'home.editing.select') {
			this.selectAll.emit();
		} else {
			this.toggleFindReplace.emit();
		}
	}
}
