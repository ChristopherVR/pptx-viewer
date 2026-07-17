/**
 * Ribbon stylesheet fragment: the tab bar, tab content groups, the reusable
 * dropdown / swatch-picker popovers, the Insert shape grid, and the docked
 * Find & Replace panel. Concatenated after `editor-css.ts` by
 * {@link buildViewerCss}. All colours come from the shared `--pptx-*` theme
 * custom properties so the vermilion light/dark presets keep working.
 */
export const RIBBON_CSS = `
/* ── Ribbon shell and React-aligned command row ─────────────────────────── */
.pptxv-ribbon {
	display: flex;
	flex-direction: column;
	border-bottom: 1px solid var(--pptx-border);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	flex: none;
}
.pptxv-ribbon-primary {
	display: flex;
	align-items: center;
	justify-content: flex-end;
	gap: 4px;
	min-height: 26px;
	padding: 4px 8px;
	border-bottom: 1px solid var(--pptx-border);
}
.pptxv-ribbon-primary:empty { display: none; }
.pptxv-ribbon-primary[hidden] { display: none; }
/* ── Tab bar ─────────────────────────────────────────────────────────── */
.pptxv-ribbon-tabs {
	display: flex;
	align-items: center;
	gap: 2px;
	padding: 0 6px;
	border-bottom: 1px solid var(--pptx-border);
	overflow-x: auto;
}
.pptxv-ribbon-tabs[hidden] { display: none; }
.pptxv-ribbon-tab {
	padding: 6px 12px;
	border: none;
	border-bottom: 2px solid transparent;
	background: transparent;
	color: var(--pptx-muted-foreground);
	font: inherit;
	font-size: 12px;
	font-weight: 500;
	white-space: nowrap;
	cursor: pointer;
}
.pptxv-ribbon-tab:hover { color: var(--pptx-foreground); background: var(--pptx-accent); }
.pptxv-ribbon-tab.is-active { color: var(--pptx-foreground); border-bottom-color: var(--pptx-primary); }
.pptxv-ribbon-tab-file { color: var(--pptx-primary); }
.pptxv-ribbon-tab-file.is-active {
	color: #fff;
	background: color-mix(in srgb, var(--pptx-primary) 80%, transparent);
	border-radius: var(--pptx-radius);
}

/* ── Tab content + groups ────────────────────────────────────────────── */
.pptxv-ribbon-tab-content {
	display: flex;
	flex-wrap: wrap;
	align-items: flex-start;
	gap: 2px;
	padding: 6px 8px;
}
.pptxv-ribbon-tab-content[hidden] { display: none; }
/* Design tab theme galleries: .pptxv-btn is a fixed 28x28 icon-button
   primitive elsewhere in the ribbon, so it needs an auto-width override here
   to fit a swatch preview + label without overlapping its neighbours. */
.pptxv-theme-gallery { display: flex; flex-wrap: wrap; align-items: center; gap: 6px; padding: 4px 8px; }
.pptxv-theme-gallery .pptxv-btn { width: auto; height: auto; gap: 6px; padding: 4px 10px 4px 4px; white-space: nowrap; }
.pptxv-theme-swatch-preview { display: block; width: 20px; height: 20px; flex: none; border: 1px solid var(--pptx-border); border-radius: 4px; }
.pptxv-record-dot { width: 12px; height: 12px; margin: 7px; border-radius: 50%; background: #ef4444; }
.pptxv-shortcut-help { align-self: center; padding: 5px 8px; color: var(--pptx-muted-foreground); font-size: 11px; }
.pptxv-ribbon-insert-content {
	flex-wrap: nowrap;
	overflow-x: auto;
	overflow-y: hidden;
}
.pptxv-rgroup {
	display: flex;
	flex-direction: column;
	align-items: center;
	gap: 2px;
	padding: 2px 8px;
	border-right: 1px solid var(--pptx-border);
}
.pptxv-rgroup:last-child { border-right: none; }
.pptxv-rgroup-row { display: flex; flex-wrap: wrap; align-items: center; gap: 2px; }
.pptxv-rgroup-label {
	font-size: 9px;
	color: var(--pptx-muted-foreground);
	text-transform: uppercase;
	letter-spacing: 0.03em;
}
.pptxv-rgroup .pptxv-btn.is-active { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }

/* ── Shape insert grid ───────────────────────────────────────────────── */
.pptxv-shape-grid {
	display: grid;
	grid-template-columns: repeat(10, 28px);
	gap: 2px;
	max-width: 320px;
}

/* ── Dropdown popover (font/size/spacing/case/line-spacing) ─────────────*/
.pptxv-dropdown { position: relative; display: inline-flex; }
.pptxv-dropdown-trigger {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	height: 28px;
	padding: 0 6px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: inherit;
	font: inherit;
	font-size: 11px;
	cursor: pointer;
}
.pptxv-dropdown-trigger:hover:not(:disabled) { background: var(--pptx-accent); }
.pptxv-dropdown-trigger:disabled { opacity: 0.4; cursor: default; }
.pptxv-dropdown-trigger.is-active { background: var(--pptx-accent); }
.pptxv-dropdown-trigger svg { width: 12px; height: 12px; flex: none; }
.pptxv-dropdown-text { max-width: 96px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pptxv-font-family-dd .pptxv-dropdown-text { max-width: 120px; }
.pptxv-font-size-dd .pptxv-dropdown-trigger { min-width: 44px; justify-content: space-between; }
.pptxv-dropdown-menu {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	z-index: 30;
	min-width: 140px;
	max-height: 240px;
	overflow-y: auto;
	padding: 4px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
}
.pptxv-dropdown-menu[hidden] { display: none; }
.pptxv-dropdown-item {
	display: block;
	width: 100%;
	padding: 6px 8px;
	border: none;
	border-radius: 4px;
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: left;
	cursor: pointer;
}
.pptxv-dropdown-item:hover { background: var(--pptx-accent); color: var(--pptx-accent-foreground); }
.pptxv-dropdown-item.is-selected { font-weight: 600; color: var(--pptx-primary); }

/* ── Swatch colour picker ────────────────────────────────────────────── */
.pptxv-swatch-picker { position: relative; display: inline-flex; }
.pptxv-swatch-trigger { flex-direction: column; height: 28px; padding: 2px 6px; gap: 0; }
.pptxv-swatch-swab { display: block; width: 16px; height: 3px; border-radius: 1px; margin-top: 1px; }
.pptxv-swatch-menu {
	position: absolute;
	top: calc(100% + 4px);
	left: 0;
	z-index: 30;
	padding: 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-card);
	color: var(--pptx-card-foreground);
	box-shadow: 0 6px 20px rgb(0 0 0 / 0.25);
}
.pptxv-swatch-menu[hidden] { display: none; }
.pptxv-swatch-grid { display: grid; grid-template-columns: repeat(5, 20px); gap: 4px; margin-bottom: 6px; }
.pptxv-swatch {
	width: 20px;
	height: 20px;
	padding: 0;
	border: 1px solid var(--pptx-border);
	border-radius: 50%;
	cursor: pointer;
}
.pptxv-swatch:hover { transform: scale(1.15); }
.pptxv-swatch.is-selected { outline: 2px solid var(--pptx-ring); outline-offset: 1px; }
.pptxv-swatch-custom {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 6px;
	font-size: 11px;
	color: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-swatch-custom-input {
	width: 20px;
	height: 20px;
	padding: 0;
	border: 1px solid var(--pptx-border);
	border-radius: 4px;
	background: none;
	cursor: pointer;
}

/* ── Find & Replace docked panel ─────────────────────────────────────── */
.pptxv-findreplace {
	display: flex;
	flex-direction: column;
	gap: 4px;
	padding: 6px 8px;
	border-bottom: 1px solid var(--pptx-border);
	background: var(--pptx-muted);
}
.pptxv-findreplace[hidden] { display: none; }
.pptxv-findreplace-row { display: flex; flex-wrap: wrap; align-items: center; gap: 4px; }
.pptxv-findreplace-input {
	height: 28px;
	min-width: 140px;
	padding: 0 8px;
	border: 1px solid var(--pptx-border);
	border-radius: var(--pptx-radius);
	background: var(--pptx-background);
	color: var(--pptx-foreground);
	font: inherit;
	font-size: 12px;
}
.pptxv-findreplace-input:focus-visible { outline: 2px solid var(--pptx-ring); outline-offset: -1px; }
.pptxv-findreplace-checkbox {
	display: inline-flex;
	align-items: center;
	gap: 4px;
	font-size: 11px;
	color: var(--pptx-muted-foreground);
	cursor: pointer;
}
.pptxv-findreplace-status { font-size: 11px; color: var(--pptx-muted-foreground); }

/* PowerPoint-style File backstage */
.pptxv-backstage{position:fixed;inset:0;z-index:200;display:flex!important;padding:0!important;background:var(--pptx-background,#fafafa);color:var(--pptx-foreground,#242424);font-family:Aptos,"Segoe UI",sans-serif}.pptxv-backstage>aside{width:148px;flex:none;display:flex;flex-direction:column;background:var(--pptx-secondary,#f5eee9);border-right:1px solid var(--pptx-border,#d7d7d7)}.pptxv-bs-back{height:48px;border:0;border-bottom:1px solid var(--pptx-border,#ddd);background:none;color:inherit;font-size:22px}.pptxv-bs-back:hover,.pptxv-backstage nav button:hover,.pptxv-bs-recent>button:hover{background:var(--pptx-accent,#eadfd8)}.pptxv-backstage nav{display:flex;min-height:0;flex:1;flex-direction:column;padding:8px 0}.pptxv-backstage nav i{flex:1}.pptxv-backstage nav button{min-height:40px;padding:0 16px;border:0;border-left:2px solid transparent;background:none;color:inherit;text-align:left;font:12px inherit;white-space:pre}.pptxv-backstage nav button.active{border-left-color:var(--pptx-primary,#c43e1c);background:var(--pptx-card,#fff);color:var(--pptx-primary,#c43e1c)}.pptxv-backstage main{flex:1;min-width:0;overflow:auto;padding:20px clamp(32px,4vw,72px)}.pptxv-backstage h1{margin:0;font-size:24px;font-weight:600}.pptxv-backstage h2{margin:28px 0 18px;font-size:17px}.pptxv-bs-templates{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:24px}.pptxv-bs-templates button{border:0;background:none;color:inherit;text-align:left}.pptxv-bs-templates button>b{display:block;aspect-ratio:16/9;border:1px solid var(--pptx-border,#ccc);box-shadow:0 1px 2px #0002;transition:.15s}.pptxv-bs-templates button:hover>b{transform:translateY(-2px);border-color:var(--pptx-primary,#c43e1c);box-shadow:0 7px 18px #0002}.pptxv-bs-templates strong,.pptxv-bs-templates small{display:block;margin-top:8px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:12px}.pptxv-bs-templates small{margin-top:2px;color:var(--pptx-muted-foreground,#777);font-size:10px}.pptxv-bs-search{display:block;width:min(540px,100%);height:40px;margin-top:32px;padding:0 14px;border:1px solid var(--pptx-input,#888);background:var(--pptx-card,#fff);color:var(--pptx-card-foreground,#242424)}.pptxv-bs-search:focus{border-color:var(--pptx-ring,#c43e1c);outline:none}.pptxv-bs-primary{margin-top:16px;padding:10px 20px;border:0;background:var(--pptx-primary,#c43e1c);color:var(--pptx-primary-foreground,#fff);font-weight:600}.pptxv-bs-recent{border-top:1px solid var(--pptx-border,#ddd)}.pptxv-bs-recent header,.pptxv-bs-recent>button{display:grid;grid-template-columns:1fr 120px 90px;align-items:center;padding:10px 12px}.pptxv-bs-recent header{font-size:11px;font-weight:600;color:var(--pptx-muted-foreground,#666)}.pptxv-bs-recent>button{width:100%;border:0;border-top:1px solid var(--pptx-border,#e5e5e5);background:none;color:inherit;text-align:left;font-size:11px}.pptxv-bs-recent .name{display:flex;min-width:0;align-items:center;gap:12px}.pptxv-bs-recent .name>b{display:grid;width:32px;height:32px;place-items:center;background:var(--pptx-primary,#d24726);color:var(--pptx-primary-foreground,#fff)}.pptxv-bs-recent .name strong,.pptxv-bs-recent .name small{display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:13px;font-weight:400}.pptxv-bs-recent .name small,.pptxv-bs-recent p{color:var(--pptx-muted-foreground,#666);font-size:11px}.pptxv-bs-recent p{text-align:center}.pptxv-bs-actions{display:grid;max-width:900px;grid-template-columns:1fr 1fr;gap:20px;margin-top:32px}.pptxv-bs-actions button{display:flex;min-height:112px;gap:16px;padding:20px;border:1px solid var(--pptx-border,#ddd);background:var(--pptx-card,#fff);color:var(--pptx-card-foreground,#242424);text-align:left}.pptxv-bs-actions button:hover{border-color:var(--pptx-primary,#c43e1c);box-shadow:0 5px 15px #0002}.pptxv-bs-actions button>b{display:grid;width:40px;height:40px;flex:none;place-items:center;background:var(--pptx-accent,#fbe9e3);color:var(--pptx-primary,#c43e1c)}.pptxv-bs-actions strong,.pptxv-bs-actions small{display:block;font-size:15px}.pptxv-bs-actions small{margin-top:7px;color:var(--pptx-muted-foreground,#666);font-size:12px;line-height:1.5}.pptxv-bs-card{max-width:760px;margin-top:32px;padding:28px;border:1px solid var(--pptx-border,#ddd);background:var(--pptx-card,#fff);color:var(--pptx-card-foreground,#242424)}.pptxv-bs-card>b{display:grid;width:56px;height:56px;place-items:center;border-radius:50%;background:var(--pptx-primary,#c43e1c);color:var(--pptx-primary-foreground,#fff);font-size:20px}.pptxv-bs-card p,.pptxv-backstage footer{color:var(--pptx-muted-foreground,#666)}.pptxv-bs-card p{line-height:1.6}.pptxv-backstage footer{margin-top:48px;font-size:11px}@media(max-width:700px){.pptxv-backstage>aside{width:112px}.pptxv-bs-actions{grid-template-columns:1fr}.pptxv-bs-recent header,.pptxv-bs-recent>button{grid-template-columns:1fr 90px}.pptxv-bs-recent header span:last-child,.pptxv-bs-recent>button>span:last-child{display:none}}
.pptxv-backstage nav button{display:flex;align-items:center;gap:12px;white-space:normal}.pptxv-backstage nav button>span:first-child{display:grid;width:17px;flex:none;place-items:center}
`;
