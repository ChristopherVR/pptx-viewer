import { Directive, ElementRef, inject, input, OnDestroy, OnInit } from '@angular/core';

import { attachRibbonOverflow } from '../internal/shared';
import type { RibbonLaunchers } from '../internal/shared';

/**
 * `[pptxRibbonOverflow]` - collapses ribbon groups into popup buttons when the window is too
 * narrow, as Office does, and adds the corner launchers of the groups `launchers` names. The shared
 * controller only toggles attributes on the groups, so Angular's own markup is never replaced.
 */
@Directive({
	selector: '[pptxRibbonOverflow]',
	standalone: true,
})
export class RibbonOverflowDirective implements OnInit, OnDestroy {
	private readonly host = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
	private detach: (() => void) | undefined;
	readonly launchers = input<RibbonLaunchers | undefined>(undefined, {
		alias: 'pptxRibbonOverflow',
	});

	ngOnInit(): void {
		this.detach = attachRibbonOverflow(this.host, { launchers: this.launchers() });
	}

	ngOnDestroy(): void {
		this.detach?.();
	}
}
