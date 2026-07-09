/**
 * ribbon-editing-section.component.ts: the Editing group in the Home ribbon tab
 * (Find, Replace, Select All). Mirrors the React EditingSection and Vue
 * EditingSection components.
 */
import { ChangeDetectionStrategy, Component, output } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';

@Component({
	selector: 'pptx-ribbon-editing-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [TranslatePipe],
	template: `
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
				class="pptx-rb-gb"
				[title]="'pptx.ribbon.replace' | translate"
				(click)="toggleFindReplace.emit()"
			>
				{{ 'pptx.ribbon.replace' | translate }}
			</button>
			<button
				type="button"
				class="pptx-rb-gl"
				[title]="'pptx.editing.selectAll' | translate"
				(click)="selectAll.emit()"
			>
				{{ 'pptx.editing.selectAll' | translate }}
			</button>
		</div>
	`,
})
export class RibbonEditingSectionComponent {
	readonly toggleFindReplace = output<void>();
	readonly selectAll = output<void>();
}
