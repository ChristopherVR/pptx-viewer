import { Directive, ElementRef, inject } from '@angular/core';

import { EDITOR_CHROME_CSS } from '../internal/shared';

/** Angular templates extract style tags; attach the bundled shared sheet directly. */
@Directive({ selector: '[pptxEditorChromeStyle]', standalone: true })
export class EditorChromeStyleDirective {
	constructor() {
		const host = inject(ElementRef<HTMLElement>).nativeElement;
		const style = host.ownerDocument.createElement('style');
		style.setAttribute('data-pptx-editor-styles', '');
		style.textContent = EDITOR_CHROME_CSS;
		host.appendChild(style);
	}
}
