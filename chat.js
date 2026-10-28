/* diluga85 — чат поддержки (виджет для посетителей + вкладки «Чаты» и «Заказы» для админки). */
(function () {
  "use strict";

  /* Адрес серверной функции Yandex Cloud. Пусто — чат на сайте не показывается. */
  var API = "https://functions.yandexcloud.net/d4ecu8kfnf2u2knds0mr";

  var IS_ADMIN = document.body && document.body.hasAttribute("data-admin");
  var TG = "https://t.me/eil_mart0";

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function nl(s) { return esc(s).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>').replace(/\n/g, "<br>"); }
  function ls(k, v) { try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || "null"); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function when(iso) {
    var d = new Date(iso); if (isNaN(d)) return "";
    var t = ("0" + d.getHours()).slice(-2) + ":" + ("0" + d.getMinutes()).slice(-2), n = new Date();
    return d.toDateString() === n.toDateString() ? t : ("0" + d.getDate()).slice(-2) + "." + ("0" + (d.getMonth() + 1)).slice(-2) + " " + t;
  }
  function call(body) {
    if (!API) return Promise.reject(new Error("Чат ещё не подключён"));
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || "Ошибка " + r.status); e.status = r.status; throw e; } return j; }); });
  }
  function goal(g) { try { window.ym && ym(113803023, "reachGoal", g); } catch (e) {} }

  var CSS = [
    ".dlc-btn{position:fixed;right:max(16px,calc(env(safe-area-inset-right,0px) + 16px));bottom:max(16px,calc(env(safe-area-inset-bottom,0px) + 16px));z-index:45;display:flex;align-items:center;gap:8px;border:0;border-radius:999px;padding:12px 18px;background:var(--indigo);color:var(--indigo-ink);font:inherit;font-weight:800;font-size:15px;cursor:pointer;box-shadow:0 10px 30px -10px rgba(0,0,0,.5)}",
    ".dlc-btn svg{width:20px;height:20px}",
    ".dlc-badge{min-width:20px;height:20px;border-radius:10px;background:var(--danger);color:#fff;font-size:12px;display:inline-grid;place-items:center;padding:0 6px}",
    ".dlc-panel{position:fixed;right:max(16px,calc(env(safe-area-inset-right,0px) + 16px));bottom:max(16px,calc(env(safe-area-inset-bottom,0px) + 16px));z-index:46;width:min(380px,calc(100vw - 32px));height:min(560px,calc(100dvh - 32px));background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:18px;display:flex;flex-direction:column;overflow:hidden;box-shadow:0 20px 60px -15px rgba(0,0,0,.55)}",
    ".dlc-h{display:flex;align-items:center;gap:10px;padding:14px 16px;border-bottom:1px solid var(--line)}",
    ".dlc-h b{font-size:16px}.dlc-h small{display:block;color:var(--muted);font-size:12px;font-weight:500}",
    ".dlc-x{margin-left:auto;border:0;background:transparent;font-size:20px;cursor:pointer;color:var(--muted);padding:4px 8px}",
    ".dlc-list{flex:1;overflow:auto;padding:14px;display:flex;flex-direction:column;gap:8px}",
    ".dlc-m{max-width:85%;padding:9px 12px;border-radius:14px;font-size:14px;line-height:1.45;word-wrap:break-word}",
    ".dlc-m time{display:block;font-size:11px;opacity:.65;margin-top:3px}",
    ".dlc-m.me{align-self:flex-end;background:var(--indigo);color:var(--indigo-ink);border-bottom-right-radius:4px}",
    ".dlc-m.them{align-self:flex-start;background:var(--paper);border:1px solid var(--line);border-bottom-left-radius:4px}",
    ".dlc-m a{color:inherit}",
    ".dlc-sys{font-size:13px;color:var(--muted);text-align:center;padding:4px 8px}",
    ".dlc-f{border-top:1px solid var(--line);padding:10px;display:flex;flex-direction:column;gap:8px}",
    ".dlc-f input,.dlc-f textarea{width:100%;border:1.5px solid var(--line);background:var(--paper);color:var(--ink);border-radius:10px;padding:9px 11px;font:inherit;font-size:14px}",
    ".dlc-f textarea{resize:none;min-height:44px;max-height:120px}",
    ".dlc-f input:focus,.dlc-f textarea:focus{outline:none;border-color:var(--indigo)}",
    ".dlc-row{display:flex;gap:8px;align-items:flex-end}",
    ".dlc-send{border:0;border-radius:10px;background:var(--indigo);color:var(--indigo-ink);font-weight:800;padding:10px 14px;cursor:pointer;font:inherit;font-weight:800}",
    ".dlc-send[disabled]{opacity:.5;cursor:default}",
    ".dlc-note{font-size:11px;color:var(--muted);margin:0}.dlc-note a{color:inherit}",
    ".dlc-err{font-size:13px;color:var(--danger);margin:0}",
    ".dlc-hp{position:absolute;left:-9999px;width:1px;height:1px;opacity:0}",
    /* админка */
    ".sup{display:flex;flex-direction:column;gap:12px}",
    ".sup-it{display:block;width:100%;text-align:left;border:1px solid var(--line);background:var(--paper);border-radius:12px;padding:10px 12px;cursor:pointer;font:inherit;color:inherit}",
    ".sup-it .t{display:flex;gap:8px;align-items:center;font-weight:700}.sup-it .t span:last-child{margin-left:auto;font-weight:500;font-size:12px;color:var(--muted)}",
    ".sup-it p{margin:3px 0 0;font-size:13px;color:var(--muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}",
    ".sup-it.closed{opacity:.6}",
    ".sup-msgs{display:flex;flex-direction:column;gap:8px;max-height:52vh;overflow:auto;padding:4px 2px}",
    ".sup-bar{display:flex;gap:8px;align-items:center;flex-wrap:wrap}",
    ".sup-card{border:1px solid var(--line);background:var(--paper);border-radius:12px;padding:12px;font-size:14px}",
    ".sup-card b{font-family:var(--mono)}",
    ".sup-card dl{display:grid;grid-template-columns:auto 1fr;gap:2px 10px;margin:8px 0}",
    ".sup-card dt{color:var(--muted)}.sup-card dd{margin:0;word-break:break-word}",
    ".sup-info{border:1px solid var(--warn);border-radius:12px;padding:10px 12px;font-size:14px}",
    ".tabs .bdg{display:inline-grid;place-items:center;min-width:18px;height:18px;border-radius:9px;background:var(--danger);color:#fff;font-size:11px;margin-left:5px;padding:0 5px}"
  ].join("\n");
  function injectCss() { if (document.getElementById("dlc-css")) return; var s = document.createElement("style"); s.id = "dlc-css"; s.textContent = CSS; document.head.appendChild(s); }

  function msgHtml(m, mine) { return '<div class="dlc-m ' + (mine ? "me" : "them") + '">' + nl(m.text) + "<time>" + esc(when(m.t)) + "</time></div>"; }

  /* =================== Виджет для посетителя =================== */
  function widget() {
    var S = ls("diluga-chat") || {}; // {cid, key, seen}
    var open = false, msgs = [], timer = null, busy = false, root = document.createElement("div");
    document.body.appendChild(root);

    function unread() { return msgs.filter(function (m) { return m.from === "a" && m.t > (S.seenT || "") ; }).length; }
    function markSeen() { var last = msgs.filter(function (m) { return m.from === "a"; }).pop(); if (last) { S.seenT = last.t; ls("diluga-chat", S); } }

    function render() {
      if (!open) {
        var n = unread();
        root.innerHTML = '<button class="dlc-btn" data-dlc="open" aria-label="Открыть чат с поддержкой"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-4.6A8 8 0 1 1 21 12z"/></svg>Чат' + (n ? '<span class="dlc-badge">' + n + "</span>" : "") + "</button>";
        return;
      }
      var first = !S.cid;
      var list = first ? '<div class="dlc-m them">Здравствуйте! Спросите про наличие, размеры, замеры или доставку — ответим здесь.<time></time></div>' :
        msgs.map(function (m) { return msgHtml(m, m.from === "u"); }).join("") + (msgs.length && msgs[msgs.length - 1].from === "u" ? '<div class="dlc-sys">Сообщение отправлено. Ответ появится здесь — обычно в течение часа.</div>' : "");
      root.innerHTML = '<div class="dlc-panel" role="dialog" aria-label="Чат с поддержкой">' +
        '<div class="dlc-h"><div><b>Поддержка diluga85</b><small>Отвечаем здесь или в <a href="' + TG + '" target="_blank" rel="noopener">Telegram</a></small></div><button class="dlc-x" data-dlc="close" aria-label="Закрыть">✕</button></div>' +
        '<div class="dlc-list" id="dlc-list">' + list + "</div>" +
        '<form class="dlc-f" id="dlc-form">' +
        (first ? '<input name="name" maxlength="80" placeholder="Как к вам обращаться" autocomplete="name"><input name="contact" maxlength="160" placeholder="Telegram, телефон или email — чтобы ответить, если уйдёте">' : "") +
        '<input class="dlc-hp" name="website" tabindex="-1" autocomplete="off" aria-hidden="true">' +
        '<div class="dlc-row"><textarea name="text" rows="1" maxlength="2000" placeholder="Сообщение…" required></textarea><button class="dlc-send" type="submit"' + (busy ? " disabled" : "") + '>➤</button></div>' +
        '<p class="dlc-err" id="dlc-err" hidden></p>' +
        (first ? '<p class="dlc-note">Отправляя сообщение, вы соглашаетесь с <a href="privacy.html" target="_blank">политикой обработки данных</a>.</p>' : "") +
        "</form></div>";
      var l = document.getElementById("dlc-list"); l.scrollTop = l.scrollHeight;
      markSeen();
    }

    function poll() {
      if (!S.cid) return Promise.resolve();
      return call({ a: "chat.poll", cid: S.cid, key: S.key }).then(function (r) {
        var changed = r.msgs.length !== msgs.length; msgs = r.msgs;
        if (changed) { var ta = root.querySelector("textarea"), draft = ta ? ta.value : "", foc = ta && document.activeElement === ta; render(); ta = root.querySelector("textarea"); if (ta) { ta.value = draft; if (foc) ta.focus(); } }
      }, function (e) { if (e.status === 404) { S = {}; ls("diluga-chat", null); msgs = []; render(); } });
    }
    function schedule() { clearTimeout(timer); timer = setTimeout(function () { poll().then(schedule, schedule); }, open ? 4000 : 45000); }

    root.addEventListener("click", function (e) {
      var b = e.target.closest("[data-dlc]"); if (!b) return;
      open = b.getAttribute("data-dlc") === "open"; render();
      if (open) { goal("chat_open"); var ta = root.querySelector("textarea"); if (ta) ta.focus(); poll(); }
      schedule();
    });
    root.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey && e.target.name === "text") { e.preventDefault(); root.querySelector("#dlc-form").requestSubmit ? root.querySelector("#dlc-form").requestSubmit() : root.querySelector(".dlc-send").click(); }
    });
    root.addEventListener("input", function (e) { if (e.target.name === "text") { e.target.style.height = "auto"; e.target.style.height = Math.min(120, e.target.scrollHeight) + "px"; } });
    root.addEventListener("submit", function (e) {
      e.preventDefault(); if (busy) return;
      var f = e.target, text = f.text.value.trim(); if (!text) return;
      busy = true; f.querySelector(".dlc-send").disabled = true;
      var body = { a: "chat.send", cid: S.cid, key: S.key, text: text, page: location.pathname + location.search, website: f.website.value };
      if (f.name) { body.name = f.name.value; body.contact = f.contact.value; }
      call(body).then(function (r) {
        if (!S.cid) goal("chat_first_message");
        S.cid = r.id; S.key = r.key || S.key; ls("diluga-chat", S); msgs = r.msgs; busy = false; render();
        var ta = root.querySelector("textarea"); if (ta) ta.focus();
      }, function (err) {
        busy = false; f.querySelector(".dlc-send").disabled = false;
        var el = document.getElementById("dlc-err"); el.hidden = false; el.textContent = (err.message || "Не отправилось") + " Можно написать в Telegram: @eil_mart0";
      });
    });

    render();
    if (S.cid) poll().then(schedule, schedule);
  }

  /* =================== Админка: «Чаты» и «Заказы» =================== */
  var A = { tab: null, el: null, timer: null, badgeTimer: null, chats: null, cur: null, chat: null, drafts: {}, err: "", orders: null, tg: null };
  function akey() { return ls("diluga-sup-key") || ""; }
  function acall(body) { body.adminKey = akey(); return call(body).catch(function (e) { if (e.status === 401) { ls("diluga-sup-key", null); A.err = "Пароль чата не подошёл — введите заново."; draw(); } throw e; }); }

  function mount(tab, el) {
    clearTimeout(A.timer); A.tab = tab; A.el = el || null;
    if (!el) return;
    if (!API) { el.innerHTML = '<div class="sup-info">Сервер чата ещё не подключён: укажите адрес функции в начале файла chat.js.</div>'; return; }
    draw(); refresh();
    pushState().then(function (st) { A.push = st; if (A.tab === "chats" && !A.cur) draw(); });
  }
  function loop(ms) { clearTimeout(A.timer); A.timer = setTimeout(function () { if (A.el && document.body.contains(A.el)) refresh(); }, ms); }
  function refresh() {
    if (!akey()) return draw();
    var p;
    if (A.tab === "orders") p = acall({ a: "admin.orders" }).then(function (r) { A.orders = r.orders; });
    else if (A.cur) p = acall({ a: "admin.chat", cid: A.cur }).then(function (r) { var ch = !A.chat || A.chat.msgs.length !== r.msgs.length || A.chat.id !== r.id; A.chat = r; return ch; });
    else p = acall({ a: "admin.chats" }).then(function (r) { A.chats = r.chats; A.tg = { linked: r.tgLinked, token: r.tgToken, vk: r.vkLinked, vkName: r.vkName, vkToken: r.vkToken }; badge(r.chats); });
    p.then(function (changed) { A.err = ""; if (changed !== false) draw(); loop(A.cur ? 4000 : A.tab === "orders" ? 20000 : 8000); },
      function (e) { A.err = e.message; draw(); loop(15000); });
  }
  function badge(chats) {
    var n = (chats || []).reduce(function (s, c) { return s + (c.closed ? 0 : c.unread || 0); }, 0);
    var t = document.querySelector('.tabs [data-tab="chats"]'); if (!t) return;
    var b = t.querySelector(".bdg"); if (!n) { if (b) b.remove(); return; }
    if (!b) { b = document.createElement("span"); b.className = "bdg"; t.appendChild(b); } b.textContent = n;
  }
  function badgeLoop() {
    clearTimeout(A.badgeTimer);
    if (API && akey() && document.querySelector(".tabs")) acall({ a: "admin.chats" }).then(function (r) { if (A.tab !== "chats") badge(r.chats); }, function () {});
    A.badgeTimer = setTimeout(badgeLoop, 30000);
  }

  /* ---------- пуш-уведомления на устройство ---------- */
  function pushSupported() { return "serviceWorker" in navigator && "PushManager" in window && "Notification" in window; }
  function isIOS() { return /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); }
  function standalone() { return (window.matchMedia && matchMedia("(display-mode: standalone)").matches) || navigator.standalone === true; }
  function idbSet(k, v) {
    return new Promise(function (res) {
      try {
        var r = indexedDB.open("diluga-push", 1);
        r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
        r.onsuccess = function () { var tx = r.result.transaction("kv", "readwrite"); tx.objectStore("kv").put(v, k); tx.oncomplete = function () { res(); }; tx.onerror = function () { res(); }; };
        r.onerror = function () { res(); };
      } catch (e) { res(); }
    });
  }
  function b64ToBytes(s) { s = s.replace(/-/g, "+").replace(/_/g, "/"); while (s.length % 4) s += "="; var b = atob(s), a = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) a[i] = b.charCodeAt(i); return a; }
  function pushState() {
    if (!pushSupported()) return Promise.resolve("unsupported");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    return navigator.serviceWorker.getRegistration("/").then(function (r) { return r ? r.pushManager.getSubscription() : null; })
      .then(function (s) { if (s) idbSet("adminKey", akey()); return s ? "on" : "off"; }, function () { return "off"; });
  }
  function pushEnable() {
    return Notification.requestPermission().then(function (p) {
      if (p !== "granted") throw new Error("Уведомления не разрешены. Разрешите их для сайта diluga85.shop в настройках браузера.");
      return Promise.all([navigator.serviceWorker.register("/sw.js"), acall({ a: "admin.pushkey" })]);
    }).then(function (r) {
      return navigator.serviceWorker.ready.then(function (reg) {
        return reg.pushManager.getSubscription().then(function (old) { return old ? old.unsubscribe() : null; }).then(function () {
          return reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64ToBytes(r[1].key) });
        });
      });
    }).then(function (sub) {
      return Promise.all([idbSet("api", API), idbSet("adminKey", akey())]).then(function () {
        return acall({ a: "admin.pushsub", sub: sub.toJSON(), label: (isIOS() ? "iPhone" : /Android/.test(navigator.userAgent) ? "Android" : "Компьютер") + " · " + new Date().toLocaleDateString("ru-RU") });
      });
    });
  }
  function pushDisable() {
    return navigator.serviceWorker.getRegistration("/").then(function (r) { return r ? r.pushManager.getSubscription() : null; }).then(function (s) {
      if (!s) return; var ep = s.endpoint; return s.unsubscribe().then(function () { return acall({ a: "admin.pushunsub", endpoint: ep }); });
    });
  }
  function pushBlock() {
    var st = A.push;
    if (!st) return "";
    if (st === "unsupported") return '<div class="sup-info">' + (isIOS() && !standalone() ?
      "Уведомления на iPhone работают только из приложения: в Safari нажмите «Поделиться» → «На экран „Домой“», откройте админку с этой иконки, войдите и включите уведомления здесь." :
      "Этот браузер не умеет показывать уведомления. Откройте админку в Chrome, Яндекс Браузере или Safari (на iPhone — с экрана «Домой»).") + "</div>";
    if (st === "denied") return '<div class="sup-info">Уведомления запрещены для diluga85.shop в настройках браузера. Разрешите их и обновите страницу.</div>';
    if (st === "on") return '<p class="hint">Уведомления на этом устройстве включены · <button class="btn btn-ghost btn-sm" data-sup="pushtest">Проверить</button> <button class="btn btn-ghost btn-sm" data-sup="pushoff">Отключить</button></p>';
    if (st === "busy") return '<p class="hint">Подключаю уведомления…</p>';
    return '<div class="sup-info">Включите уведомления, чтобы сразу узнавать о новых сообщениях и заявках. <button class="btn btn-primary btn-sm" data-sup="pushon">Включить на этом устройстве</button>' +
      (isIOS() ? "" : '<br><span class="hint">Совет: установите админку на телефон (меню браузера → «Добавить на главный экран») — так уведомления приходят надёжнее.</span>') + "</div>";
  }

  function draw() {
    var el = A.el; if (!el || !document.body.contains(el)) return;
    var ta = el.querySelector("textarea[data-sup-draft]"); if (ta && A.cur) A.drafts[A.cur] = ta.value;
    var foc = ta && document.activeElement === ta;
    var err = A.err ? '<p class="msg err">' + esc(A.err) + "</p>" : "";
    if (!akey()) {
      el.innerHTML = '<form class="sup" data-sup-login><div class="sup-info">Введите пароль чата (ADMIN_KEY из настроек функции). Он сохранится только в этом браузере.</div>' + err +
        '<div class="fld"><label for="sup-pass">Пароль чата</label><input id="sup-pass" name="pass" type="password" autocomplete="current-password" required></div><button class="btn btn-primary" type="submit">Войти</button></form>';
      return;
    }
    if (A.tab === "orders") { el.innerHTML = '<div class="sup">' + err + ordersHtml() + "</div>"; return; }
    if (A.cur) {
      var c = A.chat && A.chat.id === A.cur ? A.chat : null;
      el.innerHTML = '<div class="sup"><div class="sup-bar"><button class="btn btn-ghost btn-sm" data-sup="back">← Все чаты</button>' +
        (c ? '<button class="btn btn-ghost btn-sm" data-sup="close">' + (c.closed ? "Открыть снова" : "Закрыть чат") + "</button>" : "") + "</div>" + err +
        (c ? '<div class="sup-card"><b>' + esc(c.name || "Без имени") + "</b>" + (c.contact ? "<div>" + nl(c.contact) + "</div>" : "") + '<div class="hint">Начат ' + esc(when(c.created)) + (c.page ? " · стр. " + esc(c.page) : "") + "</div></div>" +
          '<div class="sup-msgs" id="sup-msgs">' + c.msgs.map(function (m) { return msgHtml(m, m.from === "a"); }).join("") + "</div>" +
          '<form class="sup" data-sup-reply><div class="fld"><label for="sup-text">Ответ</label><textarea id="sup-text" data-sup-draft rows="3" maxlength="2000" required placeholder="Ctrl+Enter — отправить"></textarea></div><button class="btn btn-primary" type="submit">Отправить</button></form>'
          : '<p class="hint">Загружаю…</p>') + "</div>";
      var box = el.querySelector("#sup-msgs"); if (box) box.scrollTop = box.scrollHeight;
      var t2 = el.querySelector("textarea[data-sup-draft]"); if (t2) { t2.value = A.drafts[A.cur] || ""; if (foc) t2.focus(); }
      return;
    }
    var tg = pushBlock() + (A.tg && A.tg.vkToken ? (A.tg.vk ? '<p class="hint">Уведомления ВКонтакте: ' + esc(A.tg.vkName || "подключены") + ' · <button class="btn btn-ghost btn-sm" data-sup="vklink">Переподключить</button></p>' :
      '<div class="sup-info">Уведомления ВКонтакте не подключены. Напишите своему сообществу ВК любое сообщение, затем <button class="btn btn-ghost btn-sm" data-sup="vklink">Подключить</button></div>') : "");
    var list = A.chats == null ? '<p class="hint">Загружаю…</p>' : !A.chats.length ? '<p class="hint">Пока никто не писал. Кнопка «Чат» есть внизу справа на каждой странице сайта.</p>' :
      A.chats.map(function (c) {
        return '<button class="sup-it' + (c.closed ? " closed" : "") + '" data-sup-open="' + esc(c.id) + '"><span class="t"><span>' + esc(c.name || "Без имени") + "</span>" + (c.unread ? '<span class="dlc-badge">' + c.unread + "</span>" : "") + "<span>" + esc(when(c.updated)) + "</span></span>" +
          "<p>" + (c.lastFrom === "a" ? "Вы: " : "") + esc(c.last) + "</p>" + (c.contact ? "<p>" + esc(c.contact) + "</p>" : "") + "</button>";
      }).join("");
    el.innerHTML = '<div class="sup">' + tg + err + list + '<button class="btn btn-ghost btn-sm" data-sup="logout" style="align-self:flex-start">Выйти из чатов</button></div>';
  }

  var ST = { new: "Новый", paid: "Оплата получена", sent: "Отправлен", cancel: "Отменён" };
  function ordersHtml() {
    if (A.orders == null) return '<p class="hint">Загружаю…</p>';
    if (!A.orders.length) return '<p class="hint">Пока нет заказов. Здесь появятся контакты, которые покупатели оставляют на странице оплаты.</p>';
    return '<p class="hint">Сверяйте поступление по назначению платежа «Заказ D…», затем меняйте статус.</p>' + A.orders.map(function (o) {
      return '<div class="sup-card"><div class="sup-bar"><b>' + esc(o.no) + "</b><span>" + esc(o.sum) + " ₽</span><span class=\"hint\" style=\"margin-left:auto\">" + esc(when(o.created)) + "</span></div>" +
        (o.items ? "<div>" + esc(o.items) + "</div>" : "") +
        "<dl>" + [["Имя", o.name], [o.method || "Контакт", o.contact], ["Адрес", o.address], ["Комментарий", o.comment]].filter(function (r) { return r[1]; }).map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + nl(r[1]) + "</dd>"; }).join("") + "</dl>" +
        '<select data-sup-order="' + esc(o.no) + '" aria-label="Статус заказа">' + Object.keys(ST).map(function (k) { return '<option value="' + k + '"' + (o.status === k ? " selected" : "") + ">" + ST[k] + "</option>"; }).join("") + "</select></div>";
    }).join("");
  }

  function adminEvents() {
    document.addEventListener("click", function (e) {
      var t = e.target.closest("[data-sup],[data-sup-open]"); if (!t || !A.el || !A.el.contains(t)) return;
      var act = t.getAttribute("data-sup"), id = t.getAttribute("data-sup-open");
      if (id) { A.cur = id; A.chat = null; draw(); refresh(); setTimeout(function () { acall({ a: "admin.chats" }).then(function (r) { A.chats = r.chats; badge(r.chats); }, function () {}); }, 1500); return; }
      if (act === "back") { A.cur = null; A.chat = null; try { history.replaceState(null, "", location.pathname); } catch (x) {} draw(); refresh(); }
      else if (act === "close") acall({ a: "admin.close", cid: A.cur }).then(refresh, function (x) { A.err = x.message; draw(); });
      else if (act === "logout") { ls("diluga-sup-key", null); A.chats = null; draw(); }
      else if (act === "pushon") { A.push = "busy"; draw(); pushEnable().then(function () { A.push = "on"; A.err = ""; draw(); }, function (x) { A.err = /[а-яё]/i.test(x.message || "") ? x.message : "Не получилось включить уведомления" + (x.message ? " (" + x.message + ")" : "") + ". На iPhone — только из приложения на экране «Домой»; на Android — в Chrome или Яндекс Браузере."; pushState().then(function (st) { A.push = st; draw(); }); }); }
      else if (act === "pushoff") { pushDisable().then(function () { A.push = "off"; draw(); }, function (x) { A.err = x.message; draw(); }); }
      else if (act === "pushtest") { t.disabled = true; t.textContent = "Отправляю…"; acall({ a: "admin.pushtest" }).then(function () { t.textContent = "Отправлено"; }, function (x) { A.err = x.message; draw(); }); }
      else if (act === "vklink") { t.disabled = true; t.textContent = "Подключаю…"; acall({ a: "admin.vklink" }).then(function () { A.err = ""; refresh(); }, function (x) { A.err = x.message; draw(); }); }
      else if (act === "tglink") { t.disabled = true; acall({ a: "admin.tglink" }).then(function () { A.err = ""; refresh(); }, function (x) { A.err = x.message; draw(); }); }
    });
    document.addEventListener("submit", function (e) {
      var f = e.target;
      if (f.hasAttribute("data-sup-login")) {
        e.preventDefault(); ls("diluga-sup-key", f.pass.value.trim());
        acall({ a: "admin.check" }).then(function () { A.err = ""; draw(); refresh(); badgeLoop(); pushState().then(function (st) { A.push = st; draw(); }); }, function () {});
      } else if (f.hasAttribute("data-sup-reply")) {
        e.preventDefault();
        var ta = f.querySelector("textarea"), text = ta.value.trim(); if (!text) return;
        f.querySelector("button").disabled = true;
        acall({ a: "admin.reply", cid: A.cur, text: text }).then(function (r) { A.drafts[A.cur] = ""; ta.value = ""; A.chat.msgs = r.msgs; draw(); var t2 = A.el.querySelector("textarea"); if (t2) t2.focus(); },
          function (x) { A.err = x.message; f.querySelector("button").disabled = false; draw(); });
      }
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && e.target.hasAttribute && e.target.hasAttribute("data-sup-draft")) { e.preventDefault(); var f = e.target.form; if (f) f.requestSubmit ? f.requestSubmit() : f.querySelector("button").click(); }
    });
    document.addEventListener("input", function (e) { if (e.target.hasAttribute && e.target.hasAttribute("data-sup-draft") && A.cur) A.drafts[A.cur] = e.target.value; });
    document.addEventListener("change", function (e) {
      var no = e.target.getAttribute && e.target.getAttribute("data-sup-order"); if (!no) return;
      acall({ a: "admin.order", no: no, status: e.target.value }).then(function () { A.orders.forEach(function (o) { if (o.no === no) o.status = e.target.value; }); }, function (x) { A.err = x.message; draw(); });
    });
  }

  /* Открыть нужное по ссылке из уведомления: admin.html#chat=ID или #orders */
  function hashTab() {
    var h = location.hash || "";
    var m = /^#chat=([a-z0-9]+)/.exec(h); if (m) { A.cur = m[1]; return "chats"; }
    if (h === "#orders") return "orders";
    if (h === "#chats") return "chats";
    return null;
  }

  window.DilugaSupport = { mount: mount, hashTab: hashTab, badgeLoop: badgeLoop, api: function () { return API; }, call: call };

  injectCss();
  if (IS_ADMIN) adminEvents();
  else if (API) widget();
})();
