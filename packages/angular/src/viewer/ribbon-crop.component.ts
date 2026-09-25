/**
 * ribbon-crop.component.ts: the Home > Arrange group's "Crop" split control:
 * a toggle that enters / commits on-canvas crop mode, plus a dropdown with
 * Crop to Aspect Ratio (grouped presets), Fill and Fit.
 *
 * Every crop computation is the shared `render/picture-crop` module's; the
 * dropdown's one-click crops land as ONE undoable `updateElement`. Crop mode
 * itself lives in {@link PictureCropService}.
 */
import {
	ChangeDetectionStrategy,
	Component,
	computed,
	ElementRef,
	HostListener,
	inject,
	input,
	signal,
} from '@angular/core';
import { LucideChevronDown, LucideCrop } from '@lucide/angular';
import { TranslatePipe } from '@ngx-translate/core';
import type { PptxElement } from 'pptx-viewer-core';

import {
	canCropElement,
	CROP_ASPECT_GROUP_LABEL_KEYS,
	CROP_ASPECT_LABEL_KEY,
	CROP_ASPECT_PRESETS,
	CROP_FILL_LABEL_KEY,
	CROP_FIT_LABEL_KEY,
	CROP_LABEL_KEY,
	cropFill,
	cropFit,
	cropToAspectRatio,
	getCachedNativeImageSize,
	getImageSrc,
} from '../internal/shared';
import type { CropAspectGroup, CropAspectPreset, CropElementUpdate } from '../internal/shared';
import { AnchoredPopupDirective } from './anchored-popup.directive';
import { EditorStateService } from './editor-state.service';
import { LoadContentService } from './load-content.service';
import { PictureCropService } from './picture-crop.service';

/** The disabled-state tooltip. */
const CROP_HINT_KEY = 'pptx.image.cropHint';

const GROUPS: readonly CropAspectGroup[] = ['square', 'portrait', 'landscape'];

/** The aspect presets under their headings, in PowerPoint's order. */
const PRESET_GROUPS = GROUPS.map((group) => ({
	group,
	labelKey: CROP_ASPECT_GROUP_LABEL_KEYS[group],
	presets: CROP_ASPECT_PRESETS.filter((preset) => preset.group === group),
}));

const ITEM_CLASS = 'whitespace-nowrap rounded px-2 py-0.5 text-left text-[11px] hover:bg-accent';

@Component({
	selector: 'pptx-ribbon-crop',
	standalone: true,
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: 'pptx-rb-grp relative' },
	imports: [TranslatePipe, LucideCrop, LucideChevronDown, AnchoredPopupDirective],
	template: `
		<button
			type="button"
			class="pptx-rb-gb gap-1 whitespace-nowrap"
			data-pptx-ribbon-control="crop"
			[class.bg-primary]="active()"
			[class.text-primary-foreground]="active()"
			[attr.aria-pressed]="active()"
			[attr.aria-label]="labelKey | translate"
			[disabled]="!enabled()"
			[title]="(enabled() ? labelKey : hintKey) | translate"
			(click)="toggle()"
		>
			<svg lucideCrop class="h-4 w-4"></svg>
			{{ labelKey | translate }}
		</button>
		<button
			#trigger
			type="button"
			class="pptx-rb-gl px-1"
			data-pptx-ribbon-control="crop-menu"
			aria-haspopup="menu"
			[attr.aria-expanded]="open()"
			[attr.aria-label]="aspectKey | translate"
			[disabled]="!enabled()"
			[title]="(enabled() ? aspectKey : hintKey) | translate"
			(click)="open.set(!open())"
		>
			<svg lucideChevronDown class="h-3 w-3"></svg>
		</button>
		@if (open() && enabled()) {
			<div
				role="menu"
				class="z-50 mt-0.5 flex flex-col rounded border border-border bg-popover p-1 shadow-md"
				[attr.aria-label]="aspectKey | translate"
				[pptxAnchoredPopup]="trigger"
			>
				@for (entry of presetGroups; track entry.group) {
					<div
						role="presentation"
						class="px-2 pt-1 text-[10px] font-semibold text-muted-foreground"
					>
						{{ entry.labelKey | translate }}
					</div>
					@for (preset of entry.presets; track preset.id) {
						<button
							type="button"
							role="menuitem"
							[class]="itemClass"
							[attr.data-pptx-crop-aspect]="preset.id"
							(click)="applyAspect(preset)"
						>
							{{ preset.id }}
						</button>
					}
				}
				<span role="separator" class="my-0.5 block h-px bg-border"></span>
				<button
					type="button"
					role="menuitem"
					[class]="itemClass"
					data-pptx-crop-action="fill"
					(click)="applyFillFit('fill')"
				>
					{{ fillKey | translate }}
				</button>
				<button
					type="button"
					role="menuitem"
					[class]="itemClass"
					data-pptx-crop-action="fit"
					(click)="applyFillFit('fit')"
				>
					{{ fitKey | translate }}
				</button>
			</div>
		}
	`,
})
export class RibbonCropComponent {
	private readonly editor = inject(EditorStateService);
	private readonly crop = inject(PictureCropService, { optional: true });
	private readonly loader = inject(LoadContentService, { optional: true });
	private readonly host = inject(ElementRef) as ElementRef<HTMLElement>;

