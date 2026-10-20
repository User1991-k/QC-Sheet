(function () {
  "use strict";
  var host = document.getElementById("view-gpr");
  if (!host) return;
  var KEY = "qc_gpr_logging_v258";
  function ar() {
    return document.documentElement.dir === "rtl";
  }
  function T(e, a) {
    return ar() ? a : e;
  }
  function esc(v) {
    return String(v == null ? "" : v).replace(/[&<>"']/g, function (c) {
      return {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      }[c];
    });
  }
  function clone(x) {
    return JSON.parse(JSON.stringify(x));
  }
  var initialRows = [
    {
      fileNo: "964",
      line: "C8",
      start: "C8s",
      end: "C8e",
      acquired: "39",
      direction: "E",
      comments:
        "Line shifted 10 m to the right due to dense vegetation. • Compacted gravel surface. • Rough Area",
    },
    {
      fileNo: "965",
      line: "C9",
      start: "C9s",
      end: "C9e",
      acquired: "39",
      direction: "W",
      comments: "Compacted gravel surface. • Rough Area",
    },
    {
      fileNo: "966",
      line: "L7",
      start: "L7s",
      end: "L7e",
      acquired: "31",
      direction: "N",
      comments: "Shifted 35m to left due to dense vegetation, Rough Area",
    },
    {
      fileNo: "967",
      line: "L8",
      start: "L8s",
      end: "L8e",
      acquired: "37",
      direction: "S",
      comments: "Rough Area",
    },
    {
      fileNo: "968",
      line: "C1",
      start: "C1s",
      end: "C1e",
      acquired: "21",
      direction: "E",
      comments: "Stopped because of spoil heaps, Rough Area",
    },
    {
      fileNo: "969",
      line: "C2",
      start: "C2s",
      end: "C2e",
      acquired: "21",
      direction: "W",
      comments:
        "Line shifted 2.5m to the right, stopped because of spoil heaps and tall grass",
    },
    {
      fileNo: "970",
      line: "C1",
      start: "C1s",
      end: "C1e",
      acquired: "8",
      direction: "W",
      comments: "Scanning on spoil heaps, stopped because of edge spoil heaps",
    },
    {
      fileNo: "971",
      line: "",
      start: "",
      end: "",
      acquired: "0",
      direction: "E",
      comments: "Discard",
    },
    {
      fileNo: "972",
      line: "C2",
      start: "C2s",
      end: "C2e",
      acquired: "7",
      direction: "W",
      comments: "Scanning on spoil heaps, stopped because of edge spoil heaps",
    },
    {
      fileNo: "973",
      line: "L1",
      start: "L1s",
      end: "L1e",
      acquired: "29",
      direction: "S",
      comments: "Rough Area",
    },
    {
      fileNo: "974",
      line: "",
      start: "",
      end: "",
      acquired: "0",
      direction: "W",
      comments: "Discard",
    },
    {
      fileNo: "975",
      line: "L0",
      start: "L0s",
      end: "L0e",
      acquired: "29",
      direction: "N",
      comments: "Rough Area",
    },
  ];
  function blankRow() {
    return {
      fileNo: "",
      line: "",
      start: "",
      end: "",
      acquired: "",
      direction: "",
      comments: "",
      custom: {},
    };
  }
  var S = {
    project: "CTR001",
    acquiredBy: "Mahmoud Haleem",
    location: "AB-6",
    date: "2026-10-11T00:00",
    client: "BP",
    equipmentId: "Mala HDR Pro",
    dailyRemarks: "",
    tableFontScale: 1,
    rows: clone(initialRows),
  };
  try {
    var old = JSON.parse(localStorage.getItem(KEY) || "null");
    if (old && Array.isArray(old.rows)) S = Object.assign(S, old);
  } catch (e) {}
  if (/^\d{4}-\d{2}-\d{2}$/.test(S.date || "")) S.date += "T00:00";
  S.tableFontScale = Math.max(
    0.8,
    Math.min(1.4, Number(S.tableFontScale) || 1),
  );
  function defaultColumns() {
    return [
      {
        key: "fileNo",
        type: "text",
        titleEn: "File No.",
        titleAr: "رقم الملف",
        weight: 1.1,
        builtin: true,
      },
      {
        key: "line",
        type: "text",
        titleEn: "Line",
        titleAr: "الخط",
        weight: 1,
        builtin: true,
      },
      {
        key: "start",
        type: "text",
        titleEn: "Start",
        titleAr: "البداية",
        weight: 1,
        builtin: true,
      },
      {
        key: "end",
        type: "text",
        titleEn: "End",
        titleAr: "النهاية",
        weight: 1,
        builtin: true,
      },
      {
        key: "acquired",
        type: "number",
        titleEn: "Acquired",
        titleAr: "المكتسب",
        weight: 1,
        builtin: true,
      },
      {
        key: "direction",
        type: "direction",
        titleEn: "Line Direction",
        titleAr: "اتجاه الخط",
        weight: 1.2,
        builtin: true,
      },
      {
        key: "comments",
        type: "comments",
        titleEn: "Comments",
        titleAr: "الملاحظات",
        weight: 3.8,
        builtin: true,
      },
    ];
  }
  function normalizeColumns() {
    if (!Array.isArray(S.columns) || !S.columns.length)
      S.columns = defaultColumns();
    var seen = {};
    S.columns = S.columns.filter(function (c) {
      if (!c || !c.key || seen[c.key]) return false;
      seen[c.key] = true;
      c.type =
        ["text", "number", "direction", "comments"].indexOf(c.type) >= 0
          ? c.type
          : "text";
      c.titleEn = String(c.titleEn || c.key);
      c.titleAr = String(c.titleAr || c.titleEn);
      c.weight = Math.max(
        0.6,
        Number(c.weight) || (c.type === "comments" ? 3.8 : 1),
      );
      return true;
    });
    S.rows.forEach(function (r) {
      if (!r.custom) r.custom = {};
    });
    S.tablePage = Math.max(1, parseInt(S.tablePage, 10) || 1);
    S.pageSize = Math.max(25, Math.min(250, parseInt(S.pageSize, 10) || 100));
  }
  normalizeColumns();
  function columnTitle(c) {
    return ar() ? c.titleAr : c.titleEn;
  }
  function cellValue(r, key) {
    return Object.prototype.hasOwnProperty.call(r, key)
      ? r[key]
      : (r.custom || {})[key] || "";
  }
  function setCellValue(r, key, value) {
    if (Object.prototype.hasOwnProperty.call(r, key)) r[key] = value;
    else {
      r.custom = r.custom || {};
      r.custom[key] = value;
    }
  }
  var storageWarned = false;
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S)); storageWarned = false; return true;
    } catch (e) {
      if (!storageWarned) { storageWarned = true; alert(T('Device storage is full. Export or remove some rows before continuing.', 'مساحة الجهاز ممتلئة. صدّر البيانات أو احذف بعض الأسطر قبل المتابعة.')); }
      return false;
    }
  }
  function cleanOptional() {
    host.querySelectorAll(".qc-field-optional").forEach(function (x) {
      var p = x.parentElement;
      x.remove();
      if (p && p.classList.contains("qc-field-meta") && !p.children.length)
        p.remove();
    });
  }
  function field(k, en, aa, type) {
    return (
      '<label class="gpr-field"><span>' +
      T(en, aa) +
      '</span><input type="' +
      (type || "text") +
      '" data-gpr="' +
      k +
      '" value="' +
      esc(S[k]) +
      '"></label>'
    );
  }
  function dateTimeField() {
    return (
      '<label class="gpr-field"><span>' +
      T("Date & Time", "التاريخ والوقت") +
      '</span><input type="datetime-local" class="gpr-datetime-input" data-gpr="date" value="' +
      esc(S.date) +
      '"></label>'
    );
  }
  var dirs = ["", "N", "S", "E", "W", "NE", "NW", "SE", "SW"];
  function cellHtml(r, c) {
    var v = cellValue(r, c.key),
      attr = ' data-gpr-cell="' + esc(c.key) + '"';
    if (c.type === "direction")
      return (
        '<select data-qc-no-custom="1"' +
        attr +
        ">" +
        dirs
          .map(function (d) {
            return (
              '<option value="' +
              d +
              '" ' +
              (v === d ? "selected" : "") +
              ">" +
              d +
              "</option>"
            );
          })
          .join("") +
        "</select>"
      );
    if (c.type === "comments")
      return (
        '<textarea rows="2"' +
        attr +
        ' placeholder="' +
        T("Comments…", "الملاحظات…") +
        '">' +
        esc(v) +
        "</textarea>"
      );
    return (
      '<input type="' +
      (c.type === "number" ? "number" : "text") +
      '" ' +
      (c.type === "number" ? 'step="any" ' : "") +
      attr +
      ' value="' +
      esc(v) +
      '">'
    );
  }
  function rowHtml(r, i) {
    return (
      '<tr data-gpr-row="' +
      i +
      '">' +
      S.columns
        .map(function (c) {
          return (
            '<td data-gpr-col="' + esc(c.key) + '" data-gpr-type="' + esc(c.type) + '">' + cellHtml(r, c) + "</td>"
          );
        })
        .join("") +
      '<td class="gpr-delete-cell"><button type="button" class="gpr-delete" data-gpr-action="delete" title="' +
      T("Delete row", "حذف السطر") +
      '">×</button></td></tr>'
    );
  }
  function visibleRowsHtml() {
    var pages = Math.max(1, Math.ceil(S.rows.length / S.pageSize));
    if (S.tablePage > pages) S.tablePage = pages;
    var start = (S.tablePage - 1) * S.pageSize;
    return S.rows
      .slice(start, start + S.pageSize)
      .map(function (r, local) {
        return rowHtml(r, start + local);
      })
      .join("");
  }
  function tableHeaderHtml() {
    return (
      S.columns
        .map(function (c) {
          return (
            '<th data-gpr-heading="' +
            esc(c.key) +
            '" data-gpr-type="' + esc(c.type) + '"><span>' +
            esc(columnTitle(c)) +
            "</span></th>"
          );
        })
        .join("") +
      '<th class="gpr-delete-head">' +
      T("Delete", "حذف") +
      "</th>"
    );
  }
  function columnToolsHtml() {
    var selected =
      S.selectedColumn &&
      S.columns.some(function (c) {
        return c.key === S.selectedColumn;
      })
        ? S.selectedColumn
        : S.columns[0].key;
    S.selectedColumn = selected;
    return (
      '<div class="gpr-column-tools"><b>' +
      T("Table columns", "أعمدة الجدول") +
      ' </b><select data-qc-no-custom="1" data-gpr-column-target>' +
      S.columns
        .map(function (c) {
          return (
            '<option value="' +
            esc(c.key) +
            '" ' +
            (c.key === selected ? "selected" : "") +
            ">" +
            esc(columnTitle(c)) +
            "</option>"
          );
        })
        .join("") +
      '</select><button type="button" data-gpr-action="column-left">＋← ' +
      T("Add left", "إضافة يسار") +
      '</button><button type="button" data-gpr-action="column-right">＋→ ' +
      T("Add right", "إضافة يمين") +
      '</button><button type="button" data-gpr-action="headings">✎ ' +
      T("Edit headings", "تعديل العناوين") +
      '</button><button type="button" data-gpr-action="column-delete">× ' +
      T("Delete custom", "حذف المخصص") +
      "</button></div>"
    );
  }
  function bulkToolsHtml() {
    return (
      '<div class="gpr-bulk-tools"><div><b>' +
      T("Unlimited rows", "أسطر بعدد مفتوح") +
      "</b><label>" +
      T("Count", "العدد") +
      '<input type="number" min="1" step="1" value="10" data-gpr-bulk="count"></label><button type="button" data-gpr-action="add-bulk">＋ ' +
      T("Add blank rows", "إضافة أسطر فارغة") +
      "</button></div><div><b>" +
      T("Generate Line series", "توليد تسلسل Line") +
      "</b><label>" +
      T("Prefix", "البادئة") +
      '<input value="L" data-gpr-bulk="prefix"></label><label>' +
      T("Start No.", "رقم البداية") +
      '<input type="number" step="1" value="1" data-gpr-bulk="start"></label><label>' +
      T("Count", "العدد") +
      '<input type="number" min="1" step="1" value="10" data-gpr-bulk="seriesCount"></label><button type="button" data-gpr-action="generate-lines">⚡ ' +
      T("Generate", "توليد") +
      "</button></div></div>"
    );
  }
  function paginationHtml() {
    var pages = Math.max(1, Math.ceil(S.rows.length / S.pageSize));
    return (
      '<div class="gpr-pagination"><button type="button" data-gpr-action="page-prev" ' +
      (S.tablePage <= 1 ? "disabled" : "") +
      ">←</button><span>" +
      T("Table page", "صفحة الجدول") +
      " <b>" +
      S.tablePage +
      "</b> / " +
      pages +
      '</span><button type="button" data-gpr-action="page-next" ' +
      (S.tablePage >= pages ? "disabled" : "") +
      ">→</button><label>" +
      T("Rows shown", "الأسطر المعروضة") +
      '<select data-qc-no-custom="1" data-gpr-page-size>' +
      [25, 50, 100, 250]
        .map(function (n) {
          return (
            "<option " +
            (S.pageSize === n ? "selected" : "") +
            ">" +
            n +
            "</option>"
          );
        })
        .join("") +
      "</select></label><small>" +
      T(
        "All rows remain saved and all are included in Excel/PDF.",
        "تبقى جميع الأسطر محفوظة وتدخل كلها في Excel وPDF.",
      ) +
      "</small></div>"
    );
  }
  function autoGrowComment(el) {
    if (!el) return;
    el.style.height = "auto";
    el.style.overflowY = "hidden";
    el.style.height =
      Math.max(
        el.classList.contains("gpr-daily-text") ? 92 : 34,
        el.scrollHeight + 2,
      ) + "px";
  }
  function growAllComments() {
    host
      .querySelectorAll('textarea[data-gpr-cell],[data-gpr="dailyRemarks"]')
      .forEach(autoGrowComment);
  }
  function render() {
    host.innerHTML =
      '<section class="page-head no-illu gpr-page-head"><div class="gpr-hero-copy"><span class="gpr-kicker">GPR · FIELD ACQUISITION</span><h1>' +
      T("GPR", "GPR") +
      "</h1><p>" +
      T(
        "Structured ground-penetrating radar acquisition records with offline autosave, Excel export, and verified PDF preview.",
        "سجل منظم لقياسات الرادار المخترق للأرض مع حفظ تلقائي دون اتصال وتصدير Excel ومعاينة PDF موثقة.",
      ) +
      '</p></div></section><div class="gpr-stack"><section class="gpr-card"><div class="gpr-card-head"><b>01</b><span>' +
      T("Project Information", "معلومات المشروع") +
      '</span></div><div class="gpr-card-body"><div class="gpr-meta-grid">' +
      field("project", "Project", "المشروع") +
      field("acquiredBy", "Acquired By", "منفذ القياس") +
      field("location", "Location", "الموقع") +
      dateTimeField() +
      field("client", "Client", "العميل") +
      field("equipmentId", "Equipment ID", "معرّف الجهاز") +
      '</div></div></section><section class="gpr-card"><div class="gpr-card-head"><b>02</b><span>' +
      T("GPR Acquisition Lines", "خطوط قياسات GPR") +
      '</span></div><div class="gpr-card-body"><div class="gpr-font-tools"><b>' +
      T("Table font size", "حجم خط الجدول") +
      '</b><button type="button" data-gpr-action="font-down" title="' +
      T("Decrease font", "تصغير الخط") +
      '">A−</button><output data-gpr-font-output>' +
      Math.round(S.tableFontScale * 100) +
      '%</output><button type="button" data-gpr-action="font-up" title="' +
      T("Increase font", "تكبير الخط") +
      '">A＋</button><button type="button" data-gpr-action="font-reset" title="' +
      T("Reset font size", "إعادة حجم الخط") +
      '">↺</button></div>' +
      columnToolsHtml() +
      bulkToolsHtml() +
      '<div class="gpr-table-wrap"><table class="gpr-table" style="--gpr-table-scale:' +
      S.tableFontScale + ';--gpr-column-count:' + S.columns.length +
      '"><thead><tr>' +
      tableHeaderHtml() +
      "</tr></thead><tbody>" +
      visibleRowsHtml() +
      '</tbody></table></div><div class="gpr-table-actions"><button type="button" class="btn btn-secondary" data-gpr-action="add">＋ ' +
      T("Add New Row", "إضافة سطر جديد") +
      '</button><span class="gpr-summary">' +
      T("Total rows", "إجمالي الأسطر") +
      ": <b>" +
      S.rows.length +
      "</b></span></div>" +
      paginationHtml() +
      '<label class="gpr-daily-remarks"><span>' +
      T("Daily Work Remarks", "ملاحظات عمل اليوم") +
      '</span><textarea class="gpr-daily-text" rows="4" data-gpr="dailyRemarks" placeholder="' +
      T(
        "Write general remarks about today’s GPR work…",
        "اكتب الملاحظات العامة حول عمل GPR لهذا اليوم…",
      ) +
      '">' +
      esc(S.dailyRemarks) +
      '</textarea></label></div></section><section class="gpr-card gpr-export-card"><div class="gpr-card-head"><b>03</b><span>' +
      T("Review & Export", "المراجعة والتصدير") +
      '</span></div><div class="gpr-card-body"><div class="gpr-export-actions"><button type="button" class="btn btn-secondary" data-gpr-action="excel">📊 ' +
      T("Export Excel", "تصدير Excel") +
      '</button><button type="button" class="btn btn-primary" data-gpr-action="pdf">🖨 ' +
      T("Preview / Export PDF", "معاينة / تصدير PDF") +
      "</button></div></div></section></div>";
    wire();
    requestAnimationFrame(growAllComments);
    if (window.QCDesignSystem) QCDesignSystem.scan();
    cleanOptional();
    if (window.__qcWorkspaceUI) __qcWorkspaceUI.scan();
  }
  function setTableFont(scale) {
    S.tableFontScale = Math.max(
      0.8,
      Math.min(1.4, Math.round(scale * 10) / 10),
    );
    var table = host.querySelector(".gpr-table"),
      out = host.querySelector("[data-gpr-font-output]");
    if (table) table.style.setProperty("--gpr-table-scale", S.tableFontScale);
    if (out) out.textContent = Math.round(S.tableFontScale * 100) + "%";
    save();
    setTimeout(growAllComments, 0);
  }
  function selectedColumn() {
    var key =
      (host.querySelector("[data-gpr-column-target]") || {}).value ||
      S.selectedColumn;
    return (
      S.columns.find(function (c) {
        return c.key === key;
      }) || S.columns[0]
    );
  }
  function cloneColumn(side) {
    var source = selectedColumn(),
      at = S.columns.indexOf(source),
      key =
        "custom_" + Date.now() + "_" + Math.random().toString(36).slice(2, 7);
    var c = {
      key: key,
      type: source.type,
      titleEn: "New " + source.titleEn,
      titleAr: "عمود " + source.titleAr,
      weight: source.weight,
      builtin: false,
    };
    S.columns.splice(side === "left" ? at : at + 1, 0, c);
    S.selectedColumn = key;
    S.rows.forEach(function (r) {
      r.custom = r.custom || {};
      r.custom[key] = "";
    });
    save();
    render();
  }
  function headingsEditor() {
    var old = document.getElementById("gpr-heading-modal");
    if (old) old.remove();
    var m = document.createElement("div");
    m.id = "gpr-heading-modal";
    m.className = "gpr-manager-modal";
    m.innerHTML =
      '<div class="gpr-manager-shell"><header><h2>' +
      T("Edit GPR table headings", "تعديل عناوين جدول GPR") +
      '</h2><button type="button" data-gpr-manager-close>×</button></header><div class="gpr-manager-body">' +
      S.columns
        .map(function (c, i) {
          return (
            '<div class="gpr-heading-row" data-heading-index="' +
            i +
            '"><b>' +
            (i + 1) +
            '</b><label>English<input data-heading-en value="' +
            esc(c.titleEn) +
            '"></label><label>العربية<input data-heading-ar value="' +
            esc(c.titleAr) +
            '"></label><small>' +
            T("Type", "النوع") +
            ": " +
            esc(c.type) +
            (c.builtin
              ? " · " + T("original", "أصلي")
              : " · " + T("custom", "مخصص")) +
            "</small></div>"
          );
        })
        .join("") +
      '</div><footer><button type="button" class="btn btn-secondary" data-gpr-manager-close>' +
      T("Cancel", "إلغاء") +
      '</button><button type="button" class="btn btn-primary" id="gpr-heading-save">' +
      T("Save headings", "حفظ العناوين") +
      "</button></footer></div>";
    document.body.appendChild(m);
    m.querySelectorAll("[data-gpr-manager-close]").forEach(function (b) {
      b.onclick = function () {
        m.remove();
      };
    });
    m.querySelector("#gpr-heading-save").onclick = function () {
      m.querySelectorAll("[data-heading-index]").forEach(function (r) {
        var c = S.columns[+r.dataset.headingIndex];
        c.titleEn =
          r.querySelector("[data-heading-en]").value.trim() || c.titleEn;
        c.titleAr =
          r.querySelector("[data-heading-ar]").value.trim() || c.titleAr;
      });
      save();
      m.remove();
      render();
    };
  }
  function bulkValue(k, d) {
    var e = host.querySelector('[data-gpr-bulk="' + k + '"]');
    return e ? e.value : d;
  }
  function appendRows(count, factory) {
    count = Math.floor(Number(count));
    if (!isFinite(count) || count < 1)
      return alert(T("Enter a valid row count.", "أدخل عدداً صحيحاً للأسطر."));
    if (
      count > 5000 &&
      !confirm(
        T(
          "Add " +
            count +
            " rows? The data will be saved, while the table displays it in pages for performance.",
          "إضافة " +
            count +
            " سطر؟ ستحفظ البيانات ويعرضها الجدول على صفحات للمحافظة على الأداء.",
        ),
      )
    )
      return;
    var done = 0,
      box = document.createElement("div");
    box.className = "gpr-row-progress";
    box.innerHTML =
      "<div><b>" +
      T("Adding rows…", "جارٍ إضافة الأسطر…") +
      '</b><progress max="' +
      count +
      '" value="0"></progress><span>0 / ' +
      count +
      "</span></div>";
    host.appendChild(box);
    function part() {
      var end = Math.min(count, done + 1000);
      for (; done < end; done++) S.rows.push(factory(done));
      box.querySelector("progress").value = done;
      box.querySelector("span").textContent = done + " / " + count;
      if (done < count) setTimeout(part, 0);
      else {
        S.tablePage = Math.max(1, Math.ceil(S.rows.length / S.pageSize));
        save();
        box.remove();
        render();
      }
    }
    part();
  }
  function wire() {
    host.oninput = function (e) {
      var k = e.target.dataset.gpr;
      if (k) {
        S[k] = e.target.value;
        if (k === "dailyRemarks") autoGrowComment(e.target);
        save();
        return;
      }
      var tr = e.target.closest("[data-gpr-row]"),
        cell = e.target.dataset.gprCell;
      if (tr && cell) {
        setCellValue(S.rows[+tr.dataset.gprRow], cell, e.target.value);
        if (e.target.tagName === "TEXTAREA") autoGrowComment(e.target);
        save();
      }
    };
    host.onchange = function (e) {
      host.oninput(e);
      if (e.target.matches("[data-gpr-column-target]")) {
        S.selectedColumn = e.target.value;
        save();
      }
      if (e.target.matches("[data-gpr-page-size]")) {
        S.pageSize = parseInt(e.target.value, 10) || 100;
        S.tablePage = 1;
        save();
        render();
      }
    };
    host.onclick = function (e) {
      var b = e.target.closest("[data-gpr-action]");
      if (!b) return;
      var a = b.dataset.gprAction;
      if (a === "font-down") setTableFont(S.tableFontScale - 0.1);
      if (a === "font-up") setTableFont(S.tableFontScale + 0.1);
      if (a === "font-reset") setTableFont(1);
      if (a === "column-left") cloneColumn("left");
      if (a === "column-right") cloneColumn("right");
      if (a === "headings") headingsEditor();
      if (a === "column-delete") {
        var col = selectedColumn();
        if (col.builtin)
          alert(
            T(
              "Original columns cannot be deleted; their headings can be renamed.",
              "لا يمكن حذف الأعمدة الأصلية، ويمكن تعديل عناوينها.",
            ),
          );
        else if (
          confirm(
            T(
              "Delete the custom column and its values?",
              "حذف العمود المخصص وقيمه؟",
            ),
          )
        ) {
          S.columns.splice(S.columns.indexOf(col), 1);
          S.rows.forEach(function (r) {
            if (r.custom) delete r.custom[col.key];
          });
          S.selectedColumn = S.columns[0].key;
          save();
          render();
        }
      }
      if (a === "add-bulk")
        appendRows(bulkValue("count", 10), function () {
          return blankRow();
        });
      if (a === "generate-lines") {
        var prefix = String(bulkValue("prefix", "L")),
          startNo = parseInt(bulkValue("start", 1), 10) || 1;
        appendRows(bulkValue("seriesCount", 10), function (n) {
          var r = blankRow(),
            line = prefix + (startNo + n);
          r.line = line;
          r.start = line + "s";
          r.end = line + "e";
          return r;
        });
      }
      if (a === "page-prev" && S.tablePage > 1) {
        S.tablePage--;
        save();
        render();
      }
      if (
        a === "page-next" &&
        S.tablePage < Math.ceil(S.rows.length / S.pageSize)
      ) {
        S.tablePage++;
        save();
        render();
      }
      if (a === "add") {
        S.rows.push(blankRow());
        S.tablePage = Math.max(1, Math.ceil(S.rows.length / S.pageSize));
        save();
        render();
        setTimeout(function () {
          var rows = host.querySelectorAll("[data-gpr-row]");
          if (rows.length)
            rows[rows.length - 1].scrollIntoView({
              behavior: "smooth",
              block: "center",
            });
        }, 30);
      }
      if (a === "delete") {
        var tr = b.closest("[data-gpr-row]"),
          i = +tr.dataset.gprRow;
        if (S.rows.length === 1) S.rows[0] = blankRow();
        else S.rows.splice(i, 1);
        save();
        render();
      }
      if (a === "excel") exportExcel();
      if (a === "pdf") {
        if (window.__qcOpenPdfModal)
          window.__qcOpenPdfModal("gpr", "GPR_Data_Acquisition_Log");
        else exportPdf("GPR_Data_Acquisition_Log");
      }
    };
  }
  async function exportExcel() {
    var X = window.XLSX || (window.__qcNeed && (await window.__qcNeed("XLSX")));
    if (!X)
      return alert(T("Excel engine is unavailable.", "محرك Excel غير متاح."));
    var colCount = S.columns.length,
      data = [
        ["GPR Data Acquisition Log"],
        [],
        ["Project:", S.project, "", "Acquired By:", S.acquiredBy],
        [
          "Location:",
          S.location,
          "",
          "Date & Time:",
          String(S.date || "").replace("T", " "),
        ],
        ["Client:", S.client, "", "Equipment ID:", S.equipmentId],
        ["Daily Work Remarks:", S.dailyRemarks],
        [],
      ],
      headerRow = data.length;
    data.push(
      S.columns.map(function (c) {
        return c.titleEn;
      }),
    );
    S.rows.forEach(function (r) {
      data.push(
        S.columns.map(function (c) {
          var v = cellValue(r, c.key);
          return c.type === "number" && v !== "" && isFinite(Number(v))
            ? Number(v)
            : v;
        }),
      );
    });
    var ws = X.utils.aoa_to_sheet(data),
      lastCol = X.utils.encode_col(Math.max(0, colCount - 1));
    ws["!merges"] = [
      { s: { r: 0, c: 0 }, e: { r: 0, c: Math.max(0, colCount - 1) } },
      { s: { r: 5, c: 1 }, e: { r: 5, c: Math.max(1, colCount - 1) } },
    ];
    ws["!cols"] = S.columns.map(function (c) {
      return {
        wch:
          c.type === "comments" ? 62 : Math.max(12, Math.round(13 * c.weight)),
      };
    });
    ws["!autofilter"] = {
      ref:
        "A" +
        (headerRow + 1) +
        ":" +
        lastCol +
        Math.max(headerRow + 1, data.length),
    };
    ws["!rows"] = [];
    ws["!rows"][5] = {
      hpt: Math.min(
        180,
        Math.max(22, Math.ceil(String(S.dailyRemarks || "").length / 90) * 15),
      ),
    };
    S.rows.forEach(function (r, i) {
      var longest = 0;
      S.columns.forEach(function (c) {
        longest = Math.max(
          longest,
          String(cellValue(r, c.key) || "").length / Math.max(1, c.weight),
        );
      });
      ws["!rows"][headerRow + 1 + i] = {
        hpt: Math.min(180, Math.max(18, Math.ceil(longest / 60) * 15)),
      };
    });
    var wb = X.utils.book_new();
    X.utils.book_append_sheet(wb, ws, "GPR_Log");
    var settings = [
      [
        "Column Order",
        "English Heading",
        "Arabic Heading",
        "Type",
        "Original / Custom",
      ],
    ];
    S.columns.forEach(function (c, i) {
      settings.push([
        i + 1,
        c.titleEn,
        c.titleAr,
        c.type,
        c.builtin ? "Original" : "Custom",
      ]);
    });
    var sw = X.utils.aoa_to_sheet(settings);
    sw["!cols"] = [
      { wch: 14 },
      { wch: 28 },
      { wch: 28 },
      { wch: 16 },
      { wch: 18 },
    ];
    X.utils.book_append_sheet(wb, sw, "Column Setup");
    var name = String(S.project || "GPR").replace(/[^a-zA-Z0-9._-]+/g, "_");
    X.writeFile(wb, "GPR_Log_" + name + ".xlsx");
  }
  function pdfHeader(d, continuation, pageW) {
    d.setTextColor(15, 23, 42);
    d.setFont("helvetica", "bold");
    d.setFontSize(16);
    d.text("GPR DATA ACQUISITION LOG", 14, 15);
    d.setFontSize(11);
    d.text("FIELD LOGGING SHEET", 14, 22);
    d.setFontSize(9);
    if (continuation) {
      d.setFontSize(7);
      d.setTextColor(49, 46, 129);
      d.text("CONTINUATION · SAME PROJECT / DAY", pageW - 14, 22, {
        align: "right",
      });
    }
    d.setDrawColor(49, 46, 129);
    d.line(14, 26, pageW - 14, 26);
  }
  function pdfMeta(d, pageW) {
    var y = 33,
      right = pageW / 2 + 5,
      leftValue = 36,
      rightValue = right + 27,
      rows = [
        ["Project", S.project, "Acquired By", S.acquiredBy],
        [
          "Location",
          S.location,
          "Date & Time",
          String(S.date || "").replace("T", " "),
        ],
        ["Client", S.client, "Equipment ID", S.equipmentId],
      ];
    d.setFontSize(8);
    rows.forEach(function (r) {
      d.setFont("helvetica", "bold");
      d.text(r[0] + ":", 14, y);
      d.text(r[2] + ":", right, y);
      d.setFont("helvetica", "normal");
      d.text(String(r[1] || "").slice(0, 55), leftValue, y);
      d.text(String(r[3] || "").slice(0, 45), rightValue, y);
      y += 6;
    });
    return y + 2;
  }
  async function exportPdf(name) {
    var C = window.jspdf && window.jspdf.jsPDF;
    if (!C && window.__qcNeed) {
      await window.__qcNeed("jspdf");
      C = window.jspdf && window.jspdf.jsPDF;
    }
    if (!C) throw Error("PDF engine unavailable");
    var landscape = S.columns.length > 7,
      d = new C({
        unit: "mm",
        format: "a4",
        orientation: landscape ? "landscape" : "portrait",
      }),
      pageW = d.internal.pageSize.getWidth(),
      pageH = d.internal.pageSize.getHeight(),
      maxY = pageH - 14,
      availableW = pageW - 28;
    var totalWeight = S.columns.reduce(function (n, c) {
        return n + c.weight;
      }, 0),
      widths = S.columns.map(function (c) {
        return (availableW * c.weight) / totalWeight;
      }),
      headers = S.columns.map(function (c) {
        return c.titleEn;
      }),
      y;
    function tableHead() {
      d.setFont("helvetica", "bold");
      d.setFontSize(6.5);
      var wrapped = headers.map(function (h, i) {
          return d.splitTextToSize(String(h || ""), Math.max(2, widths[i] - 2));
        }),
        lines = Math.max.apply(
          null,
          wrapped
            .map(function (x) {
              return x.length;
            })
            .concat([1]),
        ),
        hh = Math.max(8, lines * 3 + 3),
        x = 14;
      d.setFillColor(49, 46, 129);
      d.setTextColor(255, 255, 255);
      wrapped.forEach(function (h, i) {
        d.rect(x, y, widths[i], hh, "F");
        d.text(h, x + widths[i] / 2, y + 4, { align: "center" });
        x += widths[i];
      });
      y += hh;
      d.setTextColor(15, 23, 42);
    }
    function pageBase(continued) {
      pdfHeader(d, continued, pageW);
      y = pdfMeta(d, pageW);
    }
    function addDataPage() {
      d.addPage();
      pageW = d.internal.pageSize.getWidth();
      pageH = d.internal.pageSize.getHeight();
      maxY = pageH - 14;
      pageBase(true);
      tableHead();
    }
    pageBase(false);
    if (S.dailyRemarks) {
      var daily = d.splitTextToSize(String(S.dailyRemarks), availableW - 4),
        first = true;
      while (daily.length) {
        d.setFont("helvetica", "bold");
        d.setFontSize(8);
        d.setTextColor(49, 46, 129);
        d.text(
          first ? "Daily Work Remarks:" : "Daily Work Remarks (continued):",
          14,
          y,
        );
        y += 4;
        d.setFont("helvetica", "normal");
        d.setTextColor(15, 23, 42);
        d.setFontSize(7);
        var cap = Math.max(1, Math.floor((maxY - y) / 3.5)),
          part = daily.splice(0, cap);
        d.text(part, 14, y);
        y += part.length * 3.5 + 3;
        if (daily.length) {
          d.addPage();
          pageBase(true);
          first = false;
        }
      }
    }
    if (y > maxY - 14) {
      d.addPage();
      pageBase(true);
    }
    tableHead();
    S.rows.forEach(function (r, ri) {
      var remaining = S.columns.map(function (c, i) {
          d.setFontSize(6.3);
          var lines = d.splitTextToSize(
            String(cellValue(r, c.key) || ""),
            Math.max(2, widths[i] - 3),
          );
          return lines.length ? lines : [""];
        }),
        segment = 0;
      while (
        remaining.some(function (x) {
          return x.length;
        })
      ) {
        var available = maxY - y;
        if (available < 8) {
          addDataPage();
          available = maxY - y;
        }
        var maxLines = Math.max(1, Math.floor((available - 3) / 3.2)),
          parts = remaining.map(function (lines) {
            return lines.splice(0, maxLines);
          }),
          lineCount = Math.max.apply(
            null,
            parts
              .map(function (x) {
                return x.length;
              })
              .concat([1]),
          ),
          rh = Math.max(8, lineCount * 3.2 + 3);
        if (y + rh > maxY) {
          remaining = parts.map(function (x, i) {
            return x.concat(remaining[i]);
          });
          addDataPage();
          continue;
        }
        var x = 14;
        parts.forEach(function (part, i) {
          if (ri % 2 === 1) {
            d.setFillColor(248, 250, 252);
            d.rect(x, y, widths[i], rh, "F");
          }
          d.setDrawColor(203, 213, 225);
          d.rect(x, y, widths[i], rh);
          d.setFont("helvetica", "normal");
          d.setFontSize(6.3);
          if (segment > 0 && part.length && i === 0)
            part[0] = "[continued] " + part[0];
          d.text(part, x + 1.4, y + 3.6);
          x += widths[i];
        });
        y += rh;
        segment++;
      }
    });
    var total = d.getNumberOfPages(),
      dateText = String(S.date || "").replace("T", " "),
      projectText = String(S.project || "GPR");
    for (var pi = 1; pi <= total; pi++) {
      d.setPage(pi);
      var w = d.internal.pageSize.getWidth(),
        h = d.internal.pageSize.getHeight();
      d.setDrawColor(203, 213, 225);
      d.line(14, h - 10, w - 14, h - 10);
      d.setFont("helvetica", "normal");
      d.setTextColor(71, 85, 105);
      d.setFontSize(7);
      d.text(
        "Project: " +
          projectText.slice(0, 55) +
          "  |  Date & Time: " +
          dateText,
        14,
        h - 5,
      );
      d.text("Page " + pi + " of " + total, w - 14, h - 5, { align: "right" });
    }
    var file =
      (name || "GPR_Data_Acquisition_Log").replace(/[^a-zA-Z0-9._-]+/g, "_") +
      ".pdf";
    if (window.__qcSavePDF) return window.__qcSavePDF(d, file);
    d.save(file);
    return true;
  }
  window.exportGprPdf = exportPdf;
  window.exportGprExcel = exportExcel;
  window.QCGpr = {
    getState: function () {
      return clone(S);
    },
    state: S,
    save: save,
    render: render,
  };
  var gprTab = document.querySelector('[data-tab="gpr"]');
  if (gprTab && !gprTab.dataset.gprGrow) {
    gprTab.dataset.gprGrow = "1";
    gprTab.addEventListener("click", function () {
      setTimeout(growAllComments, 60);
    });
  }
  window.addEventListener("resize", function () {
    if (!host.classList.contains("hidden")) growAllComments();
  });
  render();
  var last = document.documentElement.dir;
  new MutationObserver(function () {
    if (document.documentElement.dir !== last) {
      last = document.documentElement.dir;
      render();
    }
  }).observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["dir"],
  });
})();
