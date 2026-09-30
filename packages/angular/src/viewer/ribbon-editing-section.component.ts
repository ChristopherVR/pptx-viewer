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
import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

import { AnchoredPopupDirective } from './anchored-popup.directive';
import { RibbonIconDirective } from './ribbon-icon.directive';

@Component({
	selector: 'pptx-ribbon-editing-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [RibbonIconDirective, TranslatePipe, AnchoredPopupDirective],
	templateUrl: './ribbon-editing-section.component.html',
})
export class RibbonEditingSectionComponent {
	readonly toggleFindReplace = output<void>();
	readonly selectAll = output<void>();
}
