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
    .metrics { display: grid; grid-template-columns: 1.22fr repeat(2, minmax(0, 1fr)); border-top: 2px solid var(--ink); border-bottom: 1px solid var(--line-strong); background: var(--panel); }
    .metric { position: relative; min-height: 124px; padding: 22px 20px 18px 44px; border-right: 1px solid var(--line); overflow: hidden; }
    .metric:last-child { border-right: 0; }
    .metric::before { position: absolute; left: 14px; top: 23px; color: #9aa39d; font: 9px/1 var(--mono); }
    .metric:nth-child(1)::before { content: "01"; }
    .metric:nth-child(2)::before { content: "02"; }
    .metric:nth-child(3)::before { content: "03"; }
    .metric:first-child { background: var(--graphite); color: white; }
    .metric:first-child > * { position: relative; z-index: 1; }
    .metric:first-child::after { content: ""; position: absolute; right: -28px; bottom: -32px; z-index: 0; width: 90px; height: 90px; border: 12px solid var(--accent); transform: rotate(45deg); opacity: .55; pointer-events: none; }
    .metric:first-child .metric-label { color: #9fa9a2; }
    .metric:first-child .metric-note { width: fit-content; max-width: 100%; padding: 6px 8px; border-left: 2px solid var(--accent); background: #0c110e; color: #cbd3ce; white-space: normal; overflow-wrap: anywhere; text-overflow: clip; line-height: 1.35; }
    .metric:first-child::before { color: var(--accent); }
    .metric-label { color: var(--muted); font: 700 9px/1 var(--mono); text-transform: uppercase; }
    .metric-value { margin-top: 14px; font: 800 36px/.9 var(--display); }
    .metric-note { margin-top: 12px; color: var(--muted); font-size: 11px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .manager-path { width: fit-content; max-width: 100%; display: flex; align-items: center; gap: 9px; margin-top: 12px; padding-left: 2px; color: #657069; font: 10px/1.45 var(--mono); transition: color .14s ease, transform .14s ease; }
    .manager-path::before { content: ""; width: 7px; height: 7px; flex: 0 0 7px; background: var(--accent-strong); transform: rotate(45deg); }
    .manager-path:hover { color: var(--ink); transform: translateX(2px); }
    .manager-path code { min-width: 0; color: inherit; overflow-wrap: anywhere; }
    .section { margin-top: 40px; }
    .section-head { min-height: 42px; display: flex; align-items: flex-start; justify-content: space-between; gap: 16px; margin-bottom: 12px; }
    .section-head > div:first-child { display: grid; grid-template-columns: auto 1fr; align-items: baseline; column-gap: 12px; }
    .section-head > div:first-child::before { content: "//"; color: var(--accent-strong); font: 700 11px/1 var(--mono); }
    h2 { margin: 0; font: 700 19px/1.15 var(--display); text-transform: uppercase; }
    .section-note { grid-column: 2; margin: 6px 0 0; color: var(--muted); font-size: 11px; }
    .toolbar { display: flex; gap: 8px; flex-wrap: wrap; justify-content: flex-end; }
    .resource-controls { min-width: 0; display: grid; gap: 10px; margin-bottom: 12px; }
    .resource-action-row { min-width: 0; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .scope-summary { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
    .scope-stat { min-height: 40px; display: inline-flex; align-items: center; gap: 9px; padding: 7px 10px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--muted); font: 700 9px/1 var(--mono); text-transform: uppercase; }
    .scope-stat strong { min-width: 22px; height: 22px; display: inline-grid; place-items: center; padding: 0 5px; border: 1px solid var(--line); background: #f1f8dc; color: #536b1c; font-size: 9px; }
    .scope-stat.system strong { border-color: #e3bf75; background: #fff7e5; color: #845c12; }
    .filter-strip { min-width: 0; display: inline-flex; align-items: center; gap: 3px; padding: 3px; border: 1px solid var(--line-strong); background: #e7eae3; overflow-x: auto; scrollbar-width: none; }
    .filter-strip::-webkit-scrollbar { display: none; }
    .filter-button { min-height: 32px; display: inline-flex; align-items: center; gap: 7px; padding: 6px 10px; border: 0; border-radius: 1px; background: transparent; color: #5c6660; white-space: nowrap; font: 700 9px/1 var(--mono); text-transform: uppercase; }
    .filter-button:hover { background: #f4f6f1; color: var(--ink); }
    .filter-button[aria-pressed="true"] { background: var(--graphite); color: white; box-shadow: inset 0 -2px 0 var(--accent); }
    .filter-count { min-width: 18px; height: 18px; display: grid; place-items: center; padding: 0 4px; border: 1px solid #b9c0bb; background: rgba(255, 255, 255, .45); color: #59635d; font-size: 8px; }
    .filter-button[aria-pressed="true"] .filter-count { border-color: #5c675f; background: var(--accent); color: var(--ink); }
    .resource-search-form { width: min(440px, 100%); display: grid; grid-template-columns: minmax(0, 1fr) auto; align-items: stretch; }
    .resource-search { width: 100%; min-height: 40px; padding: 8px 12px; border: 1px solid var(--line-strong); border-right: 0; border-radius: 2px 0 0 2px; background: var(--panel); color: var(--ink); font-size: 12px; }
    .resource-search:hover { border-color: #758078; }
    .resource-search:focus { border-color: var(--blue); background: white; box-shadow: 0 0 0 3px rgba(23, 109, 146, .12); outline: 0; }
    .resource-search::placeholder { color: #89928d; }
    .resource-search-form .btn { min-width: 76px; border-radius: 0 2px 2px 0; }
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
    .agent-sync-list { display: flex; align-items: center; gap: 6px; min-width: max-content; }
    .agent-sync, .delete-icon {
      width: 38px; min-width: 38px; height: 38px; min-height: 38px; display: inline-grid; place-items: center; padding: 0;
      border: 1px solid transparent; border-radius: 50%; background: transparent; color: #9ba39f;
      transition: color .14s ease, border-color .14s ease, background-color .14s ease, box-shadow .14s ease, transform .14s ease;
    }
    .agent-sync:hover { border-color: #b7c0ba; background: #f0f3ed; color: var(--ink); transform: translateY(-1px); }
    .agent-sync[aria-pressed="true"] { border-color: #a9d9c7; background: #e9f7f1; color: var(--ink); box-shadow: inset 0 0 0 1px rgba(62, 142, 112, .08); }
    .agent-sync[aria-pressed="true"]:hover { border-color: #e0aaa6; background: #fff3f1; color: #a43b35; }
    .agent-sync:disabled, .delete-icon:disabled { cursor: not-allowed; opacity: .42; transform: none; }
    .agent-glyph { width: 20px; height: 20px; display: grid; place-items: center; }
    .agent-glyph svg { width: 100%; height: 100%; display: block; fill: currentColor; }
    .agent-glyph.claude_code { width: 21px; height: 21px; }
    .agent-glyph.cursor { width: 19px; height: 19px; }
    .delete-icon { border-radius: 2px; color: #a43b35; }
    .delete-icon:hover:not(:disabled) { border-color: #e0aaa6; background: #fff3f1; transform: translateY(-1px); }
    .delete-icon svg { width: 17px; height: 17px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .managed-delete { display: flex; align-items: center; margin-left: 4px; padding-left: 10px; border-left: 1px solid var(--line); }
    .managed-delete .delete-icon { border-color: #e0aaa6; background: #fffafa; }
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
    .dot { width: 8px; height: 8px; display: inline-block; border-radius: 50%; background: #aeb5b9; }
    .dot.online { background: var(--accent-strong); box-shadow: 0 0 0 3px #edf6d8; }
    .agent-table { min-width: 1080px; table-layout: fixed; }
    .agent-table .status-column { width: 44px; }
    .agent-table .agent-column { width: 150px; }
    .agent-table .count-column { width: 150px; }
    .agent-table .skill-path-column { width: 33%; }
    .agent-table .mcp-path-column { width: 25%; }
    .agent-paths { display: grid; gap: 5px; }
    .agent-path { color: #303a35; font: 10px/1.45 var(--mono); overflow-wrap: anywhere; }
    .agent-path + .agent-path { padding-top: 5px; border-top: 1px dotted var(--line); }
    .empty { padding: 60px 20px; border: 1px solid var(--line-strong); border-top: 2px solid var(--ink); background: var(--panel); text-align: center; }
    .empty strong { display: block; font-size: 15px; }
    .empty span { display: block; margin-top: 7px; color: var(--muted); font-size: 12px; }
    .command { max-width: 420px; padding: 8px 10px; background: #edf0e9; border-left: 3px solid var(--blue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 10px/1.3 var(--mono); }
    .hook-agent-bar { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
    .hook-agent-button { min-height: 42px; display: inline-flex; align-items: center; gap: 9px; padding: 8px 12px; border: 1px solid var(--line-strong); background: var(--panel); color: var(--muted); font: 700 10px/1 var(--mono); }
    .hook-agent-button:hover { color: var(--ink); background: white; }
    .hook-agent-button[aria-pressed="true"] { border-color: var(--ink); background: var(--graphite); color: white; box-shadow: inset 0 -3px 0 var(--accent); }
    .hook-agent-button .agent-glyph { width: 20px; height: 20px; }
    .hook-event-button { padding: 0; border: 0; background: transparent; color: var(--ink); font: 700 12px/1.25 var(--mono); text-align: left; }
    .hook-event-button:hover { color: var(--blue); text-decoration: underline; text-underline-offset: 3px; }
    .hook-count { display: inline-flex; align-items: center; gap: 7px; font: 700 10px/1 var(--mono); }
    .hook-count::before { content: ""; width: 7px; height: 7px; border: 1px solid #9da69f; background: transparent; }
    .hook-count.installed::before { border-color: #739219; background: var(--accent); }
    .hook-count.partial::before { border-color: #c9851c; background: #ffd379; }
    .hook-detail-list { display: grid; gap: 10px; margin-bottom: 18px; }
    .hook-handler { padding: 13px; border: 1px solid var(--line); background: #f4f6f1; }
    .hook-handler-head { display: flex; align-items: center; justify-content: space-between; gap: 12px; }
    .hook-handler-source { min-width: 0; font: 700 10px/1.3 var(--mono); overflow-wrap: anywhere; }
    .hook-handler-meta { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 9px; }
    .hook-handler-command { margin-top: 9px; padding: 8px 9px; background: #e9ede6; font: 9px/1.5 var(--mono); overflow-wrap: anywhere; }
    .hook-toggle { width: 38px; height: 22px; flex: 0 0 38px; padding: 2px; border: 1px solid #89928d; border-radius: 11px; background: #d9ddd7; }
    .hook-toggle::after { content: ""; display: block; width: 16px; height: 16px; border-radius: 50%; background: white; box-shadow: 1px 2px 4px rgba(16,21,19,.2); transition: transform .15s ease-out; }
    .hook-toggle[aria-pressed="true"] { border-color: #688316; background: var(--accent); }
    .hook-toggle[aria-pressed="true"]::after { transform: translateX(16px); background: var(--ink); }
    .hook-toggle:disabled { cursor: not-allowed; opacity: .45; }
    dialog {
      width: min(620px, calc(100vw - 28px)); max-width: none; max-height: calc(100vh - 36px); max-height: calc(100dvh - 36px); padding: 0;
      overflow: hidden; border: 1px solid #747e78; border-top: 4px solid var(--accent); border-radius: var(--radius);
      background: var(--panel); color: var(--ink); box-shadow: var(--shadow);
    }
    dialog[open] { animation: dialog-in .18s cubic-bezier(.2, .75, .25, 1); }
    dialog::backdrop { background: rgba(11, 15, 13, .64); backdrop-filter: blur(3px); }
    #dynamic-form { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; max-height: calc(100vh - 40px); max-height: calc(100dvh - 40px); }
    #detail-dialog[open], #confirm-dialog[open] { display: grid; grid-template-rows: auto minmax(0, 1fr) auto; }
    .dialog-head { display: flex; align-items: center; justify-content: space-between; gap: 18px; padding: 18px 20px; border-bottom: 1px solid var(--line); background: #f2f4ee; }
    .dialog-head h2 { font-size: 17px; }
    .dialog-body { min-height: 0; padding: 22px 24px 24px; overflow: auto; overscroll-behavior: contain; -webkit-overflow-scrolling: touch; }
    .dialog-actions { position: relative; z-index: 1; display: flex; justify-content: flex-end; gap: 8px; padding: 16px 24px; border-top: 1px solid var(--line); background: #ecefe8; }
    #form-body { display: grid; align-content: start; gap: 18px; }
    [data-mcp-transport], [data-mcp-add-mode], [data-skill-add-mode] { display: grid; gap: 18px; }
    [data-mcp-transport][hidden], [data-mcp-add-mode][hidden], [data-skill-add-mode][hidden] { display: none; }
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
      position: fixed; z-index: 80; max-height: 224px; overflow: auto; padding: 5px;
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
    .mode-switch { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 3px; padding: 3px; border: 1px solid var(--line-strong); background: #e7eae3; }
    .mode-switch button { min-height: 36px; padding: 7px 12px; border: 0; background: transparent; color: #5c6660; font: 700 10px/1 var(--mono); text-transform: uppercase; }
    .mode-switch button:hover { background: #f4f6f1; color: var(--ink); }
    .mode-switch button[aria-pressed="true"] { background: var(--graphite); color: white; box-shadow: inset 0 -2px 0 var(--accent); }
    .check-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px; }
    .target-tool-grid { display: grid; grid-template-columns: repeat(5, 44px); gap: 8px; }
    .target-tool-check { position: relative; width: 44px; height: 44px; }
    .target-tool-check input { position: absolute; width: 1px; height: 1px; opacity: 0; pointer-events: none; }
    .target-tool-icon {
      width: 44px; height: 44px; display: grid; place-items: center; border: 1px solid var(--line-strong); border-radius: 50%;
      background: #f7f9f4; color: #4e5852; transition: border-color .12s ease, background-color .12s ease, color .12s ease, box-shadow .12s ease;
    }
    .target-tool-icon svg { width: 21px; height: 21px; fill: currentColor; }
    .target-tool-check:hover .target-tool-icon { border-color: #657068; background: white; color: var(--ink); }
    .target-tool-check input:checked + .target-tool-icon { border-color: var(--accent-strong); background: var(--accent); color: var(--ink); box-shadow: inset 0 0 0 1px rgba(16, 21, 19, .14); }
    .target-tool-check input:focus-visible + .target-tool-icon { outline: 3px solid rgba(23, 109, 146, .26); outline-offset: 2px; }
    .check { min-height: 40px; display: flex; align-items: center; gap: 8px; padding: 7px 9px; border: 1px solid var(--line); border-radius: 2px; background: #f7f9f4; font-size: 11px; }
    .check input[type="checkbox"], input.row-check[type="checkbox"] {
      appearance: none; -webkit-appearance: none; width: 16px; min-width: 16px; height: 16px; min-height: 16px;
      flex: 0 0 16px; display: grid; place-content: center; margin: 0; padding: 0;
      border: 1px solid #78817b; border-radius: 2px; background: #fff; box-shadow: none;
      transition: border-color .12s ease, background-color .12s ease, box-shadow .12s ease;
    }
    .check input[type="checkbox"]::after, input.row-check[type="checkbox"]::after {
      content: ""; width: 8px; height: 5px; border-left: 2px solid #17200d; border-bottom: 2px solid #17200d;
      opacity: 0; transform: translateY(-1px) rotate(-45deg) scale(.7); transition: opacity .1s ease, transform .1s ease;
    }
    .check input[type="checkbox"]:hover, input.row-check[type="checkbox"]:hover { border-color: #536158; background: #f8faf5; }
    .check input[type="checkbox"]:checked, input.row-check[type="checkbox"]:checked { border-color: var(--accent-strong); background: var(--accent); }
    .check input[type="checkbox"]:checked::after, input.row-check[type="checkbox"]:checked::after { opacity: 1; transform: translateY(-1px) rotate(-45deg) scale(1); }
    .check input[type="checkbox"]:focus-visible, input.row-check[type="checkbox"]:focus-visible { outline: 0; box-shadow: 0 0 0 3px rgba(23, 109, 146, .2); }
    .check input[type="checkbox"]:disabled, input.row-check[type="checkbox"]:disabled { border-color: #b9c0bb; background: #e5e8e2; cursor: not-allowed; }
    .batch-check-grid { max-height: 280px; overflow: auto; padding: 1px; }
    .batch-check-grid .check span { min-width: 0; overflow-wrap: anywhere; font-family: var(--mono); font-size: 10px; }
    .select-cell { width: 42px; }
    .detail-meta { display: grid; grid-template-columns: 110px minmax(0, 1fr); gap: 8px 14px; margin-bottom: 18px; font-size: 12px; }
    .detail-meta dt { color: var(--muted); font-family: var(--mono); }
    .detail-meta dd { margin: 0; overflow-wrap: anywhere; }
    pre { margin: 0; padding: 16px; border: 1px solid var(--line); border-left: 3px solid var(--blue); background: #eef1eb; overflow: auto; font: 10px/1.65 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
    .confirm-copy { margin: 0; color: #3f474c; font-size: 13px; line-height: 1.6; white-space: pre-line; }
    .toast-region { position: fixed; right: 18px; bottom: 18px; z-index: 20; display: grid; gap: 8px; width: min(360px, calc(100vw - 36px)); }
    .toast { padding: 13px 15px; border: 1px solid #707a74; border-left: 4px solid var(--accent); border-radius: 2px; background: var(--graphite); color: white; box-shadow: var(--shadow); font-size: 11px; animation: toast-in .18s ease-out; }
    .toast.error { border-left-color: #e7655d; }
    .btn.loading { cursor: wait; }
    .mcp-add-dialog #dynamic-form { height: min(680px, calc(100vh - 40px)); height: min(680px, calc(100dvh - 40px)); }
    .btn.loading::before { content: ""; width: 13px; height: 13px; flex: 0 0 13px; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%; animation: spin .75s linear infinite; }
    .agent-sync.loading .agent-glyph { display: none; }
    .content.sessions-content { max-width: none; height: calc(100vh - 108px); height: calc(100dvh - 108px); padding-top: 18px; padding-bottom: 18px; }
    .session-shell { height: 100%; min-height: 520px; display: grid; grid-template-columns: 320px minmax(0, 1fr); grid-template-rows: minmax(0, 1fr); border: 1px solid var(--line-strong); border-top: 3px solid var(--ink); background: var(--panel); box-shadow: 6px 6px 0 rgba(16, 21, 19, .08); overflow: hidden; }
    .session-sidebar { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto auto minmax(0, 1fr); border-right: 1px solid var(--line-strong); background: #f5f7f1; }
    .session-sidebar-head { display: flex; align-items: baseline; justify-content: space-between; gap: 12px; padding: 15px 16px 12px; border-bottom: 1px solid var(--line); }
    .session-sidebar-head strong { font: 700 14px/1 var(--display); text-transform: uppercase; }
    .session-count { min-width: 28px; height: 22px; display: inline-grid; place-items: center; padding: 0 7px; background: var(--graphite); color: var(--accent); font: 700 9px/1 var(--mono); }
    .session-controls { display: grid; padding: 10px; border-bottom: 1px solid var(--line); }
    .session-control-row { display: grid; grid-template-columns: minmax(0, 1fr) 36px; gap: 7px; }
    .session-search { display: grid; grid-template-columns: minmax(0, 1fr) 36px; }
    .session-search input { min-width: 0; height: 36px; padding: 7px 10px; border: 1px solid var(--line-strong); border-right: 0; background: white; font-size: 11px; }
    .session-search button { width: 36px; border: 1px solid var(--line-strong); background: var(--graphite); color: white; font: 15px/1 var(--mono); }
    .session-agent-select .select-trigger { width: 36px; min-height: 36px; height: 36px; justify-content: center; padding: 7px; }
    .session-agent-select .select-trigger::before, .session-agent-select .select-trigger::after { display: none; }
    .session-agent-select .session-provider-icon { width: 20px; height: 20px; }
    .session-agent-menu .select-option { gap: 9px; }
    .session-agent-menu .select-option .session-provider-icon { width: 19px; height: 19px; flex: 0 0 19px; color: #c8d0cb; }
    .session-agent-menu .select-option[aria-selected="true"] .session-provider-icon { color: var(--ink); }
    .session-agent-all { width: 19px; height: 19px; flex: 0 0 19px; display: grid; place-items: center; border: 1px solid #77817b; border-radius: 50%; color: #aeb7b1; font: 700 9px/1 var(--mono); }
    .session-agent-menu .select-option[aria-selected="true"] .session-agent-all { border-color: var(--ink); color: var(--ink); }
    .session-list { min-height: 0; overflow-y: auto; overscroll-behavior: contain; }
    .session-item { width: 100%; display: grid; grid-template-columns: 28px minmax(0, 1fr); gap: 10px; padding: 13px 14px; border: 0; border-bottom: 1px solid var(--line); background: transparent; color: var(--ink); text-align: left; }
    .session-item:hover { background: #eef2e7; }
    .session-item[aria-current="true"] { background: #e8f0d1; box-shadow: inset 3px 0 0 var(--accent-strong); }
    .session-provider-icon { width: 25px; height: 25px; display: grid; place-items: center; color: #38413c; }
    .session-provider-icon svg { width: 100%; height: 100%; fill: currentColor; }
    .session-item-copy { min-width: 0; }
    .session-item-title { display: -webkit-box; overflow: hidden; font-size: 12px; font-weight: 700; line-height: 1.35; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
    .session-item-meta { display: flex; align-items: center; justify-content: space-between; gap: 8px; margin-top: 8px; color: var(--muted); font: 9px/1.2 var(--mono); }
    .session-item-dir { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .session-workspace { min-width: 0; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr); grid-template-rows: auto minmax(0, 1fr); }
    .session-detail-head { padding: 16px 18px 13px; border-bottom: 1px solid var(--line-strong); background: #fcfdf9; }
    .session-title-row { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; }
    .session-title-main { min-width: 0; }
    .session-title-main h2 { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-transform: none; }
    .session-meta-line { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; margin-top: 7px; color: var(--muted); font: 9px/1.4 var(--mono); }
    .session-meta-line button { min-width: 0; max-width: 360px; padding: 0; border: 0; background: transparent; color: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-decoration: underline; text-underline-offset: 2px; }
    .session-actions { display: flex; gap: 7px; flex: 0 0 auto; }
    .session-command { display: grid; grid-template-columns: minmax(0, 1fr) 34px; align-items: center; gap: 4px; margin-top: 12px; }
    .session-command code { min-width: 0; padding: 8px 10px; background: #edf0e9; border-left: 3px solid var(--blue); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font: 10px/1.2 var(--mono); }
    .session-command button { width: 34px; height: 32px; padding: 0; border: 1px solid var(--line); background: transparent; color: var(--muted); }
    .session-command svg, .session-actions svg { width: 15px; height: 15px; fill: none; stroke: currentColor; stroke-width: 1.8; stroke-linecap: round; stroke-linejoin: round; }
    .session-body { min-width: 0; min-height: 0; display: grid; grid-template-columns: minmax(0, 1fr) 220px; }
    .session-transcript { min-width: 0; min-height: 0; display: grid; grid-template-rows: auto minmax(0, 1fr); }
    .session-transcript-head { display: flex; align-items: center; gap: 8px; padding: 12px 16px; border-bottom: 1px solid var(--line); font-size: 11px; font-weight: 700; }
    .session-truncated { margin-left: auto; color: #845c12; font: 8px/1 var(--mono); text-transform: uppercase; }
    .session-messages { min-width: 0; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 14px 16px 30px; overscroll-behavior: contain; scroll-behavior: smooth; }
    .session-message { position: relative; width: 100%; margin-bottom: 11px; padding: 11px 13px; border: 1px solid var(--line); border-left: 3px solid #8d9891; background: white; }
    .session-message.user, .session-message.assistant { width: fit-content; max-width: 78%; padding: 12px 14px; border-left-width: 1px; border-radius: 4px; }
    .session-message.user { margin-right: auto; border-color: #b8ca7c; background: #f2f8df; }
    .session-message.assistant { margin-left: auto; border-color: #91b9ca; background: #edf7fb; }
    .session-message.user::after, .session-message.assistant::after { content: ""; position: absolute; top: 15px; width: 8px; height: 8px; background: inherit; transform: rotate(45deg); }
    .session-message.user::after { left: -5px; border-left: 1px solid #b8ca7c; border-bottom: 1px solid #b8ca7c; }
    .session-message.assistant::after { right: -5px; border-top: 1px solid #91b9ca; border-right: 1px solid #91b9ca; }
    .session-message.tool { border-left-color: #7555a5; background: #faf8fd; }
    .session-message.developer, .session-message.system { border-color: #e1bb70; border-left: 3px solid var(--amber); background: #fff6e5; }
    .session-message.active { animation: session-flash 1.2s ease-out; }
    .session-message-head { display: flex; align-items: center; justify-content: space-between; gap: 10px; margin-bottom: 8px; color: var(--muted); font: 700 8px/1 var(--mono); text-transform: uppercase; }
    .session-message-content { margin: 0; padding: 0; border: 0; background: transparent; color: #252c28; font: 11px/1.62 var(--mono); white-space: pre-wrap; overflow-wrap: anywhere; }
    .session-toc { min-width: 0; overflow-x: hidden; overflow-y: auto; border-left: 1px solid var(--line); background: #f5f7f1; }
    .session-toc-title { position: sticky; top: 0; padding: 13px 14px; border-bottom: 1px solid var(--line); background: #f5f7f1; font: 700 9px/1 var(--mono); text-transform: uppercase; }
    .session-toc button { width: 100%; min-width: 0; display: grid; grid-template-columns: 22px minmax(0, 1fr); align-items: center; gap: 7px; overflow: hidden; padding: 9px 12px; border: 0; border-bottom: 1px solid #e2e6df; background: transparent; color: var(--muted); text-align: left; font-size: 10px; line-height: 1.35; }
    .session-toc button:hover { background: white; color: var(--ink); }
    .session-toc button > span:last-child { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
    .toc-index { width: 20px; height: 20px; display: grid; place-items: center; background: #e4ebd2; color: #587018; font: 700 8px/1 var(--mono); }
    .session-placeholder { height: 100%; display: grid; place-items: center; padding: 30px; color: var(--muted); text-align: center; }
    .session-placeholder strong { display: block; color: var(--ink); font-size: 14px; }
    .session-placeholder span { display: block; margin-top: 7px; font-size: 11px; }
    @keyframes session-flash { 0%, 35% { background: #eff8cf; } }
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
      .resource-action-row { align-items: stretch; flex-direction: column; }
      .resource-action-row.agent-skill-row { align-items: center; flex-direction: row; gap: 10px; }
      .agent-skill-row .resource-search-form { width: auto; min-width: 0; flex: 1 1 auto; }
      .agent-skill-row .scope-summary { flex: 0 0 auto; flex-wrap: nowrap; gap: 4px; }
      .agent-skill-row .scope-stat { gap: 5px; padding: 6px; }
      .resource-search-form { width: 100%; }
      .filter-strip { width: 100%; }
      .resource-controls .toolbar { justify-content: flex-start; }
      .metrics { grid-template-columns: repeat(2, minmax(0, 1fr)); }
      .metric:nth-child(2) { border-right: 0; }
      .metric:nth-child(-n+2) { border-bottom: 1px solid var(--line); }
      .metric { min-height: 110px; }
      .content.sessions-content { height: auto; min-height: calc(100vh - 154px); padding: 14px; }
      .session-shell { min-height: calc(100vh - 182px); grid-template-columns: 270px minmax(0, 1fr); }
      .hook-agent-bar { overflow-x: auto; }
      .session-body { grid-template-columns: minmax(0, 1fr); }
      .session-toc { display: none; }
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
      .target-tool-grid { grid-template-columns: repeat(5, 40px); gap: 6px; }
      .target-tool-check, .target-tool-icon { width: 40px; height: 40px; }
      dialog { width: calc(100vw - 16px); max-height: calc(100vh - 16px); max-height: calc(100dvh - 16px); }
      #dynamic-form { max-height: calc(100vh - 20px); max-height: calc(100dvh - 20px); }
      .mcp-add-dialog #dynamic-form { height: calc(100vh - 20px); height: calc(100dvh - 20px); }
      .dialog-head { gap: 12px; padding: 14px 14px 13px; }
      .dialog-head h2 { min-width: 0; font-size: 15px; overflow-wrap: anywhere; }
      .dialog-body { padding: 16px; }
      .dialog-actions { position: static; padding: 12px 16px; }
      #form-body, [data-mcp-transport], [data-mcp-add-mode], [data-skill-add-mode] { gap: 14px; }
      .field textarea { min-height: 88px; }
      th, td { padding: 11px 9px; }
      .content.sessions-content { padding: 10px; }
      .session-shell { min-height: calc(100vh - 134px); display: block; overflow: visible; }
      .session-sidebar { height: 300px; border-right: 0; border-bottom: 1px solid var(--line-strong); }
      .session-workspace { min-height: 620px; }
      .session-title-row { display: grid; gap: 12px; }
      .session-actions { width: 100%; }
      .session-actions .btn { flex: 1 1 auto; }
      .session-title-main h2 { white-space: normal; overflow-wrap: anywhere; }
      .session-message.user, .session-message.assistant { max-width: 88%; }
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
        <button data-view="mcp"><span class="nav-code">03</span><span>MCP Servers</span></button>
        <button data-view="hooks"><span class="nav-code">04</span><span>Hooks</span></button>
        <button data-view="sessions"><span class="nav-code">05</span><span>Sessions</span></button>
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
  <script>
    const TOKEN = "__TM_TOKEN__";
    const DEV = __TM_DEV__;
    const TOOLS = ["all", "codex", "claude_code", "cursor", "opencode"];
    const state = {
      data: null, view: location.hash.slice(1) || "dashboard", skillFilter: "all", mcpFilter: "all", hookFilter: "codex",
      skillSearch: "", mcpSearch: "", skillSearchDraft: "", mcpSearchDraft: "", formHandler: null, confirmResolve: null,
      sessions: [], sessionsLoaded: false, sessionsLoading: false, sessionProvider: "all", sessionSearch: "", sessionSearchDraft: "",
      selectedSessionKey: "", sessionTranscript: null, sessionMessagesLoading: false
    };
    const titles = {
      dashboard: ["Workspace overview", "Dashboard"],
      skills: ["Managed resources", "Skills"],
      mcp: ["Managed integrations", "MCP Servers"],
      hooks: ["Agent automation", "Hooks"],
      sessions: ["Local conversation history", "Sessions"]
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
    function empty(title, note) { return '<div class="empty"><strong>' + esc(title) + '</strong><span>' + esc(note) + '</span></div>'; }
    function sectionHead(title, note, actions) { return '<div class="section-head"><div><h2>' + esc(title) + '</h2><p class="section-note">' + esc(note) + '</p></div><div class="toolbar">' + (actions || '') + '</div></div>'; }
    function toolLabel(tool) {
      if (tool === "all") return "All";
      const agent = state.data.agents.find(function(item) { return item.tool === tool; });
      return agent ? agent.displayName : tool;
    }
    function toolIcon(tool) {
      const icons = {
        all: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>',
        codex: '<svg viewBox="0 0 320 320" aria-hidden="true"><path d="m297.06 130.97c7.26-21.79 4.76-45.66-6.85-65.48-17.46-30.4-52.56-46.04-86.84-38.68-15.25-17.18-37.16-26.95-60.13-26.81-35.04-.08-66.13 22.48-76.91 55.82-22.51 4.61-41.94 18.7-53.31 38.67-17.59 30.32-13.58 68.54 9.92 94.54-7.26 21.79-4.76 45.66 6.85 65.48 17.46 30.4 52.56 46.04 86.84 38.68 15.24 17.18 37.16 26.95 60.13 26.8 35.06.09 66.16-22.49 76.94-55.86 22.51-4.61 41.94-18.7 53.31-38.67 17.57-30.32 13.55-68.51-9.94-94.51zm-120.28 168.11c-14.03.02-27.62-4.89-38.39-13.88.49-.26 1.34-.73 1.89-1.07l63.72-36.8c3.26-1.85 5.26-5.32 5.24-9.07v-89.83l26.93 15.55c.29.14.48.42.52.74v74.39c-.04 33.08-26.83 59.9-59.91 59.97zm-128.84-55.03c-7.03-12.14-9.56-26.37-7.15-40.18.47.28 1.3.79 1.89 1.13l63.72 36.8c3.23 1.89 7.23 1.89 10.47 0l77.79-44.92v31.1c.02.32-.13.63-.38.83l-64.41 37.19c-28.69 16.52-65.33 6.7-81.92-21.95zm-16.77-139.09c7-12.16 18.05-21.46 31.21-26.29 0 .55-.03 1.52-.03 2.2v73.61c-.02 3.74 1.98 7.21 5.23 9.06l77.79 44.91-26.93 15.55c-.27.18-.61.21-.91.08l-64.42-37.22c-28.63-16.58-38.45-53.21-21.95-81.89zm221.26 51.49-77.79-44.92 26.93-15.54c.27-.18.61-.21.91-.08l64.42 37.19c28.68 16.57 38.51 53.26 21.94 81.94-7.01 12.14-18.05 21.44-31.2 26.28v-75.81c.03-3.74-1.96-7.2-5.2-9.06zm26.8-40.34c-.47-.29-1.3-.79-1.89-1.13l-63.72-36.8c-3.23-1.89-7.23-1.89-10.47 0l-77.79 44.92v-31.1c-.02-.32.13-.63.38-.83l64.41-37.16c28.69-16.55 65.37-6.7 81.91 22 6.99 12.12 9.52 26.31 7.15 40.1zm-168.51 55.43-26.94-15.55c-.29-.14-.48-.42-.52-.74v-74.39c.02-33.12 26.89-59.96 60.01-59.94 14.01 0 27.57 4.92 38.34 13.88-.49.26-1.33.73-1.89 1.07l-63.72 36.8c-3.26 1.85-5.26 5.31-5.24 9.06l-.04 89.79zm14.63-31.54 34.65-20.01 34.65 20v40.01l-34.65 20-34.65-20z"/></svg>',
        claude_code: '<svg viewBox="0 0 248 248" aria-hidden="true"><path d="M52.4285 162.873L98.7844 136.879L99.5485 134.602L98.7844 133.334H96.4921L88.7237 132.862L62.2346 132.153L39.3113 131.207L17.0249 130.026L11.4214 128.844L6.2 121.873L6.7094 118.447L11.4214 115.257L18.171 115.847L33.0711 116.911L55.485 118.447L71.6586 119.392L95.728 121.873H99.5485L100.058 120.337L98.7844 119.392L97.7656 118.447L74.5877 102.732L49.4995 86.1905L36.3823 76.62L29.3779 71.7757L25.8121 67.2858L24.2839 57.3608L30.6515 50.2716L39.3113 50.8623L41.4763 51.4531L50.2636 58.1879L68.9842 72.7209L93.4357 90.6804L97.0015 93.6343L98.4374 92.6652L98.6571 91.9801L97.0015 89.2625L83.757 65.2772L69.621 40.8192L63.2534 30.6579L61.5978 24.632C60.9565 22.1032 60.579 20.0111 60.579 17.4246L67.8381 7.49965L71.9133 6.19995L81.7193 7.49965L85.7946 11.0443L91.9074 24.9865L101.714 46.8451L116.996 76.62L121.453 85.4816L123.873 93.6343L124.764 96.1155H126.292V94.6976L127.566 77.9197L129.858 57.3608L132.15 30.8942L132.915 23.4505L136.608 14.4708L143.994 9.62643L149.725 12.344L154.437 19.0788L153.8 23.4505L150.998 41.6463L145.522 70.1215L141.957 89.2625H143.994L146.414 86.7813L156.093 74.0206L172.266 53.698L179.398 45.6635L187.803 36.802L193.152 32.5484H203.34L210.726 43.6549L207.415 55.1159L196.972 68.3492L188.312 79.5739L175.896 96.2095L168.191 109.585L168.882 110.689L170.738 110.53L198.755 104.504L213.91 101.787L231.994 98.7149L240.144 102.496L241.036 106.395L237.852 114.311L218.495 119.037L195.826 123.645L162.07 131.592L161.696 131.893L162.137 132.547L177.36 133.925L183.855 134.279H199.774L229.447 136.524L237.215 141.605L241.8 147.867L241.036 152.711L229.065 158.737L213.019 154.956L175.45 145.977L162.587 142.787H160.805V143.85L171.502 154.366L191.242 172.089L215.82 195.011L217.094 200.682L213.91 205.172L210.599 204.699L188.949 188.394L180.544 181.069L161.696 165.118H160.422V166.772L164.752 173.152L187.803 207.771L188.949 218.405L187.294 221.832L181.308 223.959L174.813 222.777L161.187 203.754L147.305 182.486L136.098 163.345L134.745 164.2L128.075 235.42L125.019 239.082L117.887 241.8L111.902 237.31L108.718 229.984L111.902 215.452L115.722 196.547L118.779 181.541L121.58 162.873L123.291 156.636L123.14 156.219L121.773 156.449L107.699 175.752L86.304 204.699L69.3663 222.777L65.291 224.431L58.2867 220.768L58.9235 214.27L62.8713 208.48L86.304 178.705L100.44 160.155L109.551 149.507L109.462 147.967L108.959 147.924L46.6977 188.512L35.6182 189.93L30.7788 185.44L31.4156 178.115L33.7079 175.752L52.4285 162.873Z"/></svg>',
        cursor: '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="m415.035 156.35-151.503-87.4695c-4.865-2.8094-10.868-2.8094-15.733 0l-151.4969 87.4695c-4.0897 2.362-6.6146 6.729-6.6146 11.459v176.383c0 4.73 2.5249 9.097 6.6146 11.458l151.5039 87.47c4.865 2.809 10.868 2.809 15.733 0l151.504-87.47c4.089-2.361 6.614-6.728 6.614-11.458v-176.383c0-4.73-2.525-9.097-6.614-11.459zm-9.516 18.528-146.255 253.32c-.988 1.707-3.599 1.01-3.599-.967v-165.872c0-3.314-1.771-6.379-4.644-8.044l-143.645-82.932c-1.707-.988-1.01-3.599.968-3.599h292.509c4.154 0 6.75 4.503 4.673 8.101h-.007z"/></svg>',
        opencode: '<svg viewBox="0 0 512 512" aria-hidden="true"><path d="M320 224V352H192V224H320Z" opacity=".4"/><path fill-rule="evenodd" clip-rule="evenodd" d="M384 416H128V96H384V416ZM320 160H192V352H320V160Z"/></svg>',
      };
      return icons[tool] || '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="5"/></svg>';
    }
    function trashIcon() {
      return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6M10 11v5M14 11v5"/></svg>';
    }
    function copyIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="9" y="9" width="11" height="11" rx="1"/><path d="M15 9V4H4v11h5"/></svg>'; }
    function playIcon() { return '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8 5 11 7-11 7z"/></svg>'; }
    function filteredResources(kind, tool) {
      const resources = kind === "skill" ? state.data.skills : state.data.mcpServers;
      if (tool === "all") return resources.map(function(item) {
        const system = kind === "mcp" && state.data.agents.some(function(agent) {
          return agent.mcpServers.some(function(candidate) { return candidate.name === item.name && candidate.scope === "system"; });
        });
        const synced = state.data.agents.some(function(agent) {
          const installed = kind === "skill" ? agent.skills : agent.mcpServers;
          return installed.some(function(candidate) { return candidate.name === item.name && (kind !== "skill" || candidate.scope !== "system"); });
        });
        return Object.assign({}, item, { managed: true, synced: synced, scope: system ? "system" : "user" });
      });
      const agent = state.data.agents.find(function(item) { return item.tool === tool; });
      if (!agent) return [];
      const managedByName = new Map(resources.map(function(item) { return [item.name, item]; }));
      const installed = kind === "skill" ? agent.skills : agent.mcpServers;
      return installed.map(function(item) {
        const managed = managedByName.get(item.name);
        if (managed && item.scope !== "system") return Object.assign({}, managed, { managed: true, synced: true, scope: item.scope || "user" });
        if (kind === "skill") return Object.assign({}, item, { source_type: "agent", updated_at: "", agentLinks: [], managed: false, synced: false });
        return Object.assign({}, item, { managed: false });
      });
    }
    function syncedCount(resources) { return resources.filter(function(item) { return item.synced; }).length; }
    function resourceSummary(kind, resources, visible) {
      const tool = state[kind + "Filter"];
      if (tool === "all") return visible.length + " of " + resources.length + " managed definitions";
      return syncedCount(resources) + " synced / " + resources.length + " installed" + (visible.length === resources.length ? "" : " · " + visible.length + " shown");
    }
    function searchedResources(kind, resources) {
      const query = state[kind + "Search"].trim().toLowerCase();
      if (!query) return resources;
      return resources.filter(function(item) {
        const values = kind === "skill"
          ? [item.name, item.description, item.source_type, item.scope]
          : [item.name, item.transport, item.url, item.command].concat(item.args || [], item.targetTools || []);
        return values.some(function(value) { return String(value || "").toLowerCase().includes(query); });
      });
    }
    function searchControl(kind) {
      const noun = kind === "skill" ? "skills" : "MCP servers";
      return '<form class="resource-search-form" data-resource-search-form="' + kind + '"><input type="search" class="resource-search" data-resource-search="' + kind + '" name="query" value="' + esc(state[kind + "SearchDraft"]) + '" placeholder="Search ' + noun + '" aria-label="Search ' + noun + '"><button type="submit" class="btn" title="Search ' + noun + '" aria-label="Search ' + noun + '">Search</button></form>';
    }
    function scopeSummary(kind, resources) {
      const system = resources.filter(function(resource) { return resource.scope === "system"; }).length;
      const user = resources.length - system;
      const label = kind === "skill" ? "Skill" : "MCP server";
      return '<div class="scope-summary" aria-label="' + label + ' scope counts"><span class="scope-stat"><span>User</span><strong>' + user + '</strong></span><span class="scope-stat system"><span>System</span><strong>' + system + '</strong></span></div>';
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
    async function load(button) {
      setButtonLoading(button, true, "Loading...");
      try {
        state.data = await api("/api/snapshot");
        render();
        if (state.view === "sessions" && !state.sessionsLoaded) await loadSessions();
      }
      catch (error) { toast(error.message, true); }
      finally { setButtonLoading(button, false); }
    }
    function setButtonLoading(button, active, message) {
      if (!button) return;
      if (active) {
        button.dataset.loadingLabel = button.innerHTML;
        button.disabled = true;
        button.classList.add("loading");
        button.textContent = button.classList.contains("icon") ? "" : message || "Working...";
        button.setAttribute("aria-busy", "true");
      } else if (button.dataset.loadingLabel !== undefined) {
        button.innerHTML = button.dataset.loadingLabel;
        delete button.dataset.loadingLabel;
        button.disabled = false;
        button.classList.remove("loading");
        button.removeAttribute("aria-busy");
      }
    }
    function formLoadingMessage(command) {
      return ({ "Add": "Adding...", "Create": "Creating...", "Import": "Importing...", "Apply": "Applying...", "Deploy": "Deploying...", "Move": "Moving...", "Remove": "Removing...", "Save": "Saving..." })[command] || "Working...";
    }
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
      if (state.view === "mcp") renderMcp();
      if (state.view === "hooks") renderHooks();
      if (state.view === "sessions") renderSessions();
      view.classList.toggle("sessions-content", state.view === "sessions");
      view.classList.remove("view-enter");
      void view.offsetWidth;
      view.classList.add("view-enter");
    }
    function topActions() {
      const refresh = '<button class="btn icon" data-action="refresh" aria-label="Refresh" title="Refresh">↻</button>';
      if (state.view === "skills") return refresh + '<button class="btn primary" data-action="add-skill" title="Add a managed skill" aria-label="Add a managed skill">Add</button>';
      if (state.view === "mcp") return refresh + '<button class="btn primary" data-action="add-mcp" title="Add an MCP server" aria-label="Add an MCP server">Add</button>';
      if (state.view === "sessions") return '<button class="btn icon" data-action="refresh-sessions" aria-label="Rescan sessions" title="Rescan sessions">↻</button>';
      return refresh;
    }
    function metrics() {
      const data = state.data;
      const installed = data.status.tools.filter(function(tool) { return tool.installed; }).length;
      return '<div class="metrics">' +
        metric("Managed skills", data.skills.length, data.status.skillsDir) +
        metric("MCP servers", data.mcpServers.length, "managed definitions") +
        metric("Agents online", installed + "/" + data.status.tools.length, "detected locally") +
      '</div>';
    }
    function metric(label, value, note) { return '<div class="metric"><div class="metric-label">' + esc(label) + '</div><div class="metric-value">' + esc(value) + '</div><div class="metric-note" title="' + esc(note) + '">' + esc(note) + '</div></div>'; }

    function renderDashboard() {
      view.innerHTML = metrics() +
        '<div class="manager-path" aria-label="Manager home: ' + esc(state.data.status.root) + '"><code title="' + esc(state.data.status.root) + '">' + esc(state.data.status.root) + '</code></div>' +
        '<section class="section">' + sectionHead("Agent readiness", state.data.agents.length + " configured destinations", "") + agentTable(state.data.agents) + '</section>';
    }
    function sessionKey(session) { return session.providerId + ":" + session.sessionId; }
    function selectedSession() { return state.sessions.find(function(session) { return sessionKey(session) === state.selectedSessionKey; }) || null; }
    function providerLabel(provider) { return provider === "all" ? "All" : provider === "claude" ? "Claude Code" : "Codex"; }
    function providerIcon(provider) { return '<span class="session-provider-icon">' + toolIcon(provider === "claude" ? "claude_code" : "codex") + '</span>'; }
    function sessionProviderIcon(provider) { return provider === "all" ? '<span class="session-agent-all">A</span>' : providerIcon(provider); }
    function sessionProviderSelect() {
      const providers = ["all", "codex", "claude"];
      const options = providers.map(function(provider) {
        return '<button type="button" class="select-option" role="option" tabindex="-1" data-select-option data-value="' + provider + '" aria-selected="' + (provider === state.sessionProvider) + '">' + sessionProviderIcon(provider) + '<span>' + esc(providerLabel(provider)) + '</span></button>';
      }).join("");
      return '<div class="select-shell session-agent-select"><input type="hidden" name="sessionProvider" value="' + esc(state.sessionProvider) + '"><button id="session-agent-filter" type="button" class="select-trigger" data-select-trigger aria-haspopup="listbox" aria-expanded="false" aria-label="Filter sessions by Agent: ' + esc(providerLabel(state.sessionProvider)) + '" title="' + esc(providerLabel(state.sessionProvider)) + '">' + sessionProviderIcon(state.sessionProvider) + '<span class="select-label" data-select-label hidden>' + esc(providerLabel(state.sessionProvider)) + '</span></button><div class="select-menu session-agent-menu" role="listbox" aria-label="Filter sessions by Agent" hidden>' + options + '</div></div>';
    }
    function baseName(path) { return String(path || "").split(/[\\/]/).filter(Boolean).pop() || "Unknown directory"; }
    function formatSessionTime(value) {
      if (!value) return "Unknown time";
      return new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
    }
    function relativeSessionTime(value) {
      if (!value) return "unknown";
      const seconds = Math.max(0, Math.floor((Date.now() - value) / 1000));
      if (seconds < 60) return "just now";
      if (seconds < 3600) return Math.floor(seconds / 60) + "m ago";
      if (seconds < 86400) return Math.floor(seconds / 3600) + "h ago";
      if (seconds < 604800) return Math.floor(seconds / 86400) + "d ago";
      return formatSessionTime(value).split(",")[0];
    }
    function filteredSessions() {
      const query = state.sessionSearch.trim().toLowerCase();
      return state.sessions.filter(function(session) {
        if (state.sessionProvider !== "all" && session.providerId !== state.sessionProvider) return false;
        if (!query) return true;
        return [session.title, session.summary, session.projectDir, session.sessionId, session.sourcePath].some(function(value) {
          return String(value || "").toLowerCase().includes(query);
        });
      });
    }
    function renderSessions() {
      const sessions = filteredSessions();
      const visible = sessions.slice(0, 300);
      const selected = selectedSession();
      const list = state.sessionsLoading
        ? '<div class="session-placeholder"><div><strong>Scanning local sessions</strong><span>Reading lightweight metadata from Codex and Claude Code.</span></div></div>'
        : visible.length
        ? visible.map(function(session) {
            const active = sessionKey(session) === state.selectedSessionKey;
            return '<button type="button" class="session-item" data-action="select-session" data-session-key="' + esc(sessionKey(session)) + '" aria-current="' + active + '">' + providerIcon(session.providerId) +
              '<span class="session-item-copy"><span class="session-item-title">' + esc(session.title || session.sessionId) + '</span><span class="session-item-meta"><span class="session-item-dir" title="' + esc(session.projectDir || "Unknown directory") + '">' + esc(baseName(session.projectDir)) + '</span><span>' + esc(relativeSessionTime(session.lastActiveAt || session.createdAt)) + '</span></span></span></button>';
          }).join("") + (sessions.length > visible.length ? '<div class="session-placeholder"><span>Showing 300 of ' + sessions.length + '. Search to narrow the list.</span></div>' : '')
        : '<div class="session-placeholder"><div><strong>No sessions found</strong><span>Try another provider or search term.</span></div></div>';
      view.innerHTML = '<div class="session-shell"><aside class="session-sidebar"><div class="session-sidebar-head"><strong>Session list</strong><span class="session-count">' + sessions.length + '</span></div>' +
        '<div class="session-controls"><div class="session-control-row"><form class="session-search" data-session-search-form><input type="search" name="query" value="' + esc(state.sessionSearchDraft) + '" placeholder="Search sessions" aria-label="Search sessions"><button type="submit" aria-label="Search" title="Search">⌕</button></form>' + sessionProviderSelect() + '</div></div>' +
        '<div class="session-list">' + list + '</div></aside>' + renderSessionWorkspace(selected) + '</div>';
    }
    function renderSessionWorkspace(session) {
      if (!session) return '<section class="session-workspace"><div class="session-placeholder"><div><strong>Select a session</strong><span>Conversation details load only when needed.</span></div></div></section>';
      const transcript = state.sessionTranscript;
      const messages = transcript && transcript.sessionKey === sessionKey(session) ? transcript.messages : [];
      const messageList = state.sessionMessagesLoading
        ? '<div class="session-placeholder"><div><strong>Loading conversation</strong><span>Large histories may take a moment.</span></div></div>'
        : messages.length
        ? messages.map(function(message, index) {
            const role = ["user", "assistant", "tool", "developer", "system"].includes(message.role) ? message.role : "system";
            return '<article class="session-message ' + role + '" id="session-message-' + index + '"><div class="session-message-head"><span>' + esc(message.role) + '</span><time>' + esc(message.ts ? formatSessionTime(message.ts) : "") + '</time></div><pre class="session-message-content">' + esc(message.content) + '</pre></article>';
          }).join("")
        : '<div class="session-placeholder"><div><strong>No readable messages</strong><span>The session metadata is available, but its transcript format was not recognized.</span></div></div>';
      const toc = messages.map(function(message, index) { return { message: message, index: index }; }).filter(function(item) { return item.message.role === "user"; }).slice(0, 80);
      const tocRows = toc.length ? toc.map(function(item, index) {
        return '<button type="button" data-action="session-toc" data-message-index="' + item.index + '"><span class="toc-index">' + (index + 1) + '</span><span>' + esc(item.message.content.slice(0, 72)) + '</span></button>';
      }).join("") : '<div class="session-placeholder"><span>No user messages</span></div>';
      const truncated = transcript && transcript.sessionKey === sessionKey(session) && transcript.truncated;
      return '<section class="session-workspace"><header class="session-detail-head"><div class="session-title-row"><div class="session-title-main"><div class="session-meta-line"><span class="tag green">' + esc(providerLabel(session.providerId)) + '</span>' + (session.archived ? '<span class="tag amber">archived</span>' : '') + '</div><h2>' + esc(session.title || session.sessionId) + '</h2><div class="session-meta-line"><time>' + esc(formatSessionTime(session.lastActiveAt || session.createdAt)) + '</time>' +
        (session.projectDir ? '<button type="button" data-action="copy-session-dir" title="Copy ' + esc(session.projectDir) + '">' + esc(session.projectDir) + '</button>' : '<span>Unknown directory</span>') + '<span>' + esc(basenameForDisplay(session.sourcePath)) + '</span></div></div>' +
        '<div class="session-actions"><button type="button" class="btn primary" data-action="resume-session">' + playIcon() + '<span>Resume</span></button><button type="button" class="btn danger" data-action="delete-session">' + trashIcon() + '<span>Delete</span></button></div></div>' +
        '<div class="session-command"><code title="' + esc(session.resumeCommand) + '">' + esc(session.resumeCommand) + '</code><button type="button" data-action="copy-session-command" aria-label="Copy resume command" title="Copy resume command">' + copyIcon() + '</button></div></header>' +
        '<div class="session-body"><div class="session-transcript"><div class="session-transcript-head"><span>Conversation</span><span class="session-count">' + (transcript && transcript.sessionKey === sessionKey(session) ? transcript.total : messages.length) + '</span>' + (truncated ? '<span class="session-truncated">latest messages shown</span>' : '') + '</div><div class="session-messages">' + messageList + '</div></div>' +
        '<aside class="session-toc"><div class="session-toc-title">Conversation index</div>' + tocRows + '</aside></div></section>';
    }
    function renderSelectedSession() {
      const key = state.selectedSessionKey;
      view.querySelectorAll(".session-item").forEach(function(item) {
        item.setAttribute("aria-current", String(item.dataset.sessionKey === key));
      });
      const workspace = view.querySelector(".session-workspace");
      if (workspace) workspace.outerHTML = renderSessionWorkspace(selectedSession());
      else renderSessions();
    }
    function basenameForDisplay(path) { return String(path || "").split(/[\\/]/).pop() || ""; }
    async function loadSessions(button) {
      state.sessionsLoading = true;
      if (state.view === "sessions") renderSessions();
      setButtonLoading(button, true, "Scanning...");
      try {
        const payload = await api("/api/sessions");
        state.sessions = payload.sessions;
        state.sessionsLoaded = true;
        if (!selectedSession()) state.selectedSessionKey = state.sessions[0] ? sessionKey(state.sessions[0]) : "";
        state.sessionsLoading = false;
        renderSessions();
        if (selectedSession()) await loadSelectedSessionMessages();
      } catch (error) {
        state.sessionsLoading = false;
        toast(error.message, true);
        renderSessions();
      } finally { setButtonLoading(button, false); }
    }
    async function loadSelectedSessionMessages() {
      const session = selectedSession();
      if (!session) return;
      const key = sessionKey(session);
      state.sessionMessagesLoading = true;
      state.sessionTranscript = null;
      renderSelectedSession();
      try {
        const query = new URLSearchParams({ provider: session.providerId, sessionId: session.sessionId, sourcePath: session.sourcePath });
        const transcript = await api("/api/session-messages?" + query.toString());
        if (state.selectedSessionKey !== key) return;
        state.sessionTranscript = Object.assign({ sessionKey: key }, transcript);
      } catch (error) { toast(error.message, true); }
      finally { if (state.selectedSessionKey === key) { state.sessionMessagesLoading = false; renderSelectedSession(); } }
    }
    async function copyText(value, message) {
      try {
        await navigator.clipboard.writeText(value);
      } catch {
        const input = document.createElement("textarea");
        input.value = value; input.style.position = "fixed"; input.style.opacity = "0"; document.body.appendChild(input); input.select(); document.execCommand("copy"); input.remove();
      }
      toast(message || "Copied.");
    }
    async function resumeSelectedSession(button) {
      const session = selectedSession();
      if (!session) return;
      setButtonLoading(button, true, "Opening...");
      try {
        const result = await api("/api/sessions/resume", { method: "POST", body: JSON.stringify({ provider: session.providerId, sessionId: session.sessionId, sourcePath: session.sourcePath }) });
        if (result.launched) toast("Opened the session in Terminal.app.");
        else await copyText(result.command, "Resume command copied.");
      } catch (error) {
        await copyText(session.resumeCommand, "Terminal could not be opened. Resume command copied.");
      } finally { setButtonLoading(button, false); }
    }
    async function deleteSelectedSession() {
      const session = selectedSession();
      if (!session) return;
      const confirmButton = await confirmAction("Delete session", "Permanently delete \"" + session.title + "\"?\n\nSession ID: " + session.sessionId + "\nThis cannot be undone.");
      if (!confirmButton) return;
      setButtonLoading(confirmButton, true, "Deleting...");
      try {
        await api("/api/sessions/delete", { method: "POST", body: JSON.stringify({ provider: session.providerId, sessionId: session.sessionId, sourcePath: session.sourcePath }) });
        document.getElementById("confirm-dialog").close();
        state.sessions = state.sessions.filter(function(item) { return sessionKey(item) !== sessionKey(session); });
        state.selectedSessionKey = state.sessions[0] ? sessionKey(state.sessions[0]) : "";
        state.sessionTranscript = null;
        renderSessions();
        toast("Deleted session " + session.sessionId + ".");
        if (selectedSession()) await loadSelectedSessionMessages();
      } catch (error) { toast(error.message, true); }
      finally { setButtonLoading(confirmButton, false); }
    }
    function skillTable(skills, actions, filter, query) {
      if (!skills.length) return query
        ? empty("No matching skills", "No managed skills match your search.")
        : filter && filter !== "all"
        ? empty("No matching skills", toolLabel(filter) + " has no matching managed skills.")
        : empty("No managed skills", "The skill registry is empty.");
      const rows = skills.map(function(skill) {
        const managed = skill.managed !== false;
        const manageable = managed && skill.scope !== "system";
        const agentLink = managed && filter && filter !== "all" && skill.agentLinks.some(function(link) { return link.tool === filter; });
        const managedDelete = manageable && filter === "all"
          ? '<span class="managed-delete"><button class="delete-icon" data-action="delete-skill" data-name="' + esc(skill.name) + '" data-tool="all" aria-label="Delete managed skill ' + esc(skill.name) + '" title="Delete managed skill">' + trashIcon() + '</button></span>'
          : '';
        const syncAction = manageable && filter === "all" ? '<div class="agent-sync-list">' + state.data.agents.map(function(agent) {
          const synced = skill.agentLinks.some(function(link) { return link.tool === agent.tool; });
          const label = (synced ? "Stop syncing " : "Sync ") + skill.name + (synced ? " from " : " to ") + agent.displayName;
          return '<button class="agent-sync" data-action="toggle-skill-agent" data-name="' + esc(skill.name) + '" data-tool="' + esc(agent.tool) + '" data-synced="' + synced + '" aria-pressed="' + synced + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"><span class="agent-glyph ' + esc(agent.tool) + '">' + toolIcon(agent.tool) + '</span></button>';
        }).join("") + managedDelete + '</div>' : '<span class="muted">—</span>';
        const removeAction = filter !== "all"
          ? '<button class="delete-icon" data-action="delete-skill" data-name="' + esc(skill.name) + '" data-tool="' + esc(filter) + '" aria-label="Remove ' + esc(skill.name) + ' from ' + esc(toolLabel(filter)) + '" title="' + (agentLink ? 'Remove from ' + esc(toolLabel(filter)) : 'This Agent skill is not a managed symlink') + '"' + (manageable && agentLink ? '' : ' disabled') + '>' + trashIcon() + '</button>'
          : '';
        const name = manageable
          ? '<button class="name-button mono" data-action="edit-skill" data-name="' + esc(skill.name) + '">' + esc(skill.name) + '</button>'
          : '<button class="name-button mono" data-action="view-agent-skill" data-name="' + esc(skill.name) + '" data-tool="' + esc(filter) + '">' + esc(skill.name) + '</button>';
        return '<tr><td>' + name + '</td>' +
          (filter !== "all" ? '<td><span class="tag ' + (skill.scope === 'system' ? 'amber' : 'green') + '">' + esc(skill.scope || "user") + '</span></td>' : '') + '<td><div class="truncate">' + esc(skill.description || "No description") + '</div></td>' +
          '<td class="mono muted">' + esc((skill.updated_at || "").replace("T", " ")) + '</td>' +
          (filter === "all" ? '<td>' + syncAction + '</td>' : '') +
          (actions && filter !== "all" ? '<td><div class="row-actions">' + removeAction + '</div></td>' : '') + '</tr>';
      }).join("");
      return '<div class="table-wrap"><table><thead><tr><th>Name</th>' + (filter !== "all" ? '<th>Scope</th>' : '') + '<th>Description</th><th>Updated</th>' + (filter === "all" ? '<th>Agents</th>' : '') + (actions && filter !== "all" ? '<th aria-label="Actions"></th>' : '') + '</tr></thead><tbody>' + rows + '</tbody></table></div>';
    }
    function renderSkills() {
      const resources = filteredResources("skill", state.skillFilter).filter(function(skill) { return state.skillFilter !== "all" || skill.scope !== "system"; });
      const skills = searchedResources("skill", resources);
      const actionRow = state.skillFilter === "all"
        ? searchControl("skill")
        : searchControl("skill") + scopeSummary("skill", resources);
      const controls = '<div class="resource-controls">' + filterStrip("skill") + '<div class="resource-action-row' + (state.skillFilter === "all" ? '' : ' agent-skill-row') + '">' + actionRow + '</div></div>';
      view.innerHTML = '<section>' + sectionHead("Skill registry", resourceSummary("skill", resources, skills), "") + controls + skillTable(skills, true, state.skillFilter, state.skillSearch.trim()) + '</section>';
    }
    function renderMcp() {
      const resources = filteredResources("mcp", state.mcpFilter);
      const servers = searchedResources("mcp", resources);
      const rows = servers.map(function(server) {
        const managed = server.managed !== false;
        const endpoint = server.transport === "http" ? server.url : [server.command].concat(server.args).join(" ");
        const system = server.scope === "system";
        const managedDelete = managed && state.mcpFilter === "all"
          ? '<span class="managed-delete"><button class="delete-icon" data-action="delete-mcp" data-name="' + esc(server.name) + '" aria-label="Delete managed MCP server ' + esc(server.name) + '" title="' + (system ? 'System MCP servers are read only' : 'Delete managed MCP server') + '"' + (system ? ' disabled' : '') + '>' + trashIcon() + '</button></span>'
          : '';
        const syncAction = managed && state.mcpFilter === "all" ? '<div class="agent-sync-list">' + state.data.agents.map(function(agent) {
          const targeted = server.targetTools.includes("all") || server.targetTools.includes(agent.tool);
          const synced = agent.mcpServers.some(function(item) { return item.name === server.name; });
          const available = !system && server.enabled && targeted;
          const label = system ? "System MCP servers are read only" : !server.enabled ? "Enable " + server.name + " before syncing" : !targeted ? server.name + " is not targeted to " + agent.displayName : (synced ? "Stop syncing " : "Sync ") + server.name + (synced ? " from " : " to ") + agent.displayName;
          return '<button class="agent-sync" data-action="toggle-mcp-agent" data-name="' + esc(server.name) + '" data-tool="' + esc(agent.tool) + '" data-synced="' + synced + '" aria-pressed="' + synced + '" aria-label="' + esc(label) + '" title="' + esc(label) + '"' + (available ? '' : ' disabled') + '><span class="agent-glyph ' + esc(agent.tool) + '">' + toolIcon(agent.tool) + '</span></button>';
        }).join("") + managedDelete + '</div>' : '';
        const name = managed && !system
          ? '<button class="name-button mono" data-action="edit-mcp" data-name="' + esc(server.name) + '">' + esc(server.name) + '</button>'
          : state.mcpFilter !== "all"
          ? '<button class="name-button mono" data-action="view-agent-mcp" data-name="' + esc(server.name) + '" data-tool="' + esc(state.mcpFilter) + '">' + esc(server.name) + '</button>'
          : '<span class="mono"><strong>' + esc(server.name) + '</strong></span>';
        const agentDelete = state.mcpFilter !== "all" ? '<button class="delete-icon" data-action="delete-mcp-agent" data-name="' + esc(server.name) + '" data-tool="' + esc(state.mcpFilter) + '" aria-label="Remove ' + esc(server.name) + ' from ' + esc(toolLabel(state.mcpFilter)) + '" title="' + (system ? 'System MCP servers are read only' : 'Remove from ' + esc(toolLabel(state.mcpFilter))) + '"' + (system ? ' disabled' : '') + '>' + trashIcon() + '</button>' : '';
        return '<tr><td>' + name + '</td>' + (state.mcpFilter !== "all" ? '<td><span class="tag ' + (system ? 'amber' : 'green') + '">' + esc(server.scope || "user") + '</span></td>' : '') + '<td><span class="tag">' + esc(server.transport) + '</span></td><td><div class="command" title="' + esc(endpoint) + '">' + esc(endpoint) + '</div></td><td><span class="tag ' + (server.enabled ? 'green' : 'red') + '">' + (server.enabled ? 'enabled' : 'disabled') + '</span></td>' + (state.mcpFilter === "all" ? '<td>' + syncAction + '</td>' : '<td><div class="row-actions">' + agentDelete + '</div></td>') + '</tr>';
      }).join("");
      const table = rows ? '<div class="table-wrap"><table><thead><tr><th>Name</th>' + (state.mcpFilter !== "all" ? '<th>Scope</th>' : '') + '<th>Transport</th><th>Endpoint</th><th>Status</th><th>' + (state.mcpFilter === "all" ? 'Agents' : '<span class="sr-only">Actions</span>') + '</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : state.mcpSearch.trim()
        ? empty("No matching MCP servers", "No managed MCP servers match your search.")
        : state.mcpFilter === "all"
        ? empty("No MCP servers", "The MCP registry is empty.")
        : empty("No matching MCP servers", toolLabel(state.mcpFilter) + " has no matching managed MCP servers.");
      const actionRow = state.mcpFilter === "all" ? searchControl("mcp") : searchControl("mcp") + scopeSummary("mcp", resources);
      const controls = '<div class="resource-controls">' + filterStrip("mcp") + '<div class="resource-action-row' + (state.mcpFilter === "all" ? '' : ' agent-skill-row') + '">' + actionRow + '</div></div>';
      view.innerHTML = '<section>' + sectionHead("MCP registry", resourceSummary("mcp", resources, servers), "") + controls + table + '</section>';
    }
    function renderHooks() {
      let hook = state.data.hooks.find(function(item) { return item.tool === state.hookFilter; });
      if (!hook) { hook = state.data.hooks[0]; state.hookFilter = hook ? hook.tool : "codex"; }
      const agents = state.data.hooks.map(function(item) {
        return '<button class="hook-agent-button" data-action="filter-hooks" data-tool="' + esc(item.tool) + '" aria-pressed="' + (item.tool === state.hookFilter) + '"><span class="agent-glyph ' + esc(item.tool) + '">' + toolIcon(item.tool) + '</span><span>' + esc(item.displayName) + '</span></button>';
      }).join("");
      if (!hook) { view.innerHTML = empty("No Agents", "No hook providers were detected."); return; }
      const rows = hook.events.map(function(event) {
        const installedClass = event.installed ? " installed" : "";
        const activeClass = event.active && event.active < event.installed ? " partial" : event.active ? " installed" : "";
        return '<tr><td><button class="hook-event-button" data-action="edit-hooks" data-tool="' + esc(hook.tool) + '" data-event="' + esc(event.name) + '">' + esc(event.name) + '</button></td>' +
          '<td><span class="hook-count' + installedClass + '">' + event.installed + '</span></td><td><span class="hook-count' + activeClass + '">' + event.active + '</span></td><td class="muted">' + esc(event.description) + '</td></tr>';
      }).join("");
      const table = rows ? '<div class="table-wrap"><table><thead><tr><th>Event</th><th>Installed</th><th>Active</th><th>Description</th></tr></thead><tbody>' + rows + '</tbody></table></div>' : empty("Plugin based hooks", "OpenCode hooks are implemented in plugin code and are read only here.");
      view.innerHTML = '<section>' + sectionHead(hook.displayName + " hooks", hook.eventCount + " events configured · " + hook.commandCount + " handlers", "") + '<div class="hook-agent-bar" role="group" aria-label="Select Agent">' + agents + '</div>' + table + '</section>';
    }
    function agentTable(agents) {
      const tools = state.data.status.tools;
      const syncedSkillNames = new Set(state.data.skills.map(function(skill) { return skill.name; }));
      const syncedMcpNames = new Set(state.data.mcpServers.map(function(server) { return server.name; }));
      const rows = agents.map(function(agent) {
        const installed = tools.find(function(tool) { return tool.key === agent.tool; });
        const syncedSkills = agent.skills.filter(function(skill) { return skill.scope !== "system" && syncedSkillNames.has(skill.name); }).length;
        const syncedMcp = agent.mcpServers.filter(function(server) { return server.scope !== "system" && syncedMcpNames.has(server.name); }).length;
        const skillPaths = (agent.skillsPaths && agent.skillsPaths.length ? agent.skillsPaths : [agent.skillsPath]).map(function(path) {
          return '<div class="agent-path" title="' + esc(path) + '">' + esc(path) + '</div>';
        }).join("");
        return '<tr><td><span class="dot ' + (installed && installed.installed ? 'online' : '') + '"></span></td><td><strong>' + esc(agent.displayName) + '</strong><div class="mono muted">' + esc(agent.tool) + '</div></td>' +
          '<td><strong>' + syncedSkills + ' / ' + agent.skills.length + '</strong><div class="muted">synced / installed</div></td><td><strong>' + syncedMcp + ' / ' + agent.mcpServers.length + '</strong><div class="muted">synced / installed</div></td>' +
          '<td><div class="agent-paths">' + skillPaths + '</div></td><td><div class="agent-path" title="' + esc(agent.mcpPath) + '">' + esc(agent.mcpPath) + '</div></td></tr>';
      }).join("");
      return '<div class="table-wrap"><table class="agent-table"><colgroup><col class="status-column"><col class="agent-column"><col class="count-column"><col class="count-column"><col class="skill-path-column"><col class="mcp-path-column"></colgroup><thead><tr><th></th><th>Agent</th><th>Skills</th><th>MCP</th><th>Skill paths</th><th>MCP config</th></tr></thead><tbody>' + rows + '</tbody></table></div>';
    }

    function openForm(title, body, submit, handler, danger) {
      document.getElementById("form-dialog").classList.remove("mcp-add-dialog");
      document.getElementById("form-title").textContent = title;
      document.getElementById("form-body").innerHTML = body;
      const submitButton = document.getElementById("form-submit");
      submitButton.textContent = submit;
      submitButton.title = title;
      submitButton.setAttribute("aria-label", title);
      submitButton.className = "btn " + (danger ? "danger" : "primary");
      state.formHandler = handler;
      document.getElementById("form-dialog").showModal();
      requestAnimationFrame(function() {
        document.querySelector("#form-body input:not([type=hidden]), #form-body [data-select-trigger], #form-body textarea")?.focus();
      });
    }
    async function openEditHooks(tool, eventName, button) {
      setButtonLoading(button, true, "Loading...");
      try {
        const endpoint = "/api/hooks/" + encodeURIComponent(tool) + "/" + encodeURIComponent(eventName);
        const payload = await api(endpoint);
        const hook = payload.hook;
        const handlers = hook.event.handlers.map(function(handler) {
          const status = handler.trusted ? (handler.enabled ? "Active" : "Disabled") : "Needs review";
          const toggle = handler.scope === "plugin" ? '<button type="button" class="hook-toggle" data-action="toggle-hook-state" data-state-id="' + esc(handler.id) + '" data-enabled="' + handler.enabled + '" aria-pressed="' + handler.enabled + '" aria-label="' + (handler.enabled ? 'Disable' : 'Enable') + ' hook" title="' + (handler.trusted ? (handler.enabled ? 'Disable hook' : 'Enable hook') : 'Review this hook in Codex /hooks first') + '"' + (handler.trusted ? '' : ' disabled') + '></button>' : '';
          return '<div class="hook-handler"><div class="hook-handler-head"><div class="hook-handler-source">' + esc(handler.source) + '</div>' + toggle + '</div><div class="hook-handler-meta"><span class="tag">' + esc(handler.scope) + '</span><span class="tag">' + esc(handler.type) + '</span><span class="tag ' + (handler.enabled ? 'green' : 'amber') + '">' + esc(status) + '</span><span class="tag">Matcher: ' + esc(handler.matcher) + '</span></div>' + (handler.command ? '<div class="hook-handler-command">' + esc(handler.command) + '</div>' : '') + '</div>';
        }).join("") || '<div class="muted">No handlers installed for this event.</div>';
        const editor = hook.editable ? textareaField("User handlers (JSON array)", "content", hook.content, "[]", "source-editor") : '';
        const body = '<dl class="detail-meta"><dt>Agent</dt><dd>' + esc(hook.displayName) + '</dd><dt>Event</dt><dd class="mono">' + esc(hook.event.name) + '</dd><dt>Config</dt><dd class="mono">' + esc(hook.path) + '</dd></dl><div class="hook-detail-list">' + handlers + '</div>' + editor;
        openForm(hook.event.name, body, hook.editable ? "Save" : "Close", async function(form) {
          if (hook.editable) await api(endpoint, { method: "PUT", body: JSON.stringify({ content: form.get("content") }) });
          return hook.editable ? "Updated " + hook.event.name + "." : "";
        });
      } catch (error) { toast(error.message, true); }
      finally { setButtonLoading(button, false); }
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
        const menu = shell.selectMenu || shell.querySelector(".select-menu");
        menu.hidden = true;
        if (menu.parentElement !== shell) shell.appendChild(menu);
      });
    }
    function toggleSelectMenu(trigger, forceOpen) {
      const shell = trigger.closest(".select-shell");
      const menu = shell.selectMenu || shell.querySelector(".select-menu");
      const opening = forceOpen === undefined ? !shell.classList.contains("open") : forceOpen;
      closeSelectMenus(shell);
      shell.classList.toggle("open", opening);
      trigger.setAttribute("aria-expanded", String(opening));
      menu.hidden = !opening;
      if (opening && shell.classList.contains("session-agent-select")) {
        shell.selectMenu = menu;
        menu.selectShell = shell;
        document.body.appendChild(menu);
      } else if (!opening && menu.parentElement !== shell) {
        shell.appendChild(menu);
      }
      if (opening) requestAnimationFrame(function() {
        positionSelectMenu(trigger, menu);
        const activeOption = menu.querySelector('[aria-selected="true"]') || menu.querySelector("[data-select-option]");
        if (activeOption) activeOption.focus({ preventScroll: true });
      });
    }
    function positionSelectMenu(trigger, menu) {
      const rect = trigger.getBoundingClientRect();
      const gap = 6;
      const viewportHeight = window.innerHeight;
      const roomBelow = viewportHeight - rect.bottom - gap;
      const roomAbove = rect.top - gap;
      const preferredHeight = Math.min(224, menu.scrollHeight || 224);
      const openAbove = roomBelow < Math.min(160, preferredHeight) && roomAbove > roomBelow;
      const available = Math.max(96, openAbove ? roomAbove : roomBelow);
      const viewportGap = 8;
      const sessionMenu = menu.classList.contains("session-agent-menu");
      const menuWidth = Math.min(sessionMenu ? 148 : rect.width, window.innerWidth - viewportGap * 2);
      const preferredLeft = sessionMenu ? rect.right - menuWidth : rect.left;
      const menuLeft = Math.min(Math.max(viewportGap, preferredLeft), Math.max(viewportGap, window.innerWidth - menuWidth - viewportGap));
      menu.style.left = menuLeft + "px";
      menu.style.width = menuWidth + "px";
      menu.style.maxHeight = Math.min(224, available) + "px";
      menu.style.top = openAbove ? Math.max(8, rect.top - Math.min(preferredHeight, available) - gap) + "px" : rect.bottom + gap + "px";
    }
    function chooseSelectOption(option) {
      const menu = option.closest(".select-menu");
      const shell = menu.selectShell || option.closest(".select-shell");
      const trigger = shell.querySelector("[data-select-trigger]");
      const input = shell.querySelector("input[type=hidden]");
      input.value = option.dataset.value;
      shell.querySelector("[data-select-label]").textContent = option.textContent.trim();
      menu.querySelectorAll("[data-select-option]").forEach(function(item) { item.setAttribute("aria-selected", String(item === option)); });
      toggleSelectMenu(trigger, false);
      if (shell.querySelector('input[name="transport"]')) updateMcpTransport(shell.closest("form"));
      if (input.name === "sessionProvider") {
        state.sessionProvider = input.value;
        const sessions = filteredSessions();
        const selectedVisible = sessions.some(function(session) { return sessionKey(session) === state.selectedSessionKey; });
        if (!selectedVisible) {
          state.selectedSessionKey = sessions[0] ? sessionKey(sessions[0]) : "";
          state.sessionTranscript = null;
        }
        renderSessions();
        if (!selectedVisible && selectedSession()) loadSelectedSessionMessages();
        return;
      }
      trigger.focus();
    }
    function openAddSkill() {
      const method = '<div class="field"><span class="field-label">Source</span><div class="mode-switch" role="group" aria-label="Skill source"><input type="hidden" name="skillAddMode" value="remote"><button type="button" data-skill-add-mode-option="local" aria-pressed="false">Local</button><button type="button" data-skill-add-mode-option="remote" aria-pressed="true">Remote</button></div></div>';
      const body = method +
        '<div data-skill-add-mode="local" hidden><div class="field"><span class="field-label">Agents</span><div class="target-tool-grid">' + toolIconChecks("skillAgents", ["all"]) + '</div></div></div>' +
        '<div data-skill-add-mode="remote">' + field("Git source", "source", "", "git@host:group/repo.git#main:path") + '</div>';
      openForm("Add managed skill", body, "Add", async function(form, element) {
        if (form.get("skillAddMode") === "local") {
          const agents = Array.from(element.querySelectorAll('input[name="skillAgents"]:checked')).map(function(input) { return input.value; });
          if (!agents.length) throw new Error("Select at least one Agent.");
          let count = 0;
          for (const tool of agents) {
            const payload = await api("/api/skills/import-agent", { method: "POST", body: JSON.stringify({ tool: tool }) });
            count += payload.results.reduce(function(total, result) { return total + result.skills.length; }, 0);
          }
          return "Imported " + count + " skill" + (count === 1 ? "" : "s") + ".";
        }
        const payload = await api("/api/skills/import", { method: "POST", body: JSON.stringify({ source: form.get("source") }) });
        return "Imported " + payload.skills.length + " skill" + (payload.skills.length === 1 ? "" : "s") + ".";
      });
      updateSkillAddMode(document.getElementById("dynamic-form"));
    }
    function refreshAgentFilterCounts(kind) {
      document.querySelectorAll('[data-filter-scope="' + kind + '"]').forEach(function(filterButton) {
        const count = filterButton.querySelector(".filter-count");
        if (count) count.textContent = String(filteredResources(kind, filterButton.dataset.filterValue).length);
      });
    }
    function updateAgentSyncButton(button, kind) {
      const name = button.dataset.name;
      const tool = button.dataset.tool;
      const agent = state.data.agents.find(function(item) { return item.tool === tool; });
      let synced = false;
      let available = false;
      let label = "";
      if (kind === "skill") {
        const skill = state.data.skills.find(function(item) { return item.name === name; });
        synced = Boolean(skill && skill.agentLinks.some(function(link) { return link.tool === tool; }));
        available = true;
        label = (synced ? "Stop syncing " : "Sync ") + name + (synced ? " from " : " to ") + toolLabel(tool);
      } else {
        const server = state.data.mcpServers.find(function(item) { return item.name === name; });
        synced = Boolean(agent && agent.mcpServers.some(function(item) { return item.name === name; }));
        const targeted = Boolean(server && (server.targetTools.includes("all") || server.targetTools.includes(tool)));
        available = Boolean(server && server.enabled && targeted);
        label = server && !server.enabled ? "Enable " + name + " before syncing" : !targeted ? name + " is not targeted to " + toolLabel(tool) : (synced ? "Stop syncing " : "Sync ") + name + (synced ? " from " : " to ") + toolLabel(tool);
      }
      button.dataset.synced = String(synced);
      button.setAttribute("aria-pressed", String(synced));
      button.setAttribute("aria-label", label);
      button.title = label;
      button.disabled = !available;
      button.classList.remove("loading");
      button.removeAttribute("aria-busy");
    }
    async function refreshAgentSyncState(button, kind) {
      state.data = await api("/api/snapshot");
      updateAgentSyncButton(button, kind);
      refreshAgentFilterCounts(kind);
    }
    async function toggleSkillAgent(name, tool, synced, button) {
      button.disabled = true;
      button.classList.add("loading");
      button.setAttribute("aria-busy", "true");
      try {
        if (synced) {
          await api("/api/skills/" + encodeURIComponent(name) + "?tool=" + encodeURIComponent(tool), { method: "DELETE" });
          toast("Stopped syncing " + name + " to " + toolLabel(tool) + ".");
        } else {
          await api("/api/skills/sync-selected", { method: "POST", body: JSON.stringify({ names: [name], tool: tool }) });
          toast("Synced " + name + " to " + toolLabel(tool) + ".");
        }
        await refreshAgentSyncState(button, "skill");
      } catch (error) {
        toast(error.message, true);
        updateAgentSyncButton(button, "skill");
      }
    }
    async function toggleMcpAgent(name, tool, synced, button) {
      button.disabled = true;
      button.classList.add("loading");
      button.setAttribute("aria-busy", "true");
      try {
        if (synced) {
          await api("/api/mcp/" + encodeURIComponent(name) + "?tool=" + encodeURIComponent(tool), { method: "DELETE" });
          toast("Stopped syncing " + name + " to " + toolLabel(tool) + ".");
        } else {
          await api("/api/mcp/sync-selected", { method: "POST", body: JSON.stringify({ names: [name], tool: tool }) });
          toast("Synced " + name + " to " + toolLabel(tool) + ".");
        }
        if (button.dataset.action === "delete-mcp-agent") await load();
        else await refreshAgentSyncState(button, "mcp");
      } catch (error) {
        toast(error.message, true);
        updateAgentSyncButton(button, "mcp");
      }
    }
    function mcpFormBody(server) {
      const checks = toolIconChecks("targets", server.targetTools);
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
        '<div class="field"><span class="field-label">Target tools</span><div class="target-tool-grid">' + checks + '</div></div>' +
        '<div class="field"><span class="field-label">Status</span><label class="check"><input type="checkbox" name="enabled"' + (server.enabled ? ' checked' : '') + '><span>Enabled</span></label></div>';
    }
    function toolIconChecks(name, selectedTools) {
      return TOOLS.map(function(tool) {
        const label = toolLabel(tool);
        return '<label class="target-tool-check" title="' + esc(label) + '"><input type="checkbox" data-tool-multi name="' + esc(name) + '" value="' + tool + '" aria-label="' + esc(label) + '"' + (selectedTools.includes(tool) ? ' checked' : '') + '><span class="target-tool-icon">' + toolIcon(tool) + '</span></label>';
      }).join("");
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
    function updateMcpAddMode(form) {
      if (!form) return;
      const mode = form.querySelector('input[name="mcpAddMode"]')?.value || "manual";
      form.querySelectorAll("[data-mcp-add-mode-option]").forEach(function(button) { button.setAttribute("aria-pressed", String(button.dataset.mcpAddModeOption === mode)); });
      form.querySelectorAll("[data-mcp-add-mode]").forEach(function(section) {
        const active = section.dataset.mcpAddMode === mode;
        section.hidden = !active;
        section.querySelectorAll("input, textarea, button").forEach(function(input) { input.disabled = !active; });
      });
      if (mode === "manual") updateMcpTransport(form);
    }
    function updateSkillAddMode(form) {
      if (!form) return;
      const mode = form.querySelector('input[name="skillAddMode"]')?.value || "remote";
      form.querySelectorAll("[data-skill-add-mode-option]").forEach(function(button) { button.setAttribute("aria-pressed", String(button.dataset.skillAddModeOption === mode)); });
      form.querySelectorAll("[data-skill-add-mode]").forEach(function(section) {
        const active = section.dataset.skillAddMode === mode;
        section.hidden = !active;
        section.querySelectorAll("input, textarea, button").forEach(function(input) { input.disabled = !active; });
      });
    }
    function openAddMcp() {
      const server = { name: "", transport: "stdio", command: "", url: "", args: [], env: {}, headers: {}, targetTools: ["all"], enabled: true };
      const method = '<div class="field"><span class="field-label">Method</span><div class="mode-switch" role="group" aria-label="MCP add method"><input type="hidden" name="mcpAddMode" value="manual"><button type="button" data-mcp-add-mode-option="manual" aria-pressed="true">Manual</button><button type="button" data-mcp-add-mode-option="import" aria-pressed="false">Import</button></div></div>';
      const body = method + '<div data-mcp-add-mode="manual">' + mcpFormBody(server) + '</div>' +
        '<div data-mcp-add-mode="import" hidden>' + selectField("Agent", "importTool", toolOptions("all")) + '</div>';
      openForm("Add MCP server", body, "Add", async function(form, element) {
        if (form.get("mcpAddMode") === "import") {
          const payload = await api("/api/mcp/import", { method: "POST", body: JSON.stringify({ tool: form.get("importTool") }) });
          const count = payload.results.reduce(function(total, result) { return total + result.count; }, 0);
          return "Imported " + count + " MCP server" + (count === 1 ? "" : "s") + ".";
        }
        const payload = mcpFormPayload(form, element);
        await api("/api/mcp", { method: "POST", body: JSON.stringify(payload) });
        return "Saved MCP server " + form.get("name") + ".";
      });
      document.getElementById("form-dialog").classList.add("mcp-add-dialog");
      updateMcpAddMode(document.getElementById("dynamic-form"));
    }
    async function openEditMcp(name, button) {
      setButtonLoading(button, true, "Loading...");
      try {
        const payload = await api("/api/mcp/" + encodeURIComponent(name));
        openForm("Edit MCP server", mcpFormBody(payload.server), "Save", async function(form, element) {
          const updated = mcpFormPayload(form, element);
          await api("/api/mcp/" + encodeURIComponent(name), { method: "PUT", body: JSON.stringify(updated) });
          return "Updated MCP server " + updated.name + ".";
        });
        updateMcpTransport(document.getElementById("dynamic-form"));
      } catch (error) { toast(error.message, true); }
      finally { setButtonLoading(button, false); }
    }
    async function openEditSkill(name, button) {
      setButtonLoading(button, true, "Loading...");
      try {
        const payload = await api("/api/skills/" + encodeURIComponent(name));
        const skill = payload.skill;
        const links = payload.agentLinks.length ? payload.agentLinks.map(function(link) { return esc(link.tool + ': ' + link.path); }).join('<br>') : 'none';
        const body = '<dl class="detail-meta"><dt>Scope</dt><dd><span class="tag green">user</span></dd><dt>Source</dt><dd>' + esc(skill.source_type) + '</dd><dt>Path</dt><dd class="mono">' + esc(skill.path) + '</dd><dt>Agent links</dt><dd>' + links + '</dd></dl>' +
          textareaField("SKILL.md", "markdown", payload.markdown, "", "source-editor");
        openForm("Edit " + skill.name, body, "Save", async function(form) {
          await api("/api/skills/" + encodeURIComponent(name), { method: "PUT", body: JSON.stringify({ markdown: form.get("markdown") }) });
          return "Updated skill " + name + ".";
        });
      } catch (error) { toast(error.message, true); }
      finally { setButtonLoading(button, false); }
    }
    function openAgentSkillDetail(tool, payload) {
      const skill = payload.skill;
      const tone = skill.scope === "system" ? "amber" : "green";
      const body = '<dl class="detail-meta"><dt>Agent</dt><dd>' + esc(toolLabel(tool)) + '</dd><dt>Scope</dt><dd><span class="tag ' + tone + '">' + esc(skill.scope) + '</span></dd><dt>Access</dt><dd><span class="tag amber">read only</span></dd><dt>Path</dt><dd class="mono">' + esc(skill.path) + '</dd><dt>Description</dt><dd>' + esc(skill.description || "No description") + '</dd></dl><pre>' + esc(payload.markdown) + '</pre>';
      openDetail(skill.name, body);
    }
    function openDetail(title, body) {
      document.getElementById("detail-title").textContent = title;
      document.getElementById("detail-body").innerHTML = body;
      document.getElementById("detail-dialog").showModal();
    }
    async function openAgentSkill(tool, name, button) {
      setButtonLoading(button, true, "Loading...");
      try {
        const payload = await api("/api/agent-skills/" + encodeURIComponent(tool) + "/" + encodeURIComponent(name));
        openAgentSkillDetail(tool, payload);
      } catch (error) { toast(error.message, true); }
      finally { setButtonLoading(button, false); }
    }
    function openAgentMcp(tool, name) {
      const agent = state.data.agents.find(function(item) { return item.tool === tool; });
      const server = agent?.mcpServers.find(function(item) { return item.name === name; });
      if (!server) { toast("Agent MCP server not found: " + name, true); return; }
      const endpoint = server.transport === "http" ? server.url : [server.command].concat(server.args || []).join(" ");
      const config = {
        transport: server.transport,
        command: server.command,
        url: server.url,
        args: server.args || [],
        targetTools: server.targetTools || [],
        enabled: server.enabled,
        envKeys: server.envKeys || [],
        headerKeys: server.headerKeys || [],
      };
      const body = '<dl class="detail-meta"><dt>Agent</dt><dd>' + esc(toolLabel(tool)) + '</dd><dt>Sync</dt><dd><span class="tag amber">not synced</span></dd><dt>Access</dt><dd><span class="tag amber">read only</span></dd><dt>Path</dt><dd class="mono">' + esc(agent.mcpPath) + '</dd><dt>Endpoint</dt><dd class="mono">' + esc(endpoint) + '</dd></dl><pre>' + esc(JSON.stringify(config, null, 2)) + '</pre>';
      openDetail(server.name, body);
    }
    function confirmAction(title, copy) {
      document.getElementById("confirm-title").textContent = title;
      document.getElementById("confirm-copy").textContent = copy;
      document.getElementById("confirm-dialog").showModal();
      return new Promise(function(resolve) { state.confirmResolve = resolve; });
    }
    async function removeSkillAction(name, tool, button) {
      setButtonLoading(button, true, "Loading...");
      let detail;
      try { detail = await api("/api/skills/" + encodeURIComponent(name)); }
      catch (error) { toast(error.message, true); setButtonLoading(button, false); return; }
      setButtonLoading(button, false);
      if (tool && tool !== "all") {
        const link = detail.agentLinks.find(function(item) { return item.tool === tool; });
        if (!link) { toast(toolLabel(tool) + " does not have a managed symlink for " + name + ".", true); return; }
        const copy = "Remove " + name + " from " + toolLabel(tool) + "?\n\nOnly this Agent symlink will be deleted. The managed skill and other Agent links will remain.";
        const confirmButton = await confirmAction("Remove Agent skill", copy);
        if (!confirmButton) return;
        await mutate(function() { return api("/api/skills/" + encodeURIComponent(name) + "?tool=" + encodeURIComponent(tool), { method: "DELETE" }); }, "Removed " + name + " from " + toolLabel(tool) + ".", "Removing...", confirmButton);
        document.getElementById("confirm-dialog").close();
        return;
      }
      const links = detail.agentLinks.map(function(link) { return link.tool + ": " + link.path; });
      const copy = "Delete the managed source for " + name + "?" + (links.length ? "\n\nThe following Agent links will also be removed:\n" + links.join("\n") : "");
      const confirmButton = await confirmAction("Remove skill", copy);
      if (!confirmButton) return;
      await mutate(function() { return api("/api/skills/" + encodeURIComponent(name), { method: "DELETE" }); }, "Removed " + name + ".", "Removing...", confirmButton);
      document.getElementById("confirm-dialog").close();
    }
    async function removeMcpAction(name) {
      const confirmButton = await confirmAction("Remove MCP server", "Delete " + name + " from the managed registry? Agent configuration files will change only after the next sync.");
      if (!confirmButton) return;
      await mutate(function() { return api("/api/mcp/" + encodeURIComponent(name), { method: "DELETE" }); }, "Removed " + name + ".", "Removing...", confirmButton);
      document.getElementById("confirm-dialog").close();
    }
    async function mutate(action, success, loadingMessage, button) {
      setButtonLoading(button, true, loadingMessage || "Working...");
      try { await action(); toast(success); await load(); }
      catch (error) { toast(error.message, true); }
      finally { setButtonLoading(button, false); }
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
        const optionMenu = option.closest(".select-menu");
        const optionShell = optionMenu.selectShell || option.closest(".select-shell");
        const selectTrigger = optionShell.querySelector("[data-select-trigger]");
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
      if (target.dataset.action === "filter-hooks") {
        state.hookFilter = target.dataset.tool;
        renderHooks();
        return;
      }
      if (target.dataset.view) {
        state.view = target.dataset.view; location.hash = state.view; render();
        if (state.view === "sessions" && !state.sessionsLoaded && !state.sessionsLoading) await loadSessions();
        return;
      }
      if (target.dataset.close !== undefined) { target.closest("dialog").close(); return; }
      if (target.dataset.confirm !== undefined) {
        const confirmed = target.dataset.confirm === "true";
        if (!confirmed) document.getElementById("confirm-dialog").close();
        if (state.confirmResolve) state.confirmResolve(confirmed ? target : null);
        state.confirmResolve = null; return;
      }
      if (target.dataset.mcpAddModeOption) {
        const form = target.closest("form");
        form.querySelector('input[name="mcpAddMode"]').value = target.dataset.mcpAddModeOption;
        updateMcpAddMode(form);
        return;
      }
      if (target.dataset.skillAddModeOption) {
        const form = target.closest("form");
        form.querySelector('input[name="skillAddMode"]').value = target.dataset.skillAddModeOption;
        updateSkillAddMode(form);
        return;
      }
      const action = target.dataset.action;
      if (action === "refresh") await load(target);
      if (action === "refresh-sessions") await loadSessions(target);
      if (action === "select-session") {
        event.preventDefault();
        state.selectedSessionKey = target.dataset.sessionKey;
        state.sessionTranscript = null;
        renderSelectedSession();
        await loadSelectedSessionMessages();
      }
      if (action === "copy-session-dir") { const session = selectedSession(); if (session?.projectDir) await copyText(session.projectDir, "Project directory copied."); }
      if (action === "copy-session-command") { const session = selectedSession(); if (session) await copyText(session.resumeCommand, "Resume command copied."); }
      if (action === "resume-session") await resumeSelectedSession(target);
      if (action === "delete-session") await deleteSelectedSession();
      if (action === "session-toc") {
        const message = document.getElementById("session-message-" + target.dataset.messageIndex);
        if (message) { message.scrollIntoView({ behavior: "smooth", block: "start" }); message.classList.remove("active"); requestAnimationFrame(function() { message.classList.add("active"); }); }
      }
      if (action === "add-skill") openAddSkill();
      if (action === "toggle-skill-agent") await toggleSkillAgent(target.dataset.name, target.dataset.tool, target.dataset.synced === "true", target);
      if (action === "edit-skill") await openEditSkill(target.dataset.name, target);
      if (action === "view-agent-skill") await openAgentSkill(target.dataset.tool, target.dataset.name, target);
      if (action === "delete-skill") await removeSkillAction(target.dataset.name, target.dataset.tool, target);
      if (action === "add-mcp") openAddMcp();
      if (action === "edit-hooks") await openEditHooks(target.dataset.tool, target.dataset.event, target);
      if (action === "toggle-hook-state") {
        const enabled = target.dataset.enabled !== "true";
        target.disabled = true;
        try {
          await api("/api/hooks/codex/state", { method: "POST", body: JSON.stringify({ stateId: target.dataset.stateId, enabled: enabled }) });
          target.dataset.enabled = String(enabled);
          target.setAttribute("aria-pressed", String(enabled));
          target.setAttribute("aria-label", enabled ? "Disable hook" : "Enable hook");
          state.data = await api("/api/snapshot");
          toast(enabled ? "Hook enabled." : "Hook disabled.");
        } catch (error) { toast(error.message, true); }
        finally { target.disabled = false; }
      }
      if (action === "edit-mcp") await openEditMcp(target.dataset.name, target);
      if (action === "view-agent-mcp") openAgentMcp(target.dataset.tool, target.dataset.name);
      if (action === "toggle-mcp-agent") await toggleMcpAgent(target.dataset.name, target.dataset.tool, target.dataset.synced === "true", target);
      if (action === "delete-mcp-agent") await toggleMcpAgent(target.dataset.name, target.dataset.tool, true, target);
      if (action === "delete-mcp") await removeMcpAction(target.dataset.name);
      if (action === "backup") await mutate(function() { return api("/api/backup", { method: "POST", body: "{}" }); }, "Skills backup completed.", "Backing up...", target);
    });
    document.addEventListener("change", function(event) {
      const input = event.target;
      if (input.matches('input[data-tool-multi]')) {
        const form = input.closest("form");
        const selector = 'input[name="' + input.name + '"]';
        if (input.value === "all" && input.checked) {
          form.querySelectorAll(selector + ':not([value="all"])').forEach(function(option) { option.checked = false; });
        } else if (input.checked) {
          const all = form.querySelector(selector + '[value="all"]');
          if (all) all.checked = false;
        }
      }
    });
    window.addEventListener("resize", closeSelectMenus);
    document.addEventListener("scroll", closeSelectMenus, true);
    document.addEventListener("input", function(event) {
      const input = event.target;
      const kind = input.dataset.resourceSearch;
      if (!kind) return;
      state[kind + "SearchDraft"] = input.value;
    });
    document.addEventListener("submit", function(event) {
      const sessionForm = event.target.closest?.("[data-session-search-form]");
      if (sessionForm) {
        event.preventDefault();
        const query = String(new FormData(sessionForm).get("query") || "");
        state.sessionSearchDraft = query;
        state.sessionSearch = query;
        renderSessions();
        const next = document.querySelector("[data-session-search-form] input");
        next?.focus(); next?.setSelectionRange(next.value.length, next.value.length);
        return;
      }
      const form = event.target.closest?.("[data-resource-search-form]");
      if (!form) return;
      event.preventDefault();
      const kind = form.dataset.resourceSearchForm;
      const query = String(new FormData(form).get("query") || "");
      state[kind + "SearchDraft"] = query;
      state[kind + "Search"] = query;
      if (kind === "skill") renderSkills();
      else renderMcp();
      const next = document.querySelector('[data-resource-search="' + kind + '"]');
      next?.focus();
      next?.setSelectionRange(next.value.length, next.value.length);
    });
    document.getElementById("dynamic-form").addEventListener("submit", async function(event) {
      event.preventDefault();
      if (!state.formHandler) return;
      const form = event.currentTarget;
      const submitButton = document.getElementById("form-submit");
      setButtonLoading(submitButton, true, formLoadingMessage(submitButton.textContent));
      try {
        const message = await state.formHandler(new FormData(form), form);
        document.getElementById("form-dialog").close();
        toast(message);
        await load();
      } catch (error) { toast(error.message, true); }
      finally { setButtonLoading(submitButton, false); }
    });
    document.getElementById("confirm-dialog").addEventListener("cancel", function() {
      if (state.confirmResolve) state.confirmResolve(false);
      state.confirmResolve = null;
    });
    document.getElementById("form-dialog").addEventListener("close", function() { closeSelectMenus(); });
    window.addEventListener("hashchange", function() {
      state.view = location.hash.slice(1) || "dashboard";
      render();
      if (state.view === "sessions" && !state.sessionsLoaded && !state.sessionsLoading) void loadSessions();
    });
    if (DEV) watchDevelopmentServer();
    load();
  </script>
</body>
</html>`;
