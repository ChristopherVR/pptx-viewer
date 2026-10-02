import type { DetailedHTMLProps, HTMLAttributes } from 'react';

type WebControlProps = DetailedHTMLProps<HTMLAttributes<HTMLElement>, HTMLElement> & {
	value?: string;
	checked?: boolean;
	disabled?: boolean;
	placeholder?: string;
	variant?: string;
	mode?: string;
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
			'pptx-ui-compat-toasts': WebControlProps;
			'pptx-ui-dialog-footer': WebControlProps;
			'pptx-ui-mobile-bar': WebControlProps;
			'pptx-ui-mobile-toolbar': WebControlProps;
			'pptx-ui-paste-options': WebControlProps;
			'pptx-ui-present-toolbar': WebControlProps;
			'pptx-ui-presenter-console': WebControlProps;
			'pptx-ui-read-only-banner': WebControlProps;
			'pptx-ui-ribbon-command': WebControlProps;
			'pptx-ui-ribbon-animations': WebControlProps;
			'pptx-ui-ribbon-draw': WebControlProps;
			'pptx-ui-ribbon-home-clipboard': WebControlProps;
			'pptx-ui-ribbon-home-editing': WebControlProps;
			'pptx-ui-ribbon-home-font': WebControlProps;
			'pptx-ui-ribbon-home-paragraph': WebControlProps;
			'pptx-ui-ribbon-transitions': WebControlProps;
			'pptx-ui-ribbon-insert': WebControlProps;
			'pptx-ui-ribbon-view': WebControlProps;
			'pptx-ui-ribbon-group': WebControlProps;
			'pptx-ui-ribbon-section': WebControlProps;
			'pptx-ui-ribbon-gallery': WebControlProps;
			'pptx-ui-ribbon-toggle': WebControlProps;
			'pptx-ui-subtitle-settings': WebControlProps;
			'pptx-ui-theme-editor': WebControlProps;
		}
	}
}
