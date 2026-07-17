import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';

import {
	BACKSTAGE_NAV,
	BACKSTAGE_TEMPLATES,
	formatBackstageDate,
	formatBackstageSize,
	isActionHidden,
	listBackstageRecentFiles,
} from '../internal/shared';
import type {
	AccountAuthConfig,
	BackstagePage,
	BackstageRecentFile,
	ToolbarActionId,
} from '../internal/shared';
import { AccountPageComponent } from './account-page.component';
import { BackstageNavIconComponent } from './backstage-nav-icon.component';

interface BackstageAction {
	title: string;
	body: string;
	icon: string;
	event: { emit: () => void };
}

/**
 * Pure, testable filter: the main (non-footer) backstage nav entries visible
 * for a given `hiddenActions` list. Only the Export entry maps to a toolbar
 * action id ('export'); every other backstage page (Home, New, Open, ...) has
 * no `ToolbarActionId` counterpart and always stays.
 */
export function visibleMainNav(
	hiddenActions: readonly ToolbarActionId[] | undefined,
): typeof BACKSTAGE_NAV {
	return BACKSTAGE_NAV.filter(
		(item) => !item.group && !(item.id === 'export' && isActionHidden('export', hiddenActions)),
	);
}

@Component({
	selector: 'pptx-ribbon-file-section',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'contents' },
	imports: [BackstageNavIconComponent, AccountPageComponent],
	templateUrl: './ribbon-file-section.component.html',
	styleUrl: './ribbon-file-section.component.css',
})
export class RibbonFileSectionComponent {
	readonly fileName = input<string>();
	readonly slideCount = input(0);
	readonly exporting = input(false);
	readonly hasMacros = input(false);
	/** Toolbar buttons the host wants hidden (drops the Export nav entry/page). */
	readonly hiddenActions = input<ToolbarActionId[]>([]);
	/** Optional sign-in hook point for the Account page. Absent/disabled by default. */
	readonly accountAuth = input<AccountAuthConfig | undefined>(undefined);
	readonly close = output<void>();
	readonly createPresentation = output<string>();
	readonly openFile = output<void>();
	readonly openRecentFile = output<string>();
	readonly save = output<void>();
	readonly savePpsx = output<void>();
	readonly savePptm = output<void>();
	readonly packageForSharing = output<void>();
	readonly exportPng = output<void>();
	readonly exportPdf = output<void>();
	readonly exportGif = output<void>();
	readonly exportVideo = output<void>();
	readonly copySlideAsImage = output<void>();
	readonly print = output<void>();
	readonly info = output<void>();
	readonly signatures = output<void>();
	readonly replace = output<void>();
	readonly openPassword = output<void>();
	readonly openFontEmbedding = output<void>();
	readonly openVersionHistory = output<void>();
	readonly share = output<void>();
	readonly options = output<void>();

	protected readonly templates = BACKSTAGE_TEMPLATES;
	protected readonly mainNav = computed(() => visibleMainNav(this.hiddenActions()));
	protected readonly footerNav = BACKSTAGE_NAV.filter((item) => item.group);
	protected readonly page = signal<BackstagePage>('home');
	protected readonly query = signal('');
	protected readonly recent = signal<BackstageRecentFile[]>([]);
	protected readonly title = computed(
		() => BACKSTAGE_NAV.find((item) => item.id === this.page())?.label ?? 'Home',
	);
	protected readonly visibleRecent = computed(() => {
		const q = this.query().trim().toLowerCase();
		return q
			? this.recent().filter((file) => `${file.name} ${file.location}`.toLowerCase().includes(q))
			: this.recent();
	});
	protected readonly date = formatBackstageDate;
	protected readonly size = formatBackstageSize;
	protected readonly actions = computed(() => this.pageActions(this.page()));

	constructor() {
		void (async () => this.recent.set(await listBackstageRecentFiles()))();
	}

	protected selectPage(id: BackstagePage): void {
		if (id === 'close') {
			this.close.emit();
			return;
		}
		if (id === 'save') {
			this.run(this.save);
			return;
		}
		if (id === 'options') {
			this.run(this.options);
			return;
		}
		this.page.set(id);
	}

	protected run(event: { emit: () => void }): void {
		event.emit();
		this.close.emit();
	}

	protected create(templateId: string): void {
		this.createPresentation.emit(templateId);
		this.close.emit();
	}

	protected openRecent(key: string): void {
		this.openRecentFile.emit(key);
		this.close.emit();
	}

	private action(
		title: string,
		body: string,
		icon: string,
		event: { emit: () => void },
	): BackstageAction {
		return { title, body, icon, event };
	}

	private pageActions(page: BackstagePage): BackstageAction[] {
		const a = this.action.bind(this);
		if (page === 'info') {
			return [
				a('Protect Presentation', 'Control what changes people can make.', '🔒', this.openPassword),
				a('Inspect Presentation', 'Review properties and hidden content.', 'ⓘ', this.info),
				a('Embed Fonts', 'Keep typography consistent across devices.', 'T', this.openFontEmbedding),
				a('Digital Signatures', 'View and manage attached signatures.', '✓', this.signatures),
			];
		}
		if (page === 'saveAs') {
			return [
				a('PowerPoint Presentation', 'Save an editable .pptx copy.', 'P', this.save),
				a('PowerPoint Show', 'Save a .ppsx slide show.', '▶', this.savePpsx),
				...(this.hasMacros()
					? [a('Macro-Enabled Presentation', 'Preserve VBA in a .pptm file.', 'M', this.savePptm)]
					: []),
				a('Package for Sharing', 'Bundle the deck and linked assets.', '□', this.packageForSharing),
			];
		}
		if (page === 'export') {
			return [
				a('Create PDF', 'Publish one page per slide.', 'PDF', this.exportPdf),
				a('Export current slide', 'Create a high-quality PNG.', 'PNG', this.exportPng),
				a('Create a Video', 'Export timings and animations.', '▶', this.exportVideo),
				a('Create an Animated GIF', 'Make a compact looping preview.', 'GIF', this.exportGif),
				a('Copy as Image', 'Copy the current slide.', '▣', this.copySlideAsImage),
			];
		}
		if (page === 'print') {
			return [a('Print Presentation', 'Choose layout and output settings.', '▧', this.print)];
		}
		if (page === 'share') {
			return [
				a('Share with People', 'Invite collaborators to work together.', '◇', this.share),
				a('Package for Sharing', 'Download a self-contained package.', '□', this.packageForSharing),
			];
		}
		return [];
	}
}
