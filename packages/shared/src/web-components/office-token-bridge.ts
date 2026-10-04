import { tok } from './control-tokens';
import { TITLE_BAR_BRIDGE } from './title-bar-styles';

/**
 * The `pptx-ui-*` tags implemented by `ooxml-ui` (see `office-aliases.ts`). Their shadow CSS reads
 * only `--office-*` tokens; this bridge feeds those from the viewer's `--pptx-*` theme and control
 * tokens. It is declared on the hosts themselves because pptx colours resolve where they are read
 * (the `--pptx-*` theme lives on the viewer root, not `:root`), so a viewer theme, a title-bar
 * override of `--pptx-switch-*` or any host override keeps working unchanged.
 */
export const OFFICE_ALIAS_TAGS = [
	'pptx-ui-checkbox',
	'pptx-ui-switch',
	'pptx-ui-radio',
	'pptx-ui-search',
	'pptx-ui-select',
	'pptx-ui-ribbon-toggle',
	'pptx-ui-dialog-footer',
	'pptx-ui-compat-toasts',
	'pptx-ui-read-only-banner',
	'pptx-ui-paste-options',
	'pptx-ui-ribbon-command',
	'pptx-ui-ribbon-group',
	'pptx-ui-context-menu',
	'pptx-ui-title-bar',
] as const;

/** Every alias maps the shared tokens onto the pptx theme and control tokens. */
const BASE = `
	--office-font: system-ui, sans-serif;
	--office-foreground: var(--pptx-foreground, #f3f4f6);
	--office-muted-foreground: var(--pptx-muted-foreground, #9ca3af);
	--office-background: var(--pptx-background, #030712);
	--office-surface: var(--pptx-muted, #2a2a3d);
	--office-selected: var(--pptx-accent, #33334d);
	--office-border: var(--pptx-border, #374151);
	--office-accent: var(--pptx-primary, #6366f1);
	--office-accent-foreground: var(--pptx-primary-foreground, #fff);
	--office-ring: ${tok('--pptx-focus-ring-color')};
	--office-popover: var(--pptx-popover, #111827);
	--office-popover-foreground: var(--pptx-popover-foreground, var(--pptx-foreground, #e2e8f0));
	--office-danger: #b91c1c;
	--office-warning: #d97706;
	--office-info: #60a5fa;
	--office-notice-background: rgb(120 53 15 / 20%);
	--office-notice-foreground: #fde68a;
	--office-notice-border: rgb(180 83 9 / 30%);
	--office-notice-accent: #fbbf24;
	--office-shadow: 0 8px 20px rgb(0 0 0 / 35%);
	--office-shadow-lg: 0 10px 25px rgb(0 0 0 / 35%);
	--office-focus-width: ${tok('--pptx-focus-ring-width')};
	--office-focus-offset: ${tok('--pptx-focus-ring-offset')};
	--office-target-size-touch: ${tok('--pptx-touch-target')};
	--office-field-height: ${tok('--pptx-field-height')};
	--office-field-height-lg: ${tok('--pptx-field-height-lg')};
	--office-field-radius: ${tok('--pptx-field-radius')};
	--office-field-border: ${tok('--pptx-field-border')};
	--office-field-border-focus: ${tok('--pptx-field-border-focus')};
	--office-field-background: ${tok('--pptx-field-bg')};
	--office-field-foreground: ${tok('--pptx-field-fg')};
	--office-field-placeholder: ${tok('--pptx-field-placeholder')};
	--office-checkbox-size: ${tok('--pptx-checkbox-size')};
	--office-checkbox-size-touch: ${tok('--pptx-checkbox-size-touch')};
	--office-checkbox-radius: ${tok('--pptx-checkbox-radius')};
	--office-checkbox-border: ${tok('--pptx-checkbox-border')};
	--office-checkbox-background: ${tok('--pptx-checkbox-bg')};
	--office-checkbox-accent: ${tok('--pptx-checkbox-accent')};
	--office-checkbox-accent-foreground: ${tok('--pptx-checkbox-accent-fg')};
	--office-radio-dot-size: ${tok('--pptx-radio-dot-size')};
	--office-radio-dot-size-touch: ${tok('--pptx-radio-dot-size-touch')};
	--office-switch-width: ${tok('--pptx-switch-width')};
	--office-switch-height: ${tok('--pptx-switch-height')};
	--office-switch-width-touch: ${tok('--pptx-switch-width')};
	--office-switch-height-touch: ${tok('--pptx-switch-height')};
	--office-switch-border-width: 0px;
	--office-switch-knob-size: ${tok('--pptx-switch-knob-size')};
	--office-switch-knob-size-touch: ${tok('--pptx-switch-knob-size')};
	--office-switch-knob-offset: ${tok('--pptx-switch-knob-offset')};
	--office-switch-knob-travel: ${tok('--pptx-switch-knob-travel')};
	--office-switch-track: ${tok('--pptx-switch-track')};
	--office-switch-track-on: ${tok('--pptx-switch-track-on')};
	--office-switch-thumb: ${tok('--pptx-switch-thumb')};
	--office-switch-thumb-on: ${tok('--pptx-switch-thumb')};
`;

