import { Component, ElementRef, inject, input, output, viewChild } from '@angular/core';
import type { AfterViewInit, OnChanges, OnDestroy } from '@angular/core';
import type { PptxElement, TextStyle } from 'pptx-viewer-core';
import { hasTextProperties } from 'pptx-viewer-core';

import {
	attachInlineListController,
	initializeInlineListDom,
	inlineListBodyText,
	placeCaretAtEnd,
	restoreInlineListBodySelection,
} from '../internal/shared';
import type {
	InlineListController,
	InlineListSeed,
	InlineTextEditSnapshot,
} from '../internal/shared';
import {
	resolveCommitTextAutoFitHeight,
	resolveCommitTextNormAutofitShrink,
} from './inline-edit-autofit-commit';
import { ViewerOptionsService } from './viewer-options.service';

/** List-only native surface. The existing textarea remains the plain-text editor. */
@Component({
	selector: 'pptx-inline-list-editor',
	standalone: true,
	styles: [':host { display: contents; }'],
	template: `
		<div
			#editor
			data-inline-editor
			class="pptx-ng-text-editor"
			contenteditable="true"
			role="textbox"
			aria-label="Edit slide text"
			[spellcheck]="spellCheck()"
			[style.left.px]="element().x"
			[style.top.px]="element().y"
			[style.width.px]="element().width"
			[style.height.px]="element().height"
			style="text-decoration: none; text-decoration-line: none"
			(pointerdown)="$event.stopPropagation()"
			(blur)="commit()"
			(keydown)="onKeyDown($event)"
		></div>
	`,
})
export class InlineListEditorComponent implements AfterViewInit, OnChanges, OnDestroy {
	readonly element = input.required<PptxElement>();
	readonly seed = input.required<InlineListSeed>();
	readonly spellCheck = input(true);
	readonly activationSelection = input<{ start: number; end: number }>();
	readonly textInput = output<{ id: string; text: string; snapshot?: InlineTextEditSnapshot }>();
	readonly textCommit = output<{
		id: string;
		text: string;
		snapshot?: InlineTextEditSnapshot;
		height?: number;
		autoFitFontScale?: number;
		autoFitLineSpacingReduction?: number;
	}>();
	readonly textCancel = output<void>();
	readonly textFormat = output<{ id: string; updates: Partial<TextStyle> }>();
	readonly listSession = output<{ controller: InlineListController; active: boolean }>();
	private readonly editor = viewChild.required<ElementRef<HTMLDivElement>>('editor');
	private readonly options = inject(ViewerOptionsService, { optional: true });
	private controller?: InlineListController;
	private disposed = false;
	private cancelled = false;
	private modelBody = '';
	private readModelBody(): string {
		const element = this.element();
		return hasTextProperties(element)
			? element.textSegments
				? inlineListBodyText(element.textSegments)
				: (element.text ?? '')
			: '';
	}
	ngOnChanges(): void {
		const body = this.readModelBody();
		if (body === this.modelBody) {
			this.controller?.refresh();
			return;
		}
		this.modelBody = body;
		const current = this.controller?.read();
		if (current && body !== (current.kind === 'supported' ? current.snapshot.text : current.text)) {
			this.disposed = true;
			this.controller?.dispose();
			this.textCancel.emit();
		}
	}

	ngAfterViewInit(): void {
		this.modelBody = this.readModelBody();
		const root = this.editor().nativeElement;
		const seed = this.seed();
		if (!initializeInlineListDom(root, seed)) {
			return;
		}
		this.controller = attachInlineListController(root, seed, {
			isCurrent: () =>
				!this.disposed && this.seed() === seed && this.element().id === seed.elementId,
			onRead: (result) =>
				this.textInput.emit({
					id: seed.elementId,
					text: result.kind === 'supported' ? result.snapshot.text : result.text,
					snapshot: result.kind === 'supported' ? result.snapshot : undefined,
				}),
		});
		this.listSession.emit({ controller: this.controller, active: true });
		root.focus();
		placeCaretAtEnd(root);
		const selection = this.activationSelection();
		if (selection) {
			restoreInlineListBodySelection(seed, root, selection);
		}
	}

	ngOnDestroy(): void {
		this.disposed = true;
		this.controller?.dispose();
		if (this.controller) {
			this.listSession.emit({ controller: this.controller, active: false });
		}
	}
	blur(): void {
		this.editor().nativeElement.blur();
	}

	protected commit(): void {
		if (this.disposed) {
			return;
		}
		if (this.cancelled) {
			this.textCancel.emit();
			return;
		}
		const result = this.controller?.refresh();
		if (!result) {
			return;
		}
		if (result.kind === 'unsupported' && result.reason === 'inactive-session') {
			return;
		}
		const rawText = result.kind === 'supported' ? result.snapshot.text : result.text;
		const text = this.options?.autoCorrect(rawText) ?? rawText;
		const element = this.element();
		const editor = this.editor().nativeElement;
		const snapshot = result.kind === 'supported' ? result.snapshot : undefined;
		const shrink = resolveCommitTextNormAutofitShrink(
			[element],
			element.id,
			text,
			editor,
			snapshot,
		);
		this.textCommit.emit({
			id: element.id,
			text,
			snapshot,
			height: resolveCommitTextAutoFitHeight([element], element.id, text, editor, snapshot),
			...(shrink !== 'unchanged'
				? { autoFitFontScale: shrink.fontScale, autoFitLineSpacingReduction: shrink.lnSpcReduction }
				: {}),
		});
	}

	protected onKeyDown(event: KeyboardEvent): void {
		if (event.isComposing) {
			return;
		}
		if (event.key === 'Escape') {
			event.preventDefault();
			this.cancelled = true;
			this.blur();
		} else if (event.key === 'Enter') {
			event.preventDefault();
			if (event.shiftKey) {
				this.editor().nativeElement.ownerDocument.execCommand('insertParagraph');
			} else {
				this.blur();
			}
		} else if ((event.ctrlKey || event.metaKey) && !event.shiftKey) {
			const key = event.key.toLowerCase();
			if (key !== 'b' && key !== 'i' && key !== 'u') {
				return;
			}
			event.preventDefault();
			event.stopPropagation();
			const element = this.element();
			if (!hasTextProperties(element)) {
				return;
			}
			const current = this.controller?.readSelection();
			const style =
				current?.kind === 'supported'
					? current.snapshot.textSegments?.[current.selection?.startSegIdx ?? 0]?.style
					: element.textSegments?.[0]?.style;
			const property = key === 'b' ? 'bold' : key === 'i' ? 'italic' : 'underline';
			this.textFormat.emit({
				id: element.id,
				updates: { [property]: !(style?.[property] ?? element.textStyle?.[property]) },
			});
		}
	}
}
