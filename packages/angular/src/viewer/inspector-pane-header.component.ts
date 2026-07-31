/**
 * inspector-pane-header.component.ts: tab strip for the right-docked inspector
 * pane, mirroring React's `InspectorPaneHeader` (Toolbar.tsx sibling): an
 * [Elements | Properties | Comments] segmented control plus a close button.
 */
import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { LucideLayers, LucideMessageSquare, LucideSettings2, LucideX } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';

/** The inspector pane's tab set (same keys as React's `InspectorTab`). */
export type SlideInspectorTab = 'elements' | 'properties' | 'comments';

@Component({
	selector: 'pptx-inspector-pane-header',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [TranslatePipe, LucideLayers, LucideSettings2, LucideMessageSquare, LucideX],
	template: `
		<div class="hdr">
			<div class="hdr__tabs">
				<button
					type="button"
					class="hdr__tab"
					[class.is-active]="activeTab() === 'elements'"
					[title]="'pptx.documentProperties.statistics.elements' | translate"
					(click)="tabChange.emit('elements')"
				>
					<svg lucideLayers class="hdr__icon"></svg>
					<span>{{ 'pptx.documentProperties.statistics.elements' | translate }}</span>
				</button>
				<button
					type="button"
					class="hdr__tab"
					[class.is-active]="activeTab() === 'properties'"
					[title]="'pptx.inspector.properties' | translate"
					(click)="tabChange.emit('properties')"
				>
					<svg lucideSettings2 class="hdr__icon"></svg>
					<span>{{ 'pptx.inspector.properties' | translate }}</span>
				</button>
				<button
					type="button"
					class="hdr__tab"
					[class.is-active]="activeTab() === 'comments'"
					[title]="'pptx.toolbar.comments' | translate"
					(click)="tabChange.emit('comments')"
				>
					<svg lucideMessageSquare class="hdr__icon"></svg>
					<span>{{ 'pptx.toolbar.comments' | translate }}</span>
				</button>
			</div>
			<button
				type="button"
				class="hdr__close"
				[title]="'pptx.common.close' | translate"
				(click)="closePane.emit()"
			>
				<svg lucideX class="hdr__icon hdr__icon--close"></svg>
			</button>
		</div>
	`,
	styles: `
		.hdr {
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 8px;
			padding: 8px 10px;
			border-bottom: 1px solid var(--pptx-inspector-border, rgba(0, 0, 0, 0.1));
		}
		.hdr__tabs {
			display: flex;
			align-items: center;
			gap: 2px;
			border-radius: 4px;
			background: var(--pptx-inspector-input-bg, rgba(0, 0, 0, 0.06));
			padding: 2px;
		}
		.hdr__tab {
			display: flex;
			align-items: center;
			gap: 4px;
			padding: 3px 8px;
			border: none;
			border-radius: 3px;
			background: transparent;
			color: var(--pptx-inspector-muted, #888);
			font-size: 11px;
			font-family: inherit;
			cursor: pointer;
		}
		.hdr__tab.is-active {
			background: var(--pptx-inspector-active, #0078d4);
			color: #fff;
		}
		.hdr__icon {
			width: 14px;
			height: 14px;
			flex-shrink: 0;
		}
		.hdr__icon--close {
			width: 16px;
			height: 16px;
		}
		.hdr__close {
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 4px;
			border: none;
			border-radius: 3px;
			background: transparent;
			color: var(--pptx-inspector-muted, #888);
			cursor: pointer;
		}
		.hdr__close:hover,
		.hdr__tab:not(.is-active):hover {
			color: inherit;
		}
	`,
})
export class InspectorPaneHeaderComponent {
	/** The currently active inspector tab. */
	readonly activeTab = input.required<SlideInspectorTab>();
	/** Emitted when the user picks another tab. */
	readonly tabChange = output<SlideInspectorTab>();
	/** Emitted when the user closes the inspector pane. */
	readonly closePane = output<void>();
}
