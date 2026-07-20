export const webAppHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <title>Tools Manager</title>
  <style>
    :root {
      --ink: #101513;
      --muted: #68716d;
      --line: #d5dad3;
      --line-strong: #a8b0aa;
      --paper: #f0f2ec;
      --panel: #fbfcf8;
      --graphite: #191f1c;
      --sidebar: #101512;
      --accent: #d7ff4f;
      --accent-strong: #86a91c;
      --amber: #e99c25;
      --red: #c64b3e;
      --red-soft: #fff0ed;
      --blue: #176d92;
      --shadow: 0 20px 56px rgba(16, 21, 19, .18);
      --radius: 4px;
      --display: "DIN Alternate", "Avenir Next Condensed", "Avenir Next", sans-serif;
      --body: "Avenir Next", Avenir, "Segoe UI", sans-serif;
      --mono: "Berkeley Mono", "SFMono-Regular", Menlo, Consolas, monospace;
      font-family: var(--body);
      color: var(--ink);
      background: var(--paper);
      letter-spacing: 0;
    }
    * { box-sizing: border-box; }
    body { position: relative; margin: 0; min-width: 320px; min-height: 100vh; background: var(--paper); }
    body::before {
      content: ""; position: fixed; inset: 0; z-index: -1; pointer-events: none; opacity: .55;
      background-image: linear-gradient(rgba(16, 21, 19, .035) 1px, transparent 1px), linear-gradient(90deg, rgba(16, 21, 19, .035) 1px, transparent 1px);
      background-size: 24px 24px;
    }
    button, input, textarea, select { font: inherit; letter-spacing: 0; }
    button { cursor: pointer; }
    button:focus-visible, input:focus-visible, textarea:focus-visible, select:focus-visible {
      outline: 3px solid rgba(23, 109, 146, .26);
      outline-offset: 2px;
    }
    .app { min-height: 100vh; display: grid; grid-template-columns: 248px minmax(0, 1fr); }
    .sidebar {
      position: sticky; top: 0; z-index: 12; height: 100vh; display: flex; flex-direction: column;
      background: var(--sidebar); color: #f4f7ee; border-right: 1px solid #303732; box-shadow: 8px 0 30px rgba(9, 12, 10, .08);
    }
    .brand { position: relative; height: 108px; display: flex; align-items: center; gap: 14px; padding: 24px 20px; border-bottom: 1px solid #303733; }
    .brand::after { content: "00-TM"; position: absolute; right: 13px; top: 10px; color: #58615c; font: 9px/1 var(--mono); }
    .brand-mark {
      position: relative; width: 44px; height: 44px; flex: 0 0 44px; display: grid; place-items: center;
      background: var(--accent); color: #101510; font: 900 13px/1 var(--mono); clip-path: polygon(0 0, 100% 0, 100% 72%, 72% 100%, 0 100%);
    }
    .brand-mark::after { content: ""; position: absolute; width: 13px; height: 1px; right: 5px; top: 9px; background: #101510; transform: rotate(-45deg); }
    .brand-name { font: 700 17px/1.05 var(--display); text-transform: uppercase; }
    .brand-meta { margin-top: 7px; color: #89938d; font: 9px/1 var(--mono); }
    .nav { padding: 22px 12px; display: grid; gap: 5px; }
    .nav-label { padding: 13px 12px 8px; color: #68716c; font: 700 9px/1 var(--mono); text-transform: uppercase; }
    .nav button {
      position: relative; width: 100%; min-height: 46px; display: flex; align-items: center; gap: 12px; padding: 10px 12px;
      border: 1px solid transparent; border-radius: 2px; background: transparent; color: #aeb7b1; text-align: left; transition: color .16s ease, background .16s ease, transform .16s ease;
    }
    .nav button::after { content: ""; position: absolute; right: 12px; width: 5px; height: 5px; border: 1px solid #515b55; transform: rotate(45deg); }
    .nav button:hover { background: #1a211d; color: white; transform: translateX(2px); }
    .nav button.active { border-color: #343e37; background: #202821; color: white; box-shadow: inset 3px 0 0 var(--accent); }
    .nav button.active::after { border-color: var(--accent); background: var(--accent); }
    .nav-code { width: 25px; color: #66706a; font: 700 10px/1 var(--mono); }
    .nav button.active .nav-code { color: var(--accent); }
    .sidebar-foot { margin-top: auto; padding: 18px 20px 22px; border-top: 1px solid #303733; color: #7f8a83; font: 9px/1.7 var(--mono); overflow-wrap: anywhere; }
    .connection-line { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; color: #b4beb7; }
    .status-pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--accent); box-shadow: 0 0 0 4px rgba(215, 255, 79, .1); animation: pulse 2.4s ease-in-out infinite; }
    .main { position: relative; min-width: 0; overflow: hidden; }
    .main::after { content: "TM / LOCAL"; position: fixed; right: 18px; bottom: 10px; z-index: -1; color: rgba(16, 21, 19, .18); font: 9px/1 var(--mono); }
    .topbar {
      position: sticky; top: 0; z-index: 9; min-height: 108px; display: flex; align-items: center; justify-content: space-between; gap: 24px;
      padding: 18px clamp(22px, 4vw, 54px); background: rgba(240, 242, 236, .94); border-bottom: 2px solid var(--ink); backdrop-filter: blur(14px);
    }
    .title-block { display: flex; align-items: center; gap: 18px; }
    .title-index { color: var(--accent-strong); font: 700 11px/1 var(--mono); writing-mode: vertical-rl; transform: rotate(180deg); }
    .eyebrow { color: var(--muted); font: 700 9px/1.2 var(--mono); text-transform: uppercase; }
    h1 { margin: 7px 0 0; font: 700 32px/.95 var(--display); text-transform: uppercase; }
    .topbar-tools { display: flex; align-items: center; gap: 18px; }
    .system-state { min-width: 112px; padding-left: 14px; border-left: 1px solid var(--line-strong); color: var(--muted); font: 9px/1.55 var(--mono); text-transform: uppercase; }
    .system-state strong { display: flex; align-items: center; gap: 7px; color: var(--ink); font-size: 10px; }
    .system-state strong::before { content: ""; width: 6px; height: 6px; background: var(--accent-strong); border-radius: 50%; }
    .top-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .content { width: 100%; max-width: 1640px; margin: 0 auto; padding: 34px clamp(22px, 4vw, 54px) 70px; }
    #view.view-enter > * { animation: view-in .36s cubic-bezier(.2, .7, .2, 1) both; }
    #view.view-enter > *:nth-child(2) { animation-delay: .055s; }
    #view.view-enter > *:nth-child(3) { animation-delay: .1s; }
    .metrics { display: grid; grid-template-columns: 1.22fr repeat(3, minmax(0, 1fr)); border-top: 2px solid var(--ink); border-bottom: 1px solid var(--line-strong); background: var(--panel); }
    .metric { position: relative; min-height: 124px; padding: 22px 20px 18px 44px; border-right: 1px solid var(--line); overflow: hidden; }
    .metric:last-child { border-right: 0; }
    .metric::before { position: absolute; left: 14px; top: 23px; color: #9aa39d; font: 9px/1 var(--mono); }
    .metric:nth-child(1)::before { content: "01"; }
    .metric:nth-child(2)::before { content: "02"; }
    .metric:nth-child(3)::before { content: "03"; }
    .metric:nth-child(4)::before { content: "04"; }
    .metric:first-child { background: var(--graphite); color: white; }
    .metric:first-child::after { content: ""; position: absolute; right: -28px; bottom: -32px; width: 90px; height: 90px; border: 12px solid var(--accent); transform: rotate(45deg); opacity: .9; }
    .metric:first-child .metric-label, .metric:first-child .metric-note { color: #9fa9a2; }
    .metric:first-child::before { color: var(--accent); }
    .metric-label { color: var(--muted); font: 700 9px/1 var(--mono); text-transform: uppercase; }
    .metric-value { margin-top: 14px; font: 800 36px/.9 var(--display); }
    .metric-note { margin-top: 12px; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .section { margin-top: 40px; }
    .section-head { min-height: 42px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
    .section-head > div:first-child { display: grid; grid-template-columns: auto 1fr; align-items: baseline; column-gap: 12px; }
    .section-head > div:first-child::before { content: "//"; color: var(--accent-strong); font: 700 11px/1 var(--mono); }
    h2 { margin: 0; font: 700 19px/1.15 var(--display); text-transform: uppercase; }
    .section-note { grid-column: 2; margin: 6px 0 0; color: var(--muted); font-size: 11px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .resource-controls { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 14px; margin-bottom: 12px; }
    .filter-strip { min-width: 0; display: inline-flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid var(--line-strong); background: #e7eae3; overflow-x: auto; scrollbar-width: none; }
    .filter-strip::-webkit-scrollbar { display: none; }
    .filter-button { min-height: 32px; display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border: 0; border-radius: 1px; background: transparent; color: #5c6660; white-space: nowrap; font: 700 9px/1 var(--mono); text-transform: uppercase; }
    .filter-button:hover { background: #f4f6f1; color: var(--ink); }
    .filter-button[aria-pressed="true"] { background: var(--graphite); color: white; box-shadow: inset 0 -2px 0 var(--accent); }
    .filter-count { min-width: 18px; height: 18px; display: grid; place-items: center; padding: 0 4px; border: 1px solid #b9c0bb; background: rgba(255, 255, 255, .45); color: #59635d; font-size: 8px; }
    .filter-button[aria-pressed="true"] .filter-count { border-color: #5c675f; background: var(--accent); color: var(--ink); }
    .btn {
      min-height: 37px; display: inline-flex; align-items: center; justify-content: center; gap: 7px; padding: 7px 13px;
      border: 1px solid var(--line-strong); border-radius: 2px; background: var(--panel); color: var(--ink); font-weight: 700; font-size: 11px;
      transition: transform .14s ease, border-color .14s ease, background .14s ease, box-shadow .14s ease;
    }
    .btn:hover { border-color: #707a74; background: #f5f7f1; transform: translateY(-1px); }
    .btn:active { transform: translateY(0); }
    .btn.primary { border-color: #8cab24; background: var(--accent); color: #101510; box-shadow: 3px 3px 0 var(--ink); }
    .btn.primary:hover { background: #c9f337; box-shadow: 1px 1px 0 var(--ink); transform: translate(2px, 2px); }
    .btn.danger { border-color: #e0aaa6; color: #a43b35; background: #fffafa; }
    .btn.ghost { border-color: transparent; background: transparent; color: var(--muted); }
    .btn.icon { width: 37px; padding: 0; font: 700 16px/1 var(--mono); }
    .table-wrap { width: 100%; overflow: auto; border: 1px solid var(--line-strong); border-top: 0; background: var(--panel); box-shadow: 5px 5px 0 rgba(16, 21, 19, .07); }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th { position: sticky; top: 0; z-index: 1; padding: 12px; border-bottom: 1px solid #343b37; background: var(--graphite); color: #aeb7b1; font: 700 9px/1 var(--mono); text-align: left; text-transform: uppercase; vertical-align: middle; white-space: nowrap; }
    td { padding: 14px 12px; border-bottom: 1px solid var(--line); vertical-align: middle; transition: background .14s ease; }
    tr:last-child td { border-bottom: 0; }
    tbody tr:hover td { background: #f4f7ed; }
    tbody tr:hover td:first-child { box-shadow: inset 3px 0 0 var(--accent-strong); }
    .name-button { padding: 0; border: 0; background: transparent; color: var(--ink); font-weight: 700; text-align: left; }
    .name-button:hover { color: var(--blue); text-decoration: underline; text-underline-offset: 3px; }
    .mono { font-family: var(--mono); font-size: 11px; }
    .muted { color: var(--muted); }
    .truncate { max-width: 420px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .row-actions { display: flex; align-items: center; justify-content: flex-end; gap: 5px; white-space: nowrap; }
    .tag { display: inline-flex; align-items: center; min-height: 22px; padding: 3px 7px; border: 1px solid var(--line); border-radius: 2px; background: #f4f6f1; color: #525b57; font: 700 9px/1 var(--mono); text-transform: uppercase; }
    .tag.green { border-color: #b4cf6f; background: #f1f8dc; color: #536b1c; }
    .tag.amber { border-color: #e3bf75; background: #fff7e5; color: #845c12; }
    .tag.red { border-color: #e5b0ab; background: var(--red-soft); color: #973a34; }
    .tags { display: flex; gap: 4px; flex-wrap: wrap; }
    .dot { width: 8px; height: 8px; display: inline-block; border-radius: 50%; background: #aeb5b9; }
    .dot.online { background: var(--accent-strong); box-shadow: 0 0 0 3px #edf6d8; }
    .empty { padding: 60px 20px; border: 1px solid var(--line-strong); border-top: 2px solid var(--ink); background: var(--panel); text-align: center; }
    .empty strong { display: block; font-size: 15px; }
    .empty span { display: block; margin-top: 7px; color: var(--muted); font-size: 12px; }
    .preset-list { border: 1px solid var(--line-strong); border-top: 2px solid var(--ink); box-shadow: 5px 5px 0 rgba(16, 21, 19, .07); }
    .preset-row { position: relative; display: grid; grid-template-columns: 190px minmax(0, 1fr) auto; gap: 24px; align-items: center; padding: 20px 14px 20px 22px; border-bottom: 1px solid var(--line); background: var(--panel); }
    .preset-row::before { content: ""; position: absolute; left: 0; top: 0; bottom: 0; width: 4px; background: var(--accent); opacity: 0; transition: opacity .14s ease; }
    .preset-row:hover::before { opacity: 1; }
    .preset-title { font: 700 16px/1 var(--display); text-transform: uppercase; }
    .preset-count { margin-top: 6px; color: var(--muted); font: 9px/1 var(--mono); }
    .command { max-width: 420px; padding: 8px 10px; background: #edf0e9; border-left: 3px solid var(--blue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 10px/1.3 var(--mono); }
    dialog { width: min(620px, calc(100vw - 28px)); max-height: calc(100vh - 36px); padding: 0; border: 1px solid #747e78; border-top: 4px solid var(--accent); border-radius: var(--radius); background: var(--panel); color: var(--ink); box-shadow: var(--shadow); }
    dialog[open] { animation: dialog-in .18s cubic-bezier(.2, .75, .25, 1); }
    dialog::backdrop { background: rgba(11, 15, 13, .64); backdrop-filter: blur(3px); }
    .dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px 20px; border-bottom: 1px solid var(--line); background: #f2f4ee; }
    .dialog-head h2 { font-size: 17px; }
    .dialog-body { padding: 22px 24px 24px; overflow: auto; }
    .dialog-actions { position: relative; z-index: 1; display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px; border-top: 1px solid var(--line); background: #ecefe8; }
    #form-body { display: grid; gap: 18px; }
    .field { display: grid; gap: 8px; margin: 0; }
    .field label, .field-label { color: #4b5550; font: 700 10px/1.2 var(--mono); text-transform: uppercase; }
    .field input, .field textarea { width: 100%; min-height: 44px; padding: 10px 12px; border: 1px solid var(--line-strong); border-radius: 2px; background: #fdfefb; color: var(--ink); transition: border-color .14s ease, box-shadow .14s ease, background .14s ease; }
    .field input:hover, .field textarea:hover { border-color: #758078; background: white; }
    .field input:focus, .field textarea:focus { border-color: var(--blue); box-shadow: 0 0 0 3px rgba(23, 109, 146, .12); outline: 0; background: white; }
    .field input::placeholder, .field textarea::placeholder { color: #99a19c; }
    .field textarea { min-height: 96px; resize: vertical; font-family: var(--mono); font-size: 11px; line-height: 1.55; }
    .field textarea.source-editor { min-height: min(52vh, 520px); tab-size: 2; }
    #form-dialog:has(.source-editor) { width: min(820px, calc(100vw - 28px)); }
    .field small { color: var(--muted); font-size: 11px; }
    .field-row { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; }
    .select-shell { position: relative; min-width: 0; }
    .select-trigger {
      position: relative; width: 100%; min-height: 44px; display: flex; align-items: center; padding: 10px 42px 10px 12px;
      border: 1px solid var(--line-strong); border-radius: 2px; background: #fdfefb; color: var(--ink); text-align: left;
      font-size: 13px; transition: border-color .14s ease, box-shadow .14s ease, background .14s ease;
    }
    .select-trigger:hover { border-color: #758078; background: white; }
    .select-trigger::before { content: ""; position: absolute; top: -1px; right: -1px; width: 12px; height: 12px; border-top: 2px solid var(--accent-strong); border-right: 2px solid var(--accent-strong); }
    .select-trigger::after { content: ""; position: absolute; right: 15px; top: 16px; width: 7px; height: 7px; border-right: 1.5px solid #45504a; border-bottom: 1.5px solid #45504a; transform: rotate(45deg); transition: transform .14s ease, top .14s ease; }
    .select-shell.open .select-trigger { border-color: var(--blue); background: white; box-shadow: 0 0 0 3px rgba(23, 109, 146, .12); outline: 0; }
    .select-shell.open .select-trigger::after { top: 19px; transform: rotate(225deg); }
    .select-label { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .select-menu {
      position: absolute; z-index: 40; top: calc(100% + 6px); left: 0; right: 0; max-height: 224px; overflow: auto; padding: 5px;
      border: 1px solid #4b554f; border-radius: 2px; background: var(--graphite); box-shadow: 7px 8px 0 rgba(16, 21, 19, .16), 0 18px 36px rgba(16, 21, 19, .22);
      animation: menu-in .14s cubic-bezier(.2, .75, .25, 1);
    }
    .select-menu[hidden] { display: none; }
    .select-option {
      position: relative; width: 100%; min-height: 38px; display: flex; align-items: center; padding: 8px 34px 8px 11px;
      border: 0; border-left: 3px solid transparent; border-radius: 1px; background: transparent; color: #c8d0cb; text-align: left; font-size: 12px;
    }
    .select-option:hover, .select-option:focus { border-left-color: var(--blue); background: #29312d; color: white; outline: 0; }
    .select-option[aria-selected="true"] { border-left-color: var(--accent); background: var(--accent); color: var(--ink); font-weight: 700; }
    .select-option[aria-selected="true"]::after { content: ""; position: absolute; right: 14px; width: 7px; height: 7px; background: var(--ink); transform: rotate(45deg); }
    #form-dialog:has(.select-shell) { overflow: visible; }
    #form-dialog:has(.select-shell) .dialog-body { overflow: visible; }
    .check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .check { min-height: 40px; display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 2px; background: #f7f9f4; font-size: 11px; }
    .check input { width: 16px; height: 16px; accent-color: #90b62e; }
    .row-check { width: 16px; height: 16px; display: block; accent-color: #90b62e; }
    .select-cell { width: 42px; }
    .detail-meta { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 8px 14px; margin-bottom: 18px; font-size: 12px; }
    .detail-meta dt { color: var(--muted); font-family: var(--mono); }
    .detail-meta dd { margin: 0; overflow-wrap: anywhere; }
    pre { margin: 0; padding: 16px; border: 1px solid var(--line); border-left: 3px solid var(--blue); background: #eef1eb; overflow: auto; font: 10px/1.65 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
    .confirm-copy { margin: 0; color: #3f474c; font-size: 13px; line-height: 1.6; white-space: pre-line; }
    .toast-region { position: fixed; right: 18px; bottom: 18px; z-index: 20; display: grid; gap: 8px; width: min(360px, calc(100vw - 36px)); }
    .toast { padding: 13px 15px; border: 1px solid #707a74; border-left: 4px solid var(--accent); border-radius: 2px; background: var(--graphite); color: white; box-shadow: var(--shadow); font-size: 11px; animation: toast-in .18s ease-out; }
    .toast.error { border-left-color: #e7655d; }
    .busy { position: fixed; inset: 0; z-index: 30; display: none; place-items: center; background: rgba(247, 248, 246, .7); backdrop-filter: blur(2px); }
    .busy.show { display: grid; }
    .busy-mark { width: 44px; height: 44px; border: 3px solid #cbd0ca; border-top-color: var(--accent-strong); border-radius: 50%; animation: spin .75s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    @keyframes pulse { 50% { opacity: .48; transform: scale(.82); } }
    @keyframes view-in { from { opacity: 0; transform: translateY(10px); } }
    @keyframes dialog-in { from { opacity: 0; transform: translateY(12px) scale(.985); } }
    @keyframes menu-in { from { opacity: 0; transform: translateY(-5px); } }
    @keyframes toast-in { from { transform: translateY(8px); opacity: 0; } }
    @media (max-width: 900px) {
      .app { width: 100%; grid-template-columns: minmax(0, 1fr); }
      .sidebar { position: sticky; z-index: 10; width: 100%; height: auto; border-right: 0; border-bottom: 1px solid #343a3f; }
      .main { width: 100%; max-width: 100vw; }
      .brand { height: 68px; padding: 12px 16px; }
      .brand::after { display: none; }
      .brand-mark { width: 36px; height: 36px; flex-basis: 36px; }
      .brand-meta, .sidebar-foot, .nav-label { display: none; }
      .nav { display: flex; gap: 4px; overflow-x: auto; padding: 7px 10px 9px; }
      .nav button { width: auto; min-width: max-content; min-height: 38px; padding: 7px 11px; border: 0; border-bottom: 3px solid transparent; }
      .nav button::after { display: none; }
      .nav button.active { border: 0; border-bottom: 3px solid var(--accent); box-shadow: none; }
      .nav-code { display: none; }
      .topbar { min-height: 86px; padding: 14px 18px; }
      h1 { font-size: 26px; }
      .content { padding: 22px 18px 44px; }
      .resource-controls { align-items: stretch; flex-direction: column; }
      .filter-strip { width: 100%; }
      .resource-controls .toolbar { justify-content: flex-start; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric:nth-child(2) { border-right: 0; }
      .metric:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
      .metric { min-height: 110px; }
      .preset-row { grid-template-columns: 1fr auto; gap: 12px; }
      .preset-row .tags { grid-column: 1 / -1; grid-row: 2; }
    }
    @media (max-width: 560px) {
      .brand { display: none; }
      .topbar { display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: center; gap: 10px; padding-right: 18px; }
      .title-block { min-width: 0; gap: 12px; }
      .title-block > div:last-child { min-width: 0; }
      h1 { font-size: 24px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
      .system-state { display: none; }
      .topbar-tools { position: static; min-width: 0; gap: 8px; }
      .top-actions { flex-wrap: nowrap; }
      .top-actions .btn:not(.primary) { display: none; }
      .top-actions .btn.primary { min-width: 72px; }
      .metrics { grid-template-columns: 1fr 1fr; }
      .metric { min-height: 102px; padding: 16px 12px 14px 34px; }
      .metric::before { left: 10px; top: 17px; }
      .metric-value { font-size: 29px; }
      .metric:first-child::after { width: 65px; height: 65px; right: -28px; bottom: -32px; border-width: 8px; }
      .section-head { align-items: stretch; flex-direction: column; }
      .toolbar { justify-content: flex-start; }
      .check-grid { grid-template-columns: 1fr; }
      .dialog-actions { position: sticky; bottom: 0; }
      .preset-row { grid-template-columns: 1fr; }
      .preset-row .tags { grid-column: 1; grid-row: auto; }
      .preset-row .row-actions { justify-content: flex-start; }
      th, td { padding: 11px 9px; }
    }
    @media (prefers-reduced-motion: reduce) {
      *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; animation-iteration-count: 1 !important; transition-duration: .01ms !important; }
    }
  </style>
</head>
<body>
  <div class="app">
    <aside class="sidebar">
      <div class="brand"><div class="brand-mark">TM</div><div><div class="brand-name">Tools Manager</div><div class="brand-meta">LOCAL CONTROL PLANE</div></div></div>
      <nav class="nav" aria-label="Primary navigation">
        <div class="nav-label">Workspace</div>
        <button data-view="dashboard"><span class="nav-code">01</span><span>Dashboard</span></button>
        <button data-view="skills"><span class="nav-code">02</span><span>Skills</span></button>
        <button data-view="presets"><span class="nav-code">03</span><span>Presets</span></button>
        <button data-view="mcp"><span class="nav-code">04</span><span>MCP Servers</span></button>
        <button data-view="agents"><span class="nav-code">05</span><span>Agents</span></button>
      </nav>
      <div class="sidebar-foot"><div class="connection-line"><span class="status-pulse"></span><span>LOCAL SESSION</span></div><div id="server-address"></div></div>
    </aside>
    <main class="main">
      <header class="topbar"><div class="title-block"><div class="title-index" id="page-index">01</div><div><div class="eyebrow" id="page-eyebrow">Workspace overview</div><h1 id="page-title">Dashboard</h1></div></div><div class="topbar-tools"><div class="system-state"><strong id="runtime-mode">Local session</strong><span>127.0.0.1</span></div><div class="top-actions" id="top-actions"></div></div></header>
      <div class="content" id="view"></div>
    </main>
  </div>

  <dialog id="form-dialog"><form id="dynamic-form"><div class="dialog-head"><h2 id="form-title"></h2><button type="button" class="btn icon ghost" data-close aria-label="Close">&times;</button></div><div class="dialog-body" id="form-body"></div><div class="dialog-actions"><button type="button" class="btn" data-close>Cancel</button><button type="submit" class="btn primary" id="form-submit">Save</button></div></form></dialog>
  <dialog id="detail-dialog"><div class="dialog-head"><h2 id="detail-title"></h2><button type="button" class="btn icon ghost" data-close aria-label="Close">&times;</button></div><div class="dialog-body" id="detail-body"></div><div class="dialog-actions"><button type="button" class="btn" data-close>Close</button></div></dialog>
  <dialog id="confirm-dialog"><div class="dialog-head"><h2 id="confirm-title">Confirm action</h2><button type="button" class="btn icon ghost" data-confirm="false" aria-label="Close">&times;</button></div><div class="dialog-body"><p class="confirm-copy" id="confirm-copy"></p></div><div class="dialog-actions"><button type="button" class="btn" data-confirm="false">Cancel</button><button type="button" class="btn danger" data-confirm="true">Confirm</button></div></dialog>
  <div class="toast-region" id="toasts" aria-live="polite"></div>
  <div class="busy" id="busy" aria-hidden="true"><div class="busy-mark"></div></div>

  <script>
    const TOKEN = "__TM_TOKEN__";
    const DEV = __TM_DEV__;
    const TOOLS = ["all", "codex", "claude_code", "cursor", "opencode"];
    const state = { data: null, view: location.hash.slice(1) || "dashboard", skillFilter: "all", mcpFilter: "all", formHandler: null, confirmResolve: null };
    const titles = {
      dashboard: ["Workspace overview", "Dashboard"],
      skills: ["Managed resources", "Skills"],
      presets: ["Deployment groups", "Skill Presets"],
      mcp: ["Managed integrations", "MCP Servers"],
      agents: ["Local destinations", "Agents"]
    };

    const view = document.getElementById("view");
    const busy = document.getElementById("busy");
    document.getElementById("server-address").textContent = location.host;
    document.getElementById("runtime-mode").textContent = DEV ? "Watch mode" : "Local session";

    function esc(value) {
      return String(value == null ? "" : value).replace(/[&<>"']/g, function(char) {
        return { "&": "&amp;", "<": "&lt;", ">": "&gt;", "\"": "&quot;", "'": "&#39;" }[char];
      });
    }
    function toolOptions(selected) {
      return TOOLS.map(function(tool) { return { value: tool, label: tool, selected: tool === selected }; });
    }
    function presetOptions(selected) {
      return state.data.presets.map(function(preset) { return { value: preset.name, label: preset.name, selected: preset.name === selected }; });
    }
    function tags(items, tone) {
      if (!items || !items.length) return '<span class="muted">none</span>';
      return '<div class="tags">' + items.map(function(item) { return '<span class="tag ' + (tone || '') + '">' + esc(item) + '</span>'; }).join("") + '</div>';
    }
    function empty(title, note) { return '<div class="empty"><strong>' + esc(title) + '</strong><span>' + esc(note) + '</span></div>'; }
    function sectionHead(title, note, actions) { return '<div class="section-head"><div><h2>' + esc(title) + '</h2><p class="section-note">' + esc(note) + '</p></div><div class="toolbar">' + (actions || '') + '</div></div>'; }
    function toolLabel(tool) {
      if (tool === "all") return "All";
      const agent = state.data.agents.find(function(item) { return item.tool === tool; });
      return agent ? agent.displayName : tool;
    }
    function filteredResources(kind, tool) {
      const resources = kind === "skill" ? state.data.skills : state.data.mcpServers;
      if (tool === "all") return resources;
      const agent = state.data.agents.find(function(item) { return item.tool === tool; });
      if (!agent) return [];
      const visible = new Set((kind === "skill" ? agent.skills : agent.mcpServers).map(function(item) { return item.name; }));
      return resources.filter(function(item) { return visible.has(item.name); });
    }
    function filterStrip(kind) {
      const active = state[kind + "Filter"];
      const buttons = TOOLS.map(function(tool) {
        const count = filteredResources(kind, tool).length;
        return '<button type="button" class="filter-button" data-filter-scope="' + kind + '" data-filter-value="' + tool + '" aria-pressed="' + (tool === active) + '"><span>' + esc(toolLabel(tool)) + '</span><span class="filter-count">' + count + '</span></button>';
      }).join("");
      return '<div class="filter-strip" role="group" aria-label="Filter by Agent">' + buttons + '</div>';
    }

    async function api(path, options) {
      const init = options || {};
      const headers = Object.assign({ "Accept": "application/json" }, init.headers || {});
      if (init.body) headers["Content-Type"] = "application/json";
      if ((init.method || "GET") !== "GET") headers["X-TM-Token"] = TOKEN;
      const response = await fetch(path, Object.assign({}, init, { headers: headers }));
      const payload = await response.json().catch(function() { return {}; });
      if (!response.ok) throw new Error(payload.error || "Request failed.");
      return payload;
    }
    async function load(showBusy) {
      if (showBusy !== false) setBusy(true);
      try { state.data = await api("/api/snapshot"); render(); }
      catch (error) { toast(error.message, true); }
      finally { setBusy(false); }
    }
    function setBusy(active) { busy.classList.toggle("show", active); busy.setAttribute("aria-hidden", active ? "false" : "true"); }
    function toast(message, error) {
      const node = document.createElement("div");
      node.className = "toast" + (error ? " error" : "");
      node.textContent = message;
      document.getElementById("toasts").appendChild(node);
      setTimeout(function() { node.remove(); }, 3600);
    }
    function watchDevelopmentServer() {
      const source = new EventSource("/api/dev-events");
      source.onmessage = function(event) {
        const previousBoot = sessionStorage.getItem("tm-web-dev-boot");
        sessionStorage.setItem("tm-web-dev-boot", event.data);
        if (previousBoot && previousBoot !== event.data) location.reload();
      };
    }

    function render() {
      if (!state.data) return;
      if (!titles[state.view]) state.view = "dashboard";
      const title = titles[state.view];
      document.getElementById("page-eyebrow").textContent = title[0];
      document.getElementById("page-title").textContent = title[1];
      document.getElementById("page-index").textContent = String(Object.keys(titles).indexOf(state.view) + 1).padStart(2, "0");
      document.querySelectorAll("[data-view]").forEach(function(node) { node.classList.toggle("active", node.dataset.view === state.view); });
      document.getElementById("top-actions").innerHTML = topActions();
      if (state.view === "dashboard") renderDashboard();
      if (state.view === "skills") renderSkills();
      if (state.view === "presets") renderPresets();
      if (state.view === "mcp") renderMcp();
      if (state.view === "agents") renderAgents();
      view.classList.remove("view-enter");
      void view.offsetWidth;
      view.classList.add("view-enter");
    }
    function topActions() {
      const refresh = '<button class="btn icon" data-action="refresh" aria-label="Refresh" title="Refresh">↻</button>';
      if (state.view === "skills") return refresh + '<button class="btn primary" data-action="add-skill">Add skill</button>';
      if (state.view === "mcp") return refresh + '<button class="btn primary" data-action="add-mcp">Add server</button>';
      if (state.view === "presets") return refresh + '<button class="btn primary" data-action="sync-skills">Apply preset</button>';
      return refresh + '<button class="btn primary" data-action="backup">Backup</button>';
    }
    function metrics() {
      const data = state.data;
      const installed = data.status.tools.filter(function(tool) { return tool.installed; }).length;
      return '<div class="metrics">' +
        metric("Managed skills", data.skills.length, data.status.skillsDir) +
        metric("Presets", data.presets.length, "deployment groups") +
        metric("MCP servers", data.mcpServers.length, "managed definitions") +
        metric("Agents online", installed + "/" + data.status.tools.length, "detected locally") +
      '</div>';
    }
    function metric(label, value, note) { return '<div class="metric"><div class="metric-label">' + esc(label) + '</div><div class="metric-value">' + esc(value) + '</div><div class="metric-note">' + esc(note) + '</div></div>'; }

    function renderDashboard() {
      const recent = state.data.skills.slice(0, 6);
      view.innerHTML = metrics() +
        '<section class="section">' + sectionHead("Managed inventory", recent.length + " recent definitions", '<button class="btn" data-view="skills">Open skills</button>') + skillTable(recent, false) + '</section>' +
        '<section class="section">' + sectionHead("Agent readiness", state.data.agents.length + " configured destinations", '<button class="btn" data-view="agents">Open agents</button>') + agentTable(state.data.agents) + '</section>';
    }
    function skillTable(skills, actions, filter) {
      if (!skills.length) return filter && filter !== "all"
        ? empty("No matching skills", toolLabel(filter) + " has no matching managed skills.")
        : empty("No managed skills", "The skill registry is empty.");
      const selectable = actions && filter === "all";
      const rows = skills.map(function(skill) {
        const agentLink = filter && filter !== "all" && skill.agentLinks.some(function(link) { return link.tool === filter; });
        const removeAction = filter && filter !== "all"
          ? (agentLink
            ? '<button class="btn danger" data-action="delete-skill" data-name="' + esc(skill.name) + '" data-tool="' + esc(filter) + '">Remove</button>'
            : '<button class="btn danger" disabled title="This Agent skill is not a managed symlink">Remove</button>')
          : '<button class="btn danger" data-action="delete-skill" data-name="' + esc(skill.name) + '" data-tool="all">Remove</button>';
        const syncAction = filter === "all" ? '<button class="btn" data-action="sync-one-skill" data-name="' + esc(skill.name) + '">Sync</button>' : '';
        return '<tr>' + (selectable ? '<td class="select-cell"><input class="row-check" type="checkbox" data-resource-select="skill" value="' + esc(skill.name) + '" aria-label="Select ' + esc(skill.name) + '"></td>' : '') +
          '<td><button class="name-button mono" data-action="edit-skill" data-name="' + esc(skill.name) + '">' + esc(skill.name) + '</button></td>' +
          '<td><span class="tag">' + esc(skill.source_type) + '</span></td><td><div class="truncate">' + esc(skill.description || "No description") + '</div></td>' +
          '<td class="mono muted">' + esc((skill.updated_at || "").replace("T", " ")) + '</td>' +
          (actions ? '<td><div class="row-actions">' + syncAction + removeAction + '</div></td>' : '') + '</tr>';
      }).join("");
      return '<div class="table-wrap"><table><thead><tr>' + (selectable ? '<th class="select-cell"><input class="row-check" type="checkbox" data-resource-select-all="skill" aria-label="Select all skills"></th>' : '') + '<th>Name</th><th>Source</th><th>Description</th><th>Updated</th>' + (actions ? '<th></th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function renderSkills() {
      const skills = filteredResources("skill", state.skillFilter);
      const selectedAction = state.skillFilter === "all" ? '<button class="btn primary" data-action="sync-selected-skills" data-sync-selected="skill" disabled>Sync selected</button>' : '';
      const actions = selectedAction + '<button class="btn" data-action="import-agent-skills">Import from Agent</button>';
      const controls = '<div class="resource-controls">' + filterStrip("skill") + '<div class="toolbar">' + actions + '</div></div>';
      view.innerHTML = metrics() + '<section class="section">' + sectionHead("Skill registry", skills.length + " of " + state.data.skills.length + " managed definitions", "") + controls + skillTable(skills, true, state.skillFilter) + '</section>';
    }
    function renderPresets() {
      const rows = state.data.presets.map(function(preset) {
        const hasDestination = state.data.presets.some(function(candidate) { return candidate.name !== preset.name; });
        const canMove = preset.skills.length > 0 && hasDestination;
        const moveTitle = preset.skills.length === 0 ? "This preset has no skills to move" : "Create another preset before moving a skill";
        const moveButton = '<button class="btn" data-action="move-skill" data-preset="' + esc(preset.name) + '"' + (canMove ? '' : ' disabled title="' + moveTitle + '"') + '>Move Skill</button>';
        const removeButton = '<button class="btn danger" data-action="remove-preset-skill" data-preset="' + esc(preset.name) + '"' + (preset.skills.length ? '' : ' disabled title="This preset has no skills to remove"') + '>Remove Skill</button>';
        return '<div class="preset-row"><div><div class="preset-title">' + esc(preset.name) + '</div><div class="preset-count">' + preset.skill_count + ' skills</div></div>' +
          tags(preset.skills, "green") + '<div class="row-actions">' + moveButton + removeButton + '<button class="btn primary" data-action="apply-preset" data-preset="' + esc(preset.name) + '">Apply</button></div></div>';
      }).join("");
      view.innerHTML = '<section>' + sectionHead("Deployment groups", state.data.presets.length + " skill presets", "") + '<div class="preset-list">' + rows + '</div></section>';
    }
    function renderMcp() {
      const servers = filteredResources("mcp", state.mcpFilter);
      const selectable = state.mcpFilter === "all";
      const rows = servers.map(function(server) {
        const endpoint = server.transport === "http" ? server.url : [server.command].concat(server.args).join(" ");
        const syncAction = state.mcpFilter === "all" ? '<button class="btn" data-action="sync-one-mcp" data-name="' + esc(server.name) + '"' + (server.enabled ? '' : ' disabled title="Enable this MCP server before syncing"') + '>Sync</button>' : '';
        return '<tr>' + (selectable ? '<td class="select-cell"><input class="row-check" type="checkbox" data-resource-select="mcp" value="' + esc(server.name) + '"' + (server.enabled ? '' : ' disabled') + ' aria-label="Select ' + esc(server.name) + '"></td>' : '') + '<td><button class="name-button mono" data-action="edit-mcp" data-name="' + esc(server.name) + '">' + esc(server.name) + '</button></td><td><span class="tag">' + esc(server.transport) + '</span></td><td><div class="command" title="' + esc(endpoint) + '">' + esc(endpoint) + '</div></td><td>' + tags(server.targetTools, "amber") + '</td><td><span class="tag ' + (server.enabled ? 'green' : 'red') + '">' + (server.enabled ? 'enabled' : 'disabled') + '</span></td><td><div class="row-actions">' + syncAction + '<button class="btn danger" data-action="delete-mcp" data-name="' + esc(server.name) + '">Remove</button></div></td></tr>';
      }).join("");
      const table = rows ? '<div class="table-wrap"><table><thead><tr>' + (selectable ? '<th class="select-cell"><input class="row-check" type="checkbox" data-resource-select-all="mcp" aria-label="Select all enabled MCP servers"></th>' : '') + '<th>Name</th><th>Transport</th><th>Endpoint</th><th>Targets</th><th>Status</th><th></th></tr></thead><tbody>' + rows + '</tbody></table></div>' : state.mcpFilter === "all"
        ? empty("No MCP servers", "The MCP registry is empty.")
        : empty("No matching MCP servers", toolLabel(state.mcpFilter) + " has no matching managed MCP servers.");
      const selectedAction = state.mcpFilter === "all" ? '<button class="btn primary" data-action="sync-selected-mcp" data-sync-selected="mcp" disabled>Sync selected</button>' : '';
      const actions = selectedAction + '<button class="btn" data-action="import-agent-mcp">Import from Agent</button><button class="btn" data-action="sync-mcp">Sync to Agents</button>';
      const controls = '<div class="resource-controls">' + filterStrip("mcp") + '<div class="toolbar">' + actions + '</div></div>';
      view.innerHTML = '<section>' + sectionHead("Server registry", servers.length + " of " + state.data.mcpServers.length + " managed definitions", "") + controls + table + '</section>';
    }
    function renderAgents() {
      view.innerHTML = '<section>' + sectionHead("Local Agent destinations", state.data.agents.length + " configured tools", '') + agentTable(state.data.agents) + '</section>';
    }
    function agentTable(agents) {
      const tools = state.data.status.tools;
      const rows = agents.map(function(agent) {
        const installed = tools.find(function(tool) { return tool.key === agent.tool; });
        return '<tr><td><span class="dot ' + (installed && installed.installed ? 'online' : '') + '"></span></td><td><strong>' + esc(agent.displayName) + '</strong><div class="mono muted">' + esc(agent.tool) + '</div></td>' +
          '<td><strong>' + agent.skills.length + '</strong><div class="muted">skills</div></td><td><strong>' + agent.mcpServers.length + '</strong><div class="muted">servers</div></td>' +
          '<td><div class="mono truncate" title="' + esc(agent.skillsPath) + '">' + esc(agent.skillsPath) + '</div><div class="mono muted truncate" title="' + esc(agent.mcpPath) + '">' + esc(agent.mcpPath) + '</div></td></tr>';
      }).join("");
      return '<div class="table-wrap"><table><thead><tr><th></th><th>Agent</th><th>Skills</th><th>MCP</th><th>Paths</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function openForm(title, body, submit, handler, danger) {
      document.getElementById("form-title").textContent = title;
      document.getElementById("form-body").innerHTML = body;
      const submitButton = document.getElementById("form-submit");
      submitButton.textContent = submit;
      submitButton.className = "btn " + (danger ? "danger" : "primary");
      state.formHandler = handler;
      document.getElementById("form-dialog").showModal();
      requestAnimationFrame(function() {
        document.querySelector("#form-body input:not([type=hidden]), #form-body [data-select-trigger], #form-body textarea")?.focus();
      });
    }
    function field(label, name, value, placeholder, type) {
      return '<div class="field"><label for="field-' + name + '">' + esc(label) + '</label><input id="field-' + name + '" name="' + name + '" type="' + (type || 'text') + '" value="' + esc(value || '') + '" placeholder="' + esc(placeholder || '') + '" required></div>';
    }
    function textareaField(label, name, value, placeholder, className) {
      return '<div class="field"><label for="field-' + name + '">' + esc(label) + '</label><textarea id="field-' + name + '" name="' + name + '" class="' + esc(className || '') + '" placeholder="' + esc(placeholder || '') + '">' + esc(value || '') + '</textarea></div>';
    }
    function selectField(label, name, options) {
      const selected = options.find(function(option) { return option.selected; }) || options[0] || { value: "", label: "" };
      const optionRows = options.map(function(option) {
        const active = option.value === selected.value;
        return '<button type="button" class="select-option" role="option" tabindex="-1" data-select-option data-value="' + esc(option.value) + '" aria-selected="' + active + '">' + esc(option.label) + '</button>';
      }).join("");
      return '<div class="field"><label id="label-' + name + '" for="field-' + name + '">' + esc(label) + '</label><div class="select-shell"><input type="hidden" name="' + name + '" value="' + esc(selected.value) + '"><button id="field-' + name + '" type="button" class="select-trigger" data-select-trigger aria-haspopup="listbox" aria-expanded="false" aria-labelledby="label-' + name + ' field-' + name + '"><span class="select-label" data-select-label>' + esc(selected.label) + '</span></button><div class="select-menu" role="listbox" aria-labelledby="label-' + name + '" hidden>' + optionRows + '</div></div></div>';
    }
    function closeSelectMenus(except) {
      document.querySelectorAll(".select-shell.open").forEach(function(shell) {
        if (shell === except) return;
        shell.classList.remove("open");
        shell.querySelector("[data-select-trigger]").setAttribute("aria-expanded", "false");
        shell.querySelector(".select-menu").hidden = true;
      });
    }
    function toggleSelectMenu(trigger, forceOpen) {
      const shell = trigger.closest(".select-shell");
      const menu = shell.querySelector(".select-menu");
      const opening = forceOpen === undefined ? !shell.classList.contains("open") : forceOpen;
      closeSelectMenus(shell);
      shell.classList.toggle("open", opening);
      trigger.setAttribute("aria-expanded", String(opening));
      menu.hidden = !opening;
      if (opening) requestAnimationFrame(function() { (menu.querySelector('[aria-selected="true"]') || menu.querySelector("[data-select-option]"))?.focus(); });
    }
    function chooseSelectOption(option) {
      const shell = option.closest(".select-shell");
      const trigger = shell.querySelector("[data-select-trigger]");
      shell.querySelector("input[type=hidden]").value = option.dataset.value;
      shell.querySelector("[data-select-label]").textContent = option.textContent.trim();
      shell.querySelectorAll("[data-select-option]").forEach(function(item) { item.setAttribute("aria-selected", String(item === option)); });
      toggleSelectMenu(trigger, false);
      if (shell.querySelector('input[name="transport"]')) updateMcpTransport(shell.closest("form"));
      trigger.focus();
    }
    function openAddSkill() {
      openForm("Add managed skill", field("Local path or Git source", "source", "", "./my-skill or git@host:group/repo.git#main:path"), "Import", async function(form) {
        const payload = await api("/api/skills/import", { method: "POST", body: JSON.stringify({ source: form.get("source") }) });
        return "Imported " + payload.skills.length + " skill" + (payload.skills.length === 1 ? "" : "s") + ".";
      });
    }
    function openImport(kind) {
      const noun = kind === "skills" ? "skills" : "MCP servers";
      openForm("Import " + noun + " from Agent", selectField("Agent", "tool", toolOptions("all")), "Import", async function(form) {
        const path = kind === "skills" ? "/api/skills/import-agent" : "/api/mcp/import";
        await api(path, { method: "POST", body: JSON.stringify({ tool: form.get("tool") }) });
        return "Imported " + noun + ".";
      });
    }
    function openSyncSkills(preset, fixedPreset) {
      const presetName = preset || "Default";
      const body = (fixedPreset ? "" : selectField("Preset", "preset", presetOptions(presetName))) +
        selectField("Agent", "tool", toolOptions("all")) +
        selectField("Sync mode", "mode", [
          { value: "", label: "Configured default", selected: true },
          { value: "symlink", label: "symlink" },
          { value: "copy", label: "copy" },
        ]);
      openForm(fixedPreset ? "Apply " + presetName : "Apply skill preset", body, "Apply", async function(form) {
        const selectedPreset = fixedPreset ? presetName : form.get("preset");
        const payload = await api("/api/presets/apply", { method: "POST", body: JSON.stringify({ preset: selectedPreset, tool: form.get("tool"), mode: form.get("mode") }) });
        return "Applied " + payload.results.length + " skill targets.";
      });
    }
    function openSyncSkill(names) {
      const body = selectField("Agent", "tool", toolOptions("all")) +
        selectField("Sync mode", "mode", [
          { value: "", label: "Configured default", selected: true },
          { value: "symlink", label: "symlink" },
          { value: "copy", label: "copy" },
        ]);
      const title = names.length === 1 ? "Sync " + names[0] : "Sync " + names.length + " skills";
      openForm(title, body, "Sync", async function(form) {
        const payload = await api("/api/skills/sync-selected", { method: "POST", body: JSON.stringify({ names: names, tool: form.get("tool"), mode: form.get("mode") }) });
        return "Synced " + names.length + " skill" + (names.length === 1 ? "" : "s") + " across " + payload.results.length + " Agent targets.";
      });
    }
    function openMoveSkill(preset) {
      const selectedPreset = state.data.presets.find(function(item) { return item.name === preset; });
      const skillOpts = (selectedPreset ? selectedPreset.skills : []).map(function(name, index) { return { value: name, label: name, selected: index === 0 }; });
      const destinationOpts = state.data.presets.filter(function(item) { return item.name !== preset; }).map(function(item, index) { return { value: item.name, label: item.name, selected: index === 0 }; });
      const body = selectField("Skill", "skill", skillOpts) + selectField("Destination preset", "to", destinationOpts);
      openForm("Move Skill", body, "Move", async function(form) {
        await api("/api/presets/move-skill", { method: "POST", body: JSON.stringify({ skill: form.get("skill"), from: preset, to: form.get("to") }) });
        return "Moved " + form.get("skill") + " to " + form.get("to") + ".";
      });
    }
    function openRemovePresetSkill(preset) {
      const selectedPreset = state.data.presets.find(function(item) { return item.name === preset; });
      const skillOpts = (selectedPreset ? selectedPreset.skills : []).map(function(name, index) { return { value: name, label: name, selected: index === 0 }; });
      openForm("Remove Skill from " + preset, selectField("Skill", "skill", skillOpts), "Remove", async function(form) {
        await api("/api/presets/remove-skill", { method: "POST", body: JSON.stringify({ skill: form.get("skill"), preset: preset }) });
        return "Removed " + form.get("skill") + " from " + preset + ".";
      }, true);
    }
    function mcpFormBody(server) {
      const checks = TOOLS.map(function(tool) {
        return '<label class="check"><input type="checkbox" name="targets" value="' + tool + '"' + (server.targetTools.includes(tool) ? ' checked' : '') + '><span>' + esc(toolLabel(tool)) + '</span></label>';
      }).join("");
      const env = Object.entries(server.env || {}).map(function(entry) { return entry[0] + "=" + entry[1]; }).join("\n");
      const headers = Object.entries(server.headers || {}).map(function(entry) { return entry[0] + "=" + entry[1]; }).join("\n");
      return field("Name", "name", server.name, "playwright") +
        selectField("Transport", "transport", [
          { value: "stdio", label: "Local process (stdio)", selected: server.transport !== "http" },
          { value: "http", label: "Remote (Streamable HTTP)", selected: server.transport === "http" },
        ]) +
        '<div data-mcp-transport="stdio">' + field("Command", "command", server.command, "npx") +
        textareaField("Arguments", "args", (server.args || []).join("\n"), "One argument per line") +
        textareaField("Environment", "env", env, "KEY=value, one per line") + '</div>' +
        '<div data-mcp-transport="http">' + field("URL", "url", server.url, "https://example.com/mcp", "url") +
        textareaField("HTTP headers", "headers", headers, "Authorization=Bearer ..., one per line") + '</div>' +
        '<div class="field"><span class="field-label">Target tools</span><div class="check-grid">' + checks + '</div></div>' +
        '<div class="field"><span class="field-label">Status</span><label class="check"><input type="checkbox" name="enabled"' + (server.enabled ? ' checked' : '') + '><span>Enabled</span></label></div>';
    }
    function mcpFormPayload(form, element) {
      function keyValues(name, label) {
        const values = {};
        String(form.get(name) || "").split(/\r?\n/).filter(Boolean).forEach(function(line) {
        const index = line.indexOf("=");
          if (index < 1) throw new Error(label + " entries must use KEY=value.");
          values[line.slice(0, index).trim()] = line.slice(index + 1).trim();
        });
        return values;
      }
      return {
        name: form.get("name"), transport: form.get("transport"), command: form.get("command") || "", url: form.get("url") || "",
        args: String(form.get("args") || "").split(/\r?\n/).map(function(value) { return value.trim(); }).filter(Boolean),
        env: keyValues("env", "Environment"), headers: keyValues("headers", "Header"),
        targetTools: Array.from(element.querySelectorAll('input[name="targets"]:checked')).map(function(input) { return input.value; }),
        enabled: Boolean(element.querySelector('input[name="enabled"]:checked')),
      };
    }
    function updateMcpTransport(form) {
      if (!form) return;
      const transport = form.querySelector('input[name="transport"]')?.value || "stdio";
      form.querySelectorAll("[data-mcp-transport]").forEach(function(section) {
        const active = section.dataset.mcpTransport === transport;
        section.hidden = !active;
        section.querySelectorAll("input, textarea").forEach(function(input) { input.disabled = !active; });
      });
    }
    function openAddMcp() {
      const server = { name: "", transport: "stdio", command: "", url: "", args: [], env: {}, headers: {}, targetTools: ["all"], enabled: true };
      openForm("Add MCP server", mcpFormBody(server), "Save server", async function(form, element) {
        const payload = mcpFormPayload(form, element);
        await api("/api/mcp", { method: "POST", body: JSON.stringify(payload) });
        return "Saved MCP server " + form.get("name") + ".";
      });
      updateMcpTransport(document.getElementById("dynamic-form"));
    }
    async function openEditMcp(name) {
      setBusy(true);
      try {
        const payload = await api("/api/mcp/" + encodeURIComponent(name));
        openForm("Edit MCP server", mcpFormBody(payload.server), "Save changes", async function(form, element) {
          const updated = mcpFormPayload(form, element);
          await api("/api/mcp/" + encodeURIComponent(name), { method: "PUT", body: JSON.stringify(updated) });
          return "Updated MCP server " + updated.name + ".";
        });
        updateMcpTransport(document.getElementById("dynamic-form"));
      } catch (error) { toast(error.message, true); }
      finally { setBusy(false); }
    }
    function openSyncMcp() {
      openForm("Sync MCP configuration", selectField("Agent", "tool", toolOptions("all")), "Sync", async function(form) {
        const payload = await api("/api/mcp/sync", { method: "POST", body: JSON.stringify({ tool: form.get("tool") }) });
        return "Updated " + payload.results.length + " Agent configurations.";
      });
    }
    function openSyncMcpServer(names) {
      const servers = state.data.mcpServers.filter(function(item) { return names.includes(item.name); });
      const eligible = TOOLS.slice(1).filter(function(tool) { return servers.every(function(server) { return server.targetTools.includes("all") || server.targetTools.includes(tool); }); });
      const options = [{ value: "all", label: "All targeted Agents", selected: true }].concat(eligible.map(function(tool) { return { value: tool, label: toolLabel(tool) }; }));
      const title = names.length === 1 ? "Sync " + names[0] : "Sync " + names.length + " MCP servers";
      openForm(title, selectField("Agent", "tool", options), "Sync", async function(form) {
        const payload = await api("/api/mcp/sync-selected", { method: "POST", body: JSON.stringify({ names: names, tool: form.get("tool") }) });
        return "Synced " + names.length + " MCP server" + (names.length === 1 ? "" : "s") + " across " + payload.results.length + " Agent targets.";
      });
    }
    function selectedResourceNames(kind) {
      return [...document.querySelectorAll('[data-resource-select="' + kind + '"]:checked')].map(function(input) { return input.value; });
    }
    function updateResourceSelection(kind) {
      const options = [...document.querySelectorAll('[data-resource-select="' + kind + '"]:not([disabled])')];
      const checked = options.filter(function(option) { return option.checked; });
      const all = document.querySelector('[data-resource-select-all="' + kind + '"]');
      if (all) {
        all.checked = options.length > 0 && checked.length === options.length;
        all.indeterminate = checked.length > 0 && checked.length < options.length;
      }
      const button = document.querySelector('[data-sync-selected="' + kind + '"]');
      if (button) {
        button.disabled = checked.length === 0;
        button.textContent = checked.length ? "Sync selected (" + checked.length + ")" : "Sync selected";
      }
    }
    async function openEditSkill(name) {
      setBusy(true);
      try {
        const payload = await api("/api/skills/" + encodeURIComponent(name));
        const skill = payload.skill;
        const links = payload.agentLinks.length ? payload.agentLinks.map(function(link) { return esc(link.tool + ': ' + link.path); }).join('<br>') : 'none';
        const body = '<dl class="detail-meta"><dt>Source</dt><dd>' + esc(skill.source_type) + '</dd><dt>Path</dt><dd class="mono">' + esc(skill.path) + '</dd><dt>Agent links</dt><dd>' + links + '</dd></dl>' +
          textareaField("SKILL.md", "markdown", payload.markdown, "", "source-editor");
        openForm("Edit " + skill.name, body, "Save changes", async function(form) {
          await api("/api/skills/" + encodeURIComponent(name), { method: "PUT", body: JSON.stringify({ markdown: form.get("markdown") }) });
          return "Updated skill " + name + ".";
        });
      } catch (error) { toast(error.message, true); }
      finally { setBusy(false); }
    }
    function confirmAction(title, copy) {
      document.getElementById("confirm-title").textContent = title;
      document.getElementById("confirm-copy").textContent = copy;
      document.getElementById("confirm-dialog").showModal();
      return new Promise(function(resolve) { state.confirmResolve = resolve; });
    }
    async function removeSkillAction(name, tool) {
      setBusy(true);
      let detail;
      try { detail = await api("/api/skills/" + encodeURIComponent(name)); }
      catch (error) { toast(error.message, true); setBusy(false); return; }
      setBusy(false);
      if (tool && tool !== "all") {
        const link = detail.agentLinks.find(function(item) { return item.tool === tool; });
        if (!link) { toast(toolLabel(tool) + " does not have a managed symlink for " + name + ".", true); return; }
        const copy = "Remove " + name + " from " + toolLabel(tool) + "?\n\nOnly this Agent symlink will be deleted. The managed skill and other Agent links will remain.";
        if (!await confirmAction("Remove Agent skill", copy)) return;
        await mutate(function() { return api("/api/skills/" + encodeURIComponent(name) + "?tool=" + encodeURIComponent(tool), { method: "DELETE" }); }, "Removed " + name + " from " + toolLabel(tool) + ".");
        return;
      }
      const links = detail.agentLinks.map(function(link) { return link.tool + ": " + link.path; });
      const copy = "Delete the managed source for " + name + "?" + (links.length ? "\n\nThe following Agent links will also be removed:\n" + links.join("\n") : "");
      if (!await confirmAction("Remove skill", copy)) return;
      await mutate(function() { return api("/api/skills/" + encodeURIComponent(name), { method: "DELETE" }); }, "Removed " + name + ".");
    }
    async function removeMcpAction(name) {
      if (!await confirmAction("Remove MCP server", "Delete " + name + " from the managed registry? Agent configuration files will change only after the next sync.")) return;
      await mutate(function() { return api("/api/mcp/" + encodeURIComponent(name), { method: "DELETE" }); }, "Removed " + name + ".");
    }
    async function mutate(action, success) {
      setBusy(true);
      try { await action(); toast(success); await load(false); }
      catch (error) { toast(error.message, true); }
      finally { setBusy(false); }
    }

    document.addEventListener("keydown", function(event) {
      const trigger = event.target.closest?.("[data-select-trigger]");
      if (trigger) {
        if (event.key === "Escape") {
          event.preventDefault();
          toggleSelectMenu(trigger, false);
          return;
        }
        if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
          event.preventDefault();
          const shell = trigger.closest(".select-shell");
          if (!shell.classList.contains("open")) {
            toggleSelectMenu(trigger, true);
            return;
          }
          const options = [...shell.querySelectorAll("[data-select-option]")];
          const selectedIndex = Math.max(0, options.findIndex(function(option) { return option.getAttribute("aria-selected") === "true"; }));
          const nextIndex = event.key === "ArrowUp" ? Math.max(0, selectedIndex - 1) : Math.min(options.length - 1, selectedIndex + 1);
          options[nextIndex]?.focus();
        }
        return;
      }
      const option = event.target.closest?.("[data-select-option]");
      if (!option) return;
      const options = [...option.closest(".select-menu").querySelectorAll("[data-select-option]")];
      const index = options.indexOf(option);
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const nextIndex = event.key === "ArrowDown" ? Math.min(options.length - 1, index + 1) : Math.max(0, index - 1);
        options[nextIndex]?.focus();
      } else if (event.key === "Home" || event.key === "End") {
        event.preventDefault();
        options[event.key === "Home" ? 0 : options.length - 1]?.focus();
      } else if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        chooseSelectOption(option);
      } else if (event.key === "Escape") {
        event.preventDefault();
        const selectTrigger = option.closest(".select-shell").querySelector("[data-select-trigger]");
        toggleSelectMenu(selectTrigger, false);
        selectTrigger.focus();
      }
    });
    document.addEventListener("click", async function(event) {
      const selectOption = event.target.closest?.("[data-select-option]");
      if (selectOption) { chooseSelectOption(selectOption); return; }
      const selectTrigger = event.target.closest?.("[data-select-trigger]");
      if (selectTrigger) { toggleSelectMenu(selectTrigger); return; }
      closeSelectMenus();
      const target = event.target.closest("button");
      if (!target) return;
      if (target.dataset.filterScope) {
        state[target.dataset.filterScope + "Filter"] = target.dataset.filterValue;
        render();
        return;
      }
      if (target.dataset.view) { state.view = target.dataset.view; location.hash = state.view; render(); return; }
      if (target.dataset.close !== undefined) { target.closest("dialog").close(); return; }
      if (target.dataset.confirm !== undefined) {
        document.getElementById("confirm-dialog").close();
        if (state.confirmResolve) state.confirmResolve(target.dataset.confirm === "true");
        state.confirmResolve = null; return;
      }
      const action = target.dataset.action;
      if (action === "refresh") await load();
      if (action === "add-skill") openAddSkill();
      if (action === "import-agent-skills") openImport("skills");
      if (action === "sync-skills") openSyncSkills();
      if (action === "sync-one-skill") openSyncSkill([target.dataset.name]);
      if (action === "sync-selected-skills") openSyncSkill(selectedResourceNames("skill"));
      if (action === "apply-preset") openSyncSkills(target.dataset.preset, true);
      if (action === "move-skill") openMoveSkill(target.dataset.preset);
      if (action === "remove-preset-skill") openRemovePresetSkill(target.dataset.preset);
      if (action === "edit-skill") await openEditSkill(target.dataset.name);
      if (action === "delete-skill") await removeSkillAction(target.dataset.name, target.dataset.tool);
      if (action === "add-mcp") openAddMcp();
      if (action === "edit-mcp") await openEditMcp(target.dataset.name);
      if (action === "import-agent-mcp") openImport("mcp");
      if (action === "sync-mcp") openSyncMcp();
      if (action === "sync-one-mcp") openSyncMcpServer([target.dataset.name]);
      if (action === "sync-selected-mcp") openSyncMcpServer(selectedResourceNames("mcp"));
      if (action === "delete-mcp") await removeMcpAction(target.dataset.name);
      if (action === "backup") await mutate(function() { return api("/api/backup", { method: "POST", body: "{}" }); }, "Skills backup completed.");
    });
    document.addEventListener("change", function(event) {
      const input = event.target;
      if (input.matches('input[name="targets"]')) {
        const form = input.closest("form");
        if (input.value === "all" && input.checked) {
          form.querySelectorAll('input[name="targets"]:not([value="all"])').forEach(function(option) { option.checked = false; });
        } else if (input.checked) {
          const all = form.querySelector('input[name="targets"][value="all"]');
          if (all) all.checked = false;
        }
        return;
      }
      const kind = input.dataset.resourceSelectAll || input.dataset.resourceSelect;
      if (!kind) return;
      if (input.dataset.resourceSelectAll) {
        document.querySelectorAll('[data-resource-select="' + kind + '"]:not([disabled])').forEach(function(option) { option.checked = input.checked; });
      }
      updateResourceSelection(kind);
    });
    document.getElementById("dynamic-form").addEventListener("submit", async function(event) {
      event.preventDefault();
      if (!state.formHandler) return;
      const form = event.currentTarget;
      setBusy(true);
      try {
        const message = await state.formHandler(new FormData(form), form);
        document.getElementById("form-dialog").close();
        toast(message);
        await load(false);
      } catch (error) { toast(error.message, true); }
      finally { setBusy(false); }
    });
    document.getElementById("confirm-dialog").addEventListener("cancel", function() {
      if (state.confirmResolve) state.confirmResolve(false);
      state.confirmResolve = null;
    });
    document.getElementById("form-dialog").addEventListener("close", function() { closeSelectMenus(); });
    window.addEventListener("hashchange", function() { state.view = location.hash.slice(1) || "dashboard"; render(); });
    if (DEV) watchDevelopmentServer();
    load();
  </script>
</body>
</html>`;
