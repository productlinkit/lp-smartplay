import C from "./config.js";

(() => {
  const app = document.getElementById("app");
  const devRoot = document.getElementById("dev");
  const MY_DIGITS = "၀၁၂၃၄၅၆၇၈၉";
  const params = new URLSearchParams(location.search);
  const SCREENS = ["landing", "offer", "confirm", "success", "portal", "games", "blocked", "error"];

  const session = {
    get(k) { try { return JSON.parse(sessionStorage.getItem(k)); } catch { return null; } },
    set(k, v) { try { sessionStorage.setItem(k, JSON.stringify(v)); } catch { /* storage unavailable */ } },
  };

  // ── Simulation switches (demo panel) ────────────────────────────────
  // Order of precedence: query params (?net=blocked&sub=active&result=error), then this tab's saved choice.
  const sim = Object.assign({ network: "ok", user: "new", result: "success" }, session.get("sp-sim") || {});
  if (params.get("net")) sim.network = params.get("net") === "blocked" ? "blocked" : "ok";
  if (params.get("sub")) sim.user = params.get("sub") === "active" ? "active" : "new";
  if (params.get("result")) sim.result = params.get("result") === "error" ? "error" : "success";
  const devOn = params.get("dev") === "1" || location.hash === "#dev";
  const saveSim = () => session.set("sp-sim", sim);

  const state = {
    lang: params.get("lang") === "en" ? "en" : params.get("lang") === "my" ? "my" : C.defaultLang,
    pkg: C.defaultPackage,
    plan: session.get("sp-plan"),
    screen: null,
    busy: false,
    resume: "landing",      // where "Try Again" on the blocked screen continues to
    sheet: false,
    devOpen: false,
    games: null,            // PlayVerse catalogue, loaded the first time it is opened
    gameQuery: "",
    gameGenre: "all",
    landingScroll: 0,
  };
  let dict = { en: {}, my: {} };

  // ── Copy helpers ────────────────────────────────────────────────────
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const num = n => state.lang === "my" ? String(n).replace(/\d/g, d => MY_DIGITS[d]) : String(n);
  function t(key, vars = {}) {
    let s = dict[state.lang][key] ?? dict.en[key] ?? key;
    for (const [k, v] of Object.entries(vars)) s = s.split(`{${k}}`).join(v);
    return s;
  }
  // Escaped copy with one placeholder wrapped in a highlight span.
  const withMark = (key, name, text, cls) => esc(t(key, { [name]: "\u0000" })).replace("\u0000", `<span class="${cls}">${esc(text)}</span>`);
  const withCode = key => withMark(key, "cancelCode", C.cancelCode, "code");
  const pkgById = id => C.packages.find(p => p.id === id) || C.packages[0];
  const price = p => t("price", { amount: num(p.price) });

  // Query string for outbound app links: everything the user arrived with except the prototype's own switches.
  function forwardQuery(url) {
    const q = new URLSearchParams(location.search);
    C.internalParams.forEach(k => q.delete(k));
    const s = q.toString();
    return s ? url + (url.includes("?") ? "&" : "?") + s : url;
  }
  const linkHref = key => C.links[key] ? forwardQuery(C.links[key]) : "#";

  // ── Icons ───────────────────────────────────────────────────────────
  const ICON = {
    check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    checkWhite: '<svg viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>',
    wifiOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 3l18 18"/><path d="M8.5 16.4a5 5 0 0 1 7 0"/><path d="M5 12.9a10 10 0 0 1 5.2-2.7"/><path d="M14.7 10.4A10 10 0 0 1 19 12.9"/><path d="M2 9.2a15 15 0 0 1 4.3-2.6"/><path d="M10.7 5.1A15 15 0 0 1 22 9.2"/><circle cx="12" cy="20" r="1.1" fill="currentColor"/></svg>',
    alert: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 7v6"/><circle cx="12" cy="16.6" r="1.1" fill="currentColor"/></svg>',
    info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9.5"/><path d="M12 11v5.5"/><circle cx="12" cy="7.8" r="1" fill="currentColor"/></svg>',
    back: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
    search: '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/></svg>',
    close: '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  };

  // ── Shared pieces ───────────────────────────────────────────────────
  const topbar = () => `
    <header class="topbar">
      <div class="brand"><img src="assets/smartplay.webp" alt="" width="40" height="40"><span>${esc(t("brand"))}</span></div>
      <div class="lang" role="group" aria-label="${esc(t("lang.group"))}">
        <button type="button" data-action="lang" data-lang="my" lang="my" aria-pressed="${state.lang === "my"}" title="မြန်မာ">MY</button>
        <button type="button" data-action="lang" data-lang="en" lang="en" aria-pressed="${state.lang === "en"}" title="English">EN</button>
      </div>
    </header>`;

  const appRows = () => C.apps.map(a => `
    <li class="app-row">
      <img class="app-icon" src="${a.icon}" alt="" width="56" height="56" loading="lazy">
      <div class="app-text"><h3 class="app-name">${esc(a.name)}</h3><p class="app-desc">${esc(t(`apps.${a.id}.desc`))}</p></div>
    </li>`).join("");

  const spinner = '<span class="spinner" aria-hidden="true"></span>';

  // ── Screens ─────────────────────────────────────────────────────────
  function landing() {
    const pkgs = C.packages.map(p => {
      const on = p.id === state.pkg;
      return `
        <label class="pkg${on ? " is-selected" : ""}">
          <input type="radio" name="pkg" id="pkg-${p.id}" value="${p.id}"${on ? " checked" : ""}>
          <span class="pkg-top"><span class="pkg-name">${esc(t(`packages.${p.id}.name`))}</span><span class="pkg-dot">${ICON.checkWhite}</span></span>
          <span class="pkg-price">${esc(price(p))}</span>
          <span class="pkg-access">${esc(t(`packages.${p.id}.access`))}</span>
        </label>`;
    }).join("");

    return `
      <div class="screen has-bar">
        ${topbar()}
        <section class="panel hero">
          <div class="hero-art">
            <img src="assets/hero.webp" alt="" width="800" height="495" fetchpriority="high">
            <ul class="hero-apps" aria-label="QuizPro, SpeakEasy, PlayVerse">
              ${C.apps.map((a, i) => `<li style="--i:${i}"><img src="${a.icon}" alt="" width="70" height="70"><span>${esc(a.name)}</span></li>`).join("")}
            </ul>
          </div>
          <div class="hero-copy">
            <h1 tabindex="-1">${esc(t("landing.header"))}</h1>
            <p class="tagline">${esc(t("landing.tagline"))}</p>
          </div>
        </section>

        <section class="panel plan" aria-labelledby="pkg-label">
          <h2 class="section-title" id="pkg-label">${esc(t("landing.packageLabel"))}</h2>
          <fieldset class="pkgs" aria-labelledby="pkg-label">${pkgs}</fieldset>
          <div class="cta">
            <button type="button" class="btn btn-primary btn-lg" id="cta-inline" data-action="subscribe">${esc(t("landing.subscribe"))}</button>
            <p class="fine">${withCode("landing.finePrint")} <a href="${esc(linkHref("terms"))}" data-link="terms">${esc(t("links.terms"))}</a></p>
          </div>
        </section>

        <section class="panel plan" aria-labelledby="get-label">
          <h2 class="section-title" id="get-label">${esc(t("landing.whatYouGet"))}</h2>
          <ul class="apps">${appRows()}</ul>
        </section>

        <footer class="footer">
          <a href="${esc(linkHref("terms"))}" data-link="terms">${esc(t("links.terms"))}</a><span aria-hidden="true">·</span>
          <a href="${esc(linkHref("privacy"))}" data-link="privacy">${esc(t("links.privacy"))}</a><span aria-hidden="true">·</span>
          <a href="${esc(linkHref("help"))}" data-link="help">${esc(t("links.help"))}</a>
        </footer>
      </div>
      <div class="sticky-bar is-off" id="sticky-bar">
        <button type="button" class="btn btn-primary btn-lg" data-action="subscribe" tabindex="-1">${esc(t("landing.subscribe"))}</button>
      </div>`;
  }

  // Offer: one-viewport pitch between package choice and the consent page; the price lines follow the chosen package.
  function offer() {
    const p = pkgById(state.pkg);
    const amount = t("offer.price", { amount: num(p.price) });
    return `
      <div class="screen offer">
        ${topbar()}
        <div class="offer-art" role="img" aria-label="QuizPro, SpeakEasy, PlayVerse">
          <div class="offer-phone">
            <div class="offer-phone-screen">
              <img src="assets/hero.webp" alt="" width="800" height="495" fetchpriority="high">
              <span class="offer-brand"><img src="assets/smartplay.webp" alt="" width="56" height="56">${esc(t("brand"))}</span>
            </div>
          </div>
          ${C.apps.map((a, i) => `<span class="offer-bubble" style="--i:${i}"><img src="${a.icon}" alt="" width="64" height="64"></span>`).join("")}
        </div>
        <section class="offer-card">
          <h1 tabindex="-1"><span>${esc(t("offer.title1"))}</span> <span class="hl">${esc(t("offer.title2"))}</span></h1>
          <button type="button" class="btn btn-yellow btn-lg" data-action="offer-continue">${esc(t("offer.button"))}</button>
          <p class="offer-terms">${withMark(`offer.${p.id}.line1`, "price", amount, "offer-price")}<br>${esc(t(`offer.${p.id}.line2`))}</p>
        </section>
      </div>`;
  }

  // Stand-in for ATOM's own consent page: deliberately plain, no ATOM branding.
  // The service line is one translated string ("Smart Play · 3 Days"); it is shown as title + package tag.
  function confirm() {
    const p = pkgById(state.pkg);
    const service = t("confirm.service", { name: t(`packages.${p.id}.name`) });
    const cut = service.indexOf(" · ");
    const [svc, plan] = cut < 0 ? [service, ""] : [service.slice(0, cut), service.slice(cut + 3)];
    return `
      <div class="op">
        <div class="op-body">
          <div class="op-summary">
            <div class="op-head">
              <img class="op-app" src="assets/smartplay.webp" alt="" width="48" height="48">
              <h1 class="op-service" tabindex="-1" aria-label="${esc(service)}">
                <span>${esc(svc)}</span>${plan ? `<span class="op-plan">${esc(plan)}</span>` : ""}
              </h1>
            </div>
            <p class="op-price">${esc(price(p))}</p>
          </div>
          <p class="op-cancel">${ICON.info}<span>${withCode("confirm.cancel")}</span></p>
        </div>
        <div class="op-actions">
          <button type="button" class="btn btn-dark" data-action="confirm"${state.busy ? ' disabled aria-busy="true"' : ""}>${state.busy ? spinner : ""}${esc(t("confirm.confirm"))}</button>
          <button type="button" class="btn btn-plain" data-action="not-now"${state.busy ? " disabled" : ""}>${esc(t("confirm.notNow"))}</button>
        </div>
      </div>`;
  }

  function success() {
    const colors = ["#F6D35B", "#1F2A5C", "#4FB3F6", "#F2709C", "#1E8E5A"];
    const bits = Array.from({ length: 18 }, (_, i) =>
      `<i style="left:${(i * 53) % 100}%;background:${colors[i % colors.length]};animation-delay:${(i % 6) * 0.08}s"></i>`).join("");
    return landing() + `
      <div class="scrim" role="dialog" aria-modal="true" aria-labelledby="ok-title">
        <div class="modal">
          <div class="confetti" aria-hidden="true">${bits}</div>
          <div class="badge" style="color:var(--navy)">${ICON.check}</div>
          <h2 id="ok-title">${esc(t("success.title"))}</h2>
          <p>${esc(t("success.text"))}</p>
          <button type="button" class="btn btn-primary btn-lg" data-action="start" id="start-btn">${esc(t("success.button"))}</button>
        </div>
      </div>`;
  }

  function portal() {
    const plan = pkgById(state.plan || state.pkg);
    const cards = C.apps.map(a => `
      <li class="panel app-card">
        <div class="app-card-top">
          <img class="app-icon" src="${a.icon}" alt="" width="72" height="72">
          <div class="app-text"><h2 class="app-name">${esc(a.name)}</h2><p class="app-desc">${esc(t(`apps.${a.id}.desc`))}</p></div>
        </div>
        ${a.catalog
          ? `<button type="button" class="btn btn-primary" data-action="open-catalog" aria-label="${esc(t("portal.open"))} ${esc(a.name)}">${esc(t("portal.open"))}</button>`
          : a.url
          ? `<a class="btn btn-primary" href="${esc(forwardQuery(a.url))}" target="_blank" rel="noopener" aria-label="${esc(t("portal.open"))} ${esc(a.name)}">${esc(t("portal.open"))}</a>`
          : `<button type="button" class="btn btn-primary" data-action="open-missing" data-app="${esc(a.name)}" aria-label="${esc(t("portal.open"))} ${esc(a.name)}">${esc(t("portal.open"))}</button>`}
      </li>`).join("");

    return `
      <div class="screen">
        ${topbar()}
        <section class="panel portal-head">
          <h1 tabindex="-1">${esc(t("portal.title"))}</h1>
          <span class="chip">${esc(t(`portal.status.${plan.id}`))}</span>
        </section>
        <ul class="apps">${cards}</ul>
        <div class="center-link"><button type="button" data-action="how-cancel">${esc(t("portal.howToCancel"))}</button></div>
      </div>
      ${state.sheet ? `
      <div class="scrim sheet-scrim" data-action="close-sheet">
        <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-title">
          <div class="sheet-head">
            <h2 id="sheet-title">${esc(t("portal.howToCancel"))}</h2>
            <button type="button" class="icon-btn" data-action="close-sheet" aria-label="${esc(t("a11y.close"))}">${ICON.close}</button>
          </div>
          <p>${withCode("confirm.cancel")}</p>
          <div class="dial" aria-hidden="true">${esc(C.cancelCode)}</div>
        </div>
      </div>` : ""}`;
  }

  // PlayVerse catalogue: the Mega Combo games from the Smart Play portal, each tile opens the game itself.
  function games() {
    const list = state.games || [];
    const counts = {};
    list.forEach(g => { counts[g.genre] = (counts[g.genre] || 0) + 1; });
    const genres = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const chip = (id, label, n) =>
      `<button type="button" class="genre" data-action="genre" data-genre="${esc(id)}" aria-pressed="${state.gameGenre === id}">${esc(label)} <span>${num(n)}</span></button>`;
    return `
      <div class="screen">
        <header class="panel catalog-head">
          <div class="catalog-title">
            <button type="button" class="icon-btn" data-action="back-portal" aria-label="${esc(t("a11y.back"))}">${ICON.back}</button>
            <img src="assets/playverse.webp" alt="" width="44" height="44">
            <div class="app-text">
              <h1 class="app-name" tabindex="-1">PlayVerse</h1>
              <p class="catalog-sub">${esc(t("games.count", { n: num(list.length) }))}</p>
            </div>
          </div>
          <label class="search">${ICON.search}<span class="sr-only">${esc(t("games.search"))}</span>
            <input type="search" id="game-search" placeholder="${esc(t("games.search"))}" value="${esc(state.gameQuery)}" autocomplete="off" enterkeyhint="search">
          </label>
          <div class="genres" role="group" aria-label="Genre">${chip("all", t("games.all"), list.length)}${genres.map(([g, n]) => chip(g, g, n)).join("")}</div>
        </header>
        <ul class="game-grid" id="game-grid">${gameTiles()}</ul>
      </div>`;
  }

  function gameTiles() {
    const q = state.gameQuery.trim().toLowerCase();
    const shown = (state.games || []).filter(g => (state.gameGenre === "all" || g.genre === state.gameGenre) && (!q || g.name.toLowerCase().includes(q)));
    if (!shown.length) return `<li class="panel game-empty">${esc(t("games.empty"))}</li>`;
    return shown.map(g => `
      <li><a class="game" href="${esc(g.url)}" target="_blank" rel="noopener">
        <span class="game-thumb">${g.thumb ? `<img src="${esc(g.thumb)}" alt="" width="240" height="240" loading="lazy">` : ""}</span>
        <span class="game-name">${esc(g.name)}</span>
        <span class="game-genre">${esc(g.genre)}</span>
      </a></li>`).join("");
  }

  const status = (icon, titleKey, textKey, actions) => `
    <div class="screen">
      ${topbar()}
      <section class="panel status" id="status-panel">
        <div class="status-icon" style="color:var(--navy)">${icon}</div>
        <h1 tabindex="-1">${esc(t(titleKey))}</h1>
        <p>${esc(t(textKey))}</p>
        <div class="actions">${actions}</div>
      </section>
    </div>`;

  const blocked = () => status(ICON.wifiOff, "blocked.title", "blocked.text",
    `<button type="button" class="btn btn-primary btn-lg" data-action="retry-blocked"${state.busy ? ' disabled aria-busy="true"' : ""}>${state.busy ? spinner : ""}${esc(t("blocked.button"))}</button>`);

  const error = () => status(ICON.alert, "error.title", "error.text",
    `<button type="button" class="btn btn-primary btn-lg" data-action="retry-error">${esc(t("error.retry"))}</button>
     <button type="button" class="btn btn-ghost" data-action="back-packages">${esc(t("error.back"))}</button>`);

  const VIEWS = { landing, offer, confirm, success, portal, games, blocked, error };

  // ── Rendering & navigation ──────────────────────────────────────────
  let observer = null;
  function render({ focus = false } = {}) {
    document.documentElement.lang = state.lang;
    document.body.classList.toggle("is-op", state.screen === "confirm");
    app.innerHTML = VIEWS[state.screen]();
    wireStickyBar();
    renderDev();
    if (focus) {
      const target = state.screen === "success" ? document.getElementById("start-btn") : app.querySelector("h1[tabindex]");
      target?.focus({ preventScroll: true });
    }
  }

  // Show the bottom bar only while the in-page button is out of sight, so the bar never sits on the price or fine print.
  function wireStickyBar() {
    observer?.disconnect();
    const bar = document.getElementById("sticky-bar");
    const inline = document.getElementById("cta-inline");
    if (!bar || !inline) return;
    if (!("IntersectionObserver" in window)) { bar.classList.remove("is-off"); return; }
    observer = new IntersectionObserver(([e]) => {
      const off = e.isIntersecting;
      bar.classList.toggle("is-off", off);
      bar.querySelector("button").tabIndex = off ? -1 : 0;
    }, { rootMargin: `0px 0px -${bar.offsetHeight || 80}px 0px` });
    observer.observe(inline);
  }

  // The URL keeps its query string (and #dev) on every step; the screen lives in history state.
  // The offer screen has its own path (/offer?pkg=daily) so it can be linked and Back lands on the packages.
  const BASE = import.meta.env.BASE_URL;
  const OFFER_PATH = BASE + "offer";
  function url(screen) {
    const q = new URLSearchParams(location.search);
    if (screen === "offer") q.set("pkg", state.pkg); else q.delete("pkg");
    const qs = q.toString();
    return (screen === "offer" ? OFFER_PATH : BASE) + (qs ? "?" + qs : "") + (devOn ? "#dev" : "");
  }
  function go(screen, { replace = false, push = true } = {}) {
    if (state.screen === "landing" && screen !== "landing" && screen !== "success") state.landingScroll = scrollY;
    const from = state.screen;
    state.screen = screen;
    state.busy = false;
    state.sheet = false;
    if (push) {
      try { history[replace ? "replaceState" : "pushState"]({ screen, pkg: state.pkg }, "", url(screen)); } catch { /* sandboxed history */ }
    }
    render({ focus: true });
    const restore = screen === "landing" && (from === "offer" || from === "confirm" || from === "error");
    if (screen !== "success") scrollTo(0, restore ? state.landingScroll : 0);
  }

  function entry() {
    if (sim.network === "blocked") { state.resume = sim.user === "active" ? "portal" : "landing"; return "blocked"; }
    return sim.user === "active" ? "portal" : "landing";
  }

  function toast(msg) {
    document.querySelector(".toast")?.remove();
    const el = document.createElement("div");
    el.className = "toast"; el.setAttribute("role", "status"); el.textContent = msg;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 2600);
  }

  // ── Actions ─────────────────────────────────────────────────────────
  const actions = {
    lang(el) { state.lang = el.dataset.lang; render(); },
    subscribe() { go("offer"); },
    "offer-continue"() {
      if (sim.network === "blocked") { state.resume = "confirm"; go("blocked"); return; }
      go("confirm");
    },
    confirm() {
      state.busy = true; render();
      setTimeout(() => {
        if (state.screen !== "confirm") return;
        if (sim.network === "blocked") { state.resume = "confirm"; go("blocked", { replace: true }); return; }
        if (sim.result === "error") { go("error", { replace: true }); return; }
        sim.user = "active"; saveSim();
        state.plan = state.pkg; session.set("sp-plan", state.plan);
        go("success", { replace: true });
      }, C.confirmDelayMs);
    },
    "not-now"() { go("landing"); },
    start() {
      if (C.successUrl) { location.href = forwardQuery(C.successUrl); return; }
      go("portal", { replace: true });
    },
    "retry-blocked"() {
      state.busy = true; render();
      setTimeout(() => {
        if (sim.network === "ok") { go(sim.user === "active" && state.resume !== "confirm" ? "portal" : state.resume, { replace: true }); return; }
        state.busy = false; render();
        document.getElementById("status-panel")?.classList.add("shake");
      }, 700);
    },
    "retry-error"() { go("confirm"); },
    "back-packages"() { go("landing"); },
    "how-cancel"() { state.sheet = true; render(); document.querySelector(".sheet .icon-btn")?.focus(); },
    "close-sheet"(el, ev) {
      if (el.classList.contains("scrim") && ev.target !== el) return;
      state.sheet = false; render();
      app.querySelector('[data-action="how-cancel"]')?.focus();
    },
    "open-catalog"() {
      if (state.games) { go("games"); return; }
      fetch(C.apps.find(a => a.catalog).catalog).then(r => r.json())
        .then(list => { state.games = list; go("games"); })
        .catch(() => toast("games.json could not be loaded"));
    },
    "back-portal"() { go("portal"); },
    genre(el) {
      state.gameGenre = el.dataset.genre;
      document.querySelectorAll(".genre").forEach(b => b.setAttribute("aria-pressed", b === el));
      document.getElementById("game-grid").innerHTML = gameTiles();
    },
    "open-missing"(el) { toast(`${el.dataset.app}: link not set yet (src/config.js → apps.url)`); },
    // demo panel
    "dev-toggle"() { state.devOpen = !state.devOpen; renderDev(); },
    "dev-set"(el) { sim[el.dataset.key] = el.dataset.val; saveSim(); renderDev(); },
    "dev-go"(el) {
      const s = el.dataset.screen;
      if ((s === "portal" || s === "games") && !state.plan) state.plan = state.pkg;
      if (s === "games" && !state.games) { actions["open-catalog"](); return; }
      go(s);
    },
    "dev-reset"() {
      Object.assign(sim, { network: "ok", user: "new", result: "success" }); saveSim();
      state.plan = null; session.set("sp-plan", null); state.pkg = C.defaultPackage;
      go(entry());
    },
  };

  document.addEventListener("click", ev => {
    const link = ev.target.closest("a[data-link]");
    if (link && !C.links[link.dataset.link]) { ev.preventDefault(); return; }
    const el = ev.target.closest("[data-action]");
    if (!el || el.disabled) return;
    actions[el.dataset.action]?.(el, ev);
  });
  document.addEventListener("input", ev => {
    if (ev.target.id !== "game-search") return;
    state.gameQuery = ev.target.value;
    document.getElementById("game-grid").innerHTML = gameTiles();
  });
  document.addEventListener("change", ev => {
    if (ev.target.name !== "pkg") return;
    state.pkg = ev.target.value;
    document.querySelectorAll(".pkg").forEach(l => l.classList.toggle("is-selected", l.querySelector("input").checked));
  });
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && state.sheet) actions["close-sheet"](document.body, ev);
  });
  addEventListener("popstate", ev => {
    const s = ev.state?.screen;
    if (s === "games" && !state.games) { go("portal", { push: false }); return; }
    if (s === "offer" && ev.state.pkg) state.pkg = pkgById(ev.state.pkg).id;
    if (SCREENS.includes(s)) go(s, { push: false });
  });

  // ── Demo panel ──────────────────────────────────────────────────────
  function renderDev() {
    if (!devOn) return;
    const seg = (key, label, opts) => `
      <div><h3>${label}</h3><div class="dev-seg">${opts.map(([val, txt]) =>
        `<button type="button" data-action="dev-set" data-key="${key}" data-val="${val}" aria-pressed="${sim[key] === val}">${txt}</button>`).join("")}</div></div>`;
    devRoot.innerHTML = `
      <button type="button" class="dev-fab" data-action="dev-toggle" aria-expanded="${state.devOpen}">DEMO</button>
      ${state.devOpen ? `
      <div class="dev-panel" lang="en" role="region" aria-label="Demo controls">
        ${seg("network", "Network", [["ok", "OK"], ["blocked", "Blocked"]])}
        ${seg("user", "User", [["new", "New"], ["active", "Subscribed"]])}
        ${seg("result", "Confirm result", [["success", "Success"], ["error", "Error"]])}
        <div><h3>Jump to screen</h3><div class="dev-jump">${SCREENS.map(s =>
          `<button type="button" data-action="dev-go" data-screen="${s}" aria-current="${state.screen === s}">${s}</button>`).join("")}</div></div>
        <button type="button" class="btn btn-ghost" data-action="dev-reset" style="font-family:inherit;font-size:.8125rem;min-height:44px">Reset &amp; reload entry</button>
        <p class="dev-note">Switches apply on the next step (Subscribe, Confirm, Try Again). "Reset" re-runs the entry check: blocked → network page, subscribed → portal.</p>
      </div>` : ""}`;
  }

  // ── Boot ────────────────────────────────────────────────────────────
  Promise.all(["en", "my"].map(l => fetch(`i18n/${l}.json`).then(r => r.json())))
    .then(([en, my]) => {
      dict = { en, my };
      let first = entry();
      // Opened straight on /offer: keep the package from the link and put the landing page under it for Back.
      const atOffer = location.pathname.replace(/\/+$/, "") === OFFER_PATH;
      if (atOffer && first === "landing") {
        if (params.get("pkg")) state.pkg = pkgById(params.get("pkg")).id;
        try { history.replaceState({ screen: "landing", pkg: state.pkg }, "", url("landing")); } catch { /* sandboxed history */ }
        first = "offer";
      }
      state.screen = first;
      try { history[first === "offer" ? "pushState" : "replaceState"]({ screen: first, pkg: state.pkg }, "", url(first)); } catch { /* sandboxed history */ }
      render();
    })
    .catch(() => {
      app.innerHTML = '<div class="screen"><div class="panel">Could not load i18n/my.json and i18n/en.json. Run the dev server (npm run dev).</div></div>';
    });
})();
