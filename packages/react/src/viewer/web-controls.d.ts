import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type WebControlProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
	value?: string;
	checked?: boolean;
	disabled?: boolean;
	placeholder?: string;
	variant?: string;
	label?: string;
	icon?: string;
	active?: boolean;
	compact?: boolean;
	pressed?: string;
	expanded?: string;
};

declare module 'react' {
	namespace JSX {
		interface IntrinsicElements {
			'pptx-ui-search': WebControlProps;
			'pptx-ui-select': WebControlProps;
			'pptx-ui-checkbox': WebControlProps;
			'pptx-ui-slide-show-options': WebControlProps;
			'pptx-ui-ribbon-command': WebControlProps;
			'pptx-ui-ribbon-group': WebControlProps;
			'pptx-ui-ribbon-toggle': WebControlProps;
		}
	}
}
