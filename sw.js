/* diluga85 — service worker для пуш-уведомлений админки. */
"use strict";
function idb() {
  return new Promise(function (res, rej) {
    var r = indexedDB.open("diluga-push", 1);
    r.onupgradeneeded = function () { r.result.createObjectStore("kv"); };
    r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); };
  });
}
function idbGet(k) {
  return idb().then(function (db) { return new Promise(function (res) { var q = db.transaction("kv").objectStore("kv").get(k); q.onsuccess = function () { res(q.result); }; q.onerror = function () { res(null); }; }); });
}
self.addEventListener("install", function () { self.skipWaiting(); });
self.addEventListener("activate", function (e) { e.waitUntil(self.clients.claim()); });
self.addEventListener("push", function (e) {
  e.waitUntil(Promise.all([idbGet("api"), idbGet("adminKey")]).then(function (v) {
    if (!v[0] || !v[1]) return null;
    return fetch(v[0], { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ a: "admin.last", adminKey: v[1] }) })
      .then(function (r) { return r.json(); }).then(function (j) { return j.event; });
  }).catch(function () { return null; }).then(function (ev) {
    ev = ev || { title: "diluga85", text: "Новое сообщение или заявка на сайте", link: "/admin.html#chats" };
    return self.registration.showNotification(ev.title || "diluga85", {
      body: ev.text || "", icon: "/icon-192.png", badge: "/icon-192.png",
      tag: "diluga-" + (ev.t || Date.now()), renotify: true, data: { url: ev.link || "/admin.html#chats" }
    });
  }));
});
self.addEventListener("notificationclick", function (e) {
  e.notification.close();
  var link = (e.notification.data && e.notification.data.url) || "/admin.html#chats";
  var url = link.replace("/admin.html", "/admin.html?n=" + Date.now());
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(function (ws) {
    for (var i = 0; i < ws.length; i++) {
      if (ws[i].url.indexOf("/admin.html") >= 0 && ws[i].navigate) { return ws[i].navigate(url).then(function (w) { return w && w.focus(); }); }
    }
    return self.clients.openWindow(url);
  }));
});
