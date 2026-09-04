
(() => {
  "use strict";

  // LinkedIn is a single-page app: navigating between sections that match
  // this extension's URL patterns (e.g. a profile page back to /notifications)
  // can make Chrome run this content script again in the SAME already-running
  // tab, on top of an instance that's still alive. Without this guard we'd end
  // up with two (or more) parallel copies each with their own timers and
  // their own idea of which tab is "active", racing to overwrite each other's
  // saved state — which matches the "works once, then breaks" symptom. If an
  // instance is already running here, just ask it to rescan and stop.
  if (window.__liFlowsInstance) {
    window.__liFlowsInstance.rescan();
    return;
  }

  const STORE_KEY = "liNotifFlows_v1";
  const ROOT_ID = "li-notif-flows-root";
  const state = {
    groups: {},
    active: "__all__",
    lang: "en",
    ready: false,
    observer: null
  };

  const DEFAULT_GROUPS = {
    "Important": { name: "Important", members: {} },
    "Work": { name: "Work", members: {} },
    "Companies": { name: "Companies", members: {} }
  };

  // ---- i18n --------------------------------------------------------------
  // state.lang: "tr" | "en". Defaults to English; the header toggle lets the
  // user switch to Turkish (and back) at any time — the choice is saved.
  const STRINGS = {
    tr: {
      headerTitle: "Bildirim Akışları",
      peopleBtnTitle: "Takip edilenleri yönet",
      manageBtnTitle: "Grupları yönet",
      langBtnTitle: "Dil / Language",
      helpText: "Bildirimdeki <b>＋</b> ile ekle. Henüz paylaşımı olmayan kişi/kurumları ise <b>⚙ → Kişi / kurum ekle</b> ile profil URL'si üzerinden ekleyebilirsin.",
      allTab: "Tümü",
      addToFlowTitle: "Bu kişiyi bildirim akışına ekle",
      pickerSub: "Bu kişiyi hangi akışlarda görmek istiyorsun?",
      saveBtn: "Kaydet",
      peopleTitle: "Takip Edilenler",
      peopleSub: "İzleme listendeki tüm kişi ve kurumları burada görebilir, akışlarını değiştirebilir veya silebilirsin.",
      searchPlaceholder: "Ara...",
      noMatch: "Eşleşen sonuç yok.",
      emptyList: "Henüz izleme listesinde kimse yok.",
      openProfile: "Profili aç ↗",
      editFlows: "Akışları düzenle",
      deleteBtn: "Sil",
      deleteConfirm: name => `${name} tüm akışlardan çıkarılsın mı?`,
      manageTitle: "Akışları yönet",
      addPersonTitle: "Kişi / kurum ekle",
      personNamePlaceholder: "Kişi/kurum adı (örn. Ahmet Yılmaz)",
      personUrlPlaceholder: "LinkedIn profil veya şirket sayfası URL'si",
      addBtn: "Ekle",
      personAddHelp: "Profil URL'sini kişinin LinkedIn profilinden ya da kurumun şirket sayfasından (https://www.linkedin.com/in/... veya .../company/...) kopyalayabilirsin. Henüz hiç paylaşım yapmamış olsa da akışa eklenir.",
      newFlowPlaceholder: "Yeni akış adı",
      exportBtn: "💾 Dışa aktar (yedek)",
      importBtn: "📂 İçe aktar",
      personCount: n => `${n} kişi`,
      deleteFlowBtn: "Sil",
      renameBtn: "Yeniden adlandır",
      renamePrompt: "Bu akış için yeni isim:",
      deleteFlowConfirm: name => `"${name}" akışını silmek istiyor musun?`,
      personFieldsRequired: "Kişi/kurum adı ve LinkedIn profil veya şirket sayfası URL'si gerekli.",
      invalidUrl: "Geçerli bir LinkedIn profil veya şirket sayfası URL'si gir. Örn: https://www.linkedin.com/in/kullaniciadi/ veya https://www.linkedin.com/company/sirket-adi/",
      addedToFlow: (name, group) => `${name} → ${group} akışına eklendi.`,
      flowNameExists: "Bu isimde bir akış var.",
      importInvalidJson: "Bu dosya geçerli bir yedek değil (JSON okunamadı).",
      importInvalidGroups: "Bu dosya geçerli bir yedek değil (grup verisi bulunamadı).",
      importModeConfirm: "Tamam = mevcut akışların ÜZERİNE yaz (aynı isimli akışlar yedekteki üyelerle birleşir, kişi bazında birleştirilir).\nİptal = önce mevcut TÜM akışları sil, sadece yedektekileri yükle.",
      importDone: "İçe aktarma tamamlandı.",
      profileAddBtnText: "＋ Bildirim Akışına Ekle",
      profileAddBtnTitle: "Bu LinkedIn profilini/sayfasını özel bildirim akışına ekle",
      localeTag: "tr-TR"
    },
    en: {
      headerTitle: "Notification Flows",
      peopleBtnTitle: "Manage tracked list",
      manageBtnTitle: "Manage flows",
      langBtnTitle: "Dil / Language",
      helpText: "Add someone from the <b>＋</b> on a notification. To add a person or organization that hasn't posted yet, use <b>⚙ → Add person/organization</b> with their profile URL.",
      allTab: "All",
      addToFlowTitle: "Add this person to a notification flow",
      pickerSub: "Which flows do you want to see this person in?",
      saveBtn: "Save",
      peopleTitle: "Tracked",
      peopleSub: "See everyone and every organization on your tracked list here, change their flows, or remove them.",
      searchPlaceholder: "Search...",
      noMatch: "No matching results.",
      emptyList: "No one on your tracked list yet.",
      openProfile: "Open profile ↗",
      editFlows: "Edit flows",
      deleteBtn: "Remove",
      deleteConfirm: name => `Remove ${name} from all flows?`,
      manageTitle: "Manage flows",
      addPersonTitle: "Add person / organization",
      personNamePlaceholder: "Person/organization name (e.g. John Smith)",
      personUrlPlaceholder: "LinkedIn profile or company page URL",
      addBtn: "Add",
      personAddHelp: "You can copy the profile URL from the person's LinkedIn profile or the organization's company page (https://www.linkedin.com/in/... or .../company/...). They'll be added even if they haven't posted anything yet.",
      newFlowPlaceholder: "New flow name",
      exportBtn: "💾 Export (backup)",
      importBtn: "📂 Import",
      personCount: n => `${n} ${n === 1 ? "person" : "people"}`,
      deleteFlowBtn: "Delete",
      renameBtn: "Rename",
      renamePrompt: "New name for this flow:",
      deleteFlowConfirm: name => `Delete the "${name}" flow?`,
      personFieldsRequired: "Person/organization name and a LinkedIn profile or company page URL are required.",
      invalidUrl: "Enter a valid LinkedIn profile or company page URL. E.g. https://www.linkedin.com/in/username/ or https://www.linkedin.com/company/company-name/",
      addedToFlow: (name, group) => `${name} → added to ${group}.`,
      flowNameExists: "A flow with this name already exists.",
      importInvalidJson: "This file isn't a valid backup (couldn't parse JSON).",
      importInvalidGroups: "This file isn't a valid backup (no flow data found).",
      importModeConfirm: "OK = merge into current flows (flows with the same name combine members).\nCancel = delete ALL current flows first, then load only the backup's.",
      importDone: "Import complete.",
      profileAddBtnText: "＋ Add to Notification Flow",
      profileAddBtnTitle: "Add this LinkedIn profile/page to a custom notification flow",
      localeTag: "en-US"
    }
  };

  function getLang() {
    return state.lang === "tr" ? "tr" : "en";
  }

  function t(key, ...args) {
    const entry = STRINGS[getLang()][key];
    return typeof entry === "function" ? entry(...args) : entry;
  }
  // -------------------------------------------------------------------------

  const clean = s => (s || "").replace(/\s+/g, " ").trim();

  // Reduce any LinkedIn profile URL (from a card link OR from the address bar)
  // down to a canonical "https://www.linkedin.com/in/<slug>" form, so the same
  // person always gets the same key no matter where the URL came from
  // (activity-page links, tracking query params, locale subdomains, etc.).
  function canonicalProfileHref(rawHref) {
    let url;
    try {
      url = new URL(rawHref, location.origin);
    } catch {
      return null;
    }
    // Supports both personal profiles (/in/slug) and company/organization
    // pages (/company/slug) — both can post and both can be added to a flow.
    const m = url.pathname.match(/\/(in|company)\/([^/]+)\/?/i);
    if (!m) return null;
    const type = m[1].toLowerCase();
    // LinkedIn sometimes over-encodes the slug (e.g. "-" as "%2D"), so decode
    // fully before rebuilding the canonical URL — otherwise the same person
    // ends up with two different keys depending on where the link came from.
    let slug = m[2];
    try { slug = decodeURIComponent(slug); } catch { /* keep raw if malformed */ }
    return "https://www.linkedin.com/" + type + "/" + slug;
  }

  function load() {
    chrome.storage.local.get([STORE_KEY], data => {
      const saved = data[STORE_KEY] || {};
      state.groups = Object.keys(saved.groups || {}).length ? saved.groups : structuredClone(DEFAULT_GROUPS);
      state.active = saved.active || "__all__";
      state.lang = saved.lang || "en";
      migrateKeys();
      state.ready = true;
      renderShell();
      scan();
    });
  }

  // Re-key every saved member through the current canonicalProfileHref logic.
  // Lets us fix key-normalization bugs later without forcing everyone to
  // re-add all their saved people.
  function migrateKeys() {
    let changed = false;
    Object.values(state.groups).forEach(g => {
      const oldMembers = g.members || {};
      const newMembers = {};
      Object.values(oldMembers).forEach(m => {
        const canon = canonicalProfileHref(m.href || m.key) || m.key;
        if (canon !== m.key) changed = true;
        newMembers[canon] = { ...m, key: canon, href: canon };
      });
      g.members = newMembers;
    });
    if (changed) save();
  }

  function save() {
    chrome.storage.local.set({
      [STORE_KEY]: { groups: state.groups, active: state.active, lang: state.lang }
    });
  }

  function getCards() {
    const selectors = [
      'article.nt-card[data-view-name="notification-card-container"]',
      'article.nt-card',
      'div[data-finite-scroll-hotkey-item] article.nt-card'
    ];
    const found = new Set();
    selectors.forEach(sel => document.querySelectorAll(sel).forEach(x => found.add(x)));
    // NOTE: don't filter by getBoundingClientRect() here. Cards we've hidden
    // ourselves (li-flow-hidden -> display:none) report a zero-size rect, so a
    // visibility check would make hidden cards invisible to future scans too —
    // permanently locking them out of being re-shown when the user switches
    // tabs. Content length is enough to skip empty/placeholder cards.
    return [...found].filter(el => clean(el.innerText).length > 10);
  }

  function actorFromCard(card) {
    const links = [...card.querySelectorAll('a[href]')];
    const preferred = links.find(a => {
      const h = a.getAttribute("href") || "";
      return /\/in\//.test(h);
    });
    if (preferred) {
      const href = canonicalProfileHref(preferred.href) ||
        new URL(preferred.href, location.origin).href.split("?")[0].replace(/\/$/, "");
      // Prefer the bold name inside the card's headline text over the link's
      // own text/aria-label, which is often just "<Name> profilini görüntüleyin."
      const headlineName = clean(card.querySelector(".nt-card__headline strong")?.innerText);
      const ariaName = clean(preferred.getAttribute("aria-label"))
        .replace(/\s*profilini görüntüleyin\.?$/i, "")
        .replace(/^view\s+/i, "").replace(/[’']s profile\.?$/i, "");
      const name = headlineName || clean(preferred.innerText) || ariaName || href;
      return { key: href, name, href };
    }

    // Fallback: use the first meaningful bold/headline text.
    const candidates = [
      ...card.querySelectorAll(".nt-card__headline, .nt-card__text, strong, span")
    ];
    const text = candidates.map(x => clean(x.innerText)).find(x => x && x.length >= 2 && x.length < 120);
    if (!text) return null;

    const urn = card.getAttribute("data-urn") || card.innerText.slice(0, 120);
    return { key: "text:" + text.toLowerCase(), name: text, href: "" };
  }

  function cardKey(card, actor) {
    return card.getAttribute("data-urn") ||
      card.querySelector("a[href*='activity']")?.href ||
      (actor?.key + "|" + clean(card.innerText).slice(0, 180));
  }


  function isInActive(card) {
    if (state.active === "__all__") return true;
    const actor = actorFromCard(card);
    return !!actor && !!state.groups[state.active]?.members?.[actor.key];
  }

  function applyFilter() {
    getCards().forEach(card => {
      const show = isInActive(card);
      card.classList.toggle("li-flow-hidden", !show);

      const actor = actorFromCard(card);
      if (actor) {
        card.dataset.liFlowActor = actor.key;
        card.dataset.liFlowActorName = actor.name;
        decorateCard(card, actor);
      }
    });
  }

  function decorateCard(card, actor) {
    if (card.querySelector(".li-flow-star")) return;

    const btn = document.createElement("button");
    btn.className = "li-flow-star";
    btn.type = "button";
    btn.title = t("addToFlowTitle");
    btn.textContent = "＋";

    btn.addEventListener("click", e => {
      e.preventDefault();
      e.stopPropagation();
      openPicker(actor);
    });

    card.style.position = card.style.position || "relative";
    card.appendChild(btn);
  }

  let shellBuilding = false;

  function renderShell() {
    if (!document.body) return;
    if (document.getElementById(ROOT_ID)) return;
    if (shellBuilding) return;
    shellBuilding = true;

    // Always re-sync the active tab from storage right before (re)building
    // the header — the header can get rebuilt after LinkedIn wipes our DOM
    // on internal navigation (e.g. clicking a notification, then going back
    // to "Bildirimler"), and in-memory state isn't reliable at that point.
    chrome.storage.local.get([STORE_KEY], data => {
      const saved = data[STORE_KEY] || {};
      if (saved.active) state.active = saved.active;
      if (saved.lang) state.lang = saved.lang;
      buildShellDom();
      shellBuilding = false;
    });
  }

  function buildShellDom() {
    if (!document.body || document.getElementById(ROOT_ID)) return;

    const root = document.createElement("div");
    root.id = ROOT_ID;
    root.innerHTML = `
      <div class="li-flow-header">
        <div class="li-flow-title-row">
          <div class="li-flow-title"></div>
          <button class="li-flow-lang"></button>
        </div>
        <div class="li-flow-toolbar">
          <div class="li-flow-tabs"></div>
          <button class="li-flow-people">📋</button>
          <button class="li-flow-manage">⚙</button>
        </div>
      </div>
      <div class="li-flow-help"></div>
    `;

    const people = root.querySelector(".li-flow-people");
    people.addEventListener("click", openPeopleManager);
    const manage = root.querySelector(".li-flow-manage");
    manage.addEventListener("click", openManager);
    const langBtn = root.querySelector(".li-flow-lang");
    langBtn.addEventListener("click", () => {
      state.lang = state.lang === "tr" ? "en" : "tr";
      save();
      applyShellTexts();
      renderTabs();
    });

    // Insert above the LinkedIn notification list.
    const list = document.querySelector("div.nt-card-list.nt-card-list--paginated") ||
                 document.querySelector("main") ||
                 document.querySelector("div.scaffold-layout__main");
    if (list?.parentElement) list.parentElement.insertBefore(root, list);
    else document.body.prepend(root);

    applyShellTexts();
    renderTabs();
  }

  function applyShellTexts() {
    const root = document.getElementById(ROOT_ID);
    if (!root) return;
    root.querySelector(".li-flow-title").textContent = t("headerTitle");
    root.querySelector(".li-flow-people").title = t("peopleBtnTitle");
    root.querySelector(".li-flow-manage").title = t("manageBtnTitle");
    root.querySelector(".li-flow-help").innerHTML = t("helpText");
    const langBtn = root.querySelector(".li-flow-lang");
    langBtn.title = t("langBtnTitle");
    langBtn.textContent = state.lang === "tr" ? "TR" : "ENG";
  }

  function renderTabs() {
    const tabs = document.querySelector("#" + ROOT_ID + " .li-flow-tabs");
    if (!tabs) return;
    tabs.innerHTML = "";

    const all = document.createElement("button");
    all.className = "li-flow-tab" + (state.active === "__all__" ? " active" : "");
    all.textContent = t("allTab");
    all.onclick = () => { state.active = "__all__"; save(); renderTabs(); applyFilter(); };
    tabs.appendChild(all);

    Object.values(state.groups).forEach(g => {
      const b = document.createElement("button");
      b.className = "li-flow-tab" + (state.active === g.name ? " active" : "");
      b.dataset.flowName = g.name;
      b.textContent = g.name;
      b.onclick = () => { state.active = g.name; save(); renderTabs(); applyFilter(); };
      tabs.appendChild(b);
    });
  }

  function openPicker(actor, afterSave = null) {
    const old = document.querySelector(".li-flow-modal-backdrop");
    if (old) old.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "li-flow-modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "li-flow-modal";
    modal.innerHTML = `
      <div class="li-flow-modal-head">
        <b>${escapeHtml(actor.name)}</b>
        <button class="li-flow-close">×</button>
      </div>
      <div class="li-flow-modal-sub">${t("pickerSub")}</div>
      <div class="li-flow-checks"></div>
      <div class="li-flow-modal-actions">
        <button class="li-flow-primary">${t("saveBtn")}</button>
      </div>
    `;

    const checks = modal.querySelector(".li-flow-checks");
    Object.values(state.groups).forEach(g => {
      const label = document.createElement("label");
      label.className = "li-flow-check";
      label.innerHTML = `<input type="checkbox" data-group="${escapeAttr(g.name)}"> <span>${escapeHtml(g.name)}</span>`;
      const cb = label.querySelector("input");
      cb.checked = !!g.members[actor.key];
      checks.appendChild(label);
    });

    modal.querySelector(".li-flow-primary").onclick = () => {
      Object.values(state.groups).forEach(g => {
        const cb = checks.querySelector(`input[data-group="${cssEscape(g.name)}"]`);
        if (cb?.checked) g.members[actor.key] = actor;
        else delete g.members[actor.key];
      });
      save(); backdrop.remove(); renderTabs(); applyFilter();
      if (afterSave) afterSave();
    };

    modal.querySelector(".li-flow-close").onclick = () => backdrop.remove();
    backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  function allPeople() {
    const map = {};
    Object.values(state.groups).forEach(g => {
      Object.entries(g.members || {}).forEach(([key, person]) => {
        if (!map[key]) map[key] = { ...person, groups: [] };
        map[key].groups.push(g.name);
      });
    });
    return Object.values(map).sort((a,b) => a.name.localeCompare(b.name, t("localeTag")));
  }

  function openPeopleManager() {
    const old = document.querySelector(".li-flow-modal-backdrop");
    if (old) old.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "li-flow-modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "li-flow-modal li-flow-people-manager";
    modal.innerHTML = `
      <div class="li-flow-modal-head">
        <b>${t("peopleTitle")}</b>
        <button class="li-flow-close">×</button>
      </div>
      <div class="li-flow-modal-sub">${t("peopleSub")}</div>
      <div class="li-flow-people-filters"></div>
      <input class="li-flow-people-search" placeholder="${escapeAttr(t("searchPlaceholder"))}">
      <div class="li-flow-people-list"></div>
    `;

    const list = modal.querySelector(".li-flow-people-list");
    const search = modal.querySelector(".li-flow-people-search");
    const filters = modal.querySelector(".li-flow-people-filters");

    let activeFlow = "__all__";

    function drawFilters() {
      filters.innerHTML = "";
      const all = document.createElement("button");
      all.className = "li-flow-tab" + (activeFlow === "__all__" ? " active" : "");
      all.textContent = t("allTab");
      all.onclick = () => { activeFlow = "__all__"; drawFilters(); draw(search.value); };
      filters.appendChild(all);

      Object.values(state.groups).forEach(g => {
        const b = document.createElement("button");
        b.className = "li-flow-tab" + (activeFlow === g.name ? " active" : "");
        b.textContent = g.name;
        b.onclick = () => { activeFlow = g.name; drawFilters(); draw(search.value); };
        filters.appendChild(b);
      });
    }

    function draw(filter = "") {
      list.innerHTML = "";
      const q = clean(filter).toLocaleLowerCase(t("localeTag"));
      const people = allPeople().filter(p =>
        (!q || p.name.toLocaleLowerCase(t("localeTag")).includes(q)) &&
        (activeFlow === "__all__" || p.groups.includes(activeFlow))
      );
      if (!people.length) {
        list.innerHTML = `<div class="li-flow-empty">${q ? t("noMatch") : t("emptyList")}</div>`;
        return;
      }
      people.forEach(person => {
        const row = document.createElement("div");
        row.className = "li-flow-person-card";
        row.innerHTML = `
          <div class="li-flow-person-main">
            <div class="li-flow-person-name-display">${escapeHtml(person.name)}</div>
            <div class="li-flow-person-groups">${person.groups.map(g => `<span>${escapeHtml(g)}</span>`).join("")}</div>
            ${person.href ? `<a href="${escapeAttr(person.href)}" target="_blank" rel="noopener" class="li-flow-person-link">${t("openProfile")}</a>` : ""}
          </div>
          <div class="li-flow-person-actions">
            <button class="li-flow-secondary li-flow-edit-person">${t("editFlows")}</button>
            <button class="li-flow-delete-person">${t("deleteBtn")}</button>
          </div>
        `;
        row.querySelector(".li-flow-edit-person").onclick = () => {
          openPicker(person, () => { openPeopleManager(); });
        };
        row.querySelector(".li-flow-delete-person").onclick = () => {
          if (!confirm(t("deleteConfirm", person.name))) return;
          Object.values(state.groups).forEach(g => delete g.members[person.key]);
          save(); renderTabs(); applyFilter(); draw(search.value);
        };
        list.appendChild(row);
      });
    }

    search.addEventListener("input", () => draw(search.value));
    modal.querySelector(".li-flow-close").onclick = () => backdrop.remove();
    backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
    drawFilters();
    draw();
  }

  function openManager() {
    const old = document.querySelector(".li-flow-modal-backdrop");
    if (old) old.remove();

    const backdrop = document.createElement("div");
    backdrop.className = "li-flow-modal-backdrop";
    const modal = document.createElement("div");
    modal.className = "li-flow-modal li-flow-manager";
    modal.innerHTML = `
      <div class="li-flow-modal-head">
        <b>${t("manageTitle")}</b>
        <button class="li-flow-close">×</button>
      </div>
      <div class="li-flow-manager-list"></div>
      <div class="li-flow-person-add">
        <b>${t("addPersonTitle")}</b>
        <div class="li-flow-person-row">
          <input class="li-flow-person-name" placeholder="${escapeAttr(t("personNamePlaceholder"))}">
          <input class="li-flow-person-url" placeholder="${escapeAttr(t("personUrlPlaceholder"))}">
        </div>
        <div class="li-flow-person-row">
          <select class="li-flow-person-group"></select>
          <button class="li-flow-primary li-flow-add-person">${t("addBtn")}</button>
        </div>
        <small>${t("personAddHelp")}</small>
      </div>
      <div class="li-flow-manager-add">
        <input placeholder="${escapeAttr(t("newFlowPlaceholder"))}">
        <button class="li-flow-primary">${t("addBtn")}</button>
      </div>
      <div class="li-flow-danger">
        <button class="li-flow-export">${t("exportBtn")}</button>
        <button class="li-flow-import">${t("importBtn")}</button>
        <input type="file" accept="application/json" class="li-flow-import-input" style="display:none">
      </div>
    `;

    const list = modal.querySelector(".li-flow-manager-list");
    Object.values(state.groups).forEach(g => {
      const row = document.createElement("div");
      row.className = "li-flow-manager-row";
      row.innerHTML = `
        <span><b>${escapeHtml(g.name)}</b> <small>${t("personCount", Object.keys(g.members || {}).length)}</small></span>
        <div class="li-flow-manager-row-actions">
          <button class="li-flow-rename-btn" title="${escapeAttr(t("renameBtn"))}">✏️</button>
          <button class="li-flow-delete-btn" data-delete="${escapeAttr(g.name)}">${t("deleteFlowBtn")}</button>
        </div>
      `;
      row.querySelector(".li-flow-rename-btn").onclick = () => {
        const newName = prompt(t("renamePrompt"), g.name);
        if (newName == null) return;
        const n = clean(newName);
        if (!n || n === g.name) return;
        if (state.groups[n]) return alert(t("flowNameExists"));
        const reordered = {};
        Object.values(state.groups).forEach(og => {
          if (og.name === g.name) reordered[n] = { ...og, name: n };
          else reordered[og.name] = og;
        });
        state.groups = reordered;
        if (state.active === g.name) state.active = n;
        save(); renderTabs(); applyFilter(); openManager();
      };
      row.querySelector(".li-flow-delete-btn").onclick = () => {
        if (confirm(t("deleteFlowConfirm", g.name))) {
          delete state.groups[g.name];
          if (state.active === g.name) state.active = "__all__";
          save(); renderTabs(); applyFilter(); row.remove();
        }
      };
      list.appendChild(row);
    });

    const groupSelect = modal.querySelector(".li-flow-person-group");
    Object.values(state.groups).forEach(g => {
      const opt = document.createElement("option");
      opt.value = g.name;
      opt.textContent = g.name;
      groupSelect.appendChild(opt);
    });

    modal.querySelector(".li-flow-add-person").onclick = () => {
      const nameInput = modal.querySelector(".li-flow-person-name");
      const urlInput = modal.querySelector(".li-flow-person-url");
      const group = groupSelect.value;
      const name = clean(nameInput.value);
      let href = clean(urlInput.value);
      if (!name || !href) return alert(t("personFieldsRequired"));
      try {
        const u = new URL(href);
        if (!/(^|\.)linkedin\.com$/i.test(u.hostname)) throw new Error();
        const canon = canonicalProfileHref(href);
        if (!canon) throw new Error();
        href = canon;
      } catch {
        return alert(t("invalidUrl"));
      }
      state.groups[group].members[href] = { key: href, name, href };
      save();
      alert(t("addedToFlow", name, group));
      nameInput.value = "";
      urlInput.value = "";
      renderTabs();
      applyFilter();
      openManager();
    };

    modal.querySelector(".li-flow-manager-add button").onclick = () => {
      const input = modal.querySelector("input");
      const n = clean(input.value);
      if (!n) return;
      if (state.groups[n]) return alert(t("flowNameExists"));
      state.groups[n] = { name: n, members: {} };
      input.value = "";
      save(); renderTabs(); applyFilter();
      openManager();
    };

    modal.querySelector(".li-flow-export").onclick = () => {
      const payload = {
        exportedAt: new Date().toISOString(),
        version: 1,
        groups: state.groups
      };
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      a.href = url;
      a.download = `linkedin-bildirim-akislari-yedek-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    };

    const importInput = modal.querySelector(".li-flow-import-input");
    modal.querySelector(".li-flow-import").onclick = () => importInput.click();
    importInput.onchange = () => {
      const file = importInput.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        let parsed;
        try {
          parsed = JSON.parse(reader.result);
        } catch {
          alert(t("importInvalidJson"));
          return;
        }
        const incoming = parsed?.groups;
        if (!incoming || typeof incoming !== "object") {
          alert(t("importInvalidGroups"));
          return;
        }
        const mode = confirm(t("importModeConfirm")) ? "merge" : "replace";

        if (mode === "replace") {
          state.groups = {};
        }
        Object.values(incoming).forEach(g => {
          if (!g?.name) return;
          if (!state.groups[g.name]) state.groups[g.name] = { name: g.name, members: {} };
          Object.values(g.members || {}).forEach(m => {
            if (!m?.href && !m?.key) return;
            const canon = canonicalProfileHref(m.href || m.key) || m.key;
            state.groups[g.name].members[canon] = { ...m, key: canon, href: canon };
          });
        });
        save();
        renderTabs();
        applyFilter();
        alert(t("importDone"));
        openManager();
      };
      reader.readAsText(file);
      importInput.value = "";
    };

    modal.querySelector(".li-flow-close").onclick = () => backdrop.remove();
    backdrop.onclick = e => { if (e.target === backdrop) backdrop.remove(); };
    backdrop.appendChild(modal);
    document.body.appendChild(backdrop);
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(s) { return escapeHtml(s); }
  function cssEscape(s) { return window.CSS?.escape ? CSS.escape(s) : s.replace(/["\\]/g, "\\$&"); }

  function profileActor() {
    const href = canonicalProfileHref(location.href);
    if (!href) return null;
    const selectors = [
      "h1",
      ".text-heading-xlarge",
      "main h1"
    ];
    for (const sel of selectors) {
      const el = document.querySelector(sel);
      const name = clean(el?.innerText);
      if (name) return { key: href, name, href };
    }
    const slug = href.split("/").pop() || "";
    return { key: href, name: slug.replace(/[-_]+/g, " "), href };
  }

  let profileButtonActorKey = null;

  function removeProfileButton() {
    document.querySelector(".li-flow-profile-add")?.remove();
    profileButtonActorKey = null;
  }

  function addProfileButton() {
    if (!/^\/(in|company)\//.test(location.pathname)) {
      // Left the profile/company page (SPA navigation) — clean up any stale button.
      removeProfileButton();
      return;
    }

    const actor = profileActor();
    if (!actor) {
      removeProfileButton();
      return;
    }

    const existing = document.querySelector(".li-flow-profile-add");
    if (existing) {
      // LinkedIn is a SPA: navigating from one profile straight to another
      // doesn't remove the old button, so without this check it would keep
      // pointing at the previous person. Refresh it whenever the actor changes.
      if (profileButtonActorKey === actor.key) return;
      existing.remove();
    }

    const btn = document.createElement("button");
    btn.className = "li-flow-profile-add";
    btn.textContent = t("profileAddBtnText");
    btn.title = t("profileAddBtnTitle");
    btn.onclick = () => openPicker(actor);
    document.body.appendChild(btn);
    profileButtonActorKey = actor.key;
  }

  function scan() {
    if (!state.ready) return;
    renderShell();
    applyFilter();
    addProfileButton();
  }

  function startObserver() {
    if (state.observer) return;
    let timer;
    state.observer = new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(scan, 180);
    });
    state.observer.observe(document.body, { childList: true, subtree: true });
  }

  // SPA navigation: LinkedIn changes content without a full reload.
  let lastPath = location.pathname;
  setInterval(() => {
    if (location.pathname !== lastPath) {
      lastPath = location.pathname;
      if (location.pathname.startsWith("/notifications")) {
        setTimeout(scan, 500);
      }
    }
  }, 800);

  load();
  startObserver();

  window.__liFlowsInstance = { rescan: scan };
})();
