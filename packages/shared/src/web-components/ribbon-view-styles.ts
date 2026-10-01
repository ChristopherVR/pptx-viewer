import { attachScopedRibbonStyles } from './ribbon-scoped-styles';

const RIBBON_VIEW_STYLES = `
:host { display:inline-flex; align-items:stretch; flex:none; color:var(--pptx-foreground,#f8fafc); font:inherit; }
.stack { display:flex; flex-direction:column; justify-content:flex-start; gap:2px; }
.guides { display:contents; }
`;

export function attachRibbonViewStyles(doc: Document): void {
	attachScopedRibbonStyles(doc, 'pptx-ui-view-styles', 'pptx-ui-ribbon-view', RIBBON_VIEW_STYLES);
}