/** Per-tag extras: pptx sizes and colours where its controls differ from the Office defaults. */
const EXTRAS: Partial<Record<(typeof OFFICE_ALIAS_TAGS)[number], string>> = {
	'pptx-ui-title-bar': TITLE_BAR_BRIDGE,
	'pptx-ui-select': `:host { --office-select-background: var(--pptx-select-control-bg, var(--pptx-background, #11111b)); }
:host(.bg-muted) { --office-select-background: var(--pptx-muted, #1f2937); }
:host(.bg-popover) { --office-select-background: var(--pptx-popover, #111827); }`,
	'pptx-ui-ribbon-command': `:host { --office-command-icon-color: var(--pptx-primary, #6366f1); --office-font-size-sm: 12px;
	--office-line-height-tight: 1.25; }`,
	'pptx-ui-ribbon-group': `:host { --office-command-icon-color: var(--pptx-primary, #6366f1);
	--office-ribbon-group-height: 84px; --office-ribbon-group-padding: 3px 6px 0; --office-ribbon-separator-inset: 6px;
	--office-ribbon-separator: color-mix(in srgb, var(--pptx-border, #33334d) 80%, transparent);
	--office-ribbon-caption-size: 11px; --office-ribbon-caption-line-height: 16px; --office-ribbon-caption-padding: 0 14px;
	--office-launcher-inset-end: -2px; --office-launcher-inset-bottom: 1px; --office-launcher-width: 14px;
	--office-launcher-height: 14px; --office-ribbon-collapse-x: var(--pptx-collapse-x, 8px);
	--office-ribbon-collapse-y: var(--pptx-collapse-y, 120px); }`,
	'pptx-ui-context-menu': `:host { --office-menu-min-width: 180px; --office-danger: var(--pptx-destructive, #f87171);
	--office-selected: var(--pptx-accent, #33334d); --office-radius-md: var(--pptx-radius, 6px); }`,
};

/**
 * The bridge for one alias, as `:host` rules in its own shadow root. It must travel with the
 * element: controls rendered inside another shadow root (the title bar's search and AutoSave
 * switch) never see document styles.
 */
export function bridgeCss(tag: (typeof OFFICE_ALIAS_TAGS)[number]): string {
	return `:host {${BASE}}\n${EXTRAS[tag] ?? ''}`;
}

/**
 * Document-level rules for alias hosts. The token mapping itself lives in each element
 * (`bridgeCss`); this keeps utility classes a binding puts on a select host from drawing a box.
 */
export const OFFICE_TOKEN_BRIDGE = `
/* Bindings put utility classes on the host; only the shadow trigger draws a box. */
pptx-ui-select { border: 0 !important; padding: 0 !important; background: transparent !important; box-shadow: none !important; }
`;
