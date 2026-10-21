// ⚠ 本文件由 scripts/build-client.mjs 生成:改 src/client/client.template.js 或 src/client/styles.css 后重新构建,不要手改这里。
// dsh-xinyue-kit 浏览器半:顶部「新月杀工坊」页签 + 表单 + 历史面板 + 工具结果卡片。
// 形态参照 dsh-skin:纯 JS + React.createElement,零构建。
// 页签注册的是 conversation.view 列表槽(与官方"轨迹"页签同一插槽,order 排在它后面)。
window.__ModuleLoader__.load({
  id: 'dsh-xinyue-kit',
  factory: (require) => {
    var module = { exports: {} };
    var exports = module.exports;
    Object.defineProperty(exports, Symbol.toStringTag, { value: 'Module' });
    var React = require('react');

    // ── 样式(令牌取自 DSH 界面变量,自动适配亮/暗;间距/圆角/过渡走 --nnk-* 设计令牌) ──
    var CSS = ".nnk-wrap{--nnk-gap:12px;--nnk-r:12px;--nnk-rs:8px;--nnk-t:.15s ease;padding:12px;max-width:860px;margin:0 auto;overflow:auto;height:100%}\n.nnk-tabs{display:flex;flex-wrap:wrap;gap:2px;margin-bottom:14px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:8px;padding:1px}\n.nnk-tab{border:0;white-space:nowrap;background:transparent;color:var(--dsw-alias-label-secondary);border-radius:6px;padding:6px 12px;cursor:pointer;font:inherit;font-size:13px;transition:color var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease-in-out),background var(--ds-transition-duration,.2s) var(--ds-ease-in-out,ease-in-out)}\n.nnk-tab:hover{color:var(--dsw-alias-label-primary)}\n.nnk-tab.nnk-active{background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-bg-layer-1));font-weight:600}\n.nnk-card{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--nnk-r);padding:12px 14px;background:var(--dsw-alias-bg-layer-1);margin-bottom:12px}\n.nnk-group{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--nnk-r);padding:12px 14px;margin-bottom:var(--nnk-gap);background:var(--dsw-alias-bg-layer-1)}\n.nnk-group-title{font-size:12px;font-weight:600;color:var(--dsw-alias-brand-primary);letter-spacing:.06em;margin-bottom:8px}\n.nnk-label{display:block;font-size:12px;font-weight:500;color:var(--dsw-alias-label-secondary);margin:6px 0 3px}\n.nnk-input,.nnk-textarea{width:100%;box-sizing:border-box;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);border-radius:var(--nnk-rs);padding:6px 9px;font:inherit;font-size:13px;transition:border-color var(--nnk-t),box-shadow var(--nnk-t)}\n.nnk-input:focus,.nnk-textarea:focus{outline:none;border-color:var(--dsw-alias-brand-primary);box-shadow:0 0 0 2px rgba(0,0,0,.06)}\n.nnk-textarea{min-height:88px;resize:vertical;font-family:inherit}\n.nnk-autoarea{min-height:34px;height:34px;overflow:hidden;resize:vertical;line-height:1.5}\n.nnk-code{font-family:Consolas,monospace;font-size:12px;min-height:140px;white-space:pre;overflow:auto}\n.nnk-radio{display:inline-flex;align-items:center;gap:6px;margin:0;padding:6px 14px;border:1px solid var(--dsw-alias-border-l2);border-radius:999px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-secondary);font-size:13px;cursor:pointer;transition:border-color var(--nnk-t),color var(--nnk-t),background var(--nnk-t);user-select:none}\n.nnk-radio:hover{border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-label-primary)}\n.nnk-radio.nnk-radio-on{border-color:transparent;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-bg-layer-1))}\n.nnk-radios{display:flex;flex-wrap:wrap;gap:8px;align-items:center}\n.nnk-radio input[type=radio]{accent-color:var(--dsw-alias-brand-primary);margin:0}\n.nnk-submit{border:none;border-radius:var(--nnk-rs);padding:10px 26px;background:var(--dsw-alias-button-primary-fill,var(--dsw-alias-brand-primary));color:var(--dsw-alias-label-primary-foreground,var(--dsw-alias-bg-layer-1));cursor:pointer;font:inherit;font-size:14px;font-weight:600;margin-top:14px;transition:filter var(--nnk-t),opacity var(--nnk-t)}\n.nnk-submit:hover:not(:disabled){filter:brightness(1.12)}\n.nnk-submit:disabled{opacity:.5;cursor:default}\n.nnk-hint{font-size:12px;color:var(--dsw-alias-label-secondary);margin-top:10px;line-height:1.6;overflow-wrap:anywhere}\n.nnk-err{color:var(--dsw-alias-state-error-primary);font-size:13px;margin-top:8px;overflow-wrap:anywhere}\n.nnk-ok{color:var(--dsw-alias-state-success-primary);font-size:13px;margin-top:8px;overflow-wrap:anywhere}\n.nnk-taskrow{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--nnk-rs);padding:10px 12px;margin-bottom:8px;font-size:13px;transition:border-color var(--nnk-t)}\n.nnk-taskrow:hover{border-color:var(--dsw-alias-border-l1)}\n.nnk-taskmeta{color:var(--dsw-alias-label-secondary);font-size:12px;margin-top:4px}\n.nnk-note{background:var(--dsw-alias-bg-layer-2);border-radius:6px;padding:6px 10px;font-size:12px;margin:4px 0;color:var(--dsw-alias-label-primary)}\n.nnk-copy{border:1px solid var(--dsw-alias-border-l2);border-radius:7px;padding:4px 12px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:12px;margin-top:8px;transition:border-color var(--nnk-t)}\n.nnk-copy:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary)}\n.nnk-copy:disabled{opacity:.45;cursor:default}\n.nnk-copy.nnk-danger{border-color:var(--dsw-alias-state-error-primary);color:var(--dsw-alias-state-error-primary)}\n.nnk-copy.nnk-danger:hover:not(:disabled){border-color:var(--dsw-alias-state-error-primary);filter:brightness(1.15)}\n.nnk-badge{display:inline-block;border-radius:6px;padding:1px 8px;font-size:11px;margin-right:8px;border:1px solid var(--dsw-alias-border-l2)}\n.nnk-panel{position:fixed;width:380px;max-height:none;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:12px;box-shadow:0 8px 28px rgba(0,0,0,.25);z-index:60}\n.nnk-panel-head{display:flex;align-items:center;justify-content:space-between;padding:8px 12px;border-bottom:1px solid var(--dsw-alias-border-l2);cursor:move;user-select:none}\n.nnk-panel-title{font-weight:600;font-size:13px;color:var(--dsw-alias-label-primary)}\n.nnk-panel-close{border:1px solid rgba(74,58,38,.18);background:#fdfaf1;color:#4a3d2a;cursor:pointer;font-size:15px;line-height:1;padding:3px 8px;border-radius:4px}\n.nnk-panel-close:hover{color:var(--dsw-alias-state-error-primary)}\n.nnk-panel-body{padding:10px 12px;overflow-y:auto;flex:1}\n.nnk-status-open{color:var(--dsw-alias-state-warn-primary)}\n.nnk-status-written{color:var(--dsw-alias-state-warn-primary)}\n.nnk-status-done{color:var(--dsw-alias-state-success-primary)}\n.nnk-mini{width:100%;box-sizing:border-box;min-height:56px;border:1px solid var(--dsw-alias-border-l2);border-radius:6px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);font:inherit;font-size:12px;padding:6px 8px;resize:vertical;margin-top:6px}\n.nnk-smallbtn{border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:3px 10px;background:var(--dsw-alias-bg-layer-2);color:var(--dsw-alias-label-primary);cursor:pointer;font:inherit;font-size:11px;margin:4px 6px 0 0;transition:border-color var(--nnk-t),color var(--nnk-t)}\n.nnk-smallbtn:hover:not(:disabled){border-color:var(--dsw-alias-brand-primary);color:var(--dsw-alias-brand-primary)}\n.nnk-fbrow{border-left:3px solid var(--dsw-alias-border-l2);padding:2px 8px;margin:4px 0;font-size:12px;color:var(--dsw-alias-label-secondary)}\n.nnk-dot{display:inline-block;width:7px;height:7px;border-radius:50%;background:var(--dsw-alias-state-warn-primary);margin-left:5px;vertical-align:middle}\n.nnk-cmd{font-family:Consolas,monospace;font-size:12px;background:var(--dsw-alias-bg-layer-2);border:1px solid var(--dsw-alias-border-l2);border-radius:6px;padding:4px 8px;margin-top:6px;display:inline-block;user-select:all}\n.nnk-row{display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin-top:8px}\n.nnk-break{overflow-wrap:anywhere;word-break:break-all}\n.nnk-section{margin:20px 0 10px;padding-bottom:6px;border-bottom:1px solid var(--dsw-alias-border-l2);font-size:12px;font-weight:700;letter-spacing:.08em;color:var(--dsw-alias-brand-primary)}\n.nnk-section:first-child{margin-top:6px}\n.nnk-grid2{display:grid;grid-template-columns:1fr 1fr;gap:2px 14px}\n@media (max-width:680px){.nnk-grid2{grid-template-columns:1fr}}\n.nnk-labelrow{display:flex;align-items:center;gap:8px;margin:6px 0 3px}\n.nnk-labelrow .nnk-label{margin:0;flex:1;min-width:0}\n.nnk-labelrow .nnk-smallbtn{margin:0}\n.nnk-actions{display:flex;gap:10px;align-items:center;flex-wrap:wrap;margin-top:16px}\n.nnk-errbox{border:1px solid var(--dsw-alias-state-error-primary);border-radius:var(--nnk-rs);background:var(--dsw-alias-bg-layer-2);padding:8px 12px;margin-top:12px;font-size:13px;color:var(--dsw-alias-state-error-primary);overflow-wrap:anywhere}\n.nnk-mask{position:fixed;inset:0;background:rgba(0,0,0,.4);z-index:90;display:flex;align-items:center;justify-content:center;padding:16px}\n.nnk-modal{width:min(720px,100%);max-height:82vh;display:flex;flex-direction:column;background:var(--dsw-alias-bg-layer-1);border:1px solid var(--dsw-alias-border-l2);border-radius:var(--nnk-r);box-shadow:0 14px 44px rgba(0,0,0,.32)}\n.nnk-modal-head{display:flex;align-items:center;justify-content:space-between;padding:10px 14px;border-bottom:1px solid var(--dsw-alias-border-l2);font-weight:600;font-size:13px}\n.nnk-modal-body{padding:10px 14px;overflow:auto;flex:1}\n.nnk-modal-foot{display:flex;gap:10px;align-items:center;justify-content:flex-end;flex-wrap:wrap;padding:10px 14px;border-top:1px solid var(--dsw-alias-border-l2)}\n.nnk-flist{border:1px solid var(--dsw-alias-border-l2);border-radius:var(--nnk-rs);max-height:290px;overflow:auto;background:var(--dsw-alias-bg-layer-2)}\n.nnk-frow{display:flex;gap:8px;align-items:center;padding:6px 10px;font-size:12.5px;cursor:pointer;border-bottom:1px solid var(--dsw-alias-border-l2);color:var(--dsw-alias-label-primary)}\n.nnk-frow:last-child{border-bottom:0}\n.nnk-frow:hover{background:var(--dsw-alias-bg-layer-1)}\n.nnk-frow .nnk-fname{flex:1;min-width:0;overflow-wrap:anywhere}\n.nnk-frow .nnk-fsize{color:var(--dsw-alias-label-secondary);font-size:11px;white-space:nowrap}\n.nnk-frow-on{background:var(--dsw-alias-bg-layer-1);font-weight:600;box-shadow:inset 3px 0 0 var(--dsw-alias-brand-primary)}\n.nnk-path{font-family:Consolas,monospace;font-size:12px}\n.nnk-root,.nnk-panel{--xk-ink:var(--dsw-alias-label-primary);--xk-ink2:var(--dsw-alias-label-secondary);--xk-bg:var(--dsw-alias-bg-layer-1);--xk-bg2:var(--dsw-alias-bg-layer-2);--xk-line:var(--dsw-alias-border-l2);--xk-red:#a32b21;--xk-red2:#8a2118;--xk-gold:#a8823f;--xk-paper:color-mix(in oklab,var(--dsw-alias-bg-layer-1) 93%,#e6d2a6 7%);--xk-paper2:color-mix(in oklab,var(--dsw-alias-bg-layer-2) 90%,#e6d2a6 10%)}\n@media (prefers-color-scheme:dark){.nnk-root,.nnk-panel{--xk-red:#cf6155;--xk-red2:#e08074;--xk-gold:#d6b477}}\n:root[data-theme=dark] .nnk-root,:root[data-theme=dark] .nnk-panel,:root.dark .nnk-root,:root.dark .nnk-panel,body[data-theme=dark] .nnk-root,body[data-theme=dark] .nnk-panel,.dsw-dark .nnk-root,.dsw-dark .nnk-panel{--xk-red:#cf6155;--xk-red2:#e08074;--xk-gold:#d6b477}\n.nnk-root{font-size:15px;line-height:1.65;color:var(--xk-ink)}\n.nnk-shell{display:flex;flex-direction:column;height:100%;min-height:460px;background:var(--xk-paper);color:var(--xk-ink)}\n.nnk-shell-side{width:188px;flex:0 0 188px;border-right:1px solid var(--xk-line);padding:16px 10px;display:flex;flex-direction:column;gap:3px;background:linear-gradient(180deg,var(--xk-paper2),var(--xk-paper))}\n.nnk-brand{display:flex;align-items:center;gap:9px;padding:0 8px 14px}\n.nnk-seal{width:28px;height:28px;flex:0 0 28px;display:grid;place-items:center;background:linear-gradient(180deg,var(--xk-red),var(--xk-red2));color:#f8e9cd;border-radius:3px;font-family:\"STKaiti\",\"KaiTi\",serif;font-size:15px;box-shadow:inset 0 0 0 1px rgba(255,235,190,.4)}\n.nnk-brand-name{font-family:\"STKaiti\",\"KaiTi\",serif;font-size:17px;font-weight:700;letter-spacing:.06em;line-height:1.2}\n.nnk-brand-sub{font-size:9.5px;letter-spacing:.18em;color:var(--xk-ink2);margin-top:2px}\n.nnk-nav{display:flex;align-items:center;gap:9px;width:100%;text-align:left;border:1px solid transparent;background:transparent;color:var(--xk-ink);font:inherit;font-size:15px;font-weight:600;padding:9px 10px;border-radius:3px;cursor:pointer;transition:background .15s,color .15s,border-color .15s;min-height:40px}\n.nnk-nav:hover{background:color-mix(in oklab,var(--xk-red) 9%,transparent)}\n.nnk-nav:focus-visible{outline:2px solid var(--xk-gold);outline-offset:2px}\n.nnk-nav-on{background:color-mix(in oklab,var(--xk-red) 12%,transparent);border-color:color-mix(in oklab,var(--xk-red) 24%,transparent);color:var(--xk-red2);box-shadow:inset 3px 0 0 var(--xk-red)}\n.nnk-nav-ic{width:18px;text-align:center;font-size:15px;opacity:.92}\n.nnk-nav-k{margin-left:auto;font-size:10px;letter-spacing:.14em;color:var(--xk-ink2);font-weight:400}\n.nnk-shell-main{flex:1;min-width:0;overflow:auto;padding:20px 22px 44px}\n.nnk-pagehead{margin-bottom:16px}\n.nnk-workshop .nnk-pagehead{margin-bottom:10px}\n.nnk-workshop .nnk-h1{font-size:30px}\n.nnk-crumb{font-size:11.5px;letter-spacing:.16em;color:var(--xk-ink2);font-weight:600}\n.nnk-h1{margin:2px 0 0;font-family:\"STKaiti\",\"KaiTi\",serif;font-size:30px;font-weight:700;letter-spacing:.06em;color:color-mix(in oklab,var(--xk-ink) 78%,var(--xk-gold) 22%);display:flex;align-items:baseline;gap:12px}\n.nnk-h1 em{font-style:normal;font-size:11.5px;letter-spacing:.22em;color:var(--xk-red);font-family:Georgia,serif;font-weight:400}\n.nnk-root .nnk-label{font-size:13.5px;font-weight:600;color:var(--xk-ink);margin:14px 0 6px;letter-spacing:.02em}\n.nnk-root .nnk-hint{font-size:14px;color:var(--xk-ink2);line-height:1.7;margin-top:10px;overflow-wrap:anywhere}\n.nnk-root .nnk-input,.nnk-root .nnk-textarea,.nnk-root .nnk-mini{font-size:15.5px;border-radius:3px;border-color:var(--xk-line);background:var(--xk-bg2);color:var(--xk-ink);padding:8px 11px}\n.nnk-root .nnk-input{height:38px}\n.nnk-root .nnk-textarea{min-height:96px;line-height:1.7}\n.nnk-root .nnk-input:hover,.nnk-root .nnk-textarea:hover{border-color:color-mix(in oklab,var(--xk-gold) 45%,var(--xk-line))}\n.nnk-root .nnk-input:focus,.nnk-root .nnk-textarea:focus,.nnk-root .nnk-mini:focus{outline:none;border-color:var(--xk-gold);box-shadow:0 0 0 3px color-mix(in oklab,var(--xk-gold) 22%,transparent)}\n.nnk-root .nnk-submit{font-size:15px;font-weight:600;border-radius:3px;padding:9px 26px;margin-top:16px;min-height:38px;background:linear-gradient(180deg,var(--xk-red),var(--xk-red2));color:#fff6e2;box-shadow:inset 0 1px 0 rgba(255,220,180,.22),0 2px 6px rgba(0,0,0,.18)}\n.nnk-root .nnk-submit:hover:not(:disabled){filter:brightness(1.08)}\n.nnk-root .nnk-submit:active:not(:disabled){transform:translateY(1px)}\n.nnk-root .nnk-submit:disabled{opacity:.45;cursor:not-allowed}\n.nnk-root .nnk-smallbtn{font-size:13px;font-weight:600;border-radius:3px;padding:5px 12px;min-height:30px;border-color:var(--xk-line);color:var(--xk-ink);background:var(--xk-bg2)}\n.nnk-root .nnk-smallbtn:hover:not(:disabled){border-color:var(--xk-red);color:var(--xk-red2)}\n.nnk-root .nnk-copy{font-size:13.5px;font-weight:600;border-radius:3px;padding:6px 14px;min-height:32px;background:var(--xk-bg2);border-color:var(--xk-line);color:var(--xk-ink)}\n.nnk-root .nnk-copy:hover:not(:disabled){border-color:var(--xk-red);color:var(--xk-red2)}\n.nnk-root .nnk-submit:focus-visible,.nnk-root .nnk-smallbtn:focus-visible,.nnk-root .nnk-copy:focus-visible,.nnk-root .nnk-radio:focus-visible{outline:2px solid var(--xk-gold);outline-offset:2px}\n.nnk-root .nnk-card,.nnk-root .nnk-group{border-color:var(--xk-line);border-radius:4px;background:color-mix(in oklab,var(--xk-bg) 94%,#e6d2a6 6%);padding:16px 18px;box-shadow:0 2px 10px rgba(90,60,20,.06)}\n.nnk-root .nnk-group-title{font-size:13.5px;font-weight:700;letter-spacing:.06em;color:var(--xk-red2)}\n.nnk-root .nnk-section{font-size:13.5px;font-weight:700;border-bottom:1px solid var(--xk-line);padding-bottom:7px;margin:22px 0 12px;color:var(--xk-red2);letter-spacing:.05em}\n.nnk-root .nnk-err{font-size:13.5px;font-weight:600}\n.nnk-root .nnk-ok{font-size:13.5px;font-weight:600}\n.nnk-root .nnk-taskrow{border-color:var(--xk-line);border-radius:4px;padding:12px 14px;font-size:14.5px}\n.nnk-root .nnk-taskmeta{font-size:13px;color:var(--xk-ink2)}\n.nnk-root .nnk-note{font-size:13.5px;background:var(--xk-bg2);border-radius:3px;padding:8px 12px}\n.nnk-root .nnk-badge{font-size:12px;border-radius:3px;border-color:var(--xk-line);padding:1px 8px}\n.nnk-root .nnk-radio{font-size:14px;border-radius:3px;padding:7px 14px}\n.nnk-root .nnk-grid2{grid-template-columns:1fr 1fr;gap:2px 16px}\n.nnk-root .nnk-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(330px,1fr));gap:14px;margin-top:12px}\n.nnk-root .nnk-err{background:color-mix(in oklab,var(--xk-red) 9%,transparent);border:1px solid color-mix(in oklab,var(--xk-red) 32%,transparent);border-radius:3px;padding:8px 12px;margin:10px 0;color:var(--xk-red2)}\n@media (max-width:760px){.nnk-shell-side{width:64px;flex:0 0 64px;padding:12px 6px}.nnk-brand-name,.nnk-brand-sub,.nnk-nav-k{display:none}.nnk-brand{justify-content:center;padding:0 0 12px}.nnk-nav{justify-content:center;padding:9px 0}.nnk-shell-main{padding:14px 12px 32px}}\n@media (max-width:900px){.nnk-workshop{width:100vw;height:100vh;border-radius:0}}\n.nnk-workshop{width:min(1080px,96vw);height:min(760px,88vh);max-height:none;display:flex;flex-direction:column;overflow:hidden;border-radius:6px}\n.nnk-topbtn{border:1px solid var(--xk-line);background:transparent;color:var(--xk-ink);border-radius:3px;padding:3px 10px;font:inherit;font-size:12px;cursor:pointer}\n.nnk-topbtn:hover{border-color:var(--xk-gold);color:var(--xk-gold)}\n.nnk-topbar .nnk-topbtn{color:#f2e6c8;border-color:rgba(242,230,200,.42)}\n.nnk-topbar .nnk-topbtn:hover{color:#fff3d4;border-color:#e8cf9a}\n.nnk-topbar .ver{color:#f2e6c8;border-color:rgba(242,230,200,.42)}\n.nnk-topbar .chipdot{color:#efe3c6}\n.nnk-topbar .t2{color:#cdbb95}\n.nnk-workshop .nnk-rs{position:absolute;right:0;bottom:0;width:18px;height:18px;cursor:nwse-resize;z-index:3}\n.nnk-workshop .nnk-rs::after{content:\"\";position:absolute;right:5px;bottom:5px;width:8px;height:8px;border-right:2px solid var(--xk-gold);border-bottom:2px solid var(--xk-gold);opacity:.65}\n.nnk-workshop .nnk-panel-body{padding:0;display:flex;flex:1;min-height:0;overflow:hidden}\nbody.nnk-focus .nnk-shell--tab{height:calc(100vh - 92px)!important}\nbody.nnk-focus .nnk-shell--tab .nnk-shell-main{padding-bottom:20px}\n.nnk-shell--tab{height:calc(100vh - 300px);min-height:360px}\n.nnk-shell--tab .nnk-shell-main{padding-bottom:8px}\n.nnk-shell--panel .nnk-topbar{display:none}\n.nnk-shell--panel{height:100%}\n.nnk-topbar{display:flex;align-items:center;gap:12px;height:52px;padding:0 16px;flex:0 0 52px;background:linear-gradient(180deg,#3b2a1a,#2b1d11);border-bottom:2px solid #a8823f;color:#f3e6c8}\n.nnk-topbar .t1{font-family:\"STKaiti\",\"KaiTi\",serif;font-size:19px;font-weight:700;letter-spacing:.08em;color:#f6e7c4}\n.nnk-topbar .t2{font-size:9.5px;letter-spacing:.18em;color:rgba(243,230,200,.62)}\n.nnk-topbar .spacer{flex:1}\n.nnk-topbar .chipdot{display:inline-flex;align-items:center;gap:6px;font-size:12px;color:rgba(243,230,200,.8)}\n.nnk-topbar .dot{width:7px;height:7px;border-radius:50%;background:#6fae7c;box-shadow:0 0 0 3px rgba(111,174,124,.18)}\n.nnk-topbar .dot.bad{background:#c9554a;box-shadow:0 0 0 3px rgba(201,85,74,.18)}\n.nnk-topbar .ver{border:1px solid rgba(243,230,200,.28);border-radius:3px;padding:2px 8px;font-size:11px;letter-spacing:.06em;color:rgba(243,230,200,.8)}\n.nnk-shell-body{display:flex;flex:1;min-height:0}\n.nnk-form{display:flex;flex-direction:column;gap:10px}\n.nnk-form .nnk-card{margin-bottom:0}\n.nnk-sechead{display:flex;align-items:center;gap:8px;margin-bottom:8px}\n.nnk-sectag{display:inline-block;background:linear-gradient(180deg,#a8352a,#8a2118);color:#fff3dd;font-size:12.5px;font-weight:700;letter-spacing:.1em;padding:3px 10px;border-radius:2px}\n.nnk-sechint{font-size:12.5px;color:#7d6b55}\n.nnk-secbody{display:flex;flex-direction:column;gap:8px}\n.nnk-field{display:flex;flex-direction:column;gap:4px;min-width:0}\n.nnk-fhint{font-size:11.5px;color:#8a7860;line-height:1.45}\n.nnk-grid2{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 14px}\n.nnk-grid3{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px 12px}\n.nnk-grid4{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:8px 12px}\n@media (max-width:960px){.nnk-grid4{grid-template-columns:repeat(2,minmax(0,1fr))}}\n@media (max-width:560px){.nnk-grid4{grid-template-columns:1fr}}\n@media (max-width:860px){.nnk-grid3{grid-template-columns:1fr}}\n@media (max-width:720px){.nnk-grid2{grid-template-columns:1fr}}\n.nnk-skillcard{border:1px solid #e2d6bd;background:#fffdf7;border-radius:3px;padding:10px 12px;display:flex;flex-direction:column;gap:8px}\n.nnk-skillhead{display:flex;align-items:center;justify-content:space-between}\n.nnk-skillname{font-size:13px;color:#5b4a34}\n.nnk-skillbtns{display:flex;gap:4px}\n.nnk-inline{display:flex;gap:6px;align-items:flex-start}\n.nnk-inline .nnk-textarea{flex:1;min-width:0}\n.nnk-fileblocks{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:10px}\n.nnk-fileblock{border:1px dashed #d3bf95;border-radius:4px;padding:8px 10px;background:#fbf6e9}\n.nnk-fbhead{display:flex;align-items:center;justify-content:space-between;gap:8px}\n.nnk-fblabel{font-size:12.5px;font-weight:600;color:#574e40}\n.nnk-fbrow{display:flex;align-items:center;gap:6px;margin-top:5px;font-size:12px;color:#4a3d2a}\n.nnk-fbname{flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.nnk-fbx{border:0;background:transparent;color:#a32b21;cursor:pointer;font-size:12px;padding:0 2px}\n.nnk-fbempty{margin-top:6px;font-size:12px;color:#8a7860}\n.nnk-fbhint{margin-top:6px;font-size:11.5px;color:#8a7860}\n.nnk-deliver{display:flex;align-items:flex-end;justify-content:space-between;gap:14px;flex-wrap:wrap;margin-top:8px}\n.nnk-deliver .nnk-label{margin-top:0}\n.nnk-deliver .nnk-submit{margin-top:0}\n.nnk-stickybar{position:sticky;bottom:-2px;z-index:6;background:linear-gradient(180deg,rgba(247,241,224,0),#f7f1e0 48%);border-top:1px solid #e2d3b3;padding:10px 2px 8px;margin-top:-2px}\n.nnk-stickybar .nnk-label{margin-top:0}\n.nnk-extgrid{display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:10px}\n.nnk-extcard{border:1px solid #e2d3b3;border-left:3px solid #a8823f;border-radius:3px;background:#fdfaf1;padding:10px 12px;cursor:pointer;transition:box-shadow .15s,border-color .15s}\n.nnk-extcard:hover{box-shadow:0 6px 18px rgba(120,90,40,.10)}\n.nnk-extcard.is-on{border-left-color:#a32b21;background:#fbf4e4}\n.nnk-extcard-h{display:flex;align-items:center;justify-content:space-between;gap:8px;font-size:15px}\n.nnk-extcard-meta{margin-top:4px;font-size:12.5px;color:#6f6455}\n.nnk-extcard-last{margin-top:2px;font-size:12px;color:#7a6a52;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}\n.nnk-extcard-act{margin-top:8px}\n.nnk-detail-h{display:flex;align-items:center;justify-content:space-between;gap:8px}\n.nnk-detail-bar{margin-top:8px}\n.nnk-chips{display:flex;flex-wrap:wrap;gap:6px}\n.nnk-chip-btn{border:1px solid #d9c9a8;background:#fbf6e9;color:#4a3d2a;border-radius:2px;padding:3px 8px;font:inherit;font-size:12px;cursor:pointer}\n.nnk-chip-btn:hover{border-color:#a32b21;color:#a32b21}\n.nnk-notes{display:flex;flex-direction:column;gap:5px}\n.nnk-note-row{display:flex;align-items:flex-start;gap:6px}\n.nnk-note-row .nnk-note{flex:1;min-width:0}\n.nnk-change-row{display:flex;gap:8px;align-items:baseline;font-size:12.5px;color:#574e40;padding:4px 0;border-bottom:1px dashed #e6d9bc}\n.nnk-change-t{color:#8a7860;font-variant-numeric:tabular-nums;flex:none}\n.nnk-change-s{flex:1;min-width:0}\n.nnk-empty{text-align:center;padding:28px 12px;border:1px dashed #d3bf95;border-radius:4px;background:#fbf6e9}\n.nnk-empty b{font-size:15px;color:#574e40}\n.nnk-empty .nnk-fhint{margin-top:6px}\n.nnk-setgrid{display:grid;grid-template-columns:1fr 1fr;gap:10px}\n.nnk-setgrid>.nnk-span2{grid-column:1/-1}\n.nnk-setcard{padding:12px 14px}\n.nnk-settitle{font-size:15px;font-weight:700;color:#1f1b15;margin-bottom:6px}\n.nnk-btnrow{display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-top:8px}\n.nnk-skillcard{padding:9px 11px;border:1px solid #e2d3b3;border-radius:3px;background:#fdfaf1;margin-bottom:8px}\n.nnk-skillhead{display:flex;align-items:center;gap:8px;margin-bottom:6px}\n.nnk-skill-name{flex:1;min-width:0;max-width:340px;height:32px;font-size:13.5px}\n.nnk-skillgrid{display:grid;grid-template-columns:1fr 1fr;gap:6px 10px}\n.nnk-skillcard .nnk-label{margin:0 0 3px;font-size:12px}\n.nnk-skillcard .nnk-textarea{min-height:38px;font-size:13px;padding:6px 8px}\n.nnk-skill-vo{margin-top:6px;align-items:center;gap:6px}\n.nnk-skill-vo .nnk-textarea{min-height:30px;height:30px;font-size:12.5px;padding:4px 8px}\n@media (max-width:760px){.nnk-skillgrid{grid-template-columns:1fr}}\n.nnk-shell :focus-visible{outline:2px solid #a8823f;outline-offset:2px;border-radius:2px}\n.nnk-nav:focus-visible{outline-offset:-2px}\n@media (max-width:980px){.nnk-shell-body{flex-direction:column}.nnk-shell-side{width:auto;flex:0 0 auto;flex-direction:row;overflow-x:auto;padding:8px 10px;border-right:0;border-bottom:1px solid var(--xk-line);gap:4px}.nnk-nav{width:auto;flex:0 0 auto;padding:6px 10px}.nnk-nav-k{display:none}.nnk-shell-main{padding:14px 14px 32px}}\n@media (max-width:680px){.nnk-shell-main{padding:10px 10px 28px}.nnk-topbar{height:46px;padding:0 10px}.nnk-topbar .t2{display:none}.nnk-extgrid{grid-template-columns:1fr}}\n.nnk-pickskill{margin-bottom:6px}\n.nnk-trow{position:relative;background:#fdfaf1;border:1px solid #e2d3b3;border-radius:3px;padding:12px 14px 10px;margin-bottom:10px;box-shadow:0 1px 0 rgba(255,255,255,.8) inset,0 6px 18px rgba(120,90,40,.05)}\n.nnk-trow:before{content:\"\";position:absolute;left:0;top:0;bottom:0;width:3px;border-radius:3px 0 0 3px;background:#a8823f}\n.nnk-trow.is-open:before{background:#a32b21}\n.nnk-tr-head{display:flex;align-items:center;gap:8px;padding-left:4px}\n.nnk-tr-dot{width:7px;height:7px;border-radius:50%;background:#8aa07a;flex:none}\n.nnk-trow.is-open .nnk-tr-dot{background:#c05a4a}\n.nnk-tr-id{font-size:16px;font-weight:700;color:#1f1b15;letter-spacing:.01em}\n.nnk-tr-kind{font-size:12px;font-weight:600;color:#6f6455;border:1px solid #d3bf95;border-radius:2px;padding:1px 7px;background:#f7f1e0}\n.nnk-tr-time{margin-left:auto;font-size:12px;color:#7a6a52;font-variant-numeric:tabular-nums}\n.nnk-tr-sub{margin:4px 0 0 4px;font-size:13px;color:#574e40}\n.nnk-tr-progress{height:4px;border-radius:2px;background:#e6d9bc;margin:9px 0 7px;overflow:hidden}\n.nnk-tr-progress i{display:block;height:100%;background:linear-gradient(90deg,#a32b21,#c05a4a)}\n.nnk-tr-chips{display:flex;flex-wrap:wrap;gap:6px;margin:0 0 6px 2px}\n.nnk-tr-chip{font-size:12.5px;color:#574e40;border:1px solid #d9c9a8;border-radius:2px;padding:1px 8px;background:#fbf6e9}\n.nnk-tr-chip.is-ok{color:#2f6b5e;border-color:#a9c4b3;background:#eef5ef}\n.nnk-tr-meta{font-size:12.5px;color:#6f6455;margin:0 0 8px 4px;line-height:1.6}\n.nnk-tr-actions{display:flex;flex-wrap:wrap;gap:6px;padding-left:2px}";
    if (typeof document !== 'undefined' && document.querySelector('style[data-plugin-css="dsh-xinyue-kit/ui"]') === null) {
      var tag = document.createElement('style');
      tag.dataset.plugin = 'dsh-xinyue-kit';
      tag.dataset.pluginCss = 'dsh-xinyue-kit/ui';
      tag.textContent = CSS;
      document.head.appendChild(tag);
    }

    function h(type, props) {
      var children = Array.prototype.slice.call(arguments, 2);
      return React.createElement.apply(React, [type, props].concat(children));
    }
    // e(tag, className, ...children):className 为字符串(可为空串);子元素数量不限。
    function e(tag, className) {
      /* 已知坑(实测白屏事故):e 只吃 (tag, className, ...子节点),把内联样式写成
       * e('div','cls',{style:…},文本) 时,那个纯对象会被当**子节点**渲染 → React
       * 报「object with keys {style}」→ 整个浮窗被槽位吞成空白,且没有红字。
       * 这里把"看起来像 props 的纯对象"当手滑拦下(改用 h),顺带把错误喊出来——
       * 只有真手滑才走这个分支,正常调用零成本 */
      var kids = Array.prototype.slice.call(arguments, 2);
      if (kids.length && kids[0] && typeof kids[0] === 'object' && !Array.isArray(kids[0]) && !kids[0].$$typeof) {
        console.error('[xinyue-kit] e() 手滑:第 3 个参数是对象,已按 props 处理(该用 h)——', tag, className, Object.keys(kids[0]), new Error('e').stack);
        var shifted = Object.assign({ className: className }, kids[0]);
        return h.apply(null, [tag, shifted].concat(kids.slice(1)));
      }
      var props = className ? { className: className } : {};
      return h.apply(null, [tag, props].concat(kids));
    }

    function textField(label, value, onChange, opts) {
      opts = opts || {};
      return h('div', { key: label },
        e('label', 'nnk-label', label),
        autoArea({ value: value, placeholder: opts.placeholder || '', className: opts.code ? 'nnk-code' : '' }, onChange)
      );
    }

    /** 可换行的多行框:默认单行高,内容换行/变长时自动长高(右下角仍可手动拉高)。
     * 用途:原先的单行 input(图片路径/配音/技能名/改动说明等)统一换成它。 */
    function autoArea(props, onChange) {
      var adjust = function (el) {
        if (!el || !el.style) return;
        el.style.height = 'auto';
        var cap = 120;
        var want = Math.max(34, el.scrollHeight + 2);
        el.style.height = Math.min(want, cap) + 'px';
        el.style.overflowY = want > cap ? 'auto' : 'hidden';
      };
      return h('textarea', Object.assign({}, props, {
        className: 'nnk-textarea nnk-autoarea' + (props.className ? ' ' + props.className : ''),
        rows: 1,
        onChange: function (ev) { if (onChange) onChange(ev.target.value); adjust(ev.target) },
        ref: function (el) { adjust(el) },
      }));
    }

    function radioGroup(label, value, options, onChange) {
      return h('div', {},
        e('label', 'nnk-label', label),
        h('div', { className: 'nnk-radios' }, options.map(function (opt) {
          var on = value === opt.value;
          return h('label', { key: opt.value, className: 'nnk-radio' + (on ? ' nnk-radio-on' : '') },
            h('input', { type: 'radio', name: label + opt.value, className: 'nnk-radio-input', checked: on, onChange: function () { onChange(opt.value) } }),
            opt.text
          );
        }))
      );
    }

    // 表单分组卡片:标题 + 内容容器(纯视觉,不裹数据)
    function formGroup(title, kids) {
      return h('div', { className: 'nnk-group' },
        e('div', 'nnk-group-title', title),
        h('div', null, kids)
      );
    }

    // 分区小节标题:长表单靠它分段(基本信息/元信息/素材/技能/写入方式)
    function sectionTitle(title) {
      return e('div', 'nnk-section', title);
    }

    // ── 📁 选择文件:只读目录浏览模态框 ──────────────────────────
    /* 以前让用户把本地路径抄进输入框:难打、易错、还得自己记住目录。
     * 现在服务端只回答「这个目录里有什么」(GET /xinyue-kit-api/fs/list,只读、不递归),
     * 客户端负责点选。picker 状态挂在打开它的组件里(form.picker / box.picker,null=关闭)。 */
    var PICKER_FILTER_TEXT = { image: '图片 jpg/jpeg/png/webp/bmp/gif', audio: '音频 mp3' };

    function newPickerState(opts) {
      opts = opts || {};
      var skills = Array.isArray(opts.skills) ? opts.skills : [];
      return {
        title: opts.title || '选择文件',
        filter: opts.filter || 'image',
        multiple: !!opts.multiple,
        purpose: opts.purpose || 'plain',   // plain=只回路径;image-task/audio-task=顺带起名
        skills: skills,
        audioKind: skills.length ? 'skill' : 'death',
        skillName: skills.length ? skills[0] : '',
        dir: '', parent: '', places: [], entries: [], total: 0, truncated: false,
        loading: false, err: '', pathInput: '', nameQuery: '',
        selected: [], names: {},
        onConfirm: opts.onConfirm || null,
      };
    }

    function baseName(p) { return String(p || '').split(/[\\/]/).pop() || ''; }

    function fmtSize(n) {
      var v = Number(n) || 0;
      if (v < 1024) return v + ' B';
      if (v < 1024 * 1024) return Math.round(v / 1024) + ' KB';
      return (v / 1024 / 1024).toFixed(1) + ' MB';
    }

    /** 拉一层目录;dir 为空 = 只要常用位置(与服务端口径一致)。 */
    function pickerLoad(setPicker, dir, filter) {
      setPicker(function (prev) { return prev ? Object.assign({}, prev, { loading: true, err: '' }) : prev });
      var query = '/xinyue-kit-api/fs/list?filter=' + encodeURIComponent(filter || '') +
        (dir ? '&dir=' + encodeURIComponent(dir) : '');
      fetch(query).then(function (r) { return r.json() }).then(function (body) {
        setPicker(function (prev) {
          if (!prev) return prev;
          if (!body.ok) return Object.assign({}, prev, { loading: false, err: body.error || '目录读取失败', places: body.places || prev.places });
          return Object.assign({}, prev, {
            loading: false, err: '',
            dir: body.dir || '', parent: body.parent || '',
            places: body.places || [], entries: body.entries || [],
            total: body.total || 0, truncated: !!body.truncated,
            pathInput: body.dir || '',
          });
        });
      }, function (error) {
        setPicker(function (prev) { return prev ? Object.assign({}, prev, { loading: false, err: (error && error.message) || String(error) }) : prev });
      });
    }

    /** 打开选择器:opts.onConfirm({paths, names, audioKind, skillName}) 拿结果。 */
    function openPicker(setForm, setPicker, opts) {
      var state = newPickerState(opts);
      setForm(function (prev) { return Object.assign({}, prev, { picker: state }) });
      pickerLoad(setPicker, '', state.filter);
    }

    function FilePickerModal(props) {
      var picker = props.picker;
      var setPicker = props.setPicker;
      if (!picker) return null;
      var set = function (patch) { setPicker(function (prev) { return prev ? Object.assign({}, prev, patch) : prev }) };
      var close = function () { setPicker(null) };
      var go = function (dir) { pickerLoad(setPicker, dir, picker.filter) };
      var toggle = function (path) {
        setPicker(function (prev) {
          if (!prev) return prev;
          var has = prev.selected.indexOf(path) >= 0;
          if (has) {
            var names0 = Object.assign({}, prev.names);
            delete names0[path];
            return Object.assign({}, prev, { selected: prev.selected.filter(function (p) { return p !== path }), names: names0 });
          }
          var next = prev.multiple ? prev.selected.concat([path]) : [path];
          var names = Object.assign({}, prev.names);
          if (prev.purpose !== 'plain' && !names[path]) names[path] = baseName(path);
          return Object.assign({}, prev, { selected: next, names: names });
        });
      };
      var confirm = function () {
        var paths = picker.selected.slice();
        if (!paths.length) { set({ err: '还没有选中任何文件' }); return }
        if (picker.onConfirm) picker.onConfirm({ paths: paths, names: Object.assign({}, picker.names), audioKind: picker.audioKind, skillName: picker.skillName });
        close();
      };
      var q = String(picker.nameQuery || '').trim().toLowerCase();
      var entries = (picker.entries || []).filter(function (en) {
        if (en.isDir) return true;
        return !q || String(en.name).toLowerCase().indexOf(q) >= 0;
      });
      var skills = picker.skills || [];
      var naming = picker.purpose === 'audio-task' || picker.purpose === 'image-task';
      return h('div', { className: 'nnk-mask', onClick: function (ev) { if (ev.target === ev.currentTarget) close() } },
        h('div', { className: 'nnk-modal' },
          h('div', { className: 'nnk-modal-head' },
            e('span', '', picker.title + '　' + (PICKER_FILTER_TEXT[picker.filter] || '所有文件')),
            h('button', { className: 'nnk-panel-close', onClick: close, title: '关闭' }, '✕')
          ),
          h('div', { className: 'nnk-modal-body' },
            h('div', { className: 'nnk-row', style: { marginTop: '0' } },
              h('input', {
                className: 'nnk-input nnk-path', style: { flex: '1', minWidth: '220px' },
                value: picker.pathInput, placeholder: '输入目录路径后回车;或从下面点选',
                onChange: function (ev) { set({ pathInput: ev.target.value }) },
                onKeyDown: function (ev) { if (ev.key === 'Enter') go(String(picker.pathInput || '').trim()) },
              }),
              h('button', { className: 'nnk-smallbtn', style: { margin: '0' }, onClick: function () { go(String(picker.pathInput || '').trim()) } }, '前往'),
              h('button', { className: 'nnk-smallbtn', style: { margin: '0' }, disabled: !picker.dir, onClick: function () { go(picker.parent || '') } }, '⬆ 上一级'),
              h('button', { className: 'nnk-smallbtn', style: { margin: '0' }, onClick: function () { go('') } }, '🏠 常用位置')
            ),
            picker.err ? e('div', 'nnk-err', picker.err) : null,
            picker.loading ? e('div', 'nnk-hint', '读取中…') : null,
            !picker.dir
              ? h('div', { className: 'nnk-flist' }, (picker.places || []).length
                  ? (picker.places || []).map(function (pl) {
                      return h('div', { key: pl.path, className: 'nnk-frow', onClick: function () { go(pl.path) } },
                        e('span', 'nnk-fname', pl.name + '　' + pl.path))
                    })
                  : e('div', 'nnk-hint', '没有可用的常用位置,请在上面的路径栏直接输入'))
              : [
                  h('div', { className: 'nnk-row', style: { marginTop: '8px' } },
                    h('input', {
                      className: 'nnk-input', style: { flex: '1', minWidth: '180px' },
                      value: picker.nameQuery, placeholder: '按文件名过滤(只筛当前目录的文件)',
                      onChange: function (ev) { set({ nameQuery: ev.target.value }) },
                    }),
                    e('span', 'nnk-hint', '共 ' + entries.length + ' 项' + (picker.truncated ? '(已截断,请进子目录)' : ''))
                  ),
                  h('div', { className: 'nnk-flist' },
                    entries.length ? entries.map(function (en) {
                      var on = picker.selected.indexOf(en.path) >= 0;
                      return h('div', {
                        key: en.path, className: 'nnk-frow' + (on ? ' nnk-frow-on' : ''),
                        onClick: function () { if (en.isDir) go(en.path); else toggle(en.path) },
                      },
                        e('span', 'nnk-fname', (en.isDir ? '📁 ' : '📄 ') + en.name),
                        en.isDir ? null : e('span', 'nnk-fsize', fmtSize(en.size)),
                        on ? e('span', 'nnk-badge', '✓ 已选') : null)
                    }) : e('div', 'nnk-hint', (picker.filter === 'image' || picker.filter === 'audio')
                      ? '此目录没有可选的' + (PICKER_FILTER_TEXT[picker.filter] || '文件') + '(可进子目录或换过滤)'
                      : '此目录为空')
                  )
                ],
            naming && picker.purpose === 'audio-task' ? h('div', { className: 'nnk-radios' },
              e('span', 'nnk-hint', '归属:'),
              h('label', { className: 'nnk-radio' + (picker.audioKind === 'skill' ? ' nnk-radio-on' : '') },
                h('input', { type: 'radio', className: 'nnk-radio-input', checked: picker.audioKind === 'skill', onChange: function () { set({ audioKind: 'skill' }) } }), '技能配音 → audio/skill/'),
              h('label', { className: 'nnk-radio' + (picker.audioKind === 'death' ? ' nnk-radio-on' : '') },
                h('input', { type: 'radio', className: 'nnk-radio-input', checked: picker.audioKind === 'death', onChange: function () { set({ audioKind: 'death' }) } }), '阵亡语音 → audio/death/'),
              picker.audioKind === 'skill' && skills.length
                ? h('select', { className: 'nnk-input', style: { width: 'auto' }, value: picker.skillName, onChange: function (ev) { set({ skillName: ev.target.value }) } },
                    skills.map(function (s) { return h('option', { key: s, value: s }, s) }))
                : null
            ) : null,
            naming && picker.selected.length ? h('div', {},
              e('div', 'nnk-hint', '包内文件名(可改;多句按句序自己编号,例: mrfz_xxx1.mp3):'),
              picker.selected.map(function (p) {
                return h('div', { key: p, className: 'nnk-row', style: { marginTop: '4px' } },
                  e('span', 'nnk-hint nnk-break', '📄 ' + baseName(p)),
                  h('input', {
                    className: 'nnk-input', style: { flex: '1', minWidth: '160px' },
                    value: picker.names[p] || '',
                    onChange: function (ev) { var nm = Object.assign({}, picker.names); nm[p] = ev.target.value; set({ names: nm }) },
                    placeholder: '包内文件名',
                  }))
              })
            ) : null
          ),
          h('div', { className: 'nnk-modal-foot' },
            e('span', 'nnk-hint', '已选 ' + picker.selected.length + ' 个' + (picker.multiple ? '(可多选)' : '')),
            h('button', { className: 'nnk-smallbtn', style: { margin: '0' }, onClick: function () { set({ selected: [], names: {} }) } }, '清空'),
            h('button', { className: 'nnk-smallbtn', style: { margin: '0' }, onClick: close }, '取消'),
            h('button', { className: 'nnk-submit', style: { margin: '0', padding: '6px 18px', fontSize: '13px' }, onClick: confirm }, '确定')
          )
        )
      );
    }

    // ── 任务表单:武将区 / 卡牌区 ──────────────────────────────────
    function NewTaskForm(props) {
      var send = props.send;
      var state = React.useState({
        mode: 'new', type: 'general', folder: '我的扩展', taskId: '', title: '', idPrefix: '',
        generalInfo: '', skills: [{ name: '', desc: '', audios: '' }], image: '', deathAudios: '', usedIds: [], notes: [],
        /* 武将元信息(称号/设计/配音/画师):新建默认「官方」= 预填并照写进翻译表;
         * 进入编辑模式时清空(留空 = 不改),见 metaDefaults()。 */
        metaTitle: '官方', metaDesigner: '官方', metaCv: '官方', metaIllustrator: '官方',
        gKingdom: '', gHp: '4/4', gGender: 'Male', kingdomList: [], pasteText: '', pasteMsg: '',
        /* 卡牌基本信息:自由文本占位。【待补充】FreeKill 的卡牌/牌堆定义未核实——
         * 旧语义的「加入牌堆 + 花色点数表」已删除,不自行编造花色点数写法。 */
        cardInfo: '',
        writeMode: 'auto',
        reference: '', busy: false, err: '',
        extList: [], extLoading: false, currentInfo: '',
        goal: 'create', entryId: '', entryList: [], entryLoading: false, editNotes: '', addSkills: false,
        entrySkills: [], entrySkillsLoading: false, pickedSkills: [],
        // 🎲 新玩法(自定义模式)专属字段
        brief: '', numConfig: '5', numCustom: '', winConfig: '', rules: '',
        // 📁 选择文件模态框状态(null = 关闭)
        picker: null
      });
      // pickedSkills = [{ id, name, note }]:勾选的技能 + 用户当场写的修改内容
      var form = state[0], setForm = state[1];
      var set = function (key) { return function (v) { setForm(function (prev) { var next = {}; next[key] = v; return Object.assign({}, prev, next) }) } };
      var patch = function (p) { setForm(function (prev) { return Object.assign({}, prev, p) }) };

      React.useEffect(function () {
        fetch('/xinyue-kit-api/kingdoms').then(function (r) { return r.json() }).then(function (b) {
          if (b && b.ok) patch({ kingdomList: b.kingdoms || [] });
        }, function () { /* 拿不到就只留手写 */ });
      }, []);

      /* 元信息默认值:新建 = 「官方」(用户明确要求一上来就是官方,照写进翻译表);
       * 编辑已有条目 = 留空(留空 = 不改,由 AI 保留原值)。 */
      var metaDefaults = function (editing) {
        return editing
          ? { metaTitle: '', metaDesigner: '', metaCv: '', metaIllustrator: '' }
          : { metaTitle: '官方', metaDesigner: '官方', metaCv: '官方', metaIllustrator: '官方' };
      };

      // 📁 选择文件:模态框状态独立在 form.picker 里(函数式更新,导航/选择都不动其他字段)
      var setPicker = function (patchOrFn) {
        setForm(function (prev) {
          // null = 关闭模态框(不能走 Object.assign:null 会被当成空补丁,框关不掉)
          var next = patchOrFn === null ? null
            : (typeof patchOrFn === 'function' ? patchOrFn(prev.picker) : Object.assign({}, prev.picker, patchOrFn));
          return Object.assign({}, prev, { picker: next });
        });
      };
      var pickFile = function (opts) { openPicker(setForm, setPicker, opts) };
      /** 把选中的路径并入多行文本框(去重,一行一个);用于配音这类可累加的字段。 */
      var appendPaths = function (current, paths) {
        var list = String(current || '').split(/[,，;；\n]/).map(function (t) { return t.trim() }).filter(Boolean);
        (paths || []).forEach(function (p) { if (list.indexOf(p) < 0) list.push(p) });
        return list.join('\n');
      };

      var genTaskId = function (folder, avoid) {
        avoid = avoid || [];
        return fetch('/xinyue-kit-api/tasks').then(function (r) { return r.json() }).then(function (body) {
          var n = (body.tasks || []).filter(function (t) { return t.folder === folder }).length + 1;
          var used = {};
          avoid.forEach(function (id) { used[id] = true });
          var cand = folder + '-' + String(n).padStart(2, '0');
          while (used[cand]) { n += 1; cand = folder + '-' + String(n).padStart(2, '0') }
          return cand;
        }, function () { return folder + '-' + Date.now().toString().slice(-4) });
      };

      var switchMode = function (mode) {
        // 🎲 mode 类型两种目标都支持:新建 = 从零生成模式;编辑 = 修改已生成的模式包
        var goal = (form.type === 'mode' && mode === 'edit') ? 'edit' : 'create';
        patch(Object.assign({
          mode: mode, goal: goal, err: '', currentInfo: '', usedIds: [], notes: [],
          entryId: '', entryList: [], entrySkills: [], pickedSkills: [], editNotes: '', addSkills: false,
        }, metaDefaults(goal === 'edit')));
        if (mode === 'edit' && form.extList.length === 0 && !form.extLoading) {
          patch({ extLoading: true });
          fetch('/xinyue-kit-api/history').then(function (r) { return r.json() }).then(function (body) {
            setForm(function (prev) { return Object.assign({}, prev, { extLoading: false, extList: (body.extensions || []).map(function (x) { return x.folder }) }) });
          }, function () { setForm(function (prev) { return Object.assign({}, prev, { extLoading: false, err: '扩展包列表获取失败' }) }) });
        }
      };

      // 「编辑已有武将/卡牌」:列出目标包内条目(锚点/无锚老包通吃)。
      /* 任务类型 ↔ 服务端条目 kind 的映射:任务层「武将」的值是 general,
       * 而区块/条目模型里恰好仍是 character(服务端 listEntries/区块 kind 只认
       * character/card/skill)。把 general 直接发给 /entries 或 block: 会被服务端拒掉,
       * 所以只在「任务消息/表单状态」上用 general,所有 API 入参一律映射回 character。 */
      var entriesKind = function (t) { return t === 'general' ? 'character' : t };
      // seq 守卫防竞态:快速连点时先发后至的旧响应不得覆盖新状态
      var entrySeq = 0, entrySkillSeq = 0;
      var loadEntries = function (folder, kind) {
        var seq = ++entrySeq;
        // mode 类型没有条目下拉(服务端 /entries 只认 character/card),不发必败请求、不清包信息提示
        if (!folder || (kind !== 'character' && kind !== 'card')) { patch({ entryList: [], entryId: '', entryLoading: false, entrySkills: [], pickedSkills: [] }); return }
        patch({ entryLoading: true });
        fetch('/xinyue-kit-api/entries?folder=' + encodeURIComponent(folder) + '&kind=' + kind).then(function (r) { return r.json() }).then(function (b) {
          if (seq !== entrySeq) return;
          setForm(function (prev) { return Object.assign({}, prev, {
            entryLoading: false,
            entryList: b.ok ? (b.entries || []) : [],
            entryId: '',
            entrySkills: [], pickedSkills: [],
            currentInfo: b.ok ? '' : '❌ ' + (b.error || '条目列表加载失败')
          }) });
        }, function () {
          if (seq !== entrySeq) return;
          setForm(function (prev) { return Object.assign({}, prev, { entryLoading: false, entryList: [], entryId: '', entrySkills: [], pickedSkills: [], currentInfo: '❌ 条目列表加载失败' }) });
        });
      };

      // 选中条目后:拉取该武将/卡牌 skills 数组里的技能(勾选候选)
      var loadEntrySkills = function (folder, entryId) {
        var seq = ++entrySkillSeq;
        patch({ entrySkillsLoading: true });
        fetch('/xinyue-kit-api/entry-skills?folder=' + encodeURIComponent(folder) + '&id=' + encodeURIComponent(entryId)).then(function (r) { return r.json() }).then(function (b) {
          if (seq !== entrySkillSeq) return;
          setForm(function (prev) { return Object.assign({}, prev, { entrySkillsLoading: false, entrySkills: b.ok ? (b.skills || []) : [], pickedSkills: [] }) });
        }, function () {
          if (seq !== entrySkillSeq) return;
          setForm(function (prev) { return Object.assign({}, prev, { entrySkillsLoading: false, entrySkills: [], pickedSkills: [] }) });
        });
      };

      var pickEntry = function (id) {
        setForm(function (prev) { return Object.assign({}, prev, { entryId: id, pickedSkills: [], entrySkills: [], editNotes: '' }) });
        if (id) loadEntrySkills(form.folder, id);
      };

      var togglePicked = function (id, name) {
        var has = form.pickedSkills.some(function (p) { return p.id === id });
        patch({ pickedSkills: has ? form.pickedSkills.filter(function (p) { return p.id !== id }) : form.pickedSkills.concat([{ id: id, name: name, note: '' }]) });
      };

      var setPickedNote = function (id, note) {
        patch({ pickedSkills: form.pickedSkills.map(function (p) { return p.id === id ? Object.assign({}, p, { note: note }) : p }) });
      };

      var switchGoal = function (goal) {
        patch(Object.assign({
          goal: goal, entryId: '', err: '', currentInfo: '', entrySkills: [], pickedSkills: [], editNotes: '',
        }, metaDefaults(goal === 'edit')));
        if (goal === 'edit') loadEntries(form.folder, entriesKind(form.type));
      };

      var switchType = function (t) {
        // 🎲 mode 在编辑模式下目标恒为「编辑已有」(修改已生成的模式包)
        var patchBody = { type: t, entryId: '', entrySkills: [], pickedSkills: [], editNotes: '', addSkills: false };
        if (t === 'mode' && form.mode === 'edit' && form.goal !== 'edit') patchBody.goal = 'edit';
        setForm(function (prev) { return Object.assign({}, prev, patchBody) });
        if (form.mode === 'edit' && form.goal === 'edit') loadEntries(form.folder, entriesKind(t));
      };

      var pickExisting = function (folder) {
        patch({ folder: folder, currentInfo: '', usedIds: [], entryId: '', entryList: [], entrySkills: [], pickedSkills: [], editNotes: '', addSkills: false });
        if (!folder) return;
        if (form.goal === 'edit') loadEntries(folder, entriesKind(form.type));
        fetch('/xinyue-kit-api/extension?folder=' + encodeURIComponent(folder)).then(function (r) { return r.json() }).then(function (body) {
          if (body.error) { setForm(function (prev) { return Object.assign({}, prev, { currentInfo: '读取失败: ' + body.error }) }); return }
          var lines = body.code ? body.code.split('\n').length : 0;
          // 新月杀只有一种写法(Lua 包:init.lua + skills/<技能ID>.lua),不做「两式」探测;
          // 这里只给一句包形态提示,不再回写任何 style 字段(该字段已随改造删除)
          var isLua = !!(body.code && (body.code.indexOf('Package:new') >= 0 || body.code.indexOf('fk.CreateSkill') >= 0 || body.code.indexOf('General(') >= 0));
          setForm(function (prev) { return Object.assign({}, prev, {
            currentInfo: '✅ ' + folder + ':约 ' + lines + ' 行,' + (isLua ? '新月杀 Lua 包(init.lua + skills/)' : '未识别到 Lua 包结构'),
          }) });
        }, function () { setForm(function (prev) { return Object.assign({}, prev, { currentInfo: '读取失败' }) }) });
        // 已用任务ID + 历史注意点:登记处(进行中/已完成)+ 该包归档历史,合并去重
        fetch('/xinyue-kit-api/tasks').then(function (r) { return r.json() }).then(function (reg) {
          var used = (reg.tasks || []).filter(function (t) { return t.folder === folder })
            .map(function (t) { return { id: t.id, state: t.status === 'done' ? '已完成' : '进行中' } });
          return fetch('/xinyue-kit-api/history?folder=' + encodeURIComponent(folder)).then(function (r) { return r.json() }).then(function (hb) {
            ((hb.history && hb.history.tasks) || []).forEach(function (t) {
              if (t.taskId && !used.some(function (u) { return u.id === t.taskId })) used.push({ id: t.taskId, state: '已归档' });
            });
            return { used: used, notes: (hb.history && hb.history.notes) || [] };
          });
        }).then(function (r2) {
          setForm(function (prev) { return Object.assign({}, prev, { usedIds: r2.used, notes: r2.notes }) });
        }, function () { /* 拉不到就不显示,不挡流程 */ });
      };

      // 锚点化迁移:只由用户手动触发,给无锚老文件建立区块索引(只加注释行,不改代码)
      var migrateFolder = function () {
        if (!form.folder || !form.currentInfo || form.currentInfo.indexOf('读取失败') >= 0) { patch({ err: '请先选择扩展包并确认可读取' }); return }
        patch({ busy: true, currentInfo: '正在建立区块索引…' });
        fetch('/xinyue-kit-api/blocks/migrate', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ folder: form.folder }),
        }).then(function (r) { return r.json() }).then(function (b) {
          patch({ busy: false, currentInfo: b.ok
            ? '✅ 区块索引已建立:' + b.totalFiles + ' 个文件 / ' + b.totalBlocks + ' 个区块,插入 ' + b.totalInserted + ' 行锚点注释' + (b.totalCommas ? '(另补 ' + b.totalCommas + ' 个收尾逗号)' : '') + ';各文件原版已备份到同目录 backup/' + (b.filesSkipped ? '(跳过 ' + b.filesSkipped + ' 个无条目文件)' : '')
            : '❌ ' + (b.error || '建立失败') });
        }, function (e) { patch({ busy: false, currentInfo: '❌ 建立失败: ' + (e && e.message || e) }) });
      };

      // 技能列表行:{ name, desc, audios }(audios = 配音源路径,逗号分隔的原始输入)
      var addSkill = function () { patch({ skills: form.skills.concat([{ name: '', desc: '', explain: '' }]) }) };
      var removeSkill = function (idx) {
        var skills = form.skills.filter(function (row, i) { return i !== idx });
        patch({ skills: skills });
      };
      var moveSkill = function (idx, dir) {
        var skills = form.skills.slice();
        var j = idx + dir;
        if (j < 0 || j >= skills.length) return;
        var tmp = skills[idx]; skills[idx] = skills[j]; skills[j] = tmp;
        patch({ skills: skills });
      };
      var setSkill = function (idx, key) { return function (v) {
        var skills = form.skills.slice();
        skills[idx] = Object.assign({}, skills[idx]); skills[idx][key] = v;
        patch({ skills: skills });
      }; };

      /* 快捷预设整块已删除(用户:「没用」)——势力/体力/性别仍可直接手写进上面的
       * 武将基本信息框,不再提供一键写死的那排按钮。 */

      var isNewKingdom = function (k) {
        if (!form.kingdomList || !form.kingdomList.length) return false;
        return !form.kingdomList.some(function (x) { return x.code === k && x.count > 0 });
      };
      var composeGeneralInfo = function () {
        var isNewGeneral = form.type === 'general' && !(form.mode === 'edit' && form.goal === 'edit');
        if (!isNewGeneral) return '';
        var parts = [];
        var k = String(form.gKingdom || '').trim();
        if (k) parts.push('势力 ' + k + (isNewKingdom(k) ? '(新势力:先核实自定义势力的注册方式与 image/kingdom 五件套,确认后再建立)' : ''));
        var hp = String(form.gHp || '').trim();
        if (hp) parts.push('体力 ' + hp);
        if (form.gGender) parts.push('性别 ' + (form.gGender === 'Female' ? 'General.Female' : 'General.Male'));
        var extra = String(form.generalInfo || '').trim();
        if (extra) parts.push(extra);
        return parts.join('，');
      };
      var PASTE_DEMO = '武将名: 许攸\n势力: qun\n体力: 3/3\n称号: 恃才放旷\n设计: 官方\n配音: 官方\n画师: 官方\n技能:\n- 恃才 | 出牌阶段限一次，你可以摸一张牌，然后若本回合未以此法弃置过牌，你弃置一张牌。\n- 寸目 | 锁定技，你摸牌时，改为从牌堆底摸牌。';

      var parsePaste = function () {
        var text = String(form.pasteText || '');
        if (!text.trim()) { patch({ pasteMsg: '还没有内容可解析' }); return; }
        var next = {};
        var skills = [];
        var unknown = [];
        var hits = 0;
        var inSkill = false;
        text.split(/\r?\n/).forEach(function (line) {
          var t = line.trim();
          if (!t) return;
          if (/^(技能|技能表)\s*[:：]?\s*$/.test(t)) { inSkill = true; return; }
          var ms = t.match(/^[-*•]\s*([^|｜:：]+)\s*[|｜]\s*(.+)$/);
          if (ms) {
            skills.push({ name: ms[1].trim(), desc: ms[2].trim() });
            hits = hits + 1;
            return;
          }
          var m = t.match(/^([^:：]{1,12})[:：]\s*(.+)$/);
          if (m) {
            var k = m[1].trim();
            var v = m[2].trim();
            if (/^(武将名|名称|名字|武将|卡牌名|模式名)$/.test(k)) { next.title = v; hits = hits + 1; }
            else if (/^(势力|阵营)$/.test(k)) { next.gKingdom = v; hits = hits + 1; }
            else if (/^(体力|血量|hp)$/i.test(k)) { next.gHp = v; hits = hits + 1; }
            else if (/^(性别)$/.test(k)) { next.gGender = /女|female/i.test(v) ? 'Female' : 'Male'; hits = hits + 1; }
            else if (/^(称号)$/.test(k)) { next.metaTitle = v; hits = hits + 1; }
            else if (/^(设计|设计师|designer)$/i.test(k)) { next.metaDesigner = v; hits = hits + 1; }
            else if (/^(配音|cv)$/i.test(k)) { next.metaCv = v; hits = hits + 1; }
            else if (/^(画师|插画|illustrator)$/i.test(k)) { next.metaIllustrator = v; hits = hits + 1; }
            else if (/^(包名|扩展包|目录|包目录名)$/.test(k)) { next.folder = v; hits = hits + 1; }
            else if (/^(前缀|id前缀|内部前缀|内部ID前缀)$/i.test(k)) { next.idPrefix = v; hits = hits + 1; }
            else if (/^(类型)$/.test(k)) {
              if (/武将/.test(v)) next.type = 'general';
              else if (/卡牌/.test(v)) next.type = 'card';
              else if (/玩法|模式/.test(v)) next.type = 'mode';
              hits = hits + 1;
            } else { unknown.push(t); }
            return;
          }
          unknown.push(t);
        });
        if (skills.length && next.type !== 'card' && next.type !== 'mode') next.type = next.type || 'general';
        if (skills.length) next.skills = skills.slice(0, 12);
        if (unknown.length) {
          next.generalInfo = ((form.generalInfo ? form.generalInfo + '\n' : '') + unknown.join('\n')).trim();
        }
        patch(next);
        patch({ pasteMsg: hits || skills.length
          ? '已解析 ' + hits + ' 个字段 · ' + skills.length + ' 条技能' + (unknown.length ? ' · ' + unknown.length + ' 行未识别，已放进补充说明' : '')
          : '没认出一个字段——按「键: 值」一行一条写，技能行写「- 技能名 | 效果」' });
      };

      var fillPasteDemo = function () { patch({ pasteText: PASTE_DEMO, pasteMsg: '' }) };
      var submit = function () {
        var isEdit = form.mode === 'edit';
        var editingExisting = isEdit && form.goal === 'edit';
        var isMode = form.type === 'mode';
        var isModeCreate = isMode && !editingExisting;
        var filledSkills = form.skills.filter(function (s) { return s.name.trim() || s.desc.trim() || (s.explain || '').trim() });
        var errSet = function (msg) { setForm(function (prev) { return Object.assign({}, prev, { err: msg }) }) };
        if (isModeCreate) {
          if (!form.folder.trim()) { errSet('目标扩展文件夹不能为空'); return }
          if (!form.brief.trim()) { errSet('请填写一句话核心玩法'); return }
          if (!form.rules.trim()) { errSet('请填写玩法细节描述(至少一条规则)'); return }
        } else if (editingExisting) {
          if (!form.folder.trim()) { errSet('目标扩展文件夹不能为空'); return }
          var entryLabel = form.type === 'mode' ? '规则/条目' : (form.type === 'card' ? '卡牌' : '武将');
          if (form.type !== 'mode' && !form.entryId) { errSet('请先选择要修改的' + entryLabel); return }
          var emptyNote = form.pickedSkills.filter(function (p) { return !p.note.trim() }).map(function (p) { return p.name || p.id });
          if (emptyNote.length) { errSet('勾选的技能要填写修改内容: ' + emptyNote.join('、')); return }
          var addSkillFilled = form.addSkills && form.type === 'general' && form.skills.some(function (s) { return s.name.trim() || s.desc.trim() || (s.explain || '').trim() });
          var modeRulesFilled = isMode && form.rules.trim();
          if (!form.editNotes.trim() && !form.pickedSkills.length && !addSkillFilled && !modeRulesFilled) { errSet('请勾选要修改的技能、填写改动描述,或选「新增技能」——至少填一项'); return }
        } else {
          if (!filledSkills.length) { errSet('请至少填写一个技能(技能名和效果至少填一处)'); return }
          if (!form.folder.trim()) { errSet('目标扩展文件夹不能为空'); return }
          /* 牌堆/花色点数校验已随「两式写法 + 牌堆花色表」一并删除:FreeKill 的卡牌与
           * 牌堆定义格式【待补充】未核实,表单只收自由文本 cardInfo(可留空,不卡提交)。 */
        }
        var dupUsed = isEdit && form.taskId.trim() && (form.usedIds || []).some(function (u) { return u.id === form.taskId.trim() });
        if (dupUsed) { errSet('任务ID「' + form.taskId.trim() + '」此包已用过,请换一个'); return }
        setForm(function (prev) { return Object.assign({}, prev, { busy: true, err: '' }) });

        var type = form.type;
        // 配音源路径:逗号/分号/换行分隔,一条到多条随意(服务端截到 10 条)
        var splitAudioPaths = function (v) {
          return String(v || '').split(/[,，;；\n]/).map(function (t) { return t.trim() }).filter(Boolean).slice(0, 10);
        };
        var skills = isMode && !editingExisting
          ? []
          : editingExisting
          ? [].concat(
              form.editNotes.trim() ? [{ name: form.type === 'mode' ? '模式包调整' : '修改 ' + form.entryId, desc: form.editNotes.trim() }] : [],
              form.pickedSkills.map(function (p) { return { name: p.name || p.id, desc: p.note.trim() } }),
              form.addSkills && type === 'general'
                ? form.skills.filter(function (s) { return s.name.trim() || s.desc.trim() || (s.explain || '').trim() }).map(function (s) { return { name: s.name.trim(), desc: s.desc.trim(), explain: (s.explain || '').trim(), audios: splitAudioPaths(s.audios) } })
                : [],
              isMode && form.rules.trim() ? [{ name: '模式规则调整', desc: form.rules.trim() }] : []
            )
          : (type === 'general'
          ? form.skills.filter(function (s) { return s.name.trim() || s.desc.trim() || (s.explain || '').trim() }).map(function (s) { return { name: s.name.trim(), desc: s.desc.trim(), explain: (s.explain || '').trim(), audios: splitAudioPaths(s.audios) } })
          : [{ name: form.title.trim() || '新卡牌', desc: (form.skills[0] && form.skills[0].desc ? form.skills[0].desc.trim() : '') }]);
        var generalInfoText = composeGeneralInfo();
        var deathAudioList = (type === 'general' && !editingExisting) ? splitAudioPaths(form.deathAudios) : [];

        // 游戏目录随任务消息下发给 AI(persona complete:true 会压掉插件 systemPrompt,
        // systemPrompt 里的环境小节到不了模型——任务消息是唯一保证可见的通道)
        var settingsP = fetch('/xinyue-kit-api/settings').then(function (r) { return r.json() }, function () { return {} });
        var ensureId = form.taskId.trim()
          ? Promise.resolve(form.taskId.trim())
          : genTaskId(form.folder.trim(), (form.usedIds || []).map(function (u) { return u.id }));
        Promise.all([ensureId, settingsP]).then(function (arr) {
          var taskId = arr[0];
          var settings = arr[1] || {};
          var gameDir = settings.xinyueDir || '';
          var gameDirPosix = gameDir.replace(/^([A-Za-z]):[\\/]/, function (m, d) { return '/' + d.toLowerCase() + '/' }).replace(/\\/g, '/');
          // 卡牌基本信息:自由文本。【待补充】FreeKill 的卡牌/牌堆定义未核实——
          // 不自行编造「花色 点数」写法,只把用户填的自由文本原样透传。
          var cardInfo = type === 'card' ? form.cardInfo.trim() : '';
          // 武将元信息(称号/设计/配音/画师):只对武将有意义;编辑已有条目时留空 = 不改
          var generalMeta = type === 'general'
            ? { title: form.metaTitle.trim(), designer: form.metaDesigner.trim(), cv: form.metaCv.trim(), illustrator: form.metaIllustrator.trim() }
            : { title: '', designer: '', cv: '', illustrator: '' };
          return fetch('/xinyue-kit-api/tasks', {
            method: 'POST', headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ id: taskId, folder: form.folder.trim(), type: type, title: form.title.trim(), generalInfo: (generalInfoText || form.generalInfo.trim()), generalMeta: generalMeta, cardInfo: cardInfo, skills: skills, image: form.image.trim(), deathAudios: deathAudioList, target: editingExisting ? { kind: type, id: form.entryId } : null, writeMode: form.writeMode, modeBrief: isMode ? form.brief.trim() : '', modeNum: isMode ? (form.numConfig === 'custom' ? (form.numCustom || 'custom') : form.numConfig) : '', modeWin: isMode ? form.winConfig.trim() : '', modeRules: isMode ? form.rules.trim() : '' }),
          }).then(function (r) { return r.json() }).then(function (reg) {
            if (!reg.ok) throw new Error(reg.error || '任务注册失败');
            // gameDir/gameDirPosix 必须随 ctx 传给下一个 then(各自独立作用域,
            // 跨回调直接引用会 ReferenceError: gameDir is not defined)
            return { taskId: taskId, cardInfo: cardInfo, gameDir: gameDir, gameDirPosix: gameDirPosix, generalMeta: generalMeta };
          });
        }).then(function (ctx2) {
          var taskId = ctx2.taskId;
          var cardInfo = ctx2.cardInfo || '';
          var gameDir = ctx2.gameDir || '';
          var gameDirPosix = ctx2.gameDirPosix || '';
          /* 武将元信息(称号/设计/配音/画师):写进翻译表的四个键,键名必须带武将ID
           * ——这是引擎武将详情页与搜索读的键:#<ID> / designer: / cv: / illustrator:。 */
          var metaFor = ctx2.generalMeta || {};
          var metaLines = [];
          if (type === 'general') {
            [['title', '称号', '#<武将ID>'],
             ['designer', '设计 designer', 'designer:<武将ID>'],
             ['cv', '配音 cv', 'cv:<武将ID>'],
             ['illustrator', '画师 illustrator', 'illustrator:<武将ID>']].forEach(function (k) {
              var v = String(metaFor[k[0]] || '').trim();
              if (v) metaLines.push(k[1] + ': ' + v + '  →  Fk:loadTranslationTable["' + k[2] + '"]');
            });
          }
          var metaBlock = metaLines.length
            ? '── 武将元信息(称号/设计/配音/画师:写进 Fk:loadTranslationTable,键名必须带武将ID)──\n' + metaLines.join('\n') +
              '\n说明:称号键是 ["#<武将ID>"],另三个是 ["designer:<武将ID>"] / ["cv:<武将ID>"] / ["illustrator:<武将ID>"](读现有包的翻译表可核实写法);' +
              '值就按字面写入(写「官方」= 沿用官方默认展示文案,不要替换成别的字)。编辑已有条目时留空的项不要新增键、也不要改动原值。'
            : '';
          // 技能清单:每行「名:效果」,用户填了补充说明就再起一行(明确它只用于理解,不得据此增删规则)
          var skillLines = skills.map(function (s, i) {
            return (i + 1) + '. ' + s.name + (s.desc ? ':' + s.desc : '') +
              (s.explain ? '\n   补充说明(用户原话,仅用于理解用户意图与取舍:不得据此增删规则;与效果冲突时以效果为准): ' + s.explain : '');
          }).join('\n');
          // 配音区块:只列登记了配音的技能;目标文件名由 AI 按内部 ID 命名(此处不知道 ID)
          var audioLines = skills.filter(function (s) { return s.audios && s.audios.length })
            .map(function (s) { return '- ' + s.name + '(' + s.audios.length + ' 句): ' + s.audios.join('、') }).join('\n');
          var audioBlock = audioLines
            ? '── 配音(技能发动语音,只放扩展包内 audio/,禁止动引擎的 audio/) ──\n' + audioLines +
              '\n目标目录: audio/skill/。文件命名与代码挂载方式(现有包用 audio_index + player:broadcastSkillInvoke(name, index) 一类写法)先读同包与官方包的 skills/*.lua 与 audio/skill/ 里的实际文件名核实,不要照搬其他项目(如无名杀的 audio: "ext:…")写法。' +
              '实现完成后用 xinyue_copy_audio 把每句复制进扩展包 audio/skill/(工具 target 以 skill/ 开头),调用时带上任务ID与归属技能名(任务里的技能显示名)。'
            : '';
          var deathAudioBlock = deathAudioList.length
            ? '── 阵亡语音 ──\n文件: ' + deathAudioList.join('、') +
              '\n目标目录: audio/death/(命名与触发链路先读现有包的 audio/death/ 与引擎实现核实,本工坊未逐条实测)。' +
              '实现完成后用 xinyue_copy_audio 复制为 audio/death/<武将ID>.mp3(多句:<ID>1.mp3、<ID>2.mp3…;工具 target 以 death/ 开头,带任务ID)。' +
              '若 xinyue_copy_audio 报目录非法(仍只认旧目录名 die/),把报错原样反馈给用户,不要静默换目录。'
            : '';
          /* 牌堆区块:FreeKill 的卡牌/牌堆定义【待补充】未核实——旧无名杀语义的
           * 「加入牌堆 + 花色点数(none/spade/heart/club/diamond)」已整段删除,
           * 只透传用户填的自由文本 cardInfo,并明确要求实现前先核实。 */
          var cardText = type === 'card'
            ? '── 卡牌信息(【待补充】FreeKill 的卡牌/牌堆定义未核实) ──\n' +
              '本工坊未核实 FreeKill 的卡牌与牌堆定义写法,禁止自行编造「花色 点数 / 牌堆条目」格式:' +
              '实现前先读引擎 lua/core 与官方包里的卡牌定义核实,或先向用户确认。' +
              (cardInfo ? '\n用户填写的卡牌基本信息: ' + cardInfo : '\n用户未填写卡牌基本信息。')
            : '';
          var text;
          if (isMode && !editingExisting) {
            text = [
              '【新月杀工坊·新任务】',
              '任务ID: ' + taskId,
              '任务性质: 创建全新扩展包(含一个自定义游戏模式;目标文件夹当前不存在,需要从零创建新月杀 Lua 包:packages/<包>/init.lua + skills/<技能ID>.lua + 翻译表)',
              '类型: 🎲 新玩法(自定义游戏模式,新月杀用 fk.CreateGameMode{} 定义 + extension:addGameMode(...) 注册为独立模式;实现前先读引擎 lua/core 与现有模式包核实)',
              (form.title.trim() ? '模式名称(显示名,注册为模式翻译): ' + form.title.trim() : ''),
              '写入方式: ' + (form.writeMode === 'manual' ? '手动复制(只生成代码,不要写文件)' : '自动写入'),
              '目标扩展文件夹: ' + form.folder.trim(),
              (gameDir ? '游戏目录(所有读写的根;bash 里写作 ' + gameDirPosix + '): ' + gameDir : ''),
              '一句话核心玩法: ' + form.brief.trim(),
              '游戏人数: ' + (form.numConfig === 'custom' ? (form.numCustom || '?') + ' 人(用户自定义)' : form.numConfig + ' 人(玩家 1 名,其余 AI 补位)'),
              '胜利条件: ' + (form.winConfig.trim() || '用户未单独填写,以玩法细节描述为准,有歧义先问'),
              '── 玩法细节(用户原话,逐条理解,不得增删主规则) ──',
              form.rules.trim(),
              form.reference.trim() ? '── 用户提供的参考代码 ──\n' + form.reference.trim() : '',
              '── 执行要求(确认协议,逐步执行)──',
              '第 0 步【引擎版本探测 + 需求理解确认·硬门禁】:先探测用户游戏引擎版本(读游戏根下的 fk_ver 文件,或看 lua/core/package.lua 是否存在)并报告给用户;版本相关与全局的写法(模式注册 GameMode/开局与选将流程/距离与摸牌修正/技能与翻译表挂载等)必须先读引擎 lua/core 源码或现有官方包核实,禁止凭记忆或固定版本经验猜测。然后把玩法细节逐条拆成规则模块,输出【需求理解确认】(每条规则:触发时机/数值/边界;另含:玩法一句话复述/人数与先手规则/胜利条件/明确不做什么/实现骨架自查——模式注册方式/开局与选将流程/技能挂载方式均按核实结果选定)。输出后停下等待用户明确回复确认。',
              '有任何歧义必须先用 ask_user_question 提问;禁止猜测。ask_user_question 的回答只消除歧义、不算确认——澄清后把最终确认单呈现给用户,仍须等待用户明确回复「确认」后才能动笔。',
              '未获用户确认前,禁止生成代码、禁止调用 xinyue_write_package。',
              '用户确认后按骨架清单实现(新月杀 Lua 包:init.lua 用 Package:new 建包、skills/<技能ID>.lua 用 fk.CreateSkill 建技能、显示名写入 Fk:loadTranslationTable),校验通过后一次写入,调用 xinyue_skills_written 原样带回任务ID ' + taskId + ' 与规则节点名(每个规则模块一个节点名,用户逐条确认后自动收口)。',
              form.idPrefix.trim() ? '内部 ID 命名规则:模式名/新增技能的内部 ID 必须 = 「' + form.idPrefix.trim() + '」前缀 + 拼音或英文,中文显示名写入 Fk:loadTranslationTable;内部规则技的命名与是否登记翻译名按现有模式包惯例处理(先读一个官方模式包对照)。' : '',
            ].filter(Boolean).join('\n');
          } else if (editingExisting) {
            var newSkillRows = form.addSkills && type === 'general'
              ? form.skills.filter(function (s) { return s.name.trim() || s.desc.trim() || (s.explain || '').trim() }).map(function (s) { return { name: s.name.trim(), desc: s.desc.trim(), explain: (s.explain || '').trim() } })
              : [];
            var pickedSkillRows = form.pickedSkills;
            var entryFile = (form.entryList.filter(function (en) { return en.id === form.entryId })[0] || {}).file || 'init.lua';
            text = [
              '【新月杀工坊·编辑任务】',
              '任务ID: ' + taskId,
              '任务性质: 编辑已有扩展包(已存在)',
              (type === 'mode' ? '包性质: 这是一个自定义模式扩展包(新月杀 Lua:Package:new + fk.CreateGameMode{} + extension:addGameMode)。相关写法先读引擎 lua/core 源码与现有模式包核实(版本见游戏根 fk_ver);新增内部 ID 沿用该包现有前缀惯例(读现有代码时留意)。' : ''),
              '类型: ' + (type === 'mode' ? '🎲 新玩法(自定义游戏模式)' : type === 'card' ? '卡牌' : '武将'),
              (type === 'mode' ? '编辑目标: 整个模式扩展包(骨架与规则技,按需求描述与引擎核实结果改动,其他任务无关的包不动)' : '编辑目标条目: ' + entriesKind(type) + ':' + form.entryId + '(所在文件 ' + entryFile + (entryFile !== 'init.lua' ? ',read/write 都要传 file 参数' : '') + ';只改这个条目' + (pickedSkillRows.length ? '及其勾选技能' : '') + (newSkillRows.length ? ';新增技能作为新区块加到该条目上' : '') + ',其他武将/卡牌/技能/翻译一律不动)'),
              (form.title.trim() ? '新名称(显示名,写入 Fk:loadTranslationTable;留空即不改名): ' + form.title.trim() : ''),
              '写入方式: ' + (form.writeMode === 'manual' ? '手动复制(只生成代码,不要写文件)' : '自动写入'),
              '目标扩展文件夹: ' + form.folder.trim() + '(已有扩展,写法按现有 Lua 包结构跟随现有代码)',
              (gameDir ? '游戏目录(所有读写的根;bash 里写作 ' + gameDirPosix + '): ' + gameDir : ''),
              (metaBlock || ''),
              (form.notes && form.notes.length ? '该包有历史注意点 ' + form.notes.length + ' 条(过往任务实测结论):与本任务相关时才用 xinyue_read_package 传 notes:true 拉取,无关条目忽略,与需求冲突时以需求为准。' : ''),
              (form.editNotes.trim() ? '── ' + (type === 'mode' ? '模式骨架与规则改动' : (type === 'card' ? '卡牌' : '武将') + '改动(条目本身:体力/护甲/名称等)') + ' ──\n' + form.editNotes.trim() : ''),
              (type === 'mode' && form.rules.trim() ? '── 新增或调整的规则(用户逐条写的改动要求,确认单按改动前后逐项列) ──\n' + form.rules.trim() : ''),
              (pickedSkillRows.length ? '── 修改技能(用户逐技能写明的改动要求) ──\n' + pickedSkillRows.map(function (p, i) { return (i + 1) + '. ' + p.name + '(内部ID ' + p.id + '):' + p.note.trim() }).join('\n') : ''),
              (newSkillRows.length ? '── 新增技能(加到目标' + (type === 'card' ? '卡牌' : '武将') + '上,按顺序实现) ──\n' + newSkillRows.map(function (s, i) { return (i + 1) + '. ' + s.name + (s.desc ? ':' + s.desc : '') + (s.explain ? '\n   补充说明(用户原话,仅用于理解:不得据此增删规则;与效果冲突以效果为准): ' + s.explain : '') }).join('\n') : ''),
              '── 任务技能节点(收口时 xinyue_skills_written 的 skills 参数必须逐字使用这些名称) ──\n' + skills.map(function (s) { return '- ' + s.name }).join('\n'),
              form.reference.trim() ? '── 用户提供的参考代码 ──\n' + form.reference.trim() : '',
              form.image.trim() ? '── 图片 ──\n用户已提供图片路径: ' + form.image.trim() + '\n实现完成后用 xinyue_copy_images 复制进扩展包 image/generals/ 目录(卡图是 image/card/),按目标条目ID(' + form.entryId + ')命名文件,调用时带上任务ID。' : '',
              (audioBlock || ''),
              '── 执行要求(确认协议,逐步执行)──',
              type === 'mode' ? '第 0 步【需求理解确认·硬门禁】:先探测引擎版本(游戏根 fk_ver)并报告;xinyue_read_package 读整个扩展包现状(必要时 listBlocks 看区块目录),把现状与用户需求逐条对照,输出【需求理解确认】(逐条规则:改动前→改动后/触发时机/数值/边界/影响面;另含:明确不做什么)。输出后停下等待用户明确回复确认。' : '第 0 步【需求理解确认·硬门禁】:先 xinyue_read_package 按块只读目标条目原文(' + (entryFile !== 'init.lua' ? 'file:\'' + entryFile + '\', ' : '') + 'block:\'' + entriesKind(type) + ':' + form.entryId + '\')' + (pickedSkillRows.length ? '与各勾选技能原文(block:\'skill:<技能ID>\'' + (entryFile !== 'init.lua' ? ';技能可能在其他文件,用 listBlocks 定位后带对应 file' : '') + ')' : '') + '(定位不准时先传 listBlocks 看区块目录,多文件包的目录每项带 file 归属),把原文与需求对照,逐项输出【需求理解确认】(' + (form.editNotes.trim() ? '条目项:改什么 / 改动前→改动后 / 影响面' : '') + (form.editNotes.trim() && pickedSkillRows.length ? ';' : '') + (pickedSkillRows.length ? '修改技能项:改动前→改动后' : '') + ((pickedSkillRows.length || form.editNotes.trim()) && newSkillRows.length ? ';' : '') + (newSkillRows.length ? '新增技能按新技能模板逐条:触发/频率/目标/数值/边界' : '') + ')。输出后停下等待用户明确回复确认。',
              '有任何歧义必须先用 ask_user_question 提问;禁止猜测。ask_user_question 的回答只消除歧义、不算确认——澄清后把最终确认单呈现给用户,仍须等待用户明确回复「确认」后才能动笔。',
              '未获用户确认前,禁止生成代码、禁止调用 xinyue_write_package。',
              (type === 'mode' ? '用户确认后动手:已有内容的改动只落在与本次需求相关的模式骨架/规则技区块' : '用户确认后动手:已有内容的改动只落在目标条目' + (pickedSkillRows.length ? '与其勾选技能' : '') + '对应区块') + '(xinyue_write_package' + (entryFile !== 'init.lua' ? ' 带 file:\'' + entryFile + '\'' : '') + ',用 blocks 组装或 edits 精确补丁,严禁全文重写)' + (newSkillRows.length ? ';新增技能作为新区块插入(锚点包裹,内部 ID 用下方前缀规则)' : '') + ',除上述区块与新增区块外严禁改动任何其他区块。xinyue_validate 通过后一次写入,调用 xinyue_skills_written 原样带回任务ID ' + taskId + '。',
              (newSkillRows.length && form.idPrefix.trim() ? '内部 ID 命名规则:新增技能的内部 ID 必须 = 「' + form.idPrefix.trim() + '」前缀 + 拼音或英文,中文显示名写入 Fk:loadTranslationTable。' : ''),
            ].filter(Boolean).join('\n');
          } else if (isEdit) {
            text = [
              '【新月杀工坊·编辑任务】',
              '任务ID: ' + taskId,
              '任务性质: 编辑已有扩展包(已存在)',
              '类型: ' + (type === 'mode' ? '🎲 新玩法(自定义游戏模式)' : type === 'card' ? '卡牌' : '武将(含 ' + skills.length + ' 个技能)'),
              (form.title.trim() ? '名称(显示名,写入 Fk:loadTranslationTable): ' + form.title.trim() : ''),
              '写入方式: ' + (form.writeMode === 'manual' ? '手动复制(只生成代码,不要写文件)' : '自动写入'),
              '目标扩展文件夹: ' + form.folder.trim() + '(已有扩展,写法按现有 Lua 包结构跟随现有代码)',
              (gameDir ? '游戏目录(所有读写的根;bash 里写作 ' + gameDirPosix + '): ' + gameDir : ''),
              (generalInfoText ? '── 武将基本信息(势力/体力/性别等)──\n' + generalInfoText : ''),
              (metaBlock || ''),
              (form.notes && form.notes.length ? '该包有历史注意点 ' + form.notes.length + ' 条(过往任务实测结论):与本任务相关时才用 xinyue_read_package 传 notes:true 拉取,无关条目忽略,与需求冲突时以需求为准。' : ''),
              '── 技能/卡牌清单(按顺序实现) ──',
              skillLines,
              cardText,
              form.reference.trim() ? '── 用户提供的参考代码 ──\n' + form.reference.trim() : '',
              form.image.trim() ? '── 图片 ──\n用户已提供图片路径: ' + form.image.trim() + '\n实现完成后用 xinyue_copy_images 复制进扩展包 image/generals/(卡图 image/card/),按 武将ID/卡牌ID 命名文件,调用时带上任务ID。' : '',
              (audioBlock || ''),
              (deathAudioBlock || ''),
              '── 执行要求(确认协议,逐步执行)──',
              '第 0 步【需求理解确认·硬门禁】:先 xinyue_read_package 读取当前代码(大文件先传 listBlocks 看区块目录,再按 block:\'skill:ID\' 只读涉及的块),然后逐技能输出【需求理解确认】(每个技能一条:触发/频率/目标/数值/边界)。输出后停下等待用户明确回复确认。',
              '有任何歧义必须先用 ask_user_question 提问;禁止猜测。ask_user_question 的回答只消除歧义、不算确认——澄清后把最终确认单呈现给用户,仍须等待用户明确回复「确认」后才能动笔。',
              '未获用户确认前,禁止生成代码、禁止调用 xinyue_write_package。',
              '用户确认后按顺序逐技能实现(每技能:xinyue_search_reference 搜参考→写→xinyue_validate),校验通过后一次写入,调用 xinyue_skills_written 原样带回任务ID ' + taskId + '。',
              form.idPrefix.trim() ? '内部 ID 命名规则:新增技能/武将/卡牌的内部 ID 必须 = 「' + form.idPrefix.trim() + '」前缀 + 拼音或英文,中文显示名写入 Fk:loadTranslationTable。' : '',
            ].filter(Boolean).join('\n');
          } else {
            text = [
              '【新月杀工坊·新任务】',
              '任务ID: ' + taskId,
              '任务性质: 创建全新扩展包(目标文件夹当前不存在,需要从零创建新月杀 Lua 包:packages/<包>/init.lua + skills/<技能ID>.lua)',
              '类型: ' + (type === 'card' ? '卡牌' : '武将(General,含 ' + skills.length + ' 个技能)'),
              (form.title.trim() ? '名称(显示名,写入 Fk:loadTranslationTable): ' + form.title.trim() : ''),
              '包结构: 新月杀只有一种写法(Lua 包:init.lua 用 Package:new 建包 + loadSkillSkelsByPath 载入 skills/,skills/<技能ID>.lua 用 fk.CreateSkill),没有老式/新式之分',
              '写入方式: ' + (form.writeMode === 'manual' ? '手动复制(只生成代码,不要写文件)' : '自动写入'),
              '目标扩展文件夹: ' + form.folder.trim(),
              (gameDir ? '游戏目录(所有读写的根;bash 里写作 ' + gameDirPosix + '): ' + gameDir : ''),
              generalInfoText ? '── 基本信息 ──\n' + generalInfoText : '',
              (metaBlock || ''),
              '── 技能/卡牌清单(按顺序实现) ──',
              skillLines,
              cardText,
              form.reference.trim() ? '── 用户提供的参考代码 ──\n' + form.reference.trim() : '',
              form.image.trim() ? '── 图片 ──\n用户已提供图片路径: ' + form.image.trim() + '\n实现完成后用 xinyue_copy_images 复制进扩展包 image/generals/(卡图 image/card/),按 武将ID/卡牌ID 命名文件,调用时带上任务ID。' : '',
              (audioBlock || ''),
              (deathAudioBlock || ''),
              '── 执行要求(确认协议,逐步执行)──',
              '第 0 步【需求理解确认·硬门禁】:逐技能输出【需求理解确认】(每个技能一条:触发/频率/目标/数值/边界)。输出后停下等待用户明确回复确认。',
              '有任何歧义必须先用 ask_user_question 提问;禁止猜测。ask_user_question 的回答只消除歧义、不算确认——澄清后把最终确认单呈现给用户,仍须等待用户明确回复「确认」后才能动笔。',
              '未获用户确认前,禁止生成代码、禁止调用 xinyue_write_package。',
              '用户确认后按顺序逐技能实现(每技能:xinyue_search_reference 搜参考→写→xinyue_validate),校验通过后一次写入,调用 xinyue_skills_written 原样带回任务ID ' + taskId + '。',
              form.idPrefix.trim() ? '内部 ID 命名规则:所有新增技能/武将/卡牌的内部 ID 必须 = 「' + form.idPrefix.trim() + '」前缀 + 拼音或英文(如 ' + form.idPrefix.trim() + 'tianfa),中文显示名写入 Fk:loadTranslationTable——防止跨扩展包命名冲突。' : '',
            ].filter(Boolean).join('\n');
          }
          return Promise.resolve(send(text)).then(function () {
            setForm(function (prev) { return Object.assign({}, prev, { busy: false, reference: '', taskId: '' }) });
          });
        }).catch(function (error) {
          setForm(function (prev) { return Object.assign({}, prev, { busy: false, err: error && error.message || String(error) }) });
        });
      };

      var isEdit = form.mode === 'edit';
      var editingExisting = isEdit && form.goal === 'edit';
      var isModeCreate = form.type === 'mode' && !editingExisting;
      try {
      /* ── 表单 v2：分区 + 短标签 + 双列栅格。长解释只保留一句小字提示。 ── */
      var lineField = function (label, value, onChange, opts) {
        opts = opts || {};
        return h('div', { key: label, className: 'nnk-field' },
          e('label', 'nnk-label', label),
          h('input', {
            className: 'nnk-input' + (opts.code ? ' nnk-code' : ''),
            type: 'text', value: value == null ? '' : value,
            placeholder: opts.placeholder || '',
            onChange: function (ev) { onChange(ev.target.value) },
          }),
          opts.hint ? e('div', 'nnk-fhint', opts.hint) : null
        );
      };
      /* 多行字段:默认一行高,写满自动长(到 120px 后内部滚动),右下角可手动拉高。
       * 旧写法给每个框写死 minHeight(48/64px),长表单被撑得很散 —— 已去掉。 */
      var areaField = function (label, value, onChange, opts) {
        opts = opts || {};
        return h('div', { key: label, className: 'nnk-field' },
          e('label', 'nnk-label', label),
          autoArea({ value: value == null ? '' : value, placeholder: opts.placeholder || '' }, onChange),
          opts.hint ? e('div', 'nnk-fhint', opts.hint) : null
        );
      };
      var g2 = function (kids) {
        return h('div', { className: 'nnk-grid2' }, (kids || []).filter(function (x) { return x !== null && x !== undefined && x !== false }));
      };
      var spread = function (tag, props, kids) {
        return h.apply(null, [tag, props].concat((kids || []).filter(function (x) { return x !== null && x !== undefined && x !== false })));
      };
      var sec = function (tag, hint, kids) {
        return h('div', { className: 'nnk-card nnk-sec' },
          h('div', { className: 'nnk-sechead' },
            e('span', 'nnk-sectag', tag),
            hint ? e('span', 'nnk-sechint', hint) : null
          ),
          spread('div', { className: 'nnk-secbody' }, kids)
        );
      };
      var typeRadios = radioGroup('类型', form.type, [
        { value: 'general', text: '⚔ 武将' }, { value: 'card', text: '🃏 卡牌' }, { value: 'mode', text: '🎲 新玩法' },
      ], switchType);

      var folderField = isEdit
        ? h('div', { className: 'nnk-field' },
            e('label', 'nnk-label', '扩展包' + (form.extLoading ? '（加载中…）' : '')),
            h('select', { className: 'nnk-input', value: form.folder, onChange: function (ev) { pickExisting(ev.target.value) } },
              [h('option', { key: '', value: '' }, '— 选择扩展包 —')].concat(form.extList.map(function (f) {
                return h('option', { key: f, value: f }, f)
              }))),
            form.folder && form.currentInfo ? e('div', 'nnk-fhint', form.currentInfo) : null,
            (isEdit && !form.extLoading && form.extList.length === 0) ? e('div', 'nnk-fhint', '没有可选的扩展包（游戏 packages 目录为空或未配置游戏路径）') : null
          )
        : lineField('包目录名', form.folder, set('folder'), { placeholder: '我的扩展' });

      var pasteSection = !isEdit ? sec('粘贴解析', '一行一字段 · 技能行写「- 技能名 | 效果」', [
        h('textarea', {
          className: 'nnk-textarea',
          style: { minHeight: '108px', fontFamily: 'inherit', lineHeight: 1.7 },
          placeholder: '武将名: 许攸\n势力: qun\n体力: 3/3\n称号: 恃才放旷\n技能:\n- 恃才 | 出牌阶段限一次，你可以摸一张牌…',
          value: form.pasteText,
          onChange: function (ev) { set('pasteText')(ev.target.value) },
        }),
        h('div', { style: { display: 'flex', gap: '8px', alignItems: 'center', marginTop: '8px' } },
          h('button', { type: 'button', className: 'nnk-smallbtn', style: { margin: 0 }, onClick: fillPasteDemo }, '示例'),
          h('button', { type: 'button', className: 'nnk-smallbtn', style: { margin: 0 }, onClick: parsePaste }, '解析填充')
        ),
        form.pasteMsg ? e('div', 'nnk-fhint', form.pasteMsg) : null,
      ]) : null;
      var nameField = lineField(form.type === 'mode' ? '模式名' : (form.type === 'card' ? '卡牌名' : '武将名'), form.title, set('title'), {
        placeholder: form.type === 'mode' ? '例：季节乱斗' : (form.type === 'card' ? '例：疾风符' : '例：凌霜'),
        hint: form.type === 'general' ? '写入翻译表' + (editingExisting ? '；留空 = 不改名' : '') : '',
      });
      /* 模式/类型/编号/名称合成一块:原来拆成「新任务」「名称与编号」两段,纯属多占版面 */
      var modeSection = sec('任务', isEdit ? '在已有扩展包里改条目' : '一个任务 = 一个武将 / 一张卡牌 / 一个玩法', [
        g2([
          radioGroup('模式', form.mode, [{ value: 'new', text: '新建' }, { value: 'edit', text: '编辑已有' }], switchMode),
          typeRadios,
        ]),
        isEdit ? radioGroup('目标', form.goal, [{ value: 'create', text: '新建' }, { value: 'edit', text: '改已有' }], switchGoal) : null,
        g2([
          lineField('任务 ID', form.taskId, set('taskId'), { placeholder: '留空自动生成', hint: '反馈时用它定位' }),
          folderField,
        ]),
        g2([
          nameField,
          (editingExisting && !(form.addSkills && form.type === 'general')) ? null
            : lineField('ID 前缀', form.idPrefix, set('idPrefix'), { placeholder: '例：cs_', hint: '可选，防跨包重名' }),
        ]),
        (isEdit && form.taskId.trim() && (form.usedIds || []).some(function (u) { return u.id === form.taskId.trim() }))
          ? e('div', 'nnk-err', '⚠ 任务 ID「' + form.taskId.trim() + '」此包已用过，换一个')
          : null,
        (isEdit && form.folder) ? e('div', 'nnk-fhint', (form.usedIds && form.usedIds.length)
          ? '已用任务 ID：' + form.usedIds.map(function (u) { return u.id + '（' + u.state + '）' }).join('、')
          : '此包暂无任务记录') : null,
        (isEdit && form.folder) ? h('button', { className: 'nnk-smallbtn', disabled: form.busy, onClick: migrateFolder }, '🔨 建立区块索引') : null,
      ]);
      var nameSection = null;

      /* 基本信息与元信息合为一块:都是武将属性,拆两块只会多两次滚动 */
      var metaRows = h('div', { className: 'nnk-grid4' }, [
        lineField('称号', form.metaTitle, set('metaTitle'), { placeholder: editingExisting ? '留空 = 不改' : '官方' }),
        lineField('设计 designer', form.metaDesigner, set('metaDesigner'), { placeholder: editingExisting ? '留空 = 不改' : '官方' }),
        lineField('配音 cv', form.metaCv, set('metaCv'), { placeholder: editingExisting ? '留空 = 不改' : '官方' }),
        lineField('画师 illustrator', form.metaIllustrator, set('metaIllustrator'), { placeholder: editingExisting ? '留空 = 不改' : '官方' }),
      ]);
      var baseRows = [!editingExisting ? h('div', { className: 'nnk-grid3' },
        h('div', {},
          e('label', 'nnk-label', '势力'),
          h('input', { className: 'nnk-input', list: 'nnk-kingdom-options', value: form.gKingdom, placeholder: 'wei / shu / wu / qun…', onChange: function (ev) { set('gKingdom')(ev.target.value) } }),
          h('datalist', { id: 'nnk-kingdom-options' }, (form.kingdomList || []).map(function (k) {
            return h('option', { key: k.code, value: k.code }, k.label + (k.count ? ' · ' + k.count : ''))
          }))
        ),
        lineField('体力', form.gHp, set('gHp'), { placeholder: '4/4', hint: 'hp / maxHp' }),
        radioGroup('性别', form.gGender, [{ value: 'Male', text: '男' }, { value: 'Female', text: '女' }], set('gGender'))
      ) : null, metaRows, !editingExisting ? areaField('补充说明（可选）', form.generalInfo, set('generalInfo'), {
        placeholder: '上面没写的：护甲、特殊标记等',
      }) : null];
      /* 武将块在素材块之后创建：素材并入同一块 */
      var metaSection = null;

      /* 素材改「块」:一块一类,选完直接列出文件名并可单独移除,不再是一行长文本框 */
      var fileBlock = function (label, value, setter, opts) {
        var list = String(value || '').split(/\r?\n/).filter(function (x) { return x.trim() });
        return h('div', { className: 'nnk-fileblock' },
          h('div', { className: 'nnk-fbhead' },
            e('span', 'nnk-fblabel', label),
            h('button', { type: 'button', className: 'nnk-smallbtn', onClick: function () {
              pickFile({ title: opts.title, filter: opts.filter, multiple: opts.multiple, purpose: 'plain', onConfirm: function (p) { setter(appendPaths(value, p.paths)) } });
            } }, '📁 选择')
          ),
          list.length
            ? h('div', {}, list.map(function (p, i) {
                return h('div', { key: i, className: 'nnk-fbrow' },
                  e('span', 'nnk-fbname', p.split(/[\\/]/).pop()),
                  h('button', { className: 'nnk-fbx', title: '移除', onClick: function () { setter(list.filter(function (x, j) { return j !== i }).join('\n')) } }, '✕')
                );
              }))
            : e('div', 'nnk-fbempty', '未选择'),
          e('div', 'nnk-fbhint', opts.hint)
        );
      };
      var mediaRows = h('div', { className: 'nnk-fileblocks' }, [
          fileBlock(form.type === 'card' ? '卡图' : '立绘', form.image, set('image'), {
            title: '选择图片', filter: 'image', multiple: false,
            hint: form.type === 'card' ? 'image/card/<ID>.png' : 'image/generals/<ID>.jpg',
          }),
          (!editingExisting && form.type === 'general')
            ? fileBlock('阵亡语音', form.deathAudios, set('deathAudios'), {
                title: '选择阵亡语音', filter: 'audio', multiple: true, hint: 'audio/death/<武将ID>.mp3',
              })
            : null,
        ]);
      var mediaSection = (form.type === 'card') ? sec('素材', '可选 · 点块选择', [mediaRows]) : null;
      var basicSection = (form.type === 'general')
        ? sec('武将', editingExisting ? '留空 = 不改' : '可下拉或手写', baseRows.concat([mediaRows]))
        : null;

      var buildSkillRows = function () {
        return h('div', { className: 'nnk-secbody' },
          form.skills.map(function (s, idx) {
            return h('div', { key: idx, className: 'nnk-skillcard' },
              h('div', { className: 'nnk-skillhead' },
                e('b', 'nnk-skillname', '技能 ' + (idx + 1)),
                h('input', {
                  className: 'nnk-input nnk-skill-name',
                  value: s.name, placeholder: '技能名（显示名，例：挥砍）',
                  onChange: function (ev) { setSkill(idx, 'name')(ev.target.value) },
                }),
                h('div', { className: 'nnk-skillbtns' },
                  h('button', { className: 'nnk-smallbtn', title: '上移', disabled: idx === 0, onClick: function () { moveSkill(idx, -1) } }, '↑'),
                  h('button', { className: 'nnk-smallbtn', title: '下移', disabled: idx === form.skills.length - 1, onClick: function () { moveSkill(idx, 1) } }, '↓'),
                  h('button', { className: 'nnk-smallbtn', title: '删除', disabled: form.skills.length <= 1, onClick: function () { removeSkill(idx) } }, '✕')
                )
              ),
              h('div', { className: 'nnk-skillgrid' },
                h('div', { className: 'nnk-field' },
                  e('label', 'nnk-label', '效果'),
                  autoArea({ value: s.desc, placeholder: '触发 / 频率 / 目标 / 数值 / 边界' }, setSkill(idx, 'desc'))
                ),
                h('div', { className: 'nnk-field' },
                  e('label', 'nnk-label', '补充说明'),
                  autoArea({ value: s.explain || '', placeholder: '设计意图、想模仿的官方技能、例外' }, setSkill(idx, 'explain'))
                )
              ),
              h('div', { className: 'nnk-inline nnk-skill-vo' },
                e('span', 'nnk-fhint', '配音'),
                autoArea({ value: s.audios || '', placeholder: '本地 mp3（可选，一行一个）' }, setSkill(idx, 'audios')),
                h('button', {
                  type: 'button', className: 'nnk-smallbtn',
                  onClick: function () {
                    pickFile({
                      title: '选择「' + (s.name || '技能 ' + (idx + 1)) + '」的配音', filter: 'audio', multiple: true, purpose: 'plain',
                      onConfirm: function (p) { setSkill(idx, 'audios')(appendPaths(s.audios, p.paths)) },
                    });
                  },
                }, '选择')
              )
            );
          }),
          h('button', { className: 'nnk-smallbtn', onClick: addSkill, style: { alignSelf: 'flex-start' } }, '＋ 添加技能')
        );
      };

      var skillsSection = (!editingExisting && form.type === 'general') ? sec('技能', '按此顺序逐个实现', [buildSkillRows()]) : null;

      var cardSection = (!editingExisting && form.type === 'card') ? sec('卡牌效果', '定义格式先读引擎与官方包核实', [
        areaField('效果', (form.skills[0] && form.skills[0].desc) || '', function (v) {
          var skills = form.skills.slice();
          if (!skills[0]) skills[0] = { name: '', desc: '' };
          skills[0] = Object.assign({}, skills[0]); skills[0].desc = v;
          patch({ skills: skills });
        }, { style: { minHeight: '70px' }, placeholder: '牌的类型 / 目标 / 结算 / 边界' }),
        areaField('卡牌基本信息', form.cardInfo, set('cardInfo'), {
          style: { minHeight: '52px' }, placeholder: '基本牌 / 锦囊 / 装备；可留空',
          hint: 'FreeKill 的卡牌与牌堆定义格式未逐条核实，AI 会先读引擎与官方包',
        }),
      ]) : null;

      var modeCreateSection = isModeCreate ? sec('玩法设定', '逐条写规则，AI 先出确认单', [
        areaField('核心玩法（一句话）', form.brief, set('brief'), { style: { minHeight: '46px' }, placeholder: '例：无身份混战大逃杀，每个玩家独立求生' }),
        radioGroup('人数', form.numConfig, [
          { value: '2', text: '2' }, { value: '3', text: '3' }, { value: '4', text: '4' }, { value: '5', text: '5' },
          { value: '6', text: '6' }, { value: '7', text: '7' }, { value: '8', text: '8' }, { value: 'custom', text: '自定义' },
        ], set('numConfig')),
        form.numConfig === 'custom' ? lineField('自定义人数', form.numCustom, set('numCustom'), { placeholder: '2 ~ 20' }) : null,
        lineField('胜利条件', form.winConfig, set('winConfig'), { placeholder: '不填则以玩法细节为准' }),
        areaField('玩法细节', form.rules, set('rules'), { style: { minHeight: '120px' }, placeholder: '特殊机制 / 阶段效果 / 阵营 / 限制…越具体确认单越准' }),
      ]) : null;

      var editSection = editingExisting ? sec('改动内容', '只动这里写到的条目', [
        (form.type !== 'mode') ? h('div', { className: 'nnk-field' },
          e('label', 'nnk-label', '编辑目标' + (form.entryLoading ? '（加载中…）' : '')),
          h('select', { className: 'nnk-input', value: form.entryId, onChange: function (ev) { pickEntry(ev.target.value) } },
            [h('option', { key: '', value: '' }, '— 选择要修改的' + (form.type === 'card' ? '卡牌' : '武将') + ' —')].concat(form.entryList.map(function (en) {
              var tag = en.file && en.file !== 'init.lua' ? ' · ' + en.file.replace(/\.lua$/, '') : '';
              return h('option', { key: en.id, value: en.id }, en.id + (en.name ? '（' + en.name + '）' : '') + tag)
            }))),
          (!form.entryLoading && form.entryList.length === 0)
            ? e('div', 'nnk-fhint', '没检测到可编辑的条目：先点「建立区块索引」，或确认该包有 init.lua')
            : null
        ) : null,
        (form.entryId && form.entrySkills.length) ? h('div', { className: 'nnk-field' },
          e('label', 'nnk-label', '该武将的技能' + (form.entrySkillsLoading ? '（加载中…）' : '')),
          h('div', {}, form.entrySkills.map(function (en) {
            var picked = form.pickedSkills.filter(function (p) { return p.id === en.id })[0];
            return h('div', { key: en.id, className: 'nnk-pickskill' },
              h('label', { className: 'nnk-radio' },
                h('input', { type: 'checkbox', checked: !!picked, onChange: function () { togglePicked(en.id, en.name) } }),
                en.id + (en.name ? '（' + en.name + '）' : '')
              ),
              picked ? autoArea({ style: { display: 'block', width: '100%', boxSizing: 'border-box', marginTop: '4px' }, value: picked.note, placeholder: '要改成什么（必填）' }, function (v) { setPickedNote(en.id, v) }) : null
            );
          }))
        ) : null,
        areaField(form.type === 'mode' ? '模式骨架改动' : (form.type === 'card' ? '卡牌改动' : '武将改动'), form.editNotes, set('editNotes'), {
          style: { minHeight: '72px' },
          placeholder: form.type === 'mode' ? '例：人数上限改成 12；胜利条件改计分制' : (form.type === 'card' ? '例：改名疾风符；类别按引擎写法调整' : '例：体力 3/4/1；势力改 wei'),
        }),
        (form.type === 'mode') ? areaField('新增或调整的规则', form.rules, set('rules'), { style: { minHeight: '80px' }, placeholder: '例：新增一条——雪天全场武力 -1' }) : null,
        (form.type === 'general') ? radioGroup('是否新增技能', form.addSkills ? 'yes' : 'no', [{ value: 'no', text: '不新增' }, { value: 'yes', text: '新增技能' }], function (v) { patch({ addSkills: v === 'yes' }) }) : null,
        (form.addSkills && form.type === 'general') ? buildSkillRows() : null,
      ]) : null;

      var submitSection = sec('交付', null, [
        areaField('参考代码（可选）', form.reference, set('reference'), { placeholder: '粘贴想模仿的官方实现' }),
        form.err ? e('div', 'nnk-errbox', '⚠ ' + form.err) : null,
        e('div', 'nnk-fhint', '提交后 AI 先出【需求理解确认】，回复「确认」才开始写代码；有歧义它会先问'),
      ]);

      // 交付操作条吸底：表单再长也不用滚到底找按钮
      var stickyDeliver = h('div', { className: 'nnk-deliver nnk-stickybar' },
        radioGroup('写入方式', form.writeMode, [{ value: 'auto', text: '自动写入' }, { value: 'manual', text: '手动复制' }], set('writeMode')),
        h('button', { className: 'nnk-submit', disabled: form.busy, onClick: submit }, form.busy ? '已发送…' : (isEdit ? '发给 AI 修改' : '发给 AI 开工'))
      );

      return h('div', { className: 'nnk-form' },
        pasteSection, modeSection, basicSection, mediaSection,
        editSection, modeCreateSection, skillsSection, cardSection, submitSection, stickyDeliver,
        h(FilePickerModal, { key: 'picker', picker: form.picker, setPicker: setPicker })
      );
      } catch (renderError) {
        return e('div', 'nnk-err', '表单渲染错误: ' + (renderError && renderError.message || renderError));
      }
    }


    // ── 历史面板 ────────────────────────────────────────────────
    function HistoryPanel(props) {
      props = props || {};
      var state = React.useState({ loading: true, extensions: [], detail: null, msg: '' });
      var data = state[0], setData = state[1];
      var load = function () {
        fetch('/xinyue-kit-api/history').then(function (r) { return r.json() }).then(function (body) {
          setData({ loading: false, extensions: body.extensions || [], detail: null, msg: body.error || '' })
        }, function () { setData({ loading: false, extensions: [], detail: null, msg: '历史服务不可用(需配置 xinyueDir 并重启)' }) });
      };
      React.useEffect(function () { load() }, []);
      // 从「扩展包」页点「查看履历」进来时,直接展开该包
      React.useEffect(function () {
        if (props.openFolder) openDetail(props.openFolder);
      }, [props.openFolder]);
      var openDetail = function (folder) {
        fetch('/xinyue-kit-api/history?folder=' + encodeURIComponent(folder)).then(function (r) { return r.json() }).then(function (body) {
          setData(function (prev) { return Object.assign({}, prev, { detail: body }) })
        }, function () {
          setData(function (prev) { return Object.assign({}, prev, { msg: '读取备份详情失败(历史服务不可用)' }) });
        });
      };
      var rollback = function (folder, backup) {
        if (!window.confirm('把 ' + backup + ' 回滚为当前版本?当前版本会先自动备份。')) return;
        fetch('/xinyue-kit-api/rollback', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ folder: folder, backup: backup }),
        }).then(function (r) { return r.json() }).then(function (body) {
          setData(function (prev) { return Object.assign({}, prev, { msg: body.ok ? '已回滚 ' + backup : ('回滚失败: ' + body.error) }) });
          openDetail(folder);
        }, function () {
          setData(function (prev) { return Object.assign({}, prev, { msg: '回滚请求失败(历史服务不可用),未执行回滚' }) });
        });
      };
      var pruneBackupsNow = function (folder) {
        setData(function (prev) { return Object.assign({}, prev, { pruning: true, msg: '' }) });
        fetch('/xinyue-kit-api/backups/prune', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ folder: folder }),
        }).then(function (r) { return r.json() }).then(function (b) {
          setData(function (prev) { return Object.assign({}, prev, { pruning: false, msg: b.ok ? '已清理 ' + b.removedCount + ' 个旧备份(每个 backup/ 保留最新 3 个)' : ('清理失败: ' + b.error) }) });
          openDetail(folder);
        }, function () {
          setData(function (prev) { return Object.assign({}, prev, { pruning: false, msg: '清理请求失败' }) });
        });
      };
      var deleteNote = function (folder, index) {
        fetch('/xinyue-kit-api/history/note-delete', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ folder: folder, index: index }),
        }).then(function (r) { return r.json() }).then(function (body) {
          setData(function (prev) { return Object.assign({}, prev, { msg: body.ok ? '已删除注意点' : ('删除失败: ' + body.error) }) });
          openDetail(folder);
        }, function (error) { setData(function (prev) { return Object.assign({}, prev, { msg: '删除失败: ' + (error && error.message || error) }) }) });
      };

      if (data.loading) return e('div', 'nnk-hint', '加载中…');
      if (data.msg && data.extensions.length === 0) return e('div', 'nnk-err', data.msg);
      var fmt = function (ts) { return new Date(ts).toLocaleString() };

      var kindName = function (k) { return k === 'card' ? '卡牌' : k === 'mode' ? '模式' : '武将' };
      return h('div', { className: 'nnk-hist' },
        data.msg ? e('div', data.msg.indexOf('失败') >= 0 || data.msg.indexOf('不可用') >= 0 ? 'nnk-err' : 'nnk-ok', data.msg) : null,
        data.detail ? (function () {
          var detail = data.detail, backups = detail.backups || [];
          var hist = detail.history || {};
          return h('div', { className: 'nnk-card nnk-detail', ref: function (el) {
            if (el && !el.__nnkScrolled) { el.__nnkScrolled = true; el.scrollIntoView({ behavior: 'smooth', block: 'nearest' }) }
          } },
            h('div', { className: 'nnk-detail-h' },
              h('b', null, detail.folder),
              h('button', { className: 'nnk-smallbtn', onClick: function () { setData(function (prev) { return Object.assign({}, prev, { detail: null }) }) } }, '收起')
            ),
            h('div', { className: 'nnk-label' }, '备份 · ' + backups.length + ' 份（点一份回滚；回滚前当前版先自动备份）'),
            backups.length
              ? h('div', { className: 'nnk-chips' }, backups.map(function (b) {
                  return h('button', { key: b, className: 'nnk-chip nnk-chip-btn', title: '回滚到 ' + b, onClick: function () { rollback(detail.folder, b) } }, '⏪ ' + b)
                }))
              : e('div', 'nnk-fhint', '还没有备份——每次覆盖写入前都会自动生成一份'),
            h('div', { className: 'nnk-detail-bar' },
              h('button', { className: 'nnk-smallbtn', disabled: !!data.pruning, onClick: function () { pruneBackupsNow(detail.folder) } },
                data.pruning ? '清理中…' : '🧹 清理旧备份（保留最新 3 份）')
            ),
            (hist.notes && hist.notes.length) ? [
              e('div', 'nnk-label', '注意点 · ' + hist.notes.length + ' 条（AI 按需拉取）'),
              h('div', { className: 'nnk-notes' }, hist.notes.map(function (n, i) {
                return h('div', { key: i, className: 'nnk-note-row' },
                  e('div', 'nnk-note', n),
                  h('button', { className: 'nnk-fbx', title: '删除这条', onClick: function () { deleteNote(detail.folder, i) } }, '✕')
                )
              }))
            ] : null,
            (hist.changes && hist.changes.length) ? [
              e('div', 'nnk-label', '自由改动流水 · ' + hist.changes.length + ' 条'),
              h('div', {}, hist.changes.slice(-20).reverse().map(function (c, i) {
                var kindLabel = c.kind === 'fix' ? '修复' : c.kind === 'asset' ? '素材' : c.kind === 'discussion' ? '讨论' : '改动'
                return h('div', { key: 'chg' + i, className: 'nnk-change-row' },
                  e('span', 'nnk-badge', kindLabel),
                  e('span', 'nnk-change-t', fmt(c.at)),
                  e('span', 'nnk-change-s', c.summary + ((c.files && c.files.length) ? ' · ' + c.files.join('、') : ''))
                )
              }))
            ] : null
          );
        })() : null,
        data.extensions.length === 0 ? h('div', { className: 'nnk-empty' },
          h('b', null, '还没有扩展包记录'),
          e('div', 'nnk-fhint', '完成第一个任务后，这里会按包统计任务数、轮次和备份。')
        ) : h('div', { className: 'nnk-extgrid' }, data.extensions.map(function (ext) {
          var on = data.detail && data.detail.folder === ext.folder;
          return h('div', { key: ext.folder, className: 'nnk-extcard' + (on ? ' is-on' : ''), onClick: function () { openDetail(ext.folder) } },
            h('div', { className: 'nnk-extcard-h' },
              h('b', null, ext.folder),
              ext.backupCount ? e('span', 'nnk-badge', ext.backupCount + ' 备份') : null
            ),
            e('div', 'nnk-extcard-meta', ext.taskCount + ' 个任务 · 累计 ' + ext.totalRounds + ' 轮'),
            e('div', 'nnk-extcard-last', ext.lastTask
              ? '最近 · ' + kindName(ext.lastTask.kind) + ' · ' + ext.lastTask.summary
              : '暂无任务记录'),
            h('div', { className: 'nnk-extcard-act' },
              h('button', { className: 'nnk-smallbtn', onClick: function (ev) { ev.stopPropagation(); openDetail(ext.folder) } }, '备份 / 注意点')
            )
          );
        }))
      );
    }

    // ── 设置面板(⚙ 子页):游戏目录 / AI 输出阀门 / 关于 ─────────
    function SettingsPanel() {
      var state = React.useState({ loading: true, version: '', xinyueDir: '', source: 'none', bashMax: 64000, bashMaxK: '64', updateCheck: true, manual: '', scanning: false, scanned: false, candidates: [], extensions: [], busy: false, healthBusy: false, msg: '', err: '', healthMsg: '', healthErr: '' });
      var form = state[0], setForm = state[1];
      var set = function (patch) { setForm(function (prev) { return Object.assign({}, prev, patch) }) };
      var load = function () {
        fetch('/xinyue-kit-api/settings').then(function (r) { return r.json() }).then(function (s) {
          var bytes = s.bashMaxOutputBytes || 64000;
          set({ loading: false, version: s.version || '', xinyueDir: s.xinyueDir || '', source: s.source || 'none', extensions: s.extensions || [], bashMax: bytes, bashMaxK: String(Math.round(bytes / 1000)), updateCheck: s.updateCheck !== false });
        }, function () { set({ loading: false, err: '设置服务不可用(插件更新后需重启 DSH)' }) });
      };
      React.useEffect(function () { load() }, []);
      // 版本/一致性状态来自共享的 healthBus(🛠 按钮那份),挂载时刷一次
      var healthState = React.useState(healthBus.state);
      var health = healthState[0], setHealth = healthState[1];
      React.useEffect(function () {
        var off = healthBus.sub(setHealth);
        healthBus.refresh();
        return off;
      }, []);

      var scan = function () {
        set({ scanning: true, err: '' });
        fetch('/xinyue-kit-api/detect').then(function (r) { return r.json() }).then(function (body) {
          set({ scanning: false, scanned: true, candidates: body.candidates || [] });
        }, function () { set({ scanning: false, err: '扫描失败' }) });
      };
      var saveDir = function (dir) {
        if (!dir || !dir.trim()) { set({ err: '请先填写或选择游戏本体目录' }); return }
        set({ busy: true, err: '', msg: '' });
        fetch('/xinyue-kit-api/init', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ xinyueDir: dir.trim() }),
        }).then(function (r) { return r.json() }).then(function (body) {
          if (!body.ok) throw new Error(body.error || '保存失败');
          set({ busy: false, msg: body.adjustedFrom
            ? '✅ 已自动修正:你填的路径结尾多了一层 \\extension,游戏目录已设为上一层 ' + body.xinyueDir
            : '✅ 游戏目录已更新: ' + body.xinyueDir });
          load();
        }).catch(function (error) { set({ busy: false, err: '保存失败: ' + (error && error.message || error) }) });
      };
      var saveBashMax = function (v) {
        var n = parseInt(v, 10);
        if (!isFinite(n) || n < 64000 || n > 256000) { set({ err: '输出上限需在 64 ~ 256 K 之间' }); return }
        set({ busy: true, err: '', msg: '' });
        fetch('/xinyue-kit-api/settings', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ bashMaxOutputBytes: n }),
        }).then(function (r) { return r.json() }).then(function (body) {
          if (!body.ok) throw new Error(body.error || '保存失败');
          set({ busy: false, bashMax: body.bashMaxOutputBytes, bashMaxK: String(Math.round(body.bashMaxOutputBytes / 1000)), msg: '✅ 输出上限已保存为 ' + Math.round(body.bashMaxOutputBytes / 1000) + 'K——对新开的会话生效(已开的会话保持不变)' });
        }).catch(function (error) { set({ busy: false, err: '保存失败: ' + (error && error.message || error) }) });
      };
      var checkNow = function () {
        set({ healthBusy: true, healthErr: '', healthMsg: '' });
        fetch('/xinyue-kit-api/update/check', { method: 'POST' }).then(function (r) { return r.json() }).then(function (body) {
          healthBus.adopt(body);
          var check = body.check || {};
          // link 方式不参与检测,直说,别绕
          set({ healthBusy: false, healthMsg: check.skipped === 'link' ? 'link 方式不参与版本检测' : (check.error ? '' : '✅ 已检查') });
        }, function (error) { set({ healthBusy: false, healthErr: '检查失败: ' + (error && error.message || error) }) });
      };
      var reinstallPreset = function () {
        set({ healthBusy: true, healthErr: '', healthMsg: '' });
        fetch('/xinyue-kit-api/preset/install', { method: 'POST' }).then(function (r) { return r.json() }).then(function (body) {
          if (!body.ok) throw new Error(body.error || '安装失败');
          healthBus.set({ preset: body.preset || null });
          set({ healthBusy: false, healthMsg: '✅ preset 已重装' + (body.backup ? '(旧版已备份)' : '') + '——对新建会话生效,已开的会话不变' });
        }).catch(function (error) { set({ healthBusy: false, healthErr: '重装失败: ' + (error && error.message || error) }) });
      };
      var toggleUpdateCheck = function () {
        var next = !form.updateCheck;
        set({ busy: true, err: '', msg: '' });
        fetch('/xinyue-kit-api/settings', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ updateCheck: next }),
        }).then(function (r) { return r.json() }).then(function (body) {
          if (!body.ok) throw new Error(body.error || '保存失败');
          set({ busy: false, updateCheck: body.updateCheck });
          healthBus.set({ updateCheck: body.updateCheck });
        }).catch(function (error) { set({ busy: false, err: '保存失败: ' + (error && error.message || error) }) });
      };

      // 版本与一致性两行:插件本体(能查新版就告知,不自动更新)+ preset 一致性
      var renderUpdateRow = function () {
        var check = health.update;
        var installForm = health.installForm || 'unknown';
        var line;
        if (installForm === 'link') {
          line = e('div', 'nnk-hint', 'link 方式加载的插件不参与版本检测');
        } else if (check && check.error) {
          line = e('div', 'nnk-hint', '检查失败:' + check.error + '(不影响使用,可稍后重试)');
        } else if (check && check.hasUpdate) {
          line = e('div', 'nnk-err', '⬆ 有新版本 v' + check.latest + '(当前 v' + (check.current || form.version) + ',来源 ' + check.source + ')');
        } else if (check) {
          line = e('div', 'nnk-hint', '✅ 已是最新(v' + (check.current || form.version) + ',来源 ' + check.source + ')');
        } else if (!form.updateCheck) {
          line = e('div', 'nnk-hint', '启动时自动检查已关闭,尚未检查过。');
        } else {
          line = e('div', 'nnk-hint', '尚未检查(点右侧「检查更新」)。');
        }
        var cmd = check && check.hasUpdate ? (health.installHint || check.installHint) : null;
        return e('div', {},
          h('div', {},
            h('b', null, '插件'),
            h('span', { className: 'nnk-hint' }, '　当前 v' + (form.version || '?') + (installForm === 'link' ? ' · link 方式加载' : ''))
          ),
          h('div', {},
            h('button', { className: 'nnk-smallbtn', disabled: form.healthBusy, onClick: checkNow }, form.healthBusy ? '检查中…' : '🔄 检查更新'),
            h('button', { className: 'nnk-smallbtn', disabled: form.busy, onClick: toggleUpdateCheck }, (form.updateCheck ? '☑' : '☐') + ' 启动时自动检查')
          ),
          line,
          cmd ? e('div', 'nnk-hint', '在终端执行(完成后重启 DSH):') : null,
          cmd ? h('div', {}, h('code', { className: 'nnk-cmd' }, cmd)) : null
        );
      };
      var renderPresetRow = function () {
        var preset = health.preset;
        var line;
        if (!health.loaded) line = e('div', 'nnk-hint', '读取中…');
        else if (!preset) line = e('div', 'nnk-hint', '状态不可用(服务端未响应)');
        else if (preset.state === 'declarative') {
          // DSH 0.1.7+:preset 声明在插件 bundle patch 里,随插件加载自动就位、随插件更新
          line = e('div', 'nnk-hint', '✅ 声明式 preset,随插件自动就位——无需安装/重装,改动随插件更新在重启后生效。');
        }
        else if (preset.state === 'ok') line = e('div', 'nnk-hint', '✅ 与插件自带的一致');
        else if (preset.state === 'missing') line = e('div', 'nnk-hint', '⚠️ 未安装——新建会话里选不到「新月杀开发模式」,点右侧重装。');
        else if (preset.state === 'stale') {
          // 只陈述事实(哈希不同)+ 后果(重装会覆盖本地这份),不替用户猜原因 ——
          // "本地被改过"或"插件更新了"都只是可能,猜错反而误导
          var mine = String(preset.installedHash || '').slice(0, 8);
          var theirs = String(preset.bundledHash || '').slice(0, 8);
          line = e('div', 'nnk-hint', '⚠️ 与插件自带的不一致(已装 ' + mine + ' ≠ 插件 ' + theirs + ')。点重装会用插件自带那份覆盖本地这份(先备份)。');
        }
        else line = e('div', 'nnk-hint', '⚠️ ' + (preset.error || '状态未知'));
        var declarative = preset && preset.state === 'declarative';
        return e('div', {},
          h('div', {},
            h('b', null, '开发模式 preset'),
            h('span', { className: 'nnk-hint' }, '　AI 的人格、常驻工具名单与技能文档')
          ),
          declarative ? null : h('div', {}, h('button', { className: 'nnk-smallbtn', disabled: form.healthBusy, onClick: reinstallPreset }, '♻️ 重装 preset')),
          line,
          declarative
            ? e('div', 'nnk-hint', '当前 DSH 版本(0.1.7+)的 preset 随插件分发:插件更新即 preset 更新,重启 dsh 生效,不存在漂移。')
            : e('div', 'nnk-hint', 'preset 是插件行为的第二份副本,代码更新后不重装会拿到自相矛盾的指令且不报错,所以单列一行。覆盖前会先备份成 xinyue-dev.bak-<时间戳>。')
        );
      };

      if (form.loading) return e('div', 'nnk-hint', '加载中…');
      var PRESETS = [['64K', 64000], ['128K', 128000], ['256K', 256000]];
      return h('div', { className: 'nnk-setgrid' },
        form.msg ? e('div', 'nnk-ok nnk-span2', form.msg) : null,
        form.err ? e('div', 'nnk-err nnk-span2', form.err) : null,

        h('div', { className: 'nnk-card nnk-setcard' },
          e('div', 'nnk-settitle', '游戏目录'),
          e('div', 'nnk-fhint', 'AI 自动写入扩展的游戏本体位置——填到能看见 extension 文件夹的那一层'),
          e('div', 'nnk-fhint', form.xinyueDir
            ? '当前：' + form.xinyueDir + '（' + (form.source === 'cordis.yml' ? '配置文件' : '工坊设置') + '）'
            : '⚠️ 未配置——AI 无法自动写入，只能用手动复制'),
          autoArea({ value: form.manual, placeholder: '填游戏根目录（那一层里能看到 extension 文件夹）' }, function (v) { set({ manual: v }) }),
          h('div', { className: 'nnk-btnrow' },
            h('button', { className: 'nnk-smallbtn', disabled: form.scanning || form.busy, onClick: scan }, form.scanning ? '扫描中…' : (form.scanned ? '🔍 重新扫描' : '🔍 自动扫描')),
            form.manual.trim() ? h('button', { className: 'nnk-smallbtn', disabled: form.busy, onClick: function () { saveDir(form.manual) } }, '💾 保存所填目录') : null
          ),
          form.scanned && form.candidates.length === 0 ? e('div', 'nnk-fhint', '没扫到——游戏在非常规位置就用上面手动填写') : null,
          form.xinyueDir ? e('div', 'nnk-fhint', form.extensions.length
            ? '✅ 已连接，检测到 ' + form.extensions.length + ' 个扩展包：' + form.extensions.slice(0, 20).join('、') + (form.extensions.length > 20 ? ' 等' : '')
            : '目录已连接，但 extension/ 下还没有扩展包') : null,
          form.candidates.map(function (dir) {
            return h('label', { key: dir, className: 'nnk-radio', style: { display: 'block', margin: '4px 0', whiteSpace: 'normal' } },
              h('input', { type: 'radio', name: 'nnk-set-candidate', checked: form.manual === dir, onChange: function () { set({ manual: dir }) } }),
              h('span', { className: 'nnk-break' }, dir)
            );
          })
        ),

        h('div', { className: 'nnk-card nnk-setcard' },
          e('div', 'nnk-settitle', 'AI 命令输出上限'),
          e('div', 'nnk-fhint', '控制单次执行命令/查资料最多往对话里灌多少内容，直接影响 token 消耗（新会话生效）'),
          h('div', { className: 'nnk-btnrow' }, PRESETS.map(function (p) {
            var active = Number(form.bashMax) === p[1];
            return h('button', { key: p[1], className: 'nnk-smallbtn', style: active ? { borderColor: 'var(--dsw-alias-brand-primary)', color: 'var(--dsw-alias-brand-primary)' } : {}, disabled: form.busy, onClick: function () { saveBashMax(p[1]) } }, p[0] + (active ? ' ✓' : ''));
          })),
          h('div', { className: 'nnk-btnrow' },
            h('input', { className: 'nnk-input', style: { width: '110px' }, type: 'number', min: 64, max: 256, value: form.bashMaxK, onChange: function (ev) { set({ bashMaxK: ev.target.value }) } }),
            e('span', 'nnk-fhint', 'K（64 ~ 256）'),
            h('button', { className: 'nnk-smallbtn', disabled: form.busy, onClick: function () { saveBashMax((parseInt(form.bashMaxK, 10) || 0) * 1000) } }, '💾 保存上限')
          )
        ),

        h('div', { className: 'nnk-card nnk-setcard nnk-span2' },
          e('div', 'nnk-settitle', '版本与一致性'),
          form.healthMsg ? e('div', 'nnk-ok', form.healthMsg) : null,
          form.healthErr ? e('div', 'nnk-err', form.healthErr) : null,
          renderUpdateRow(),
          h('div', { style: { marginTop: '10px' } }, renderPresetRow()),
          e('div', 'nnk-fhint', '关于：新月杀工坊（xinyue-kit）v' + (form.version || '?') + ' · 「新月杀开发模式」与工坊同属一套，设置保存在 ~/.dsh/xinyue-kit.json')
        )
      );
    }

    // ── 扩展包页(列出 packages/ 下带历史的包,一屏看全) ─────────
    function PackageView(props) {
      var state = React.useState({ loading: true, list: [], msg: '' });
      var data = state[0], setData = state[1];
      var selState = React.useState('');
      var sel = selState[0], setSel = selState[1];
      var kindState = React.useState('character');
      var kind = kindState[0], setKind = kindState[1];
      var entState = React.useState({ loading: false, entries: [], msg: '' });
      var ent = entState[0], setEnt = entState[1];
      var load = function () {
        fetch('/xinyue-kit-api/history').then(function (r) { return r.json() }).then(function (body) {
          setData({ loading: false, list: body.extensions || [], msg: body.error || '' });
        }, function () {
          setData({ loading: false, list: [], msg: '读取扩展包失败（需要配置游戏目录）' });
        });
      };
      var loadEntries = function (folder, k) {
        if (!folder) return;
        setEnt({ loading: true, entries: [], msg: '' });
        fetch('/xinyue-kit-api/entries?folder=' + encodeURIComponent(folder) + '&kind=' + encodeURIComponent(k))
          .then(function (r) { return r.json() })
          .then(function (body) {
            setEnt({ loading: false, entries: body.entries || [], msg: body.error || '' });
          }, function () { setEnt({ loading: false, entries: [], msg: '条目读取失败' }) });
      };
      React.useEffect(function () { load() }, []);
      React.useEffect(function () { if (sel) loadEntries(sel, kind) }, [sel, kind]);
      var fmt = function (ts) {
        if (!ts) return '—';
        var d = new Date(ts);
        return d.toLocaleDateString() + ' ' + d.toTimeString().slice(0, 5);
      };
      var KIND_TABS = [['character', '武将'], ['card', '卡牌'], ['skill', '技能']];
      return h('div', null,
        h('div', { className: 'nnk-detail-h' },
          e('div', 'nnk-fhint', '共 ' + data.list.length + ' 个扩展包 · 数据来自本地 packages/ 与工坊历史'),
          h('button', { className: 'nnk-smallbtn', onClick: load }, '刷新')
        ),
        data.msg ? e('div', 'nnk-err', data.msg) : null,
        data.loading ? e('div', 'nnk-fhint', '读取中…') : null,
        data.list.length ? h('div', { className: 'nnk-extgrid' }, data.list.map(function (item) {
          var on = sel === item.folder;
          return h('div', {
            key: item.folder,
            className: 'nnk-extcard' + (on ? ' is-on' : ''),
            onClick: function () { setSel(on ? '' : item.folder) },
          },
            h('div', { className: 'nnk-extcard-h' },
              e('b', null, item.folder),
              e('span', 'nnk-fhint', on ? '收起' : '展开')
            ),
            e('div', 'nnk-extcard-meta', (item.taskCount || 0) + ' 个任务 · 累计 ' + (item.totalRounds || 0) + ' 轮 · 注意点 ' + (item.noteCount || 0) + ' · 备份 ' + (item.backupCount || 0)),
            e('div', 'nnk-extcard-last', item.lastTask ? ('最近：' + (item.lastTask.summary || '') + ' · ' + fmt(item.lastTask.at)) : '还没有任务记录'),
            h('div', { className: 'nnk-extcard-act' },
              h('button', {
                className: 'nnk-smallbtn',
                onClick: function (ev) { ev.stopPropagation(); if (props.onOpen) props.onOpen(item.folder) }
              }, '查看履历 →')
            )
          );
        })) : null,
        !data.loading && !data.list.length && !data.msg ? h('div', { className: 'nnk-empty' },
          h('b', null, '还没有扩展包'),
          e('div', 'nnk-fhint', '在「任务流」新建一个任务并写入后，这里会出现包目录')
        ) : null,

        sel ? h('div', { className: 'nnk-card' },
          h('div', { className: 'nnk-detail-h' },
            e('b', null, sel + ' · 条目'),
            h('div', { className: 'nnk-chips' }, KIND_TABS.map(function (t) {
              return h('button', {
                key: t[0], type: 'button',
                className: 'nnk-chip-btn',
                style: kind === t[0] ? { borderColor: '#a32b21', color: '#a32b21' } : {},
                onClick: function () { setKind(t[0]) },
              }, t[1]);
            }))
          ),
          ent.loading ? e('div', 'nnk-fhint', '读取中…') : null,
          ent.msg ? e('div', 'nnk-err', ent.msg) : null,
          ent.entries.length ? h('div', { className: 'nnk-detail-bar' }, ent.entries.map(function (row) {
            return h('div', { key: row.id, className: 'nnk-change-row' },
              e('span', 'nnk-change-t', row.file || ''),
              e('span', 'nnk-change-s', (row.name || row.id) + '　'),
              e('span', 'nnk-fhint', row.id + ' · ' + (row.lines || 0) + ' 行')
            );
          })) : (!ent.loading ? e('div', 'nnk-fhint', '这个分类下没有条目') : null)
        ) : null
      );
    }

    // ── 工坊页(左导航:任务流 / 任务列表 / 扩展包 / 履历 / 设置) ───
    function WorkshopView(props) {
      var sessionId = props.sessionId;
      // Hooks 规则:所有 hook 必须在任何条件返回之前声明
      var ready = React.useState(null); // null=检测中, false=需初始化, true=正常
      var phase = ready[0], setPhase = ready[1];
      var tab = React.useState('new');
      var active = tab[0], setActive = tab[1];
      var focusState = React.useState(false);
      var isFocus = focusState[0], setFocus = focusState[1];
      /* 「专注」：把宿主底部输入框临时隐藏，工坊铺满窗口；退出时原样恢复。
       * 输入框由宿主渲染、没有公开开关，这里按 placeholder 定位再向上找 position:fixed/sticky 的容器。 */
      React.useEffect(function () {
        var hidden = null;
        try {
          var cands = Array.prototype.slice.call(document.querySelectorAll('textarea,[contenteditable="true"]'));
          var t = cands.filter(function (x) {
            var s = (x.getAttribute('placeholder') || '') + (x.getAttribute('aria-label') || '');
            return s.indexOf('发消息') >= 0 || s.indexOf('消息或创建任务') >= 0;
          })[0];
          if (t) {
            var cur = t;
            while (cur && cur !== document.body) {
              var cs = window.getComputedStyle(cur);
              if (cs.position === 'fixed' || cs.position === 'sticky') { hidden = cur; break }
              cur = cur.parentElement;
            }
            if (!hidden) hidden = t.closest('form') || t.parentElement;
          }
        } catch (e) { hidden = null }
        if (isFocus && hidden) {
          hidden.setAttribute('data-nnk-prev-display', hidden.style.display || '');
          hidden.style.display = 'none';
          document.body.classList.add('nnk-focus');
        } else {
          document.body.classList.remove('nnk-focus');
          if (hidden && hidden.getAttribute('data-nnk-prev-display') !== null) {
            hidden.style.display = hidden.getAttribute('data-nnk-prev-display');
            hidden.removeAttribute('data-nnk-prev-display');
          }
        }
        return function () {
          document.body.classList.remove('nnk-focus');
          if (hidden && hidden.getAttribute('data-nnk-prev-display') !== null) {
            hidden.style.display = hidden.getAttribute('data-nnk-prev-display');
            hidden.removeAttribute('data-nnk-prev-display');
          }
        };
      }, [isFocus]);
      React.useEffect(function () {
        if (!isFocus) return;
        var onKey = function (ev) { if (ev.key === 'Escape') setFocus(false) };
        document.addEventListener('keydown', onKey);
        return function () { document.removeEventListener('keydown', onKey) };
      }, [isFocus]);
      var hist = React.useState(null);
      var historyFolder = hist[0], setHistoryFolder = hist[1];
      React.useEffect(function () {
        fetch('/xinyue-kit-api/status').then(function (r) { return r.json() }).then(function (status) {
          setPhase(Boolean(status.active));
        }, function () { setPhase(true) }); // 服务不可用时照常显示,工具会自行报错
      }, []);
      React.useEffect(function () {
        // 未配置游戏目录时默认落在「⚙ 设置」页:新用户第一眼就是配置入口
        if (phase === false) setActive('settings');
      }, [phase]);
      var presetFlip = React.useState(false);
      var presetFlipDone = presetFlip[0], setPresetFlipDone = presetFlip[1];
      React.useEffect(function () {
        if (presetFlipDone) return
        // 「新月杀开发模式」没装时也默认落在「⚙ 设置」页 —— 那页有「♻️ 重装 preset」按钮。
        // 从 npm 装的用户手里没有插件目录路径(它在 ~/.dsh/profiles/web/node_modules/ 下),
        // 指望他去命令行跑 install-preset.mjs 是不现实的(实测:陌生人卡在这一步)。
        healthBus.refresh().then(function (body) {
          setPresetFlipDone(true)
          var preset = body && body.preset
          if (preset && preset.state === 'missing') setActive('settings')
        })
      }, [presetFlipDone]);
      var send = function (text) {
        var session = sessionId;
        return Promise.resolve(session).then(function (id) {
          // sessions 服务由插件 inject 提供;绑定当前会话并发送结构化消息。
          // 新版对未打开的会话 binding() 返回 undefined——判空让调用方走报错,而不是 TypeError
          var sessions = props.sessions;
          var binding = sessions.binding(id);
          if (!binding || !binding.session) throw new Error('目标会话未打开或已关闭');
          return binding.session.prompt([{ type: 'text', text: text }], 'queue');
        });
      };
      if (phase === null) return e('div', 'nnk-hint', '正在检查插件配置…');

      /* 整页保护:DSH 槽位边界一旦接到抛错就把这块渲染成空白(实测:客户机
       * 出现过「工坊整页空白、连插件自己的页签栏都没了」)——里面任何一处
       * 抛错都改成把错误文字亮出来,不许静默空白 */
      try {
        var META = {
          new: { ic: '🛠', cn: '任务流', en: 'TASKFLOW', crumb: 'WORKSHOP / TASKFLOW' },
          tasklist: { ic: '📋', cn: '任务列表', en: 'TASKS', crumb: 'WORKSHOP / TASKS' },
          packages: { ic: '📦', cn: '扩展包', en: 'PACKAGES', crumb: 'WORKSHOP / PACKAGES' },
          history: { ic: '📜', cn: '履历', en: 'HISTORY', crumb: 'WORKSHOP / HISTORY' },
          settings: { ic: '⚙', cn: '设置', en: 'CONFIG', crumb: 'WORKSHOP / CONFIG' }
        };
        var meta = META[active] || META.new;
        var navBtn = function (key) {
          var m = META[key];
          return h('button', {
            type: 'button',
            key: key,
            className: 'nnk-nav' + (active === key ? ' nnk-nav-on' : ''),
            onClick: function () { setActive(key) }
          }, e('span', 'nnk-nav-ic', m.ic), m.cn, e('span', 'nnk-nav-k', m.en));
        };
        return h('div', { className: 'nnk-root nnk-shell ' + (props.mode === 'panel' ? 'nnk-shell--panel' : 'nnk-shell--tab') },
          h('div', { className: 'nnk-topbar' },
            e('span', 'nnk-seal', '新'),
            h('div', null,
              e('div', 't1', '新月杀 · 扩展工坊'),
              e('div', 't2', 'XINYUE WORKSHOP')),
            e('span', 'spacer'),
            h('span', { className: 'chipdot' },
              h('span', { className: 'dot' + (phase === false ? ' bad' : '') }),
              phase === false ? '游戏目录未配置' : '游戏目录已配置'),
            props.mode === 'panel' ? null : h('button', { className: 'nnk-topbtn', title: '在可拖动、可调大小的浮窗里打开', onClick: function () { workshopBus.set(true) } }, '浮窗'),
            h('button', { className: 'nnk-topbtn', title: isFocus ? '恢复聊天框' : '收起底部聊天框，工坊铺满窗口（Esc 也可恢复）', onClick: function () { setFocus(!isFocus) } }, isFocus ? '展开聊天框' : '收起聊天框'),            e('span', 'ver', 'v1.14.1')
          ),
          h('div', { className: 'nnk-shell-body' },
            h('aside', { className: 'nnk-shell-side' },
              navBtn('new'), navBtn('tasklist'), navBtn('packages'), navBtn('history'), navBtn('settings')
            ),
            h('main', { className: 'nnk-shell-main' },
              h('div', { className: 'nnk-pagehead' },
                e('div', 'nnk-crumb', meta.crumb),
                h('h1', { className: 'nnk-h1' }, meta.cn, h('em', null, meta.en))),
              phase === false && active === 'new' ? e('div', 'nnk-err', '⚠️ 还没配置游戏目录——到「⚙ 设置」页填一下就能自动写入;暂时不配也行,把写入方式设为「手动复制」。') : null,
              active === 'new' ? h(NewTaskForm, { sessionId: sessionId, send: send }) : null,
              active === 'tasklist' ? h(TaskListContent, { sessions: props.sessions, uiSession: props.uiSession, compact: false }) : null,
              active === 'packages' ? h(PackageView, {
                onOpen: function (folder) {
                  setHistoryFolder(folder);
                  setActive('history');
                }
              }) : null,
              active === 'history' ? h(HistoryPanel, { openFolder: historyFolder }) : null,
              active === 'settings' ? h(SettingsPanel) : null
            )
          )
        );
      } catch (viewErr) {
        console.error('[xinyue-kit] 工坊页渲染出错(' + active + '):', viewErr);
        return e('div', 'nnk-err', '❌ 工坊页渲染出错(' + active + ' 页): ' + ((viewErr && viewErr.message) || viewErr) + ' —— 请截图本行文字发给开发者');
      }
    }

    // ── 工具结果卡片 ────────────────────────────────────────────
    /** 从 ToolCallBlock 提取参数与结果(兼容运行中/已结束两种形态)。 */
    function parseBlock(block) {
      block = block || {};
      var settled = Boolean(block.call);
      var argsRaw = (settled ? block.call.argsRaw : block.argsRaw) || '{}';
      var args = {};
      try { args = JSON.parse(argsRaw) } catch (e) { args = {} }
      var text = '';
      if (settled && Array.isArray(block.content)) {
        text = block.content.map(function (c) { return (c && typeof c.text === 'string') ? c.text : '' }).join('\n');
      }
      return { args: args, text: text, settled: settled, isError: settled && block.isError };
    }

    function ValidateCard(props) {
      var parsed = parseBlock(props.block);
      if (!parsed.settled) return e('div', 'nnk-hint', '⏳ 正在校验扩展代码…');
      if (parsed.isError) return e('div', 'nnk-err', '❌ 校验返回异常,详见文本结果。');
      // render 文本是工具结果的唯一载体(无结构化值通道),按文本前缀判定,正文全量展示
      var ok = (parsed.text || '').indexOf('校验通过') === 0;
      return h('div', {},
        e('div', {}, h('b', null, '扩展代码校验')),
        ok ? e('div', 'nnk-ok', '✅ 校验通过') : e('div', 'nnk-err', '❌ 校验未通过(未写入)'),
        h('pre', { className: 'nnk-note', style: { whiteSpace: 'pre-wrap', maxHeight: '260px', overflow: 'auto' } }, parsed.text || '(无返回)')
      );
    }

    function WriteCard(props) {
      var parsed = parseBlock(props.block);
      if (!parsed.settled) return e('div', 'nnk-hint', '⏳ 正在校验并写入扩展…');
      if (parsed.isError) return e('div', 'nnk-err', '❌ 写入返回异常,详见文本结果。');
      var text = parsed.text || '';
      var head = text.split('\n')[0] || '';
      var title = head.indexOf('已写入') === 0 ? '✅ 扩展已写入'
        : head.indexOf('手动模式') === 0 ? '📋 代码已生成(手动复制模式)'
        : (head.indexOf('写入被拒') === 0 || head.indexOf('校验未通过') === 0) ? '❌ 未写入'
        : '写入结果';
      return h('div', {},
        e('div', {}, h('b', null, title)),
        head.indexOf('手动模式') === 0 ? e('div', 'nnk-hint', '代码在 AI 的消息里,从对话中的代码块复制保存到目标文件即可。') : null,
        h('pre', { className: 'nnk-note', style: { whiteSpace: 'pre-wrap', maxHeight: '260px', overflow: 'auto' } }, text)
      );
    }

    function CompleteCard(props) {
      var parsed = parseBlock(props.block);
      if (!parsed.settled) return e('div', 'nnk-hint', '⏳ 正在标记技能…');
      if (parsed.isError) return e('div', 'nnk-err', '❌ 收口返回异常,详见文本结果。');
      var text = parsed.text || '';
      var ok = text.indexOf('已标记') === 0;
      return h('div', {},
        e('div', {}, h('b', null, ok ? '🏁 技能已写入,待游戏测试' : '⚠️ 收口未完成')),
        h('div', { className: ok ? 'nnk-ok' : 'nnk-err' }, text),
        ok ? null : e('div', 'nnk-hint', '若任务列表状态未更新,可让 AI 重试收口;或直接在「📋 任务列表」里操作。')
      );
    }

    // ── 悬浮任务列表小窗(全局,shell.overlay + 侧栏按钮) ───────
    var panelBus = {
      open: false,
      subs: [],
      set: function (v) { this.open = v; this.subs.forEach(function (f) { f(v) }) },
      sub: function (f) { var self = this; this.subs.push(f); return function () { self.subs = self.subs.filter(function (x) { return x !== f }) } },
    };

    /**
     * 读「当前打开会话」的 id,兼容新旧两版 DSH(上游 0.1.6 起旧版字段被移除):
     * 1) uiSession.adapter.current.getSnapshot().key —— 两版都在的 UI 层读法,首选;
     * 2) sessions.list.getSnapshot().current —— 旧版专用,0.1.6 起读不到;
     * 3) sessions.list.getSnapshot().byId 里 retainedBy.mainView > 0 —— 新版官方姿势。
     * 任一步形状不对就跳下一步;全失败返回 null,调用方走「没有会话」提示。
     */
    function readCurrentSessionId(sessions, uiSession) {
      try {
        var current = uiSession && uiSession.adapter && uiSession.adapter.current;
        var bound = current && current.getSnapshot ? current.getSnapshot() : null;
        if (bound && bound.key) return bound.key;
      } catch (e) {}
      try {
        var snap = sessions && sessions.list && sessions.list.getSnapshot ? sessions.list.getSnapshot() : null;
        if (snap && snap.current) return snap.current;
        if (snap && snap.byId) {
          var ids = Object.keys(snap.byId);
          for (var i = 0; i < ids.length; i++) {
            var row = snap.byId[ids[i]];
            if (row && row.retainedBy && (row.retainedBy.mainView || 0) > 0) return row.id;
          }
        }
      } catch (e) {}
      return null;
    }

    /** 任务列表内容(浮窗与工坊子页共用):进行中/已完成分区、反馈、删除。 */
    function TaskListContent(props) {
      var sessions = props && props.sessions;
      var uiSession = props && props.uiSession;
      var data = React.useState({ list: [], loading: false, expanded: null, fbFor: null, issue: '', busy: false, err: '', msg: '', picker: null });
      var box = data[0], setBox = data[1];
      var setD = function (patch) { setBox(function (prev) { return Object.assign({}, prev, patch) }) };

      var load = function () {
        setD({ loading: true });
        fetch('/xinyue-kit-api/tasks').then(function (r) { return r.json() }).then(function (body) {
          setD({ loading: false, list: body.tasks || [] });
        }, function () { setD({ loading: false, err: '任务列表获取失败' }) });
      };
      React.useEffect(function () { load() }, []);

      var SKILL_BADGE = { open: ['nnk-status-open', '🟡待实现'], written: ['nnk-status-written', '🟠待测试'], confirmed: ['nnk-status-done', '✅已确认'] };

      var confirmSkill = function (task, skill) {
        fetch('/xinyue-kit-api/tasks/skill-status', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, skill: skill, status: 'confirmed' }),
        }).then(function (r) { return r.json() }).then(function (b) {
          if (!b.ok) { setD({ err: b.error || '操作失败' }); return }
          setD({ msg: b.autoCompleted ? '🎉 「' + task.id + '」全部技能确认且图片/配音就位,自动完成并归档!' : '' });
          load();
        }, function (error) { setD({ err: error && error.message || String(error) }) });
      };
      /* 任务卡的补图/补配音也走同一个文件选择器(用户:别让人复制路径)。
       * 选择器状态放在 box.picker,选中后由 onConfirm 直接发请求。 */
      var setPicker = function (patchOrFn) {
        setBox(function (prev) {
          // null = 关闭模态框(不能走 Object.assign:null 会被当成空补丁,框关不掉)
          var next = patchOrFn === null ? null
            : (typeof patchOrFn === 'function' ? patchOrFn(prev.picker) : Object.assign({}, prev.picker, patchOrFn));
          return Object.assign({}, prev, { picker: next });
        });
      };
      var openTaskPicker = function (opts) { openPicker(setBox, setPicker, opts) };

      var postImage = function (task, source, fileName) {
        fetch('/xinyue-kit-api/tasks/image', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, folder: task.folder, source: source, fileName: fileName }),
        }).then(function (r) { return r.json() }).then(function (b) {
          if (!b.ok) { setD({ err: b.error || '补图失败' }); return }
          setD({ msg: '📷 「' + task.id + '」图片已复制进扩展包: ' + (b.copied || []).join(', ') + (b.autoCompleted ? ' —— 🎉 全部确认+图片配音就位,自动完成并归档!' : '') });
          load();
        }, function (error) { setD({ err: error && error.message || String(error) }) });
      };
      var addImage = function (task) {
        openTaskPicker({
          title: '选择图片(将复制进扩展包 image/generals/)', filter: 'image', multiple: false,
          purpose: 'image-task',
          onConfirm: function (p) {
            var source = p.paths[0];
            postImage(task, source, (p.names && p.names[source]) || baseName(source));
          },
        });
      };
      /** 补配音:选择器里一次选好文件 + 归属(技能配音/阵亡语音)+ 包内文件名,
       *  确定后逐个 POST /xinyue-kit-api/tasks/audio(复制进包 + 登记任务一步到位)。 */
      var addAudio = function (task) {
        var skillNames = (Array.isArray(task.skills) ? task.skills : []).map(function (s) { return s.name }).filter(Boolean);
        openTaskPicker({
          title: '选择配音文件', filter: 'audio', multiple: true, purpose: 'audio-task',
          skills: skillNames,
          onConfirm: function (p) {
            var audioKind = p.audioKind === 'death' ? 'death' : 'skill';
            var skill = audioKind === 'death' ? '' : String(p.skillName || '');
            if (audioKind === 'skill' && !skill) { setD({ err: '技能配音需要先选归属技能' }); return }
            var jobs = p.paths.map(function (source) {
              var name = (p.names && p.names[source]) || baseName(source);
              if (audioKind === 'death') name = name.replace(/\.mp3$/i, '') + '.mp3';
              return { source: source, target: (audioKind === 'death' ? 'death/' : 'skill/') + name };
            });
            setD({ busy: true, err: '' });
            var done = [];
            var step = function (i) {
              if (i >= jobs.length) {
                setD({ busy: false, msg: '🔊 「' + task.id + '」配音已复制进扩展包: ' + done.join(', ') });
                load();
                return;
              }
              fetch('/xinyue-kit-api/tasks/audio', {
                method: 'POST', headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ taskId: task.id, folder: task.folder, source: jobs[i].source, target: jobs[i].target, skill: skill }),
              }).then(function (r) { return r.json() }).then(function (b) {
                if (!b.ok) { setD({ busy: false, err: b.error || '补配音失败' }); load(); return }
                (b.copied || []).forEach(function (c) { done.push(c) });
                if (b.autoCompleted) {
                  setD({ busy: false, msg: '🔊 「' + task.id + '」配音已复制: ' + done.join(', ') + ' —— 🎉 全部确认+图片配音就位,自动完成并归档!' });
                  load();
                  return;
                }
                step(i + 1);
              }, function (error) { setD({ busy: false, err: error && error.message || String(error) }) });
            };
            step(0);
          },
        });
      };
      var feedbackSubmit = function (task, skill) {
        if (!box.issue.trim()) { setD({ err: '问题描述不能为空' }); return }
        setD({ busy: true, err: '' });
        fetch('/xinyue-kit-api/tasks/feedback', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ taskId: task.id, skill: skill || '', issue: box.issue.trim() }),
        }).then(function (r) { return r.json() }).then(function (fb) {
          if (!fb.ok) throw new Error(fb.error || '记录失败');
          var sendErr = null;
          try {
            var sid = readCurrentSessionId(sessions, uiSession);
            if (sid) {
              var text = [
                '【新月杀工坊·问题反馈】',
                '任务ID: ' + task.id,
                '目标扩展文件夹: ' + task.folder,
                skill ? '问题技能: ' + skill : '',
                '当前轮次: 第 ' + fb.task.rounds + ' 轮',
                '── 问题描述/游戏内表现/报错 ──',
                box.issue.trim(),
                '── 执行要求 ──',
                '目标包是新月杀 Lua 包(packages/<包>/init.lua + skills/<技能ID>.lua):先 xinyue_read_package 读取当前代码(按块只读涉及条目,定位不准先 listBlocks),定位问题并说明原因,修复后 xinyue_validate,校验通过后写入。反馈涉及配音/图片时,注意目录是 audio/skill/、audio/death/、image/generals/、image/card/。修复后调用 xinyue_skills_written,原样带回任务ID ' + task.id + '。',
              ].filter(Boolean).join('\n');
              var binding = sessions.binding(sid);
              if (!binding || !binding.session) {
                sendErr = '反馈已记录,但目标会话已关闭——请打开会话后重试';
              } else {
                Promise.resolve(binding.session.prompt([{ type: 'text', text: text }], 'queue')).catch(function (e) {
                  setD(function (prev) { return Object.assign({}, prev, { err: '反馈已记录,但发送失败: ' + (e && e.message || e) }) });
                });
              }
            } else {
              sendErr = '已记录反馈,但当前没有打开的会话——请打开会话后重试,或把反馈粘贴到对话里';
            }
          } catch (e) { sendErr = '反馈已记录,但发送失败: ' + (e && e.message || e) }
          setD({ busy: false, issue: '', fbFor: null, err: sendErr || '' });
          load();
        }).catch(function (error) { setD({ busy: false, err: error && error.message || String(error) }) });
      };
      var markDone = function (task) {
        // 防呆:缺图或技能未全确认时,手动完成会绕过「缺图不自动完成」的保护——
        // 弹确认把状态亮出来,用户明确选择才放行(不剥夺自由度,只防手滑)
        var skills = Array.isArray(task.skills) ? task.skills : [];
        var confirmed = skills.filter(function (s) { return s.status === 'confirmed' }).length;
        var warn = [];
        if (!task.image && task.type !== 'mode' && !task.target) warn.push('未登记图片');   /* 编辑任务不涉及图片(与浮窗展示逻辑同口径) */
        if (skills.length && confirmed < skills.length) warn.push('技能确认 ' + confirmed + '/' + skills.length);
        if (audioNeed(task)) warn.push('有已登记未交付的配音');
        if (warn.length && !window.confirm('「' + task.id + '」' + warn.join('、') + '。\n确定仍要标记完成并归档吗?')) return;
        fetch('/xinyue-kit-api/tasks/complete', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          /* notes 一起带上:AI 用 xinyue_skills_written 攒的引擎级结论要进历史归档,
           * 此前手动完成只发 taskId/summary,这些结论永远进不了 history.notes(实测) */
          body: JSON.stringify({ taskId: task.id, notes: task.notes || [], summary: task.summary || '手动标记完成' + (skills.length ? '(确认 ' + confirmed + '/' + skills.length + ')' : '') }),
        }).then(function (r) { return r.json() }).then(function (body) {
          if (!body.ok) { setD({ err: body.error || '完成失败' }); return }
          load();
        }, function (error) { setD({ err: error && error.message || String(error) }) });
      };
      var reopenTask = function (task) {
        fetch('/xinyue-kit-api/tasks/reopen', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ taskId: task.id }),
        }).then(function (r) { return r.json() }).then(function (body) {
          if (!body.ok) { setD({ err: body.error || '重开失败' }); return }
          setD({ msg: '🔁 「' + task.id + '」已重开——补图/补配音或重新确认后可再次收口' });
          load();
        }, function (error) { setD({ err: error && error.message || String(error) }) });
      };
      var removeTask = function (task) {
        var msg = '删除任务「' + task.id + '」?\n\n将清除:任务记录、轮次、反馈日志。\n不会删除:已写入的扩展代码、备份文件、历史归档。';
        if (!window.confirm(msg)) return;
        fetch('/xinyue-kit-api/tasks/delete', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ taskId: task.id }),
        }).then(function (r) { return r.json() }).then(function (body) {
          if (!body.ok) { setD({ err: body.error || '删除失败' }); return }
          load();
        }, function (error) { setD({ err: error && error.message || String(error) }) });
      };

      if (box.loading) return e('div', 'nnk-hint', '加载中…');
      var fmt = function (ts) { return new Date(ts).toLocaleString() };
      var open = box.list.filter(function (t) { return t.status === 'open' });
      var done = box.list.filter(function (t) { return t.status !== 'open' });

      /** 任务是否还有已登记未交付的配音(技能级或阵亡语音):决定「🔊 补配音」按钮与提示。 */
      var audioNeed = function (task) {
        var lack = (Array.isArray(task.skills) ? task.skills : []).some(function (s) {
          return s.audios && s.audios.length && (!s.audioFiles || s.audioFiles.length < s.audios.length);
        });
        var dieLack = task.deathAudios && task.deathAudios.length &&
          (!task.deathAudioFiles || task.deathAudioFiles.length < task.deathAudios.length);
        return lack || dieLack;
      };

      var renderRow = function (task, isDoneSection) {
        var expanded = box.expanded === task.id;
        var fbTarget = box.fbFor && box.fbFor.id === task.id ? box.fbFor : null;
        var skills = Array.isArray(task.skills) ? task.skills : [];
        var isModeTask = task.type === 'mode';
        var typeName = isModeTask ? '新玩法' : (task.type === 'card' ? '卡牌' : '武将');
        var confirmedCount = skills.filter(function (s) { return s.status === 'confirmed' }).length;
        var pct = skills.length ? Math.round(confirmedCount * 100 / skills.length) : (task.image || task.target ? 100 : 0);
        return h('div', { key: task.id, className: 'nnk-trow ' + (task.status === 'open' ? 'is-open' : 'is-done') },
          h('div', { className: 'nnk-tr-head' },
            h('i', { className: 'nnk-tr-dot' }),
            h('b', { className: 'nnk-tr-id' }, task.id),
            h('span', { className: 'nnk-tr-kind' }, typeName),
            h('span', { className: 'nnk-tr-time' }, fmt(task.updatedAt))
          ),
          h('div', { className: 'nnk-tr-sub' }, '📂 ' + task.folder + ' · 第 ' + task.rounds + ' 轮'),
          skills.length ? h('div', { className: 'nnk-tr-progress' }, h('i', { style: { width: pct + '%' } })) : null,
          skills.length ? h('div', { className: 'nnk-tr-chips' }, skills.map(function (s, si) {
            return h('span', { key: si, className: 'nnk-tr-chip' + (s.status === 'confirmed' ? ' is-ok' : '') },
              (s.name || '(未命名)') + (s.status === 'confirmed' ? ' ✓' : ''));
          })) : null,
          h('div', { className: 'nnk-tr-meta' },
            (isModeTask ? '规则确认 ' : '技能确认 ') + confirmedCount + '/' + skills.length +
            (isModeTask ? ' · 模式任务:不涉及图片' : (!task.image && !task.target ? ' · 📷 缺图片(不登记图片不会自动完成)' : (!task.image && task.target ? ' · 编辑任务:不涉及图片' : ''))) +
            (audioNeed(task) ? ' · 🔊 缺配音(已登记的配音复制齐才会自动完成)' : '')),
          h('div', { className: 'nnk-tr-actions' },
            h('button', { className: 'nnk-smallbtn', onClick: function () { setD({ expanded: expanded ? null : task.id, fbFor: null, msg: '' }) } }, expanded ? '收起' : (skills.length ? '展开技能树' : '展开')),
            !isDoneSection ? h('button', { className: 'nnk-smallbtn', onClick: function () { setD({ expanded: task.id, fbFor: fbTarget && !fbTarget.skill ? null : { id: task.id, skill: '' }, issue: '', msg: '' }) } }, '🔁 反馈') : null,
            !isDoneSection && !task.image && !isModeTask ? h('button', { className: 'nnk-smallbtn', onClick: function () { addImage(task) } }, '📷 补图') : null,
            !isDoneSection && audioNeed(task) ? h('button', { className: 'nnk-smallbtn', onClick: function () { addAudio(task) } }, '🔊 补配音') : null,
            !isDoneSection ? h('button', { className: 'nnk-smallbtn', onClick: function () { markDone(task) } }, '✅ 标记完成') : null,
            isDoneSection ? h('button', { className: 'nnk-smallbtn', title: '回到进行中:可补图/补配音或重新确认后再次收口', onClick: function () { reopenTask(task) } }, '🔁 重开') : null,
            h('button', { className: 'nnk-smallbtn', onClick: function () { removeTask(task) } }, '🗑 删除')
          ),          expanded && skills.length ? skills.map(function (s, i) {
            var badge = SKILL_BADGE[s.status] || SKILL_BADGE.open;
            return h('div', { key: s.name + '-' + i, className: 'nnk-card', style: { padding: '8px', marginBottom: '4px' } },
              h('div', { style: { display: 'flex', gap: '6px', alignItems: 'center' } },
                h('span', { className: 'nnk-badge ' + badge[0] }, badge[1]),
                h('b', { style: { fontSize: '12px' } }, (i + 1) + '. ' + (s.name || '(未命名)')),
                s.rounds ? e('span', 'nnk-hint', '返工 ' + s.rounds + ' 轮') : null,
                h('span', { style: { flex: '1' } }),
                !isDoneSection && s.status !== 'confirmed' ? h('button', { className: 'nnk-smallbtn', onClick: function () { confirmSkill(task, s.name) } }, '✅ 确认无误') : null,
                !isDoneSection ? h('button', { className: 'nnk-smallbtn', onClick: function () { setD({ expanded: task.id, fbFor: fbTarget && fbTarget.skill === s.name ? null : { id: task.id, skill: s.name }, issue: '', msg: '' }) } }, '🔁 反馈') : null
              ),
              s.desc ? e('div', 'nnk-hint', s.desc.slice(0, 100) + (s.desc.length > 100 ? '…' : '')) : null,
              s.feedbacks && s.feedbacks.length ? s.feedbacks.map(function (f, j) {
                return e('div', 'nnk-fbrow', '第' + (j + 1) + '轮: ' + (f.issue || '').slice(0, 80));
              }) : null
            );
          }) : null,
          expanded && fbTarget && !isDoneSection ? h('div', {},
            e('div', 'nnk-hint', '向' + (fbTarget.skill ? '技能「' + fbTarget.skill + '」' : '任务「' + task.id + '」') + '反馈(记录后自动发给当前会话的 AI):'),
            h('textarea', {
              className: 'nnk-mini', value: box.issue,
              placeholder: '现象 / game.log 输出 / 报错',
              onChange: function (ev) { setD({ issue: ev.target.value }) },
            }),
            h('button', { className: 'nnk-smallbtn', disabled: box.busy, onClick: function () { feedbackSubmit(task, fbTarget.skill) } }, box.busy ? '提交中…' : '提交反馈')
          ) : null,
          expanded && task.feedbacks && task.feedbacks.length
            ? task.feedbacks.map(function (fb, i) {
                // 按提交时间正序编号:第1轮=最初的问题(此前 reverse 后按显示位置编号,
                // 导致最新的反馈被标成第1轮 —— issue #2)
                return e('div', 'nnk-fbrow', '第' + (i + 1) + '轮反馈' + (fb.skill ? '(' + fb.skill + ')' : '') + ': ' + (fb.issue || '').slice(0, 80))
              })
            : null
        );
      };

      return h('div', {},
        box.err ? e('div', 'nnk-err', box.err) : null,
        box.msg ? e('div', 'nnk-ok', box.msg) : null,
        e('div', 'nnk-hint', '🔵 进行中 ' + open.length + ' 个 · ✅ 已完成 ' + done.length + ' 个'),
        open.length ? h('div', {}, open.map(function (task) { return renderRow(task, false) })) : e('div', 'nnk-hint', '没有进行中的任务。在工坊「🛠 任务」页创建一个吧。'),
        done.length ? [
          e('div', 'nnk-label', '已完成'),
          h('div', {}, done.map(function (task) { return renderRow(task, true) }))
        ] : null,
        h(FilePickerModal, { key: 'picker', picker: box.picker, setPicker: setPicker })
      );
    }

    /** 浮窗位置按当前视口钳制:位置存在 localStorage,换机器/换分辨率/缩放窗口后
     *  可能落在屏幕外(实测新机上工坊浮窗右侧/上方被截,"上方内容显示不全")——
     *  渲染时强制收回可视区;双击标题栏可一键复位。 */
    function clampPanelPos(pos, width, height) {
      var vw = window.innerWidth || 1200;
      var vh = window.innerHeight || 800;
      return {
        x: Math.min(Math.max(8, Number(pos.x) || 8), Math.max(8, vw - width - 8)),
        y: Math.min(Math.max(8, Number(pos.y) || 8), Math.max(8, vh - (height || 90) - 8))
      };
    }

    /** 版本/一致性状态:🛠 按钮的红点与 ⚙ 设置页共用一份,避免两处各查一次。
     *  GET /xinyue-kit-api/update 只做本地探测(读 profile 的 package.json + 算
     *  preset 哈希),版本信息取服务端进程内的 6 小时缓存,不发网络请求。 */
    var healthBus = {
      state: { loaded: false, failed: false, update: null, preset: null, updateCheck: true, installForm: null, installHint: null },
      subs: [],
      set: function (next) {
        this.state = Object.assign({}, this.state, next);
        var snapshot = this.state;
        this.subs.forEach(function (f) { f(snapshot) });
      },
      sub: function (f) { var self = this; this.subs.push(f); return function () { self.subs = self.subs.filter(function (x) { return x !== f }) } },
      adopt: function (body) {
        this.set({
          loaded: true, failed: false,
          update: body.check || null,
          preset: body.preset || null,
          updateCheck: body.updateCheck !== false,
          installForm: body.installForm || null,
          installHint: body.installHint || null,
        });
        return body;
      },
      refresh: function () {
        var self = this;
        return fetch('/xinyue-kit-api/update').then(function (r) { return r.json() })
          .then(function (body) { return self.adopt(body) },
            function () { self.set({ loaded: true, failed: true }); return null });
      },
      attentionText: function () {
        var s = this.state;
        if (s.preset && s.preset.state === 'missing') return '「新月杀开发模式」preset 未安装'
        if (s.preset && s.preset.state === 'stale') return 'preset 与插件版本不一致'
        if (s.update && s.update.hasUpdate) return '插件有新版本 v' + s.update.latest
        return ''
      },
    };
    /** 工坊浮窗总线:输入条工坊入口按钮开关(hero 初始屏与任意会话可见)。 */
    var workshopBus = {
      open: false,
      subs: [],
      set: function (v) { this.open = v; this.subs.forEach(function (f) { f(v) }) },
      sub: function (f) { var self = this; this.subs.push(f); return function () { self.subs = self.subs.filter(function (x) { return x !== f }) } },
    };

    /** 侧栏底部按钮:开关任务浮窗(wide=侧栏展开, false=56px 窄轨只显示图标)。 */
    function SidebarTaskButton(props) {
      var openState = React.useState(panelBus.open);
      var isOpen = openState[0], setIsOpen = openState[1];
      React.useEffect(function () { return panelBus.sub(function (v) { setIsOpen(v) }) }, []);
      React.useEffect(function () {
        if (!isOpen) return;
        var onKey = function (ev) { if (ev.key === 'Escape') panelBus.set(false) };
        document.addEventListener('keydown', onKey);
        return function () { document.removeEventListener('keydown', onKey) };
      }, [isOpen]);
      var wide = props && props.wide !== false;
      return h('button', {
        className: 'nnk-smallbtn',
        style: wide ? {} : { fontSize: '16px', padding: '4px' },
        title: '新月杀任务列表',
        onClick: function () { panelBus.set(!panelBus.open) },
      }, wide ? (isOpen ? '📋 关闭任务列表' : '📋 任务列表') : '📋');
    }

    /** 输入条工坊入口:conversation.input.left 是 list 插槽,追加不替换官方件。 */
    function WorkshopChipButton(props) {
      var openState = React.useState(workshopBus.open);
      var isOpen = openState[0], setIsOpen = openState[1];
      var healthState = React.useState(healthBus.state);
      var health = healthState[0], setHealth = healthState[1];
      React.useEffect(function () { return workshopBus.sub(function (v) { setIsOpen(v) }) }, []);
      React.useEffect(function () {
        if (!isOpen) return;
        var onKey = function (ev) { if (ev.key === 'Escape') workshopBus.set(false) };
        document.addEventListener('keydown', onKey);
        return function () { document.removeEventListener('keydown', onKey) };
      }, [isOpen]);
      React.useEffect(function () {
        var off = healthBus.sub(setHealth);
        healthBus.refresh();
        return off;
      }, []);
      var attention = healthBus.attentionText();
      return h('button', {
        type: 'button',
        className: 'nnk-smallbtn',
        style: { margin: '0 6px', whiteSpace: 'nowrap' },
        title: '新月杀工坊:创建任务 / 任务列表 / 历史' + (attention ? '(⚠️ ' + attention + ')' : ''),
        onClick: function () { workshopBus.set(!workshopBus.open) },
      }, isOpen ? '🛠 关闭工坊' : '🛠 工坊', attention ? h('span', { className: 'nnk-dot' }) : null);
    }
    /** 悬浮任务列表:拖动/缩放/最大化,内容复用 TaskListContent。 */
    function TaskPanelWindow(props) {
      var sessions = props && props.sessions;
      var uiSession = props && props.uiSession;
      var openState = React.useState(panelBus.open);
      var isOpen = openState[0], setIsOpen = openState[1];
      var posState = React.useState(function () {
        try { return JSON.parse(localStorage.getItem('dsh-xinyue-kit.panelPos')) || { x: 90, y: 70 } } catch (e) { return { x: 90, y: 70 } }
      });
      var pos = posState[0], setPos = posState[1];
      var sizeState = React.useState(function () {
        try { return JSON.parse(localStorage.getItem('dsh-xinyue-kit.taskPanelSize')) || { w: 380, h: 0 } } catch (e) { return { w: 380, h: 0 } }
      });
      var size = sizeState[0], setSize = sizeState[1];
      var maxState = React.useState(false);
      var maxed = maxState[0], setMaxed = maxState[1];
      var saveSize = function (v) {
        try { localStorage.setItem('dsh-xinyue-kit.taskPanelSize', JSON.stringify(v)) } catch (e) {}
      };
      var startResize = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var box = ev.currentTarget.parentElement.getBoundingClientRect();
        var sx = ev.clientX, sy = ev.clientY, sw = box.width, sh = box.height;
        var move = function (e2) {
          var w = Math.max(360, Math.min((window.innerWidth || 1200) - 16, sw + e2.clientX - sx));
          var ph = Math.max(300, Math.min((window.innerHeight || 800) - 16, sh + e2.clientY - sy));
          setSize({ w: w, h: ph });
          setMaxed(false);
        };
        var up = function () {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          setSize(function (cur) { saveSize(cur); return cur });
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      };
      React.useEffect(function () { return panelBus.sub(function (v) { setIsOpen(v) }) }, []);
      React.useEffect(function () {
        if (!isOpen) return;
        var onKey = function (ev) { if (ev.key === 'Escape') panelBus.set(false) };
        document.addEventListener('keydown', onKey);
        return function () { document.removeEventListener('keydown', onKey) };
      }, [isOpen]);
      var startDrag = function (ev) {
        if (maxed) return;
        var startX = ev.clientX - pos.x, startY = ev.clientY - pos.y;
        var latest = null;
        var move = function (e2) {
          var next = { x: Math.max(0, e2.clientX - startX), y: Math.max(0, e2.clientY - startY) };
          latest = next;
          setPos(next);
        };
        var up = function () {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          try { localStorage.setItem('dsh-xinyue-kit.panelPos', JSON.stringify(latest || pos)) } catch (e) {}
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      };
      if (!isOpen) return null;
      var vw = window.innerWidth || 1200;
      var vh = window.innerHeight || 800;
      var w = Math.min(maxed ? vw - 16 : Math.max(360, size.w || 380), Math.max(320, vw - 16));
      var ph = Math.min(maxed ? vh - 16 : (size.h || Math.min(620, Math.round(vh * 0.8))), Math.max(280, vh - 16));
      var safePos = maxed ? { x: 8, y: 8 } : clampPanelPos(pos, w, ph);
      return h('div', { className: 'nnk-panel nnk-root', style: { left: safePos.x + 'px', top: safePos.y + 'px', width: w + 'px', height: ph + 'px' } },
        h('div', { className: 'nnk-panel-head', onMouseDown: startDrag, onDoubleClick: function () { setMaxed(!maxed) }, title: '拖动移动 · 双击最大化/还原' },
          e('span', 'nnk-panel-title', '📋 任务列表'),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '2px' } },
            h('button', { className: 'nnk-panel-close', title: maxed ? '还原' : '最大化', onMouseDown: function (e) { e.stopPropagation() }, onClick: function () { setMaxed(!maxed) } }, maxed ? '❐' : '⤢'),
            h('button', { className: 'nnk-panel-close', onMouseDown: function (e) { e.stopPropagation() }, onClick: function () { panelBus.set(false) } }, '✕')
          )
        ),
        h('div', { className: 'nnk-panel-body' }, h(TaskListContent, { sessions: sessions, uiSession: uiSession })),
        h('div', { className: 'nnk-rs', onMouseDown: startResize, title: '拖动调整大小' })
      );
    }

    /** 工坊浮窗:可拖动、可缩放、可最大化;任务发进当前会话。 */
    function WorkshopPanelWindow(props) {
      var sessions = props && props.sessions;
      var uiSession = props && props.uiSession;
      var openState = React.useState(workshopBus.open);
      var isOpen = openState[0], setIsOpen = openState[1];
      var posState = React.useState(function () {
        try { return JSON.parse(localStorage.getItem('dsh-xinyue-kit.workshopPanelPos')) || { x: 620, y: 70 } } catch (e) { return { x: 620, y: 70 } }
      });
      var pos = posState[0], setPos = posState[1];
      var sizeState = React.useState(function () {
        try { return JSON.parse(localStorage.getItem('dsh-xinyue-kit.workshopPanelSize')) || { w: 1080, h: 0 } } catch (e) { return { w: 1080, h: 0 } }
      });
      var size = sizeState[0], setSize = sizeState[1];
      var maxState = React.useState(false);
      var maxed = maxState[0], setMaxed = maxState[1];
      var saveSize = function (v) {
        try { localStorage.setItem('dsh-xinyue-kit.workshopPanelSize', JSON.stringify(v)) } catch (e) {}
      };
      var startResize = function (ev) {
        ev.preventDefault();
        ev.stopPropagation();
        var box = ev.currentTarget.parentElement.getBoundingClientRect();
        var sx = ev.clientX, sy = ev.clientY, sw = box.width, sh = box.height;
        var move = function (e2) {
          var w = Math.max(720, Math.min((window.innerWidth || 1200) - 16, sw + e2.clientX - sx));
          var ph = Math.max(420, Math.min((window.innerHeight || 800) - 16, sh + e2.clientY - sy));
          setSize({ w: w, h: ph });
          setMaxed(false);
        };
        var up = function () {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          setSize(function (cur) { saveSize(cur); return cur });
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      };
      React.useEffect(function () { return workshopBus.sub(function (v) { setIsOpen(v) }) }, []);
      React.useEffect(function () {
        if (!isOpen) return;
        var onKey = function (ev) { if (ev.key === 'Escape') workshopBus.set(false) };
        document.addEventListener('keydown', onKey);
        return function () { document.removeEventListener('keydown', onKey) };
      }, [isOpen]);
      var startDrag = function (ev) {
        if (maxed) return;
        var startX = ev.clientX - pos.x, startY = ev.clientY - pos.y;
        var latest = null;
        var move = function (e2) { var next = { x: Math.max(0, e2.clientX - startX), y: Math.max(0, e2.clientY - startY) }; latest = next; setPos(next) };
        var up = function () {
          document.removeEventListener('mousemove', move);
          document.removeEventListener('mouseup', up);
          try { localStorage.setItem('dsh-xinyue-kit.workshopPanelPos', JSON.stringify(latest || pos)) } catch (e) {}
        };
        document.addEventListener('mousemove', move);
        document.addEventListener('mouseup', up);
      };
      if (!isOpen) return null;
      var sid = readCurrentSessionId(sessions, uiSession);
      var vw = window.innerWidth || 1200;
      var vh = window.innerHeight || 800;
      var w = Math.min(maxed ? vw - 16 : Math.max(680, size.w || 1080), Math.max(640, vw - 16));
      var ph = Math.min(maxed ? vh - 16 : (size.h || Math.min(780, Math.round(vh * 0.9))), Math.max(360, vh - 16));
      var safePos = maxed ? { x: 8, y: 8 } : clampPanelPos(pos, w, ph);
      return h('div', { className: 'nnk-panel nnk-root nnk-workshop', style: { left: safePos.x + 'px', top: safePos.y + 'px', width: w + 'px', height: ph + 'px' } },
        h('div', { className: 'nnk-panel-head', onMouseDown: startDrag, onDoubleClick: function () { setMaxed(!maxed) }, title: '拖动移动 · 双击最大化/还原' },
          e('span', 'nnk-panel-title', '🛠 新月杀工坊'),
          h('div', { style: { display: 'flex', alignItems: 'center', gap: '2px' } },
            h('button', { className: 'nnk-panel-close', title: maxed ? '还原' : '最大化', onMouseDown: function (e) { e.stopPropagation() }, onClick: function () { setMaxed(!maxed) } }, maxed ? '❐' : '⤢'),
            h('button', { className: 'nnk-panel-close', onMouseDown: function (e) { e.stopPropagation() }, onClick: function () { workshopBus.set(false) } }, '✕')
          )
        ),
        h('div', { className: 'nnk-panel-body' },
          sid
            ? h(WorkshopView, { sessionId: sid, sessions: sessions, uiSession: uiSession, mode: 'panel' })
            : e('div', 'nnk-hint', '当前没有会话——先新建会话,再用工坊派任务。')
        ),
        h('div', { className: 'nnk-rs', onMouseDown: startResize, title: '拖动调整大小' })
      );
    }
    /** 渲染错误边界:插件任一组件抛错时只在本区域内显示提示,
     *  不让异常冒到 DSH 根节点(否则整页变白,只能重启)。 */
    var KitBoundary = (function () {
      function B(props) {
        React.Component.call(this, props);
        this.state = { err: null };
      }
      B.prototype = Object.create(React.Component.prototype);
      B.prototype.constructor = B;
      B.getDerivedStateFromError = function (err) { return { err: err } };
      B.prototype.render = function () {
        if (this.state.err) {
          var msg = this.state.err && this.state.err.message ? this.state.err.message : String(this.state.err);
          return h('div', { className: 'nnk-hint', style: { color: '#a32b21', padding: '8px' } }, '⚠ 工坊组件渲染失败:' + msg);
        }
        return this.props.children;
      };
      return B;
    })();
    exports.apply = function (ctx) {
      var slots = ctx.get('slots');
      var sessions = ctx.get('sessions');
      // uiSession 容错取:不进 inject——某版缺这个服务时只降级「当前会话」读法,不拖垮插件
      var uiSession = null;
      try { uiSession = ctx.get('uiSession') || null } catch (e) {}

      // 顶部页签(与官方"轨迹"同一插槽,order 排在后面)
      slots.inject('conversation.view', function () {
        return slots.register({
          name: 'conversation.view',
          id: 'xinyue-workshop',
          order: 20,
          label: function () { return '新月杀工坊' },
          inject: function (sessionId) { return { sessionId: sessionId } },
        }, function (props) {
          props = props || {};
          // DSH 布局的侧栏拖宽手柄是透明覆盖层,侵入内容区约 40px(z=8):
          // 工坊内容贴左渲染时,左侧按钮的点击会被它吃掉(现象=点了没反应)。
          // 留出安全边距让内容避开手柄热区;手柄压在空白上,拖拽功能不受影响。
          return React.createElement('div', { style: { paddingLeft: '48px' } },
            React.createElement(KitBoundary, null, React.createElement(WorkshopView, Object.assign({}, props, { sessions: sessions, uiSession: uiSession }))));
        });
      });

      // 工具结果卡片(按工具名认领渲染)
      var card = function (key, component) {
        slots.inject('tool.call.toolview', function () {
          return slots.register({ name: 'tool.call.toolview', key: key }, function (props) {
            return React.createElement(component, props);
          });
        });
      };
      card('xinyue_validate', ValidateCard);
      card('xinyue_write_package', WriteCard);
      card('xinyue_skills_written', CompleteCard);

      // 悬浮任务列表:侧栏按钮开关 + shell 浮层渲染(传 sessions 供浮窗反馈发消息)
      ctx.slots.inject('sidebar.footer.action', function () {
        return ctx.slots.register({ name: 'sidebar.footer.action', id: 'xinyue-kit-tasks', order: 5 }, function (props) {
          return React.createElement(KitBoundary, null, React.createElement(SidebarTaskButton, props));
        });
      });
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({ name: 'shell.overlay', id: 'xinyue-kit-tasks' }, function (props) {
          return React.createElement(KitBoundary, null, React.createElement(TaskPanelWindow, Object.assign({}, props, { sessions: sessions, uiSession: uiSession })));
        });
      });

      // 工坊入口:输入条 list 插槽(hero 初始屏与任意会话都渲染)+ 独立工坊浮层。
      // 纯插件方案,不动 DSH 源码——发布自包含是硬约束。
      ctx.slots.inject('conversation.input.left', function () {
        return ctx.slots.register({ name: 'conversation.input.left', id: 'xinyue-workshop-chip', order: 90 }, function (props) {
          return React.createElement(KitBoundary, null, React.createElement(WorkshopChipButton, props));
        });
      });
      ctx.slots.inject('shell.overlay', function () {
        return ctx.slots.register({ name: 'shell.overlay', id: 'xinyue-kit-workshop' }, function (props) {
          return React.createElement(KitBoundary, null, React.createElement(WorkshopPanelWindow, Object.assign({}, props, { sessions: sessions, uiSession: uiSession })));
        });
      });
    };

    exports.inject = ['slots', 'sessions'];
    return module.exports;
  }
});
