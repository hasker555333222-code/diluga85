/*
 * diluga85 — сервер чата поддержки и контактов после оплаты.
 * Yandex Cloud Functions, Node.js 18+. Хранилище — бакет Object Storage (доступ через сервисный аккаунт функции).
 *
 * Переменные окружения:
 *   BUCKET             имя бакета, например diluga85-chat
 *   ADMIN_KEY          пароль для вкладок «Чаты» и «Заказы» в админке
 *   TG_BOT_TOKEN       токен Telegram-бота для уведомлений (необязательно)
 *   TG_ADMIN_USERNAME  ник, которому бот шлёт уведомления (по умолчанию eil_mart0)
 *   SITE_URL           https://diluga85.shop
 */
"use strict";

var SITE = (process.env.SITE_URL || "https://diluga85.shop").replace(/\/$/, "");
var ORIGINS = [SITE, SITE.replace("://", "://www."), "http://localhost:8765"];
var LIM = { text: 2000, name: 80, contact: 160, comment: 600, msgs: 300 };

/* ---------- хранилище ---------- */
var store = null; // { get(key) -> obj|null, put(key, obj) }
function s3Store(bucket, token) {
  var base = "https://storage.yandexcloud.net/" + encodeURIComponent(bucket) + "/";
  function hdr(extra) { var h = { "X-YaCloud-SubjectToken": token }; for (var k in extra || {}) h[k] = extra[k]; return h; }
  return {
    get: function (key) {
      return fetch(base + key, { headers: hdr() }).then(function (r) {
        if (r.status === 404) return null;
        if (!r.ok) return r.text().then(function (t) { throw new Error("storage get " + r.status + " " + t.slice(0, 200)); });
        return r.json();
      });
    },
    put: function (key, obj) {
      return fetch(base + key, { method: "PUT", headers: hdr({ "Content-Type": "application/json" }), body: JSON.stringify(obj) }).then(function (r) {
        if (!r.ok) return r.text().then(function (t) { throw new Error("storage put " + r.status + " " + t.slice(0, 200)); });
      });
    }
  };
}

/* ---------- утилиты ---------- */
function rnd(n) { var a = "abcdefghijkmnpqrstuvwxyz23456789", s = ""; var b = require("crypto").randomBytes(n); for (var i = 0; i < n; i++) s += a[b[i] % a.length]; return s; }
function str(v, max) { return String(v == null ? "" : v).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim().slice(0, max); }
function now() { return new Date().toISOString(); }
function same(a, b) { a = String(a || ""); b = String(b || ""); if (!a || a.length !== b.length) return false; var d = 0; for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0; }
function fail(code, msg) { var e = new Error(msg); e.code = code; throw e; }

var hits = {}; // простое ограничение частоты в рамках экземпляра функции
function limit(ip, kind, max, perMs) {
  var k = kind + ":" + ip, t = Date.now(), h = (hits[k] || []).filter(function (x) { return t - x < perMs; });
  if (h.length >= max) fail(429, "Слишком часто. Попробуйте через минуту.");
  h.push(t); hits[k] = h;
}

/* ---------- Telegram ---------- */
function tg(method, body) {
  var token = process.env.TG_BOT_TOKEN; if (!token) return Promise.resolve(null);
  return fetch("https://api.telegram.org/bot" + token + "/" + method, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body || {}) })
    .then(function (r) { return r.json(); }).catch(function () { return null; });
}
function notify(text) {
  return store.get("config.json").then(function (cfg) {
    if (!cfg || !cfg.tgChatId) return;
    return tg("sendMessage", { chat_id: cfg.tgChatId, text: text, disable_web_page_preview: true });
  }).catch(function () {});
}
function linkTelegram() {
  var want = String(process.env.TG_ADMIN_USERNAME || "eil_mart0").replace(/^@/, "").toLowerCase();
  if (!process.env.TG_BOT_TOKEN) fail(400, "В настройках функции не указан TG_BOT_TOKEN.");
  return tg("getUpdates", { limit: 100 }).then(function (r) {
    var chat = null;
    ((r && r.result) || []).forEach(function (u) { var m = u.message || u.edited_message; if (m && m.chat && m.from && String(m.from.username || "").toLowerCase() === want) chat = m.chat; });
    if (!chat) fail(404, "Бот не видит сообщений от @" + want + ". Откройте бота в Telegram, нажмите «Старт» и повторите.");
    return store.get("config.json").then(function (cfg) {
      cfg = cfg || {}; cfg.tgChatId = chat.id;
      return store.put("config.json", cfg);
    }).then(function () {
      return tg("sendMessage", { chat_id: chat.id, text: "Готово: сюда будут приходить уведомления о сообщениях в чате и оплатах с сайта diluga85." });
    }).then(function () { return { ok: true }; });
  });
}

