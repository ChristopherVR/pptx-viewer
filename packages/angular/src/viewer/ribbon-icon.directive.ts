import { Directive, ElementRef, inject, Input } from '@angular/core';

import { createRibbonControlIcon } from '../internal/shared';

/** SVG artwork is shared; Angular only supplies the element and control id. */
@Directive({ selector: 'svg[pptxRibbonIcon]', standalone: true })
export class RibbonIconDirective {
	private readonly element = inject<ElementRef<SVGSVGElement>>(ElementRef);
	private iconName = '';
	get pptxRibbonIcon(): string {
		return this.iconName;
	}
	@Input({ required: true })
	set pptxRibbonIcon(name: string) {
		this.iconName = name;
		const target = this.element.nativeElement;
		const artwork = createRibbonControlIcon(target.ownerDocument, name);
		for (const attribute of artwork.attributes) {
			target.setAttribute(attribute.name, attribute.value);
		}
		target.setAttribute('aria-hidden', 'true');
		target.setAttribute('width', '16');
		target.setAttribute('height', '16');
		target.replaceChildren(...artwork.childNodes);
	}
}
