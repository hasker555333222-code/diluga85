/* diluga85 — вкладка «Статистика» в админке: данные Яндекс Метрики (только чтение). */
(function () {
  "use strict";
  var COUNTER = 113803023;
  var CLIENT_ID = "a4a01f65a6ff4007b0088d6f155c0d75";
  var KEY = "diluga-ym";
  var API = "https://api-metrika.yandex.net";
  var PERIODS = [["today", "Сегодня"], ["yesterday", "Вчера"], ["7d", "7 дней"], ["30d", "30 дней"]];
  var S = { period: "today", cache: {}, el: null, loading: false, err: "" };

  /* токен приходит после входа через Яндекс в адресе страницы: #access_token=… */
  (function grab() {
    var h = location.hash || "", m = /access_token=([^&]+)/.exec(h);
    if (!m) return;
    var e = /expires_in=(\d+)/.exec(h);
    try { localStorage.setItem(KEY, JSON.stringify({ t: decodeURIComponent(m[1]), exp: e ? Date.now() + (+e[1]) * 1000 : 0 })); } catch (x) {}
    try { history.replaceState(null, "", location.pathname + location.search + "#stats"); } catch (x) { location.hash = "#stats"; }
  })();

  function tok() {
    try { var o = JSON.parse(localStorage.getItem(KEY) || "null"); if (o && o.t && (!o.exp || o.exp > Date.now())) return o.t; } catch (e) {}
    return "";
  }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function n(x) { return String(Math.round(+x || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, " "); }
  function dur(s) { s = Math.round(+s || 0); var m = Math.floor(s / 60); return m ? m + " мин " + (s % 60) + " с" : s + " с"; }
  function range(p) {
    if (p === "today") return { date1: "today", date2: "today" };
    if (p === "yesterday") return { date1: "yesterday", date2: "yesterday" };
    if (p === "7d") return { date1: "6daysAgo", date2: "today" };
    return { date1: "29daysAgo", date2: "today" };
  }
  function get(path, params) {
    var qs = Object.keys(params).map(function (k) { return k + "=" + encodeURIComponent(params[k]); }).join("&");
    return fetch(API + path + (qs ? "?" + qs : ""), { headers: { Authorization: "OAuth " + tok() }, cache: "no-store" }).then(function (r) {
      if (r.status === 401 || r.status === 403) { var e = new Error("auth"); e.auth = true; throw e; }
      if (!r.ok) throw new Error("HTTP " + r.status);
      return r.json();
    });
  }
  function data(p, extra) {
    var o = { ids: COUNTER, lang: "ru", accuracy: "full" }, r = range(p), k;
    for (k in r) o[k] = r[k];
    for (k in extra) o[k] = extra[k];
    return get("/stat/v1/data", o);
  }
  function soft(pr) { return pr.then(function (x) { return x; }, function (e) { if (e && e.auth) throw e; return null; }); }

  function load(p) {
    var oneDay = p === "today" || p === "yesterday";
    return Promise.all([
      data(p, { metrics: "ym:s:users,ym:s:visits,ym:s:pageviews,ym:s:bounceRate,ym:s:avgVisitDurationSeconds" }),
      soft(data(p, { metrics: "ym:s:users,ym:s:visits", dimensions: oneDay ? "ym:s:hour" : "ym:s:date", sort: oneDay ? "ym:s:hour" : "ym:s:date", limit: 100 })),
      soft(data(p, { metrics: "ym:s:visits", dimensions: "ym:s:lastsignTrafficSource", sort: "-ym:s:visits", limit: 8 })),
      soft(data(p, { metrics: "ym:s:visits", dimensions: "ym:s:deviceCategory", sort: "-ym:s:visits", limit: 5 })),
      soft(get("/management/v1/counter/" + COUNTER + "/goals", {})),
      soft(data(p, { metrics: "ym:s:productImpressions", dimensions: "ym:s:productName", sort: "-ym:s:productImpressions", limit: 10 })),
      soft(data(p, { metrics: "ym:s:visits", filters: "ym:s:lastsignTrafficSource=='ad'" }))
    ]).then(function (r) {
      var goals = (r[4] && r[4].goals || []).filter(function (g) { return g && g.id; });
      var chunks = [], i;
      for (i = 0; i < goals.length; i += 20) chunks.push(goals.slice(i, i + 20));
      return Promise.all(chunks.map(function (c) {
        return soft(data(p, { metrics: c.map(function (g) { return "ym:s:goal" + g.id + "reaches"; }).join(",") }));
      })).then(function (gr) {
        var reach = [];
        gr.forEach(function (res, ci) {
          var t = res && res.totals ? res.totals : [];
          chunks[ci].forEach(function (g, j) { reach.push({ name: g.name, n: +t[j] || 0 }); });
        });
        reach.sort(function (a, b) { return b.n - a.n; });
        var ads = r[6] && r[6].totals ? +r[6].totals[0] || 0 : 0;
        return { totals: r[0].totals || [], series: r[1], sources: r[2], devices: r[3], goals: reach, products: r[5], ads: ads, oneDay: oneDay, at: Date.now() };
      });
    });
  }

  function bars(rows, label) {
    var max = 1; rows.forEach(function (x) { if (x.v > max) max = x.v; });
    return '<ul class="st-bars">' + rows.map(function (x) {
      return '<li><span class="st-l">' + esc(x.k) + '</span><span class="st-b"><i style="width:' + Math.max(2, Math.round(x.v / max * 100)) + '%"></i></span><b>' + n(x.v) + "</b></li>";
    }).join("") + "</ul>";
  }
  function rowsOf(res, fmt) {
    if (!res || !res.data) return [];
    return res.data.map(function (d) { return { k: fmt ? fmt(d.dimensions[0]) : (d.dimensions[0].name || "—"), v: +d.metrics[0] || 0 }; });
  }
  function chart(res, oneDay) {
    if (!res || !res.data || !res.data.length) return '<p class="hint">Пока нет данных за этот период.</p>';
    var pts = res.data.map(function (d) {
      var k = d.dimensions[0].name || d.dimensions[0].id || "";
      if (oneDay) k = String(k).slice(0, 2) || k; else k = String(k).slice(8, 10) + "." + String(k).slice(5, 7);
      return { k: k, u: +d.metrics[0] || 0, v: +d.metrics[1] || 0 };
    });
    if (oneDay) {
      var full = [], map = {}; pts.forEach(function (p) { map[+p.k] = p; });
      for (var h = 0; h < 24; h++) full.push(map[h] || { k: (h < 10 ? "0" : "") + h, u: 0, v: 0 });
      pts = full;
    }
    var max = 1; pts.forEach(function (p) { if (p.u > max) max = p.u; });
    return '<div class="st-chart" role="img" aria-label="Посетители по ' + (oneDay ? "часам" : "дням") + '">' + pts.map(function (p, i) {
      var show = oneDay ? i % 3 === 0 : (pts.length <= 10 || i % Math.ceil(pts.length / 8) === 0);
      return '<div class="st-col" title="' + esc(p.k + (oneDay ? ":00" : "") + " — посетителей: " + p.u + ", визитов: " + p.v) + '"><i style="height:' + Math.max(p.u ? 4 : 0, Math.round(p.u / max * 100)) + '%"></i><span>' + (show ? esc(p.k) : "") + "</span></div>";
    }).join("") + "</div>";
  }

  function view() {
    var el = S.el; if (!el) return;
    if (!tok()) {
      var ready = CLIENT_ID && CLIENT_ID.indexOf("__") !== 0;
      el.innerHTML = '<div class="st"><p>Здесь будет видно, сколько людей зашло на сайт за день, откуда они пришли и что нажимали. Данные берутся из Яндекс Метрики.</p>' +
        (ready ? '<button class="btn btn-primary" data-st="connect">Подключить Яндекс Метрику</button><p class="hint">Откроется страница Яндекса: войдите под аккаунтом, где стоит счётчик, и нажмите «Разрешить». Доступ только на чтение статистики, сохраняется в этом браузере.</p>'
          : '<p class="hint">Подключение ещё не настроено.</p>') + "</div>";
      return;
    }
    var tabs = '<div class="st-per" role="group" aria-label="Период">' + PERIODS.map(function (p) {
      return '<button class="chip" data-st-p="' + p[0] + '" aria-pressed="' + (S.period === p[0]) + '">' + p[1] + "</button>";
    }).join("") + '<button class="ib" data-st="reload" aria-label="Обновить" title="Обновить">↻</button></div>';
    var d = S.cache[S.period];
    if (S.err) { el.innerHTML = '<div class="st">' + tabs + '<p class="msg err">' + esc(S.err) + "</p></div>"; return; }
    if (!d) { el.innerHTML = '<div class="st">' + tabs + '<p class="hint">Загружаю статистику…</p></div>'; return; }
    var t = d.totals;
    var cards = [["Посетители", n(t[0])], ["Визиты", n(t[1])], ["Просмотры", n(t[2])], ["С рекламы", n(d.ads)], ["Отказы", (Math.round((+t[3] || 0) * 10) / 10) + "%"], ["Время на сайте", dur(t[4])]];
    var goals = d.goals.filter(function (g) { return g.n > 0; });
    var zero = d.goals.length - goals.length;
    var prods = rowsOf(d.products);
    var dev = rowsOf(d.devices);
    el.innerHTML = '<div class="st">' + tabs +
      '<div class="st-cards">' + cards.map(function (c) { return '<div class="st-card"><span>' + c[0] + "</span><b>" + c[1] + "</b></div>"; }).join("") + "</div>" +
      "<h4>Посетители по " + (d.oneDay ? "часам" : "дням") + "</h4>" + chart(d.series, d.oneDay) +
      "<h4>Что нажимали</h4>" + (goals.length ? bars(goals.map(function (g) { return { k: g.name, v: g.n }; })) : '<p class="hint">За этот период нажатий на кнопки не было.</p>') +
      (zero ? '<p class="hint">Ещё ' + zero + " " + (zero === 1 ? "действие" : zero < 5 ? "действия" : "действий") + " без нажатий.</p>" : "") +
      (prods.length ? "<h4>Какие вещи смотрели</h4>" + bars(prods) : "") +
      "<h4>Откуда пришли</h4>" + (rowsOf(d.sources).length ? bars(rowsOf(d.sources)) : '<p class="hint">Нет данных.</p>') +
      (dev.length ? "<h4>Устройства</h4>" + bars(dev) : "") +
      '<p class="hint">Метрика обновляет данные с задержкой в несколько минут. Обновлено в ' + new Date(d.at).toTimeString().slice(0, 5) + '. <a href="https://metrika.yandex.ru/dashboard?id=' + COUNTER + '" target="_blank" rel="noopener">Открыть Метрику</a> · <a href="#" data-st="logout">Отключить</a></p>' +
      "</div>";
  }

  function refresh(force) {
    var p = S.period;
    if (!tok()) { view(); return; }
    if (!force && S.cache[p] && Date.now() - S.cache[p].at < 60000) { view(); return; }
    if (S.loading === p) return;
    S.loading = p; S.err = ""; if (force) delete S.cache[p]; view();
    load(p).then(function (d) { S.cache[p] = d; }, function (e) {
      if (e && e.auth) { try { localStorage.removeItem(KEY); } catch (x) {} S.err = ""; }
      else if (S.period === p) S.err = "Не получилось загрузить статистику. Проверьте интернет и нажмите ↻.";
    }).then(function () { if (S.loading === p) S.loading = false; view(); });
  }

  function mount(el) {
    S.el = el || null;
    if (!S.el) return;
    if (!document.getElementById("st-css")) {
      var st = document.createElement("style"); st.id = "st-css";
      st.textContent = ".st{display:flex;flex-direction:column;gap:12px}.st h4{margin:10px 0 0;font-family:var(--mono);font-size:12px;letter-spacing:.08em;text-transform:uppercase;color:var(--muted);font-weight:600}" +
        ".st-per{display:flex;flex-wrap:wrap;gap:6px;align-items:center}.st-per .ib{margin-left:auto}" +
        ".st-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px}@media (max-width:420px){.st-cards{grid-template-columns:repeat(2,minmax(0,1fr))}}" +
        ".st-card{border:1px solid var(--line);border-radius:12px;padding:10px 12px;display:flex;flex-direction:column;gap:4px;min-width:0}.st-card span{font-size:12px;color:var(--muted)}.st-card b{font-family:var(--mono);font-size:20px;color:var(--indigo);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}" +
        ".st-chart{display:flex;align-items:flex-end;gap:3px;height:120px;padding:6px 0 18px;border-bottom:1px solid var(--line);position:relative}.st-col{flex:1;min-width:0;height:100%;display:flex;flex-direction:column;justify-content:flex-end;align-items:center;position:relative}" +
        ".st-col i{display:block;width:100%;border-radius:4px 4px 0 0;background:var(--indigo);opacity:.9}.st-col:hover i{opacity:1;filter:brightness(1.1)}.st-col span{position:absolute;bottom:-17px;font-family:var(--mono);font-size:10px;color:var(--muted);white-space:nowrap}" +
        ".st-bars{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:6px}.st-bars li{display:grid;grid-template-columns:minmax(0,1.3fr) minmax(0,1fr) auto;gap:8px;align-items:center;font-size:13px}" +
        ".st-l{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.st-b{height:8px;border-radius:99px;background:color-mix(in srgb,var(--indigo) 14%,transparent);overflow:hidden}.st-b i{display:block;height:100%;border-radius:99px;background:var(--indigo)}.st-bars b{font-family:var(--mono);font-size:13px;min-width:2.5em;text-align:right}";
      document.head.appendChild(st);
    }
    refresh(false);
  }

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest && ev.target.closest("[data-st],[data-st-p]");
    if (!t || !S.el || !S.el.contains(t)) return;
    ev.preventDefault();
    if (t.dataset.stP) { S.period = t.dataset.stP; S.err = ""; refresh(false); return; }
    var a = t.dataset.st;
    if (a === "reload") refresh(true);
    else if (a === "logout") { try { localStorage.removeItem(KEY); } catch (x) {} S.cache = {}; view(); }
    else if (a === "connect") {
      location.href = "https://oauth.yandex.ru/authorize?response_type=token&client_id=" + encodeURIComponent(CLIENT_ID) +
        "&redirect_uri=" + encodeURIComponent(location.origin + location.pathname);
    }
  });

  window.DilugaStats = { mount: mount, hashTab: function () { return location.hash === "#stats" ? "stats" : null; } };
})();