/* ---------- чаты ---------- */
function pub(chat) { return { id: chat.id, msgs: chat.msgs.map(function (m) { return { t: m.t, from: m.from, text: m.text }; }) }; }
function summary(chat) {
  var last = chat.msgs[chat.msgs.length - 1] || {};
  return { id: chat.id, name: chat.name, contact: chat.contact, page: chat.page, created: chat.created, updated: chat.updated, last: str(last.text, 140), lastFrom: last.from, unread: chat.unread || 0, closed: !!chat.closed };
}
function saveChat(chat) {
  return store.put("chats/" + chat.id + ".json", chat).then(function () {
    return store.get("chats-index.json");
  }).then(function (idx) {
    idx = idx || { chats: {} }; idx.chats[chat.id] = summary(chat);
    return store.put("chats-index.json", idx);
  });
}
function loadVisitorChat(b) {
  var id = str(b.cid, 20);
  if (!/^[a-z0-9]{10,20}$/.test(id)) fail(404, "Чат не найден");
  return store.get("chats/" + id + ".json").then(function (c) {
    if (!c || !same(c.key, b.key)) fail(404, "Чат не найден");
    return c;
  });
}

var actions = {
  /* посетитель */
  "chat.send": function (b, ip) {
    var text = str(b.text, LIM.text); if (!text) fail(400, "Пустое сообщение");
    if (b.website) fail(400, "Ошибка"); // ловушка для ботов
    limit(ip, "msg", 20, 60000);
    var isNew = !b.cid;
    var p = isNew ? (limit(ip, "newchat", 5, 3600000), Promise.resolve({ id: rnd(14), key: rnd(24), created: now(), msgs: [], unread: 0 })) : loadVisitorChat(b);
    return p.then(function (chat) {
      if (chat.msgs.length >= LIM.msgs) fail(400, "Чат переполнен. Напишите нам в Telegram.");
      if (b.name) chat.name = str(b.name, LIM.name);
      if (b.contact) chat.contact = str(b.contact, LIM.contact);
      if (b.page) chat.page = str(b.page, 200);
      chat.msgs.push({ t: now(), from: "u", text: text });
      chat.updated = now(); chat.unread = (chat.unread || 0) + 1; chat.closed = false;
      return saveChat(chat).then(function () {
        notify((isNew ? "Новый чат на сайте" : "Сообщение в чате") + (chat.name ? " — " + chat.name : "") + (chat.contact ? " (" + chat.contact + ")" : "") + ":\n" + text.slice(0, 600) + "\n\nОтветить: " + SITE + "/admin.html#chat=" + chat.id);
        var out = pub(chat); out.key = chat.key; return out;
      });
    });
  },
  "chat.poll": function (b) { return loadVisitorChat(b).then(pub); },

  "order.contact": function (b, ip) {
    if (b.website) fail(400, "Ошибка");
    limit(ip, "order", 10, 3600000);
    var o = {
      no: str(b.order, 16).replace(/[^\w-]/g, ""), sum: Math.max(0, Math.round(+b.sum || 0)), items: str(b.items, 300),
      name: str(b.name, LIM.name), method: str(b.method, 30), contact: str(b.contact, LIM.contact), address: str(b.address, LIM.comment), comment: str(b.comment, LIM.comment),
      created: now(), status: "new"
    };
    if (!o.no || !o.contact) fail(400, "Укажите контакт для связи");
    if (!b.consent) fail(400, "Нужно согласие на обработку данных");
    return store.get("orders.json").then(function (all) {
      all = all || { orders: [] };
      var prev = all.orders.filter(function (x) { return x.no === o.no; })[0];
      if (prev) { o.created = prev.created; o.status = prev.status; }
      all.orders = all.orders.filter(function (x) { return x.no !== o.no; });
      all.orders.unshift(o); all.orders = all.orders.slice(0, 1000);
      return store.put("orders.json", all);
    }).then(function () {
      notify("Оплата: заказ " + o.no + " на " + o.sum + " ₽" + (o.items ? "\n" + o.items : "") + "\n" + [o.name, o.method + ": " + o.contact, o.address && "Адрес: " + o.address, o.comment && "Комментарий: " + o.comment].filter(Boolean).join("\n") + "\n\nПроверьте поступление по назначению платежа «Заказ " + o.no + "».\n" + SITE + "/admin.html#orders");
      return { ok: true };
    });
  },

  /* админ */
  "admin.check": function () { return Promise.resolve({ ok: true, telegram: !!process.env.TG_BOT_TOKEN }); },
  "admin.chats": function () {
    return Promise.all([store.get("chats-index.json"), store.get("config.json")]).then(function (r) {
      var list = Object.keys((r[0] || { chats: {} }).chats).map(function (k) { return r[0].chats[k]; });
      list.sort(function (a, b) { return a.updated < b.updated ? 1 : -1; });
      return { chats: list, tgLinked: !!(r[1] && r[1].tgChatId), tgToken: !!process.env.TG_BOT_TOKEN };
    });
  },
  "admin.chat": function (b) {
    var id = str(b.cid, 20);
    return store.get("chats/" + id + ".json").then(function (c) {
      if (!c) fail(404, "Чат не найден");
      var out = { id: c.id, name: c.name, contact: c.contact, page: c.page, created: c.created, closed: !!c.closed, msgs: c.msgs };
      if (c.unread && b.markRead !== false) { c.unread = 0; return saveChat(c).then(function () { return out; }); }
      return out;
    });
  },
  "admin.reply": function (b) {
    var text = str(b.text, LIM.text); if (!text) fail(400, "Пустое сообщение");
    return store.get("chats/" + str(b.cid, 20) + ".json").then(function (c) {
      if (!c) fail(404, "Чат не найден");
      c.msgs.push({ t: now(), from: "a", text: text }); c.updated = now(); c.unread = 0;
      return saveChat(c).then(function () { return { ok: true, msgs: c.msgs }; });
    });
  },
  "admin.close": function (b) {
    return store.get("chats/" + str(b.cid, 20) + ".json").then(function (c) {
      if (!c) fail(404, "Чат не найден");
      c.closed = !c.closed; c.unread = 0;
      return saveChat(c).then(function () { return { ok: true, closed: c.closed }; });
    });
  },
  "admin.orders": function () { return store.get("orders.json").then(function (a) { return { orders: (a && a.orders) || [] }; }); },
  "admin.order": function (b) {
    var no = str(b.no, 16), st = ["new", "paid", "sent", "cancel"].indexOf(b.status) >= 0 ? b.status : "new";
    return store.get("orders.json").then(function (a) {
      a = a || { orders: [] }; a.orders.forEach(function (o) { if (o.no === no) o.status = st; });
      return store.put("orders.json", a).then(function () { return { ok: true }; });
    });
  },
  "admin.tglink": function () { return linkTelegram(); }
};

