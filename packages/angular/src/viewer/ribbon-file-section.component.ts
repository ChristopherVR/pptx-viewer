import {
	ChangeDetectionStrategy,
	Component,
	computed,
	inject,
	input,
	output,
	signal,
} from '@angular/core';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';

import {
	BACKSTAGE_NAV,
	BACKSTAGE_TEMPLATES,
	backstageCardsFor,
	formatBackstageDate,
	formatBackstageSize,
	isActionHidden,
	listBackstageRecentFiles,
} from '../internal/shared';
import type {
	AccountAuthConfig,
	BackstageCardId,
	BackstagePage,
	BackstageRecentFile,
	ToolbarActionId,
} from '../internal/shared';
import { AccountPageComponent } from './account-page.component';
import { BackstageNavIconComponent } from './backstage-nav-icon.component';

interface BackstageAction {
	titleKey: string;
	bodyKey: string;
	icon: string;
	event: { emit: () => void };
}

const CARD_ICONS: Record<BackstageCardId, string> = {
	protect: '🔒',
	inspect: 'ⓘ',
	embedFonts: 'T',
	signatures: '✓',
	versionHistory: '↺',
	saveAsPptx: 'P',
	saveAsPpsx: '▶',
	saveAsPptm: 'M',
	package: '□',
	pdf: 'PDF',
	png: 'PNG',
	video: '▶',
	gif: 'GIF',
	json: '{}',
	copyImage: '▣',
	print: '▧',
	share: '◇',
	sharePackage: '□',
};

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
	imports: [BackstageNavIconComponent, AccountPageComponent, TranslatePipe],
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
	readonly exportJson = output<void>();
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

	/**
	 * Optional: the backstage only needs a translator for the two strings the
	 * shared helpers build (relative dates, recent-file fallbacks). A host that
	 * has not provided ngx-translate should still get an English backstage
	 * rather than an NG0201 at construction time.
	 */
	private readonly translate = inject(TranslateService, { optional: true });
	private readonly t = this.translate
		? (key: string, params?: Record<string, string | number>): string =>
				this.translate?.instant(key, params) ?? key
		: undefined;
	protected readonly templates = BACKSTAGE_TEMPLATES;
	protected readonly mainNav = computed(() => visibleMainNav(this.hiddenActions()));
	protected readonly footerNav = BACKSTAGE_NAV.filter((item) => item.group);
	protected readonly page = signal<BackstagePage>('home');
	protected readonly query = signal('');
	protected readonly recent = signal<BackstageRecentFile[]>([]);
	protected readonly titleKey = computed(
		() =>
			BACKSTAGE_NAV.find((item) => item.id === this.page())?.labelKey ?? 'pptx.backstage.nav.home',
	);
	protected readonly visibleRecent = computed(() => {
		const q = this.query().trim().toLowerCase();
		return q
			? this.recent().filter((file) => `${file.name} ${file.location}`.toLowerCase().includes(q))
			: this.recent();
	});
	protected readonly size = formatBackstageSize;
	protected readonly actions = computed(() => this.pageActions(this.page()));

	constructor() {
		void (async () => this.recent.set(await listBackstageRecentFiles(this.t)))();
	}

	protected date(timestamp: number): string {
		return formatBackstageDate(timestamp, Date.now(), this.t);
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

	/**
	 * Card order, wording and dictionary keys come from `pptx-viewer-shared`;
	 * this only maps each card to its glyph and to the output that fires it, so
	 * the backstage cannot be worded differently here than in the other four
	 * bindings.
	 */
	private pageActions(page: BackstagePage): BackstageAction[] {
		const events: Record<BackstageCardId, { emit: () => void }> = {
			protect: this.openPassword,
			inspect: this.info,
			embedFonts: this.openFontEmbedding,
			signatures: this.signatures,
			versionHistory: this.openVersionHistory,
			saveAsPptx: this.save,
			saveAsPpsx: this.savePpsx,
			saveAsPptm: this.savePptm,
			package: this.packageForSharing,
			pdf: this.exportPdf,
			png: this.exportPng,
			video: this.exportVideo,
			gif: this.exportGif,
			json: this.exportJson,
			copyImage: this.copySlideAsImage,
			print: this.print,
			share: this.share,
			sharePackage: this.packageForSharing,
		};
		return backstageCardsFor(page)
			.filter((card) => card.id !== 'saveAsPptm' || this.hasMacros())
			.map((card) => ({
				titleKey: card.titleKey,
				bodyKey: card.bodyKey,
				icon: CARD_ICONS[card.id],
				event: events[card.id],
			}));
	}
}