	readonly slideIndex = input<number>(0);
	readonly selectedElement = input<PptxElement | null>(null);
	readonly canEdit = input<boolean>(false);

	protected readonly labelKey = CROP_LABEL_KEY;
	protected readonly aspectKey = CROP_ASPECT_LABEL_KEY;
	protected readonly fillKey = CROP_FILL_LABEL_KEY;
	protected readonly fitKey = CROP_FIT_LABEL_KEY;
	protected readonly hintKey = CROP_HINT_KEY;
	protected readonly presetGroups = PRESET_GROUPS;
	protected readonly itemClass = ITEM_CLASS;
	protected readonly open = signal(false);

	/** The single selected picture, when it can be cropped. */
	private readonly target = computed<PptxElement | null>(() => {
		const el = this.selectedElement();
		return this.editor.selectedIds().length === 1 && canCropElement(el) ? el : null;
	});

	protected readonly enabled = computed(() => this.canEdit() && this.target() !== null);
	protected readonly active = computed(
		() => this.crop?.isCropping(this.target()?.id ?? null) ?? false,
	);

	/** Enter crop mode, or commit it when already on. */
	protected toggle(): void {
		this.crop?.toggle(this.slideIndex(), this.target());
	}

	protected applyAspect(preset: CropAspectPreset): void {
		this.applyOneClick((el) => cropToAspectRatio(el, preset.ratioWidth, preset.ratioHeight));
	}

	protected applyFillFit(kind: 'fill' | 'fit'): void {
		this.applyOneClick((el) => {
			const src = getImageSrc(el, this.loader?.mediaDataUrls() ?? new Map<string, string>());
			const natural = getCachedNativeImageSize(src);
			return kind === 'fill' ? cropFill(el, natural) : cropFit(el, natural);
		});
	}

	/** Commit any live crop session, then apply `compute` as ONE undoable update. */
	private applyOneClick(compute: (el: PptxElement) => CropElementUpdate): void {
		this.open.set(false);
		this.crop?.commit();
		const id = this.target()?.id;
		const el = id
			? this.editor.slides()[this.slideIndex()]?.elements.find((item) => item.id === id)
			: undefined;
		if (!el || !this.canEdit()) {
			return;
		}
		this.editor.updateElement(this.slideIndex(), el.id, compute(el) as Partial<PptxElement>);
	}

	/**
	 * A press outside closes the menu. The crop toggle is excluded from crop
	 * mode's own "press outside commits" rule by its ribbon-control marker, so
	 * a click on it toggles instead of committing and then re-entering.
	 */
	@HostListener('document:pointerdown', ['$event'])
	protected onDocumentPointerDown(event: PointerEvent): void {
		if (this.open() && !this.host.nativeElement.contains(event.target as Node | null)) {
			this.open.set(false);
		}
	}
}