/* ---------- HTTP ---------- */
function handle(event, context) {
  var h = event.headers || {}, origin = h.Origin || h.origin || "";
  var cors = { "Access-Control-Allow-Origin": ORIGINS.indexOf(origin) >= 0 ? origin : SITE, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", "Vary": "Origin", "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" };
  function reply(code, obj) { return { statusCode: code, headers: cors, body: JSON.stringify(obj), isBase64Encoded: false }; }
  if (event.httpMethod === "OPTIONS") return Promise.resolve({ statusCode: 204, headers: cors, body: "" });
  if (event.httpMethod !== "POST") return Promise.resolve(reply(200, { ok: true, service: "diluga85-support" }));

  var b;
  try { b = JSON.parse(event.isBase64Encoded ? Buffer.from(event.body || "", "base64").toString("utf8") : (event.body || "{}")); } catch (e) { return Promise.resolve(reply(400, { error: "Некорректный запрос" })); }
  if (!b || typeof b !== "object") return Promise.resolve(reply(400, { error: "Некорректный запрос" }));
  var a = String(b.a || ""), fn = actions[a];
  if (!fn) return Promise.resolve(reply(400, { error: "Неизвестное действие" }));
  if (a.indexOf("admin.") === 0) {
    if (!process.env.ADMIN_KEY || process.env.ADMIN_KEY.length < 8) return Promise.resolve(reply(500, { error: "На сервере не задан ADMIN_KEY (минимум 8 символов)." }));
    if (!same(b.adminKey, process.env.ADMIN_KEY)) return Promise.resolve(reply(401, { error: "Неверный пароль чата" }));
  }
  if (!store) {
    var tok = context && context.token ? (context.token.access_token || context.token) : "";
    if (!tok || !process.env.BUCKET) return Promise.resolve(reply(500, { error: "Функции не назначен сервисный аккаунт или не указан BUCKET." }));
    store = s3Store(process.env.BUCKET, tok);
  }
  var ip = (event.requestContext && event.requestContext.identity && event.requestContext.identity.sourceIp) || h["X-Real-Ip"] || h["X-Forwarded-For"] || "?";
  return Promise.resolve().then(function () { return fn(b, ip); }).then(function (r) { return reply(200, r); }, function (e) {
    if (!e.code) console.error(e);
    return reply(e.code || 500, { error: e.code ? e.message : "Ошибка сервера. Попробуйте ещё раз." });
  });
}

module.exports.handler = function (event, context) {
  store = null; // токен сервисного аккаунта может обновиться — берём свежий на каждый вызов
  return handle(event, context);
};
module.exports._setStore = function (s) { store = s; }; // для локальных тестов
module.exports._handle = handle;
