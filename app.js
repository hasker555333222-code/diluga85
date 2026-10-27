/* diluga85 — витрина и админка. Один файл для index.html и admin.html. */
(function (root) {
  "use strict";

  var STATUS = { available: "В наличии", reserved: "Бронь", sold: "Продано" };
  var FONTS = "https://fonts.googleapis.com/css2?family=Dela+Gothic+One&family=JetBrains+Mono:wght@400;600&family=Manrope:wght@400;500;600;700;800&display=swap";

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) { return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); }
  function paras(t) { return String(t || "").split(/\n+/).filter(Boolean).map(function (p) { return "<p>" + esc(p) + "</p>"; }).join(""); }
  function money(n) { if (n === "" || n == null || isNaN(+n)) return ""; return String(Math.round(+n)).replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0") + "\u00a0₽"; }
  function safeUrl(u) {
    u = String(u || "").trim(); if (!u) return "";
    if (u.charAt(0) === "@") u = "https://t.me/" + u.slice(1);
    if (/^t\.me\//i.test(u) || /^[\w.-]+\.[a-z]{2,}(\/|$)/i.test(u)) u = "https://" + u;
    return /^https?:\/\//i.test(u) ? u : "";
  }
  function shortUrl(u) { return String(u || "").replace(/^https?:\/\//, "").replace(/\/$/, ""); }
  function plural(n, a, b, c) { var m10 = n % 10, m100 = n % 100; if (m10 === 1 && m100 !== 11) return a; if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return b; return c; }
  function rank(p) { return p.status === "available" ? 0 : p.status === "reserved" ? 1 : 2; }
  var DEFAULT_FAQ = [
    { q: "Вещи оригинальные?", a: "Да. Брендовые вещи в каталоге — оригинал: Levi's, Nike, Ralph Lauren, Champion, Adidas и другие. По запросу пришлём видео-обзор, фото бирок и замеры." },
    { q: "Как купить вещь?", a: "Нажмите «Купить в Telegram» в карточке товара или напишите менеджеру @eil_mart0 название вещи. Мы подтвердим наличие и пришлём детали оплаты." },
    { q: "Куда и как быстро вы отправляете?", a: "По всей России и в страны СНГ. Отправляем в день оплаты. Способ и стоимость доставки согласуем в сообщениях." },
    { q: "Как подобрать размер?", a: "У джинсов в описании указаны замеры в сантиметрах: талия, бёдра, посадка и длина. Для остальных вещей пришлём замеры по запросу." },
    { q: "Что такое кастом diluga?", a: "Это оригинальное худи или свитшот, доработанное вручную: вшивки на груди, рукавах, спине или капюшоне. Каждый кастом существует в одном экземпляре." },
    { q: "Где почитать отзывы?", a: "Отзывы покупателей собраны в Telegram-канале t.me/diluga85_otzivy." }
  ];
  function faqOf(state) { var f = state.settings.faq; return (f && f.length ? f : DEFAULT_FAQ).filter(function (x) { return x && x.q && x.a; }); }
  function ruDate(iso) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso || ""); return m ? m[3] + "." + m[2] + "." + m[1] : ""; }
  function catName(state, id) { var c = state.categories.filter(function (x) { return x.id === id; })[0]; return c ? c.name : ""; }

  var HANGER = '<svg viewBox="0 0 64 40" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M32 12c0-3 2-5 5-5s5 2 5 5c0 4-6 4-10 9L5 33c-2 1-1 4 1 4h52c2 0 3-3 1-4L32 21"/></svg>';

  function photoBox(p, i, big) {
    var src = p.photos && p.photos[i || 0];
    var alt = [p.brand, p.title, p.size ? "размер " + p.size : ""].filter(Boolean).join(", ");
    var inner = src ? '<img src="' + esc(src) + '" alt="' + esc(alt) + '" loading="lazy" decoding="async">' : '<div class="noph">' + HANGER + "<span>фото скоро</span></div>";
    var badge = "";
    if (!big) {
      if (p.status === "sold") badge = '<span class="badge b-sold">Продано</span>';
      else if (p.status === "reserved") badge = '<span class="badge b-res">Бронь</span>';
      else if (p.isNew) badge = '<span class="badge b-new">Новинка</span>';
    }
    return '<div class="ph">' + inner + badge + "</div>";
  }

  /* ---------- markup of the public site (pure: also used to pre-render index.html) ---------- */
  function marqueeHTML(state) {
    var seen = {}, words = [];
    (state.products || []).forEach(function (p) { String(p.brand || "").split("×").forEach(function (b) { b = b.trim(); var k = b.toLowerCase(); if (b && k !== "diluga" && !seen[k]) { seen[k] = 1; words.push(b); } }); });
    words = words.slice(0, 14).concat(["Vintage", "Original", "Custom by diluga"]);
    var row = words.map(function (w) { return "<span>" + esc(w) + "</span>"; }).join("");
    var row2 = words.slice().reverse().map(function (w) { return "<span>" + esc(w) + "</span>"; }).join("");
    return '<div class="mqw" aria-hidden="true"><div class="marquee m2"><div class="mq">' + row2 + row2 + row2 + '</div></div><div class="marquee m1"><div class="mq">' + row + row + row + "</div></div></div>";
  }
  function siteHTML(state, ui) {
    ui = ui || { cat: "all", onlyAvail: false };
    var s = state.settings, L = state.links;
    var avail = state.products.filter(function (p) { return p.status !== "sold"; }).length;
    var list = state.products.map(function (p, i) { return { p: p, i: i }; })
      .filter(function (x) { return (ui.cat === "all" || x.p.category === ui.cat) && (!ui.onlyAvail || x.p.status === "available"); })
      .sort(function (a, b) { return rank(a.p) - rank(b.p) || a.i - b.i; }).map(function (x) { return x.p; });

    var chips = '<button class="chip" data-cat="all" aria-pressed="' + (ui.cat === "all") + '">Все<span class="n">' + state.products.length + "</span></button>" +
      state.categories.map(function (c) {
        var n = state.products.filter(function (p) { return p.category === c.id; }).length;
        return '<button class="chip" data-cat="' + esc(c.id) + '" aria-pressed="' + (ui.cat === c.id) + '">' + esc(c.name) + '<span class="n">' + n + "</span></button>";
      }).join("");

    var cards = list.length ? '<div class="grid">' + list.map(function (p) {
      var meta = [p.size ? "Размер " + p.size : "", p.condition].filter(Boolean).join(" · ");
      return '<button class="card' + (p.status === "sold" ? " sold" : "") + '" data-open="' + esc(p.id) + '">' + photoBox(p) +
        '<div class="cb">' + (p.brand ? '<div class="brand">' + esc(p.brand) + "</div>" : "") +
        '<div class="ct">' + esc(p.title) + "</div>" + (meta ? '<div class="meta">' + esc(meta) + "</div>" : "") +
        '<div class="price">' + esc(p.status === "sold" ? "Продано" : money(p.price)) + (p.oldPrice && p.status !== "sold" ? "<s>" + esc(money(p.oldPrice)) + "</s>" : "") + "</div></div></button>";
    }).join("") + "</div>" : '<div class="empty">В этой категории пока пусто. Загляните в Telegram-канал — там все новинки.</div>';

    var tg = safeUrl(L.telegram);
    var extra = (L.extra || []).filter(function (e) { return safeUrl(e.url); });
    var av = safeUrl(L.avito);
    var links = (tg ? '<a class="lk" href="' + esc(tg) + '" target="_blank" rel="noopener" data-goal="tg_channel"><span>Telegram-канал</span><span>' + esc(shortUrl(tg)) + "</span></a>" : "") +
      (av ? '<a class="lk" href="' + esc(av) + '" target="_blank" rel="noopener" data-goal="avito_profile"><span>Мы на Авито</span><span>' + esc(shortUrl(av)) + "</span></a>" : "") +
      extra.map(function (e) { var u = safeUrl(e.url); return '<a class="lk" href="' + esc(u) + '" target="_blank" rel="noopener"><span>' + esc(e.label || shortUrl(u)) + "</span><span>" + esc(shortUrl(u)) + "</span></a>"; }).join("");

    return '<header class="top"><div class="wrap"><a class="logo" href="#catalog">' + esc(s.shopName) + '</a>' +
      '<nav class="nav"><a href="#catalog">Каталог</a><a href="#how">Как купить</a><a href="#delivery">Доставка</a><a href="#faq">Вопросы</a><a href="#about">О нас</a></nav>' +
      (tg ? '<a class="btn btn-primary btn-sm" href="' + esc(tg) + '" target="_blank" rel="noopener" data-goal="tg_channel">Telegram</a>' : "") + "</div></header>" +
      '<main><div class="wrap hero"><div class="hero-bg" aria-hidden="true">DILUGA85</div><div class="eyebrow">' + esc(s.heroEyebrow) + "</div><h1>" + String(s.heroTitle || "").split(/\s+/).filter(Boolean).map(function (w, i) { return '<span class="w" style="--i:' + i + '">' + esc(w) + "</span>"; }).join(" ") + "</h1><p>" + esc(s.heroText) + '</p>' +
      '<div class="ctas"><a class="btn btn-primary" href="#catalog">Смотреть каталог</a>' + (tg ? '<a class="btn btn-ghost" href="' + esc(tg) + '" target="_blank" rel="noopener" data-goal="tg_channel">Открыть канал</a>' : "") + "</div>" +
      '<div class="facts"><span class="fact">' + avail + " " + plural(avail, "вещь", "вещи", "вещей") + ' в наличии</span><span class="fact">' + esc(s.footerNote) + '</span><span class="fact">Отправка в день оплаты</span></div></div>' + marqueeHTML(state) +
      '<section id="catalog" class="sec"><div class="wrap"><div class="sec-head"><div><h2>' + esc(s.catalogTitle) + '</h2><p class="note" style="margin:6px 0 0">' + esc(s.catalogNote) + (s.updatedAt ? " Каталог обновлён " + esc(ruDate(s.updatedAt)) + "." : "") + '</p></div>' +
      '<label class="toggle"><input type="checkbox" id="only-avail"' + (ui.onlyAvail ? " checked" : "") + "> Только в наличии</label></div>" +
      '<div class="filters">' + chips + "</div>" + cards + "</div></section>" +
      '<section id="how" class="sec"><div class="wrap"><div class="sec-head"><h2>' + esc(s.howTitle) + '</h2></div><div class="steps">' +
      (s.howTo || []).filter(Boolean).map(function (t) { return '<div class="step"><p>' + esc(t) + "</p></div>"; }).join("") + "</div></div></section>" +
      '<section id="delivery" class="sec"><div class="wrap"><div class="sec-head"><h2>' + esc(s.deliveryTitle) + '</h2></div><div class="info">' +
      '<div class="box txt"><h3>Доставка</h3>' + paras(s.deliveryText) + '</div><div class="box txt"><h3>Оплата</h3>' + paras(s.paymentText) + '</div><div class="box txt"><h3>Состояние и возврат</h3>' + paras(s.returnText) + "</div></div></div></section>" +
      '<section id="faq" class="sec"><div class="wrap"><div class="sec-head"><h2>Частые вопросы</h2></div><div class="faq">' +
      faqOf(state).map(function (x) { return '<div class="qa"><h3>' + esc(x.q) + "</h3>" + paras(x.a) + "</div>"; }).join("") + "</div></div></section>" +
      '<section id="about" class="sec"><div class="wrap about"><div class="txt"><h2 style="font-family:var(--display);font-weight:400;font-size:clamp(26px,3.6vw,38px);margin-bottom:14px">' + esc(s.aboutTitle) + "</h2>" + paras(s.aboutText) + '</div><div class="links">' + links + "</div></div></section></main>" +
      '<footer><div class="wrap"><span>© ' + esc(s.shopName) + "</span><span>" + esc(s.footerNote) + "</span>" +
      ((tg || av) ? '<span class="flinks">' + (tg ? '<a href="' + esc(tg) + '" target="_blank" rel="noopener" data-goal="tg_channel">Telegram</a>' : "") + (av ? '<a href="' + esc(av) + '" target="_blank" rel="noopener" data-goal="avito_profile">Профиль на Авито</a>' : "") + "</span>" : "") +
      "</div></footer>";
  }

  /* ---------- full index.html (written by the admin on every save) ---------- */
  function jsonForScript(o) { return JSON.stringify(o).replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026"); }
  function buildIndexHtml(state, version) {
    var s = state.settings, site = (s.siteUrl || "").replace(/\/$/, "");
    var title = s.metaTitle || s.shopName, desc = s.metaDescription || s.heroText;
    var firstPhoto = ""; state.products.some(function (p) { if (p.status !== "sold" && p.photos && p.photos[0] && !/^data:/.test(p.photos[0])) { firstPhoto = p.photos[0]; return true; } return false; });
    var v = version || Date.now().toString(36);
    var same = [safeUrl(state.links.telegram), safeUrl(state.links.avito)].concat((state.links.extra || []).map(function (e) { return safeUrl(e.url); })).filter(function (u, i, a) { return u && a.indexOf(u) === i; });
    var prices = state.products.filter(function (p) { return p.status !== "sold" && p.price; }).map(function (p) { return +p.price; });
    var ld = { "@context": "https://schema.org", "@type": "ClothingStore", "@id": site ? site + "/#store" : undefined, name: s.shopName, url: site ? site + "/" : undefined, description: desc,
      image: site && firstPhoto ? site + "/" + firstPhoto : undefined, sameAs: same, areaServed: "RU", currenciesAccepted: "RUB",
      priceRange: prices.length ? Math.min.apply(null, prices) + "–" + Math.max.apply(null, prices) + " RUB" : undefined,
      contactPoint: safeUrl(state.links.order) ? { "@type": "ContactPoint", contactType: "sales", url: safeUrl(state.links.order), availableLanguage: "ru" } : undefined };
    var items = state.products.filter(function (p) { return p.status !== "sold" && p.price; }).map(function (p, i) {
      return { "@type": "ListItem", position: i + 1, item: { "@type": "Product", sku: p.id, name: [p.brand, p.title].filter(Boolean).join(" "), description: p.description, brand: p.brand ? { "@type": "Brand", name: p.brand } : undefined, size: p.size || undefined, category: catName(state, p.category) || undefined, image: p.photos && p.photos[0] && site ? site + "/" + p.photos[0] : undefined, offers: { "@type": "Offer", url: site ? site + "/" : undefined, price: String(p.price), priceCurrency: "RUB", availability: p.status === "reserved" ? "https://schema.org/LimitedAvailability" : "https://schema.org/InStock", itemCondition: "https://schema.org/UsedCondition" } } };
    });
    var ld2 = { "@context": "https://schema.org", "@type": "ItemList", itemListElement: items };
    var ld3 = { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: faqOf(state).map(function (x) { return { "@type": "Question", name: x.q, acceptedAnswer: { "@type": "Answer", text: x.a } }; }) };
    var mid = /^\d{5,12}$/.test(String(s.metrikaId || "").trim()) ? String(s.metrikaId).trim() : "";
    var metrika = mid ? '<!-- Yandex.Metrika counter -->\n<script type="text/javascript">(function(m,e,t,r,i,k,a){m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};m[i].l=1*new Date();for (var j = 0; j < document.scripts.length; j++) {if (document.scripts[j].src === r) { return; }}k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)})(window, document,"script","https://mc.yandex.ru/metrika/tag.js?id=' + mid + '", "ym");ym(' + mid + ', "init", {ssr:true, webvisor:true, clickmap:true, ecommerce:"dataLayer", referrer: document.referrer, url: location.href, accurateTrackBounce:true, trackLinks:true});<\/script>\n<noscript><div><img src="https://mc.yandex.ru/watch/' + mid + '" style="position:absolute; left:-9999px;" alt="" /></div></noscript>\n<!-- /Yandex.Metrika counter -->\n' : "";
    return '<!doctype html>\n<html lang="ru">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n' + metrika +
      "<title>" + esc(title) + "</title>\n" +
      '<meta name="description" content="' + esc(desc) + '">\n' +
      (site ? '<link rel="canonical" href="' + esc(site) + '/">\n' : "") +
      '<meta property="og:type" content="website">\n<meta property="og:title" content="' + esc(title) + '">\n<meta property="og:description" content="' + esc(desc) + '">\n' +
      (site ? '<meta property="og:url" content="' + esc(site) + '/">\n' : "") +
      (site && firstPhoto ? '<meta property="og:image" content="' + esc(site + "/" + firstPhoto) + '">\n' : "") +
      (s.yandexVerification ? '<meta name="yandex-verification" content="' + esc(s.yandexVerification) + '">\n' : "") +
      (s.googleVerification ? '<meta name="google-site-verification" content="' + esc(s.googleVerification) + '">\n' : "") +
      '<meta name="color-scheme" content="light dark">\n' +
      '<link rel="preconnect" href="https://fonts.googleapis.com">\n<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>\n<link rel="stylesheet" href="' + FONTS + '">\n' +
      '<link rel="stylesheet" href="style.css?v=' + v + '">\n' +
      '<script type="application/ld+json">' + jsonForScript(ld) + "<\/script>\n" +
      '<script type="application/ld+json">' + jsonForScript(ld2) + "<\/script>\n" +
      '<script type="application/ld+json">' + jsonForScript(ld3) + "<\/script>\n" +
      "</head>\n<body>\n" +
      '<div id="site">' + siteHTML(state) + "</div>\n<div id=\"modal\"></div>\n" +
      '<script type="application/json" id="shop-data">' + jsonForScript(state) + "<\/script>\n" +
      '<script src="app.js?v=' + v + '"><\/script>\n</body>\n</html>\n';
  }
  function buildSitemap(state) {
    var site = (state.settings.siteUrl || "").replace(/\/$/, ""); if (!site) return "";
    var d = new Date().toISOString().slice(0, 10);
    return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>' + esc(site) + "/</loc><lastmod>" + d + "</lastmod><changefreq>daily</changefreq></url>\n</urlset>\n";
  }
  function buildRobots(state) {
    var site = (state.settings.siteUrl || "").replace(/\/$/, "");
    return "User-agent: *\nAllow: /\nDisallow: /admin.html\n" + (site ? "Sitemap: " + site + "/sitemap.xml\n" : "");
  }

  function oneLine(t) { return String(t || "").replace(/\s*\n+\s*/g, " ").trim(); }
  function buildLlms(state) {
    var s = state.settings, L = state.links, site = (s.siteUrl || "").replace(/\/$/, "");
    var avail = state.products.filter(function (p) { return p.status !== "sold"; });
    var out = "# " + s.shopName + "\n\n> " + oneLine(s.metaDescription || s.heroText) + "\n\n";
    out += oneLine(s.aboutText) + "\n\n";
    out += "## Каталог\n\n";
    out += "- Вещей в наличии: " + avail.length + (s.updatedAt ? " (на " + ruDate(s.updatedAt) + ")" : "") + "\n";
    state.categories.forEach(function (c) {
      var n = avail.filter(function (p) { return p.category === c.id; }).length;
      if (n) out += "- " + c.name + ": " + n + "\n";
    });
    out += "- Каждая вещь в одном экземпляре; кастомы diluga сделаны вручную на оригинальных вещах\n\n";
    out += "## Вещи в наличии\n\n";
    avail.forEach(function (p) {
      out += "- " + [p.brand, p.title].filter(Boolean).join(" — ") + (p.size ? ", размер " + p.size : "") + (p.price ? ", " + p.price + " ₽" : "") + (p.status === "reserved" ? " (бронь)" : "") + (safeUrl(p.postUrl) ? " — " + safeUrl(p.postUrl) : "") + "\n";
    });
    out += "\n## Как купить\n\n";
    (s.howTo || []).filter(Boolean).forEach(function (t, i) { out += (i + 1) + ". " + oneLine(t) + "\n"; });
    out += "\n## Доставка и оплата\n\n- " + oneLine(s.deliveryText) + "\n- " + oneLine(s.paymentText) + "\n- " + oneLine(s.returnText) + "\n";
    out += "\n## Частые вопросы\n\n";
    faqOf(state).forEach(function (x) { out += "### " + oneLine(x.q) + "\n\n" + oneLine(x.a) + "\n\n"; });
    out += "## Ссылки\n\n";
    if (site) out += "- [Сайт и каталог](" + site + "/)\n";
    if (safeUrl(L.telegram)) out += "- [Telegram-канал](" + safeUrl(L.telegram) + "): все поступления\n";
    if (safeUrl(L.order)) out += "- [Заказ и вопросы](" + safeUrl(L.order) + ")\n";
    (L.extra || []).forEach(function (e) { var u = safeUrl(e.url); if (u && u !== safeUrl(L.order)) out += "- [" + (e.label || shortUrl(u)) + "](" + u + ")\n"; });
    return out;
  }

  var API = { siteHTML: siteHTML, buildIndexHtml: buildIndexHtml, buildSitemap: buildSitemap, buildRobots: buildRobots, buildLlms: buildLlms };
  if (typeof module !== "undefined" && module.exports) module.exports = API;
  if (typeof document === "undefined") return;
  root.Diluga = API;

  /* ======================= browser ======================= */
  function $(s, r) { return (r || document).querySelector(s); }
  var IS_ADMIN = document.body.hasAttribute("data-admin");
  var state = null, saved = null;
  var ui = { cat: "all", onlyAvail: false, admin: false, tab: "products", editing: null, busy: false, msg: "", msgKind: "", dirty: false, confirmDel: null, open: null, photoIdx: 0 };
  function byId(id) { return state.products.filter(function (p) { return p.id === id; })[0]; }

  function renderSite() { var el = $("#site"); if (el && state) { el.innerHTML = siteHTML(state, ui); reveal(); } }
  var io = null;
  function scramble(el) {
    if (!el || el.__scr) return; el.__scr = 1;
    var txt = el.textContent, chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#%&@$*+0123456789", f = 0, total = 22;
    (function step() {
      var k = Math.floor(f / total * txt.length), out = "";
      for (var i = 0; i < txt.length; i++) out += i < k || txt[i] === " " ? esc(txt[i]) : '<span class="scr">' + chars[Math.floor(Math.random() * chars.length)] + "</span>";
      el.innerHTML = out;
      if (++f <= total) setTimeout(step, 38); else el.textContent = txt;
    })();
  }
  function fx() {
    if (fx.done || IS_ADMIN) return; fx.done = 1;
    var root = document.documentElement, fine = !!(window.matchMedia && matchMedia("(pointer:fine)").matches);
    try {
      if (!sessionStorage.getItem("dl-intro")) {
        sessionStorage.setItem("dl-intro", "1");
        var c = document.createElement("div"); c.className = "intro"; c.setAttribute("aria-hidden", "true");
        c.innerHTML = '<div class="intro-in"><span>DILUGA</span><span>85</span></div>';
        document.body.appendChild(c);
        setTimeout(function () { c.classList.add("go"); }, 1000);
        setTimeout(function () { if (c.parentNode) c.parentNode.removeChild(c); }, 2100);
      }
    } catch (e) {}
    if (fine) {
      var cur = document.createElement("div"); cur.className = "cur"; document.body.appendChild(cur); root.classList.add("has-cur");
      var x = -100, y = -100, cx = -100, cy = -100;
      (function loop() { cx += (x - cx) * 0.2; cy += (y - cy) * 0.2; cur.style.transform = "translate(" + cx.toFixed(1) + "px," + cy.toFixed(1) + "px)"; requestAnimationFrame(loop); })();
      document.addEventListener("mousemove", function (e) {
        x = e.clientX; y = e.clientY;
        var t = e.target.closest ? e.target : null;
        var card = t && t.closest("#site .card"), hot = t && t.closest("a,button,label,input");
        cur.classList.toggle("view", !!card); cur.classList.toggle("big", !card && !!hot);
        document.querySelectorAll("#site .card.tilt").forEach(function (k) { if (k !== card) { k.classList.remove("tilt"); } });
        if (card) {
          var r = card.getBoundingClientRect(), px = (e.clientX - r.left) / r.width - 0.5, py = (e.clientY - r.top) / r.height - 0.5;
          card.classList.add("tilt");
          card.style.setProperty("--rx", (-py * 16).toFixed(2) + "deg"); card.style.setProperty("--ry", (px * 16).toFixed(2) + "deg");
          card.style.setProperty("--gx", ((px + 0.5) * 100).toFixed(1) + "%"); card.style.setProperty("--gy", ((py + 0.5) * 100).toFixed(1) + "%");
        }
        var b = t && t.closest("#site .btn, #modal .btn");
        document.querySelectorAll(".btn.mag").forEach(function (k) { if (k !== b) k.classList.remove("mag"); });
        if (b) { var q = b.getBoundingClientRect(); b.classList.add("mag"); b.style.setProperty("--mx", ((e.clientX - q.left - q.width / 2) * 0.35).toFixed(1) + "px"); b.style.setProperty("--my", ((e.clientY - q.top - q.height / 2) * 0.45).toFixed(1) + "px"); }
        var hero = document.querySelector("#site .hero");
        if (hero) { hero.style.setProperty("--mx", (e.clientX / innerWidth - 0.5).toFixed(3)); hero.style.setProperty("--my", (e.clientY / innerHeight - 0.5).toFixed(3)); }
      }, { passive: true });
      document.addEventListener("mouseleave", function () { x = y = -100; });
    }
    var last = window.scrollY, v = 0, off = 0;
    window.addEventListener("scroll", function () { v = Math.min(80, v + Math.abs(window.scrollY - last)); last = window.scrollY; }, { passive: true });
    (function mq() {
      off += 0.7 + v * 0.35; v *= 0.9;
      document.querySelectorAll("#site .mqw .mq").forEach(function (m, i) {
        var w = m.scrollWidth / 3; if (!w) return;
        var o = off % w; m.style.transform = "translate3d(" + (i % 2 ? -o : -(w - o)) + "px,0,0)";
      });
      requestAnimationFrame(mq);
    })();
  }
  function reveal() {
    if (IS_ADMIN || typeof IntersectionObserver === "undefined") return;
    var root = document.documentElement;
    if (!root.classList.contains("rv")) { root.classList.add("rv"); setTimeout(function () { root.classList.add("rv-done"); }, 1800); }
    if (!root.__sc) {
      root.__sc = 1;
      var tick = false;
      var upd = function () {
        tick = false;
        var h = document.querySelector("#site .hero"); if (!h) return;
        var hh = h.offsetHeight, top = Math.min(64, window.innerHeight - hh);
        h.style.top = top + "px";
        var p = Math.max(0, Math.min(1, (window.scrollY - Math.max(0, -top)) / (hh * 0.85)));
        h.style.setProperty("--p", p.toFixed(3));
      };
      window.addEventListener("scroll", function () { if (!tick) { tick = true; requestAnimationFrame(upd); } }, { passive: true });
      window.addEventListener("resize", upd);
      window.__dlUpd = upd;
      setTimeout(function () { root.classList.add("sc"); upd(); }, 1850);
      upd();
    }
    if (!io) io = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); if (e.target.classList.contains("sec-head")) scramble(e.target.querySelector("h2")); } }); }, { rootMargin: "0px 0px -6% 0px" });
    if (window.__dlUpd) window.__dlUpd();
    fx();
    var n = 0;
    document.querySelectorAll("#site .card, #site .step, #site .box, #site .qa, #site .lk, #site .sec-head, #site .filters").forEach(function (el) {
      if (el.hasAttribute("data-rv")) return;
      el.setAttribute("data-rv", ""); el.style.setProperty("--d", (n++ % 6) * 70 + "ms"); io.observe(el);
    });
  }

  function renderModal() {
    var p = ui.open && byId(ui.open);
    if (!p) { $("#modal").innerHTML = ""; document.body.style.overflow = ""; return; }
    document.body.style.overflow = "hidden";
    var idx = Math.min(ui.photoIdx, Math.max(0, (p.photos || []).length - 1));
    var order = safeUrl(p.tgUrl) || safeUrl(state.links.order) || safeUrl(state.links.telegram);
    var avItem = safeUrl(p.avitoUrl), avProf = safeUrl(state.links.avito);
    var spec = [["Бренд", p.brand], ["Размер", p.size], ["Состояние", p.condition], ["Категория", catName(state, p.category)], ["Статус", STATUS[p.status]]]
      .filter(function (r) { return r[1]; }).map(function (r) { return "<dt>" + esc(r[0]) + "</dt><dd>" + esc(r[1]) + "</dd>"; }).join("");
    var thumbs = (p.photos || []).length > 1 ? '<div class="thumbs">' + p.photos.map(function (src, i) { return '<button data-ph="' + i + '" aria-current="' + (i === idx) + '" aria-label="Фото ' + (i + 1) + '"><img src="' + esc(src) + '" alt=""></button>'; }).join("") + "</div>" : "";
    var buy = p.status === "sold" ? '<span class="note">Эта вещь уже продана. Похожие ищите в каталоге и в канале.</span>' :
      (order ? '<a class="btn btn-primary" href="' + esc(order) + '" target="_blank" rel="noopener" data-goal="buy_click">' + (p.status === "reserved" ? "Спросить про бронь" : "Купить в Telegram") + "</a>" : "") +
      (avItem ? '<a class="btn btn-avito" href="' + esc(avItem) + '" target="_blank" rel="noopener" data-goal="avito_click">Купить на Авито</a>' :
        avProf ? '<a class="btn btn-avito" href="' + esc(avProf) + '" target="_blank" rel="noopener" data-goal="avito_profile">Заказать через Авито</a>' : "") +
      '<button class="btn btn-ghost" data-act="copy">Скопировать заявку</button>';
    $("#modal").innerHTML = '<div class="scrim" data-act="close-modal"><div class="modal" role="dialog" aria-modal="true" aria-label="' + esc(p.title) + '">' +
      '<div class="gal">' + photoBox(p, idx, true) + thumbs + "</div>" +
      '<div class="md"><button class="x" data-act="close-modal" aria-label="Закрыть">✕</button>' +
      (p.brand ? '<div class="brand">' + esc(p.brand) + "</div>" : "") + "<h3>" + esc(p.title) + "</h3>" +
      '<div class="price">' + esc(p.status === "sold" ? "Продано" : money(p.price)) + (p.oldPrice && p.status !== "sold" ? "<s>" + esc(money(p.oldPrice)) + "</s>" : "") + "</div>" +
      '<dl class="spec">' + spec + "</dl>" + (p.description ? '<div class="txt">' + paras(p.description) + "</div>" : "") +
      '<div class="acts">' + buy + "</div>" + '<p class="note" id="copy-note">Нажмите «Скопировать заявку» и вставьте текст в сообщение — так мы быстрее найдём вещь.</p>' +
      (safeUrl(p.postUrl) ? '<a class="note" href="' + esc(safeUrl(p.postUrl)) + '" target="_blank" rel="noopener" data-goal="tg_post">Открыть пост в канале</a>' : "") +
      "</div></div></div>";
  }

  /* ---------- admin: GitHub ---------- */
  var gh = null; // {owner, repo, branch, token}
  function cfgLoad() { try { return JSON.parse(localStorage.getItem("diluga-gh") || "null"); } catch (e) { return null; } }
  function cfgSave(c) { try { localStorage.setItem("diluga-gh", JSON.stringify(c)); } catch (e) {} }
  function cfgClear() { try { localStorage.removeItem("diluga-gh"); } catch (e) {} }
  function api(path, opts) {
    opts = opts || {};
    return fetch("https://api.github.com/repos/" + gh.owner + "/" + gh.repo + path, {
      method: opts.method || "GET",
      headers: Object.assign({ Authorization: "Bearer " + gh.token, Accept: opts.raw ? "application/vnd.github.raw+json" : "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" }, opts.body ? { "Content-Type": "application/json" } : {}),
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store"
    }).then(function (r) {
      if (!r.ok) { var e = new Error("HTTP " + r.status); e.status = r.status; throw e; }
      return opts.raw ? r.text() : r.json();
    });
  }
  function loadFromRepo() {
    return api("/contents/index.html?ref=" + encodeURIComponent(gh.branch), { raw: true }).then(function (html) {
      var m = html.match(/<script type="application\/json" id="shop-data">([\s\S]*?)<\/script>/);
      if (!m) throw new Error("no data");
      return JSON.parse(m[1]);
    });
  }
  function commitFiles(files, message) {
    // files: [{path, content (utf-8 string) | base64, encoding, delete}]
    var ref, baseTree;
    return api("/git/ref/heads/" + encodeURIComponent(gh.branch)).then(function (r) {
      ref = r.object.sha; return api("/git/commits/" + ref);
    }).then(function (c) {
      baseTree = c.tree.sha;
      return files.reduce(function (pr, f) {
        return pr.then(function (acc) {
          if (f.delete) { acc.push({ path: f.path, mode: "100644", type: "blob", sha: null }); return acc; }
          return api("/git/blobs", { method: "POST", body: { content: f.content, encoding: f.encoding || "utf-8" } }).then(function (b) { acc.push({ path: f.path, mode: "100644", type: "blob", sha: b.sha }); return acc; });
        });
      }, Promise.resolve([]));
    }).then(function (tree) {
      return api("/git/trees", { method: "POST", body: { base_tree: baseTree, tree: tree } });
    }).then(function (t) {
      return api("/git/commits", { method: "POST", body: { message: message, tree: t.sha, parents: [ref] } });
    }).then(function (c) {
      return api("/git/refs/heads/" + encodeURIComponent(gh.branch), { method: "PATCH", body: { sha: c.sha } });
    });
  }

  function photoPaths(st) { var s = {}; st.products.forEach(function (p) { (p.photos || []).forEach(function (u) { if (!/^(data:|https?:)/.test(u)) s[u] = 1; }); }); return s; }

  function publish() {
    if (!gh) return;
    ui.busy = true; say("Сохраняю… Не закрывайте страницу.");
    var out = clone(state), files = [], n = 0;
    out.settings.updatedAt = new Date().toISOString().slice(0, 10);
    if (!out.settings.faq || !out.settings.faq.length) out.settings.faq = clone(DEFAULT_FAQ);
    out.products.forEach(function (p) {
      p.photos = (p.photos || []).map(function (u) {
        if (!/^data:image\//.test(u)) return u;
        var path = "img/" + p.id + "-" + Date.now().toString(36) + (n++) + ".jpg";
        files.push({ path: path, content: u.split(",")[1], encoding: "base64" });
        return path;
      });
    });
    var before = photoPaths(saved), after = photoPaths(out);
    Object.keys(before).forEach(function (pth) { if (!after[pth]) files.push({ path: pth, delete: true }); });
    var v = Date.now().toString(36);
    files.push({ path: "index.html", content: buildIndexHtml(out, v) });
    var sm = buildSitemap(out); if (sm) files.push({ path: "sitemap.xml", content: sm });
    files.push({ path: "robots.txt", content: buildRobots(out) });
    files.push({ path: "llms.txt", content: buildLlms(out) });
    var host = (out.settings.siteUrl || "").replace(/^https?:\/\//, "").replace(/\/.*$/, "");
    if (host) files.push({ path: "CNAME", content: host + "\n" });
    commitFiles(files, "Обновление каталога из админки").then(function () {
      state = out; saved = clone(out); ui.busy = false; ui.dirty = false;
      say("Сохранено. Изменения появятся на сайте через 1–2 минуты.", "ok"); renderSite();
    }, function (e) {
      ui.busy = false;
      if (e.status === 401) say("Токен не подходит или истёк. Выйдите и войдите с новым токеном.", "err");
      else if (e.status === 403 || e.status === 404) say("Нет прав на запись в хранилище. Проверьте, что у токена есть доступ Contents: Read and write.", "err");
      else if (e.status === 409 || e.status === 422) say("Сайт только что изменился в другом окне. Обновите страницу и повторите правку.", "err");
      else say("Не получилось сохранить. Проверьте интернет и нажмите ещё раз.", "err");
    });
  }

  /* ---------- admin UI ---------- */
  function fld(label, attrs, value, type, hint) {
    var id = "f-" + attrs.replace(/[^\w]+/g, "-");
    var ctl = type === "textarea" ? '<textarea id="' + id + '" ' + attrs + ">" + esc(value) + "</textarea>" :
      '<input id="' + id + '" type="' + (type || "text") + '" ' + attrs + ' value="' + esc(value) + '">';
    return '<div class="fld"><label for="' + id + '">' + esc(label) + "</label>" + ctl + (hint ? '<span class="hint">' + esc(hint) + "</span>" : "") + "</div>";
  }
  function renderAdmin() {
    var el = $("#admin"); if (!el) return;
    if (!ui.admin) { el.innerHTML = ""; document.body.classList.remove("with-drawer"); return; }
    document.body.classList.add("with-drawer");
    var tabs = [["products", "Товары"], ["texts", "Тексты"], ["links", "Ссылки"], ["cats", "Категории"], ["seo", "SEO"]];
    var body = ui.tab === "products" ? (ui.editing ? productForm(byId(ui.editing)) : productList()) :
      ui.tab === "texts" ? textsForm() : ui.tab === "links" ? linksForm() : ui.tab === "cats" ? catsForm() : seoForm();
    el.innerHTML = '<aside class="drawer" aria-label="Админка"><div class="dh"><b>Админка</b><span class="hint">' + state.products.length + ' товаров</span><button class="ib" data-act="logout" style="margin-left:auto">Выйти</button></div>' +
      '<div class="tabs" role="tablist">' + tabs.map(function (t) { return '<button role="tab" data-tab="' + t[0] + '" aria-selected="' + (ui.tab === t[0]) + '">' + t[1] + "</button>"; }).join("") + "</div>" +
      '<div class="db">' + body + "</div>" +
      '<div class="df"><div class="msg ' + ui.msgKind + '" id="admin-msg">' + esc(ui.msg || (ui.dirty ? "Есть несохранённые изменения. Посетители увидят их после сохранения." : "Все изменения сохранены.")) + "</div>" +
      '<button class="btn btn-primary" data-act="publish"' + (ui.busy || !ui.dirty ? " disabled" : "") + ">" + (ui.busy ? "Сохраняю…" : "Сохранить на сайт") + "</button>" +
      '<button class="btn btn-ghost" data-act="revert"' + (ui.busy || !ui.dirty ? " disabled" : "") + ">Отменить изменения</button></div></aside>";
  }
  function productList() {
    var rows = state.products.map(function (p, i) {
      var th = p.photos && p.photos[0] ? '<img src="' + esc(p.photos[0]) + '" alt="">' : "";
      var del = ui.confirmDel === p.id ? '<button class="ib danger" data-pdel-yes="' + esc(p.id) + '">Удалить?</button><button class="ib" data-act="pdel-no">Нет</button>' :
        '<button class="ib danger" data-pdel="' + esc(p.id) + '" aria-label="Удалить">✕</button>';
      return '<div class="pi"><div class="tn">' + th + '</div><div style="min-width:0"><div class="nm">' + esc([p.brand, p.title].filter(Boolean).join(" · ") || "Без названия") + '</div><div class="sub">' + esc(money(p.price)) + (p.size ? " · " + esc(p.size) : "") + "</div>" +
        '<select class="st" data-pst="' + esc(p.id) + '" aria-label="Статус">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? " selected" : "") + ">" + STATUS[k] + "</option>"; }).join("") + "</select></div>" +
        '<div class="ops"><button class="ib" data-pup="' + i + '" aria-label="Выше"' + (i === 0 ? " disabled" : "") + '>↑</button><button class="ib" data-pedit="' + esc(p.id) + '">Изм.</button>' + del + "</div></div>";
    }).join("");
    return '<button class="btn btn-primary" data-act="padd">+ Добавить товар</button>' +
      '<div class="plist">' + (rows || '<div class="empty">Товаров пока нет.</div>') + "</div>" +
      '<p class="hint">Порядок в списке = порядок на сайте (проданные всегда внизу). Новый товар добавляется наверх.</p>';
  }
  function productForm(p) {
    if (!p) { ui.editing = null; return productList(); }
    var cats = '<option value="">Без категории</option>' + state.categories.map(function (c) { return '<option value="' + esc(c.id) + '"' + (p.category === c.id ? " selected" : "") + ">" + esc(c.name) + "</option>"; }).join("");
    var photos = (p.photos || []).map(function (src, i) {
      return '<div class="p"><img src="' + esc(src) + '" alt="">' + (i > 0 ? '<button class="mv" data-phfirst="' + i + '" aria-label="Сделать главным">★</button>' : "") + '<button data-phdel="' + i + '" aria-label="Удалить фото">✕</button></div>';
    }).join("");
    return '<button class="ib" data-act="pback" style="align-self:flex-start">← Все товары</button>' +
      fld("Название", 'data-pf="title"', p.title) +
      '<div class="row2">' + fld("Бренд", 'data-pf="brand"', p.brand) + fld("Размер", 'data-pf="size"', p.size) + "</div>" +
      '<div class="row2">' + fld("Цена, ₽", 'data-pf="price" inputmode="numeric"', p.price, "number") + fld("Старая цена, ₽", 'data-pf="oldPrice" inputmode="numeric"', p.oldPrice, "number", "Покажется зачёркнутой") + "</div>" +
      '<div class="row2"><div class="fld"><label for="f-cat">Категория</label><select id="f-cat" data-pf="category">' + cats + '</select></div>' +
      '<div class="fld"><label for="f-status">Статус</label><select id="f-status" data-pf="status">' + Object.keys(STATUS).map(function (k) { return '<option value="' + k + '"' + (p.status === k ? " selected" : "") + ">" + STATUS[k] + "</option>"; }).join("") + "</select></div></div>" +
      fld("Состояние", 'data-pf="condition" list="cond-list"', p.condition, "text", "Например: отличное, винтаж, кастом, есть дефект") +
      '<datalist id="cond-list"><option value="Новое с биркой"><option value="Отличное"><option value="Хорошее"><option value="Винтаж"><option value="Кастом"><option value="Есть дефект"></datalist>' +
      fld("Описание", 'data-pf="description"', p.description, "textarea") +
      fld("Ссылка на пост в канале", 'data-pf="postUrl"', p.postUrl, "url", "Необязательно. На сайте появится ссылка «Открыть пост в канале».") +
      fld("Ссылка для кнопки «Купить в Telegram»", 'data-pf="tgUrl"', p.tgUrl || "", "url", "Необязательно. Если пусто — кнопка ведёт на общий контакт для заказа из раздела «Ссылки».") +
      fld("Ссылка на объявление на Авито", 'data-pf="avitoUrl"', p.avitoUrl || "", "url", "Необязательно. Появится кнопка «Купить на Авито». Если пусто — кнопка ведёт на ваш профиль Авито (если он указан в «Ссылках»).") +
      '<label class="chk"><input type="checkbox" id="f-isnew" data-pfb="isNew"' + (p.isNew ? " checked" : "") + "> Отметить как новинку</label>" +
      '<div class="fld"><label>Фото (до 10, первое — главное)</label><div class="photos">' + photos +
      ((p.photos || []).length < 10 ? '<label class="up" aria-label="Добавить фото">+<input type="file" accept="image/*" multiple id="f-photos" data-upload="1"></label>' : "") +
      '</div><span class="hint">Фото автоматически уменьшаются до 1000 px.</span></div>';
  }
  function textsForm() {
    var s = state.settings;
    return '<p class="hint">Изменения сразу видны на сайте. Нажмите «Сохранить на сайт», чтобы их увидели посетители.</p>' +
      fld("Название магазина", 'data-sf="shopName"', s.shopName) + fld("Надпись над заголовком", 'data-sf="heroEyebrow"', s.heroEyebrow) +
      fld("Главный заголовок", 'data-sf="heroTitle"', s.heroTitle) + fld("Текст под заголовком", 'data-sf="heroText"', s.heroText, "textarea") +
      '<div class="sep"></div>' + fld("Заголовок каталога", 'data-sf="catalogTitle"', s.catalogTitle) + fld("Подпись каталога", 'data-sf="catalogNote"', s.catalogNote) +
      '<div class="sep"></div>' + fld("Заголовок «Как купить»", 'data-sf="howTitle"', s.howTitle) +
      (s.howTo || []).map(function (t, i) { return fld("Шаг " + (i + 1), 'data-how="' + i + '"', t, "textarea"); }).join("") +
      '<div class="sep"></div>' + fld("Заголовок блока доставки", 'data-sf="deliveryTitle"', s.deliveryTitle) +
      fld("Доставка", 'data-sf="deliveryText"', s.deliveryText, "textarea") + fld("Оплата", 'data-sf="paymentText"', s.paymentText, "textarea") + fld("Состояние и возврат", 'data-sf="returnText"', s.returnText, "textarea") +
      '<div class="sep"></div>' + fld("Заголовок «О магазине»", 'data-sf="aboutTitle"', s.aboutTitle) + fld("Текст о магазине", 'data-sf="aboutText"', s.aboutText, "textarea", "Новая строка = новый абзац") +
      fld("Короткий слоган (подвал и плашка)", 'data-sf="footerNote"', s.footerNote) +
      '<div class="sep"></div><div class="fld"><label>Частые вопросы</label><span class="hint">Показываются на сайте и помогают поисковикам и ИИ-ассистентам отвечать про магазин.</span></div>' +
      faqOf(state).map(function (x, i) {
        return '<div class="exl" style="grid-template-columns:minmax(0,1fr) auto">' + '<div style="display:flex;flex-direction:column;gap:8px;min-width:0">' + fld("Вопрос " + (i + 1), 'data-fq="' + i + '" data-fqf="q"', x.q) + fld("Ответ", 'data-fq="' + i + '" data-fqf="a"', x.a, "textarea") + "</div>" +
          '<button class="ib danger" data-fqdel="' + i + '" aria-label="Удалить вопрос">✕</button></div>';
      }).join("") + '<button class="btn btn-ghost btn-sm" data-act="fqadd" style="align-self:flex-start">+ Добавить вопрос</button>';
  }
  function linksForm() {
    var L = state.links;
    return fld("Telegram-канал", 'data-lf="telegram"', L.telegram, "url", "Кнопки «Telegram» и «Открыть канал»") +
      fld("Куда писать для заказа", 'data-lf="order"', L.order, "url", "Сюда ведёт кнопка «Купить в Telegram». Например: t.me/username") +
      fld("Профиль на Авито", 'data-lf="avito"', L.avito || "", "url", "Ссылка внизу сайта, в блоке «О магазине» и на кнопке «Заказать через Авито», если у вещи нет своего объявления.") +
      '<div class="sep"></div><div class="fld"><label>Дополнительные ссылки (блок «О магазине»)</label></div>' +
      (L.extra || []).map(function (e, i) {
        return '<div class="exl">' + fld("Название", 'data-ex="' + i + '" data-exf="label"', e.label) + fld("Ссылка", 'data-ex="' + i + '" data-exf="url"', e.url, "url") + '<button class="ib danger" data-exdel="' + i + '" aria-label="Удалить ссылку">✕</button></div>';
      }).join("") + '<button class="btn btn-ghost btn-sm" data-act="exadd" style="align-self:flex-start">+ Добавить ссылку</button>';
  }
  function catsForm() {
    return state.categories.map(function (c, i) {
      var n = state.products.filter(function (p) { return p.category === c.id; }).length;
      return '<div class="exl" style="grid-template-columns:minmax(0,1fr) auto auto">' + fld("Категория " + (i + 1) + " · товаров: " + n, 'data-cf="' + i + '"', c.name) +
        '<button class="ib" data-cup="' + i + '"' + (i === 0 ? " disabled" : "") + ' aria-label="Выше">↑</button><button class="ib danger" data-cdel="' + i + '" aria-label="Удалить категорию">✕</button></div>';
    }).join("") + '<button class="btn btn-ghost btn-sm" data-act="cadd" style="align-self:flex-start">+ Добавить категорию</button><p class="hint">При удалении категории её товары останутся, но будут без категории.</p>';
  }
  function seoForm() {
    var s = state.settings;
    return '<p class="hint">Так сайт выглядит в поиске Яндекса и Google и в превью ссылок.</p>' +
      fld("Адрес сайта", 'data-sf="siteUrl"', s.siteUrl, "url", "Например: https://diluga85.ru — после покупки домена впишите его сюда") +
      fld("Заголовок в поиске (до 70 символов)", 'data-sf="metaTitle"', s.metaTitle) +
      fld("Описание в поиске (до 160 символов)", 'data-sf="metaDescription"', s.metaDescription, "textarea") +
      '<div class="sep"></div>' + fld("Код Яндекс Вебмастера", 'data-sf="yandexVerification"', s.yandexVerification || "", "text", "Только значение content из мета-тега yandex-verification") +
      fld("Код Google Search Console", 'data-sf="googleVerification"', s.googleVerification || "", "text", "Только значение content из мета-тега google-site-verification") +
      fld("Номер счётчика Яндекс Метрики", 'data-sf="metrikaId" inputmode="numeric"', s.metrikaId || "", "text", "Только цифры, например 113803023. Пусто — счётчик не ставится");
  }

  function changed(full) { ui.dirty = true; ui.msg = ""; ui.msgKind = ""; renderSite(); if (full) renderAdmin(); else updateFooter(); }
  function updateFooter() {
    var m = $("#admin-msg"); if (m) { m.className = "msg"; m.textContent = "Есть несохранённые изменения. Посетители увидят их после сохранения."; }
    var pb = $('[data-act="publish"]'), rb = $('[data-act="revert"]'); if (pb) pb.disabled = ui.busy; if (rb) rb.disabled = ui.busy;
  }
  function say(msg, kind) { ui.msg = msg; ui.msgKind = kind || ""; renderAdmin(); }

  function resize(file) {
    return new Promise(function (res, rej) {
      var r = new FileReader(); r.onerror = rej;
      r.onload = function () {
        var img = new Image(); img.onerror = rej;
        img.onload = function () {
          var max = 1000, w = img.naturalWidth, h = img.naturalHeight, k = Math.min(1, max / Math.max(w, h));
          var c = document.createElement("canvas"); c.width = Math.round(w * k); c.height = Math.round(h * k);
          c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
          res(c.toDataURL("image/jpeg", 0.8));
        };
        img.src = r.result;
      };
      r.readAsDataURL(file);
    });
  }

  /* ---------- login (admin.html) ---------- */
  function renderLogin(msg, kind) {
    var c = cfgLoad() || {};
    $("#site").innerHTML = '<form class="login" id="login"><h1>Вход в админку</h1>' +
      '<p class="msg">Нужен токен доступа GitHub с правом записи в хранилище сайта. Токен хранится только в этом браузере.</p>' +
      fld("Логин на GitHub", 'name="owner" autocomplete="username" required', c.owner || "") +
      fld("Название хранилища", 'name="repo" required', c.repo || "diluga85") +
      fld("Токен доступа", 'name="token" autocomplete="off" required', "", "password") +
      (msg ? '<p class="msg ' + (kind || "") + '">' + esc(msg) + "</p>" : "") +
      '<button class="btn btn-primary" type="submit">Войти</button></form>';
  }
  function startAdmin(c) {
    gh = { owner: c.owner, repo: c.repo, branch: c.branch || "main", token: c.token };
    $("#site").innerHTML = '<div class="login"><p class="msg">Загружаю каталог…</p></div>';
    api("").then(function (r) { gh.branch = c.branch || r.default_branch || "main"; return loadFromRepo(); }).then(function (data) {
      cfgSave(gh); state = data; saved = clone(data); ui.admin = true; renderSite(); renderAdmin();
    }, function (e) {
      gh = null;
      renderLogin(e.status === 401 ? "Токен не подходит. Проверьте, что скопировали его целиком." : e.status === 404 ? "Хранилище не найдено или у токена нет к нему доступа." : "Не получилось загрузить каталог. Проверьте данные и интернет.", "err");
    });
  }

  /* ---------- events ---------- */
  document.addEventListener("submit", function (ev) {
    if (ev.target.id !== "login") return;
    ev.preventDefault();
    var f = ev.target;
    startAdmin({ owner: f.owner.value.trim(), repo: f.repo.value.trim(), token: f.token.value.trim() });
  });

  document.addEventListener("click", function (ev) {
    var t = ev.target.closest("[data-act],[data-cat],[data-open],[data-ph],[data-tab],[data-pedit],[data-pdel],[data-pdel-yes],[data-pup],[data-phdel],[data-phfirst],[data-exdel],[data-fqdel],[data-cdel],[data-cup]");
    if (!t || !state) return;
    var d = t.dataset, act = d.act;
    if (act === "close-modal") { if (ev.target !== t) return; ui.open = null; renderModal(); return; }
    if (d.cat) { ui.cat = d.cat; renderSite(); return; }
    if (d.open) { ui.open = d.open; ui.photoIdx = 0; renderModal(); goal("open_item"); return; }
    if (d.ph) { ui.photoIdx = +d.ph; renderModal(); return; }
    if (act === "copy") {
      goal("copy_request");
      var p = byId(ui.open); if (!p) return;
      var txt = "Здравствуйте! Хочу купить: " + [p.brand, p.title].filter(Boolean).join(" ") + (p.size ? ", размер " + p.size : "") + (p.price ? ", " + money(p.price) : "") + (p.postUrl ? " — " + p.postUrl : "");
      var note = $("#copy-note");
      try { navigator.clipboard.writeText(txt).then(function () { if (note) note.textContent = "Скопировано. Вставьте текст в сообщение в Telegram."; }, function () { if (note) note.textContent = txt; }); } catch (e) { if (note) note.textContent = txt; }
      return;
    }
    if (!IS_ADMIN || !gh) return;
    if (act === "logout") { cfgClear(); gh = null; ui.admin = false; state = null; renderAdmin(); renderLogin("Вы вышли из админки."); return; }
    if (d.tab) { ui.tab = d.tab; ui.editing = null; ui.confirmDel = null; renderAdmin(); return; }
    if (act === "publish") { publish(); return; }
    if (act === "revert") { state = clone(saved); ui.dirty = false; ui.editing = null; ui.msg = ""; renderSite(); renderAdmin(); renderModal(); return; }
    if (act === "padd") {
      var np = { id: "p" + Date.now().toString(36), title: "", brand: "", size: "", condition: "", price: "", oldPrice: "", category: ui.cat !== "all" ? ui.cat : (state.categories[0] ? state.categories[0].id : ""), status: "available", isNew: true, description: "", postUrl: "", tgUrl: "", avitoUrl: "", photos: [] };
      state.products.unshift(np); ui.editing = np.id; changed(true); var f = $('[data-pf="title"]'); if (f) f.focus(); return;
    }
    if (act === "pback") { ui.editing = null; renderAdmin(); return; }
    if (act === "pdel-no") { ui.confirmDel = null; renderAdmin(); return; }
    if (d.pedit) { ui.editing = d.pedit; renderAdmin(); return; }
    if (d.pdel) { ui.confirmDel = d.pdel; renderAdmin(); return; }
    if (d.pdelYes) { state.products = state.products.filter(function (p) { return p.id !== d.pdelYes; }); ui.confirmDel = null; if (ui.open === d.pdelYes) { ui.open = null; renderModal(); } changed(true); return; }
    if (d.pup) { var i = +d.pup; if (i > 0) { var a = state.products, x = a[i]; a[i] = a[i - 1]; a[i - 1] = x; changed(true); } return; }
    if (d.phdel) { var pe = byId(ui.editing); if (pe) { pe.photos.splice(+d.phdel, 1); changed(true); } return; }
    if (d.phfirst) { var pf = byId(ui.editing); if (pf) { var src = pf.photos.splice(+d.phfirst, 1)[0]; pf.photos.unshift(src); changed(true); } return; }
    if (act === "fqadd") { state.settings.faq = clone(faqOf(state)); state.settings.faq.push({ q: "", a: "" }); changed(true); return; }
    if (d.fqdel) { state.settings.faq = clone(faqOf(state)); state.settings.faq.splice(+d.fqdel, 1); changed(true); return; }
    if (act === "exadd") { state.links.extra = state.links.extra || []; state.links.extra.push({ label: "", url: "" }); changed(true); return; }
    if (d.exdel) { state.links.extra.splice(+d.exdel, 1); changed(true); return; }
    if (act === "cadd") { state.categories.push({ id: "c" + Date.now().toString(36), name: "Новая категория" }); changed(true); return; }
    if (d.cdel) { var cid = state.categories[+d.cdel].id; state.categories.splice(+d.cdel, 1); state.products.forEach(function (p) { if (p.category === cid) p.category = ""; }); if (ui.cat === cid) ui.cat = "all"; changed(true); return; }
    if (d.cup) { var j = +d.cup; if (j > 0) { var cs = state.categories, y = cs[j]; cs[j] = cs[j - 1]; cs[j - 1] = y; changed(true); } return; }
  });

  document.addEventListener("input", function (ev) {
    if (!IS_ADMIN || !gh) return;
    var t = ev.target, d = t.dataset;
    if (d.pf) {
      var p = byId(ui.editing); if (!p) return;
      var v = t.value;
      if (d.pf === "price" || d.pf === "oldPrice") v = v === "" ? "" : Math.max(0, Math.round(+v));
      p[d.pf] = v; changed(t.tagName === "SELECT"); return;
    }
    if (d.sf) { state.settings[d.sf] = t.value; changed(false); return; }
    if (d.how) { state.settings.howTo[+d.how] = t.value; changed(false); return; }
    if (d.lf) { state.links[d.lf] = t.value; changed(false); return; }
    if (d.exf) { state.links.extra[+d.ex][d.exf] = t.value; changed(false); return; }
    if (d.cf) { state.categories[+d.cf].name = t.value; changed(false); return; }
    if (d.fqf) { if (!state.settings.faq || !state.settings.faq.length) state.settings.faq = clone(DEFAULT_FAQ); state.settings.faq[+d.fq][d.fqf] = t.value; changed(false); return; }
  });

  document.addEventListener("change", function (ev) {
    var t = ev.target, d = t.dataset;
    if (t.id === "only-avail" && state) { ui.onlyAvail = t.checked; renderSite(); return; }
    if (!IS_ADMIN || !gh) return;
    if (d.pst) { var p = byId(d.pst); if (p) { p.status = t.value; changed(true); } return; }
    if (d.pfb) { var q = byId(ui.editing); if (q) { q[d.pfb] = t.checked; changed(false); } return; }
    if (d.upload) {
      var pe = byId(ui.editing); if (!pe) return;
      var files = Array.prototype.slice.call(t.files || []).slice(0, 10 - pe.photos.length);
      if (!files.length) return;
      say("Обрабатываю фото…");
      files.reduce(function (pr, f) { return pr.then(function () { return resize(f).then(function (u) { pe.photos.push(u); }); }); }, Promise.resolve())
        .then(function () { changed(true); }, function () { changed(true); say("Не удалось прочитать одно из фото. Попробуйте JPG или PNG.", "err"); });
    }
  });

  function goal(name) {
    if (IS_ADMIN || !state) return;
    var id = String(state.settings.metrikaId || "").trim();
    try { if (/^\d+$/.test(id) && typeof window.ym === "function") window.ym(+id, "reachGoal", name); } catch (e) {}
  }
  document.addEventListener("click", function (ev) { var g = ev.target.closest && ev.target.closest("[data-goal]"); if (g) goal(g.getAttribute("data-goal")); });
  document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && ui.open) { ui.open = null; renderModal(); } });
  window.addEventListener("beforeunload", function (ev) { if (ui.dirty) { ev.preventDefault(); ev.returnValue = ""; } });

  /* ---------- bulk helpers for admin (used for imports) ---------- */
  root.Diluga.admin = {
    products: function () { return state ? state.products.map(function (p) { return { id: p.id, title: p.title, photos: (p.photos || []).slice() }; }) : null; },
    touch: function () { if (!IS_ADMIN || !gh || !state) return false; changed(true); return true; },
    setPhotos: function (id, arr) { if (!IS_ADMIN || !gh || !state) return false; var p = byId(id); if (!p) return false; p.photos = arr.slice(); changed(true); return true; }
  };

  /* ---------- boot ---------- */
  if (IS_ADMIN) {
    var c = cfgLoad();
    if (c && c.token) startAdmin(c); else renderLogin();
  } else {
    var el = document.getElementById("shop-data");
    if (el) { state = JSON.parse(el.textContent); saved = clone(state); deepLink(); }
  }
  /* ?cat=jeans — открыть каталог на категории; ?item=tg192 — сразу открыть товар (для рекламы) */
  function deepLink() {
    var q = {};
    try { location.search.replace(/^\?/, "").split("&").forEach(function (kv) { var i = kv.indexOf("="); if (i > 0) q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1)); }); } catch (e) {}
    var c = q.cat, it = q.item;
    if (c && state.categories.some(function (x) { return x.id === c; })) ui.cat = c;
    renderSite();
    if (it && byId(it)) { ui.open = it; ui.photoIdx = 0; renderModal(); goal("open_item"); }
    else if (ui.cat !== "all") { var sec = document.getElementById("catalog"); if (sec && sec.scrollIntoView) setTimeout(function () { sec.scrollIntoView(); }, 0); }
  }
})(typeof window !== "undefined" ? window : this);
