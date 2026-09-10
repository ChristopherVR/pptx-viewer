// `max-md:min-h-[44px]!` matches MIN_TOUCH_TARGET_PX (44) from
// pptx-viewer-shared's render/responsive module; `!` is load-bearing (see
// FillStrokeHelpers.tsx's `SEL` for why: theme.css's unlayered baseline
// button/select reset out-specificities a plain Tailwind utility).
export const SELECT_CLS = 'bg-muted border border-border rounded px-2 py-1 max-md:min-h-[44px]!';
export const NUMBER_CLS = SELECT_CLS;
export const BTN_CLS =
	'inline-flex items-center justify-center gap-1 rounded bg-muted hover:bg-accent px-2 py-1';
