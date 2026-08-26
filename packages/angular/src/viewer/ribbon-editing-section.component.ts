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

@Component({
	selector: 'pptx-ribbon-editing-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe, AnchoredPopupDirective],
	template: `
		<div class="flex items-center gap-1">
			<div class="pptx-rb-grp">
				<button
					type="button"
					class="pptx-rb-gb"
					[title]="'pptx.editing.find' | translate"
					(click)="toggleFindReplace.emit()"
				>
					{{ 'pptx.editing.find' | translate }}
				</button>
				<button
					type="button"
					class="pptx-rb-gl"
					[title]="'pptx.ribbon.replace' | translate"
					(click)="toggleFindReplace.emit()"
				>
					{{ 'pptx.ribbon.replace' | translate }}
				</button>
			</div>
			<div class="group relative">
				<button
					#selectTrigger
					type="button"
					class="pptx-rb-pill"
					[title]="'pptx.ribbon.tool.select' | translate"
					(mousedown)="$event.preventDefault()"
				>
					{{ 'pptx.ribbon.tool.select' | translate }}
				</button>
				<div class="z-50 hidden w-32 pt-1 group-hover:block" [pptxAnchoredPopup]="selectTrigger">
					<div class="rounded-lg border border-border bg-card py-1 shadow-2xl">
						<button
							type="button"
							class="flex w-full items-center px-3 py-1.5 text-xs text-foreground transition-colors hover:bg-muted"
							(mousedown)="$event.preventDefault()"
							(click)="selectAll.emit()"
						>
							{{ 'pptx.editing.selectAll' | translate }}
						</button>
					</div>
				</div>
			</div>
		</div>
	`,
})
export class RibbonEditingSectionComponent {
	readonly toggleFindReplace = output<void>();
	readonly selectAll = output<void>();
}
