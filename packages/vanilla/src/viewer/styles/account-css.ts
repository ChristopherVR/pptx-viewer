export const ACCOUNT_CSS = `
.pptxv-account { display: flex; flex-direction: column; gap: 28px; max-width: 640px; margin-top: 24px; }
.pptxv-account-section { padding: 20px; border: 1px solid var(--pptx-border); border-radius: 8px; background: var(--pptx-card); color: var(--pptx-card-foreground); }
.pptxv-account-section h2 { margin: 0 0 14px; font-size: 14px; }
.pptxv-account-section p { margin: 6px 0; color: var(--pptx-muted-foreground); font-size: 12px; line-height: 1.6; }
.pptxv-account-profile-row { display: flex; align-items: center; gap: 16px; }
.pptxv-account-avatar { display: grid; width: 52px; height: 52px; flex: none; place-items: center; border-radius: 50%; color: #fff; font-size: 18px; font-weight: 600; }
.pptxv-account-name-field { display: flex; flex: 1; flex-direction: column; gap: 6px; font-size: 11px; color: var(--pptx-muted-foreground); }
.pptxv-account-name-field input { padding: 8px 10px; border: 1px solid var(--pptx-border); border-radius: 5px; background: var(--pptx-muted); color: var(--pptx-foreground); font-size: 13px; }
.pptxv-account-swatch-label { margin-top: 16px !important; font-size: 11px !important; }
.pptxv-account-color-swatch { width: 26px; height: 26px; border: 2px solid transparent; border-radius: 50%; cursor: pointer; }
.pptxv-account-color-swatch:hover { border-color: var(--pptx-border); }
.pptxv-account-color-swatch.is-active { border-color: var(--pptx-foreground); }
.pptxv-account-privacy { font-size: 11px !important; }
.pptxv-account-notice { color: var(--pptx-primary) !important; font-weight: 600; }
`;
