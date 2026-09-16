import {
	AfterViewInit,
	Directive,
	ElementRef,
	inject,
	input,
	OnChanges,
	OnDestroy,
} from '@angular/core';

import { attachRotateHandlePlacement, elementIdSelector } from '../internal/shared';

/** Keep the mounted Rotate control reachable without changing its gesture handlers. */
@Directive({
	selector: '[pptxRotateHandleFor]',
	standalone: true,
})
export class RotateHandlePlacementDirective implements AfterViewInit, OnChanges, OnDestroy {
	private readonly host = inject(ElementRef<HTMLElement>).nativeElement;
	readonly pptxRotateHandleFor = input<string | undefined>();
	readonly pptxRotateHandleStage = input<HTMLElement | null>(null);

	private mounted = false;
	private stage: HTMLElement | null = null;
	private selectedId: string | undefined;
	private cleanup: (() => void) | undefined;

	ngAfterViewInit(): void {
		this.mounted = true;
		this.attach();
	}

	ngOnChanges(): void {
		this.attach();
	}

	ngOnDestroy(): void {
		this.mounted = false;
		this.cleanup?.();
		this.cleanup = undefined;
	}

	private attach(): void {
		if (!this.mounted) {
			return;
		}
		const stage = this.pptxRotateHandleStage(),
			selectedId = this.pptxRotateHandleFor();
		if (this.stage === stage && this.selectedId === selectedId) {
			return;
		}
		this.cleanup?.();
		this.cleanup = undefined;
		this.stage = stage;
		this.selectedId = selectedId;
		if (!stage || !selectedId) {
			return;
		}
		this.cleanup = attachRotateHandlePlacement(this.host, {
			getSelectionElement: () => stage.querySelector<HTMLElement>(elementIdSelector(selectedId)),
			getObstacleRoot: () => stage,
		});
	}
}
