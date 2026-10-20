/* QC Survey advanced features
 * Autosave, device templates, dual-photo, photo save+PDF attach,
 * QC tolerances, Excel/CSV, E-N map, night mode, pack export,
 * report numbers, company template, clear inputs vs reset saved.
 * NO user roles.
 */
window.__qcFeaturesFileLoaded = true;
(function () {
  "use strict";

  var STORAGE_KEY = "qc_survey_draft_v2";
  var BACKUP_KEY = "qc_survey_draft_backup_v222";
  var JOURNAL_KEY = "qc_emergency_fields_v222";
  var JOURNAL_DIRTY_KEY = "qc_emergency_dirty_v222";
  var SETTINGS_KEY = "qc_survey_settings_v2";
  var HISTORY_KEY = "qc_survey_history_v1";
  var saveTimer = null;
  var lastSaveAt = 0;
  var dualBuffers = { ts: null, enez: null, llh: null };
  var photoStore = { ts: [], enez: null, llh: null, custom: [] };
  var pendingPhotoDecision = null;

  function $(id) { return document.getElementById(id); }
  function qs(s, r) { return (r || document).querySelector(s); }
  function qsa(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  /* حماية: window.setups/window.sections ممكن تصير عنصر DOM بسبب id بنفس الاسم.
     لا نتعامل وياها كمصفوفة إلا إذا هي Array فعلاً. */
  function arr(x) { return Array.isArray(x) ? x : []; }
  function ensureArrayGlobal(k) { if (!Array.isArray(window[k])) window[k] = []; return window[k]; }
  function toastSafe(msg, type) {
    if (typeof window.toast === "function") window.toast(msg, type);
    else if (/(\?|&)debug=1/.test(String(location.search||""))) console.log(type || "info", msg);
  }
  function val(id) {
    var el = $(id);
    return el ? String(el.value || "") : "";
  }
  var __applyGuard = false; /* FIX: setVal->applySettingsToUI->setVal infinite loop guard */
  function setVal(id, v) {
    var el = $(id);
    if (!el || v == null) return;
    el.value = v;
    try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
  }
  function esc(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;")
      .replace(/>/g, "&gt;").replace(/"/g, "&quot;");
  }

  // ---------------- settings ----------------
  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {}; }
    catch (e) { return {}; }
  }
  function saveSettings(s) {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(s || {})); } catch (e) {}
  }
  function getSettings() {
    var s = loadSettings();
    if (s.theme == null) s.theme = "light";
    if (s.deviceTemplate == null) s.deviceTemplate = "generic";
    if (s.dualMode == null) s.dualMode = false;
    if (s.attachPhotos == null) s.attachPhotos = true;
    if (s.askSavePhoto == null) s.askSavePhoto = true;
    if (s.tolE == null) s.tolE = 0.02;
    if (s.tolN == null) s.tolN = 0.02;
    if (s.tolZ == null) s.tolZ = 0.03;
    if (s.companyName == null) s.companyName = "";
    if (s.companyLogo == null) s.companyLogo = "";
    if (s.titleColor == null) s.titleColor = "#1e3a8a";
    if (s.reportPrefix == null) s.reportPrefix = "QC";
    if (s.reportSeq == null) s.reportSeq = 1;
    return s;
  }

  var DEVICE_TEMPLATES = {
    generic: { label: "Generic Device", hint: "General total station / controller screen" },
    leica: { label: "Leica", hint: "Leica style labels (Easting/Northing/Elevation, Pt)" },
    trimble: { label: "Trimble", hint: "Trimble style labels (N/E/Z, Point)" },
    topcon: { label: "Topcon / Sokkia", hint: "Topcon/Sokkia style labels (N/E/Z, PT)" }
  };

  function applyDeviceTemplate(id) {
    var t = DEVICE_TEMPLATES[id] || DEVICE_TEMPLATES.generic;
    window.__qcDeviceTemplate = id || "generic";
    qsa(".device-template-hint").forEach(function (el) { el.textContent = t.hint; });
  }
  function enhanceTextForTemplate(text) {
    var id = window.__qcDeviceTemplate || "generic";
    var t = String(text || "");
    if (id === "trimble") t = t.replace(/\bElev\b/gi, "Elevation");
    if (id === "topcon") t = t.replace(/\bPT\b/g, "Pt").replace(/\bEL\b/g, "Elevation");
    if (id === "leica") t = t.replace(/\bPnt\b/gi, "Pt");
    return t;
  }

  // ---------------- report number ----------------
  function nextReportNumber(consume) {
    var s = getSettings();
    var year = new Date().getFullYear();
    var seq = parseInt(s.reportSeq, 10) || 1;
    var num = (s.reportPrefix || "QC") + "-" + year + "-" + String(seq).padStart(3, "0");
    if (consume) {
      s.reportSeq = seq + 1;
      saveSettings(s);
      var el = $("report-number-view");
      if (el) el.textContent = "Next: " + (s.reportPrefix || "QC") + "-" + year + "-" + String(s.reportSeq).padStart(3, "0");
    }
    return num;
  }

  // ---------------- history (retained until reset) ----------------
  function loadHistory() {
    try { return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]") || []; }
    catch (e) { return []; }
  }
  function saveHistory(list) {
    // FIX: quota-safe — if storage fills, keep dropping oldest snapshots and retry
    list = list || [];
    for (var attempts = 0; attempts < 6; attempts++) {
      try { localStorage.setItem(HISTORY_KEY, JSON.stringify(list)); return; }
      catch (e) {
        if (list.length > 1) { list = list.slice(0, Math.max(1, Math.floor(list.length / 2))); }
        else { try { localStorage.removeItem(HISTORY_KEY); } catch (e2) {} return; }
      }
    }
  }
  function pushHistorySnapshot(reason) {
    var snap = collectDraft();
    snap.reason = reason || "snapshot";
    snap.snapshotAt = Date.now();
    // FIX: strip photo payloads from snapshots — photos live once in the draft,
    // not duplicated 30x in history (was the main QuotaExceededError trigger)
    snap.photos = { ts: [], enez: null, llh: null, custom: [] };
    snap.photoCount = {
      ts: (photoStore.ts || []).length,
      enez: photoStore.enez ? 1 : 0,
      llh: photoStore.llh ? 1 : 0,
      custom: (photoStore.custom || []).length
    };
    var list = loadHistory();
    list.unshift(snap);
    if (list.length > 30) list = list.slice(0, 30);
    saveHistory(list);
    renderHistory();
  }

  // ---------------- autosave draft ----------------
  function collectDraft() {
    return {
      savedAt: Date.now(),
      settings: getSettings(),
      ts: {
        project: val("ts-project"), site: val("ts-site"), observer: val("ts-observer"),
        supervisor: val("ts-supervisor"), date: val("ts-date"),
        setups: (window.setups ? JSON.parse(JSON.stringify(window.setups)) : [])
      },
      ls: {
        project: val("ls-project"), site: val("ls-site"),
        sections: (window.sections ? JSON.parse(JSON.stringify(window.sections)) : [])
      },
      sc: {
        project: val("sc-project"), site: val("sc-site"), date: val("sc-date"),
        supervisor: val("sc-supervisor"), session: val("sc-session"), point: val("sc-point"),
        surveyor: val("sc-surveyor"), synch: val("sc-synch"), idGs: val("sc-id-gs"), idCs: val("sc-id-cs"),
        tagRam: val("sc-tag-ram"), obsType: val("sc-obs-type"), zone: val("sc-zone-number"),
        geoid: val("sc-geoid-model"), pointClass: val("sc-point-class"), measHt: val("sc-meas-ht"),
        easting: val("sc-easting"), northing: val("sc-northing"), elevation: val("sc-elevation"),
        lonDeg: val("sc-lon-deg"), lonMin: val("sc-lon-min"), lonSec: val("sc-lon-sec"), lonHemi: val("sc-lon-hemi"),
        latDeg: val("sc-lat-deg"), latMin: val("sc-lat-min"), latSec: val("sc-lat-sec"), latHemi: val("sc-lat-hemi"),
        geoHeight: val("sc-geo-height"), heightReading: val("sc-height-reading"),
        verticalOffset: val("sc-vertical-offset"), trueHeight: val("sc-true-vertical-ht"),
        notes: val("sc-notes"),
        checks: (window.scChecks ? window.scChecks.slice() : []),
        timer: (window.__qcTimerInfo ? JSON.parse(JSON.stringify(window.__qcTimerInfo)) : null)
      },
      photos: {
        dir: JSON.parse(JSON.stringify(dirPhotos)),
        ts: (photoStore.ts || []).slice(0, 12),
        enez: photoStore.enez || null,
        llh: photoStore.llh || null,
        custom: (photoStore.custom || []).slice(0, 20)
      }
    };
  }

  function setSavePill(state, text) {
    var el = $("save-pill");
    if (!el) return;
    el.classList.remove("saving", "err");
    if (state) el.classList.add(state);
    el.textContent = text;
  }

  function saveDraftNow() {
    try {
      setSavePill("saving", "Saving…");
      var draft = collectDraft();
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
      } catch (quotaErr) {
        // FIX: quota full — degrade gracefully: keep form data, drop oldest photo payloads
        draft.photos = {
          ts: (draft.photos && draft.photos.ts || []).slice(-3),
          enez: null,
          llh: null,
          custom: []
        };
        localStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
        if (!(window.__qcQuotaWarnedAt && Date.now() - window.__qcQuotaWarnedAt < 60000)) {
          window.__qcQuotaWarnedAt = Date.now();
          toastSafe("Storage full — kept your data, trimmed old photos. Export Full Pack to free space.", "load");
        }
        photoStore.ts = draft.photos.ts;
        photoStore.enez = null;
        photoStore.llh = null;
        photoStore.custom = [];
        renderPhotoThumbs();
      }
      /* v222: independent text-only recovery slot. A broken/quota-truncated main
         draft can never erase the last recoverable field values. */
      try {
        var safeBackup = Object.assign({}, draft, { photos: { dir: {}, ts: [], enez: null, llh: null, custom: [] } });
        localStorage.setItem(BACKUP_KEY, JSON.stringify(safeBackup));
      } catch (backupErr) {}
      /* Keep a generic DOM mirror too, so newly added fields are protected even
         before collectDraft is expanded for them. Mark it clean after success. */
      checkpointAllFields(false);
      lastSaveAt = Date.now();
      setSavePill("", "Saved " + new Date(lastSaveAt).toLocaleTimeString('en-GB',{hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
      return true;
    } catch (e) {
      console.error(e);
      setSavePill("err", "Save failed");
      return false;
    }
  }
  function scheduleSave() {
    if (saveTimer) clearTimeout(saveTimer);
    setSavePill("saving", "Editing…");
    saveTimer = setTimeout(saveDraftNow, 220);
  }

  /* v222: synchronous, compact keystroke journal. This protects the final
     characters even when a mobile OS kills the tab without beforeunload. */
  var emergencyJournal = (function () { try { return JSON.parse(localStorage.getItem(JOURNAL_KEY) || "{}") || {}; } catch (e) { return {}; } })();
  function emergencyDescriptor(el) {
    if (!el || !el.tagName) return null;
    var page = el.closest && el.closest("main.page,.cv-panel,.qe-pane"), pageId = page && (page.id || page.getAttribute("data-panel") || page.getAttribute("data-pane")) || "global";
    if (el.id) return { page: pageId, id: el.id };
    /* Stable dynamic-field identity. Never use a document-wide field position:
       page rebuilds and variable row counts made old descriptors restore values
       into unrelated GPR/DPR/DC/Backfilling fields. */
    var attrs = {}, names = ["data-s","data-r","data-sec","data-qc","data-q","data-f","data-k","data-df","data-gpr","data-gpr-cell","data-meta","data-list","data-i","data-qi","data-pro","data-row-k","data-layer-a","name"];
    names.forEach(function (n) { var v = el.getAttribute && el.getAttribute(n); if (v != null && v !== "") attrs[n] = v; });
    if (!Object.keys(attrs).length) return null; /* ambiguous legacy field: do not journal */
    var selector = el.tagName.toLowerCase();
    Object.keys(attrs).forEach(function (n) { selector += "[" + n + '=\"' + String(attrs[n]).replace(/[\"\\]/g, "") + '\"]'; });
    var root = page || document, matches = [];
    try { matches = Array.prototype.slice.call(root.querySelectorAll(selector)); } catch (e) {}
    return { page: pageId, tag: el.tagName.toLowerCase(), attrs: attrs, index: Math.max(0, matches.indexOf(el)) };
  }
  function emergencySelector(desc) {
    if (!desc) return null;
    /* Old id-less descriptors had no page scope and were position-based. They
       are intentionally ignored to prevent silent cross-page data corruption. */
    if (!desc.page && !desc.id) return null;
    if (desc.id) return document.getElementById(desc.id);
    var root = desc.page === "global" ? document : (document.getElementById(desc.page) || document.querySelector('[data-panel="' + desc.page + '"],[data-pane="' + desc.page + '"]'));
    if (!root) return null;
    var selector = desc.tag || "input";
    Object.keys(desc.attrs || {}).forEach(function (n) { selector += "[" + n + '=\"' + String(desc.attrs[n]).replace(/[\"\\]/g, "") + '\"]'; });
    try { return root.querySelectorAll(selector)[desc.index || 0] || null; } catch (e) { return null; }
  }
  function journalField(el) {
    if (!el || !/^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName) || el.type === "file" || el.type === "button" || el.closest("#qc-ent-modal")) return;
    var desc = emergencyDescriptor(el); if (!desc) return;
    var key = JSON.stringify(desc);
    emergencyJournal[key] = { d: desc, v: (el.type === "checkbox" || el.type === "radio") ? !!el.checked : el.value, c: el.type === "checkbox" || el.type === "radio", at: Date.now() };
    var keys = Object.keys(emergencyJournal);
    if (keys.length > 700) keys.sort(function (a,b) { return emergencyJournal[b].at - emergencyJournal[a].at; }).slice(700).forEach(function (k) { delete emergencyJournal[k]; });
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(emergencyJournal)); localStorage.setItem(JOURNAL_DIRTY_KEY, "1"); } catch (e) {}
  }
  function checkpointAllFields(dirty) {
    var fresh = {};
    Array.prototype.forEach.call(document.querySelectorAll("input,textarea,select"), function (el) {
      if (!el || el.type === "file" || el.type === "button" || (el.closest && el.closest("#qc-ent-modal"))) return;
      var desc = emergencyDescriptor(el); if (!desc) return;
      fresh[JSON.stringify(desc)] = { d: desc, v: (el.type === "checkbox" || el.type === "radio") ? !!el.checked : el.value,
        c: el.type === "checkbox" || el.type === "radio", at: Date.now() };
    });
    emergencyJournal = fresh;
    try { localStorage.setItem(JOURNAL_KEY, JSON.stringify(fresh)); localStorage.setItem(JOURNAL_DIRTY_KEY, dirty ? "1" : "0"); } catch (e) {}
  }
  function restoreEmergencyJournal() {
    var wasDirty = false; try { wasDirty = localStorage.getItem(JOURNAL_DIRTY_KEY) === "1"; } catch (e0) {}
    var entries = Object.keys(emergencyJournal).map(function (k) { return emergencyJournal[k]; }).filter(function (x) { return x && x.d; }).sort(function (a,b) { return a.at - b.at; }), n = 0;
    entries.forEach(function (x) {
      var el = emergencySelector(x.d); if (!el || el.type === "file") return;
      if (x.c) el.checked = !!x.v; else el.value = x.v == null ? "" : x.v;
      try { el.dispatchEvent(new Event("input", { bubbles: true })); } catch (e1) {}
      try { el.dispatchEvent(new Event("change", { bubbles: true })); } catch (e2) {}
      n++;
    });
    if (n && wasDirty) { setSavePill("", "Emergency recovery restored"); toastSafe("تم استرجاع آخر إدخال بعد الخروج غير المتوقع", "ok"); }
    return n;
  }

  function restoreDraft() {
    var raw = null, backupRaw = null, d = null, backup = null, usedBackup = false;
    try { raw = localStorage.getItem(STORAGE_KEY); backupRaw = localStorage.getItem(BACKUP_KEY); } catch (e) { return false; }
    try { if (raw) d = JSON.parse(raw); } catch (e1) { d = null; }
    try { if (backupRaw) backup = JSON.parse(backupRaw); } catch (e2) { backup = null; }
    if (!d || (backup && (+backup.savedAt || 0) > (+d.savedAt || 0))) { d = backup; usedBackup = !!backup; }
    if (!d) return false;
    if (usedBackup) setTimeout(function () { toastSafe("تم استرجاع نسخة الطوارئ بعد خروج غير مكتمل", "ok"); }, 500);

    if (d.settings) {
      saveSettings(Object.assign(getSettings(), d.settings));
      applySettingsToUI(getSettings());
    }
    if (d.ts) {
      setVal("ts-project", d.ts.project); setVal("ts-site", d.ts.site);
      setVal("ts-observer", d.ts.observer); setVal("ts-supervisor", d.ts.supervisor); setVal("ts-date", d.ts.date);
      if (Array.isArray(d.ts.setups)) {
        var gs = ensureArrayGlobal("setups");
        gs.length = 0;
        d.ts.setups.forEach(function (s) { gs.push(s); });
        if (typeof window.renderSetups === "function") window.renderSetups();
      }
    }
    if (d.ls) {
      setVal("ls-project", d.ls.project); setVal("ls-site", d.ls.site);
      if (Array.isArray(d.ls.sections)) {
        var secs = ensureArrayGlobal("sections");
        secs.length = 0;
        d.ls.sections.forEach(function (s) { secs.push(s); });
        if (typeof window.renderSections === "function") window.renderSections();
      }
    }
    if (d.sc) {
      var sc = d.sc;
      [
        ["sc-project","project"],["sc-site","site"],["sc-date","date"],["sc-supervisor","supervisor"],
        ["sc-session","session"],["sc-point","point"],["sc-surveyor","surveyor"],["sc-synch","synch"],
        ["sc-id-gs","idGs"],["sc-id-cs","idCs"],["sc-tag-ram","tagRam"],["sc-obs-type","obsType"],
        ["sc-zone-number","zone"],["sc-geoid-model","geoid"],["sc-point-class","pointClass"],["sc-meas-ht","measHt"],
        ["sc-easting","easting"],["sc-northing","northing"],["sc-elevation","elevation"],
        ["sc-lon-deg","lonDeg"],["sc-lon-min","lonMin"],["sc-lon-sec","lonSec"],["sc-lon-hemi","lonHemi"],
        ["sc-lat-deg","latDeg"],["sc-lat-min","latMin"],["sc-lat-sec","latSec"],["sc-lat-hemi","latHemi"],
        ["sc-geo-height","geoHeight"],["sc-height-reading","heightReading"],["sc-vertical-offset","verticalOffset"],
        ["sc-true-vertical-ht","trueHeight"],["sc-notes","notes"]
      ].forEach(function (p) { setVal(p[0], sc[p[1]]); });
      if (Array.isArray(sc.checks) && window.scChecks && window.SC_ITEMS) {
        for (var i = 0; i < window.SC_ITEMS.length; i++) window.scChecks[i] = !!sc.checks[i];
        if (typeof window.renderChecklist === "function") window.renderChecklist();
      }
      if (typeof window.syncLonLatHidden === "function") window.syncLonLatHidden();
      if (typeof window.updateTrueVerticalHT === "function") window.updateTrueVerticalHT();
    }
    if (d.photos) {
      photoStore.ts = Array.isArray(d.photos.ts) ? d.photos.ts : [];
      if (d.photos && d.photos.dir) {
        dirPhotos = { N: d.photos.dir.N || null, E: d.photos.dir.E || null, S: d.photos.dir.S || null, W: d.photos.dir.W || null };
        renderDirPhotos();
      }
      photoStore.enez = d.photos.enez || null;
      photoStore.llh = d.photos.llh || null;
      photoStore.custom = Array.isArray(d.photos.custom) ? d.photos.custom : [];
      renderPhotoThumbs();
    }
    drawENMap();
    applyQcToleranceStyles();
    renderHistory();
    setSavePill("", "Restored draft");
    setTimeout(restoreEmergencyJournal, 120);
    return true;
  }

  // Clear inputs on screen only — history/draft retained until Reset Saved
  function clearStaticInputsOnly() {
    // archive current static values first if any meaningful data exists
    var has = val("sc-project") || val("sc-point") || val("sc-easting") || val("sc-height-reading") || val("sc-notes");
    if (has) pushHistorySnapshot("before-clear-inputs");

    [
      "sc-project","sc-site","sc-date","sc-supervisor","sc-session","sc-point","sc-surveyor","sc-synch",
      "sc-id-gs","sc-id-cs","sc-tag-ram","sc-obs-type","sc-zone-number","sc-geoid-model","sc-point-class",
      "sc-meas-ht","sc-easting","sc-northing","sc-elevation","sc-lon-deg","sc-lon-min","sc-lon-sec",
      "sc-lat-deg","sc-lat-min","sc-lat-sec","sc-geo-height","sc-height-reading","sc-vertical-offset",
      "sc-true-vertical-ht","sc-notes","sc-longitude","sc-latitude"
    ].forEach(function (id) {
      var el = $(id);
      if (!el) return;
      if (el.tagName === "SELECT") {
        el.selectedIndex = 0;
      } else el.value = "";
    });
    // defaults
    setVal("sc-lon-hemi", "E");
    setVal("sc-lat-hemi", "N");
    if (window.scChecks && window.SC_ITEMS) {
      for (var i = 0; i < window.SC_ITEMS.length; i++) window.scChecks[i] = false;
      if (typeof window.renderChecklist === "function") window.renderChecklist();
    }
    if (typeof window.syncLonLatHidden === "function") window.syncLonLatHidden();
    if (typeof window.updateTrueVerticalHT === "function") window.updateTrueVerticalHT();
    // keep photoStore and history; update draft to cleared form
    saveDraftNow();
    drawENMap();
    toastSafe("Inputs cleared. Previous data kept until Reset Saved.", "ok");
  }

  function resetAllSaved() {
    if (!confirm("Reset ALL saved drafts, history and attached photos on this device?")) return;
    try {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(BACKUP_KEY);
      localStorage.removeItem(JOURNAL_KEY);
      localStorage.removeItem(JOURNAL_DIRTY_KEY);
      emergencyJournal = {};
      localStorage.removeItem(HISTORY_KEY);
    } catch (e) {}
    photoStore = { ts: [], enez: null, llh: null, custom: [] };
    dualBuffers = { ts: null, enez: null, llh: null };
    // clear UI all pages
    clearStaticInputsOnly();
    // TS/LS hard clear
    ["ts-project","ts-site","ts-observer","ts-supervisor","ts-date","ls-project","ls-site"].forEach(function (id) { setVal(id, ""); });
    if (window.setups && typeof window.createEmptySetup === "function") {
      // fallback empty structure
    }
    try {
      var empty;
      if (typeof window.emptySetup === "function") empty = window.emptySetup();
      else {
        empty = { type: "MBS", rows: [], qcFixed: {id:"",easting:"",northing:"",elevation:""}, qcMeasured:{id:"",easting:"",northing:"",elevation:""} };
        for (var i=0;i<5;i++) empty.rows.push({id:"",easting:"",northing:"",elevation:"",remark:""});
      }
      var gs0 = ensureArrayGlobal("setups");
      gs0.length = 0; gs0.push(empty);
      if (typeof window.renderSetups === "function") window.renderSetups();
    } catch (e) { console.warn(e); }
    var sec0 = ensureArrayGlobal("sections");
    sec0.length = 0;
    sec0.push({ name:"", date:"", block:"", area:"", scan:"" });
    if (typeof window.renderSections === "function") window.renderSections();
    renderPhotoThumbs();
    renderHistory();
    drawENMap();
    setSavePill("", "All saved data reset");
    toastSafe("All saved data reset.", "ok");
  }

  // ---------------- theme ----------------
  function applyTheme(theme) {
    document.body.classList.toggle("theme-dark", theme === "dark");
    var btn = $("btn-theme-toggle");
    if (btn) {
      var ico = btn.querySelector(".tool-icon"), label = btn.querySelector(".tool-label");
      if (ico && label) { ico.textContent = theme === "dark" ? "☀️" : "🌙"; label.textContent = theme === "dark" ? "Light" : "Night"; }
      else btn.textContent = theme === "dark" ? "☀️ Light" : "🌙 Night";
      btn.setAttribute("aria-label", theme === "dark" ? "Light mode" : "Night mode");
    }
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", theme === "dark" ? "#0b1220" : "#1d4ed8");
  }
  function applySettingsToUI(s) {
    if (__applyGuard) return; /* FIX: re-entrant call from our own input events */
    __applyGuard = true;
    try {
    applyTheme(s.theme === "dark" ? "dark" : "light");
    applyDeviceTemplate(s.deviceTemplate || "generic");
    if (s.uiTheme) applyUiTheme(s.uiTheme.custom ? s.uiTheme : (THEMES.filter(function (x) { return x.id === s.uiTheme.id; })[0] || null));
    if (s.uiFont) { var __f = FONT_STACKS.filter(function (x) { return x.id === s.uiFont; })[0]; if (__f) applyUiFont(__f.stack); }
    applyTitleColor(s.titleColor || "#1e3a8a");
    qsa(".feat-dual").forEach(function (el) { el.checked = !!s.dualMode; });
    qsa(".feat-attach").forEach(function (el) { el.checked = s.attachPhotos !== false; });
    qsa(".feat-ask-photo").forEach(function (el) { el.checked = s.askSavePhoto !== false; });
    qsa('.feat-tol[data-tol="e"]').forEach(function (el) { el.value = s.tolE; });
    qsa('.feat-tol[data-tol="n"]').forEach(function (el) { el.value = s.tolN; });
    qsa('.feat-tol[data-tol="z"]').forEach(function (el) { el.value = s.tolZ; });
    setVal("company-name", s.companyName || "");
    setVal("report-prefix", s.reportPrefix || "QC");
    var sel = $("device-template");
    if (sel) sel.value = s.deviceTemplate || "generic";
    var logoPrev = $("company-logo-preview");
    if (logoPrev) {
      if (s.companyLogo) {
        logoPrev.src = s.companyLogo;
        logoPrev.style.display = "inline-block";
      } else {
        logoPrev.removeAttribute("src");
        logoPrev.style.display = "none";
      }
    }
    var rn = $("report-number-view");
    if (rn) {
      var year = new Date().getFullYear();
      rn.textContent = "Next: " + (s.reportPrefix || "QC") + "-" + year + "-" + String(s.reportSeq || 1).padStart(3, "0");
    }
    } finally { __applyGuard = false; }
  }

  // ---------------- dual confirm ----------------
  function maybeDualConfirm(key, parsed) {
    var s = getSettings();
    if (!s.dualMode) return { ok: true, parsed: parsed, note: "" };
    if (!dualBuffers[key]) {
      dualBuffers[key] = { parsed: parsed };
      return { ok: false, needSecond: true, parsed: parsed, note: "Dual mode: capture the same screen again to confirm." };
    }
    var a = dualBuffers[key].parsed || {};
    var b = parsed || {};
    var fields = ["id","easting","northing","elevation","longitude","latitude","geoHeight"];
    var merged = {}, conflicts = [];
    fields.forEach(function (f) {
      var va = String(a[f] || "").trim();
      var vb = String(b[f] || "").trim();
      if (va && vb) {
        if (va === vb) merged[f] = va;
        else {
          var na = parseFloat(va), nb = parseFloat(vb);
          if (!isNaN(na) && !isNaN(nb) && Math.abs(na - nb) <= 0.0005) merged[f] = vb;
          else { conflicts.push(f); merged[f] = vb; }
        }
      } else merged[f] = vb || va || "";
    });
    dualBuffers[key] = null;
    return {
      ok: true,
      parsed: merged,
      conflicts: conflicts,
      note: conflicts.length ? ("Conflict on: " + conflicts.join(", ") + " (latest kept)") : "Dual confirmation matched."
    };
  }

  // ---------------- photos ----------------
  function currentStationName() {
    return val("sc-point") || val("ts-site") || val("ls-site") || "Station";
  }
  function rememberPhoto(kind, dataUrl, meta) {
    if (!dataUrl) return;
    var item = {
      url: dataUrl,
      at: Date.now(),
      station: (meta && meta.station) || currentStationName(),
      title: (meta && meta.title) || "",
      kind: kind,
      meta: meta || {}
    };
    if (kind === "ts") {
      photoStore.ts.push(item);
      if (photoStore.ts.length > 12) photoStore.ts = photoStore.ts.slice(-12);
    } else if (kind === "enez") photoStore.enez = item;
    else if (kind === "llh") photoStore.llh = item;
    else {
      photoStore.custom.push(item);
      if (photoStore.custom.length > 20) photoStore.custom = photoStore.custom.slice(-20);
    }
    compressStoredPhoto(item); // FIX: shrink before it reaches localStorage (quota safety)
    renderPhotoThumbs();
    scheduleSave();
  }

  // FIX: downscale/re-encode stored photos so autosave never blows the ~5MB localStorage quota.
  function compressStoredPhoto(item) {
    if (!item || !item.url) return;
    try {
      var original = item.url;
      var img = new Image();
      img.onload = function () {
        try {
          /* v223 smart profiles: instrument/OCR screens keep fine text; site
             photos use stronger compression to protect offline storage. */
          var textCritical = item.kind === "ts" || item.kind === "enez" || item.kind === "llh" || !!(item.meta && item.meta.field);
          var MAX_SIDE = textCritical ? 1900 : 1500;
          var JPEG_Q = textCritical ? 0.90 : 0.76;
          var w = img.naturalWidth || img.width;
          var h = img.naturalHeight || img.height;
          var s = Math.min(1, MAX_SIDE / Math.max(1, Math.max(w, h)));
          var alreadySmall = /^data:image\/jpeg/.test(original) && original.length < 320000;
          if (s >= 1 && alreadySmall) { dedupeStoredPhoto(item); return; }
          var c = document.createElement("canvas");
          c.width = Math.max(1, Math.round(w * s));
          c.height = Math.max(1, Math.round(h * s));
          var ctx = c.getContext("2d");
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(0, 0, c.width, c.height);
          ctx.drawImage(img, 0, 0, c.width, c.height);
          var out = c.toDataURL("image/jpeg", JPEG_Q);
          if (out && out.length < original.length) {
            item.url = out;
            renderPhotoThumbs();
            scheduleSave();
          }
          dedupeStoredPhoto(item);
        } catch (e) { /* keep original */ }
      };
      img.onerror = function () { /* keep original */ };
      img.src = original;
    } catch (e) { /* keep original */ }
  }

  function dedupeStoredPhoto(item) {
    if (!item || !item.url) return;
    try {
      var data = new TextEncoder().encode(item.url);
      if (!(window.crypto && crypto.subtle)) return;
      crypto.subtle.digest("SHA-256", data).then(function (buf) {
        item.hash = Array.prototype.map.call(new Uint8Array(buf), function (x) { return x.toString(16).padStart(2, "0"); }).join("");
        var items = (photoStore.ts || []).concat([photoStore.enez, photoStore.llh]).concat(photoStore.custom || []).filter(Boolean);
        var duplicate = items.some(function (x) { return x !== item && x.hash && x.hash === item.hash; });
        if (!duplicate) { scheduleSave(); return; }
        photoStore.ts = (photoStore.ts || []).filter(function (x) { return x !== item; });
        photoStore.custom = (photoStore.custom || []).filter(function (x) { return x !== item; });
        if (photoStore.enez === item) photoStore.enez = null;
        if (photoStore.llh === item) photoStore.llh = null;
        renderPhotoThumbs(); scheduleSave();
        toastSafe("Duplicate image skipped — الصورة موجودة مسبقاً", "load");
      }).catch(function () {});
    } catch (e) {}
  }

  function renderPhotoThumbs() {
    var hosts = qsa("#photo-thumbs, .photo-thumbs");
    if (!hosts.length) return;
    var items = [];
    (photoStore.ts || []).forEach(function (p, i) { items.push(p); });
    if (photoStore.enez) items.push(photoStore.enez);
    if (photoStore.llh) items.push(photoStore.llh);
    (photoStore.custom || []).forEach(function (p) { items.push(p); });
    var html = !items.length
      ? '<div class="empty-hint"><span class="empty-title">\uD83D\uDCF7 No station photos yet</span>Photos you attach from the \uD83D\uDCF7 camera buttons appear here and in the exported PDF.<br>\u0635\u0648\u0631 \u0627\u0644\u0645\u062D\u0637\u0629 \u062A\u0637\u0644\u0639 \u0647\u0646\u0627 \u0648\u062A\u0646\u0632\u0644 \u0645\u0639 \u062A\u0642\u0631\u064A\u0631 \u0627\u0644\u0640 PDF</div>'
      : items.map(function (it, idx) {
          var label = (it.station || "Station") + (it.title ? (" / " + it.title) : (" / " + (it.kind || "Photo")));
          return '<div class="photo-thumb-item" data-idx="' + idx + '">' +
            '<img src="' + it.url + '" alt="' + esc(label) + '"/>' +
            '<div class="photo-thumb-cap">' + esc(label) + '</div>' +
            '<button type="button" class="photo-del" data-kind="' + esc(it.kind || "") + '" data-at="' + it.at + '">×</button>' +
          '</div>';
        }).join("");
    hosts.forEach(function (host) { host.innerHTML = html; });
    qsa(".photo-del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var kind = btn.getAttribute("data-kind");
        var at = +btn.getAttribute("data-at");
        if (kind === "ts") photoStore.ts = (photoStore.ts || []).filter(function (p) { return p.at !== at; });
        else if (kind === "enez" && photoStore.enez && photoStore.enez.at === at) photoStore.enez = null;
        else if (kind === "llh" && photoStore.llh && photoStore.llh.at === at) photoStore.llh = null;
        else photoStore.custom = (photoStore.custom || []).filter(function (p) { return p.at !== at; });
        renderPhotoThumbs();
        scheduleSave();
      });
    });
  }

  // Photo save prompt modal logic
  function openPhotoSavePrompt(dataUrl, kind, meta) {
    var s = getSettings();
    if (s.askSavePhoto === false) {
      // auto-save when ask disabled and attach enabled
      if (s.attachPhotos !== false) rememberPhoto(kind, dataUrl, meta);
      return Promise.resolve(false);
    }
    return new Promise(function (resolve) {
      pendingPhotoDecision = { dataUrl: dataUrl, kind: kind, meta: meta || {}, resolve: resolve };
      var m = $("photo-save-modal");
      if (!m) {
        // fallback save
        rememberPhoto(kind, dataUrl, meta);
        resolve(true);
        return;
      }
      var st = (meta && meta.station) || currentStationName() || "Station";
      var tt = (meta && meta.title) || defaultPhotoTitle(kind) || "Capture";
      setVal("photo-station-name", st);
      setVal("photo-setup-title", tt);
      m.classList.remove("hidden");
      m.setAttribute("aria-hidden", "false");
    });
  }
  function ocrCaptureTitle(kind) {
    /* name the saved photo after what it was captured for, e.g. "Setup 01 — Row 1" */
    try {
      var t = window.ocrTarget;
      if (t && typeof t.s === "number" && t.s >= 0) {
        var su = "Setup " + String(t.s + 1).padStart(2, "0");
        if (t.type === "row") return su + " \u2014 Row " + ((t.r || 0) + 1);
        if (t.type === "qc") return su + " \u2014 QC " + (t.q === "fixed" ? "Fixed" : "Measured");
      }
    } catch (e) {}
    return defaultPhotoTitle(kind);
  }
  function defaultPhotoTitle(kind) {
    if (kind === "enez") return "E/N/Z Capture";
    if (kind === "llh") return "Lon/Lat/H Capture";
    return "Station Capture";
  }
  function closePhotoSavePrompt() {
    var m = $("photo-save-modal");
    if (m) {
      m.classList.add("hidden");
      m.setAttribute("aria-hidden", "true");
    }
  }

  // ---------------- QC tolerances ----------------
  function getTols() {
    var s = getSettings();
    var e = document.querySelector('.feat-tol[data-tol="e"]');
    var n = document.querySelector('.feat-tol[data-tol="n"]');
    var z = document.querySelector('.feat-tol[data-tol="z"]');
    return {
      e: Math.abs(parseFloat((e && e.value) || s.tolE) || 0.02),
      n: Math.abs(parseFloat((n && n.value) || s.tolN) || 0.02),
      z: Math.abs(parseFloat((z && z.value) || s.tolZ) || 0.03)
    };
  }
  /* v175.1: تُستدعى من index.html بعد تحديث خلايا الفروق وبعد كل إعادة رسم */
  window.__qcApplyTolStyles = function () { try { applyQcToleranceStyles(); } catch (e) {} };
  function applyQcToleranceStyles() {
    var tols = getTols();
    qsa("tr.diff td, tr.diff-row td").forEach(function (td) {
      var txt = (td.textContent || "").replace(/,/g, ".");
      var m = txt.match(/([+-]?\d+(?:\.\d+)?)/);
      if (!m) return;
      var num = Math.abs(parseFloat(m[1]));
      if (isNaN(num)) return;
      var full = txt.toLowerCase();
      var axis = "e";
      if (full.indexOf("dn") >= 0) axis = "n";
      if (full.indexOf("dz") >= 0) axis = "z";
      var lim = axis === "n" ? tols.n : (axis === "z" ? tols.z : tols.e);
      td.classList.remove("diff-bad", "diff-good");
      td.classList.add(num <= lim ? "diff-good" : "diff-bad");
      td.title = (num <= lim ? "Within" : "Exceeds") + " tolerance " + lim + " m";
    });
    // summary badge
    var bad = qsa(".diff-bad").length;
    var good = qsa(".diff-good").length;
    qsa(".qc-summary").forEach(function (el) {
      el.textContent = bad ? (bad + " values outside tolerance") : (good ? "All visible diffs within tolerance" : "No QC diffs yet");
      el.style.color = bad ? "#b91c1c" : "#047857";
    });
  }

  // ---------------- EN map ----------------
  function gatherENPoints() {
    var pts = [];
    if (window.setups && Array.isArray(window.setups)) {
      arr(window.setups).forEach(function (s, si) {
        (s.rows || []).forEach(function (r, ri) {
          var e = parseFloat(r.easting), n = parseFloat(r.northing);
          if (!isNaN(e) && !isNaN(n)) pts.push({ e: e, n: n, label: r.id || ("S" + (si + 1) + "." + (ri + 1)), kind: "ts" });
        });
        if (s.qcMeasured) {
          var e2 = parseFloat(s.qcMeasured.easting), n2 = parseFloat(s.qcMeasured.northing);
          if (!isNaN(e2) && !isNaN(n2)) pts.push({ e: e2, n: n2, label: s.qcMeasured.id || ("QC" + (si + 1)), kind: "qc" });
        }
      });
    }
    var se = parseFloat(val("sc-easting")), sn = parseFloat(val("sc-northing"));
    if (!isNaN(se) && !isNaN(sn)) pts.push({ e: se, n: sn, label: val("sc-point") || "STN", kind: "stn" });
    return pts;
  }
  function drawENMap() {
    var canvases = qsa("#en-map, #en-map-sc");
    if (!canvases.length) {
      var one = $("en-map"); if (one) canvases = [one];
    }
    canvases.forEach(function(c){ drawENMapOn(c); });
  }
  function drawENMapOn(canvas) {
    if (!canvas || !canvas.getContext) return;
    var ctx = canvas.getContext("2d");
    var dpr = window.devicePixelRatio || 1;
    var cssW = canvas.clientWidth || 320;
    var cssH = canvas.clientHeight || 260;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, cssW, cssH);
    var bg = getComputedStyle(document.body).getPropertyValue("--bg") || "#f8fafc";
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, cssW, cssH);
    var pts = gatherENPoints();
    var legend = (canvas.id && canvas.id.indexOf("sc") >= 0) ? $("en-map-legend-sc") : $("en-map-legend");
    if (!pts.length) {
      ctx.fillStyle = "#94a3b8";
      ctx.font = "600 13px sans-serif";
      ctx.fillText("No E/N points yet. Enter coordinates to plot.", 16, 28);
      if (legend) legend.textContent = "Points: 0";
      return;
    }
    var minE = pts[0].e, maxE = pts[0].e, minN = pts[0].n, maxN = pts[0].n;
    pts.forEach(function (p) {
      if (p.e < minE) minE = p.e; if (p.e > maxE) maxE = p.e;
      if (p.n < minN) minN = p.n; if (p.n > maxN) maxN = p.n;
    });
    var pad = 28;
    var dx = Math.max(1e-6, maxE - minE);
    var dy = Math.max(1e-6, maxN - minN);
    var scale = Math.min((cssW - pad * 2) / dx, (cssH - pad * 2) / dy);
    function X(e) { return pad + (e - minE) * scale + ((cssW - pad * 2) - dx * scale) / 2; }
    function Y(n) { return cssH - pad - (n - minN) * scale - ((cssH - pad * 2) - dy * scale) / 2; }
    ctx.strokeStyle = "rgba(148,163,184,0.35)";
    ctx.lineWidth = 1;
    for (var g = 0; g < 5; g++) {
      var gx = pad + g * (cssW - pad * 2) / 4;
      var gy = pad + g * (cssH - pad * 2) / 4;
      ctx.beginPath(); ctx.moveTo(gx, pad); ctx.lineTo(gx, cssH - pad); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(pad, gy); ctx.lineTo(cssW - pad, gy); ctx.stroke();
    }
    ctx.fillStyle = "#64748b";
    ctx.font = "600 11px sans-serif";
    ctx.fillText("E →", cssW - 34, cssH - 10);
    ctx.fillText("N ↑", 8, 16);
    // store mapping + positions for the distance-measure interaction
    canvas.__qcMapData = {
      pts: pts.map(function (p) { return { e: p.e, n: p.n, label: String(p.label || ""), kind: p.kind, x: X(p.e), y: Y(p.n) }; })
    };
    pts.forEach(function (p) {
      var x = X(p.e), y = Y(p.n);
      ctx.beginPath();
      ctx.fillStyle = p.kind === "stn" ? "#0d9488" : (p.kind === "qc" ? "#7c3aed" : "#2563eb");
      ctx.arc(x, y, p.kind === "stn" ? 6 : 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = getComputedStyle(document.body).getPropertyValue("--text") || "#0f172a";
      ctx.font = "700 11px sans-serif";
      ctx.fillText(String(p.label || ""), x + 8, y - 8);
    });

    /* ===== distance measurement: tap two points ===== */
    var md = canvas.__qcMapData;
    var sel = canvas.__qcMeasure || [];
    function keyOf(p) { return p.label + "@" + p.e.toFixed(4) + "," + p.n.toFixed(4); }
    var selPts = sel.map(function (k) {
      for (var i = 0; i < md.pts.length; i++) if (keyOf(md.pts[i]) === k) return md.pts[i];
      return null;
    }).filter(Boolean);

    function drawMeasure() {
      if (selPts.length !== 2) return;
      var a = selPts[0], b = selPts[1];
      var dist = Math.sqrt(Math.pow(a.e - b.e, 2) + Math.pow(a.n - b.n, 2));
      // highlight rings
      [a, b].forEach(function (p) {
        ctx.beginPath();
        ctx.strokeStyle = "#e11d48";
        ctx.lineWidth = 2.5;
        ctx.arc(p.x, p.y, 9, 0, Math.PI * 2);
        ctx.stroke();
      });
      // dashed line
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 2;
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.setLineDash([]);
      // distance label on a white pill at midpoint
      var mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
      var txt = dist.toFixed(3) + " m";
      ctx.font = "800 12px sans-serif";
      var tw = ctx.measureText(txt).width;
      ctx.fillStyle = "rgba(255,255,255,.95)";
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 1;
      var pw = tw + 12, ph = 18;
      ctx.beginPath();
      ctx.roundRect ? ctx.roundRect(mx - pw / 2, my - ph / 2, pw, ph, 5) : ctx.rect(mx - pw / 2, my - ph / 2, pw, ph);
      ctx.fill();
      ctx.stroke();
      ctx.fillStyle = "#be123c";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(txt, mx, my + 0.5);
      ctx.textAlign = "left";
      ctx.textBaseline = "alphabetic";
      if (legend) legend.textContent = "Points: " + md.pts.length + "  |  \uD83D\uDCCF " + a.label + " \u2192 " + b.label + " = " + dist.toFixed(3) + " m";
    }
    drawMeasure();

    if (selPts.length === 1) {
      var only = selPts[0];
      ctx.beginPath();
      ctx.strokeStyle = "#e11d48";
      ctx.lineWidth = 2.5;
      ctx.arc(only.x, only.y, 9, 0, Math.PI * 2);
      ctx.stroke();
    }

    if (!legend) {
    } else if (selPts.length === 2) {
      /* legend already set by drawMeasure */
    } else {
      legend.textContent = "Points: " + md.pts.length + " (blue=TS, purple=QC, teal=Station) \u00B7 \uD83D\uDCCF " +
        (selPts.length === 1 ? "tap a second point" : "tap 2 points = distance");
    }

    // wire click-to-measure once per canvas
    if (!canvas.__qcMapWired) {
      canvas.__qcMapWired = true;
      canvas.style.cursor = "crosshair";
      canvas.addEventListener("click", function (ev) {
        var data = canvas.__qcMapData;
        if (!data || !data.pts.length) return;
        var r = canvas.getBoundingClientRect();
        var cx = ev.clientX - r.left, cy = ev.clientY - r.top;
        var best = null, bestD = 20; // snap radius px
        data.pts.forEach(function (p) {
          var d = Math.sqrt(Math.pow(p.x - cx, 2) + Math.pow(p.y - cy, 2));
          if (d < bestD) { bestD = d; best = p; }
        });
        var sel2 = canvas.__qcMeasure || [];
        var k = best ? keyOf(best) : null;
        if (!k) { canvas.__qcMeasure = []; }
        else if (sel2.length >= 2 || sel2.length === 0) { canvas.__qcMeasure = [k]; }
        else if (sel2[0] === k) { canvas.__qcMeasure = [k]; }
        else { canvas.__qcMeasure = [sel2[0], k]; }
        drawENMapOn(canvas);
      });
    }
  }

  // ---------------- Excel/CSV + full pack ----------------
  function downloadBlob(blob, filename) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    /* كروم يسمّي الملف "download" إذا كان الاسم فيه حروف عربية → نحوّله للاتيني */
    var safe = (typeof window.__qcSafeFileName === "function")
      ? window.__qcSafeFileName(filename)
      : String(filename || "");
    a.href = url; a.download = safe; a.rel = "noopener";
    document.body.appendChild(a); a.click();
    setTimeout(function () {
      try { document.body.removeChild(a); } catch (e) {}
      try { URL.revokeObjectURL(url); } catch (e) {}
    }, 350);
  }
  function exportCSV() {
    var rows = [["Page","Field","Value"]];
    function add(page, field, value) { rows.push([page, field, value == null ? "" : value]); }
    ["ts-project","ts-site","ts-observer","ts-supervisor","ts-date"].forEach(function (id){ add("TotalStation", id, val(id)); });
    arr(window.setups).forEach(function (s, si) {
      (s.rows || []).forEach(function (r, ri) {
        add("TotalStation", "S"+(si+1)+"R"+(ri+1)+"_ID", r.id);
        add("TotalStation", "S"+(si+1)+"R"+(ri+1)+"_E", r.easting);
        add("TotalStation", "S"+(si+1)+"R"+(ri+1)+"_N", r.northing);
        add("TotalStation", "S"+(si+1)+"R"+(ri+1)+"_Z", r.elevation);
      });
    });
    ["ls-project","ls-site"].forEach(function (id){ add("LaserScanner", id, val(id)); });
    if (window.sections) {
      arr(window.sections).forEach(function (s, i) {
        add("LaserScanner", "Section"+(i+1), [s.name,s.date,s.block,s.area,s.scan,s.boxName,s.model,s.serialNo].join(" | "));
        add("LaserScanner", "Section"+(i+1)+"_BoxName", s.boxName || "");
        add("LaserScanner", "Section"+(i+1)+"_Model", s.model || "");
        add("LaserScanner", "Section"+(i+1)+"_SerialNo", s.serialNo || "");
      });
    }
    [
      "sc-project","sc-site","sc-date","sc-supervisor","sc-session","sc-point","sc-surveyor","sc-synch","sc-id-gs","sc-id-cs","sc-tag-ram",
      "sc-obs-type","sc-zone-number","sc-geoid-model","sc-point-class","sc-meas-ht","sc-easting","sc-northing","sc-elevation",
      "sc-longitude","sc-latitude","sc-geo-height","sc-height-reading","sc-vertical-offset","sc-true-vertical-ht","sc-notes"
    ].forEach(function (id){ add("StaticChecklist", id, val(id)); });
    if (window.SC_ITEMS && window.scChecks) {
      window.SC_ITEMS.forEach(function (it, i) {
        add("StaticChecklist", "Check"+(i+1), (window.scChecks[i]?"YES":"NO")+" | "+(it.en||""));
      });
    }
    var csv = rows.map(function (r) {
      return r.map(function (c) {
        var s = String(c == null ? "" : c);
        if (/[",\n]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
        return s;
      }).join(",");
    }).join("\n");
    var name = nextReportNumber(false) + ".csv";
    downloadBlob(new Blob([csv], { type: "text/csv;charset=utf-8" }), name);
    toastSafe("CSV exported", "ok");
  }
  function exportExcel() {
    if (typeof XLSX === "undefined") { exportCSV(); return; }
    var wb = XLSX.utils.book_new();
    var tsRows = [["Setup","Type","Row","ID","Easting","Northing","Elevation","Remark","QC_Fixed_E","QC_Fixed_N","QC_Fixed_Z","QC_Meas_E","QC_Meas_N","QC_Meas_Z","dE","dN","dZ"]];
    arr(window.setups).forEach(function (s, si) {
      var qf = s.qcFixed || {}, qm = s.qcMeasured || {};
      var de = parseFloat(qf.easting) - parseFloat(qm.easting);
      var dn = parseFloat(qf.northing) - parseFloat(qm.northing);
      var dz = parseFloat(qf.elevation) - parseFloat(qm.elevation);
      (s.rows || []).forEach(function (r, ri) {
        tsRows.push([si+1, s.type||"", ri+1, r.id||"", r.easting||"", r.northing||"", r.elevation||"", r.remark||"",
          qf.easting||"", qf.northing||"", qf.elevation||"", qm.easting||"", qm.northing||"", qm.elevation||"",
          isNaN(de)?"":de, isNaN(dn)?"":dn, isNaN(dz)?"":dz]);
      });
    });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(tsRows), "TotalStation");
    var lsRows = [["#","Name","Date","Block","Area","Scan","Box name","Model","Serial No."]];
    arr(window.sections).forEach(function (s,i){ lsRows.push([i+1,s.name||"",s.date||"",s.block||"",s.area||"",s.scan||"",s.boxName||"",s.model||"",s.serialNo||""]); });
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(lsRows), "LaserScanner");
    var scRows = [["Field","Value"]];
    [
      ["Project","sc-project"],["Site","sc-site"],["Date","sc-date"],["Supervisor","sc-supervisor"],["Session Type","sc-session"],
      ["Station Name","sc-point"],["Surveyor Name","sc-surveyor"],["Sync Rate Mask","sc-synch"],["ID GS","sc-id-gs"],["ID CS","sc-id-cs"],
      ["Tag of RAM","sc-tag-ram"],["Observation Type","sc-obs-type"],["Zone Number","sc-zone-number"],["Geoid Model","sc-geoid-model"],
      ["Point Class","sc-point-class"],["Measurement Type HT","sc-meas-ht"],["Easting","sc-easting"],["Northing","sc-northing"],
      ["Elevation","sc-elevation"],["Longitude","sc-longitude"],["Latitude","sc-latitude"],["Ellipsoidal Height","sc-geo-height"],
      ["Height Reading","sc-height-reading"],["Height Hook","sc-vertical-offset"],["True Height","sc-true-vertical-ht"],["Notes","sc-notes"]
    ].forEach(function (p){ scRows.push([p[0], val(p[1])]); });
    if (window.SC_ITEMS) {
      scRows.push([]); scRows.push(["Checklist #","Done","English","Arabic"]);
      window.SC_ITEMS.forEach(function (it,i){ scRows.push([i+1,(window.scChecks&&window.scChecks[i])?"YES":"NO", it.en||"", it.ar||""]); });
    }
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(scRows), "StaticChecklist");
    var fname = nextReportNumber(false) + ".xlsx";
    XLSX.writeFile(wb, fname);
    toastSafe("Excel exported", "ok");
  }

  async function exportFullPack() {
    if (typeof JSZip === "undefined") {
      toastSafe("Zip library missing. Exporting Excel only.", "err");
      exportExcel();
      return;
    }
    toastSafe("Building full package…", "load");
    try {
      var zip = new JSZip();
      var reportNo = nextReportNumber(true);
      var folder = zip.folder(reportNo);

      // JSON archive
      folder.file("data.json", JSON.stringify(collectDraft(), null, 2));

      // CSV — FIX: this data was built before but never written into the zip
      var csvParts = [];
      csvParts.push("Report," + reportNo);
      csvParts.push("Generated," + new Date().toISOString());
      csvParts.push("");
      csvParts.push("Section,Setup,Point ID,Easting,Northing,Elevation,Remark");
      arr(window.setups).forEach(function (su, si) {
        (su.rows || []).forEach(function (r) {
          if (r && (r.id || r.easting || r.northing || r.elevation)) {
            csvParts.push(["TotalStation", "Setup " + (si + 1), r.id, r.easting, r.northing, r.elevation, r.remark || ""].map(function (f) { return '"' + String(f == null ? "" : f).replace(/"/g, '""') + '"'; }).join(","));
          }
        });
        ["fixed", "measured"].forEach(function (qk) {
          var q = su.qcFixed && qk === "fixed" ? su.qcFixed : su.qcMeasured;
          if (q && (q.id || q.easting)) csvParts.push(["TotalStation", "Setup " + (si + 1) + " QC-" + qk, q.id, q.easting, q.northing, q.elevation, ""].map(function (f) { return '"' + String(f == null ? "" : f).replace(/"/g, '""') + '"'; }).join(","));
        });
      });
      arr(window.sections).forEach(function (sec, si) {
        if (sec && (sec.name || sec.block || sec.scan)) csvParts.push(["LaserScanner", "Section " + (si + 1), sec.name, "Block " + sec.block, "Area " + sec.area, "Scan " + sec.scan, sec.date || ""].map(function (f) { return '"' + String(f == null ? "" : f).replace(/"/g, '""') + '"'; }).join(","));
      });
      csvParts.push("");
      csvParts.push("Static Point,Easting,Northing,Elevation");
      csvParts.push(['"' + (val("sc-point") || "SC") + '"', '"' + val("sc-easting") + '"', '"' + val("sc-northing") + '"', '"' + val("sc-elevation") + '"'].join(","));
      folder.file("data.csv", "\uFEFF" + csvParts.join("\n")); // BOM so Excel opens UTF-8 correctly
      folder.file("summary.txt", "QC Survey Package\nReport: " + reportNo + "\nStation: " + currentStationName() + "\nGenerated: " + new Date().toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));

      // Excel if available
      if (typeof XLSX !== "undefined") {
        var wb = XLSX.utils.book_new();
        var aoa = [["Field","Value"],["Report",reportNo],["Station",currentStationName()],["Project",val("sc-project")||val("ts-project")],["Surveyor",val("sc-surveyor")],["Easting",val("sc-easting")],["Northing",val("sc-northing")],["Elevation",val("sc-elevation")],["Longitude",val("sc-longitude")],["Latitude",val("sc-latitude")],["True Height",val("sc-true-vertical-ht")]];
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(aoa), "Summary");
        var excelOut = XLSX.write(wb, { bookType: "xlsx", type: "array" });
        folder.file(reportNo + ".xlsx", excelOut);
      }

      // photos
      var picFolder = folder.folder("photos");
      function addPic(item, name) {
        if (!item || !item.url) return;
        var b64 = String(item.url).split(",")[1];
        if (!b64) return;
        var safeStation = String(item.station || "Station").replace(/[^\w\-]+/g, "_");
        var safeTitle = String(item.title || name || "Photo").replace(/[^\w\-]+/g, "_");
        picFolder.file(safeStation + "__" + safeTitle + ".jpg", b64, { base64: true });
      }
      (photoStore.ts || []).forEach(function (p, i) { addPic(p, "TS_" + (i + 1)); });
      if (photoStore.enez) addPic(photoStore.enez, "ENZ");
      ["N","E","S","W"].forEach(function (k) {
        if (dirPhotos[k] && dirPhotos[k].url) addPic(dirPhotos[k], "DIR_" + k);
      });
      if (photoStore.llh) addPic(photoStore.llh, "LLH");
      (photoStore.custom || []).forEach(function (p, i) { addPic(p, "IMG_" + (i + 1)); });

      var blob = await zip.generateAsync({ type: "blob" });
      downloadBlob(blob, reportNo + "_PACK.zip");
      toastSafe("Full package exported: " + reportNo, "ok");
      scheduleSave();
    } catch (e) {
      console.error(e);
      toastSafe("Package export failed", "err");
    }
  }

  // ---------------- PDF helpers: logo + report no + photos with station names ----------------
  function wrapPdfExports() {
    if (typeof window.savePDF === "function" && !window.savePDF.__qcWrapped) {
      var origSave = window.savePDF;
      window.savePDF = async function (doc, fileName) {
        try {
          try {
            var s = getSettings();
            var reportNo = doc.__qcReportNo || nextReportNumber(true);
            doc.__qcReportNo = reportNo;
            window.__lastReportNo = reportNo;
            var pages = doc.internal.getNumberOfPages();
            doc.setPage(1);
            if (s.companyLogo) {
              try { doc.addImage(s.companyLogo, "JPEG", 12, 4, 16, 16); } catch (e1) {
                try { doc.addImage(s.companyLogo, "PNG", 12, 4, 16, 16); } catch (e2) {}
              }
            }
            doc.setFontSize(8);
            doc.setTextColor(255,255,255);
            // if header is blue top band, write report no top-right
            doc.setFont("helvetica", "bold");
            doc.text(String(s.companyName || "QC Survey"), 32, 10);
            doc.text(String(reportNo), (typeof window.A4_W !== "undefined" ? window.A4_W : 210) - 14, 10, { align: "right" });

            // photos pages
            await appendPhotosPages(doc);
            if (typeof window.addFooter === "function") window.addFooter(doc);
            // prefer report number in filename
            if (!fileName || fileName === "export") fileName = reportNo;
            else fileName = String(fileName);
          } catch (e) {
            console.warn("pdf enhance failed", e);
          }
        } catch (e0) {}
        return await origSave.call(this, doc, fileName || window.__lastReportNo || "QC_Report");
      };
      window.savePDF.__qcWrapped = true;
    }
  }

  async function appendPhotosPages(doc) {
    var s = getSettings();
    if (s.attachPhotos === false) return;
    var photos = [];
    (photoStore.ts || []).forEach(function (p) { photos.push(p); });
    if (photoStore.enez) photos.push(photoStore.enez);
    if (photoStore.llh) photos.push(photoStore.llh);
    (photoStore.custom || []).forEach(function (p) { photos.push(p); });
    if (!photos.length) return;

    // group by station
    var groups = {};
    photos.forEach(function (p) {
      var st = p.station || "Station";
      if (!groups[st]) groups[st] = [];
      groups[st].push(p);
    });

    Object.keys(groups).forEach(function (station) {
      doc.addPage();
      var y = 18;
      // section header
      doc.setFillColor(29, 78, 216);
      doc.rect(0, 0, (window.A4_W || 210), 16, "F");
      doc.setTextColor(255,255,255);
      doc.setFont("helvetica", "bold");
      doc.setFontSize(12);
      doc.text("Station Photos — " + String(station), 14, 10.5);
      doc.setTextColor(30);
      y = 24;
      groups[station].forEach(function (p, idx) {
        if (y > 230) {
          doc.addPage();
          y = 18;
          doc.setFont("helvetica", "bold");
          doc.setFontSize(11);
          doc.text("Station Photos — " + String(station) + " (cont.)", 14, y);
          y += 8;
        }
        var title = (p.title || ("Photo " + (idx + 1)));
        doc.setFont("helvetica", "bold");
        doc.setFontSize(10);
        doc.text(String(title), 14, y);
        y += 4;
        doc.setFont("helvetica", "normal");
        doc.setFontSize(8);
        doc.setTextColor(100);
        doc.text("Station: " + String(station) + "   |   " + (p.at ? new Date(p.at).toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : ""), 14, y);
        doc.setTextColor(30);
        y += 3;
        try {
          doc.addImage(p.url, "JPEG", 14, y, 120, 70);
        } catch (e) {
          try { doc.addImage(p.url, "PNG", 14, y, 120, 70); } catch (e2) {}
        }
        y += 78;
      });
    });
  }

  // ---------------- parsers wrap ----------------
  function wrapParsers() {
    if (typeof window.parseSurveyText === "function" && !window.parseSurveyText.__wrapped) {
      var p1 = window.parseSurveyText;
      window.parseSurveyText = function (text) { return p1(enhanceTextForTemplate(text)); };
      window.parseSurveyText.__wrapped = true;
    }
    if (typeof window.parseGeoCoordinateText === "function" && !window.parseGeoCoordinateText.__wrapped) {
      var p2 = window.parseGeoCoordinateText;
      window.parseGeoCoordinateText = function (text) { return p2(enhanceTextForTemplate(text)); };
      window.parseGeoCoordinateText.__wrapped = true;
    }
  }

  function wrapOpenOcrModal() {
    if (typeof window.openOcrModal !== "function" || window.openOcrModal.__qcWrapped) return;
    var orig = window.openOcrModal;
    window.openOcrModal = function (parsed, previewUrl, rawText) {
      try {
        var kind = "ts";
        if (window.ocrTarget && window.ocrTarget.type === "coord") {
          kind = (window.ocrTarget.field === "llh") ? "llh" : "enez";
        }
        // dual confirm
        var dual = maybeDualConfirm(kind, parsed || {});
        var badge = $("dual-badge");
        if (dual.needSecond) {
          if (badge) { badge.textContent = "Dual: take 2nd photo"; badge.classList.add("show"); }
          toastSafe(dual.note, "load");
        } else {
          if (badge) {
            badge.textContent = (dual.conflicts && dual.conflicts.length) ? "Dual conflict" : "Dual OK";
            badge.classList.add("show");
            setTimeout(function () { badge.classList.remove("show"); }, 2500);
          }
          if (dual.note) toastSafe(dual.note, dual.conflicts && dual.conflicts.length ? "err" : "ok");
          parsed = dual.parsed || parsed;
        }
        // ask to save photo with station naming
        if (previewUrl) {
          openPhotoSavePrompt(previewUrl, kind, {
            station: currentStationName(),
            title: ocrCaptureTitle(kind),
            field: window.ocrTarget && window.ocrTarget.field
          });
        }
      } catch (e) { console.warn(e); }
      try { if (window.__qcOcrConfAsync) window.__qcOcrConfAsync(previewUrl, parsed || {}); } catch (eC) {}
      return orig.call(this, parsed, previewUrl, rawText);
    };
    window.openOcrModal.__qcWrapped = true;
  }  function wrapRenderSetups() {
    if (typeof window.renderSetups !== "function" || window.renderSetups.__wrapped) return;
    var orig = window.renderSetups;
    window.renderSetups = function () {
      var r = orig.apply(this, arguments);
      setTimeout(function () { applyQcToleranceStyles(); drawENMap(); }, 0);
      return r;
    };
    window.renderSetups.__wrapped = true;
  }

  // ---------------- history UI ----------------
  function renderHistory() {
    var host = $("history-list");
    if (!host) return;
    var list = loadHistory();
    if (!list.length) {
      host.innerHTML = '<div class="empty-hint"><span class="empty-title">\uD83D\uDDC2\uFE0F History is empty</span>Cleared forms are safely kept here until you press Reset Saved.<br>\u0627\u0644\u0646\u0645\u0627\u0630\u062C \u0627\u0644\u0645\u0633\u0648\u062D\u0629 \u062A\u062D\u0641\u0638 \u0647\u0646\u0627 \u0628\u0639\u062F \u0645\u0633\u062D \u0627\u0644\u062D\u0642\u0648\u0644</div>';
      return;
    }
    host.innerHTML = list.map(function (h, idx) {
      var when = h.snapshotAt ? new Date(h.snapshotAt).toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : "";
      var st = (h.sc && (h.sc.point || h.sc.project)) || (h.ts && h.ts.project) || "Entry";
      return '<div class="hist-item">' +
        '<div><strong>' + esc(st) + '</strong><div class="map-legend">' + esc(when) + ' · ' + esc(h.reason || "") + '</div></div>' +
        '<button type="button" class="tool-btn hist-restore" data-idx="' + idx + '">Restore</button>' +
      '</div>';
    }).join("");
    qsa(".hist-restore").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var idx = +btn.getAttribute("data-idx");
        var list = loadHistory();
        var item = list[idx];
        if (!item) return;
        // FIX: keep the live photo store intact when restoring an old entry
        // (snapshots no longer carry photos, so re-attach current ones)
        item.photos = {
          ts: (photoStore.ts || []).slice(0, 12),
          enez: photoStore.enez || null,
          llh: photoStore.llh || null,
          custom: (photoStore.custom || []).slice(0, 20)
        };
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(item)); } catch (e) {}
        restoreDraft();
        toastSafe("Entry restored", "ok");
      });
    });
  }

  // ---------------- UI inject ----------------
  function ensureUI() {
    insertSessionTimerCard();
    var navInner = document.querySelector(".nav-inner");
    if (navInner && !$("top-tools")) {
      var tools = document.createElement("div");
      tools.id = "top-tools";
      tools.className = "top-tools";
      tools.innerHTML =
        '<span id="save-pill" class="save-pill">Autosave on</span>' +
        '<span id="dual-badge" class="dual-badge">Dual</span>' +
        '<span id="report-number-view" class="save-pill">Next: QC</span>' +
        '<select id="device-template" class="tool-select" title="Device template">' +
          '<option value="generic">Template: Generic</option>' +
          '<option value="leica">Template: Leica</option>' +
          '<option value="trimble">Template: Trimble</option>' +
          '<option value="topcon">Template: Topcon/Sokkia</option>' +
        "</select>" +
        '<button type="button" class="tool-btn qc-top-action" id="btn-theme-toggle"><span class="tool-icon" aria-hidden="true">🌙</span><span class="tool-label">Night</span></button>' +
        '<button type="button" class="tool-btn qc-top-action" id="btn-settings-hub" title="Settings — themes, fonts, PDF export" aria-label="Settings"><span class="tool-icon" aria-hidden="true">⚙️</span><span class="tool-label">Settings</span></button>' +
        '<button type="button" class="tool-btn" id="btn-reset-saved">Reset Saved</button>';
      navInner.appendChild(tools);
    }

    function barHtml() {
      /* photo options now live on the Static page (photos card) — tolerances removed per user request */
      return '<span class="device-template-hint tol-note" style="margin:0"></span>';
    }
    function injectFeatureBar(viewId, withTol) {
      var view = $(viewId);
      if (!view || view.querySelector(".feature-bar")) return;
      var head = view.querySelector(".page-head");
      var bar = document.createElement("div");
      bar.className = "feature-bar";
      bar.innerHTML = barHtml();
      if (head && head.parentNode) head.insertAdjacentElement("afterend", bar);
      else view.insertAdjacentElement("afterbegin", bar);
    }
    injectFeatureBar("view-ts", true);
    injectFeatureBar("view-ls", false);
    injectFeatureBar("view-sc", true);

    /* Company card removed (user request) — company name/logo handled via Settings later if needed */

    // Static clear inputs button in export bar
    var scBar = $("sc-export-bar");
    if (scBar) {
      var actions = scBar.querySelector(".export-actions") || scBar;
      if (!$("btn-sc-clear-inputs")) {
        var b1 = document.createElement("button");
        b1.type = "button";
        b1.className = "btn btn-secondary";
        b1.id = "btn-sc-clear-inputs";
        b1.textContent = "Clear Inputs";
        actions.insertBefore(b1, actions.firstChild);
      }
          }

    // Map + photos + history cards
    function ensureSideCard(viewId, id, title, bodyHtml) {
      var view = $(viewId);
      if (!view || $(id)) return;
      var card = document.createElement("section");
      card.className = "card";
      card.id = id;
      card.innerHTML = '<div class="card-hd"><h2>' + title + '</h2></div><div class="card-bd">' + bodyHtml + '</div>';
      var exportBar = view.querySelector(".export-bar");
      var stack = view.querySelector(".stack") || view;
      if (exportBar) exportBar.parentNode.insertBefore(card, exportBar);
      else stack.appendChild(card);
    }
    ensureSideCard("view-ts", "map-card-ts", "Points Map (E/N)",
      '<canvas id="en-map" width="640" height="260" aria-label="Easting Northing map"></canvas>' +
      '<div class="map-legend" id="en-map-legend">Points: 0</div>' +
      '<div style="margin-top:12px;font-size:12px;font-weight:800;color:var(--text-2)">Saved Station Photos</div>' +
      '<div id="photo-thumbs" class="photo-thumbs" style="margin-top:6px"></div>');
    ensureSideCard("view-sc", "map-card-sc", "Points Map & Photos",
      '<canvas id="en-map-sc" width="640" height="260" aria-label="Easting Northing map"></canvas>' +
      '<div class="map-legend" id="en-map-legend-sc">Points: 0</div>' +
      '<div style="margin-top:12px;font-size:12px;font-weight:800;color:var(--text-2)">Saved Station Photos</div>' +
      '<div class="photo-thumbs" style="margin-top:6px"></div>' +
      '<div style="margin-top:14px;font-size:12px;font-weight:800;color:var(--text-2)">Retained Entries (until Reset Saved)</div>' +
      '<div id="history-list" style="margin-top:6px"></div>' +
      '<div id="backup-restore-row" style="display:flex;gap:8px;margin-top:10px;flex-wrap:wrap">' +
        '<button type="button" id="btn-share-project" class="tool-btn" style="min-height:40px;padding:10px 14px;background:#0f766e;color:#fff" title="Share the full current project state so another person can open it in the same app">📤 Share Full Project</button>' +
        '<button type="button" id="btn-open-shared-project" class="tool-btn" style="min-height:40px;padding:10px 14px;background:#4338ca;color:#fff" title="Open a shared QC Survey project JSON file">📥 Open Shared Project</button>' +
        '<button type="button" id="btn-backup-json" class="tool-btn" style="min-height:40px;padding:10px 14px" title="Download all drafts, history, settings and photos as one JSON file">⬇ Backup All Data (JSON)</button>' +
        '<button type="button" id="btn-import-json" class="tool-btn" style="min-height:40px;padding:10px 14px" title="Restore a JSON backup (from Backup button or data.json inside a Full Pack ZIP)">⬆ Import Backup</button>' +
        '<input type="file" id="import-json-file" accept="application/json,.json" class="hidden" />' +
      '</div>');

    // FIX: data portability — exports existed, but there was no way to bring data back in
    (function wireBackupRestore() {
      var bj = $("btn-backup-json");
      var ij = $("btn-import-json");
      var sp = $("btn-share-project");
      var op = $("btn-open-shared-project");
      var ifile = $("import-json-file");
      if (!bj || !ij || !ifile || bj.__qcWired) return;
      bj.__qcWired = true;

      function buildProjectPayload() {
        return {
          app: "qc-survey",
          kind: "shared-project-state",
          backupVersion: 2,
          version: window.__QC_VERSION || "",
          exportedAt: new Date().toISOString(),
          draft: collectDraft(),
          history: loadHistory(),
          settings: getSettings()
        };
      }
      function projectFileName(prefix) {
        var d = collectDraft();
        var name = (d.ts && d.ts.project) || (d.ls && d.ls.project) || (d.sc && d.sc.project) || (d.gn && d.gn.base && d.gn.base.projectName) || "QC-Survey";
        name = String(name || "QC-Survey").replace(/[\\/:*?"<>|]+/g, "_").replace(/\s+/g, "_").slice(0, 60);
        return (prefix || "QC_Survey_Project") + "_" + name + "_" + new Date().toISOString().slice(0, 10) + ".json";
      }
      function payloadBlob(payload) {
        return new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
      }
      function saveProjectJson(prefix, okMsg) {
        try {
          var payload = buildProjectPayload();
          downloadBlob(payloadBlob(payload), projectFileName(prefix));
          toastSafe(okMsg || "Project file downloaded.", "ok");
        } catch (e) {
          console.warn(e);
          toastSafe("Project export failed", "err");
        }
      }

      bj.addEventListener("click", function () { saveProjectJson("QC_Survey_Backup", "Backup downloaded — keep it safe (photos included)."); });
      if (sp) sp.addEventListener("click", async function () {
        try {
          var payload = buildProjectPayload();
          var fileName = projectFileName("QC_Survey_Shared_Project");
          var file = new File([payloadBlob(payload)], fileName, { type: "application/json" });
          if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
            await navigator.share({ title: "QC Survey Project", text: "QC Survey shared project state", files: [file] });
            toastSafe("Project shared.", "ok");
          } else {
            downloadBlob(file, fileName);
            toastSafe("Sharing is not supported here — project file downloaded instead.", "ok");
          }
        } catch (e) {
          if (e && String(e.name || e.message).match(/Abort/i)) return;
          console.warn(e);
          saveProjectJson("QC_Survey_Shared_Project", "Project file downloaded instead.");
        }
      });
      ij.addEventListener("click", function () { ifile.value = ""; ifile.click(); });
      if (op) op.addEventListener("click", function () { ifile.value = ""; ifile.click(); });
      ifile.addEventListener("change", function () {
        var f = ifile.files && ifile.files[0];
        if (!f) return;
        var fr = new FileReader();
        fr.onload = function () {
          try {
            var data = JSON.parse(fr.result);
            var incoming = data.draft || data; // accept wrapped backup OR raw data.json from Full Pack
            var current = collectDraft(), stats = { added: 0, protected: 0 };
            function blank(v) { return v == null || v === "" || (Array.isArray(v) && !v.length); }
            function safeMerge(cur, inc) {
              if (Array.isArray(inc)) {
                if (blank(cur) && inc.length) { stats.added++; return inc; }
                if (inc.length && JSON.stringify(cur) !== JSON.stringify(inc)) stats.protected++;
                return cur;
              }
              if (inc && typeof inc === "object") {
                var out = cur && typeof cur === "object" && !Array.isArray(cur) ? cur : {};
                Object.keys(inc).forEach(function (k) { out[k] = safeMerge(out[k], inc[k]); });
                return out;
              }
              if (blank(cur) && !blank(inc)) { stats.added++; return inc; }
              if (!blank(inc) && String(cur) !== String(inc)) stats.protected++;
              return cur;
            }
            var merged = safeMerge(current, incoming);
            if (!confirm("Safe restore preview:\n\nNew non-conflicting values to add: " + stats.added + "\nExisting values protected: " + stats.protected + "\n\nContinue with safe restore?")) return;
            if (data.history && data.history.length) {
              var oldHistory = loadHistory(), seen = {};
              oldHistory.forEach(function(x){seen[JSON.stringify(x)]=1});
              data.history.forEach(function(x){var k=JSON.stringify(x);if(!seen[k]){oldHistory.push(x);seen[k]=1}});
              saveHistory(oldHistory);
            }
            try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch (e2) {}
            restoreDraft();
            drawENMap();
            applyQcToleranceStyles();
            renderHistory();
            toastSafe("Safe restore completed — existing values were preserved.", "ok");
          } catch (err) {
            console.error(err);
            toastSafe("Invalid backup file.", "err");
          }
        };
        fr.onerror = function () { toastSafe("Could not read file.", "err"); };
        fr.readAsText(f);
      });
    })();

    // unify map drawing to first canvas id if secondary exists
    // Photo save modal
    if (!$("photo-save-modal")) {
      var modal = document.createElement("div");
      modal.id = "photo-save-modal";
      modal.className = "modal-backdrop hidden";
      modal.setAttribute("aria-hidden", "true");
      modal.innerHTML =
        '<div class="modal" role="dialog" aria-modal="true" style="max-width:460px">' +
          '<h3>Save Station Photo?</h3>' +
          '<p style="font-size:13px;color:var(--text-2);margin:-4px 0 12px">Save this photo into the report package/PDF under the station name.</p>' +
          '<div class="form-grid cols-2" style="grid-template-columns:1fr;gap:10px">' +
            '<div><label class="field-label" for="photo-station-name">Station / Setup Name</label><input class="input" id="photo-station-name" /></div>' +
            '<div><label class="field-label" for="photo-setup-title">Photo Title</label><input class="input" id="photo-setup-title" /></div>' +
          '</div>' +
          '<div class="modal-actions" style="margin-top:14px">' +
            '<button type="button" class="btn btn-secondary" id="photo-save-no">Don\'t Save</button>' +
            '<button type="button" class="btn btn-primary" id="photo-save-yes">Save Photo</button>' +
          '</div>' +
        '</div>';
      document.body.appendChild(modal);
    }
  }

  function wireUI() {
    ensureUI();
    applySettingsToUI(getSettings());

    // theme
    var themeBtn = $("btn-theme-toggle");
    if (themeBtn && !themeBtn.dataset.wired) {
      themeBtn.dataset.wired = "1";
      themeBtn.addEventListener("click", function () {
        var s = getSettings();
        s.theme = s.theme === "dark" ? "light" : "dark";
        saveSettings(s); applyTheme(s.theme); drawENMap(); scheduleSave();
      });
    }
    var dev = $("device-template");
    if (dev && !dev.dataset.wired) {
      dev.dataset.wired = "1";
      dev.addEventListener("change", function () {
        var s = getSettings();
        s.deviceTemplate = dev.value || "generic";
        saveSettings(s); applyDeviceTemplate(s.deviceTemplate); scheduleSave();
      });
    }

    // feature checks
    qsa(".feat-dual").forEach(function (el) {
      if (el.dataset.wired) return; el.dataset.wired = "1";
      el.addEventListener("change", function () {
        var s = getSettings(); s.dualMode = !!el.checked; saveSettings(s);
        qsa(".feat-dual").forEach(function (x) { x.checked = el.checked; });
        scheduleSave();
      });
    });
    qsa(".feat-attach").forEach(function (el) {
      if (el.dataset.wired) return; el.dataset.wired = "1";
      el.addEventListener("change", function () {
        var s = getSettings(); s.attachPhotos = !!el.checked; saveSettings(s);
        qsa(".feat-attach").forEach(function (x) { x.checked = el.checked; });
        scheduleSave();
      });
    });
    qsa(".feat-ask-photo").forEach(function (el) {
      if (el.dataset.wired) return; el.dataset.wired = "1";
      el.addEventListener("change", function () {
        var s = getSettings(); s.askSavePhoto = !!el.checked; saveSettings(s);
        qsa(".feat-ask-photo").forEach(function (x) { x.checked = el.checked; });
        scheduleSave();
      });
    });
    qsa(".feat-tol").forEach(function (el) {
      if (el.dataset.wired) return; el.dataset.wired = "1";
      el.addEventListener("input", function () {
        var s = getSettings();
        var e = document.querySelector('.feat-tol[data-tol="e"]');
        var n = document.querySelector('.feat-tol[data-tol="n"]');
        var z = document.querySelector('.feat-tol[data-tol="z"]');
        s.tolE = Math.abs(parseFloat(e && e.value) || 0.02);
        s.tolN = Math.abs(parseFloat(n && n.value) || 0.02);
        s.tolZ = Math.abs(parseFloat(z && z.value) || 0.03);
        saveSettings(s); applyQcToleranceStyles(); scheduleSave();
      });
    });

    // company template
    var cn = $("company-name");
    if (cn && !cn.dataset.wired) {
      cn.dataset.wired = "1";
      cn.addEventListener("input", function () {
        var s = getSettings(); s.companyName = cn.value || ""; saveSettings(s); scheduleSave();
      });
    }
    var rp = $("report-prefix");
    if (rp && !rp.dataset.wired) {
      rp.dataset.wired = "1";
      rp.addEventListener("input", function () {
        var s = getSettings(); s.reportPrefix = (rp.value || "QC").replace(/[^\w\-]/g, "").slice(0, 12) || "QC"; saveSettings(s); applySettingsToUI(getSettings()); scheduleSave();
      });
    }
    var lf = $("company-logo-file");
    if (lf && !lf.dataset.wired) {
      lf.dataset.wired = "1";
      lf.addEventListener("change", function () {
        var f = lf.files && lf.files[0];
        if (!f) return;
        var reader = new FileReader();
        reader.onload = function () {
          var s = getSettings();
          s.companyLogo = String(reader.result || "");
          // compress via canvas
          try {
            var img = new Image();
            img.onload = function () {
              var c = document.createElement("canvas");
              var max = 240; var sc = Math.min(1, max / Math.max(img.width, img.height));
              c.width = Math.max(1, Math.round(img.width * sc));
              c.height = Math.max(1, Math.round(img.height * sc));
              c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
              s.companyLogo = c.toDataURL("image/jpeg", 0.85);
              saveSettings(s); applySettingsToUI(getSettings()); scheduleSave();
              toastSafe("Company logo saved", "ok");
            };
            img.src = s.companyLogo;
          } catch (e) {
            saveSettings(s); applySettingsToUI(getSettings()); scheduleSave();
          }
        };
        reader.readAsDataURL(f);
      });
    }

    // buttons
    var btnX = $("btn-export-excel"); if (btnX && !btnX.dataset.wired) { btnX.dataset.wired = "1"; btnX.addEventListener("click", exportExcel); }
    var btnC = $("btn-export-csv"); if (btnC && !btnC.dataset.wired) { btnC.dataset.wired = "1"; btnC.addEventListener("click", exportCSV); }
    var btnP = $("btn-export-pack"); if (btnP && !btnP.dataset.wired) { btnP.dataset.wired = "1"; btnP.addEventListener("click", exportFullPack); }
        var btnA3 = $("btn-export-all-3"); if (btnA3 && !btnA3.dataset.wired) { btnA3.dataset.wired = "1"; btnA3.addEventListener("click", exportAllThreeReports); }
    var btnHub = $("btn-settings-hub"); if (btnHub && !btnHub.dataset.wired) { btnHub.dataset.wired = "1"; btnHub.addEventListener("click", openSettingsHub); }
    var btnR = $("btn-reset-saved"); if (btnR && !btnR.dataset.wired) { btnR.dataset.wired = "1"; btnR.addEventListener("click", resetAllSaved); }
    var btnClear = $("btn-sc-clear-inputs"); if (btnClear && !btnClear.dataset.wired) { btnClear.dataset.wired = "1"; btnClear.addEventListener("click", clearStaticInputsOnly); }
    var btnScExcel = $("btn-sc-excel"); if (btnScExcel && !btnScExcel.dataset.wired) { btnScExcel.dataset.wired = "1"; btnScExcel.addEventListener("click", exportExcel); }

    // photo save modal buttons
    var psY = $("photo-save-yes");
    var psN = $("photo-save-no");
    if (psY && !psY.dataset.wired) {
      psY.dataset.wired = "1";
      psY.addEventListener("click", function () {
        if (!pendingPhotoDecision) return closePhotoSavePrompt();
        var station = val("photo-station-name") || currentStationName();
        var title = val("photo-setup-title") || defaultPhotoTitle(pendingPhotoDecision.kind);
        rememberPhoto(pendingPhotoDecision.kind, pendingPhotoDecision.dataUrl, {
          station: station,
          title: title,
          field: pendingPhotoDecision.meta && pendingPhotoDecision.meta.field
        });
        closePhotoSavePrompt();
        var res = pendingPhotoDecision.resolve; pendingPhotoDecision = null;
        toastSafe("Photo saved under: " + station, "ok");
        if (res) res(true);
      });
    }
    if (psN && !psN.dataset.wired) {
      psN.dataset.wired = "1";
      psN.addEventListener("click", function () {
        closePhotoSavePrompt();
        var res = pendingPhotoDecision && pendingPhotoDecision.resolve;
        pendingPhotoDecision = null;
        if (res) res(false);
      });
    }

    // autosave listeners
    document.addEventListener("input", function (e) {
      journalField(e.target);
      scheduleSave();
      var id = e.target && e.target.id;
      if (id === "sc-easting" || id === "sc-northing" || (e.target && e.target.closest && e.target.closest("#view-ts"))) {
        drawENMap();
        /* v175.1: نؤجّل التلوين حتى ينتهي معالج الحقل من تحديث خلايا الفروق */
        setTimeout(function () { applyQcToleranceStyles(); }, 0);
      }
    }, true);
    document.addEventListener("change", function (e) {
      journalField(e.target);
      scheduleSave(); drawENMap(); applyQcToleranceStyles();
    }, true);
    function emergencyCheckpoint() { try { if (sessionStorage.getItem("qcSkipExitSave") === "1") return; saveDraftNow(); } catch (e) {} }
    window.addEventListener("beforeunload", emergencyCheckpoint);
    window.addEventListener("pagehide", emergencyCheckpoint);
    window.addEventListener("freeze", emergencyCheckpoint);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") emergencyCheckpoint();
    });
    window.addEventListener("resize", function () { drawENMap(); });
  }


  // ---------------- PDF field-export options ----------------
  var PDF_OPTS = [
    { key: "tsSummary",   label: "Total Station \u2014 Survey Summary" },
    { key: "tsMap",       label: "Total Station \u2014 Points Map (E/N)" },
    { key: "lsSummary",   label: "Laser Scanner \u2014 Scan Summary" },
    { key: "scDiagram",   label: "Static \u2014 Height Diagram" },
    { key: "scChecklist", label: "Static \u2014 Checklist table" },
    { key: "scNotes",     label: "Static \u2014 Notes" }
  ];
  function getPdfOpts() {
    var s = getSettings();
    var o = Object.assign({}, s.pdfOpts || {});
    /* v235: screen-capture mirror pages are permanently disabled. Browser canvas
       rendering placed labels under fields on some phones. Every exporter now
       uses the structured, searchable report layout with collision-safe spacing. */
    o.mirror = false;
    if (!s.pdfV228CleanLayout || !s.pdfOpts || s.pdfOpts.mirror !== false) {
      s.pdfOpts = o;
      s.pdfV228CleanLayout = true;
      saveSettings(s);
    }
    return o;
  }
  function applyPdfOptsGlobal() { window.__qcPdfOpts = getPdfOpts(); }

  function ensurePdfOptionsModal() {
    if ($("pdf-options-modal")) return;
    var m = document.createElement("div");
    m.id = "pdf-options-modal";
    m.className = "modal-backdrop hidden";
    m.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" style="max-width:480px">' +
        '<h3 style="font-size:16px;font-weight:800">\u2699\uFE0F PDF Export Options</h3>' +
        '<p style="font-size:12.5px;color:var(--text-2);margin:4px 0 12px">Choose which sections appear in the exported PDF reports. Applies to every Export PDF.</p>' +
        '<div style="display:flex;flex-direction:column;gap:8px;max-height:46vh;overflow:auto;padding:2px">' +
          PDF_OPTS.map(function (o) {
            return '<label class="chk" style="display:flex;align-items:flex-start;gap:8px;font-size:13px"><input type="checkbox" class="pdf-opt-chk" data-key="' + o.key + '" checked /><span>' + o.label + '</span></label>';
          }).join("") +
        "</div>" +
        '<div class="modal-actions" style="margin-top:14px">' +
          '<button type="button" class="btn btn-secondary" id="pdf-opts-cancel">Cancel</button>' +
          '<button type="button" class="btn btn-primary" id="pdf-opts-save">Save Options</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(m);
    $("pdf-opts-cancel").addEventListener("click", function () { m.classList.add("hidden"); });
    m.addEventListener("click", function (e) { if (e.target === m) m.classList.add("hidden"); });
    $("pdf-opts-save").addEventListener("click", function () {
      var opts = {};
      qsa(".pdf-opt-chk").forEach(function (c) { opts[c.getAttribute("data-key")] = c.checked; });
      var s = getSettings();
      s.pdfOpts = opts;
      saveSettings(s);
      applyPdfOptsGlobal();
      m.classList.add("hidden");
      toastSafe("PDF options saved \u2014 will apply to next export.", "ok");
    });
  }

  // ---------------- Export ALL 3 reports in one ZIP ----------------
  async function exportAllThreeReports() {
    if (typeof JSZip === "undefined") { toastSafe("Zip library missing.", "err"); return; }
    if (!(typeof window.exportTsPdf === "function" && typeof window.exportLsPdf === "function" && typeof window.exportScPdf === "function")) {
      toastSafe("Export functions not ready yet.", "err"); return;
    }
    toastSafe("Building 3 reports\u2026", "load");
    window.__qcCaptureMode = true;
    window.__qcCapturedDocs = {};
    try {
      await window.exportTsPdf("TotalStation");
      await window.exportLsPdf("LaserScanner");
      await window.exportScPdf("Static_Checklist");
    } finally {
      window.__qcCaptureMode = false;
    }
    var names = Object.keys(window.__qcCapturedDocs || {});
    if (!names.length) { toastSafe("No reports were produced.", "err"); return; }
    try {
      var zip = new JSZip();
      names.forEach(function (n) {
        var doc = window.__qcCapturedDocs[n];
        zip.file(safeName(n) + ".pdf", doc.output("arraybuffer"), { binary: true });
      });
      var blob = await zip.generateAsync({ type: "blob" });
      var stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, "QC_All_Reports_" + stamp + ".zip");
      toastSafe("3 PDF reports exported in one ZIP \u2705", "ok");
    } catch (e) {
      console.error(e);
      toastSafe("ZIP build failed", "err");
    }
  }
  /* export selected pages as PDFs in one ZIP */
  async function exportSelectedReports(pages) {
    if (typeof JSZip === "undefined") { toastSafe("Zip library missing.", "err"); return; }
    var fns = { ts: "exportTsPdf", ls: "exportLsPdf", sc: "exportScPdf" };
    var names = { ts: "TotalStation", ls: "LaserScanner", sc: "Static_Checklist" };
    var chosen = (pages || []).filter(function (p) { return fns[p] && typeof window[fns[p]] === "function"; });
    if (!chosen.length) { toastSafe("Select at least one page.", "err"); return; }
    toastSafe("Building " + chosen.length + " report(s)\u2026", "load");
    window.__qcCaptureMode = true;
    window.__qcCapturedDocs = {};
    try {
      for (var i = 0; i < chosen.length; i++) {
        await window[fns[chosen[i]]](names[chosen[i]]);
      }
    } finally {
      window.__qcCaptureMode = false;
    }
    var produced = Object.keys(window.__qcCapturedDocs || {});
    if (!produced.length) { toastSafe("No reports produced.", "err"); return; }
    try {
      var zip = new JSZip();
      produced.forEach(function (n) {
        var doc = window.__qcCapturedDocs[n];
        zip.file(safeName(n) + ".pdf", doc.output("arraybuffer"), { binary: true });
      });
      var blob = await zip.generateAsync({ type: "blob" });
      var stamp = new Date().toISOString().slice(0, 10);
      downloadBlob(blob, "QC_Reports_" + stamp + ".zip");
      toastSafe(produced.length + " PDF report(s) exported in one ZIP \u2705", "ok");
    } catch (e) {
      console.error(e);
      toastSafe("ZIP build failed", "err");
    }
  }

  function safeName(n) { return String(n || "Report").replace(/[\\/:*?"<>|]+/g, "-").trim() || "Report"; }

  // ---------------- In-app specifications document (all pages) ----------------
  function buildSpecsDoc() {
    var ar=false; try{ar=(window.QCI18N?QCI18N.getLanguage():localStorage.getItem('qc-language'))==='ar'}catch(e){}
    var T=ar?{
      title:'تعليمات تطبيق QC Survey',sub:'الدليل التشغيلي الحالي — الإصدار v258',start:'البدء الآمن',startp:'اختر صفحة العمل، أدخل بيانات المشروع، ثم أضف القياسات والصور. يحفظ التطبيق محلياً بصورة تلقائية؛ احتفظ أيضاً بنسخة Backup قبل مسح البيانات أو تغيير الجهاز.',pages:'الصفحات',p1:'Total Station: المحطات والنقاط وQC Fixed والفروقات.',p2:'Laser Scanner: الأقسام والبلوكات والمناطق وأرقام المسح.',p3:'Static: بيانات الجلسة، الارتفاعات، الإحداثيات، القائمة، GPS وصور الاتجاه.',p4:'GNSS: Base وQC Fixed 1 وQC Fixed 2 المستقل مع IDs. يظهر Start يساراً وEnd يميناً، ولكل مسّاح لون، وتحسب الفروق Start/End − QC Fixed.',p5:'DC Flange / Pipe: بيانات الفلنجات والأنابيب، الأبعاد، العرض التفاعلي ثلاثي الأبعاد، البوصلة والرسم المباشر.',p6:'GPR Logging Sheet: سجل خطوط القياس والملفات والاتجاهات والملاحظات مع حفظ محلي وتصدير Excel وPDF.',p7:'Backfilling: تسجيل أبعاد الحفر، الحجم التلقائي، حالة التصوير والإنجاز، وأسماء الفريق وتواقيعهم.',p8:'Converters: تحويل مفرد وملفات، UTM Zone/Hemisphere، Local ضمن From/To، وحساب Baseline/Scale Factor.',comp:'البوصلة الذكية وصور الاتجاه',compp:'اختر N أو E أو S أو W. أمسك الهاتف أفقياً وحرّكه بهدوء. المرشد يرفض القفزات المغناطيسية، ينعّم القراءة دائرياً، ويطلب الثبات قبل تفعيل الالتقاط. لا تُطبع أرقام درجات على الصورة. عند التحذير حرّك الهاتف بشكل 8 للمعايرة.',base:'رسم جهاز Base',basep:'يظهر مخطط الهوائي والثلاثي وHeight Reading وHeight Hook وTrue Height في واجهة Static، ويُعاد رسمه بنفس المكونات في PDF لكل من Static وGNSS Base.',factor:'Baseline وScale Factor',factorp:'اختر Decimal Degrees أو DMS المنفصل. اختر تعريف العامل Grid/Ground أو Ground/Grid. القاعدة: Grid = Ground × canonical factor، وΔE = Grid × sin(Azimuth)، وΔN = Grid × cos(Azimuth). استخدم Expected Ending E/N لفحص الخطأ.',export:'التصدير',exportp:'قسم Export موجود دائماً في نهاية كل صفحة تشغيلية. راجع البيانات والفروقات والصور أولاً، ثم صدّر PDF أو Excel أو CSV أو Full Pack. PDF يعرض فروقات QC ومخطط Base. افحص الملف قبل التسليم.',lang:'اللغة',langp:'عند اختيار English تختفي الكلمات العربية من الواجهة. عند اختيار العربية تتحول الواجهة إلى RTL، لكن قيم المدخلات والتاريخ والوقت تبقى English/Latin واضحة. يتذكر التطبيق الاختيار بعد Refresh.',data:'الحماية والاسترجاع',datap:'الحفظ التلقائي لا يغني عن Backup. استخدم Backup All Data قبل Reset Saved. لا تُدخل بيانات حساسة في QR عام. استخدم QR المحلي أو ملف qcshare المشفر فقط.',order:'مسار العمل المقترح',steps:['اختر اللغة والصفحة.','أدخل المشروع والمساح والجهاز والإحداثيات.','أضف الصور وراجع اتجاهها والتوقيع.','شغّل Validate/Smart QC وراجع الفروقات.','تحقق من Zone/Hemisphere والعوامل قبل التحويل.','راجع Preview ثم استخدم Export الموجود في نهاية الصفحة.','افتح الملف الناتج وتأكد من الصفحات والصور والمخططات.','احفظ Backup وAudit Log في مكان آمن.'],updated:'تم تحديث هذه التعليمات لتشمل المدخلات الإنجليزية والتاريخ والوقت في PDF، وترتيب Start/End وألوان المسّاحين وطرح الفروق من QC Fixed.'
    }:{
      title:'QC Survey App Instructions',sub:'Current operating guide — version v258',start:'Safe start',startp:'Choose a work page, enter project data, then add measurements and photos. The app autosaves locally; also create a Backup before clearing data or moving to another device.',pages:'Pages',p1:'Total Station: setups, points, QC Fixed and coordinate differences.',p2:'Laser Scanner: sections, blocks, areas and scan numbers.',p3:'Static: session data, heights, coordinates, checklist, GPS and direction photos.',p4:'GNSS: Base plus distinct QC Fixed 1 and QC Fixed 2 with IDs. Start is left, End is right, every surveyor has a color, and differences are Start/End minus QC Fixed.',p5:'DC Flange / Pipe: component records, dimensions, interactive 3D view, compass orientation and direct sketching.',p6:'GPR Logging Sheet: acquisition lines, files, directions, and comments with local autosave plus Excel and PDF export.',p7:'Backfilling: pit dimensions, automatic volume, photographed/completion status, and team names and signatures.',p8:'Converters: single and file conversion, explicit UTM Zone/Hemisphere, Local inside From/To, and Baseline/Scale Factor.',comp:'Smart compass and direction photos',compp:'Choose N, E, S or W. Keep the phone flat and move slowly. The guide rejects magnetic spikes, applies circular damping and requires a steady lock before capture. Degree numbers are not printed on the photo. If warned, calibrate with a figure-8 motion.',base:'Base-device sketch',basep:'The antenna, tripod, Height Reading, Height Hook and True Height appear in Static and are redrawn with the same components in both Static and GNSS Base PDF exports.',factor:'Baseline and Scale Factor',factorp:'Choose Decimal Degrees or separate DMS. Declare Grid/Ground or Ground/Grid. The rules are Grid = Ground × canonical factor, ΔE = Grid × sin(Azimuth), and ΔN = Grid × cos(Azimuth). Use Expected Ending E/N to check error.',export:'Export',exportp:'The Export section is always the final section of every operational page. Review data, differences and photos first, then export PDF, Excel, CSV or Full Pack. PDF includes QC differences and the Base sketch. Open and inspect every deliverable before sending it.',lang:'Language',langp:'English mode contains no Arabic interface text. Arabic mode translates the interface and uses RTL, while input values, dates and times stay clear English/Latin. The app remembers the selection after refresh.',data:'Protection and recovery',datap:'Autosave is not a replacement for Backup. Use Backup All Data before Reset Saved. Do not place sensitive data in a public QR. Use only the offline QR or encrypted .qcshare file.',order:'Recommended workflow',steps:['Choose the language and page.','Enter project, surveyor, device and coordinates.','Add photos, verify directions and signature.','Run Validate/Smart QC and inspect differences.','Confirm Zone/Hemisphere and factor convention before conversion.','Review the preview, then use Export at the end of the page.','Open the result and verify pages, photos and diagrams.','Store Backup and Audit Log safely.'],updated:'These instructions now include English entries and PDF date/time, fixed Start-left/End-right layout, surveyor colors, and differences calculated from QC Fixed.'
    };
    var lis=T.steps.map(function(x){return '<li>'+x+'</li>'}).join('');
    return '<!doctype html><html lang="'+(ar?'ar':'en')+'" dir="'+(ar?'rtl':'ltr')+'"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>'+T.title+'</title><style>*{box-sizing:border-box}body{margin:0;background:#f4f7fb;color:#0f172a;font-family:system-ui,Tahoma,Arial;line-height:1.72;padding:22px}.sheet{max-width:920px;margin:auto;background:#fff;border:1px solid #dbe4ee;border-radius:16px;overflow:hidden;box-shadow:0 12px 34px #0f172a12}header{padding:26px 30px;background:linear-gradient(135deg,#1e40af,#2563eb);color:white}header h1{margin:0;font-size:25px}header p{margin:5px 0 0;color:#dbeafe}.body{padding:25px 30px}h2{font-size:17px;color:#1d4ed8;border-bottom:2px solid #dbeafe;padding-bottom:6px;margin:24px 0 9px}p,li{font-size:14px}.note{background:#eff6ff;border-inline-start:4px solid #2563eb;padding:12px 15px;border-radius:9px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}.box{border:1px solid #e2e8f0;border-radius:10px;padding:10px 13px;background:#f8fafc}@media(max-width:620px){body{padding:0}.sheet{border:0;border-radius:0}.body,header{padding:18px}.grid{grid-template-columns:1fr}}@media print{body{background:white;padding:0}.sheet{box-shadow:none;border:0}}</style></head><body><article class="sheet"><header><h1>'+T.title+'</h1><p>'+T.sub+'</p></header><div class="body"><div class="note"><b>'+T.updated+'</b></div><h2>'+T.start+'</h2><p>'+T.startp+'</p><h2>'+T.pages+'</h2><div class="grid"><div class="box">'+T.p1+'</div><div class="box">'+T.p2+'</div><div class="box">'+T.p3+'</div><div class="box">'+T.p4+'</div><div class="box">'+T.p5+'</div><div class="box">'+T.p6+'</div><div class="box">'+T.p7+'</div><div class="box">'+T.p8+'</div></div><h2>'+T.comp+'</h2><p>'+T.compp+'</p><h2>'+T.base+'</h2><p>'+T.basep+'</p><h2>'+T.factor+'</h2><p>'+T.factorp+'</p><h2>'+T.export+'</h2><p>'+T.exportp+'</p><h2>'+T.lang+'</h2><p>'+T.langp+'</p><h2>'+T.data+'</h2><p>'+T.datap+'</p><h2>'+T.order+'</h2><ol>'+lis+'</ol></div></article></body></html>';
  }
  var SPECS_DOC = buildSpecsDoc();

  function ensureSpecsModal() {
    if ($('app-specs-modal')) return;
    var m = document.createElement('div');
    m.id = 'app-specs-modal';
    m.className = 'modal-backdrop hidden';
    var esc = SPECS_DOC.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
    m.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" style="max-width:920px;width:94vw;height:88vh;display:flex;flex-direction:column;padding:0;overflow:hidden">' +
        '<div style="display:flex;align-items:center;justify-content:space-between;gap:10px;padding:12px 16px;border-bottom:1px solid var(--line);background:linear-gradient(135deg,#1e40af,#2563eb 55%,#3b82f6);color:#fff;border-radius:14px 14px 0 0">' +
          '<strong id="specs-modal-title" style="font-size:14px">📋 Application Instructions — v258</strong>' +
          '<div style="display:flex;gap:8px">' +
            '<button type="button" class="btn btn-secondary" id="specs-print" style="padding:6px 12px">🖨️ Print</button>' +
            '<button type="button" class="btn btn-secondary" id="specs-close" style="padding:6px 12px">✕</button>' +
          '</div>' +
        '</div>' +
        '<iframe id="specs-frame" title="Specifications" style="flex:1;width:100%;border:none;background:#fff" srcdoc="' + esc + '"></iframe>' +
      '</div>';
    document.body.appendChild(m);
    $('specs-close').addEventListener('click', function () { m.classList.add('hidden'); });
    m.addEventListener('click', function (e) { if (e.target === m) m.classList.add('hidden'); });
    $('specs-print').addEventListener('click', function () {
      try {
        var w = window.open('', '_blank');
        if (!w) { toastSafe('Allow pop-ups to print.', 'err'); return; }
        w.document.open(); w.document.write(SPECS_DOC); w.document.close();
        setTimeout(function () { try { w.focus(); w.print(); } catch (e) {} }, 400);
      } catch (e) { toastSafe('Print failed', 'err'); }
    });
  }
  function openSpecs() {
    SPECS_DOC = buildSpecsDoc();
    ensureSpecsModal();
    var fr=$('specs-frame'); if(fr) fr.srcdoc=SPECS_DOC;
    var ar=window.QCI18N&&window.QCI18N.getLanguage()==='ar';
    var ti=$('specs-modal-title'),pr=$('specs-print');
    if(ti)ti.textContent=ar?'📋 تعليمات التطبيق — v258':'📋 Application Instructions — v258';
    if(pr)pr.textContent=ar?'🖨️ طباعة':'🖨️ Print';
    $('app-specs-modal').classList.remove('hidden');
  }


  // ---------------- Session Timer (Static observation) ----------------
  var TIMER_KEY = "sessionTimer";
  function getTimerState() {
    var s = getSettings();
    return (s && s.sessionTimer) || { running: false, startEpoch: 0, endEpoch: 0, targetMin: 0, notified: false };
  }
  function saveTimerState(st) {
    var s = getSettings();
    s.sessionTimer = st;
    saveSettings(s);
  }
  function fmtHMS(ms) {
    var t = Math.max(0, Math.floor(ms / 1000));
    var h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), ss = t % 60;
    var p = function (n) { return String(n).padStart(2, "0"); };
    return p(h) + ":" + p(m) + ":" + p(ss);
  }
  /* ===== timer alert: sound + vibration + system notification (cross-browser) ===== */
  function timerBeep(pattern) {
    try {
      var Ctx = window.AudioContext || window.webkitAudioContext || window.mozAudioContext || window.msAudioContext;
      if (Ctx) {
        var ctx = new Ctx();
        if (ctx.state === "suspended" && ctx.resume) ctx.resume();
        var seq = pattern || [[880, 0, .22], [880, .35, .22], [1174, .75, .3]];
        seq.forEach(function (n) {
          var o = ctx.createOscillator(), g = ctx.createGain();
          o.connect(g); g.connect(ctx.destination);
          o.frequency.value = n[0];
          g.gain.setValueAtTime(0.0001, ctx.currentTime + n[1]);
          g.gain.exponentialRampToValueAtTime(0.25, ctx.currentTime + n[1] + 0.03);
          g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + n[1] + n[2]);
          o.start(ctx.currentTime + n[1]); o.stop(ctx.currentTime + n[1] + n[2] + 0.05);
        });
      }
    } catch (e) {}
    try {
      if (navigator.vibrate) navigator.vibrate(pattern ? [300, 150, 300, 150, 500] : [400, 200, 400]);
    } catch (e2) {}
  }

  var __notifReady = null;
  function systemNotifySupported() {
    return typeof Notification !== "undefined";
  }
  function ensureNotificationPermission() {
    if (!systemNotifySupported()) return Promise.resolve("unsupported");
    if (Notification.permission === "granted") return Promise.resolve("granted");
    if (Notification.permission === "denied") return Promise.resolve("denied");
    if (__notifReady) return __notifReady;
    __notifReady = Notification.requestPermission().then(function (p) { __notifReady = null; return p; });
    return __notifReady;
  }
  function showSystemNotification(title, body, tag) {
    try {
      if (!systemNotifySupported() || Notification.permission !== "granted") return false;
      var n = new Notification(title, {
        body: body, tag: tag || "qc-timer",
        icon: "icons/icon-192.png", badge: "icons/icon-192.png",
        silent: false, renotify: true
      });
      n.onclick = function () {
        try { window.focus(); n.close(); } catch (e) {}
      };
      setTimeout(function () { try { n.close(); } catch (e) {} }, 20000);
      return true;
    } catch (e) {
      try {
        /* Safari legacy path */
        if (navigator.notifications || window.safari) return false;
      } catch (e2) {}
      return false;
    }
  }
  function alertTimerReached(elapsedMs) {
    var msg = "\uD83C\uDFAF Target observation time reached (" + fmtHMS(elapsedMs) + ") \u2014 \u0627\u0643\u062A\u0645\u0644 \u0627\u0644\u0648\u0642\u062A \u0627\u0644\u0645\u0637\u0644\u0648\u0628";
    toastSafe(msg, "ok");
    timerBeep(true);
    showSystemNotification("QC Survey \u2014 Session Timer", msg, "qc-timer-target");
  }
  function alertTimerStopped(elapsedMs) {
    var msg = "\u23F9 Session stopped \u2014 duration " + fmtHMS(elapsedMs);
    toastSafe(msg, "ok");
    timerBeep();
    showSystemNotification("QC Survey \u2014 Session Timer", msg, "qc-timer-stop");
  }
  function insertSessionTimerCard() {
    var sc = $("view-sc");
    if (!sc || $("session-timer-card")) return;
    var stack = sc.querySelector(".stack");
    if (!stack) return;
    var card = document.createElement("section");
    card.className = "card";
    card.id = "session-timer-card";
    card.innerHTML =
      '<div class="card-hd"><h2>Session Timer \u2014 \u0645\u0624\u0642\u062A \u0627\u0644\u0631\u0635\u062F</h2></div>' +
      '<div class="card-bd">' +
        '<div class="timer-display" id="timer-display">00:00:00</div>' +
        '<span class="timer-status" id="timer-status"><span class="st-idle">Not started</span></span>' +
        '<div class="timer-progress" id="timer-progress"><span id="timer-bar"></span></div>' +
        '<div class="timer-meta" id="timer-meta">Target: \u2014</div>' +
        '<div class="timer-actions">' +
          '<select class="input" id="timer-target" title="Required observation time">' +
            '<option value="0">Target: \u2014</option>' +
            ["30","45","60","90","120","180","240","360","480","720"].map(function (m) {
              var lbl = (+m >= 60) ? ((+m / 60) + " h" + (+m % 60 ? " " + (+m % 60) + "m" : "")) : (m + " min");
              return '<option value="' + m + '">' + lbl + "</option>";
            }).join("") +
          "</select>" +
          '<button type="button" class="btn btn-primary" id="timer-start">\u25B6 Start</button>' +
          '<button type="button" class="btn btn-secondary" id="timer-stop">\u23F9 Stop</button>' +
          '<button type="button" class="btn btn-secondary" id="timer-reset">\u21BA Reset</button>' +
          '<button type="button" class="btn btn-secondary" id="timer-alerts" title="Enable system notifications + sound + vibration">\uD83D\uDD14 Alerts</button>' +
        "</div>" +
        '<p class="hint timer-startend" id="timer-startend">\u2014</p>' +
      "</div>";
    // place right after "Session Information" card if possible
    var host = null;
    stack.querySelectorAll(".card").forEach(function (c) {
      var h2 = c.querySelector(".card-hd h2");
      if (!host && h2 && String(h2.textContent).indexOf("Session Information") >= 0) host = c;
    });
    if (host && host.parentNode) host.parentNode.insertBefore(card, host.nextSibling);
    else stack.insertBefore(card, stack.firstChild);
    wireSessionTimer();
  }
  function wireSessionTimer() {
    var st = getTimerState();
    var sel = $("timer-target");
    if (sel) {
      sel.value = String(st.targetMin || 0);
      sel.addEventListener("change", function () {
        var s2 = getTimerState();
        s2.targetMin = +sel.value || 0;
        s2.notified = false;
        saveTimerState(s2);
        tickSessionTimer();
      });
    }
    var bs = $("timer-start"), bt = $("timer-stop"), br = $("timer-reset");
    if (bs) bs.addEventListener("click", function () {
      var s2 = getTimerState();
      if (s2.running) return;
      saveTimerState({ running: true, startEpoch: Date.now(), endEpoch: 0, targetMin: s2.targetMin || 0, notified: false });
      tickSessionTimer(true);
      toastSafe("Session timer started \u2014 \u0628\u062F\u0623 \u062A\u0648\u0642\u064A\u062A \u0627\u0644\u0631\u0635\u062F", "ok");
      /* ask notification permission during the user gesture (required by iOS Safari + good practice elsewhere) */
      ensureNotificationPermission().then(function (p) {
        if (p === "granted") toastSafe("\uD83D\uDD14 System alerts enabled", "ok");
        else if (p === "denied") toastSafe("System notifications blocked \u2014 in-app alert will still work.", "load");
      });
    });
    if (bt) bt.addEventListener("click", function () {
      var s2 = getTimerState();
      if (!s2.running) return;
      s2.endEpoch = Date.now();
      s2.running = false;
      saveTimerState(s2);
      tickSessionTimer(true);
      alertTimerStopped(s2.endEpoch - s2.startEpoch);
    });
    var ba = $("timer-alerts");
    if (ba) ba.addEventListener("click", function () {
      ensureNotificationPermission().then(function (p) {
        if (p === "granted") {
          toastSafe("\uD83D\uDD14 Alerts enabled \u2014 system notifications + sound + vibration", "ok");
          timerBeep(true);
          showSystemNotification("QC Survey \u2014 Alerts enabled", "You will be alerted when the target time is reached.", "qc-timer-test");
        } else if (p === "unsupported") {
          toastSafe("This browser has no system notifications \u2014 in-app alert + sound will be used.", "load");
          timerBeep(true);
        } else {
          toastSafe("Notifications blocked in browser settings \u2014 in-app alert + sound will be used.", "load");
        }
      });
    });
    if (br) br.addEventListener("click", function () {
      var s2 = getTimerState();
      if ((s2.running || s2.endEpoch) && !confirm("Reset the session timer?")) return;
      saveTimerState({ running: false, startEpoch: 0, endEpoch: 0, targetMin: s2.targetMin || 0, notified: false });
      tickSessionTimer(true);
    });
  }
  function tickSessionTimer(loud) {
    var d = $("timer-display"); if (!d) return;
    var st = getTimerState();
    var now = Date.now();
    var elapsed = st.running ? (now - st.startEpoch) : (st.endEpoch ? (st.endEpoch - st.startEpoch) : 0);
    d.textContent = fmtHMS(elapsed);
    d.className = "timer-display" + (st.running ? " running" : (elapsed ? "" : ""));
    var status = $("timer-status");
    var prog = $("timer-progress"), bar = $("timer-bar"), meta = $("timer-meta"), se = $("timer-startend");
    var reached = st.targetMin > 0 && elapsed >= st.targetMin * 60000;
    if (status) status.innerHTML = st.running
      ? '<span class="st-run">\u25CF Running' + (reached ? ' \u2014 target reached \u2714' : "") + "</span>"
      : (elapsed ? '<span class="' + (reached ? "st-done" : "") + '">' + (reached ? "\u2714 Completed \u2014 target reached" : "Stopped") + "</span>"
                  : '<span class="st-idle">Not started</span>');
    if (prog) {
      prog.classList.toggle("done", reached);
      var pct = st.targetMin > 0 ? Math.min(100, elapsed / (st.targetMin * 60000) * 100) : 0;
      if (bar) bar.style.width = (st.targetMin > 0 ? pct : (st.running ? 100 : 0)) + "%";
    }
    if (meta) {
      if (!st.targetMin) meta.textContent = "Target: \u2014";
      else {
        var rem = st.targetMin * 60000 - elapsed;
        meta.textContent = "Target: " + (st.targetMin >= 60 ? (st.targetMin / 60) + " h" : st.targetMin + " min") +
          (rem > 0 ? " \u00B7 Remaining: " + fmtHMS(rem) : " \u00B7 \u2714 reached");
      }
    }
    if (se) {
      function loc(ms) { return ms ? new Date(ms).toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : "\u2014"; }
      se.textContent = st.startEpoch ? ("Start: " + loc(st.startEpoch) + "   \u00B7   End: " + (st.running ? "(running)" : loc(st.endEpoch))) : "\u2014";
    }
    document.title = st.running ? ("\u23F1 " + fmtHMS(elapsed) + " \u00B7 QC Survey") : "QC Survey App";
    window.__qcTimerInfo = {
      running: st.running,
      startedAt: st.startEpoch ? new Date(st.startEpoch).toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : "",
      endedAt: (!st.running && st.endEpoch) ? new Date(st.endEpoch).toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}) : "",
      durationMs: elapsed,
      targetMin: st.targetMin || 0
    };
    // reminder once when target reached (silent ticks must NOT consume the notification)
    if (st.running && st.targetMin > 0 && elapsed >= st.targetMin * 60000 && !st.notified) {
      if (loud === false) {
        /* leave notified=false — the live interval tick will announce it */
      } else {
        st.notified = true;
        saveTimerState(st);
        alertTimerReached(elapsed);
      }
    }
  }
  window.__qcSessionTimer = {
    start: function () { var b = $("timer-start"); if (b) b.click(); },
    stop: function () { var b = $("timer-stop"); if (b) b.click(); },
    reset: function () { var b = $("timer-reset"); if (b) b.click(); },
    _backdate: function (min) {
      var s2 = getTimerState();
      s2.startEpoch = Date.now() - (min * 60000);
      s2.notified = false;
      saveTimerState(s2);
      tickSessionTimer(false);
    }
  };


  // ---------------- Paste from WhatsApp (any text) ----------------
  var AR_DIGITS = "\u0660\u0661\u0662\u0663\u0664\u0665\u0666\u0667\u0668\u0669";
  function normalizeDigits(s) {
    return String(s || "").replace(/[\u0660-\u0669]/g, function (d) { return String(AR_DIGITS.indexOf(d)); })
      .replace(/\u066B/g, ".").replace(/\u066C/g, ",").replace(/\u06F0-\u06F9/g, "");
  }
  function parseNum(s) {
    var v = String(s).replace(/\s+/g, "");
    var lastDot = v.lastIndexOf("."), lastComma = v.lastIndexOf(",");
    if (lastComma >= 0) {
      if (lastDot > lastComma) v = v.replace(/,/g, "");
      else v = v.replace(/\./g, "").replace(/,/g, ".");
    }
    var x = parseFloat(v);
    return isNaN(x) ? null : x;
  }
  function parsePastedSurvey(text) {
    var norm = normalizeDigits(text).replace(/\u00A0/g, " ");
    var rows = [];
    norm.split(/[\r\n]+/).forEach(function (line) {
      line = line.trim();
      if (!line) return;
      var tokens = line.split(/[\s\t;|]+/).filter(Boolean);
      var nums = [], id = "";
      tokens.forEach(function (tk) {
        var clean = tk.replace(/[:,()\[\]]+$/g, "").replace(/^[:,()\[\]]+/g, "");
        if (/^[-+]?[\d.,\u066B\u066C]{3,}$/.test(clean)) {
          var n = parseNum(clean);
          if (n != null) { nums.push(n); return; }
        }
        if (!id && /[A-Za-z\u0600-\u06FF]/.test(clean) && clean.length <= 15) id = clean.replace(/[:，,]+$/, "");
      });
      function intLen(v) { return String(Math.abs(v)).split(".")[0].replace(/^0+/, "").length; }
      if (nums.length >= 2 && (intLen(nums[0]) >= 4 || intLen(nums[1]) >= 4 || intLen(nums[nums.length - 1]) >= 5)) {
        rows.push({ id: id || "", easting: String(nums[0]), northing: String(nums[1]), elevation: nums.length >= 3 ? String(nums[2]) : "" });
      } else if (nums.length >= 6 && intLen(nums[0]) >= 4) {
        for (var i = 0; i + 2 < nums.length + 1; i += 3) {
          if (nums[i] != null && nums[i + 1] != null)
            rows.push({ id: "", easting: String(nums[i]), northing: String(nums[i + 1]), elevation: nums[i + 2] != null ? String(nums[i + 2]) : "" });
        }
      }
    });
    return rows;
  }
  var __pasteRows = [];
  function ensurePasteModal() {
    if ($("paste-modal")) return;
    var m = document.createElement("div");
    m.id = "paste-modal";
    m.className = "modal-backdrop hidden";
    m.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" style="max-width:560px">' +
        '<h3 style="font-size:15px">὎5 \u0644\u0635\u0642 \u0627\u0644\u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A \u2014 Paste from WhatsApp</h3>' +
        '<p style="font-size:12.5px;color:var(--text-2);margin:4px 0 10px">\u0627\u0644\u0635\u0642 \u0623\u064A \u0646\u0635 (\u0631\u0633\u0627\u0644\u0629 \u0648\u0627\u062A\u0633\u0627\u0628\u060C CSV\u060C \u0645\u0644\u0641 \u062C\u0647\u0627\u0632\u2026) \u2014 \u0623\u064A \u0634\u0643\u0644 \u064A\u0643\u062A\u0628 \u0646\u0642\u0637\u0629 + E + N (+ Z). \u062A\u062A\u0645\u0627\u0645\u0643 \u0645\u0639 \u0627\u0644\u0623\u0631\u0642\u0627\u0645 \u0627\u0644\u0639\u0631\u0628\u064A\u0629 \u0648\u0627\u0644\u0641\u0627\u0635\u0644\u0629 \u0627\u0644\u0639\u0634\u0631\u064A\u0629.</p>' +
        '<textarea id="paste-text" class="input" rows="6" style="width:100%;font-family:var(--mono);font-size:12.5px;direction:ltr" placeholder="P-101 512340.5000 3687450.2000 9.8800&#10;or E: 512340.5, N: 3687450.2"></textarea>' +
        '<div style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;align-items:center">' +
          '<button type="button" class="btn btn-primary" id="paste-analyze">ὐD \u062A\u062D\u0644\u064A\u0644 \u0627\u0644\u0646\u0635</button>' +
          '<select class="input" id="paste-dest" style="width:auto">' +
            '<option value="ts">\u2192 Total Station \u2014 \u0625\u0636\u0627\u0641\u0629 \u0646\u0642\u0627\u0637</option>' +
            '<option value="qc">\u2192 QC Measured (\u0627\u0644\u0625\u062D\u062F\u0627\u062B\u064A\u0629 \u0627\u0644\u0645\u0642\u0627\u0633\u0629)</option>' +
            '<option value="static">\u2192 Static \u2014 \u0625\u062D\u062F\u0627\u062B\u064A\u0629 \u0627\u0644\u0645\u062D\u0637\u0629</option>' +
          '</select>' +
        '</div>' +
        '<div id="paste-preview" style="margin-top:10px"></div>' +
        '<div class="modal-actions" style="margin-top:12px">' +
          '<button type="button" class="btn btn-secondary" id="paste-cancel">\u2715</button>' +
          '<button type="button" class="btn btn-primary" id="paste-apply" disabled>\u2714 \u062A\u0639\u0628\u0626\u0629</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    $("paste-cancel").addEventListener("click", function () { m.classList.add("hidden"); });
    m.addEventListener("click", function (e) { if (e.target === m) m.classList.add("hidden"); });
    $("paste-analyze").addEventListener("click", function () {
      var rows = parsePastedSurvey($("paste-text").value || "");
      __pasteRows = rows;
      var pv = $("paste-preview");
      if (!rows.length) {
        pv.innerHTML = '<div class="empty-hint">\u26A0\uFE0F \u0644\u0645 \u064A\u062A\u0645 \u0627\u0644\u0639\u062B\u0648\u0631 \u0639\u0644\u0649 \u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A \u2014 \u062A\u0623\u0643\u062F \u0645\u0646 \u0627\u0644\u0646\u0635</div>';
        $("paste-apply").disabled = true;
        return;
      }
      pv.innerHTML = '<div style="max-height:200px;overflow:auto"><table class="data" style="min-width:0"><thead><tr>' +
        '<th>#</th><th>ID</th><th>Easting</th><th>Northing</th><th>Elev</th></tr></thead><tbody>' +
        rows.map(function (r, i) {
          return '<tr><td>' + (i + 1) + '</td><td>' + esc(r.id || "\u2014") + '</td><td>' + esc(r.easting) + '</td><td>' + esc(r.northing) + '</td><td>' + esc(r.elevation || "\u2014") + '</td></tr>';
        }).join("") + '</tbody></table></div>' +
        '<p class="hint">' + rows.length + ' \u0646\u0642\u0637\u0629 \u062C\u0627\u0647\u0632\u0629</p>';
      $("paste-apply").disabled = false;
    });
    $("paste-apply").addEventListener("click", function () {
      applyPastedRows(__pasteRows, $("paste-dest").value);
      m.classList.add("hidden");
    });
  }
  function applyPastedRows(rows, dest) {
    if (!rows || !rows.length) return;
    var added = 0;
    if (dest === "static") {
      var r0 = rows[0];
      setVal("sc-easting", r0.easting);
      setVal("sc-northing", r0.northing);
      if (r0.elevation) setVal("sc-elevation", r0.elevation);
      if (r0.id) setVal("sc-point", r0.id);
      added = 1;
      toastSafe("\u062A\u0639\u0628\u0626\u0629 \u0625\u062D\u062F\u0627\u062B\u064A\u0629 \u0627\u0644\u0645\u062D\u0637\u0629 \u2014 station coordinates filled", "ok");
    } else if (dest === "qc") {
      var su = arr(window.setups)[0];
      if (su) {
        var rq = rows[0];
        su.qcMeasured = { id: rq.id || su.qcMeasured.id, easting: rq.easting, northing: rq.northing, elevation: rq.elevation || "" };
        added = 1;
        if (typeof window.renderSetups === "function") window.renderSetups();
        toastSafe("QC Measured filled", "ok");
      }
    } else {
      var s0 = arr(window.setups)[0];
      if (s0) {
        rows.forEach(function (r) {
          var empty = null;
          for (var i = 0; i < s0.rows.length; i++) {
            var rr = s0.rows[i];
            if (!rr.id && !rr.easting && !rr.northing && !rr.elevation) { empty = rr; break; }
          }
          if (empty) { empty.id = r.id; empty.easting = r.easting; empty.northing = r.northing; empty.elevation = r.elevation; }
          else s0.rows.push({ id: r.id, easting: r.easting, northing: r.northing, elevation: r.elevation, remark: "" });
          added++;
        });
        if (typeof window.renderSetups === "function") window.renderSetups();
        toastSafe(added + " \u0646\u0642\u0637\u0629 \u062A\u0645\u062A \u0625\u0636\u0627\u0641\u062A\u0647\u0627 \u2014 verify in the table", "ok");
      }
    }
    scheduleSave();
    drawENMap();
  }
  function openPasteImport() {
    ensurePasteModal();
    $("paste-modal").classList.remove("hidden");
    setTimeout(function () { try { $("paste-text").focus(); } catch (e) {} }, 60);
    /* try to pre-fill from clipboard (many browsers need a gesture — this IS one) */
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        navigator.clipboard.readText().then(function (t) {
          if (t && !$("paste-text").value) { $("paste-text").value = t; $("paste-analyze").click(); }
        }).catch(function () {});
      }
    } catch (e) {}
  }


  // ---------------- Point direction photos (Static) ----------------
  var dirPhotos = { N: null, E: null, S: null, W: null };
  var DIRS = [
    { k: "N", en: "North", ar: "\u0634\u0645\u0627\u0644", arrow: "\u2191" },
    { k: "E", en: "East",  ar: "\u0634\u0631\u0642",  arrow: "\u2192" },
    { k: "S", en: "South", ar: "\u062C\u0646\u0648\u0628", arrow: "\u2193" },
    { k: "W", en: "West",  ar: "\u063A\u0631\u0628",  arrow: "\u2190" }
  ];
  var compassActive = false, compassHeading = null, compassDetach = null;
  var __hdBuf = [], __calibWarned = false, __stableHeading = null, __lastCompassPaint = 0, __roseRotation = null;
  var __headingOutliers = 0, __alignedSince = 0, __directionLocked = false, __lockBuzzed = false, __lastSensorAt = 0;
  function compassText(en, ar) { return window.QCI18N ? window.QCI18N.t(en, ar) : en; }

  function circularMean(list) {
    if (!list.length) return 0;
    var sx = 0, sy = 0;
    list.forEach(function (h) { sx += Math.sin(h * Math.PI / 180); sy += Math.cos(h * Math.PI / 180); });
    return (Math.atan2(sx, sy) * 180 / Math.PI + 360) % 360;
  }
  function smoothHeading(hd) {
    hd = (hd % 360 + 360) % 360;
    if (__stableHeading != null) {
      var rawDiff = ((hd - __stableHeading + 540) % 360) - 180;
      /* Reject isolated magnetic spikes, but accept a real turn after three consecutive samples. */
      if (Math.abs(rawDiff) > 70 && __headingOutliers < 2) { __headingOutliers++; return __stableHeading; }
      __headingOutliers = 0;
    }
    __hdBuf.push(hd);
    if (__hdBuf.length > 18) __hdBuf.shift();
    var mean = circularMean(__hdBuf.slice(-10));
    if (__stableHeading == null) __stableHeading = mean;
    var diff = ((mean - __stableHeading + 540) % 360) - 180;
    var jitter = headingJitter();
    /* Adaptive circular damping: calm while aiming, responsive during a deliberate turn. */
    var gain = jitter < 2.5 ? 0.12 : (jitter < 8 ? 0.20 : 0.34);
    var dead = jitter < 3 ? 1.15 : 0.45;
    if (Math.abs(diff) > dead) __stableHeading = (__stableHeading + diff * gain + 360) % 360;
    return __stableHeading;
  }
  function headingJitter() {
    if (__hdBuf.length < 4) return 0;
    var recent = __hdBuf.slice(-6), m = circularMean(recent);
    return recent.reduce(function (a, h) { return a + Math.abs((h - m + 540) % 360 - 180); }, 0) / recent.length;
  }

  function nearestDir(hd) {
    var best = "N", bestD = 999;
    DIRS.forEach(function (d) {
      var target = { N: 0, E: 90, S: 180, W: 270 }[d.k];
      var diff = Math.abs((hd - target + 540) % 360 - 180);
      if (diff < bestD) { bestD = diff; best = d.k; }
    });
    return { k: best, off: bestD };
  }
  function startComass() {
    var DOE = window.DeviceOrientationEvent;
    function attach() {
      if (compassDetach) compassDetach();
      var lastEvent = 0;
      var handler = function (e) {
        var now = Date.now();
        /* Some Android browsers fire both absolute and ordinary streams for one sample. */
        if (now - lastEvent < 28) return;
        lastEvent = now;
        var hd = null;
        try { if (e.webkitCompassHeading != null) hd = e.webkitCompassHeading; } catch (e1) {}
        if (hd == null && e.alpha != null) {
          var screenAngle = 0;
          try { screenAngle = (screen.orientation && screen.orientation.angle) || window.orientation || 0; } catch (e2) {}
          hd = (360 - e.alpha + screenAngle) % 360;
        }
        if (hd != null && isFinite(hd)) {
          __lastSensorAt = now;
          var sm = smoothHeading(hd);
          compassHeading = sm;
          if (now - __lastCompassPaint >= 80) {
            __lastCompassPaint = now;
            var near = nearestDir(sm), nd = DIRS.filter(function (x) { return x.k === near.k; })[0];
            var el = $("compass-readout");
            if (el) el.textContent = nd.arrow + " " + compassText(nd.en, nd.ar);
            DIRS.forEach(function (d) {
              var slot = document.querySelector('.dir-slot[data-dir="' + d.k + '"]');
              if (slot) slot.classList.toggle("near", compassActive && near.k === d.k && near.off <= 25);
            });
            updateDirCapturePanel(sm, e);
          }
          if (headingJitter() > 16 && !__calibWarned) {
            __calibWarned = true;
            toastSafe("🧭 " + compassText("Calibrate with a figure-8 motion", "عاير الجهاز بحركة على شكل 8"), "load");
          }
          var flatHint = $("cap-flat");
          if (flatHint) {
            var notFlat = (e.beta != null && Math.abs(e.beta) > 48);
            flatHint.style.display = notFlat ? "" : "none";
          }
        }
      };
      window.addEventListener("deviceorientationabsolute", handler, true);
      window.addEventListener("deviceorientation", handler, true);
      compassDetach = function () {
        window.removeEventListener("deviceorientationabsolute", handler, true);
        window.removeEventListener("deviceorientation", handler, true);
      };
    }
    if (DOE && typeof DOE.requestPermission === "function") {
      DOE.requestPermission().then(function (r) {
        if (r === "granted") attach(); else toastSafe(compassText("Compass permission denied", "تم رفض إذن البوصلة"), "err");
      }).catch(function () { toastSafe(compassText("Compass unavailable", "البوصلة غير متاحة"), "err"); });
    } else if (DOE) attach();
    else toastSafe(compassText("This device has no compass — manual direction buttons work fine.", "هذا الجهاز لا يحتوي على بوصلة — يمكن استخدام أزرار الاتجاه اليدوية."), "load");
  }
  function toggleCompass() {
    compassActive = !compassActive;
    var btn = $("btn-compass");
    if (btn) btn.classList.toggle("acc", compassActive);
    var ro = $("compass-readout");
    if (ro) ro.textContent = compassActive ? "\u2026" : "\u2014";
    if (compassActive) { __hdBuf = []; __stableHeading = null; __roseRotation = null; __headingOutliers = 0; __alignedSince = 0; __directionLocked = false; __lockBuzzed = false; startComass(); }
    else { compassHeading = null; __hdBuf = []; __stableHeading = null; __roseRotation = null; __alignedSince = 0; __directionLocked = false; if (compassDetach) compassDetach(); compassDetach = null;
      document.querySelectorAll(".dir-slot").forEach(function (s) { s.classList.remove("near"); }); }
  }

  var capTargetDir = null;
  var DIR_TARGET_ANGLE = { N: 0, E: 90, S: 180, W: 270 };
  function ensureDirCapturePanel() {
    if ($("dir-capture-panel")) return;
    var m = document.createElement("div");
    m.id = "dir-capture-panel";
    m.className = "modal-backdrop hidden";
    m.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" style="max-width:360px;text-align:center">' +
        '<h3 id="cap-title" style="font-size:15px">🧭 Smart Direction Guide</h3>' +
        '<div class="cap-dial" aria-label="Visual compass">' +
          '<div class="cap-rose" id="cap-rose"><i class="cap-ring"></i>' +
            '<b class="cap-mark cap-n" data-cap-dir="N">N</b>' +
            '<b class="cap-mark cap-e" data-cap-dir="E">E</b>' +
            '<b class="cap-mark cap-s" data-cap-dir="S">S</b>' +
            '<b class="cap-mark cap-w" data-cap-dir="W">W</b>' +
          '</div><span class="cap-sight">▲</span><span class="cap-center"></span>' +
        '</div>' +
        '<div class="cap-read" id="cap-read">▲</div>' +
        '<div class="cap-status" id="cap-status">Move the phone slowly to detect direction</div>' +
        '<div class="cap-stability" id="cap-stability" aria-label="Stability"><i></i><i></i><i></i><i></i><i></i></div>' +
        '<p class="hint" id="cap-flat" style="display:none;color:#d97706">⚠️ Hold the phone flat</p>' +
        '<div class="modal-actions" style="margin-top:12px">' +
          '<button type="button" class="btn btn-secondary" id="cap-close">✕</button>' +
          '<button type="button" class="btn btn-primary" id="cap-shutter">📷 Capture</button>' +
        '</div>' +
      '</div>';
    document.body.appendChild(m);
    $("cap-close").addEventListener("click", closeDirCapture);
    m.addEventListener("click", function (e) { if (e.target === m) closeDirCapture(); });
    $("cap-shutter").addEventListener("click", function () {
      var f = capTargetDir ? $("dir-file-" + capTargetDir) : null;
      if (f) { f.value = ""; f.click(); }
    });
  }
  function openDirCapture(k) {
    ensureDirCapturePanel();
    capTargetDir = k;
    var d = DIRS.filter(function (x) { return x.k === k; })[0];
    $("cap-title").textContent = "🧭 " + compassText("Aim the phone toward " + d.en, "وجّه أعلى الهاتف نحو " + d.ar);
    __alignedSince = 0; __directionLocked = false; __lockBuzzed = false;
    var shutter = $("cap-shutter"); if (shutter) { shutter.disabled = false; shutter.textContent = "📷 " + compassText("Capture", "التقاط"); }
    document.querySelectorAll("[data-cap-dir]").forEach(function (x) { x.classList.toggle("target", x.getAttribute("data-cap-dir") === k); });
    $("dir-capture-panel").classList.remove("hidden");
    updateDirCapturePanel(compassHeading != null ? compassHeading : null);
    /* auto-start compass inside the user gesture (iOS-friendly) */
    if (!compassActive) {
      compassActive = true;
      __hdBuf = []; __stableHeading = null; __roseRotation = null;
      var btn = $("btn-compass");
      if (btn) btn.classList.add("acc");
      startComass();
    }
  }
  function closeDirCapture() {
    var m = $("dir-capture-panel");
    if (m) m.classList.add("hidden");
  }
  function updateDirCapturePanel(sm) {
    var m = $("dir-capture-panel");
    if (!m || m.classList.contains("hidden") || !capTargetDir) return;
    var target = DIR_TARGET_ANGLE[capTargetDir], wanted = DIRS.filter(function (x) { return x.k === capTargetDir; })[0];
    var read = $("cap-read"), st = $("cap-status"), rose = $("cap-rose"), dial = m.querySelector(".cap-dial"), shutter = $("cap-shutter");
    if (sm == null) {
      if (read) read.textContent = "▲ " + compassText(wanted.en, wanted.ar);
      if (st) st.textContent = compassText("Move the phone slowly to detect direction", "حرّك الهاتف بهدوء لاكتشاف الاتجاه");
      return;
    }
    var turn = ((target - sm + 540) % 360) - 180;
    var jitter = headingJitter();
    if (rose) {
      var desiredRose = ((-sm + 540) % 360) - 180;
      if (__roseRotation == null) __roseRotation = desiredRose;
      else __roseRotation += (((desiredRose - __roseRotation + 540) % 360) - 180) * 0.32;
      rose.style.transform = "rotate(" + __roseRotation.toFixed(1) + "deg)";
    }
    if (read) read.textContent = wanted.arrow + " " + compassText(wanted.en, wanted.ar);
    var aimed = Math.abs(turn) <= 9, steady = jitter <= 4.5;
    if (aimed && steady) {
      if (!__alignedSince) __alignedSince = Date.now();
      __directionLocked = Date.now() - __alignedSince >= 700;
    } else { __alignedSince = 0; __directionLocked = false; __lockBuzzed = false; }
    if (dial) { dial.classList.toggle("aligned", aimed); dial.classList.toggle("locked", __directionLocked); }
    var meter = $("cap-stability"), score = Math.max(0, Math.min(5, Math.round(5 - jitter / 3)));
    if (meter) meter.querySelectorAll("i").forEach(function(x,i){x.classList.toggle("on", i < score)});
    if (shutter) { shutter.disabled = !__directionLocked; shutter.textContent = "📷 " + compassText(__directionLocked ? "Capture" : "Hold steady", __directionLocked ? "التقاط" : "اثبت قليلاً"); }
    if (__directionLocked && !__lockBuzzed) { __lockBuzzed = true; try { navigator.vibrate && navigator.vibrate(45); } catch(e){} }
    if (st) {
      if (__directionLocked) { st.className = "cap-status ok lock"; st.textContent = "✔ " + compassText("Direction locked — capture now", "تم تثبيت الاتجاه — التقط الآن"); }
      else if (aimed) { st.className = "cap-status ok"; st.textContent = compassText("Aligned — hold steady", "تمت المحاذاة — اثبت"); }
      else { st.className = "cap-status"; var slight = Math.abs(turn) <= 32; st.textContent = turn > 0 ? ("↻ " + compassText(slight ? "Turn slightly right" : "Turn right", slight ? "استدر قليلاً يميناً" : "استدر يميناً")) : ("↺ " + compassText(slight ? "Turn slightly left" : "Turn left", slight ? "استدر قليلاً يساراً" : "استدر يساراً")); }
    }
  }

  function watermarkPhoto(dataUrl, lines, cb) {
    var img = new Image();
    img.onload = function () {
      try {
        var MAX = 1600, s = Math.min(1, MAX / Math.max(1, Math.max(img.width, img.height)));
        var c = document.createElement("canvas");
        c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
        var ctx = c.getContext("2d");
        ctx.drawImage(img, 0, 0, c.width, c.height);
        var fs = Math.max(14, Math.round(c.width * 0.030));
        var pad = Math.round(fs * 0.55);
        ctx.font = "700 " + fs + "px sans-serif";
        var wMax = 0;
        lines.forEach(function (l) { wMax = Math.max(wMax, ctx.measureText(l).width); });
        var bh = lines.length * fs * 1.28 + pad * 2;
        ctx.fillStyle = "rgba(15,23,42,.72)";
        ctx.fillRect(pad, c.height - bh - pad, wMax + pad * 2, bh);
        ctx.fillStyle = "#ffffff";
        lines.forEach(function (l, i) {
          ctx.fillText(l, pad * 2, c.height - bh - pad + pad + fs * 0.95 + i * fs * 1.28);
        });
        cb(c.toDataURL("image/jpeg", 0.85));
      } catch (e) { cb(dataUrl); }
    };
    img.onerror = function () { cb(dataUrl); };
    img.src = dataUrl;
  }
  function insertDirPhotosCard() {
    var sc = $("view-sc"); if (!sc || $("dir-photos-card")) return;
    var stack = sc.querySelector(".stack"); if (!stack) return;
    var card = document.createElement("section");
    card.className = "card"; card.id = "dir-photos-card";
    card.innerHTML =
      '<div class="card-hd"><h2>Point Photos</h2></div>' +
      '<div class="card-bd">' +
        '<div class="timer-actions" style="margin:0 0 12px">' +
          '<button type="button" class="btn btn-secondary" id="btn-compass">🧭 Direction Guide</button>' +
          '<button type="button" class="btn btn-secondary" id="btn-dir-save-all" title="Save all direction photos">⬇ Save All</button>' +
          '<b id="compass-readout" style="font-size:17px;color:var(--brand)">\u2014</b>' +
        '</div>' +
        '<div class="dir-grid">' +
          DIRS.map(function (d) {
            return '<div class="dir-slot" data-dir="' + d.k + '">' +
              '<div class="dir-head"><span class="dir-arrow">' + d.arrow + '</span><b>' + d.en + ' \u00B7 ' + d.ar + '</b></div>' +
              '<div class="dir-thumb" id="dir-thumb-' + d.k + '"></div>' +
              '<div class="dir-actions">' +
                '<button type="button" class="btn btn-secondary dir-cam" data-dir="' + d.k + '">\uD83D\uDCF7 ' + d.k + '</button>' +
                '<button type="button" class="btn btn-secondary dir-dl" data-dir="' + d.k + '" style="display:none" title="Save photo ' + d.en + '">⬇ Save ' + d.k + '</button>' +
                '<button type="button" class="btn btn-secondary dir-del" data-dir="' + d.k + '" style="display:none">\u2715</button>' +
              '</div>' +
              '<input type="file" accept="image/*" capture="environment" class="hidden dir-file" id="dir-file-' + d.k + '" data-dir="' + d.k + '" />' +
            '</div>';
          }).join("") +
        "</div>" +
        '<p class="hint">Photos are stamped with station, direction and date and included in exports.</p>' +
      "</div>";
    /* user request: this card sits LAST on the Static page */
    stack.appendChild(card);
    $("btn-compass").addEventListener("click", toggleCompass);
    qsa(".dir-cam").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var DOE = window.DeviceOrientationEvent;
        if (DOE) openDirCapture(btn.getAttribute("data-dir"));
        else {
          var f = $("dir-file-" + btn.getAttribute("data-dir"));
          if (f) { f.value = ""; f.click(); }
        }
      });
    });
    qsa(".dir-file").forEach(function (inp) {
      inp.addEventListener("change", function () {
        var file = inp.files && inp.files[0];
        if (!file) return;
        var k = inp.getAttribute("data-dir");
        var d = DIRS.filter(function (x) { return x.k === k; })[0];
        var fr = new FileReader();
        fr.onload = function () {
          var lines = [
            currentStationName() + " \u2014 " + d.en + " (" + d.k + ") " + d.ar
          ];
          var proj = (val("sc-project") || "").trim();
          var surv = (val("sc-surveyor") || "").trim();
          if (proj || surv) lines.push([proj, surv].filter(Boolean).join(" \u00B7 "));
          /* Direction is already stamped by name; no unstable degree number is printed on the photo. */
          lines.push(new Date().toLocaleString('en-GB',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}));
          watermarkPhoto(fr.result, lines, function (url) {
            var item = { url: url, station: currentStationName(), title: "Static \u2014 " + d.en + " view", kind: "dir", dir: k, at: Date.now() };
            dirPhotos[k] = item;
            closeDirCapture();
            renderDirPhotos();
            compressStoredPhoto(item);
            scheduleSave();
            toastSafe(d.en + " photo attached \u2014 \u062A\u0645 \u0625\u0631\u0641\u0627\u0642 \u0635\u0648\u0631\u0629 " + d.ar, "ok");
          });
        };
        fr.readAsDataURL(file);
      });
    });
    function saveDirPhoto(k) {
      var it = dirPhotos[k];
      if (!it || !it.url) return false;
      try {
        var parts = it.url.split(",");
        var mime = (parts[0].match(/:(.*?);/) || [])[1] || "image/jpeg";
        var bstr = atob(parts[1] || "");
        var u8 = new Uint8Array(bstr.length);
        for (var i = 0; i < bstr.length; i++) u8[i] = bstr.charCodeAt(i);
        var dObj = DIRS.filter(function (x) { return x.k === k; })[0] || { en: k };
        var dateS = it.at ? new Date(it.at).toISOString().slice(0, 10) : "";
        var name = String(it.station || "Point").replace(/[^\w\-]+/g, "_") + "_" + dObj.en + "_" + k + (dateS ? "_" + dateS : "") + ".jpg";
        downloadBlob(new Blob([u8], { type: mime }), name);
        return name;
      } catch (e) { return false; }
    }
    qsa(".dir-dl").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var name = saveDirPhoto(btn.getAttribute("data-dir"));
        if (name) toastSafe("Save photo \u0627\u0644\u0627\u062A\u062C\u0627\u0647 \u2014 " + name, "ok");
        else toastSafe("Save failed", "err");
      });
    });
    var bsa = $("btn-dir-save-all");
    if (bsa) bsa.addEventListener("click", function () {
      var saved = 0, idx = 0;
      DIRS.forEach(function (d) {
        if (dirPhotos[d.k] && dirPhotos[d.k].url) {
          setTimeout(function () { if (saveDirPhoto(d.k)) saved++; }, idx * 450);
          idx++;
        }
      });
      if (!idx) { toastSafe("\u0644\u0627 \u062A\u0648\u062C\u062F \u0635\u0648\u0631 \u0645\u062D\u0641\u0648\u0638\u0629 \u0628\u0639\u062F", "err"); return; }
      toastSafe("\u062C\u0627\u0631\u064A \u062D\u0641\u0638 " + idx + " \u0635\u0648\u0631 \u0628\u0627\u0633\u0645\u0627\u0621 \u0627\u0644\u0645\u062D\u0637\u0629 \u0648\u0627\u0644\u0627\u062A\u062C\u0627\u0647", "ok");
    });
    qsa(".dir-del").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var k = btn.getAttribute("data-dir");
        dirPhotos[k] = null;
        renderDirPhotos();
        scheduleSave();
      });
    });
    renderDirPhotos();
  }
  function renderDirPhotos() {
    window.__qcDirPhotos = dirPhotos;
    DIRS.forEach(function (d) {
      var th = $("dir-thumb-" + d.k); if (!th) return;
      var it = dirPhotos[d.k];
      if (it && it.url) {
        th.innerHTML = '<img src="' + it.url + '" alt="' + d.en + '" />';
        var del = document.querySelector('.dir-del[data-dir="' + d.k + '"]');
        if (del) del.style.display = "";
        var dl = document.querySelector('.dir-dl[data-dir="' + d.k + '"]');
        if (dl) dl.style.display = "";
      } else {
        th.innerHTML = '<div class="dir-empty">\uD83D\uDCF8 ' + d.arrow + "</div>";
        var del2 = document.querySelector('.dir-del[data-dir="' + d.k + '"]');
        if (del2) del2.style.display = "none";
        var dl2 = document.querySelector('.dir-dl[data-dir="' + d.k + '"]');
        if (dl2) dl2.style.display = "none";
      }
    });
  }


  // ---------------- Live GPS -> UTM (Static page) ----------------
  var gpsWatchId = null, gpsTimerInt = null, gpsStart = 0;
  function utmZoneFromLon(lon) {
    if (lon >= 0 && lon < 6) return 1;
    if (lon < 0) lon += 360;
    return Math.floor((lon + 180) / 6) % 60 + 1;
  }
  function latBand(lat) {
    var bands = "CDEFGHJKLMNPQRSTUVWX";
    if (lat < -80 || lat > 84) return "";
    return bands[Math.max(0, Math.min(bands.length - 1, Math.floor((lat + 80) / 8)))];
  }
  /* WGS84 -> UTM (Karoo-style series formulas; accuracy ~1m) */
  function llToUtm(lon, lat, zoneOverride, southOverride) {
    var a = 6378137.0, f = 1 / 298.257223563;
    var k0 = 0.9996, e2 = f * (2 - f), ep2 = e2 / (1 - e2);
    var zone = zoneOverride ? parseInt(zoneOverride, 10) : utmZoneFromLon(lon);
    var lon0 = ((zone - 1) * 6 - 180 + 3) * Math.PI / 180;
    var p = Math.PI / 180;
    var latR = lat * p, lonR = (lon * p) - lon0;
    var N = a / Math.sqrt(1 - e2 * Math.sin(latR) * Math.sin(latR));
    var T = Math.tan(latR) * Math.tan(latR);
    var C = ep2 * Math.cos(latR) * Math.cos(latR);
    var A = Math.cos(latR) * lonR;
    var M = a * ((1 - e2 / 4 - 3 * e2 * e2 / 64 - 5 * e2 * e2 * e2 / 256) * latR
      - (3 * e2 / 8 + 3 * e2 * e2 / 32 + 45 * e2 * e2 * e2 / 1024) * Math.sin(2 * latR)
      + (15 * e2 * e2 / 256 + 45 * e2 * e2 * e2 / 1024) * Math.sin(4 * latR)
      - (35 * e2 * e2 * e2 / 3072) * Math.sin(6 * latR));
    var easting = k0 * N * (A + (1 - T + C) * A * A * A / 6
      + (5 - 18 * T + T * T + 72 * C - 58 * ep2) * A * A * A * A * A / 120) + 500000;
    var northing = k0 * (M + N * Math.tan(latR) * (A * A / 2
      + (5 - T + 9 * C + 4 * C * C) * A * A * A * A / 24
      + (61 - 58 * T + T * T + 600 * C - 330 * ep2) * A * A * A * A * A * A / 720));
    var south = southOverride != null ? southOverride : (lat < 0);
    if (south) northing += 10000000;
    return { zone: zone, band: latBand(lat), easting: easting, northing: northing, south: south };
  }
  function fmtDMSCoord(v, isLat) {
    var hemi = isLat ? (v >= 0 ? "N" : "S") : (v >= 0 ? "E" : "W");
    var av = Math.abs(v);
    var d = Math.floor(av), m = Math.floor((av - d) * 60), s = ((av - d) * 60 - m) * 60;
    return d + "\u00B0 " + String(m).padStart(2, "0") + "' " + s.toFixed(1).padStart(4, "0") + '" ' + hemi;
  }
  function stopGpsWatch() {
    if (gpsWatchId != null && navigator.geolocation) { try { navigator.geolocation.clearWatch(gpsWatchId); } catch (e) {} }
    gpsWatchId = null;
    if (gpsTimerInt) clearInterval(gpsTimerInt);
    gpsTimerInt = null;
    var b = $("btn-gps-live");
    if (b) { b.classList.remove("acc"); b.innerHTML = "\uD83D\uDCCD GPS \u2014 \u0645\u0648\u0642\u0639 \u0645\u0628\u0627\u0634\u0631"; }
  }
  function onGpsPos(pos) {
    var lon = pos.coords.longitude, lat = pos.coords.latitude, acc = pos.coords.accuracy;
    var zSel = $("gps-zone"), zOverride = zSel && zSel.value !== "auto" ? zSel.value : null;
    var u = llToUtm(lon, lat, zOverride, null);
    if (zSel) {
      var autoZ = utmZoneFromLon(lon);
      var optAuto = zSel.querySelector('option[value="auto"]');
      if (optAuto) optAuto.textContent = "Auto (Zone " + autoZ + latBand(lat) + ")";
    }
    var mono = $("gps-readout");
    if (mono) {
      mono.innerHTML =
        '<div class="gps-line"><span>Lat</span><b>' + lat.toFixed(7) + '</b></div>' +
        '<div class="gps-line"><span>Lon</span><b>' + lon.toFixed(7) + '</b></div>' +
        '<div class="gps-line"><span>UTM</span><b>' + u.zone + u.band + ' \u00B7 E ' + u.easting.toFixed(3) + ' \u00B7 N ' + u.northing.toFixed(3) + '</b></div>' +
        '<div class="gps-line"><span>DMS</span><b>' + fmtDMSCoord(lat, true) + ' \u00B7 ' + fmtDMSCoord(lon, false) + '</b></div>' +
        '<div class="gps-line"><span>\u0627\u0644\u062F\u0642\u0629</span><b>±' + Math.round(acc) + ' m</b></div>';
    }
    window.__qcLastFix = { lat: lat, lon: lon, utm: u, acc: acc, at: Date.now() };
    /* live-fill hidden decimal + DMS fields */
    setVal("sc-longitude", lon.toFixed(7));
    setVal("sc-latitude", lat.toFixed(7));
    var dLat = fmtDMSCoord(lat, true).match(/(\d+)[\u00B0 ]+(\d+)' ([\d.]+)" ([NS])/);
    var dLon = fmtDMSCoord(lon, false).match(/(\d+)[\u00B0 ]+(\d+)' ([\d.]+)" ([EW])/);
    if (dLat) { setVal("sc-lat-deg", dLat[1]); setVal("sc-lat-min", dLat[2]); setVal("sc-lat-sec", dLat[3]); setVal("sc-lat-hemi", dLat[4]); }
    if (dLon) { setVal("sc-lon-deg", dLon[1]); setVal("sc-lon-min", dLon[2]); setVal("sc-lon-sec", dLon[3]); setVal("sc-lon-hemi", dLon[4]); }
    if (typeof window.syncLonLatHidden === "function") window.syncLonLatHidden();
  }
  function onGpsErr(e) {
    var mono = $("gps-readout");
    if (mono) mono.innerHTML = '<div class="gps-line err">\u26A0\uFE0F ' + (e && e.message ? e.message : "GPS error") + ' \u2014 \u0641\u0639\u0644\u0651 \u0625\u0630\u0646 \u0627\u0644\u0645\u0648\u0642\u0639 \u0644\u0644\u0645\u062A\u0635\u0641\u062D</div>';
  }
  function toggleGpsLive() {
    if (gpsWatchId != null) { stopGpsWatch(); return; }
    if (!navigator.geolocation) { toastSafe("GPS not supported on this device", "err"); return; }
    gpsStart = Date.now();
    var b = $("btn-gps-live");
    if (b) { b.classList.add("acc"); b.innerHTML = "\u23F9 \u0625\u064A\u0642\u0627\u0641 GPS"; }
    var mono = $("gps-readout");
    if (mono) mono.innerHTML = '<div class="gps-line">\uD83D\uDD01 \u062C\u0627\u0631\u064A \u0627\u0644\u0628\u062D\u062B \u0639\u0646 \u0627\u0644\u0623\u0642\u0645\u0627\u0631\u2026 (\u064A\u0645\u0643\u0646 \u0623\u0646 \u064A\u0623\u062E\u0630 \u0644\u062D\u0638\u0627\u062A \u0628\u0627\u0644\u0647\u0648\u0627\u0621\u0627\u0644\u0644\u064A \u0644\u0644\u0640 GPS \u0627\u0644\u062D\u0642\u064A\u0642\u064A\u064A\u062D\u062F\u062B \u0628\u062F\u0642\u0629 \u0623\u0641\u0636\u0644)</div>';
    gpsWatchId = navigator.geolocation.watchPosition(onGpsPos, onGpsErr, { enableHighAccuracy: true, maximumAge: 2000, timeout: 30000 });
    gpsTimerInt = setInterval(function () {
      if (gpsWatchId == null) return;
      var el = $("gps-elapsed");
      if (el) el.textContent = Math.round((Date.now() - gpsStart) / 1000) + "s";
    }, 1000);
    /* ask permission hint */
    toastSafe("\uD83D\uDCCD \u062A\u0623\u0643\u062F \u0645\u0646 \u0625\u0630\u0646 \u0627\u0644\u0645\u0648\u0642\u0639 \u0644\u0644\u0645\u062A\u0635\u0641\u062D \u2014 allow location access", "load");
  }
  function fillGpsToFields() {
    var f = window.__qcLastFix;
    if (!f || !f.utm) { toastSafe("\u0644\u0627 \u064A\u0648\u062C\u062F \u0625\u0635\u0644\u0627\u062D GPS \u0628\u0639\u062F \u2014 \u0634\u063A\u0651\u0644 GPS \u0623\u0648\u0644\u0627\u064B", "err"); return; }
    setVal("sc-easting", f.utm.easting.toFixed(3));
    setVal("sc-northing", f.utm.northing.toFixed(3));
    setVal("sc-zone-number", "UTM " + f.utm.zone + f.utm.band + (f.utm.south ? " (S)" : ""));
    toastSafe("\u062A\u0645 \u062A\u0639\u0628\u0626\u0629 E/N \u2014 \u0627\u0644\u0645\u0646\u0637\u0642\u0629 " + f.utm.zone + f.utm.band + " \u00B7 \u0627\u0644\u062F\u0642\u0629 ±" + Math.round(f.acc) + "\u0645", "ok");
    drawENMap();
    scheduleSave();
  }
  // ---------------- QC range summary (Total Station) ----------------

  // ---------------- Duplicate-ID coordinate suggester ----------------
  function knownPointsIndex() {
    var map = {};
    arr(window.setups).forEach(function (s) {
      (s.rows || []).forEach(function (r) {
        var id = String(r.id || "").trim();
        if (id && (r.easting || r.northing)) {
          if (!map[id]) map[id] = [];
          map[id].push({ e: r.easting, n: r.northing, z: r.elevation, remark: r.remark || "" });
        }
      });
      ["qcFixed", "qcMeasured"].forEach(function (k) {
        var q = s[k];
        if (q && q.id && (q.easting || q.northing)) {
          var id2 = String(q.id).trim();
          if (!map[id2]) map[id2] = [];
          map[id2].push({ e: q.easting, n: q.northing, z: q.elevation, remark: k === "qcFixed" ? "QC Fixed" : "QC Measured" });
        }
      });
    });
    var se = val("sc-easting"), sn = val("sc-northing"), sp = val("sc-point");
    if (sp && (se || sn)) map[sp.trim()] = [{ e: se, n: sn, z: val("sc-elevation"), remark: "Static station" }];
    return map;
  }
  function hideIdSuggest() {
    var s = $("id-suggest");
    if (s) s.remove();
  }
  function showIdSuggest(input, id, candidates) {
    hideIdSuggest();
    if (!candidates.length) return;
    var box = document.createElement("div");
    box.id = "id-suggest";
    box.className = "id-suggest";
    box.innerHTML = '<div class="id-sug-title">\U0001F4CC "' + esc(id) + '" \u0645\u0648\u062C\u0648\u062F \u0645\u0633\u0628\u0642\u0627\u064B \u2014 \u0627\u0636\u063A\u0637 \u0644\u0644\u062A\u0639\u0628\u0626\u0629:</div>' +
      candidates.slice(0, 3).map(function (c, i) {
        return '<button type="button" class="id-sug-item" data-i="' + i + '">' +
          '<b>E</b> ' + esc(c.e || "\u2014") + ' <b>N</b> ' + esc(c.n || "\u2014") + ' <b>Z</b> ' + esc(c.z || "\u2014") +
          (c.remark ? ' <i>(' + esc(c.remark) + ")</i>" : "") + "</button>";
      }).join("");
    document.body.appendChild(box);
    var ir = input.getBoundingClientRect();
    box.style.left = Math.min(window.innerWidth - 320, ir.left) + "px";
    box.style.top = (ir.bottom + 6) + "px";
    box.querySelectorAll(".id-sug-item").forEach(function (b) {
      b.addEventListener("pointerdown", function (ev) {
        ev.preventDefault();
        var c = candidates[+b.getAttribute("data-i")];
        var tr = input.closest("tr");
        if (tr) {
          function setF(f, v) {
            var inp = tr.querySelector('input[data-f="' + f + '"]');
            if (inp) { inp.value = v == null ? "" : v; inp.dispatchEvent(new Event("input", { bubbles: true })); }
          }
          setF("id", id); setF("easting", c.e || ""); setF("northing", c.n || ""); setF("elevation", c.z || "");
          scheduleSave(); drawENMap();
          toastSafe("\u062A\u0645\u062A \u062A\u0639\u0628\u0626\u0629 \u0625\u062D\u062F\u0627\u062B\u064A\u0627\u062A " + id + " \u0645\u0646 \u0627\u0644\u0630\u0627\u0643\u0631\u0629 \u2014 \u0631\u0627\u062C\u0639\u0647\u0627", "ok");
        }
        hideIdSuggest();
      });
    });
    setTimeout(function () {
      document.addEventListener("pointerdown", function once(e) {
        if (!box.contains(e.target)) { hideIdSuggest(); document.removeEventListener("pointerdown", once); }
      });
    }, 50);
  }
  function wireIdSuggest() {
    qsa('#setups input[data-f="id"]').forEach(function (inp) {
      if (inp.dataset.sugWired) return;
      inp.dataset.sugWired = "1";
      inp.addEventListener("input", function () {
        var id = String(inp.value || "").trim();
        if (id.length < 2) { hideIdSuggest(); return; }
        var tr = inp.closest("tr");
        var eInp = tr ? tr.querySelector('input[data-f="easting"]') : null;
        if (eInp && String(eInp.value || "").trim() !== "") { hideIdSuggest(); return; } /* already filled */
        var map = knownPointsIndex();
        if (map[id]) showIdSuggest(inp, id, map[id]);
        else hideIdSuggest();
      });
      inp.addEventListener("blur", function () { setTimeout(hideIdSuggest, 250); });
    });
  }


  function insertGpsCard() {
    var sc = $("view-sc"); if (!sc || $("gps-card")) return;
    var stack = sc.querySelector(".stack"); if (!stack) return;
    var card = document.createElement("section");
    card.className = "card"; card.id = "gps-card";
    var zones = "";
    for (var z = 1; z <= 60; z++) zones += '<option value="' + z + '">' + z + "</option>";
    card.innerHTML =
      '<div class="card-hd"><h2>GPS \u2014 \u0625\u062D\u062F\u0627\u062B\u064A \u0645\u0628\u0627\u0634\u0631</h2></div>' +
      '<div class="card-bd">' +
        '<div class="timer-actions" style="margin:0 0 10px">' +
          '<button type="button" class="btn btn-primary" id="btn-gps-live">\uD83D\uDCCD GPS \u2014 \u0645\u0648\u0642\u0639 \u0645\u0628\u0627\u0634\u0631</button>' +
          '<button type="button" class="btn btn-secondary" id="btn-gps-fill">\u2714 \u062A\u0639\u0628\u0626\u0629 E/N</button>' +
          '<select class="input" id="gps-zone" title="UTM Zone"><option value="auto">Auto</option>' + zones + "</select>" +
          '<b id="gps-elapsed" style="font-family:var(--mono);color:var(--brand)"></b>' +
        "</div>" +
        '<div id="gps-readout" class="gps-box"><div class="gps-line">\u0627\u0636\u063A\u0637 GPS \u0644\u0642\u0631\u0627\u0621\u0629 \u0645\u0648\u0642\u0639\u0643 \u0645\u0646 \u0627\u0644\u0623\u0642\u0645\u0627\u0631 \u2014 \u064A\u062A\u0645 \u062D\u0633\u0627\u0628 \u0645\u0646\u0637\u0642\u0629 UTM \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B</div></div>' +
      "</div>";
    /* place right before Coordinates card */
    var host = null;
    stack.querySelectorAll(".card").forEach(function (c) {
      var h2 = c.querySelector(".card-hd h2");
      if (!host && h2 && String(h2.textContent).indexOf("Coordinates") >= 0) host = c;
    });
    if (host && host.parentNode) host.parentNode.insertBefore(card, host);
    else stack.insertBefore(card, stack.firstChild);
    $("btn-gps-live").addEventListener("click", toggleGpsLive);
    $("btn-gps-fill").addEventListener("click", fillGpsToFields);
    var zs = $("gps-zone");
    if (zs) zs.addEventListener("change", function () {
      if (window.__qcLastFix) onGpsPos({ coords: { longitude: window.__qcLastFix.lon, latitude: window.__qcLastFix.lat, accuracy: window.__qcLastFix.acc } });
    });
  }


  // ---------------- Setup duplicate + ROW copy/paste via checkboxes (Total Station) ----------------
  var rowBuffer = [];
  function injectSetupTools() {
    /* only the toolbar + cell tools are permanent; checkboxes appear in selection mode */
    injectSetupToolbars();
  }
  var __selModeWired = false;
  function injectSetupToolbars() {
    qsa("#setups > .card").forEach(function (card, si) {
      var bd = card.querySelector(".card-bd");
      if (!bd) return;
      if (!card.querySelector(".setups-tools")) {
        var bar = document.createElement("div");
        bar.className = "setups-tools";
        bar.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;align-items:center;margin-bottom:10px";
        bar.innerHTML =
          '<button type="button" class="btn btn-secondary" data-act="dup">\u29C9 \u0646\u0633\u062E \u0627\u0644\u0633\u064A\u062A\u0628</button>' +
          '<button type="button" class="btn btn-secondary" data-act="copyrow">\u29C9 \u0646\u0633\u062E \u0627\u0644\u0645\u062D\u062F\u062F (\u0635\u0641)</button>' +
          '<button type="button" class="btn btn-secondary" data-act="pasterow">\u2B07 \u0644\u0635\u0642 \u0627\u0644\u0635\u0641\u0648\u0641</button>' +
          '<span class="hint rowbuf-info" style="margin:0"></span>';
        bd.insertBefore(bar, bd.firstChild);
        wireToolbar(card, bar, si);
      } else {
        /* re-sync buffer label */
        var el = card.querySelector(".rowbuf-info");
        if (el) el.textContent = rowBuffer.length ? ("\u0627\u0644\u062D\u0641\u0638: " + rowBuffer.length + " \u0635\u0641") : "";
      }
    });
  }

  function enterSelectionMode(card, si) {
    card.querySelectorAll("table.data").forEach(function (table) {
      var th = table.querySelector("thead th:first-child");
      if (th && !th.querySelector(".row-sel-all")) {
        var cbAll = document.createElement("input");
        cbAll.type = "checkbox";
        cbAll.className = "row-sel-all";
        cbAll.style.cssText = "width:16px;height:16px;cursor:pointer";
        cbAll.title = "\u062A\u062D\u062F\u064A\u062F \u0643\u0644 \u0627\u0644\u0635\u0641\u0648\u0641";
        cbAll.addEventListener("change", function () {
          table.querySelectorAll(".row-sel").forEach(function (c) { c.checked = cbAll.checked; updateSelCount(card); });
        });
        th.appendChild(cbAll);
      }
      table.querySelectorAll("tbody tr").forEach(function (tr, ri) {
        var td = tr.querySelector("td:first-child");
        if (!td) return;
        if (!td.querySelector(".row-sel")) {
          var cb = document.createElement("input");
          cb.type = "checkbox";
          cb.className = "row-sel";
          cb.dataset.s = si;
          cb.dataset.r = ri;
          cb.style.cssText = "width:15px;height:15px;cursor:pointer;margin-inline-end:4px;vertical-align:middle";
          cb.addEventListener("change", function () { updateSelCount(card); });
          td.insertBefore(cb, td.firstChild);
        }
      });
    });
    card.classList.add("sel-mode");
    var tools = card.querySelector(".setups-tools");
    if (tools && !tools.querySelector(".sel-done")) {
      var selInfo = document.createElement("span");
      selInfo.className = "hint sel-count";
      selInfo.style.cssText = "font-weight:800;color:var(--brand)";
      tools.insertBefore(selInfo, tools.querySelector('[data-act="dup"]'));
      var doneBtn = document.createElement("button");
      doneBtn.type = "button";
      doneBtn.className = "btn btn-primary sel-done";
      doneBtn.textContent = "\u2714 \u0646\u0633\u062E \u0627\u0644\u0645\u062D\u062F\u062F";
      doneBtn.addEventListener("click", function () {
        var s = arr(window.setups)[si];
        rowBuffer = [];
        card.querySelectorAll(".row-sel:checked").forEach(function (c) {
          var r = (s.rows || [])[+c.dataset.r];
          if (r) rowBuffer.push(JSON.parse(JSON.stringify(r)));
        });
        if (!rowBuffer.length) { toastSafe("\u062D\u062F\u0651\u062F \u0635\u0641 \u0648\u0627\u062D\u062F \u0639\u0644\u0649 \u0627\u0644\u0623\u0642\u0644", "err"); return; }
        qsa(".setups-tools .rowbuf-info").forEach(function (e) { e.textContent = "\u0627\u0644\u062D\u0641\u0638: " + rowBuffer.length + " \u0635\u0641"; });
        toastSafe("\u0646\u0633\u062E " + rowBuffer.length + " \u0635\u0641 \u2014 \u0627\u0644\u0635\u0642\u0647\u0645 \u0628\u0623\u064A \u0633\u064A\u062A\u0628", "ok");
        exitSelectionMode(card);
      });
      tools.appendChild(doneBtn);
      var cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "btn btn-secondary sel-done";
      cancelBtn.textContent = "\u2715";
      cancelBtn.addEventListener("click", function () { exitSelectionMode(card); });
      tools.appendChild(cancelBtn);
    }
    updateSelCount(card);
  }
  function exitSelectionMode(card) {
    card.querySelectorAll(".row-sel, .row-sel-all").forEach(function (c) { c.remove(); });
    card.classList.remove("sel-mode");
    var info = card.querySelector(".sel-count");
    if (info) info.remove();
    card.querySelectorAll(".sel-done").forEach(function (b) { b.remove(); });
  }
  function updateSelCount(card) {
    var info = card.querySelector(".sel-count");
    if (!info) return;
    var n = card.querySelectorAll(".row-sel:checked").length;
    info.textContent = n ? ("\u0645\u062D\u062F\u062F: " + n) : "\u062D\u062F\u0651\u062F \u0627\u0644\u0635\u0641\u0648\u0641";
  }

  function wireToolbar(card, bar, si) {
    function bufInfo() {
      var el = bar.querySelector(".rowbuf-info");
      if (el) el.textContent = rowBuffer.length ? ("\u0627\u0644\u062D\u0641\u0638: " + rowBuffer.length + " \u0635\u0641") : "";
    }
    bufInfo();
    bar.querySelector('[data-act="dup"]').addEventListener("click", function () {
      var gs = ensureArrayGlobal("setups");
      var s = gs[si];
      if (!s) return;
      gs.splice(si + 1, 0, JSON.parse(JSON.stringify(s)));
      if (typeof window.renderSetups === "function") window.renderSetups();
      scheduleSave(); drawENMap();
      toastSafe("\u062A\u0645 \u0646\u0633\u062E \u0627\u0644\u0633\u064A\u062A\u0628", "ok");
    });
    bar.querySelector('[data-act="copyrow"]').addEventListener("click", function () {
      enterSelectionMode(card, si);
    });
    bar.querySelector('[data-act="pasterow"]').addEventListener("click", function () {
      if (!rowBuffer.length) { toastSafe("\u0644\u0627 \u064A\u0648\u062C\u062F \u0635\u0641\u0648\u0641 \u0645\u0646\u0633\u0648\u062E\u0629 \u0628\u0639\u062F", "err"); return; }
      var s = arr(window.setups)[si];
      if (!s) return;
      rowBuffer.forEach(function (r) {
        var empty = null;
        for (var i = 0; i < s.rows.length; i++) {
          var rr = s.rows[i];
          if (!rr.id && !rr.easting && !rr.northing && !rr.elevation) { empty = rr; break; }
        }
        if (empty) Object.assign(empty, JSON.parse(JSON.stringify(r)));
        else s.rows.push(JSON.parse(JSON.stringify(r)));
      });
      if (typeof window.renderSetups === "function") window.renderSetups();
      scheduleSave(); drawENMap();
      toastSafe("\u0644\u0635\u0642 " + rowBuffer.length + " \u0635\u0641", "ok");
    });
  }

  /* legacy auto-checkbox injection removed (v160): selection mode is on-demand */

  // ---------------- QC range summary (Total Station) ----------------
  function qcRangeStats() {
    var tols = getTols();
    var items = [];
    arr(window.setups).forEach(function (s, si) {
      if (!s || !s.qcFixed || !s.qcMeasured) return;
      function d(a, b) { return (typeof window.diff === "function") ? window.diff(a, b) : ""; }
      var de = d(s.qcFixed.easting, s.qcMeasured.easting);
      var dn = d(s.qcFixed.northing, s.qcMeasured.northing);
      var dz = d(s.qcFixed.elevation, s.qcMeasured.elevation);
      if (de === "" && dn === "" && dz === "") return;
      function abs(v) { return v === "" ? null : Math.abs(parseFloat(v)); }
      var axes = { e: abs(de), n: abs(dn), z: abs(dz) };
      var pass = true, has = false, worstAxis = 0;
      ["e", "n", "z"].forEach(function (k) {
        if (axes[k] == null) return;
        has = true;
        worstAxis = Math.max(worstAxis, axes[k]);
        if (axes[k] > tols[k]) pass = false;
      });
      if (has) items.push({ label: "S" + (si + 1) + " \u00B7 " + (s.qcMeasured.id || s.qcFixed.id || "?"), e: axes.e, n: axes.n, z: axes.z, pass: pass, worst: worstAxis });
    });
    return items;
  }
  function renderQcRange() {
    var host = $("qc-range-list"); if (!host) return;
    var tols = getTols();
    var items = qcRangeStats();
    if (!items.length) {
      host.innerHTML = '<div class="empty-hint"><span class="empty-title">\u2696 \u0644\u0633 \u062A\u0648\u062C\u062F \u0641\u0631\u0648\u0642 QC \u0628\u0639\u062F</span>Fill QC Fixed + Measured per setup \u2014 live stats appear here.<br>\u0639\u0628\u0651\u064A \u0627\u0644\u0641\u062D\u0635 (\u0646\u0638\u0631\u064A/\u0645\u0642\u0627\u0633) \u0648\u062A\u0637\u0644\u0639 \u0627\u0644\u0625\u062D\u0635\u0627\u0621 \u062A\u0644\u0642\u0627\u0626\u064A\u0627\u064B</div>';
      return;
    }
    function stat(list) {
      var v = list.filter(function (x) { return x != null; });
      if (!v.length) return "\u2014";
      var mn = Math.min.apply(null, v), mx = Math.max.apply(null, v);
      var avg = v.reduce(function (a, b) { return a + b; }, 0) / v.length;
      return avg.toFixed(4) + " / " + mn.toFixed(4) + " / " + mx.toFixed(4);
    }
    var passN = items.filter(function (x) { return x.pass; }).length;
    var worst = items.slice().sort(function (a, b) { return b.worst - a.worst; })[0];
    host.innerHTML =
      '<div class="cov-row"><div class="cov-label"><b>\u0645\u0639\u062F\u0644 / \u0623\u0641\u0636\u0644 / \u0623\u0633\u0648\u0623 (m)</b><span class="cov-count' + (passN === items.length ? ' cov-full' : '') + '">' + passN + '/' + items.length + ' \u0646\u0627\u062C\u062D</span></div></div>' +
      '<div class="qc-grid">' +
        '<div class="qc-cell"><span>dE</span><b>' + stat(items.map(function (x) { return x.e; })) + '</b></div>' +
        '<div class="qc-cell"><span>dN</span><b>' + stat(items.map(function (x) { return x.n; })) + '</b></div>' +
        '<div class="qc-cell"><span>dZ</span><b>' + stat(items.map(function (x) { return x.z; })) + '</b></div>' +
      '</div>' +
      '<div class="timer-progress' + (passN === items.length ? ' done' : '') + '" style="margin-top:8px"><span style="width:' + Math.round(passN / items.length * 100) + '%"></span></div>' +
      '<p class="hint">\u0623\u0633\u0648\u0623 \u0646\u0642\u0637\u0629: <b>' + esc(worst.label) + '</b> (\u0623\u0642\u0635\u0649 \u0627\u0646\u062D\u0631\u0627\u0641 ' + worst.worst.toFixed(4) + 'm) \u00B7 \u0627\u0644\u062D\u062F\u0648\u062F ' + tols.e + ' / ' + tols.n + ' / ' + tols.z + '</p>';
  }
  var __qcRangeHash = "";
  function insertQcRangeCard() {
    var ts = $("view-ts"); if (!ts || $("qc-range-card")) return;
    var stack = ts.querySelector(".stack"); if (!stack) return;
    var card = document.createElement("section");
    card.className = "card"; card.id = "qc-range-card";
    card.innerHTML =
      '<div class="card-hd"><h2>QC Range \u2014 \u0646\u0637\u0627\u0642 \u0627\u0644\u062C\u0648\u062F\u0629</h2></div>' +
      '<div class="card-bd"><div id="qc-range-list"></div></div>';
    var setupsEl = $("setups");
    if (setupsEl && setupsEl.parentNode) setupsEl.parentNode.insertBefore(card, setupsEl.nextSibling);
    else stack.appendChild(card);
    renderQcRange();
    setInterval(function () {
      var h = JSON.stringify(arr(window.setups)) + "|" + [getTols().e, getTols().n, getTols().z].join(",");
      if (h !== __qcRangeHash) { __qcRangeHash = h; renderQcRange(); }
      injectSetupTools();
      wireIdSuggest();
    }, 1200);
  }

  // ---------------- Blocks map (Laser) ----------------
  function renderBlocksMap() {
    var host = $("blocks-map-list"); if (!host) return;
    var byBlock = {};
    arr(window.sections).forEach(function (s) {
      if (!s) return;
      var b = String(s.block == null ? "" : s.block).trim();
      var a = String(s.area == null ? "" : s.area).trim();
      if (!b) return;
      if (!byBlock[b]) byBlock[b] = {};
      var key = a || "?";
      byBlock[b][key] = (byBlock[b][key] || 0) + 1;
    });
    var blocks = Object.keys(byBlock).sort(function (x, y) { return (+x || 0) - (+y || 0); });
    if (!blocks.length) {
      host.innerHTML = '<div class="empty-hint"><span class="empty-title">\U0001F5FA \u0644\u0633 \u062A\u0648\u062C\u062F \u0623\u0642\u0633\u0627\u0645 \u0628\u0639\u062F</span>Blocks/areas appear here as you add sections.<br>\u0623\u0636\u0641 \u0623\u0642\u0633\u0627\u0645 \u0628\u0627\u0644\u0623\u0633\u0641\u0644 \u0648\u062A\u0637\u0644\u0639 \u0627\u0644\u062E\u0631\u064A\u0637\u0629</div>';
      return;
    }
    var max = 1;
    blocks.forEach(function (b) { Object.keys(byBlock[b]).forEach(function (a) { max = Math.max(max, byBlock[b][a]); }); });
    host.innerHTML = blocks.map(function (b) {
      var areas = Object.keys(byBlock[b]).sort(function (x, y) { return (+x || 0) - (+y || 0); });
      return '<div class="blk-row"><b class="blk-tag">B' + esc(b) + '</b>' +
        areas.map(function (a) {
          var n = byBlock[b][a];
          var op = 0.25 + 0.75 * (n / max);
          return '<span class="blk-chip" style="background:rgba(37,99,235,' + op.toFixed(2) + ')" title="Block ' + esc(b) + ' \u00B7 Area ' + esc(a) + ': ' + n + ' \u0642\u0633\u0645">A' + esc(a) + '<i>' + n + '</i></span>';
        }).join("") + "</div>";
    }).join("") + '<p class="hint">\u0627\u0644\u0631\u0642\u0645 \u062F\u0627\u062E\u0644 \u0643\u0644 \u0645\u0631\u0628\u0639 = \u0639\u062F\u062F \u0627\u0644\u0623\u0642\u0633\u0627\u0645 \u00B7 \u0627\u0644\u062A\u062D\u0642\u064A\u0642 \u064A\u0648\u0645\u062B \u0645\u0639 \u0627\u0644\u0639\u062F\u062F</p>';
  }
  var __blkHash = "";
  function insertBlocksMapCard() {
    var ls = $("view-ls"); if (!ls || $("blocks-map-card")) return;
    var stack = ls.querySelector(".stack"); if (!stack) return;
    var card = document.createElement("section");
    card.className = "card"; card.id = "blocks-map-card";
    card.innerHTML =
      '<div class="card-hd"><h2>Blocks Map \u2014 \u062E\u0631\u064A\u0637\u0629 \u0627\u0644\u062A\u0648\u0632\u064A\u0639</h2></div>' +
      '<div class="card-bd"><div id="blocks-map-list"></div></div>';
    var sec = $("sections");
    if (sec && sec.parentNode) sec.parentNode.insertBefore(card, sec.nextSibling);
    else stack.appendChild(card);
    renderBlocksMap();
    setInterval(function () {
      var h = JSON.stringify(arr(window.sections));
      if (h !== __blkHash) { __blkHash = h; renderBlocksMap(); }
    }, 1200);
  }


  // ---------------- Theme Studio (colors) ----------------
  var THEMES = [
    { id: "classic",  name: "Classic Blue",   brand: "#1d4ed8", brand2: "#2563eb", brandLt: "#3b82f6", soft: "#eff6ff", soft2: "#dbeafe" },
    { id: "teal",     name: "Teal",           brand: "#0f766e", brand2: "#0d9488", brandLt: "#14b8a6", soft: "#f0fdfa", soft2: "#ccfbf1" },
    { id: "green",    name: "Green",          brand: "#15803d", brand2: "#16a34a", brandLt: "#22c55e", soft: "#f0fdf4", soft2: "#dcfce7" },
    { id: "purple",   name: "Purple",         brand: "#6d28d9", brand2: "#7c3aed", brandLt: "#8b5cf6", soft: "#f5f3ff", soft2: "#ede9fe" },
    { id: "rose",     name: "Rose",           brand: "#be123c", brand2: "#e11d48", brandLt: "#f43f5e", soft: "#fff1f2", soft2: "#ffe4e6" },
    { id: "graphite", name: "Graphite",       brand: "#334155", brand2: "#475569", brandLt: "#64748b", soft: "#f8fafc", soft2: "#e2e8f0" },
    { id: "indigo",   name: "Indigo",         brand: "#3730a3", brand2: "#4f46e5", brandLt: "#6366f1", soft: "#eef2ff", soft2: "#e0e7ff" },
    { id: "sky",      name: "Sky",            brand: "#0369a1", brand2: "#0284c7", brandLt: "#0ea5e9", soft: "#f0f9ff", soft2: "#e0f2fe" },
    { id: "amber",    name: "Amber",          brand: "#b45309", brand2: "#d97706", brandLt: "#f59e0b", soft: "#fffbeb", soft2: "#fef3c7" },
    { id: "pink",     name: "Pink",           brand: "#9d174d", brand2: "#db2777", brandLt: "#ec4899", soft: "#fdf2f8", soft2: "#fce7f3" },
    { id: "olive",    name: "Olive",          brand: "#3f6212", brand2: "#4d7c0f", brandLt: "#84cc16", soft: "#f7fee7", soft2: "#ecfccb" },
    { id: "crimson",  name: "Crimson",        brand: "#991b1b", brand2: "#b91c1c", brandLt: "#ef4444", soft: "#fef2f2", soft2: "#fee2e2" }
  ];
  var FONT_STACKS = [
    { id: "default",   name: "Default (Segoe / System)", stack: '"DM Sans","Segoe UI",system-ui,-apple-system,Roboto,Arial,sans-serif' },
    { id: "arial",     name: "Arial / Helvetica",        stack: 'Arial,Helvetica,"Segoe UI",sans-serif' },
    { id: "verdana",   name: "Verdana",                  stack: 'Verdana,Geneva,sans-serif' },
    { id: "tahoma",    name: "Tahoma",                   stack: 'Tahoma,Geneva,sans-serif' },
    { id: "trebuchet", name: "Trebuchet MS",             stack: '"Trebuchet MS",Tahoma,sans-serif' },
    { id: "cairo",     name: "Cairo (Arabic)",           stack: '"Cairo","Segoe UI",Tahoma,sans-serif' },
    { id: "tajawal",   name: "Tajawal (Arabic)",         stack: '"Tajawal","Segoe UI",Tahoma,sans-serif' },
    { id: "mono",      name: "Monospace (fixed digits)", stack: 'ui-monospace,"Cascadia Code","Courier New",Consolas,Menlo,monospace' },
    { id: "courier",   name: "Courier New",              stack: '"Courier New",Courier,monospace' },
    { id: "times",     name: "Times New Roman",          stack: '"Times New Roman",Times,serif' },
    { id: "georgia",   name: "Georgia",                  stack: 'Georgia,"Palatino Linotype",serif' }
  ];
  /* v221: exactly 15 curated title/font colors with strong contrast on light title panels. */
  var TITLE_COLORS = [
    { value: "#0f172a", name: "Slate" },
    { value: "#1e3a8a", name: "Navy" },
    { value: "#1d4ed8", name: "Blue" },
    { value: "#3730a3", name: "Indigo" },
    { value: "#6d28d9", name: "Violet" },
    { value: "#86198f", name: "Purple" },
    { value: "#9d174d", name: "Berry" },
    { value: "#be123c", name: "Rose" },
    { value: "#b91c1c", name: "Red" },
    { value: "#9a3412", name: "Rust" },
    { value: "#92400e", name: "Amber" },
    { value: "#3f6212", name: "Olive" },
    { value: "#166534", name: "Green" },
    { value: "#115e59", name: "Teal" },
    { value: "#155e75", name: "Cyan" }
  ];
  function applyUiTheme(t) {
    if (!t) return;
    var r = document.documentElement.style;
    r.setProperty("--brand", t.brand);
    r.setProperty("--brand-2", t.brand2 || t.brand);
    r.setProperty("--brand-lt", t.brandLt || t.brand);
    r.setProperty("--brand-soft", t.soft || "#eff6ff");
    r.setProperty("--brand-soft-2", t.soft2 || "#dbeafe");
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", t.brand2 || t.brand);
  }
  function applyUiFont(f) {
    if (!f) return;
    document.documentElement.style.setProperty("--font", f);
    document.documentElement.style.setProperty("--font-display", f);
  }
  function applyTitleColor(color) {
    var valid = TITLE_COLORS.some(function (x) { return x.value === color; });
    var c = valid ? color : "#1e3a8a";
    var r = document.documentElement.style;
    r.setProperty("--title-color", c);
    r.setProperty("--title-bg", shadeHex(c, 0.94));
    r.setProperty("--title-bg-2", shadeHex(c, 0.89));
    r.setProperty("--title-border", shadeHex(c, 0.72));
  }
  function shadeHex(hex, pct) {
    /* lighten (+) / darken (-) a hex color by percent */
    try {
      var m = hex.replace("#", "");
      if (m.length === 3) m = m.split("").map(function (c) { return c + c; }).join("");
      var n = parseInt(m, 16);
      var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
      function ch(c) { return Math.max(0, Math.min(255, Math.round(c + (pct > 0 ? (255 - c) : c) * pct))); }
      return "#" + ((1 << 24) + (ch(r) << 16) + (ch(g) << 8) + ch(b)).toString(16).slice(1);
    } catch (e) { return hex; }
  }
  function currentTheme() {
    var s = getSettings();
    if (s.uiTheme && s.uiTheme.custom) return s.uiTheme;
    var base = THEMES.filter(function (x) { return x.id === (s.uiTheme && s.uiTheme.id || "classic"); })[0] || THEMES[0];
    return base;
  }
  function buildThemeStudioHtml() {
    var swatches = THEMES.map(function (t) {
      return '<button type="button" class="ts-swatch" data-theme="' + t.id + '" title="' + t.name + '">' +
        '<span style="background:linear-gradient(135deg,' + t.brand + ' 0%, ' + t.brand2 + ' 55%, ' + t.brandLt + ' 100%)"></span>' +
        '<b>' + t.name + "</b></button>";
    }).join("");
    var fonts = FONT_STACKS.map(function (f) { return '<option value="' + f.id + '">' + f.name + "</option>"; }).join("");
    var titleColors = TITLE_COLORS.map(function (c) {
      return '<button type="button" class="title-color-swatch" data-title-color="' + c.value + '" title="' + c.name + '" aria-label="' + c.name + '" style="background:' + c.value + '"></button>';
    }).join("");
    var pdfRows = PDF_OPTS.map(function (o) {
      return '<label class="chk pdf-opt-chk-l" style="display:flex;align-items:center;gap:8px;font-size:12.5px;padding:3px 0">' +
        '<input type="checkbox" class="pdf-opt-chk" data-key="' + o.key + '" checked /><span>' + o.label + "</span></label>";
    }).join("");
    return (
      '<div class="ts-label">THEME</div>' +
      '<div class="ts-themes">' + swatches + "</div>" +
      '<div class="ts-label">CUSTOM BRAND COLOR</div>' +
      '<div class="ts-pickers"><label aria-label="Brand color" title="Brand color"><input type="color" id="ts-brand" aria-label="Brand color" title="Brand color" /></label>' +
      '<span class="hint" style="margin:0">Shades & backgrounds derive automatically</span></div>' +
      '<div class="ts-label">FONT</div>' +
      '<select class="input" id="ts-font">' + fonts + "</select>" +
      '<div class="ts-label">TITLE / FONT COLOR · لون العناوين</div>' +
      '<div class="title-color-grid" role="group" aria-label="Title font color">' + titleColors + "</div>" +
      '<div class="title-color-preview">Title Preview · معاينة العنوان</div>' +
      '<div class="ts-label">APPEARANCE</div>' +
      '<div class="ts-pickers"><label class="chk"><input type="checkbox" id="ts-dark" /> Night mode \uD83C\uDF19</label></div>' +
      '<div class="ts-label">PDF EXPORT</div>' +
      '<div class="pdf-opts-box">' + pdfRows + "</div>" +
      '<div class="ts-label">TOOLS</div>' +
      '<div class="hub-actions">' +
        '<button type="button" class="btn btn-secondary" id="hub-paste">\uD83D\uDCE5 Paste Coordinates (WhatsApp)</button>' +
        '<button type="button" class="btn btn-secondary" id="hub-specs">\uD83D\uDCCB Specifications</button>' +
      "</div>"
    );
  }

  function ensureSettingsHub() {
    if ($("settings-hub-modal")) { wireSettingsHub(); return; }
    var m = document.createElement("div");
    m.id = "settings-hub-modal";
    m.className = "modal-backdrop hidden";
    m.innerHTML =
      '<div class="modal" role="dialog" aria-modal="true" style="max-width:520px;max-height:86vh;overflow:auto">' +
        '<h3 style="font-size:15px">\u2699\uFE0F Settings</h3>' +
        '<div id="settings-hub-body">' + buildThemeStudioHtml() + "</div>" +
        '<div class="modal-actions" style="margin-top:14px">' +
          '<button type="button" class="btn btn-primary" id="settings-hub-close">Done</button>' +
        "</div>" +
      "</div>";
    document.body.appendChild(m);
    $("settings-hub-close").addEventListener("click", function () { m.classList.add("hidden"); });
    m.addEventListener("click", function (e) { if (e.target === m) m.classList.add("hidden"); });
    wireSettingsHub();
  }
  function wireSettingsHub() {
    var card = $("settings-hub-body");
    if (!card || card.dataset.wired === "1") { refreshSettingsHub(); return; }
    card.dataset.wired = "1";
    var pick = $("ts-brand"), fsel = $("ts-font"), dchk = $("ts-dark");
    function markSwatch() {
      var s = getSettings();
      card.querySelectorAll(".ts-swatch").forEach(function (x) {
        var active = s.uiTheme ? (!s.uiTheme.custom && s.uiTheme.id === x.getAttribute("data-theme")) : x.getAttribute("data-theme") === "classic";
        x.classList.toggle("active", !!active);
      });
    }
    function markTitleColor() {
      var selected = getSettings().titleColor || "#1e3a8a";
      card.querySelectorAll(".title-color-swatch").forEach(function (x) {
        var active = x.getAttribute("data-title-color") === selected;
        x.classList.toggle("active", active);
        x.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
    card.querySelectorAll(".title-color-swatch").forEach(function (b) {
      b.addEventListener("click", function () {
        var color = b.getAttribute("data-title-color");
        var s = getSettings();
        s.titleColor = color;
        saveSettings(s);
        applyTitleColor(color);
        markTitleColor(); scheduleSave();
        toastSafe("تم تطبيق لون العناوين", "ok");
      });
    });
    card.querySelectorAll(".ts-swatch").forEach(function (b) {
      b.addEventListener("click", function () {
        var t = THEMES.filter(function (x) { return x.id === b.getAttribute("data-theme"); })[0];
        var s = getSettings();
        s.uiTheme = { id: t.id, custom: false };
        saveSettings(s);
        applyUiTheme(t);
        if (pick) pick.value = t.brand;
        markSwatch(); scheduleSave();
        toastSafe("\u062A\u0645 \u062A\u0637\u0628\u064A\u0642 \u062B\u064A\u0645 " + t.name, "ok");
      });
    });
    if (pick) pick.addEventListener("input", function () {
      var base = pick.value;
      var t = { id: "custom", name: "Custom", custom: true,
        brand: shadeHex(base, -0.12), brand2: base, brandLt: shadeHex(base, 0.18),
        soft: shadeHex(base, 0.93), soft2: shadeHex(base, 0.82) };
      var s = getSettings();
      s.uiTheme = t;
      saveSettings(s);
      applyUiTheme(t);
      markSwatch(); scheduleSave();
    });
    if (fsel) fsel.addEventListener("change", function () {
      var f = FONT_STACKS.filter(function (x) { return x.id === fsel.value; })[0];
      var s = getSettings();
      s.uiFont = f.id;
      saveSettings(s);
      applyUiFont(f.stack); scheduleSave();
      toastSafe("\u062A\u0645 \u062A\u0637\u0628\u064A\u0642 \u0627\u0644\u062E\u0637: " + f.name, "ok");
    });
    if (dchk) dchk.addEventListener("change", function () {
      applyTheme(dchk.checked ? "dark" : "light");
      var s = getSettings();
      s.theme = dchk.checked ? "dark" : "light";
      saveSettings(s); scheduleSave();
    });
    /* tools inside hub */
    var hp = $("hub-paste"), hs2 = $("hub-specs");
    if (hp && !hp.dataset.wired) {
      hp.dataset.wired = "1";
      hp.addEventListener("click", function () {
        $("settings-hub-modal").classList.add("hidden");
        setTimeout(openPasteImport, 120);
      });
    }
    if (hs2 && !hs2.dataset.wired) {
      hs2.dataset.wired = "1";
      hs2.addEventListener("click", function () {
        $("settings-hub-modal").classList.add("hidden");
        setTimeout(openSpecs, 120);
      });
    }
    /* PDF export toggles live here now */
    card.querySelectorAll(".pdf-opt-chk").forEach(function (c) {
      c.addEventListener("change", function () {
        var s = getSettings();
        s.pdfOpts = s.pdfOpts || {};
        s.pdfOpts[c.getAttribute("data-key")] = c.checked;
        saveSettings(s);
        applyPdfOptsGlobal();
        scheduleSave();
      });
    });
    markSwatch();
    refreshSettingsHub();
  }
  function refreshSettingsHub() {
    var s = getSettings();
    var pick = $("ts-brand"), fsel = $("ts-font"), dchk = $("ts-dark");
    var cur = currentTheme();
    if (pick) pick.value = cur.brand || "#1d4ed8";
    if (fsel) fsel.value = s.uiFont || "default";
    if (dchk) dchk.checked = s.theme === "dark";
    var po = s.pdfOpts || {};
    document.querySelectorAll("#settings-hub-modal .pdf-opt-chk").forEach(function (c) {
      c.checked = po[c.getAttribute("data-key")] !== false;
    });
    var card = $("settings-hub-body");
    if (card) {
      card.querySelectorAll(".ts-swatch").forEach(function (x) {
        var active = s.uiTheme ? (!s.uiTheme.custom && s.uiTheme.id === x.getAttribute("data-theme")) : x.getAttribute("data-theme") === "classic";
        x.classList.toggle("active", !!active);
      });
      card.querySelectorAll(".title-color-swatch").forEach(function (x) {
        var active = x.getAttribute("data-title-color") === (s.titleColor || "#1e3a8a");
        x.classList.toggle("active", active);
        x.setAttribute("aria-pressed", active ? "true" : "false");
      });
    }
  }
  function openSettingsHub() {
    ensureSettingsHub();
    refreshSettingsHub();
    $("settings-hub-modal").classList.remove("hidden");
  }


  var acBox = null;   /* v175: صندوق الإكمال التلقائي — يستخدمه محرك الخلايا العام */



  window.__qcExports = {
    excel: function () { return exportExcel(); },
    csv: function () { return exportCSV(); },
    all3: function () { return exportAllThreeReports(); },
    pack: function () { return exportFullPack(); },
    selected: function (pages) { return exportSelectedReports(pages); }
  };


  function insertPhotoOptionsCard() {
    var sc = $("view-sc"); if (!sc || $("photo-options-card")) return;
    var stack = sc.querySelector(".stack"); if (!stack) return;
    var card = document.createElement("section");
    card.className = "card"; card.id = "photo-options-card";
    card.innerHTML =
      '<div class="card-hd"><h2>Photo Options</h2></div>' +
      '<div class="card-bd">' +
        '<label class="chk" style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" class="feat-dual" /> <span>Dual-photo confirm</span></label>' +
        '<label class="chk" style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" class="feat-attach" checked /> <span>Attach photos in PDF</span></label>' +
        '<label class="chk" style="display:flex;gap:8px;align-items:center;padding:4px 0"><input type="checkbox" class="feat-ask-photo" checked /> <span>Ask before saving photo</span></label>' +
        '<p class="hint">\u062A\u0646\u0637\u0628\u0642 \u0639\u0644\u0649 \u0635\u0648\u0631 \u0627\u0644\u0643\u0627\u0645\u064A\u0631\u0627 (OCR) \u0648\u0635\u0648\u0631 \u0627\u0644\u0627\u062A\u062C\u0627\u0647\u0627\u062A \u0648\u0627\u0644\u0645\u0631\u0641\u0642\u0627\u062A</p>' +
      "</div>";
    /* place right before Point Photos card (photo-related grouping) */
    var host = $("dir-photos-card");
    if (host && host.parentNode) host.parentNode.insertBefore(card, host);
    else stack.appendChild(card);
    /* sync from settings */
    var s = getSettings();
    var d = card.querySelector(".feat-dual"), a = card.querySelector(".feat-attach"), q = card.querySelector(".feat-ask-photo");
    if (d) d.checked = !!s.dualMode;
    if (a) a.checked = s.attachPhotos !== false;
    if (q) q.checked = s.askSavePhoto !== false;
    function save() {
      var s2 = getSettings();
      s2.dualMode = d ? !!d.checked : false;
      s2.attachPhotos = a ? a.checked : true;
      s2.askSavePhoto = q ? q.checked : true;
      saveSettings(s2);
      scheduleSave();
    }
    [d, a, q].forEach(function (c) { if (c) c.addEventListener("change", save); });
  }

  window.__qcScheduleSave = function () { try { scheduleSave(); } catch (e) {} };

  function ensureExportsLast() {
    ["view-ts", "view-ls", "view-sc", "view-gnss"].forEach(function(id) {
      var view = $(id); if (!view) return;
      var stack = view.querySelector(".stack") || view;
      var bar = stack.querySelector(":scope > .export-bar") || view.querySelector(".export-bar");
      if (bar && bar.parentNode === stack && stack.lastElementChild !== bar) stack.appendChild(bar);
    });
  }

  function bootFeatures() {
    applyPdfOptsGlobal();
    insertSessionTimerCard();
    tickSessionTimer(false);
    insertDirPhotosCard();
    insertPhotoOptionsCard();
    insertGpsCard();
    /* apply saved theme/font FIRST so it's never lost on reload */
    try {
      var __s0 = getSettings();
      if (__s0.uiTheme) applyUiTheme(__s0.uiTheme.custom ? __s0.uiTheme : (THEMES.filter(function (x) { return x.id === __s0.uiTheme.id; })[0] || null));
      if (__s0.uiFont) { var __f0 = FONT_STACKS.filter(function (x) { return x.id === __s0.uiFont; })[0]; if (__f0) applyUiFont(__f0.stack); }
      applyTitleColor(__s0.titleColor || "#1e3a8a");
    } catch (eT0) {}

    insertQcRangeCard();
    insertBlocksMapCard();
    injectSetupTools();
    ensureExportsLast();
    setTimeout(ensureExportsLast, 250);
    setTimeout(ensureExportsLast, 1200);
    setInterval(tickSessionTimer, 1000);
    /* background-proof alarm: browsers throttle timers to ~1/min in hidden tabs.
       A chain of timeouts wakes us at the right second, and a visibility handler
       re-syncs instantly when the tab comes back. */
    (function alarmLoop() {
      var st = getTimerState();
      var delay = 1500;
      if (st.running && st.targetMin > 0 && !st.notified) {
        var remaining = st.targetMin * 60000 - (Date.now() - st.startEpoch);
        delay = remaining > 2500 ? Math.min(30000, Math.max(1500, remaining - 1200)) : 900;
      }
      setTimeout(function () { tickSessionTimer(false); alarmLoop(); }, delay);
    })();
    document.addEventListener("visibilitychange", function () {
      if (!document.hidden) tickSessionTimer(true);
    });
    try {
      wrapRenderSetups();
      wrapParsers();
      wrapPdfExports();
      wrapOpenOcrModal();
      wireUI();
      setTimeout(function () {
        var ok = restoreDraft();
        if (!ok) { setSavePill("", "Autosave on"); setTimeout(restoreEmergencyJournal, 120); }
        try { sessionStorage.removeItem("qcSkipExitSave"); } catch (eSkip) {}
        drawENMap();
        applyQcToleranceStyles();
        renderPhotoThumbs();
        renderHistory();
      }, 60);
      setInterval(function () {
        if (Date.now() - lastSaveAt > 5000) saveDraftNow();
      }, 5000);
      /* الفحص الذاتي: لا يعمل تلقائياً إلا بطلب (?selftest=1 أو qcDebug) — لتقليل ضجيج الكونسول */
      var qcWantTest = false;
      try { qcWantTest = /(\?|&)selftest=1/.test(location.search) || !!localStorage.getItem("qcDebug"); } catch (e) {}
      if (qcWantTest) setTimeout(function(){ try { window.QC_SELFTEST && window.QC_SELFTEST(); } catch(e){} }, 800);
    } catch (e) {
      console.error("features boot failed", e);
    }
  }
  window.QC_SELFTEST = function () {
    var report = { ok: true, missing: [], notes: [] };
    ["view-ts","view-ls","view-sc","pdf-download","sc-export-bar","crop-modal"].forEach(function (id) {
      if (!document.getElementById(id)) { report.ok = false; report.missing.push(id); }
    });
    ["jspdf","Tesseract","XLSX","JSZip"].forEach(function (g) {
      if (g === "jspdf" && !(window.jspdf || window.jsPDF)) { report.ok=false; report.missing.push(g); }
      else if (g === "Tesseract" && !window.Tesseract) report.notes.push("Tesseract not loaded yet");
      else if (g === "XLSX" && !window.XLSX) { report.ok=false; report.missing.push(g); }
      else if (g === "JSZip" && !window.JSZip) { report.ok=false; report.missing.push(g); }
    });
    ["saveDraftNow","exportExcel","drawENMap","clearStaticInputsOnly"].forEach(function (fn) {
      if (!window.qcFeatures || typeof window.qcFeatures[fn] !== "function") { report.ok=false; report.missing.push("qcFeatures."+fn); }
    });
    console.log("QC_SELFTEST", report);
    return report;
  };


  /* =====================================================================
     v175 — محرك الخلايا العام: نسخ / لصق / ملء / إكمال تلقائي
     يعمل على كل خلية في كل صفحة (جداول أو بطاقات) بأسلوب تفويضي على
     مستوى المستند، لذلك يغطي الحقول المُنشأة dynamically بعد أي re-render.
     ===================================================================== */
  var GP_SKIP = "#paste-modal, #ocr-modal, #pdf-modal, #crop-modal, #specs-modal, #settings-modal, #qc-ent-modal";

  function gpEditable(el) {
    if (!el) return false;
    var t = el.tagName;
    if (t !== "INPUT" && t !== "TEXTAREA" && t !== "SELECT") return false;
    if (t === "SELECT") {
      try { var rr = el.getBoundingClientRect(); if (rr.width < 4 || rr.height < 4) return false; } catch (e) {}
      return !el.disabled;
    }
    if (t === "TEXTAREA") return !el.readOnly && !el.disabled;
    var ty = (el.type || "text").toLowerCase();
    if (ty === "file" || ty === "checkbox" || ty === "radio" || ty === "button" || ty === "submit" || ty === "reset") return false;
    if (el.readOnly || el.disabled) return false;
    try {
      var cs = getComputedStyle(el);
      if (cs.display === "none" || cs.visibility === "hidden" || parseFloat(cs.opacity) < 0.05) return false;
      var r = el.getBoundingClientRect();
      if (r.width < 4 || r.height < 4) return false;
    } catch (e) {}
    return true;
  }
  function gpCells(root) {
    return Array.prototype.filter.call(root.querySelectorAll("input,textarea,select"), gpEditable);
  }

  /* يبني شبكة الخلايا المحيطة بالحقل: صفوف × أعمدة */
  function gpGrid(input) {
    var table = input.closest ? input.closest("table") : null;
    var rows = [], rowEls = [], kind = "table", rowEl = null;
    if (table) {
      var body = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table;
      Array.prototype.forEach.call(body.rows, function (tr) { rows.push(gpCells(tr)); rowEls.push(tr); });
    } else {
      kind = "cards";
      rowEl = input.closest(".card") || input.closest(".form-grid") || input.parentElement;
      if (!rowEl) return { rows: [], rowEls: [], r: -1, c: -1, kind: kind, rowEl: null };
      var parent = rowEl.parentElement;
      Array.prototype.forEach.call(parent ? parent.children : [rowEl], function (ch) {
        if (ch === rowEl || (ch.tagName === rowEl.tagName && ch.className === rowEl.className && gpCells(ch).length)) {
          rows.push(gpCells(ch)); rowEls.push(ch);
        }
      });
      if (!rows.length) { rows.push(gpCells(rowEl)); rowEls.push(rowEl); }
    }
    var rIdx = -1, cIdx = -1;
    for (var i = 0; i < rows.length; i++) {
      var j = rows[i].indexOf(input);
      if (j >= 0) { rIdx = i; cIdx = j; break; }
    }
    return { rows: rows, rowEls: rowEls, r: rIdx, c: cIdx, kind: kind, rowEl: rowEl };
  }

  /* تفكيك النص الملصوق: صفوف (أسطر) × أعمدة (تاب/فاصلة/مسافات) */
  function gpSplit(text) {
    var lines = String(text || "").replace(/\r/g, "").split("\n").filter(function (l) { return l.trim() !== ""; });
    return lines.map(function (line) {
      var t = line.replace(/ /g, " ");
      function cl(sep, re) { return t.indexOf(sep) >= 0 ? t.split(re).map(function (v) { return v.trim(); }) : null; }
      var r = cl("\t", "\t") || cl(",", ",") || cl(";", ";") || (/\s{2,}/.test(t) ? t.split(/\s{2,}/).map(function (v) { return v.trim(); }) : null);
      if (r) return r;
      var one = t.trim();
      var parts = one.split(/\s+/);
      /* مسافة واحدة تفصل بين قيمتين فقط إذا كانت كل القطع أرقاماً (إحداثيات منسوخة) */
      if (parts.length > 1 && parts.every(function (p) { return /^[+-]?[\d.,]+$/.test(p); })) return parts;
      return [one];
    });
  }

  /* سطر واحد: قد تكون الفاصلة عشرية لا فاصل أعمدة — لا نفصل إلا بقرينة واضحة */
  function gpParse(text, target) {
    var rows = gpSplit(text);
    if (rows.length === 1 && rows[0].length > 1) {
      var raw = String(text).replace(/^[\s\u00A0]+|[\s\u00A0]+$/g, "");
      var noOther = raw.indexOf("\t") < 0 && raw.indexOf(";") < 0 && !/\s/.test(raw);
      var parts = raw.split(",");
      if (noOther && parts.length === 2 && /^[+-]?\d{1,6}$/.test(parts[1].trim())) rows = [[raw]];
      else if (noOther && parts.length === 2 && /[\u0660-\u0669]/.test(raw)) rows = [[raw]];
    }
    return rows;
  }

  function gpLatinDigits(s) {
    return String(s == null ? "" : s)
      .replace(/[٠-٩]/g, function (d) { return String(d.charCodeAt(0) - 0x0660); })
      .replace(/[۰-۹]/g, function (d) { return String(d.charCodeAt(0) - 0x06F0); });
  }
  /* توحيد الأرقام: فاصلة عربية/أوروبية، آلاف، إشارة سالبة عربية */
  function gpNormNum(v) {
    var s = gpLatinDigits(v).replace(/[ \s]/g, "").replace(/٬/g, "").replace(/٫/g, ".").replace(/[‒–—−]/g, "-");
    if (/^[+-]?\d{1,3}(\.\d{3})+,\d+$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^[+-]?\d{1,3}(,\d{3})+\.\d+$/.test(s)) s = s.replace(/,/g, "");
    else if (/^[+-]?\d+,\d+$/.test(s)) s = s.replace(",", ".");
    else if (/^[+-]?\d{1,3}(\.\d{3}){2,}$/.test(s)) s = s.replace(/\./g, "");
    else if (/^[+-]?\d{1,3}(,\d{3}){2,}$/.test(s)) s = s.replace(/,/g, "");
    return s;
  }
  function gpIsNumeric(el) {
    if (!el) return false;
    if ((el.type || "") === "number") return true;
    if (String(el.getAttribute("inputmode") || "").toLowerCase() === "decimal") return true;
    var f = String(el.getAttribute("data-f") || el.getAttribute("data-k") || el.id || "").toLowerCase();
    return /easting|northing|elevation|^e$|^n$|^z$|latitude|longitude|lat|lon|height|elev|azimuth|distance|reading|offset|scale|coord|channel|pdop|hrs|sats/.test(f);
  }
  function gpSet(cell, value) {
    var v = gpIsNumeric(cell) ? gpNormNum(value) : String(value == null ? "" : value);
    cell.value = v;
    try { cell.dispatchEvent(new Event("input", { bubbles: true })); } catch (e) {}
    try { cell.dispatchEvent(new Event("change", { bubbles: true })); } catch (e) {}
  }

  /* v258 Smart zero entry:
     A formatted seed such as 0 / 0.0000 remains visible as a valid default, but
     the first click/tap selects it and the first typed digit replaces it. This
     avoids values such as 0123.45 without destructively clearing untouched cells. */
  function gpZeroSeed(el) {
    if (!el || el.tagName === "SELECT" || !gpIsNumeric(el)) return false;
    var s = gpNormNum(el.value);
    return /^[-+]?0*(?:\.0*)?$/.test(s) && s !== "";
  }
  function gpSelectZero(el) {
    if (!gpZeroSeed(el)) return false;
    /* input[type=number] supports select() in Chromium but intentionally throws
       for setSelectionRange(), so keep these operations independent. */
    try { if (el.select) el.select(); } catch (e) {}
    try { if (el.setSelectionRange) el.setSelectionRange(0, String(el.value || "").length); } catch (e2) {}
    try { el.setAttribute("data-gp-zero-armed", "1"); } catch (e3) {}
    return true;
  }

  /* إضافة صف عند اللصق بعد آخر صف — يدعم صفوف التوتال وأقسام الليزر */
  function gpKey(input) {
    return [input.getAttribute("data-s"), input.getAttribute("data-r"), input.getAttribute("data-sec"),
            input.getAttribute("data-qc"), input.getAttribute("data-q"), input.getAttribute("data-f"),
            input.getAttribute("data-k"), input.id, input.name].join("|");
  }
  function gpFindByKey(key) {
    var p = String(key).split("|");
    var el = null;
    if (p[0] !== "" && p[1] !== "" && p[5]) el = document.querySelector('input[data-s="' + p[0] + '"][data-r="' + p[1] + '"][data-f="' + p[5] + '"]');
    if (!el && p[2] !== "" && p[5]) el = document.querySelector('input[data-sec="' + p[2] + '"][data-f="' + p[5] + '"]');
    if (!el && p[7]) el = document.getElementById(p[7]);
    return el;
  }
  function gpAddRow(input, neededIdx) {
    var key = gpKey(input), again = null;
    if (input.hasAttribute && input.hasAttribute("data-r")) {
      var si = +(input.getAttribute("data-s") || 0);
      var s = arr(window.setups)[si];
      if (!s) return null;
      while (s.rows.length <= neededIdx) s.rows.push({ id: "", easting: "", northing: "", elevation: "", remark: "" });
      if (typeof window.renderSetups === "function") window.renderSetups();
      again = gpFindByKey(key);
      return again ? (gpGrid(again).rows || [])[neededIdx] || null : null;
    }
    if (input.hasAttribute && input.hasAttribute("data-sec")) {
      if (!window.sections) return null;
      var __secs = ensureArrayGlobal("sections"); while (__secs.length <= neededIdx) __secs.push({ name: "", date: "", block: "", area: "", scan: "" });
      if (typeof window.renderSections === "function") window.renderSections();
      again = gpFindByKey(key);
      return again ? (gpGrid(again).rows || [])[neededIdx] || null : null;
    }
    return null;
  }

  function gpPasteRows(input, matrix) {
    var g = gpGrid(input);
    if (g.r < 0) return 0;
    var n = 0;
    for (var i = 0; i < matrix.length; i++) {
      var row = g.rows[g.r + i];
      if (!row) { row = gpAddRow(input, g.r + i); if (!row) break; }
      if (g.kind === "cards" && row.length !== g.rows[g.r].length) break;
      for (var j = 0; j < matrix[i].length; j++) {
        var cell = row[g.c + j];
        if (!cell) break;
        gpSet(cell, matrix[i][j]);
        n++;
      }
    }
    if (n) { scheduleSave(); try { drawENMap(); } catch (e) {} }
    return n;
  }

  /* ---------------- الحافظة ---------------- */
  function gpExecCopy(text) {
    try {
      var ta = document.createElement("textarea");
      ta.value = text; ta.setAttribute("readonly", "");
      ta.style.cssText = "position:fixed;top:0;left:-9999px;opacity:0";
      document.body.appendChild(ta);
      ta.select(); ta.setSelectionRange(0, text.length);
      var ok = document.execCommand("copy");
      ta.remove();
      return !!ok;
    } catch (e) { return false; }
  }
  function gpWriteClip(text, done) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      try {
        navigator.clipboard.writeText(text).then(function () { done(true); }, function () { done(gpExecCopy(text)); });
        return;
      } catch (e) {}
    }
    done(gpExecCopy(text));
  }
  function gpCopyFrom(el, mode) {
    var g = gpGrid(el), text = String(el.value || ""), cnt = 1;
    if (mode === "row" && g.r >= 0) {
      text = (g.rows[g.r] || []).map(function (c) { return c.value; }).join("\t");
      cnt = (g.rows[g.r] || []).length;
    } else if (mode === "column") {
      var out = [];
      for (var i = 0; i < g.rows.length; i++) if (g.rows[i][g.c]) out.push(g.rows[i][g.c].value);
      text = out.join("\n"); cnt = out.length;
    }
    gpWriteClip(text, function (ok) {
      if (!ok) { toastSafe("تعذر النسخ — انسخ يدوياً", "load"); return; }
      toastSafe(mode === "cell" ? "نُسخت القيمة" : ("نُسخ " + cnt + " قيمة"), "ok");
    });
    return text;
  }

  /* ملء للأسفل من الخلية الحالية */
  function gpFillDown(input, lastIdx) {
    var g = gpGrid(input);
    if (g.r < 0) return 0;
    var val = input.value, n = 0;
    for (var i = g.r + 1; i <= lastIdx && i < g.rows.length; i++) {
      var cell = g.rows[i][g.c];
      if (!cell) break;
      gpSet(cell, val); n++;
    }
    if (n) { scheduleSave(); try { drawENMap(); } catch (e) {} }
    return n;
  }
  function gpFillFromAbove(el) {
    var g = gpGrid(el);
    if (g.r <= 0 || !g.rows[g.r - 1] || !g.rows[g.r - 1][g.c]) { toastSafe("لا توجد قيمة فوقها", "load"); return 0; }
    gpSet(el, g.rows[g.r - 1][g.c].value);
    scheduleSave();
    toastSafe("مُلئت من الأعلى", "ok");
    return 1;
  }

  /* ---------------- مقبض الملء للأسفل (كل الصفحات) ---------------- */
  var gpHandle = null, gpHandleFor = null;
  function gpHideHandle() {
    if (gpHandle && gpHandle.parentNode) gpHandle.parentNode.removeChild(gpHandle);
    gpHandle = null; gpHandleFor = null;
    qsa(".fill-target").forEach(function (t) { t.classList.remove("fill-target"); });
  }
  function gpShowHandle(input) {
    gpHideHandle();
    var g = gpGrid(input);
    if (g.r < 0) return;
    var has = false;
    for (var i = g.r + 1; i < g.rows.length; i++) if (g.rows[i][g.c]) { has = true; break; }
    var growable = !!(input.hasAttribute && (input.hasAttribute("data-r") || input.hasAttribute("data-sec")));
    if (!has && !growable) return;
    gpHandleFor = input;
    var h = document.createElement("div");
    h.className = "fill-handle";
    h.textContent = "↓";
    h.title = "اسحب للأسفل لملء القيمة";
    document.body.appendChild(h);
    gpHandle = h;
    var ir = input.getBoundingClientRect();
    h.style.left = Math.max(2, Math.min(window.innerWidth - 26, ir.right - 16)) + "px";
    h.style.top = (ir.bottom - 14) + "px";

    function rowAt(y) {
      var el = document.elementFromPoint(ir.left + Math.min(20, ir.width / 2), y);
      if (!el) return -1;
      var tr = el.closest ? (el.closest("tr") || el.closest(".card")) : null;
      return tr ? g.rowEls.indexOf(tr) : -1;
    }
    var dragging = false, lastIdx = -1;
    h.addEventListener("pointerdown", function (e) {
      e.preventDefault(); e.stopPropagation();
      dragging = true; lastIdx = -1;
      function move(ev) {
        if (!dragging) return;
        var idx = rowAt(ev.clientY);
        if (idx > g.r) lastIdx = idx;
        qsa(".fill-target").forEach(function (t) { t.classList.remove("fill-target"); });
        if (lastIdx >= 0 && g.rowEls[lastIdx]) g.rowEls[lastIdx].classList.add("fill-target");
      }
      function up() {
        dragging = false;
        window.removeEventListener("pointermove", move);
        window.removeEventListener("pointerup", up);
        window.removeEventListener("pointercancel", up);
        var n = lastIdx >= 0 ? gpFillDown(input, lastIdx) : gpFillDown(input, g.r + 1);
        gpHideHandle();
        if (n) toastSafe("مُلئت " + n + " خلية للأسفل", "ok");
      }
      window.addEventListener("pointermove", move);
      window.addEventListener("pointerup", up);
      window.addEventListener("pointercancel", up);
    });
    h.addEventListener("click", function () {
      var n = gpFillDown(input, g.r + 1);
      gpHideHandle();
      if (n) toastSafe("مُلئت الخلية التالية", "ok");
    });
  }

  /* ---------------- إكمال تلقائي من القيم السابقة (كل الصفحات) ---------------- */
  var GP_HIST_KEY = "qc_input_history_v221";
  var GP_POINTS_KEY = "qc_point_library_v221";
  var gpHist = {};
  var gpPointLib = [];
  var gpAcIndex = -1, gpAcSuppressUntil = 0;
  function gpLoadJson(key, fallback) { try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; } catch (e) { return fallback; } }
  function gpSaveJson(key, value) { try { localStorage.setItem(key, JSON.stringify(value)); } catch (e) {} }
  gpHist = gpLoadJson(GP_HIST_KEY, {});
  gpPointLib = gpLoadJson(GP_POINTS_KEY, []);

  function gpHistKey(input) {
    return String(input.getAttribute("data-f") || input.getAttribute("data-k") || input.id || input.name || input.className || "misc").toLowerCase();
  }
  function gpFieldContext(input) {
    var bits = [input.getAttribute("data-f"), input.getAttribute("data-k"), input.id, input.name,
      input.getAttribute("placeholder"), input.getAttribute("aria-label")];
    try {
      var td = input.closest("td"), tr = input.closest("tr"), table = input.closest("table");
      if (td && tr && table) {
        var idx = Array.prototype.indexOf.call(tr.children, td), head = table.querySelector("thead tr");
        if (head && head.children[idx]) bits.push(head.children[idx].textContent);
      }
      var label = input.closest("label,.field,.gn-field,.form-field");
      if (label) bits.push(label.textContent.slice(0, 90));
    } catch (e) {}
    return bits.filter(Boolean).join(" ").toLowerCase().replace(/[_-]+/g, " ");
  }
  function gpRole(input) {
    var c = gpFieldContext(input);
    if (/(^|\s)(easting|east|coord e|fixed e|measured e|\be\b)(\s|$)/.test(c)) return "e";
    if (/(^|\s)(northing|north|coord n|fixed n|measured n|\bn\b)(\s|$)/.test(c)) return "n";
    if (/(elevation|elev|height|level|\brl\b|coord z|fixed z|measured z|\bz\b)/.test(c)) return "z";
    if (/(remark|description|note)/.test(c)) return "remark";
    if (!/(project|site name|surveyor|observer|supervisor|device|report|id gs|id cs|serial|receiver|tag of)/.test(c) && /(point|station|target|benchmark|control|(^|\s)id(\s|$)|pointid|point id)/.test(c)) return "id";
    return "";
  }
  function gpRowMap(input) {
    var g = gpGrid(input), row = g.r >= 0 ? (g.rows[g.r] || []) : [];
    if (!row.length) row = gpCells(input.closest(".card,.form-grid") || document);
    var out = {};
    row.forEach(function (el) { var r = gpRole(el); if (r && !out[r]) out[r] = el; });
    return out;
  }
  function gpRemember(input) {
    if (!gpEditable(input) || gpIsNumeric(input)) return;
    var k = gpHistKey(input), v = String(input.value || "").trim();
    if (!v || v.length > 80) return;
    var list = gpHist[k] || (gpHist[k] = []), old = list.indexOf(v);
    if (old >= 0) list.splice(old, 1);
    list.unshift(v);
    if (list.length > 20) list.length = 20;
    gpSaveJson(GP_HIST_KEY, gpHist);
  }
  function gpCurrentProject() {
    var ids = ["ts-project","ls-project","sc-project"], v = "";
    for (var i = 0; i < ids.length; i++) { var el = document.getElementById(ids[i]); if (el && String(el.value || "").trim()) { v = String(el.value).trim(); break; } }
    if (!v) { var gn = document.querySelector('#view-gnss [data-k="projectName"]'); if (gn) v = String(gn.value || "").trim(); }
    if (!v) try { v = localStorage.getItem("qc_current_project_v223") || ""; } catch (e) {}
    return v || "Global";
  }
  function gpRememberPoint(input) {
    var map = gpRowMap(input), id = map.id && String(map.id.value || "").trim();
    if (!id) return;
    var rec = { id: id, e: map.e ? gpNormNum(map.e.value) : "", n: map.n ? gpNormNum(map.n.value) : "",
      z: map.z ? gpNormNum(map.z.value) : "", remark: map.remark ? String(map.remark.value || "").trim() : "",
      project: gpCurrentProject(), used: 1, updatedAt: new Date().toISOString() };
    if (!rec.e && !rec.n && !rec.z && !rec.remark) return;
    var key = id.toLocaleUpperCase(), at = -1;
    for (var i = 0; i < gpPointLib.length; i++) if (String(gpPointLib[i].id).toLocaleUpperCase() === key && String(gpPointLib[i].project || "Global") === rec.project) { at = i; break; }
    if (at >= 0) {
      var old = gpPointLib[at];
      rec.e = rec.e || old.e || ""; rec.n = rec.n || old.n || ""; rec.z = rec.z || old.z || "";
      rec.remark = rec.remark || old.remark || ""; rec.used = (old.used || 0) + 1;
      gpPointLib.splice(at, 1);
    }
    gpPointLib.unshift(rec);
    if (gpPointLib.length > 750) gpPointLib.length = 750;
    gpSaveJson(GP_POINTS_KEY, gpPointLib);
  }
  function gpApplyPoint(input, rec) {
    var map = gpRowMap(input);
    [["id", rec.id], ["e", rec.e], ["n", rec.n], ["z", rec.z], ["remark", rec.remark]].forEach(function (x) {
      if (map[x[0]] && x[1] !== "" && x[1] != null) gpSet(map[x[0]], x[1]);
    });
    rec.used = (rec.used || 0) + 1; rec.updatedAt = new Date().toISOString();
    gpPointLib.sort(function (a, b) { return (b.used || 0) - (a.used || 0) || String(b.updatedAt).localeCompare(String(a.updatedAt)); });
    gpSaveJson(GP_POINTS_KEY, gpPointLib); scheduleSave();
    try { drawENMap(); } catch (e) {}
    toastSafe("تمت تعبئة النقطة " + rec.id + " تلقائياً", "ok");
  }
  function gpHideAc() { if (acBox) { acBox.remove(); acBox = null; } gpAcIndex = -1; }
  function gpAcSelect(idx) {
    if (!acBox) return;
    var items = acBox.querySelectorAll(".id-sug-item");
    if (!items.length) return;
    gpAcIndex = (idx + items.length) % items.length;
    Array.prototype.forEach.call(items, function (b, i) { b.classList.toggle("active", i === gpAcIndex); });
    try { items[gpAcIndex].scrollIntoView({ block: "nearest" }); } catch (e) {}
  }
  function gpChooseAc(input, button) {
    if (!button) return;
    var pi = button.getAttribute("data-point-index");
    if (pi !== null) gpApplyPoint(input, gpPointLib[+pi]);
    else gpSet(input, button.getAttribute("data-v") || "");
    gpAcSuppressUntil = Date.now() + 250;
    gpRemember(input); gpHideAc();
  }
  function gpPositionAc(input) {
    if (!acBox || !input || !input.getBoundingClientRect) return;
    var ir = input.getBoundingClientRect();
    acBox.style.left = Math.max(4, Math.min(window.innerWidth - Math.min(340, window.innerWidth - 8), ir.left)) + "px";
    acBox.style.top = Math.max(4, Math.min(window.innerHeight - acBox.offsetHeight - 8, ir.bottom + 5)) + "px";
  }
  function gpShowAc(input) {
    if (Date.now() < gpAcSuppressUntil) return;
    if (gpIsNumeric(input) || input.tagName === "TEXTAREA") { gpHideAc(); return; }
    var v = String(input.value || "").trim().toLocaleLowerCase();
    var isPoint = gpRole(input) === "id", html = "", predicted = "";
    if (!isPoint && v.length < 1) { gpHideAc(); return; }
    if (isPoint) {
      var gg = gpGrid(input), prev = gg.r > 0 && gg.rows[gg.r - 1] ? gg.rows[gg.r - 1][gg.c] : null;
      var pm = prev && String(prev.value || "").match(/^(.*?)(\d+)$/);
      if (pm) predicted = pm[1] + String(+pm[2] + 1).padStart(pm[2].length, "0");
      var hits = gpPointLib.map(function (x, i) { return { x: x, i: i }; }).filter(function (o) {
        return !v || String(o.x.id).toLocaleLowerCase().indexOf(v) >= 0;
      }).sort(function (a, b) {
        var project = gpCurrentProject(), ap = String(a.x.project || "Global") === project ? 1 : 0, bp = String(b.x.project || "Global") === project ? 1 : 0;
        var aa = String(a.x.id).toLocaleLowerCase().indexOf(v) === 0 ? 1 : 0, bb = String(b.x.id).toLocaleLowerCase().indexOf(v) === 0 ? 1 : 0;
        return bp - ap || bb - aa || (b.x.used || 0) - (a.x.used || 0);
      }).slice(0, 8);
      if (hits.length || predicted) html = '<div class="id-sug-title">Saved points · النقاط المحفوظة</div>' + (predicted && predicted.toLocaleLowerCase() !== v ? '<button type="button" class="id-sug-item point-suggestion predicted-point" data-v="' + esc(predicted) + '"><b>↳ ' + esc(predicted) + '</b><i>Next point name · الاسم التالي</i></button>' : '') + hits.map(function (o) {
        var q = o.x, coords = [q.e, q.n, q.z].filter(function (x) { return x !== "" && x != null; }).join(" · ");
        return '<button type="button" class="id-sug-item point-suggestion" data-point-index="' + o.i + '"><b>' + esc(q.id) + '</b>' +
          (coords ? '<span>' + esc(coords) + '</span>' : '') + (q.remark || q.project ? '<i>' + esc([q.project && ('Project: ' + q.project), q.remark].filter(Boolean).join(' · ')) + '</i>' : '') + '</button>';
      }).join("");
    }
    if (!html) {
      var arr = gpHist[gpHistKey(input)] || [];
      var vals = arr.filter(function (x) { return x.toLocaleLowerCase().indexOf(v) >= 0 && x.toLocaleLowerCase() !== v; }).slice(0, 7);
      if (!vals.length) { gpHideAc(); return; }
      html = vals.map(function (hv) { return '<button type="button" class="id-sug-item" data-v="' + esc(hv) + '">' + esc(hv) + '</button>'; }).join("");
    }
    gpHideAc(); acBox = document.createElement("div"); acBox.className = "id-suggest ac-box"; acBox.innerHTML = html;
    acBox.__input = input;
    document.body.appendChild(acBox);
    gpPositionAc(input);
    acBox.querySelectorAll(".id-sug-item").forEach(function (b) { b.addEventListener("pointerdown", function (ev) { ev.preventDefault(); gpChooseAc(input, b); }); });
    gpAcSelect(0);
  }
  function gpSeedHistory() {
    try {
      arr(window.setups).forEach(function (s) {
        (s.rows || []).forEach(function (r) {
          if (r.id && (r.easting || r.northing || r.elevation || r.remark)) {
            var fake = { id:r.id, e:r.easting || "", n:r.northing || "", z:r.elevation || "", remark:r.remark || "", project:gpCurrentProject(), used:1, updatedAt:new Date().toISOString() };
            var exists = gpPointLib.some(function (p) { return String(p.id).toLocaleUpperCase() === String(fake.id).toLocaleUpperCase(); });
            if (!exists) gpPointLib.push(fake);
          }
        });
      });
      gpSaveJson(GP_POINTS_KEY, gpPointLib);
    } catch (e) {}
  }
  window.__qcPointLibrary = {
    list: function () { return gpPointLib.slice(); },
    clear: function () { gpPointLib = []; gpSaveJson(GP_POINTS_KEY, gpPointLib); },
    exportJson: function () { return JSON.stringify(gpPointLib, null, 2); },
    roleOf: function (el) { return gpRole(el); },
    suggest: function (el) { gpShowAc(el); }
  };

  function gpFocusCell(cell) {
    if (!cell) return false;
    try { cell.focus({ preventScroll: true }); } catch (e) { cell.focus(); }
    try { cell.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" }); } catch (e2) {}
    try { if (cell.select && cell.tagName !== "SELECT") cell.select(); } catch (e3) {}
    return true;
  }
  function gpMoveCell(input, mode, reverse) {
    var g = gpGrid(input); if (g.r < 0) return false;
    var r = g.r, c = g.c, target = null;
    if (mode === "vertical") {
      r += reverse ? -1 : 1;
      if (r >= g.rows.length && !reverse) {
        var added = gpAddRow(input, r); if (added) { g = gpGrid(gpFindByKey(gpKey(input)) || input); }
      }
      target = g.rows[r] && (g.rows[r][c] || g.rows[r][g.rows[r].length - 1]);
    } else {
      c += reverse ? -1 : 1;
      if (c < 0) { r--; c = r >= 0 ? g.rows[r].length - 1 : -1; }
      if (c >= (g.rows[r] || []).length) { r++; c = 0; }
      if (r >= g.rows.length && !reverse) {
        var row = gpAddRow(input, r); if (row) target = row[0];
      } else target = g.rows[r] && g.rows[r][c];
    }
    return gpFocusCell(target);
  }

  var gpQuickBar = null, gpQuickFor = null;
  function gpHideQuick() { if (gpQuickBar && gpQuickBar.parentNode) gpQuickBar.remove(); gpQuickBar = null; gpQuickFor = null; }
  /* A focused grid field can leave the floating quick-entry bar over export
     controls at the bottom of a long form. Scrolling means the user has moved
     on, so dismiss the bar rather than intercepting the next control. */
  document.addEventListener("scroll", gpHideQuick, true);
  function gpPasteClipboard(input) {
    if (!(navigator.clipboard && navigator.clipboard.readText)) { toastSafe("استخدم Ctrl+V أو الضغط المطوّل للصق", "load"); return; }
    navigator.clipboard.readText().then(function (text) {
      if (!text || !text.trim()) return;
      var rows = gpParse(text, input), n = rows.length === 1 && rows[0].length === 1 ? (gpSet(input, rows[0][0]), 1) : gpPasteRows(input, rows);
      scheduleSave(); toastSafe("لُصقت " + n + " خلية", "ok");
    }).catch(function () { toastSafe("اسمح بقراءة الحافظة أو استخدم Ctrl+V", "load"); });
  }
  function gpShowQuick(input) {
    gpHideQuick(); gpQuickFor = input;
    var b = document.createElement("div"); b.className = "gp-quick-entry";
    b.innerHTML = '<button type="button" data-gp="copy">⧉ <span>Copy</span></button>' +
      '<button type="button" data-gp="paste">▣ <span>Paste</span></button>' +
      '<button type="button" data-gp="next">→ <span>Next</span></button>' +
      '<button type="button" data-gp="down">↓ <span>Down</span></button>';
    document.body.appendChild(b); gpQuickBar = b;
    b.addEventListener("pointerdown", function (e) { e.preventDefault(); });
    b.addEventListener("click", function (e) {
      var bt = e.target.closest("button"); if (!bt) return;
      var a = bt.getAttribute("data-gp");
      if (a === "copy") gpCopyFrom(input, "cell");
      else if (a === "paste") gpPasteClipboard(input);
      else if (a === "next") gpMoveCell(input, "linear", false);
      else if (a === "down") gpMoveCell(input, "vertical", false);
    });
  }

  /* ---------------- Editable option cells / selects ----------------
     Native <select> controls only accept predefined options. Every populated
     select now also exposes “Type custom value…”. Desktop users can simply
     focus a select and start typing; mobile users choose the custom option. */
  var QC_SELECT_CUSTOM="__qc_custom_value__", QC_SELECT_KEY="qc_custom_select_values_v258";
  function qcSelectStore(){try{return JSON.parse(localStorage.getItem(QC_SELECT_KEY)||"{}")||{}}catch(e){return{}}}
  function qcSelectId(el){return el.id||[el.closest&&el.closest("main,.page,.cv-panel,.qe-pane")&&el.closest("main,.page,.cv-panel,.qe-pane").id,el.getAttribute("data-k"),el.getAttribute("data-f"),el.name].filter(Boolean).join("|")||"select-"+Array.prototype.indexOf.call(document.querySelectorAll("select"),el)}
  function qcSaveSelectCustom(el,value){var s=qcSelectStore(),k=qcSelectId(el),a=s[k]||[];a=a.filter(function(x){return x!==value});a.unshift(value);s[k]=a.slice(0,25);try{localStorage.setItem(QC_SELECT_KEY,JSON.stringify(s))}catch(e){}}
  function qcAddCustomOption(el,value,selectIt){if(!el||!value)return null;var found=Array.prototype.find.call(el.options,function(o){return o.value===value});if(!found){found=document.createElement("option");found.value=value;found.textContent=value;found.setAttribute("data-qc-user-option","1");var trig=el.querySelector('option[data-qc-custom-trigger]');el.insertBefore(found,trig||null)}if(selectIt)el.value=value;return found}
  function qcSelectIsConstrained(el){var id=String(el.id||""),k=String(el.getAttribute("data-k")||"");return /^(cv-|sp-|gps-zone$|ts-font$|timer-target$|paste-dest$|device-template$|sc-(lon|lat)-h$|gn-(zone|csv|csv2))/.test(id)||/^(status|zoneNumber)$/.test(k)}
  function qcEnhanceSelect(el){if(!el||el.tagName!=="SELECT"||el.multiple)return;if(el.getAttribute("data-qc-no-custom")==="1"){el.setAttribute("data-qc-no-custom-auto","1");el.title=el.title||"Fixed options";return}if(qcSelectIsConstrained(el)){el.setAttribute("data-qc-no-custom-auto","1");el.title=el.title||"Fixed calculation options";return}if(el.querySelector('option[data-qc-custom-trigger]'))return;var real=Array.prototype.filter.call(el.options,function(o){return !o.hasAttribute("data-qc-custom-trigger")});if(!real.length)return;var saved=qcSelectStore()[qcSelectId(el)]||[];saved.slice().reverse().forEach(function(v){qcAddCustomOption(el,v,false)});var o=document.createElement("option");o.value=QC_SELECT_CUSTOM;o.textContent="✎ Type custom value…";o.setAttribute("data-qc-custom-trigger","1");el.appendChild(o);el.setAttribute("data-qc-editable-select","1")}
  function qcEnhanceAllSelects(root){Array.prototype.forEach.call((root||document).querySelectorAll? (root||document).querySelectorAll("select"):[],qcEnhanceSelect)}
  function qcOpenSelectEditor(el,seed){if(!el)return;var old=$("qc-select-editor");if(old)old.remove();var prev=el.__qcPreviousValue!=null?el.__qcPreviousValue:(el.value===QC_SELECT_CUSTOM?"":el.value);var m=document.createElement("div");m.id="qc-select-editor";m.className="modal-backdrop";m.innerHTML='<div class="modal" role="dialog" aria-modal="true" style="max-width:460px"><h3 style="margin-top:0">Type custom value</h3><p class="muted" style="margin-top:0">Enter a value not found in the option list. It will be saved on this device and used exactly as written.</p><input id="qc-select-custom-input" class="input qc-english-entry" type="text" lang="en-GB" dir="ltr" style="width:100%;font-size:18px;font-weight:700" autocomplete="off"><div id="qc-select-custom-error" style="min-height:22px;color:#dc2626;font-weight:700;margin-top:6px"></div><div class="modal-actions" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end"><button type="button" class="btn btn-secondary" id="qc-select-custom-remove">Remove selected custom</button><button type="button" class="btn btn-secondary" id="qc-select-custom-cancel">Cancel</button><button type="button" class="btn btn-primary" id="qc-select-custom-apply">Use value</button></div></div>';document.body.appendChild(m);var inp=$("qc-select-custom-input");inp.value=seed!=null?seed:(prev||"");function cancel(){el.value=prev||"";m.remove()}$("qc-select-custom-cancel").onclick=cancel;$("qc-select-custom-remove").onclick=function(){var cur=prev&&Array.prototype.find.call(el.options,function(o){return o.value===prev&&o.hasAttribute("data-qc-user-option")});if(cur){cur.remove();var s=qcSelectStore(),k=qcSelectId(el);s[k]=(s[k]||[]).filter(function(x){return x!==prev});try{localStorage.setItem(QC_SELECT_KEY,JSON.stringify(s))}catch(e){}}el.value="";el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));m.remove()};function apply(){var v=String(inp.value||"").trim();if(!v||v===QC_SELECT_CUSTOM){$("qc-select-custom-error").textContent="Enter a custom value first.";return}qcAddCustomOption(el,v,true);qcSaveSelectCustom(el,v);el.__qcPreviousValue=v;el.dispatchEvent(new Event("input",{bubbles:true}));el.dispatchEvent(new Event("change",{bubbles:true}));scheduleSave();m.remove()}$("qc-select-custom-apply").onclick=apply;inp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();apply()}else if(e.key==="Escape")cancel()});try{inp.focus();inp.setSelectionRange(inp.value.length,inp.value.length)}catch(e){}}
  function qcInstallEditableSelects(){qcEnhanceAllSelects(document);var mo=new MutationObserver(function(ms){ms.forEach(function(m){if(m.target&&m.target.tagName==="SELECT")qcEnhanceSelect(m.target);Array.prototype.forEach.call(m.addedNodes||[],function(n){if(n.nodeType!==1)return;if(n.tagName==="SELECT")qcEnhanceSelect(n);qcEnhanceAllSelects(n)})})});mo.observe(document.documentElement,{childList:true,subtree:true});document.addEventListener("pointerdown",function(e){var el=e.target;if(el&&el.tagName==="SELECT")el.__qcPreviousValue=el.value},true);document.addEventListener("focusin",function(e){var el=e.target;if(el&&el.tagName==="SELECT"&&el.value!==QC_SELECT_CUSTOM)el.__qcPreviousValue=el.value},true);document.addEventListener("change",function(e){var el=e.target;if(!el||el.tagName!=="SELECT")return;if(el.value===QC_SELECT_CUSTOM){e.preventDefault();e.stopImmediatePropagation();qcOpenSelectEditor(el,"")}else el.__qcPreviousValue=el.value},true);document.addEventListener("keydown",function(e){var el=e.target;if(!el||el.tagName!=="SELECT"||e.ctrlKey||e.metaKey||e.altKey||e.key.length!==1)return;e.preventDefault();e.stopImmediatePropagation();qcOpenSelectEditor(el,e.key)},true)}

  /* ---------------- Smart manual date/time editor ----------------
     Native date/time controls are read-only pickers on several mobile browsers.
     This editor guarantees Latin manual entry while preserving the underlying
     ISO value expected by autosave, calculations and exports. */
  function qcNormalizeDateTime(raw, type) {
    var s = gpLatinDigits(raw).trim().replace(/[\/.]/g, "-").replace(/\s+/g, "");
    if (type === "date") {
      var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
      if (!m) { var d = s.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/); if (d) m = [d[0], d[3], d[2], d[1]]; }
      if (!m) throw Error("Use YYYY-MM-DD, for example 2026-10-06.");
      var y=+m[1], mo=+m[2], da=+m[3], x=new Date(Date.UTC(y,mo-1,da));
      if (x.getUTCFullYear()!==y || x.getUTCMonth()!==mo-1 || x.getUTCDate()!==da) throw Error("Invalid calendar date.");
      return String(y).padStart(4,"0")+"-"+String(mo).padStart(2,"0")+"-"+String(da).padStart(2,"0");
    }
    var t=s.replace(/-/g,":").match(/^(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?$/);
    if (!t || +t[1]>23 || +t[2]>59 || +(t[3]||0)>59) throw Error("Use HH:MM in 24-hour format, for example 14:35.");
    return String(+t[1]).padStart(2,"0")+":"+String(+t[2]).padStart(2,"0")+(t[3]!=null?":"+String(+t[3]).padStart(2,"0"):"");
  }
  function qcOpenDateTimeEditor(target) {
    if (!target) return;
    var editbar=document.querySelector('.qc-mobile-editbar');if(editbar)editbar.classList.remove('show');
    var type=(target.type||"").toLowerCase(); if(type!=="date"&&type!=="time")return;
    var old=$("qc-datetime-modal"); if(old)old.remove();
    var m=document.createElement("div");m.id="qc-datetime-modal";m.className="modal-backdrop";
    m.innerHTML='<div class="modal" role="dialog" aria-modal="true" style="max-width:430px">'+
      '<h3 style="margin-top:0">'+(type==="date"?'Enter Date':'Enter Time')+'</h3>'+
      '<p class="muted" style="margin-top:0">'+(type==="date"?'Type YYYY-MM-DD or DD-MM-YYYY using Latin digits.':'Type HH:MM using 24-hour Latin digits.')+'</p>'+
      '<input id="qc-datetime-value" class="input qc-english-entry" type="text" inputmode="numeric" lang="en-GB" dir="ltr" style="width:100%;font-size:20px;font-weight:700;text-align:center" placeholder="'+(type==="date"?'YYYY-MM-DD':'HH:MM')+'" value="'+esc(target.value||"")+'">'+
      '<div id="qc-datetime-error" style="min-height:22px;color:#dc2626;font-weight:700;margin-top:6px"></div>'+
      '<div class="modal-actions" style="display:flex;gap:8px;flex-wrap:wrap;justify-content:flex-end">'+
      '<button type="button" class="btn btn-secondary" id="qc-datetime-current">'+(type==="date"?'Today':'Now')+'</button><button type="button" class="btn btn-secondary" id="qc-datetime-clear">Clear</button><button type="button" class="btn btn-secondary" id="qc-datetime-cancel">Cancel</button><button type="button" class="btn btn-primary" id="qc-datetime-apply">Apply</button></div></div>';
    document.body.appendChild(m);var inp=$("qc-datetime-value");
    function close(){try{m.remove()}catch(e){}}
    $("qc-datetime-cancel").onclick=close;
    $("qc-datetime-clear").onclick=function(){target.value="";target.dispatchEvent(new Event("input",{bubbles:true}));target.dispatchEvent(new Event("change",{bubbles:true}));close()};
    $("qc-datetime-current").onclick=function(){var now=new Date();inp.value=type==="date"?now.getFullYear()+"-"+String(now.getMonth()+1).padStart(2,"0")+"-"+String(now.getDate()).padStart(2,"0"):String(now.getHours()).padStart(2,"0")+":"+String(now.getMinutes()).padStart(2,"0")};
    function apply(){try{target.value=qcNormalizeDateTime(inp.value,type);target.dispatchEvent(new Event("input",{bubbles:true}));target.dispatchEvent(new Event("change",{bubbles:true}));scheduleSave();close()}catch(e){$("qc-datetime-error").textContent=e.message||e}}
    $("qc-datetime-apply").onclick=apply;inp.addEventListener("keydown",function(e){if(e.key==="Enter"){e.preventDefault();apply()}else if(e.key==="Escape")close()});
    setTimeout(function(){inp.focus();inp.select()},30);
  }

  /* ---------------- ربط الأحداث (تفويضي على المستند) ---------------- */
  var gpCellEngineOn = false;
  function gpInstallCellEngine() {
    if (gpCellEngineOn) return;
    gpCellEngineOn = true;

    /* Mobile-safe date/time entry: use a guaranteed manual editor rather than a
       device picker that may render bold/read-only and refuse keyboard input. */
    document.addEventListener("click", function(e){
      var el=e.target;if(!el||el.tagName!=="INPUT")return;var t=(el.type||"").toLowerCase();
      if(t!=="date"&&t!=="time")return;if(el.closest&&el.closest("#qc-datetime-modal"))return;if(document.getElementById("qc-datetime-modal"))return;
      e.preventDefault();e.stopPropagation();qcOpenDateTimeEditor(el);
    },true);
    document.addEventListener("pointerdown",function(e){
      var el=e.target,t=el&&el.tagName==="INPUT"?String(el.type||"").toLowerCase():"";
      if((t!=="date"&&t!=="time")||(el.closest&&el.closest("#qc-datetime-modal"))||document.getElementById("qc-datetime-modal"))return;
      e.preventDefault();e.stopPropagation();qcOpenDateTimeEditor(el);
    },true);

    /* Keep zero defaults safe, but make them frictionless to replace. `beforeinput`
       is the fallback for mobile browsers that collapse a selection on pointer-up. */
    document.addEventListener("beforeinput", function (e) {
      var el = e.target;
      if (!gpEditable(el) || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
      if (el.closest && el.closest(GP_SKIP)) return;
      if (el.getAttribute("data-gp-zero-armed") !== "1" || !gpZeroSeed(el)) return;
      if (/^insert(?:Text|CompositionText|ReplacementText)$/.test(String(e.inputType || ""))) {
        /* Number inputs do not reliably expose selectionStart/selectionEnd.
           Clear the zero seed unconditionally so Tab/focus and pointer entry
           both replace 0 / 0.0000 instead of appending tiny decimals. */
        el.value = ""; /* let this same keystroke insert normally */
        el.removeAttribute("data-gp-zero-armed");
      }
    }, true);

    document.addEventListener("pointerup", function (e) {
      var el = e.target;
      if (!gpEditable(el) || el.tagName === "TEXTAREA" || el.tagName === "SELECT") return;
      if (el.closest && el.closest(GP_SKIP)) return;
      if (gpZeroSeed(el)) { gpSelectZero(el); setTimeout(function () { if (document.activeElement === el && gpZeroSeed(el)) gpSelectZero(el); }, 0); }
    }, true);

    document.addEventListener("paste", function (e) {
      var el = e.target;
      if (!el || !gpEditable(el) || el.tagName === "TEXTAREA") return;
      if (el.closest && el.closest(GP_SKIP)) return;
      if (el.classList && el.classList.contains("dms-seg")) return; /* لحقول DMS معالجها الخاص */
      var text = "";
      try { text = (e.clipboardData || window.clipboardData).getData("text"); } catch (err) {}
      if (!text || !text.trim()) return;
      var rows = gpParse(text, el);
      var single = rows.length === 1 && rows[0].length === 1;
      if (single) {
        if (gpIsNumeric(el)) {
          e.preventDefault(); e.stopPropagation();
          gpSet(el, rows[0][0]);
          scheduleSave();
          toastSafe("لُصق الرقم وتوحيده", "ok");
        }
        return; /* غير ذلك: السلوك الطبيعي للمتصفح */
      }
      e.preventDefault(); e.stopPropagation();
      var n = gpPasteRows(el, rows);
      if (n) toastSafe("لُصقت " + n + " خلية — راجعها", "ok");
      else toastSafe("تعذر اللصق هنا — لا خلايا كافية", "load");
    }, true);

    document.addEventListener("keydown", function (e) {
      var el = document.activeElement;
      if (!gpEditable(el) || el.tagName === "TEXTAREA") return;
      if (el.closest && el.closest(GP_SKIP)) return;
      var k = String(e.key || "").toLowerCase();
      if (acBox && (k === "arrowdown" || k === "arrowup" || k === "enter" || k === "tab" || k === "escape")) {
        e.preventDefault();
        if (k === "arrowdown") gpAcSelect(gpAcIndex + 1);
        else if (k === "arrowup") gpAcSelect(gpAcIndex - 1);
        else if (k === "escape") gpHideAc();
        else gpChooseAc(el, acBox.querySelectorAll(".id-sug-item")[Math.max(0, gpAcIndex)]);
        return;
      }
      if (!(e.ctrlKey || e.metaKey)) {
        if (k === "enter") { gpRemember(el); gpRememberPoint(el); if (gpMoveCell(el, "linear", !!e.shiftKey)) e.preventDefault(); }
        else if (k === "tab") { gpRemember(el); gpRememberPoint(el); if (gpMoveCell(el, "linear", !!e.shiftKey)) e.preventDefault(); }
        else if (e.altKey && (k === "arrowdown" || k === "arrowup")) { if (gpMoveCell(el, "vertical", k === "arrowup")) e.preventDefault(); }
        else if (e.altKey && (k === "arrowright" || k === "arrowleft")) { if (gpMoveCell(el, "linear", k === "arrowleft")) e.preventDefault(); }
        return;
      }
      var sel = false;
      try { sel = el.selectionStart !== null && el.selectionStart !== el.selectionEnd; } catch (err) { sel = false; }
      if (k === "c" && !e.shiftKey && !e.altKey) {
        if (sel) return;
        e.preventDefault(); gpCopyFrom(el, "cell");
      } else if (k === "c" && e.shiftKey && !e.altKey) {
        e.preventDefault(); gpCopyFrom(el, "row");
      } else if (k === "c" && e.altKey) {
        e.preventDefault(); gpCopyFrom(el, "column");
      } else if (k === "x" && !e.shiftKey) {
        if (sel) return;
        e.preventDefault(); gpCopyFrom(el, "cell"); gpSet(el, ""); scheduleSave();
      } else if (k === "d") {
        e.preventDefault(); gpFillFromAbove(el);
      }
    }, true);

    document.addEventListener("focusin", function (e) {
      var el = e.target;
      if (!gpEditable(el) || el.tagName === "TEXTAREA") { gpHideHandle(); gpHideAc(); return; }
      if (el.closest && el.closest(GP_SKIP)) return;
      gpRemember(el);
      /* Select zero-like numeric defaults immediately; pointerup repeats this on
         touch/mouse so the browser cannot leave the caret behind the zero. */
      if (gpZeroSeed(el)) { gpSelectZero(el); setTimeout(function () { if (document.activeElement === el && gpZeroSeed(el)) gpSelectZero(el); }, 0); }
      setTimeout(function () { if (document.activeElement === el) { gpShowHandle(el); gpShowQuick(el); if (gpRole(el) === "id") gpShowAc(el); } }, 200);
    }, true);

    document.addEventListener("focusout", function (e) {
      var old = e.target;
      if (gpEditable(old)) { gpRemember(old); gpRememberPoint(old); }
      setTimeout(function () {
        var a = document.activeElement;
        if (gpHandle && a !== gpHandleFor) gpHideHandle();
        if (gpQuickBar && (!a || !gpQuickBar.contains(a)) && a !== gpQuickFor) gpHideQuick();
      }, 300);
      setTimeout(function () { if (acBox && acBox.__input === old && document.activeElement !== old) gpHideAc(); }, 200);
    }, true);

    document.addEventListener("input", function (e) {
      var el = e.target;
      if (!el || !gpEditable(el)) return;
      if (el.tagName === "TEXTAREA") return;
      if (el.closest && el.closest(GP_SKIP)) return;
      if (!gpZeroSeed(el)) el.removeAttribute("data-gp-zero-armed");
      setTimeout(function () { var cur = document.activeElement; if (gpEditable(cur) && !(cur.closest && cur.closest(GP_SKIP))) gpShowAc(cur); }, 30);
    }, true);

    document.addEventListener("change", function (e) {
      var el = e.target;
      if (!el || !gpEditable(el) || (el.closest && el.closest(GP_SKIP))) return;
      gpRemember(el); gpRememberPoint(el);
    }, true);

    /* لصق بالضغط المطوّل على الجوال (نسخة الحافظة تحتاج إذن/إيماءة) */
    var lp = null;
    document.addEventListener("pointerdown", function (e) {
      var el = e.target;
      if (!gpEditable(el) || el.tagName === "TEXTAREA" || e.pointerType === "mouse") return;
      if (el.closest && el.closest(GP_SKIP)) return;
      if (lp) clearTimeout(lp);
      lp = setTimeout(function () {
        lp = null;
        try {
          if (navigator.clipboard && navigator.clipboard.readText) {
            navigator.clipboard.readText().then(function (text) {
              if (!text || !text.trim() || document.activeElement !== el) return;
              var rows = gpParse(text, el);
              if (rows.length === 1 && rows[0].length === 1) { gpSet(el, rows[0][0]); scheduleSave(); toastSafe("لُصقت القيمة", "ok"); }
              else {
                var n = gpPasteRows(el, rows);
                if (n) toastSafe("لُصقت " + n + " خلية — راجعها", "ok");
              }
            }).catch(function () {
              toastSafe("اسمح للمتصفح بقراءة الحافظة مرة واحدة", "load");
            });
          }
        } catch (err) {}
      }, 550);
    }, true);
    ["pointerup", "pointermove", "pointercancel"].forEach(function (ev) {
      document.addEventListener(ev, function () { if (lp) { clearTimeout(lp); lp = null; } }, true);
    });

    document.addEventListener("scroll", function () { if (gpHandle) gpHideHandle(); if (acBox && acBox.__input === document.activeElement) gpPositionAc(acBox.__input); }, true);

    gpSeedHistory();
    qcInstallEditableSelects();
  }

  window.qcFeatures = {
    saveDraftNow: saveDraftNow,
    restoreDraft: restoreDraft,
    clearStaticInputsOnly: clearStaticInputsOnly,
    resetAllSaved: resetAllSaved,
    exportExcel: exportExcel,
    exportCSV: exportCSV,
    exportFullPack: exportFullPack,
    drawENMap: drawENMap,
    photoStore: photoStore
  };

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", function () { setTimeout(bootFeatures, 0); gpInstallCellEngine(); });
  else { setTimeout(bootFeatures, 0); gpInstallCellEngine(); }
  window.__qcFeaturesReady = true;
})();
