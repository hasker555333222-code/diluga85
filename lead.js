/* diluga85 — заявки на вещи, рекламные метки и цели Метрики.
 * Подключается на главной, на страницах вещей и на странице оплаты.
 *
 * Цели (идентификаторы для «JavaScript-событие» в Метрике):
 *   item_view      — открыта карточка или страница вещи
 *   tg_buy_click   — нажата кнопка перехода в Telegram с товаром (это НЕ отправленное сообщение)
 *   order_copy     — скопирован текст заявки
 *   pay_qr_open    — открыта страница QR-оплаты (ставится в pay.html)
 *   pay_claimed    — покупатель нажал «Я оплатил» / оставил контакты после оплаты (это НЕ подтверждённая оплата)
 *   lead_sent      — сервер принял заявку (только после ответа сервера)
 *   payment_confirmed — с сайта НЕ отправляется. Загружается в Метрику офлайн-конверсией из админки
 *                       после того, как продавец сам сверил поступление денег.
 * В параметры целей передаются только данные о вещи. Имя, телефон и Telegram покупателя в Метрику не уходят.
 */
(function () {
  "use strict";
  var API = "https://functions.yandexcloud.net/d4ecu8kfnf2u2knds0mr"; // тот же адрес, что в chat.js
  var MID = 113803023;
  var ATTR_KEYS = ["utm_source", "utm_medium", "utm_campaign", "utm_content", "utm_term", "yclid"];
  var ATTR_TTL = 30 * 864e5;

  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function lsGet(k) { try { return JSON.parse(localStorage.getItem(k) || "null"); } catch (e) { return null; } }
  function lsSet(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  function rid() { var a = "abcdefghijkmnpqrstuvwxyz23456789", s = ""; for (var i = 0; i < 16; i++) s += a[Math.floor(Math.random() * a.length)]; return s; }

  /* ---------- рекламные метки: последнее касание, хранится 30 дней ---------- */
  function captureAttr() {
    var q = {}; try { new URLSearchParams(location.search).forEach(function (v, k) { q[k] = v; }); } catch (e) { return; }
    var a = {}, any = false;
    ATTR_KEYS.forEach(function (k) { if (q[k]) { a[k] = String(q[k]).slice(0, 200); any = true; } });
    if (!any) return;
    a.landing = (location.pathname + location.search).slice(0, 300); a.ts = Date.now();
    lsSet("dl-attr", a);
  }
  function attr() { var a = lsGet("dl-attr"); if (!a || !a.ts || Date.now() - a.ts > ATTR_TTL) return {}; var o = {}; ATTR_KEYS.concat(["landing"]).forEach(function (k) { if (a[k]) o[k] = a[k]; }); return o; }
  var clientId = "";
  function loadClientId() { try { if (typeof window.ym === "function") window.ym(MID, "getClientID", function (id) { clientId = String(id || ""); }); } catch (e) {} }

  /* ---------- цели Метрики ---------- */
  var PARAM_KEYS = ["item_id", "category", "price", "status", "place"];
  function goal(name, params) {
    var p = {}; if (params) PARAM_KEYS.forEach(function (k) { if (params[k] !== undefined && params[k] !== "") p[k] = params[k]; });
    try { if (typeof window.ym === "function") window.ym(MID, "reachGoal", name, p); } catch (e) {}
  }
  function itemParams(it) { return it ? { item_id: it.id, category: it.category || undefined, price: +it.price || undefined, status: it.status } : {}; }
  function ecomDetail(it) { try { window.dataLayer = window.dataLayer || []; window.dataLayer.push({ ecommerce: { currencyCode: "RUB", detail: { products: [{ id: it.id, name: it.title, category: it.category || undefined, variant: it.size || undefined, price: +it.price || 0, quantity: 1 }] } } }); } catch (e) {} }
  var viewed = {};
  function itemView(it, place) { if (!it || !it.id) return; var k = it.id + "|" + location.pathname; if (viewed[k]) return; viewed[k] = 1; goal("item_view", Object.assign(itemParams(it), { place: place })); if (it.status !== "sold") ecomDetail(it); }

  /* ---------- копирование ---------- */
  function copyText(text) {
    return new Promise(function (res, rej) {
      function fallback() {
        try { var ta = document.createElement("textarea"); ta.value = text; ta.setAttribute("readonly", ""); ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); var ok = document.execCommand("copy"); document.body.removeChild(ta); ok ? res() : rej(); } catch (e) { rej(); }
      }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(res, fallback); else fallback();
    });
  }

  /* ---------- отправка заявки ---------- */
  function post(body) {
    var ac = typeof AbortController !== "undefined" ? new AbortController() : null, t = ac ? setTimeout(function () { ac.abort(); }, 15000) : 0;
    return fetch(API, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: ac ? ac.signal : undefined })
      .then(function (r) {
        clearTimeout(t);
        return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) { var e = new Error(j.error || "Ошибка сервера (" + r.status + ")"); e.status = r.status; throw e; } return j; });
      }, function (e) { clearTimeout(t); var x = new Error(e && e.name === "AbortError" ? "Сервер не ответил вовремя" : "Нет связи с сервером"); x.network = true; throw x; });
  }
  /* Если на сервере ещё старая версия функции без lead.create — доставляем заявку через уже работающий чат поддержки. */
  function sendLead(body) {
    return post(body).catch(function (e) {
      if (e.status !== 400 || !/Неизвестное действие/.test(e.message)) throw e;
      var it = body.item, a = body.attr || {};
      var text = "ЗАЯВКА С САЙТА\n" + it.title + (it.size ? ", размер " + it.size : "") + (it.price ? ", " + it.price + " ₽" : "") + "\nАртикул: " + it.id + "\n" + it.url +
        "\n" + (body.method === "phone" ? "Телефон: " : "Telegram: ") + body.contact + (body.name ? "\nИмя: " + body.name : "") +
        (a.utm_source || a.yclid ? "\nИсточник: " + [a.utm_source, a.utm_campaign, a.yclid ? "yclid " + a.yclid : ""].filter(Boolean).join(" / ") : "");
      return post({ a: "chat.send", text: text, name: body.name, contact: body.contact, page: it.url, website: body.website }).then(function () { return { ok: true, id: "", via: "chat" }; });
    });
  }

  function validContact(method, v) {
    v = String(v || "").trim();
    if (method === "phone") { var n = v.replace(/\D/g, ""); return n.length >= 10 && n.length <= 15; }
    return /^(?:https?:\/\/)?(?:t\.me\/|telegram\.me\/)?@?[A-Za-z][A-Za-z0-9_]{3,31}\/?$/.test(v.replace(/\s+/g, ""));
  }
  function itemOf(form) { try { return JSON.parse(form.getAttribute("data-item") || "{}"); } catch (e) { return {}; } }
  function sentKey(id) { return "dl-lead-" + id; }

  function setMethod(form, m) {
    var inp = form.querySelector('[name="contact"]'); if (!inp) return;
    if (m === "phone") { inp.type = "tel"; inp.setAttribute("inputmode", "tel"); inp.setAttribute("autocomplete", "tel"); inp.placeholder = "+7 900 000-00-00"; }
    else { inp.type = "text"; inp.setAttribute("inputmode", "text"); inp.setAttribute("autocomplete", "off"); inp.placeholder = "@username"; }
    var lb = form.querySelector("[data-contact-label]"); if (lb) lb.textContent = m === "phone" ? "Телефон" : "Ник в Telegram";
  }
  function msg(form, text, kind) { var m = form.querySelector("[data-lead-msg]"); if (m) { m.textContent = text; m.className = "lead-msg" + (kind ? " " + kind : ""); } }

  function initForms(root) {
    (root || document).querySelectorAll("form[data-lead-form]").forEach(function (f) {
      if (f.__init) return; f.__init = 1; f.__t0 = Date.now(); f.__rid = rid();
      var it = itemOf(f), done = lsGet(sentKey(it.id));
      if (done && Date.now() - done.t < 7 * 864e5) showDone(f, done.id, done.method, true);
      var r = f.querySelector('[name="method"]:checked'); setMethod(f, r ? r.value : "telegram");
    });
  }
  function showDone(form, id, method, earlier) {
    var box = document.createElement("div"); box.className = "lead-ok"; box.setAttribute("role", "status");
    box.innerHTML = "<b>" + (earlier ? "Вы уже оставляли заявку на эту вещь" : "Заявка принята") + (id ? " · №" + esc(id) : "") + "</b>" +
      "<span>Продавец проверит наличие и напишет вам " + (method === "phone" ? "по указанному номеру" : "в Telegram") + ". Если передумаете или появится вопрос — напишите в Telegram.</span>" +
      (earlier ? '<button type="button" class="lead-again" data-lead-again>Отправить ещё одну заявку</button>' : "");
    form.hidden = true; form.parentNode.insertBefore(box, form);
  }

  document.addEventListener("change", function (e) {
    var t = e.target; if (t.name === "method" && t.form && t.form.hasAttribute("data-lead-form")) { setMethod(t.form, t.value); var c = t.form.querySelector('[name="contact"]'); if (c) c.focus(); }
  });
  document.addEventListener("submit", function (e) {
    var f = e.target; if (!f.hasAttribute || !f.hasAttribute("data-lead-form")) return;
    e.preventDefault();
    if (f.__busy) return;
    initForms(f.parentNode);
    var it = itemOf(f), method = (f.querySelector('[name="method"]:checked') || {}).value || "telegram";
    var E = f.elements, contact = (E["contact"].value || "").trim(), btn = f.querySelector('button[type="submit"]');
    if (!contact) { msg(f, method === "phone" ? "Укажите номер телефона" : "Укажите ник в Telegram", "err"); E["contact"].focus(); return; }
    if (!validContact(method, contact)) { msg(f, method === "phone" ? "Проверьте номер: нужно 10–11 цифр, например +7 900 000-00-00" : "Проверьте ник: латиница, цифры и _, например @username", "err"); E["contact"].focus(); return; }
    if (E["consent"] && !E["consent"].checked) { msg(f, "Отметьте согласие на обработку данных — без него не сможем связаться", "err"); return; }
    f.__busy = true; if (btn) { btn.disabled = true; btn.setAttribute("aria-busy", "true"); btn.__txt = btn.textContent; btn.textContent = "Отправляю…"; }
    msg(f, "Отправляю заявку…");
    var body = { a: "lead.create", rid: f.__rid, ft: Date.now() - (f.__t0 || Date.now()), item: it, name: (E["name"] && E["name"].value || "").trim(), method: method, contact: contact,
      consent: E["consent"] ? E["consent"].checked : true, website: E["website"] ? E["website"].value : "", attr: attr(), cid: clientId, page: (location.pathname + location.search).slice(0, 200) };
    sendLead(body).then(function (r) {
      if (!r || r.ok !== true) throw new Error("Сервер не подтвердил приём");
      goal("lead_sent", itemParams(it));
      lsSet(sentKey(it.id), { t: Date.now(), id: r.id || "", method: method });
      f.__busy = false; showDone(f, r.id, method, false);
    }, function (err) {
      f.__busy = false; if (btn) { btn.disabled = false; btn.removeAttribute("aria-busy"); btn.textContent = btn.__txt || "Отправить заявку"; }
      msg(f, (err.status === 429 ? "Слишком много заявок подряд. Подождите немного или напишите в Telegram." : (err.message || "Не отправилось") + ". Заявка не доставлена — попробуйте ещё раз или напишите в Telegram (кнопка ниже)."), "err");
    });
  });

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target : null; if (!t) return;
    var again = t.closest("[data-lead-again]");
    if (again) { var box = again.closest(".lead-ok"), f = box && box.nextElementSibling; if (f && f.hasAttribute("data-lead-form")) { f.hidden = false; f.__rid = rid(); f.__t0 = Date.now(); box.remove(); var c = f.querySelector('[name="contact"]'); if (c) c.focus(); } return; }
    var go = t.closest("[data-order-go]");
    if (go) {
      var scope = go.closest("[data-item-scope]") || document, form = scope.querySelector("form[data-lead-form]"), ok = scope.querySelector(".lead-ok");
      var target = form && !form.hidden ? form : ok;
      if (target) { e.preventDefault(); target.scrollIntoView({ behavior: "smooth", block: "center" }); var c2 = form && !form.hidden && form.querySelector('[name="contact"]'); if (c2) setTimeout(function () { try { c2.focus({ preventScroll: true }); } catch (x) { c2.focus(); } }, 350); }
      return;
    }
    var cp = t.closest("[data-copy-req]");
    if (cp) {
      e.preventDefault();
      var text = cp.getAttribute("data-copy-req"), note = (cp.closest("[data-item-scope]") || document).querySelector("[data-copy-note]");
      goal("order_copy", itemParams(itemOf(cp)));
      copyText(text).then(function () { if (note) note.textContent = "Скопировано. Вставьте текст в сообщение продавцу."; }, function () { if (note) note.textContent = text; });
      return;
    }
    var g = t.closest("[data-goal]");
    if (g) goal(g.getAttribute("data-goal"), itemParams(g.hasAttribute("data-item") ? itemOf(g) : null));
  });

  captureAttr();
  loadClientId();
  window.DilugaLead = { goal: goal, itemView: itemView, initForms: initForms, attr: attr, clientId: function () { return clientId; } };
  function boot() {
    initForms(document);
    var bar = document.querySelector(".buybar"), ord = document.getElementById("order");
    if (bar && ord && typeof IntersectionObserver !== "undefined") new IntersectionObserver(function (es) { bar.classList.toggle("hide", es[0].isIntersecting); }).observe(ord);
    var el = document.getElementById("item-data");
    if (el) { try { itemView(JSON.parse(el.textContent), "page"); } catch (e) {} }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot); else boot();
})();
