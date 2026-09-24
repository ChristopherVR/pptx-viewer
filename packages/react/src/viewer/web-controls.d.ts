import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type WebControlProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
	value?: string;
	checked?: boolean;
	disabled?: boolean;
	placeholder?: string;
	variant?: string;
};

declare module 'react' {
	namespace JSX {
		interface IntrinsicElements {
			'pptx-ui-search': WebControlProps;
			'pptx-ui-select': WebControlProps;
			'pptx-ui-checkbox': WebControlProps;
		}
	}
}
