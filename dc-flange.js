(function () {
  "use strict";
  var host = document.getElementById("view-flange");
  if (!host) return;
  var KEY = "qc_dc_flange_v258",
    instances = {},
    uid = 0;
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
  function today() {
    var d = new Date(),
      z = function (n) {
        return String(n).padStart(2, "0");
      };
    return (
      d.getFullYear() +
      "-" +
      z(d.getMonth() + 1) +
      "-" +
      z(d.getDate()) +
      "T" +
      z(d.getHours()) +
      ":" +
      z(d.getMinutes())
    );
  }
  function defaultRows() {
    return [
      { code: "07", description: "9001", point: "", remarks: "" },
      { code: "12", description: "Hz=\nV=", point: "", remarks: "" },
      { code: "20", description: "", point: "", remarks: "" },
      { code: "30", description: "", point: "28-33", remarks: "" },
      { code: "31", description: "", point: "34-37", remarks: "" },
      { code: "32", description: "", point: "38-39", remarks: "" },
    ];
  }
  function newPage(no) {
    return {
      id: "df-" + Date.now() + "-" + ++uid,
      project: "",
      location: "",
      date: today(),
      observer: "",
      booker: "",
      tieIn: "",
      setNo: "",
      pageNo: String(no),
      type: "flange",
      gap: "6.6",
      boltDia: "15.61",
      boltNo: "4",
      raiseFace: "3.2",
      faceNo: "1",
      f1: "23.45",
      f2: "23.35",
      wall: "8.5",
      colors: {
        left: "#0288d1",
        right: "#0ea5e9",
        raise: "#f59e0b",
        pipe: "#78909c",
        bolt: "#ffd700",
        compass: "#2563eb",
      },
      colorLabels: {
        left: "L. Flange",
        right: "R. Flange",
        raise: "Raise Face",
        pipe: "Pipe",
        bolt: "Bolt",
        compass: "Compass",
      },
      componentVisible: { left: true, right: true, raise: true, pipe: true, bolt: true, compass: true },
      showModelLabels: false,
      appearanceTheme: "site",
      drawColor: "#ef4444",
      drawSize: "4",
      annotation: "",
      textDraft: "",
      textPreset: "top",
      textColor: "#0f172a",
      textSize: "18",
      autoText: false,
      viewAutoRotate: false,
      viewSmartSnap: true,
      viewOrbitMode: "smart",
      viewState: null,
      textAnnotations: [],
      rows: defaultRows(),
    };
  }
  var S = { pages: [newPage(1)] };
  try {
    var old = JSON.parse(localStorage.getItem(KEY) || "null");
    if (old && Array.isArray(old.pages) && old.pages.length) S = old;
  } catch (e) {}
  S.pages.forEach(function (p) {
    if (!Array.isArray(p.textAnnotations)) p.textAnnotations = [];
    if (p.textDraft == null) p.textDraft = "";
    if (!p.textPreset) p.textPreset = "top";
    if (!p.textColor) p.textColor = "#0f172a";
    if (!p.textSize) p.textSize = "18";
    p.autoText = !!p.autoText;
    p.viewAutoRotate = !!p.viewAutoRotate;
    if (p.viewSmartSnap == null) p.viewSmartSnap = true;
    if (p.viewOrbitMode !== "free") p.viewOrbitMode = "smart";
    if (!p.colorLabels)
      p.colorLabels = {
        left: "L. Flange",
        right: "R. Flange",
        raise: "Raise Face",
        pipe: "Pipe",
        bolt: "Bolt",
        compass: "Compass",
      };
    p.componentVisible = Object.assign({ left: true, right: true, raise: true, pipe: true, bolt: true, compass: true }, p.componentVisible || {});
    p.showModelLabels = false;
    if (!p.appearanceTheme) p.appearanceTheme = "site";
    if (!isFinite(p.autoTextX)) p.autoTextX = 0.5;
    if (!isFinite(p.autoTextY)) p.autoTextY = 0.13;
    if (!Array.isArray(p.recentColors)) p.recentColors = [];
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.date || "")) p.date += "T00:00";
  });
  var storageWarned = false;
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(S));
      storageWarned = false;
      return true;
    } catch (e) {
      if (!storageWarned) {
        storageWarned = true;
        alert(T("Device storage is full. Remove some report photos before continuing.", "مساحة الجهاز ممتلئة. احذف بعض صور التقرير قبل المتابعة."));
      }
      return false;
    }
  }
  function pageHtml(p, i) {
    var pipe = p.type === "pipe",
      half = p.type === "half-flange";
    return (
      '<article class="df-report" data-page="' +
      i +
      '" id="' +
      esc(p.id) +
      '"><div class="df-report-head"><div class="df-report-title">DC FLANGE / PIPE REPORT</div></div>' +
      formCardsHtml(p) +
      '<section class="df-sketch"><div class="df-sketch-head"><span>' +
      T(
        "3D View & Compact Sketch Tools",
        "عرض ثلاثي الأبعاد وأدوات سكيتش مختصرة",
      ) +
      "</span><small>" +
      T(
        "Choose a tool directly inside the view",
        "اختر الأداة مباشرة داخل العرض",
      ) +
      '</small></div><div class="df-sketch-body"><div class="df-type"><span>' +
      T("Survey Component Type", "نوع العنصر المساحي") +
      ':</span><select data-df="type"><option value="flange" ' +
      (p.type === "flange" ? "selected" : "") +
      ">" +
      T("Flange Assembly (Double)", "تجميع فلنجتين") +
      '</option><option value="half-flange" ' +
      (half ? "selected" : "") +
      ">" +
      T("Half Flange (Single)", "فلنجة مفردة") +
      '</option><option value="pipe" ' +
      (pipe ? "selected" : "") +
      ">" +
      T("Pipe Only (Single Run)", "أنبوب فقط") +
      '</option></select></div><div class="df-dims">' +
      dimsHtml(p) +
      '</div>' + appearanceManagerHtml(p) + '<div class="df-banner"><span data-banner="f1"></span><span data-banner="gap"></span><span data-banner="f2"></span></div><div class="df-webgl">' +
      sketchToolbarHtml(p) +
      viewControlsHtml(p) +
      '<div class="df-compass" style="border-color:' +
      esc(p.colors.compass) +
      '"><div class="df-needle"><span class="df-n">N</span><span class="df-s">S</span></div></div><canvas class="df-annotation"></canvas><canvas class="df-text-layer"></canvas><div class="df-hint">🔄 ' +
      T("Compass & 3D sketch", "البوصلة والرسم الثلاثي") +
      '</div><div class="df-legend"></div></div></div></section><div class="df-data-wrap"><table class="df-data"><thead><tr><th>' +
      T("Code", "الرمز") +
      "</th><th>" +
      T("Description", "الوصف") +
      "</th><th>" +
      T("Point ID", "معرّف النقطة") +
      "</th><th>" +
      T("Remarks", "الملاحظات") +
      "</th><th>" +
      T("Action", "إجراء") +
      "</th></tr></thead><tbody>" +
      p.rows
        .map(function (r, ri) {
          return rowHtml(r, ri);
        })
        .join("") +
      '</tbody></table></div><div class="df-actions"><button class="btn btn-secondary" type="button" data-action="add-row">＋ ' +
      T("Add Data Row", "إضافة صف بيانات") +
      '</button><span class="spacer"></span></div><div class="df-info-wrap"><table class="df-info"><tr><td colspan="4" class="head">' +
      T("Information Guide", "دليل المعلومات") +
      '</td></tr><tr><td><b>07</b></td><td>Set 9001, 9002, 9003…</td><td><b>30</b></td><td>Edge of flange / Pipe end</td></tr><tr><td><b>12</b></td><td>Initial RO 9010, 9020, 9030…</td><td><b>31</b></td><td>Center of Bolt / Axis</td></tr><tr><td><b>20</b></td><td>Control observation</td><td><b>32</b></td><td>Check shoot</td></tr><tr><td><b>13</b></td><td>Survey</td><td><b>22</b></td><td>Final RO 9010, 9020, 9030…</td></tr></table></div><footer class="df-page-foot"><span>— ' +
      T("End of Report Page", "نهاية صفحة التقرير") +
      " " +
      (i + 1) +
      ' —</span><div><button class="df-mini-btn" type="button" data-action="print-one">🖨 ' +
      T("Print This Page", "طباعة هذه الصفحة") +
      '</button><button class="df-mini-btn danger" type="button" data-action="delete-page">' +
      T("Delete Page", "حذف الصفحة") +
      "</button></div></footer>" +
      colorDialogHtml(p) +
      "</article>"
    );
  }
  function viewControlsHtml(p) {
    return (
      '<div class="df-view-controls" role="toolbar" aria-label="' +
      T("Smart 3D views", "العرض الذكي ثلاثي الأبعاد") +
      '"><button type="button" data-action="view-preset" data-view="iso">◇ <span>' +
      T("Isometric", "منظور") +
      '</span></button><button type="button" data-action="view-preset" data-view="front">▣ <span>' +
      T("Front", "أمامي") +
      '</span></button><button type="button" data-action="view-preset" data-view="side">◧ <span>' +
      T("Side", "جانبي") +
      '</span></button><button type="button" data-action="view-preset" data-view="top">⬒ <span>' +
      T("Top", "علوي") +
      '</span></button><button type="button" data-action="view-fit">⌗ <span>' +
      T("Fit", "توسيط") +
      '</span></button><button type="button" class="' +
      (p.viewOrbitMode === "smart" ? "active" : "") +
      '" data-action="view-mode">✦ <span data-view-mode-label>' +
      (p.viewOrbitMode === "smart" ? T("Smart", "ذكي") : T("Free", "حر")) +
      '</span></button><button type="button" class="' +
      (p.viewAutoRotate ? "active" : "") +
      '" data-action="view-auto">⟳ <span>' +
      T("Auto", "تلقائي") +
      '</span></button><button type="button" data-action="view-pad">⊕ <span>' +
      T("Control", "تحكم") +
      '</span></button></div><div class="df-mobile-rotate-pad hidden" aria-label="' +
      T("Precise rotation control", "تحكم دقيق بالدوران") +
      '"><div class="df-pad-title"><b>' +
      T("Precise rotation", "دوران دقيق") +
      '</b><button type="button" data-action="view-pad">×</button></div><div class="df-pad-grid"><button type="button" data-action="view-step" data-view-step="up">▲</button><button type="button" data-action="view-step" data-view-step="left">◀</button><button type="button" data-action="view-fit">◎</button><button type="button" data-action="view-step" data-view-step="right">▶</button><button type="button" data-action="view-step" data-view-step="down">▼</button></div><div class="df-pad-zoom"><button type="button" data-action="view-step" data-view-step="in">＋ ' +
      T("Zoom", "تقريب") +
      '</button><button type="button" data-action="view-step" data-view-step="out">− ' +
      T("Zoom", "إبعاد") +
      '</button></div><small>' +
      T("One finger rotates · two fingers zoom and move", "إصبع للدوران · إصبعان للتقريب والتحريك") +
      '</small></div>'
    );
  }
  function sketchToolbarHtml(p) {
    return (
      '<div class="df-sketch-toolbar" role="toolbar" aria-label="' +
      T("Sketch tools", "أدوات السكيتش") +
      '"><button type="button" class="active" data-tool="orbit" title="' +
      T("Rotate 3D", "تدوير 3D") +
      '">⟳</button><button type="button" data-tool="move" title="' +
      T("Move text", "تحريك النص") +
      '">↔</button><button type="button" data-tool="freehand" title="' +
      T("Freehand", "قلم حر") +
      '">✎</button><button type="button" data-tool="line" title="' +
      T("Line", "خط") +
      '">╱</button><button type="button" data-tool="arrow" title="' +
      T("Arrow", "سهم") +
      '">➜</button><button type="button" data-tool="circle" title="' +
      T("Circle", "دائرة") +
      '">○</button><button type="button" data-tool="text" title="' +
      T("Text", "نص") +
      '">T</button><button type="button" class="df-tool-color" data-action="open-color-dialog" data-color-target="drawColor" title="' +
      T("Open color box", "فتح بوكس الألوان") +
      '"><i style="background:' +
      esc(p.drawColor) +
      '"></i></button><button type="button" data-action="cycle-size" title="' +
      T("Line width", "سمك الخط") +
      '"><span data-stroke-size>' +
      esc(p.drawSize) +
      '</span>px</button><button type="button" data-action="undo-sketch" title="' +
      T("Undo", "تراجع") +
      '">↶</button><button type="button" class="danger" data-action="clear-sketch" title="' +
      T("Clear sketch", "مسح السكيتش") +
      '">🗑</button></div><div class="df-text-popover hidden"><input type="text" data-df="textDraft" value="' +
      esc(p.textDraft) +
      '" placeholder="' +
      T("Enter text", "اكتب النص") +
      '"><button type="button" data-action="arm-text">⌖ ' +
      T("Place", "وضع") +
      '</button><button type="button" class="' +
      (p.autoText ? "active" : "") +
      '" data-action="toggle-auto-text">▣ ' +
      T("Auto data", "بيانات تلقائية") +
      "</button></div>"
    );
  }
  function colorDialogHtml(p) {
    var colors = [
      "#000000",
      "#1f2937",
      "#64748b",
      "#d1d5db",
      "#ffffff",
      "#7f1d1d",
      "#dc2626",
      "#f97316",
      "#f59e0b",
      "#fde047",
      "#365314",
      "#65a30d",
      "#16a34a",
      "#10b981",
      "#134e4a",
      "#0d9488",
      "#06b6d4",
      "#0c4a6e",
      "#0288d1",
      "#2563eb",
      "#1e3a8a",
      "#4f46e5",
      "#581c87",
      "#7c3aed",
      "#c026d3",
      "#db2777",
      "#f9a8d4",
      "#78350f",
      "#92400e",
      "#a16207",
      "#f5deb3",
      "#78909c",
      "#455a64",
      "#00ffff",
      "#ff00ff",
      "#ffff00",
      "#00ff00",
      "#0000ff",
      "#ff0000",
    ];
    return (
      '<div class="df-color-dialog hidden" data-color-dialog><div class="df-color-box" role="dialog" aria-modal="true"><div class="df-color-head"><b>🎨 ' +
      T("Colors", "الألوان") +
      '</b><button type="button" data-action="close-color-dialog" aria-label="' +
      T("Close", "إغلاق") +
      '">×</button></div><div class="df-color-tabs"><button type="button" class="active" data-action="palette-tab" data-palette-tab="all">' +
      T("All", "الكل") +
      '</button><button type="button" data-action="palette-tab" data-palette-tab="recent">' +
      T("Recent", "الأخيرة") +
      '</button><button type="button" data-action="palette-tab" data-palette-tab="custom">' +
      T("Custom", "مخصص") +
      '</button></div><div class="df-color-panel active" data-color-panel="all"><div class="df-paint-grid">' +
      colors
        .map(function (c) {
          return (
            '<button type="button" data-action="pick-color" data-palette-color="' +
            c +
            '" title="' +
            c +
            '" style="--paint:' +
            c +
            '"></button>'
          );
        })
        .join("") +
      '</div></div><div class="df-color-panel" data-color-panel="recent"><div class="df-paint-grid" data-recent-colors></div><p class="df-no-recent">' +
      T(
        "Your recently used colors appear here.",
        "تظهر هنا الألوان المستخدمة مؤخراً.",
      ) +
      '</p></div><div class="df-color-panel" data-color-panel="custom"><div class="df-custom-color"><input type="color" data-palette-custom value="#2563eb"><input type="text" data-palette-hex value="#2563EB" maxlength="7" inputmode="text"><span class="df-color-preview"></span><button type="button" data-action="apply-custom-color">' +
      T("Apply", "تطبيق") +
      "</button></div></div></div></div>"
    );
  }
  function typeTop(p) {
    return p.type === "pipe"
      ? "Pipe Length"
      : p.type === "half-flange"
        ? "Raise Face"
        : "Gap / Length";
  }
  function formField(k, en, aa, v, type, unit) {
    return (
      '<label class="df-form-field"><span>' +
      T(en, aa) +
      (unit ? " <i>" + unit + "</i>" : "") +
      "</span><input " +
      (type === "date"
        ? 'type="date"'
        : type === "datetime"
          ? 'type="datetime-local"'
          : type === "number"
            ? 'type="number" step="any" min="0"'
            : 'type="text"') +
      ' data-df="' +
      k +
      '" value="' +
      esc(v) +
      '"></label>'
    );
  }
  function boltCountField(p) {
    return (
      '<label class="df-form-field df-bolt-count-field"><span>' +
      T("Bolt Count", "عدد البراغي") +
      '</span><input type="number" step="1" min="0" max="64" inputmode="numeric" data-df="boltNo" value="' +
      esc(p.boltNo) +
      '"><small>' +
      T("Smart circular layout · maximum 64", "توزيع دائري ذكي · الحد الأقصى 64") +
      "</small></label>"
    );
  }
  function pageNumberField(p) {
    return (
      '<label class="df-form-field df-page-number-field"><span>' +
      T("Page Number", "رقم الصفحة") +
      '</span><input type="text" readonly inputmode="numeric" value="' +
      esc(p.pageNo) +
      '" aria-label="' +
      T("Automatic page number", "رقم الصفحة تلقائي") +
      '"><small>' +
      T("Automatic", "تلقائي") +
      "</small></label>"
    );
  }
  function formCardsHtml(p) {
    var pipe = p.type === "pipe",
      half = p.type === "half-flange",
      component =
        formField(
          "gap",
          pipe ? "Pipe Length" : half ? "Raise Face" : "Gap / Length",
          pipe ? "طول الأنبوب" : half ? "البروز" : "الفجوة / الطول",
          p.gap,
          "number",
          "mm",
        ) +
        formField(
          "boltDia",
          pipe ? "Pipe OD (Dia)" : "Bolt Diameter",
          pipe ? "قطر الأنبوب الخارجي" : "قطر البرغي",
          p.boltDia,
          "number",
          "mm",
        ) +
        (pipe
          ? formField(
              "wall",
              "Wall Thickness",
              "سمك الجدار",
              p.wall,
              "number",
              "mm",
            )
          : boltCountField(p) +
            formField(
              "raiseFace",
              "Raised Face",
              "البروز",
              p.raiseFace,
              "number",
              "mm",
            ) +
            formField(
              "faceNo",
              "Face Number",
              "رقم الوجه",
              p.faceNo,
              "text",
              "",
            ));
    return (
      '<div class="df-form-cards"><section class="df-form-card"><div class="df-form-card-head"><b>01</b><span>' +
      T("Project Information", "معلومات المشروع") +
      '</span></div><div class="df-form-grid">' +
      formField("project", "Project", "المشروع", p.project) +
      formField("location", "Location", "الموقع", p.location) +
      formField("date", "Date & Time", "التاريخ والوقت", p.date, "datetime") +
      pageNumberField(p) +
      '</div></section><section class="df-form-card"><div class="df-form-card-head"><b>02</b><span>' +
      T("Survey Record", "سجل المسح") +
      '</span></div><div class="df-form-grid">' +
      formField("observer", "Observer", "الراصد", p.observer) +
      formField("booker", "Booker", "المسجل", p.booker) +
      formField("tieIn", "Tie-in Number", "رقم الربط", p.tieIn) +
      formField("setNo", "Set Number", "رقم المجموعة", p.setNo) +
      '</div></section><section class="df-form-card df-component-card"><div class="df-form-card-head"><b>03</b><span>' +
      T("Component Reference Dimensions", "الأبعاد المرجعية للعنصر") +
      '</span></div><div class="df-form-grid">' +
      component +
      "</div></section></div>"
    );
  }
  function dimsHtml(p) {
    if (p.type === "pipe")
      return (
        dim("wall", T("Wall Thk", "سمك الجدار"), p.wall, "#10b981") +
        dim("gap", T("Pipe Length", "طول الأنبوب"), p.gap, "#0f172a")
      );
    if (p.type === "half-flange")
      return (
        dim("f1", T("Flange Thk", "سمك الفلنجة"), p.f1, "#0288d1") +
        dim("gap", T("Raise Face", "البروز"), p.gap, "#0f172a") +
        dim("wall", T("Wall Thk", "سمك الجدار"), p.wall, "#10b981")
      );
    return (
      dim("f1", "F1 Thk", p.f1, "#0288d1") +
      dim("gap", T("Gap", "الفجوة"), p.gap, "#0f172a") +
      dim("f2", "F2 Thk", p.f2, "#dc2626") +
      dim("wall", T("Wall Thk", "سمك الجدار"), p.wall, "#10b981")
    );
  }
  function dim(k, l, v, c) {
    return (
      '<label style="color:' +
      c +
      '">' +
      l +
      ': <input type="number" step="any" min="0" data-df="' +
      k +
      '" value="' +
      esc(v) +
      '"> mm</label>'
    );
  }
  function appearanceRow(k, en, aa, show, p) {
    var icons = { left: "◐", right: "◑", raise: "◎", pipe: "▰", bolt: "⬡", compass: "⌖" },
      visible = p.componentVisible[k] !== false;
    return (
      '<div class="df-appearance-row" data-component-row="' + k + '" style="display:' + (show ? "grid" : "none") + '"><button type="button" class="df-component-visible ' + (visible ? "active" : "") + '" data-action="component-visible" data-component="' + k + '" title="' + T("Show or hide component", "إظهار أو إخفاء المكوّن") + '">' + (visible ? "◉" : "○") + '</button><div class="df-component-name"><i>' + icons[k] + '</i><span>' + T(en, aa) + '</span></div><button type="button" class="df-model-color-btn" data-action="open-color-dialog" data-model-color="' + k + '" title="' + T("Choose component color", "اختيار لون المكوّن") + '"><i style="background:' + esc(p.colors[k]) + '"></i><span>' + esc(p.colors[k]).toUpperCase() + '</span></button><label class="df-component-label"><span>' + T("Label", "التسمية") + '</span><input class="df-color-name" type="text" data-color-label="' + k + '" value="' + esc(p.colorLabels[k] || en) + '"></label><button type="button" class="df-component-focus" data-action="component-focus" data-component="' + k + '" title="' + T("Focus this component", "تركيز هذا المكوّن") + '">⌖ <span>' + T("Focus", "تركيز") + '</span></button></div>'
    );
  }
  function appearanceManagerHtml(p) {
    var pipe = p.type === "pipe", half = p.type === "half-flange";
    return '<details class="df-model-colors"><summary><span>🎨 ' + T("Flange appearance & labels", "مظهر وتسميات الفلنجة") + '</span><small>' + T("Colors · labels · visibility", "ألوان · تسميات · إظهار") + '</small></summary><div class="df-appearance-manager"><p class="df-appearance-help">' + T("Choose a ready theme, tap a model component, or edit every component independently.", "اختر ثيماً جاهزاً، اضغط على جزء من المجسم، أو عدّل كل مكوّن بصورة مستقلة.") + '</p><div class="df-appearance-actions"><button type="button" data-action="component-pick">⌖ ' + T("Pick from model", "اختيار من المجسم") + '</button><button type="button" data-action="appearance-reset">↺ ' + T("Reset", "إعادة ضبط") + '</button></div><div class="df-theme-strip"><b>' + T("Ready themes", "ثيمات جاهزة") + '</b><button type="button" data-action="appearance-theme" data-theme="site">' + T("Site", "موقع") + '</button><button type="button" data-action="appearance-theme" data-theme="contrast">' + T("High contrast", "تباين قوي") + '</button><button type="button" data-action="appearance-theme" data-theme="print">' + T("Print", "طباعة") + '</button><button type="button" data-action="appearance-theme" data-theme="dark">' + T("Dark", "داكن") + '</button></div><div class="df-label-presets"><b>' + T("Label language", "لغة التسميات") + '</b><button type="button" data-action="label-preset" data-label-preset="en">'+T('English','الإنجليزية')+'</button><button type="button" data-action="label-preset" data-label-preset="ar">'+T('Arabic','العربية')+'</button><button type="button" data-action="label-preset" data-label-preset="both">EN + AR</button></div><div class="df-appearance-list">' + appearanceRow("left", "Left flange", "الفلنجة اليسرى", !pipe, p) + appearanceRow("right", "Right flange", "الفلنجة اليمنى", p.type === "flange", p) + appearanceRow("raise", "Raised face", "الوجه البارز", !pipe, p) + appearanceRow("pipe", "Pipe", "الأنبوب", true, p) + appearanceRow("bolt", "Bolts", "البراغي", !pipe, p) + appearanceRow("compass", "Compass", "البوصلة", true, p) + '</div></div></details>';
  }
  function colorInput(k, l, v, show, p) {
    var label = p.colorLabels[k] || l;
    return (
      '<div class="df-color-item" style="display:' +
      (show ? "grid" : "none") +
      '"><input class="df-color-name" type="text" data-color-label="' +
      k +
      '" value="' +
      esc(label) +
      '" title="' +
      T("Editable color label", "عنوان اللون قابل للتعديل") +
      '"><button type="button" class="df-model-color-btn" data-action="open-color-dialog" data-model-color="' +
      k +
      '" title="' +
      T("Open color box", "فتح بوكس الألوان") +
      '"><i style="background:' +
      esc(v) +
      '"></i><span>' +
      esc(v).toUpperCase() +
      "</span></button></div>"
    );
  }
  var APPEARANCE_THEMES = {
    site: { left: "#0288d1", right: "#0ea5e9", raise: "#f59e0b", pipe: "#78909c", bolt: "#ffd700", compass: "#2563eb" },
    contrast: { left: "#0057b8", right: "#e63946", raise: "#ffb703", pipe: "#5c677d", bolt: "#16a34a", compass: "#7c3aed" },
    print: { left: "#334155", right: "#64748b", raise: "#f59e0b", pipe: "#94a3b8", bolt: "#111827", compass: "#1d4ed8" },
    dark: { left: "#22d3ee", right: "#818cf8", raise: "#fbbf24", pipe: "#475569", bolt: "#f8fafc", compass: "#38bdf8" },
  };
  var LABEL_PRESETS = {
    en: { left: "Left Flange", right: "Right Flange", raise: "Raised Face", pipe: "Pipe", bolt: "Bolts", compass: "Compass" },
    ar: { left: "الفلنجة اليسرى", right: "الفلنجة اليمنى", raise: "الوجه البارز", pipe: "الأنبوب", bolt: "البراغي", compass: "البوصلة" },
    both: { left: "Left Flange · الفلنجة اليسرى", right: "Right Flange · الفلنجة اليمنى", raise: "Raised Face · الوجه البارز", pipe: "Pipe · الأنبوب", bolt: "Bolts · البراغي", compass: "Compass · البوصلة" },
  };
  function refreshAppearanceUI(page, p) {
    COMPONENT_KEYS.forEach(function (key) {
      var row = page.querySelector('[data-component-row="' + key + '"]');
      if (!row) return;
      var swatch = row.querySelector(".df-model-color-btn i"), hex = row.querySelector(".df-model-color-btn span"), label = row.querySelector("[data-color-label]"), visible = row.querySelector(".df-component-visible");
      if (swatch) swatch.style.background = p.colors[key];
      if (hex) hex.textContent = String(p.colors[key]).toUpperCase();
      if (label) label.value = p.colorLabels[key] || "";
      if (visible) { visible.classList.toggle("active", p.componentVisible[key] !== false); visible.textContent = p.componentVisible[key] !== false ? "◉" : "○"; }
    });
  }
  function applyAppearanceTheme(page, p, name) {
    var theme = APPEARANCE_THEMES[name] || APPEARANCE_THEMES.site;
    p.colors = Object.assign({}, p.colors, theme);
    p.appearanceTheme = name || "site";
    save();
    refreshAppearanceUI(page, p);
    if (instances[p.id]) buildModel(instances[p.id]);
  }
  function applyLabelPreset(page, p, mode) {
    p.colorLabels = Object.assign({}, p.colorLabels, LABEL_PRESETS[mode] || LABEL_PRESETS.both);
    save();
    refreshAppearanceUI(page, p);
    if (instances[p.id]) buildModel(instances[p.id]);
  }
  function rowHtml(r, i) {
    return (
      '<tr data-row="' +
      i +
      '"><td><input data-row-k="code" value="' +
      esc(r.code) +
      '"></td><td><textarea data-row-k="description" rows="2">' +
      esc(r.description) +
      '</textarea></td><td><input data-row-k="point" value="' +
      esc(r.point) +
      '"></td><td><input data-row-k="remarks" value="' +
      esc(r.remarks) +
      '"></td><td><button type="button" class="df-mini-btn danger" data-action="delete-row">×</button></td></tr>'
    );
  }
  function cleanOptionalTags() {
    host.querySelectorAll(".qc-field-optional").forEach(function (x) {
      var p = x.parentElement;
      x.remove();
      if (p && p.classList.contains("qc-field-meta") && !p.children.length)
        p.remove();
    });
  }
  function render() {
    destroyAll();
    S.pages.forEach(function (p, i) {
      p.pageNo = String(i + 1);
    });
    save();
    host.innerHTML =
      '<section class="page-head no-illu df-page-head"><div class="df-hero-copy"><span class="df-eyebrow">DC DIMENSION · FIELD REPORT</span><h1>' +
      T("DC", "DC") +
      "</h1><p>" +
      T(
        "Accurate component dimensions, interactive 3D inspection, compass orientation, direct sketches, and structured survey records.",
        "أبعاد دقيقة للعناصر مع مراجعة ثلاثية الأبعاد وبوصلة ورسومات مباشرة وسجل مساحي منظم.",
      ) +
      '</p></div><div class="df-hero-side"><span>360° 3D</span><span>' +
      T("Sketch Tools", "أدوات السكيتش") +
      '</span></div></section><div class="df-pages">' +
      S.pages.map(pageHtml).join("") +
      '</div><div class="df-global-actions"><button class="btn btn-secondary" type="button" id="df-add-page">＋ ' +
      T("Add New Report Page", "إضافة صفحة تقرير") +
      '</button><button class="btn btn-primary" type="button" id="df-export">🖨 ' +
      T("Preview / Export All Pages PDF", "معاينة / تصدير جميع الصفحات PDF") +
      "</button></div>";
    wire();
    requestAnimationFrame(initAll);
    if (window.QCDesignSystem) QCDesignSystem.scan();
    cleanOptionalTags();
    if (window.__qcWorkspaceUI) __qcWorkspaceUI.scan();
    if (window.QCDcFlangePro) QCDcFlangePro.scan();
  }
  function wire() {
    host.oninput = function (e) {
      var page = e.target.closest(".df-report");
      if (!page) return;
      var i = +page.dataset.page,
        p = S.pages[i],
        k = e.target.dataset.df,
        r = e.target.closest("[data-row]"),
        rk = e.target.dataset.rowK;
      if (e.target.dataset.paletteCustom != null) {
        var hd = page.querySelector("[data-palette-hex]"),
          pv = page.querySelector(".df-color-preview");
        hd.value = e.target.value.toUpperCase();
        pv.style.background = e.target.value;
        return;
      }
      if (e.target.dataset.paletteHex != null) {
        var hc = validHex(e.target.value),
          pv2 = page.querySelector(".df-color-preview");
        if (hc) pv2.style.background = hc;
        return;
      }
      if (e.target.dataset.appearance === "showModelLabels") {
        p.showModelLabels = !!e.target.checked;
        save();
        if (instances[p.id]) updateModelCallouts(instances[p.id], true);
        return;
      }
      if (k) {
        if (k === "boltNo" && e.target.value !== "") {
          var smartCount = Math.max(0, Math.min(64, Math.round(num(e.target.value, 0))));
          e.target.value = String(smartCount);
        }
        p[k] = e.target.value;
        page.querySelectorAll('[data-df="' + k + '"]').forEach(function (x) {
          if (x !== e.target) x.value = e.target.value;
        });
        save();
        if (k === "type") {
          render();
          return;
        }
        if (
          ["gap", "boltDia", "boltNo", "raiseFace", "f1", "f2", "wall"].indexOf(
            k,
          ) >= 0
        )
          updateModel(page, p);
        if (
          instances[p.id] &&
          (["textDraft", "textPreset", "textColor", "textSize"].indexOf(k) >=
            0 ||
            p.autoText)
        )
          renderTextLayer(instances[p.id]);
      } else if (e.target.dataset.colorLabel) {
        p.colorLabels[e.target.dataset.colorLabel] = e.target.value;
        save();
        if (instances[p.id]) buildModel(instances[p.id]);
      } else if (e.target.dataset.color) {
        var ck = e.target.dataset.color;
        p.colors[ck] = e.target.value;
        page
          .querySelectorAll('[data-color="' + ck + '"]')
          .forEach(function (x) {
            if (x !== e.target) {
              if (
                x.tagName === "SELECT" &&
                !Array.from(x.options).some(function (o) {
                  return o.value === e.target.value;
                })
              )
                return;
              x.value = e.target.value;
            }
          });
        save();
        updateModel(page, p);
      } else if (r && rk) {
        p.rows[+r.dataset.row][rk] = e.target.value;
        save();
      }
    };
    host.onchange = host.oninput;
    host.onmouseover = function (e) {
      var row = e.target.closest && e.target.closest("[data-component-row]");
      if (!row || (e.relatedTarget && row.contains(e.relatedTarget))) return;
      var page = row.closest(".df-report"), p = page && S.pages[+page.dataset.page];
      if (p && instances[p.id]) highlightComponent(instances[p.id], row.dataset.componentRow, true);
    };
    host.onmouseout = function (e) {
      var row = e.target.closest && e.target.closest("[data-component-row]");
      if (!row || (e.relatedTarget && row.contains(e.relatedTarget))) return;
      var page = row.closest(".df-report"), p = page && S.pages[+page.dataset.page];
      if (p && instances[p.id]) highlightComponent(instances[p.id], row.dataset.componentRow, false);
    };
    host.onclick = function (e) {
      var b = e.target.closest("[data-action],[data-tool]");
      if (!b) return;
      var page = b.closest(".df-report"),
        i = page ? +page.dataset.page : -1,
        p = i >= 0 ? S.pages[i] : null,
        a = b.dataset.action;
      if (b.dataset.tool) {
        setSketchTool(page, i, b.dataset.tool, b);
        return;
      }
      if (a === "draw") toggleDraw(page, b);
      if (a === "clear-draw") clearDraw(page, i);
      if (a === "add-text") addTextPreset(page, i);
      if (a === "place-text") toggleTextPlacement(page, i, b);
      if (a === "move-text") toggleTextMovement(page, i, b);
      if (a === "toggle-auto-text") toggleAutoText(page, i, b);
      if (a === "undo-text") undoText(page, i);
      if (a === "clear-text") clearText(page, i);
      if (a === "arm-text") armTextPlacement(page, i);
      if (a === "cycle-size") cycleSketchSize(page, i, b);
      if (a === "undo-sketch") undoSketch(page, i);
      if (a === "clear-sketch") clearSketch(page, i);
      if (a === "open-color-dialog") openColorDialog(page, i, b);
      if (a === "close-color-dialog") closeColorDialog(page);
      if (a === "palette-tab") switchColorTab(page, b.dataset.paletteTab);
      if (a === "pick-color") applyDialogColor(page, i, b.dataset.paletteColor);
      if (a === "apply-custom-color") applyCustomDialogColor(page, i);
      if (a === "appearance-theme" && p) applyAppearanceTheme(page, p, b.dataset.theme);
      if (a === "label-preset" && p) applyLabelPreset(page, p, b.dataset.labelPreset);
      if (a === "appearance-reset" && p) {
        p.componentVisible = { left: true, right: true, raise: true, pipe: true, bolt: true, compass: true };
        p.showModelLabels = false;
        var labels = ar() ? LABEL_PRESETS.ar : LABEL_PRESETS.en;
        p.colorLabels = Object.assign({}, labels);
        applyAppearanceTheme(page, p, "site");
      }
      if (a === "component-visible" && p) {
        var componentKey = b.dataset.component;
        p.componentVisible[componentKey] = p.componentVisible[componentKey] === false;
        save();
        refreshAppearanceUI(page, p);
        if (instances[p.id]) buildModel(instances[p.id]);
      }
      if (a === "component-focus" && p && instances[p.id]) {
        activateAppearanceRow(instances[p.id], b.dataset.component);
        if (b.dataset.component !== "compass") focusComponent(instances[p.id], b.dataset.component);
      }
      if (a === "component-pick" && p && instances[p.id]) {
        var pickInst = instances[p.id];
        pickInst.componentPick = !pickInst.componentPick;
        pickInst.controls.enabled = !pickInst.componentPick;
        b.classList.toggle("active", pickInst.componentPick);
      }
      if (a === "view-preset" && p && instances[p.id])
        fitSmartView(instances[p.id], b.dataset.view || "iso");
      if (a === "view-fit" && p && instances[p.id])
        fitSmartView(instances[p.id]);
      if (a === "view-auto" && p && instances[p.id]) {
        p.viewAutoRotate = !p.viewAutoRotate;
        instances[p.id].controls.autoRotate = p.viewAutoRotate;
        b.classList.toggle("active", p.viewAutoRotate);
        save();
      }
      if (a === "view-mode" && p && instances[p.id]) {
        p.viewOrbitMode = p.viewOrbitMode === "free" ? "smart" : "free";
        applyOrbitMode(instances[p.id]);
        b.classList.toggle("active", p.viewOrbitMode === "smart");
        var modeLabel = b.querySelector("[data-view-mode-label]");
        if (modeLabel) modeLabel.textContent = p.viewOrbitMode === "smart" ? T("Smart", "ذكي") : T("Free", "حر");
        save();
      }
      if (a === "view-pad" && page) {
        var pad = page.querySelector(".df-mobile-rotate-pad");
        if (pad) pad.classList.toggle("hidden");
      }
      if (a === "view-step" && p && instances[p.id])
        stepSmartView(instances[p.id], b.dataset.viewStep);
      if (a === "view-smart" && p && instances[p.id]) {
        p.viewSmartSnap = !p.viewSmartSnap;
        b.classList.toggle("active", p.viewSmartSnap);
        save();
        if (p.viewSmartSnap) smartSnapView(instances[p.id]);
      }
      if (a === "add-row") {
        p.rows.push({ code: "", description: "", point: "", remarks: "" });
        save();
        render();
      }
      if (a === "delete-row") {
        var ri = +b.closest("[data-row]").dataset.row;
        if (p.rows.length === 1)
          p.rows[0] = { code: "", description: "", point: "", remarks: "" };
        else p.rows.splice(ri, 1);
        save();
        render();
      }
      if (a === "delete-page") {
        if (S.pages.length === 1)
          return alert(
            T(
              "At least one report page must remain.",
              "يجب إبقاء صفحة تقرير واحدة على الأقل.",
            ),
          );
        if (confirm(T("Delete this report page?", "حذف صفحة التقرير؟"))) {
          S.pages.splice(i, 1);
          S.pages.forEach(function (x, j) {
            x.pageNo = String(j + 1);
          });
          save();
          render();
        }
      }
      if (a === "print-one") {
        host.querySelectorAll(".df-report").forEach(function (x) {
          x.classList.toggle("df-print-hide", x !== page);
        });
        window.print();
        setTimeout(function () {
          host.querySelectorAll(".df-report").forEach(function (x) {
            x.classList.remove("df-print-hide");
          });
        }, 500);
      }
    };
    document.getElementById("df-add-page").onclick = function () {
      S.pages.push(newPage(S.pages.length + 1));
      save();
      render();
      setTimeout(function () {
        var a = host.querySelectorAll(".df-report");
        a[a.length - 1].scrollIntoView({ behavior: "smooth", block: "start" });
      }, 50);
    };
    document.getElementById("df-export").onclick = function () {
      if (window.__qcOpenPdfModal)
        __qcOpenPdfModal("flange", "DC_Flange_Pipe_Report");
      else exportPdf("DC_Flange_Pipe_Report");
    };
  }
  function destroyAll() {
    Object.keys(instances).forEach(function (k) {
      var x = instances[k];
      x.dead = true;
      try {
        x.ro.disconnect();
        clearTimeout(x.viewSaveTimer);
        if (x.raf) cancelAnimationFrame(x.raf);
        x.raf = 0;
        x.renderer.dispose();
        x.renderer.domElement.remove();
      } catch (e) {}
    });
    instances = {};
  }
  function initAll() {
    host.querySelectorAll(".df-report").forEach(function (el) {
      var p = S.pages[+el.dataset.page];
      if (!window.THREE || !THREE.OrbitControls) {
        initFallback2D(el, p, "3D library unavailable");
        return;
      }
      try {
        init3D(el, p);
      } catch (err) {
        console.error("DC Flange 3D initialization failed; using safe 2D drawing.", err);
        initFallback2D(el, p, err && err.message);
      }
    });
  }
  function initFallback2D(el, p, reason) {
    var box = el.querySelector(".df-webgl"), ann = el.querySelector(".df-annotation"), txt = el.querySelector(".df-text-layer"), model = document.createElement("canvas"), ctx = model.getContext("2d");
    box.querySelectorAll("canvas:not(.df-annotation):not(.df-text-layer)").forEach(function(c){c.remove()});
    model.className = "df-fallback-model";
    model.setAttribute("aria-label", T("Flange safe 2D drawing", "رسم الفلنجة الثنائي الآمن"));
    box.insertBefore(model, ann);
    var controls = {enabled:true,autoRotate:false,target:{toArray:function(){return[0,0,0]}},update:function(){},addEventListener:function(){},getAzimuthalAngle:function(){return 0}}, renderer = {domElement:model,dispose:function(){},render:function(){drawFallbackModel(inst)},setSize:function(){drawFallbackModel(inst)}}, camera = {position:{toArray:function(){return[8,4,8]}},aspect:1,updateProjectionMatrix:function(){}}, inst = {el:el,p:p,scene:null,camera:camera,renderer:renderer,controls:controls,group:null,ann:ann,ctx:ann.getContext("2d"),txt:txt,tctx:txt.getContext("2d"),textMode:false,moveMode:false,textHits:[],dragText:null,drawTool:"orbit",undoStack:[],viewAnimating:false,viewSaveTimer:null,dead:false,fallback2D:true,software3D:true,fallbackCtx:ctx,fallbackYaw:-.68,fallbackPitch:.42,fallbackZoom:1};
    instances[p.id] = inst;
    sizeFallbackModel(inst);
    sizeAnnotation(inst, p.annotation);
    sizeTextLayer(inst);
    setupDraw(inst);
    setupTextPlacement(inst);
    var badge = document.createElement("div");
    badge.className = "df-safe2d-badge df-software3d-badge";
    badge.textContent = T("Software 3D · universal browser mode", "ثلاثي الأبعاد برمجياً · وضع متوافق مع كل المتصفحات");
    badge.title = reason || T("WebGL was replaced by the universal software 3D renderer", "تم استبدال WebGL بمحرك ثلاثي برمجي متوافق");
    box.appendChild(badge);
    /* Pointer rotation and wheel zoom keep software 3D interactive on old browsers. */
    var drag=null,drawQueued=false;
    function requestSoftwareDraw(){if(drawQueued)return;drawQueued=true;requestAnimationFrame(function(){drawQueued=false;if(!inst.dead)drawFallbackModel(inst)})}
    model.addEventListener("pointerdown",function(e){if(inst.drawTool!=="orbit")return;drag={x:e.clientX,y:e.clientY,yaw:inst.fallbackYaw,pitch:inst.fallbackPitch};try{model.setPointerCapture(e.pointerId)}catch(z){}});
    model.addEventListener("pointermove",function(e){if(!drag)return;inst.fallbackYaw=drag.yaw+(e.clientX-drag.x)*.012;inst.fallbackPitch=Math.max(-1.25,Math.min(1.25,drag.pitch+(e.clientY-drag.y)*.01));requestSoftwareDraw()});
    function endDrag(){drag=null;requestSoftwareDraw()} model.addEventListener("pointerup",endDrag);model.addEventListener("pointercancel",endDrag);
    model.addEventListener("wheel",function(e){e.preventDefault();inst.fallbackZoom=Math.max(.62,Math.min(1.7,inst.fallbackZoom*(e.deltaY>0?.9:1.1)));requestSoftwareDraw()},{passive:false});
    el.querySelectorAll("[data-action=auto-rotate],[data-action=smart-orbit]").forEach(function(b){b.disabled=true;b.title=T("Manual rotation remains available in universal 3D mode", "يبقى التدوير اليدوي متاحاً في الوضع الثلاثي المتوافق")});
    var resize=function(){if(inst.dead||!box.clientWidth)return;sizeFallbackModel(inst);sizeAnnotation(inst,p.annotation);sizeTextLayer(inst)};
    if(window.ResizeObserver){var ro=new ResizeObserver(resize);ro.observe(box);inst.ro=ro}else{window.addEventListener("resize",resize);inst.ro={disconnect:function(){window.removeEventListener("resize",resize)}};}
  }
  function sizeFallbackModel(inst) {
    var c=inst.renderer.domElement,r=c.parentElement.getBoundingClientRect(),d=Math.min(devicePixelRatio||1,2),w=Math.max(320,Math.round(r.width||760)),h=Math.max(240,Math.round(r.height||320));
    c.width=Math.round(w*d);c.height=Math.round(h*d);c.style.width=w+"px";c.style.height=h+"px";inst.fallbackCtx.setTransform(d,0,0,d,0,0);drawFallbackModel(inst,w,h);
  }
  function drawFallbackModel(inst, width, height) {
    /* Software 3D renderer: projected geometry for browsers/devices without WebGL. */
    if(!inst||!inst.fallbackCtx)return;
    var c=inst.renderer.domElement,ctx=inst.fallbackCtx,d=Math.min(devicePixelRatio||1,2),w=width||c.width/d,h=height||c.height/d,p=inst.p,colors=p.colors||{},pipe=colors.pipe||"#64748b",left=colors.left||"#2563eb",right=colors.right||"#0f766e",raise=colors.raise||"#f59e0b",bolt=colors.bolt||"#334155",cx=w*.5,cy=h*.52;
    var yaw=inst.fallbackYaw==null?-.68:inst.fallbackYaw,pitch=inst.fallbackPitch==null?.42:inst.fallbackPitch,zoom=inst.fallbackZoom||1,scale=Math.min(w/8.4,h/5.8)*zoom,cosY=Math.cos(yaw),sinY=Math.sin(yaw),cosP=Math.cos(pitch),sinP=Math.sin(pitch),seg=w<520?28:40;
    function shade(hex,amt){var m=String(hex||'#64748b').match(/[0-9a-f]{6}/i);if(!m)return hex;var n=parseInt(m[0],16),r=Math.max(0,Math.min(255,(n>>16)+amt)),g=Math.max(0,Math.min(255,((n>>8)&255)+amt)),b=Math.max(0,Math.min(255,(n&255)+amt));return'#'+((1<<24)+(r<<16)+(g<<8)+b).toString(16).slice(1)}
    function pr(x,y,z){var x1=x*cosY+z*sinY,z1=-x*sinY+z*cosY,y1=y*cosP-z1*sinP,z2=y*sinP+z1*cosP,k=1/(1+z2*.025);return{x:cx+x1*scale*k,y:cy-y1*scale*k,z:z2}}
    function loop(x,r,n){var a=[],i;for(i=0;i<(n||48);i++){var q=i*Math.PI*2/(n||48);a.push(pr(x,Math.sin(q)*r,-Math.cos(q)*r))}return a}
    function path(a){ctx.beginPath();a.forEach(function(q,i){if(i)ctx.lineTo(q.x,q.y);else ctx.moveTo(q.x,q.y)});ctx.closePath()}
    function tube(x1,x2,r,col){var a=loop(x1,r,seg),b=loop(x2,r,seg);ctx.fillStyle=shade(col,-24);ctx.strokeStyle=shade(col,-52);ctx.lineWidth=1.4;for(var i=0;i<seg;i++){var j=(i+1)%seg;path([a[i],a[j],b[j],b[i]]);ctx.fill()}path(a);ctx.stroke();path(b);ctx.fillStyle=shade(col,10);ctx.fill();ctx.stroke()}
    function ring(x,ro,ri,depth,col,count,hole){tube(x-depth/2,x+depth/2,ro,col);var outer=loop(x+depth/2,ro,seg+8),inner=loop(x+depth/2,ri,seg+8);ctx.fillStyle=shade(col,18);ctx.strokeStyle=shade(col,-58);ctx.lineWidth=1.6;ctx.beginPath();outer.forEach(function(q,i){i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y)});ctx.closePath();inner.slice().reverse().forEach(function(q,i){if(!i)ctx.moveTo(q.x,q.y);else ctx.lineTo(q.x,q.y)});ctx.closePath();ctx.fill('evenodd');ctx.stroke();if(count){for(var k=0;k<count;k++){var an=k*Math.PI*2/count,bc=pr(x+depth*.53,Math.sin(an)*1.6,-Math.cos(an)*1.6),br=Math.max(2.1,(hole||.09)*scale*.62);ctx.beginPath();ctx.arc(bc.x,bc.y,br,0,Math.PI*2);ctx.fillStyle='#f8fafc';ctx.fill();ctx.strokeStyle=shade(bolt,-35);ctx.stroke()}}}
    function boltSet(count,r,x1,x2,rad){for(var k=0;k<count;k++){var an=k*Math.PI*2/count,y=Math.sin(an)*r,z=-Math.cos(an)*r,a=pr(x1,y,z),b=pr(x2,y,z);ctx.strokeStyle=bolt;ctx.lineWidth=Math.max(2,rad*scale);ctx.lineCap='round';ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b.x,b.y);ctx.stroke();[a,b].forEach(function(q){ctx.beginPath();ctx.arc(q.x,q.y,Math.max(2.6,rad*scale*1.45),0,Math.PI*2);ctx.fillStyle=shade(bolt,16);ctx.fill();ctx.strokeStyle=shade(bolt,-35);ctx.lineWidth=1;ctx.stroke()})}}
    function opening(x,r){var a=loop(x,r,seg+6);path(a);var g=ctx.createLinearGradient(0,cy-r*scale,0,cy+r*scale);g.addColorStop(0,'#182734');g.addColorStop(1,'#526779');ctx.fillStyle=g;ctx.fill();ctx.strokeStyle='#0f172a';ctx.lineWidth=1.4;ctx.stroke()}
    ctx.clearRect(0,0,w,h);var bg=ctx.createLinearGradient(0,0,0,h);bg.addColorStop(0,'#f8fafc');bg.addColorStop(1,'#e5edf5');ctx.fillStyle=bg;ctx.fillRect(0,0,w,h);ctx.strokeStyle='#d8e2ec';ctx.lineWidth=1;for(var gx=20;gx<w;gx+=40){ctx.beginPath();ctx.moveTo(gx,0);ctx.lineTo(gx,h);ctx.stroke()}for(var gy=20;gy<h;gy+=40){ctx.beginPath();ctx.moveTo(0,gy);ctx.lineTo(w,gy);ctx.stroke()}
    var inner=Math.max(.55,1.4-num(p.wall,8.5)*.03),count=Math.max(0,Math.min(48,Math.round(num(p.boltNo,8)))),hole=Math.max(.05,Math.min(.25,num(p.boltDia,15.61)/200));
    if(p.type==='pipe'){tube(-2.3,2.3,1.4,pipe);opening(2.305,inner)}
    else {var fl=Math.max(.18,num(p.f1,23.45)*.015),rf=Math.max(.05,num(p.raiseFace,3.2)*.01),gap=p.type==='half-flange'?0:Math.max(.1,num(p.gap,6.6)*.04),fr=Math.max(.18,num(p.f2,23.35)*.015),lx=-gap/2-rf-fl/2,rx=gap/2+fr/2; tube(lx-fl/2-1.8,lx-fl/2,1.3,pipe);ring(lx,2,inner,fl,left,count,hole);ring(lx+fl/2+rf/2,1.52,inner,rf,raise,0,0);if(p.type!=='half-flange'){ring(rx-fr/2-rf/2,1.52,inner,rf,raise,0,0);ring(rx,2,inner,fr,right,count,hole);tube(rx+fr/2,rx+fr/2+1.8,1.3,pipe);opening(rx+fr/2+1.805,inner)}var bx1=lx-fl/2-.12,bx2=p.type==='half-flange'?lx+fl/2+rf+.12:rx+fr/2+.12;boltSet(count,1.6,bx1,bx2,Math.max(.045,num(p.boltDia,15.61)/250))}
    ctx.fillStyle='#173d77';ctx.font='800 13px Arial, sans-serif';ctx.textAlign='center';ctx.fillText(p.type==='pipe'?T('PIPE · SOFTWARE 3D','أنبوب · ثلاثي برمجي'):p.type==='half-flange'?T('HALF FLANGE · SOFTWARE 3D','نصف فلنجة · ثلاثي برمجي'):T('DC FLANGE · SOFTWARE 3D','فلنجة DC · ثلاثي برمجي'),cx,25);ctx.fillStyle='#52657a';ctx.font='700 10px Arial, sans-serif';ctx.fillText(T('Drag to rotate · wheel/pinch to zoom','اسحب للتدوير · استخدم التكبير والتصغير'),cx,h-13);
  }
  function num(v, d) {
    var x = parseFloat(v);
    return isFinite(x) ? x : d;
  }
  function viewPosition(name, distance) {
    var d = distance || 8;
    if (name === "front") return new THREE.Vector3(d, 0, 0);
    if (name === "side") return new THREE.Vector3(0, 0, d);
    if (name === "top") return new THREE.Vector3(0, d, 0.001);
    return new THREE.Vector3(d * 0.64, d * 0.42, d * 0.64);
  }
  function saveViewState(inst) {
    if (!inst || inst.dead || inst.viewAnimating) return;
    clearTimeout(inst.viewSaveTimer);
    inst.viewSaveTimer = setTimeout(function () {
      if (inst.dead) return;
      inst.p.viewState = {
        position: inst.camera.position.toArray(),
        target: inst.controls.target.toArray(),
      };
      save();
    }, 180);
  }
  function animateView(inst, position, target, duration) {
    if (!inst) return;
    var from = inst.camera.position.clone(),
      fromTarget = inst.controls.target.clone(),
      to = position.clone(),
      toTarget = (target || new THREE.Vector3()).clone(),
      start = performance.now(),
      ms = duration == null ? 330 : duration;
    inst.viewAnimating = true;
    function step(now) {
      if (inst.dead) return;
      var t = Math.min(1, (now - start) / Math.max(1, ms)),
        ease = 1 - Math.pow(1 - t, 3);
      inst.camera.position.lerpVectors(from, to, ease);
      inst.controls.target.lerpVectors(fromTarget, toTarget, ease);
      inst.controls.update();
      if (t < 1) requestAnimationFrame(step);
      else {
        inst.viewAnimating = false;
        saveViewState(inst);
      }
    }
    requestAnimationFrame(step);
  }
  function fitSmartView(inst, preset) {
    if (!inst) return;
    if (inst.software3D) {
      var views={iso:[-.68,.42,1],front:[Math.PI/2,0,1.08],side:[0,0,1],top:[-.55,1.18,.92]},v=views[preset||"iso"]||views.iso;
      inst.fallbackYaw=v[0];inst.fallbackPitch=v[1];inst.fallbackZoom=v[2];drawFallbackModel(inst);return;
    }
    if (!inst.group) return;
    var box = new THREE.Box3().setFromObject(inst.group),
      sphere = box.getBoundingSphere(new THREE.Sphere()),
      center = sphere.center,
      fov = (inst.camera.fov * Math.PI) / 180,
      distance = Math.max(4.5, (sphere.radius / Math.sin(fov / 2)) * 1.18),
      direction;
    if (preset) direction = viewPosition(preset, 1).normalize();
    else direction = inst.camera.position.clone().sub(inst.controls.target).normalize();
    if (!isFinite(direction.x) || direction.lengthSq() < 0.1)
      direction = viewPosition("iso", 1).normalize();
    animateView(inst, center.clone().add(direction.multiplyScalar(distance)), center, 340);
  }
  function smartSnapView(inst) {
    if (!inst || !inst.p.viewSmartSnap || inst.viewAnimating || inst.controls.autoRotate) return;
    var target = inst.controls.target,
      v = inst.camera.position.clone().sub(target),
      distance = v.length(),
      direction = v.clone().normalize(),
      candidates = [
        new THREE.Vector3(1, 0, 0), new THREE.Vector3(-1, 0, 0),
        new THREE.Vector3(0, 1, 0), new THREE.Vector3(0, -1, 0),
        new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, 0, -1),
      ],
      best = null,
      dot = 0;
    candidates.forEach(function (x) {
      var d = direction.dot(x);
      if (d > dot) { dot = d; best = x; }
    });
    if (best && dot > Math.cos((11 * Math.PI) / 180))
      animateView(inst, target.clone().add(best.clone().multiplyScalar(distance)), target, 190);
    else saveViewState(inst);
  }
  function applyOrbitMode(inst) {
    if (!inst) return;
    var smart = inst.p.viewOrbitMode !== "free";
    inst.controls.minPolarAngle = smart ? 0.28 : 0.035;
    inst.controls.maxPolarAngle = smart ? Math.PI - 0.28 : Math.PI - 0.035;
    inst.controls.enablePan = true;
    inst.controls.rotateSpeed = smart ? 0.56 : 0.72;
  }
  function stepSmartView(inst, step) {
    if (!inst) return;
    if (inst.software3D) {
      if(step==="left")inst.fallbackYaw-=Math.PI/12;if(step==="right")inst.fallbackYaw+=Math.PI/12;
      if(step==="up")inst.fallbackPitch=Math.max(-1.25,inst.fallbackPitch-.18);if(step==="down")inst.fallbackPitch=Math.min(1.25,inst.fallbackPitch+.18);
      if(step==="in")inst.fallbackZoom=Math.min(1.7,inst.fallbackZoom*1.14);if(step==="out")inst.fallbackZoom=Math.max(.62,inst.fallbackZoom*.88);
      drawFallbackModel(inst);return;
    }
    var target = inst.controls.target.clone(),
      offset = inst.camera.position.clone().sub(target),
      spherical = new THREE.Spherical().setFromVector3(offset),
      angle = Math.PI / 12;
    if (step === "left") spherical.theta -= angle;
    if (step === "right") spherical.theta += angle;
    if (step === "up") spherical.phi -= angle * 0.72;
    if (step === "down") spherical.phi += angle * 0.72;
    if (step === "in") spherical.radius = Math.max(inst.controls.minDistance, spherical.radius * 0.82);
    if (step === "out") spherical.radius = Math.min(inst.controls.maxDistance, spherical.radius * 1.22);
    spherical.phi = Math.max(inst.controls.minPolarAngle, Math.min(inst.controls.maxPolarAngle, spherical.phi));
    animateView(inst, target.clone().add(new THREE.Vector3().setFromSpherical(spherical)), target, 220);
  }
  function init3D(el, p) {
    var box = el.querySelector(".df-webgl"),
      ann = el.querySelector(".df-annotation"),
      txt = el.querySelector(".df-text-layer"),
      scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8fafc);
    var camera = new THREE.PerspectiveCamera(
      40,
      Math.max(1, box.clientWidth) / Math.max(1, box.clientHeight),
      0.1,
      1000,
    );
    if (
      p.viewState &&
      Array.isArray(p.viewState.position) &&
      p.viewState.position.length === 3
    )
      camera.position.fromArray(p.viewState.position);
    else camera.position.copy(viewPosition("iso", 8));
    var lowGpu = (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4) || (navigator.deviceMemory && navigator.deviceMemory <= 4),
      renderer = new THREE.WebGLRenderer({
      antialias: !lowGpu,
      preserveDrawingBuffer: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, lowGpu ? 1 : 1.5));
    renderer.setSize(box.clientWidth, box.clientHeight);
    box.insertBefore(renderer.domElement, ann);
    var controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.rotateSpeed = 0.62;
    controls.zoomSpeed = 0.82;
    controls.panSpeed = 0.55;
    controls.minDistance = 3.5;
    controls.maxDistance = 18;
    controls.screenSpacePanning = true;
    controls.autoRotate = !!p.viewAutoRotate;
    controls.autoRotateSpeed = 1.15;
    if (p.viewState && Array.isArray(p.viewState.target))
      controls.target.fromArray(p.viewState.target);
    if (THREE.TOUCH) {
      controls.touches.ONE = THREE.TOUCH.ROTATE;
      controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    }
    scene.add(new THREE.AmbientLight(0xffffff, 0.88));
    var light = new THREE.DirectionalLight(0xffffff, 0.95);
    light.position.set(5, 6, 5);
    scene.add(light);
    var inst = {
      el: el,
      p: p,
      scene: scene,
      camera: camera,
      renderer: renderer,
      controls: controls,
      group: null,
      ann: ann,
      ctx: ann.getContext("2d"),
      txt: txt,
      tctx: txt.getContext("2d"),
      textMode: false,
      moveMode: false,
      textHits: [],
      dragText: null,
      drawTool: "orbit",
      undoStack: [],
      viewAnimating: false,
      viewSaveTimer: null,
      dead: false,
    };
    instances[p.id] = inst;
    applyOrbitMode(inst);
    sizeAnnotation(inst, p.annotation);
    sizeTextLayer(inst);
    setupDraw(inst);
    setupTextPlacement(inst);
    buildModel(inst);
    controls.addEventListener("end", function () {
      smartSnapView(inst);
    });
    renderer.domElement.addEventListener("dblclick", function () {
      fitSmartView(inst, "iso");
    });
    renderer.domElement.addEventListener("pointerdown", function (e) {
      if (inst.componentPick) inst.pickStart = { x: e.clientX, y: e.clientY };
    });
    renderer.domElement.addEventListener("pointerup", function (e) {
      if (!inst.componentPick || !inst.pickStart) return;
      var moved = Math.hypot(e.clientX - inst.pickStart.x, e.clientY - inst.pickStart.y);
      if (moved < 10) {
        var key = pickModelComponent(inst, e);
        if (key) activateAppearanceRow(inst, key);
      }
      inst.componentPick = false;
      inst.pickStart = null;
      inst.controls.enabled = true;
      var pickButton = inst.el.querySelector('[data-action="component-pick"]');
      if (pickButton) pickButton.classList.remove("active");
    });
    var ro = new ResizeObserver(function () {
      if (inst.dead || !box.clientWidth) return;
      camera.aspect = box.clientWidth / box.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(box.clientWidth, box.clientHeight);
      sizeAnnotation(inst, p.annotation);
      sizeTextLayer(inst);
    });
    ro.observe(box);
    inst.ro = ro;
    var lastFrame=0,frameNo=0,minFrame=lowGpu?42:32;
    function animate(now) {
      inst.raf = 0;
      if (inst.dead || !el.isConnected) return;
      var page = el.closest("main.page");
      if (document.hidden || (page && (page.classList.contains("hidden") || page.classList.contains("qc-life-suspended")))) {
        inst.lifecyclePaused = true;
        return;
      }
      inst.lifecyclePaused = false;
      if(!lastFrame || now-lastFrame>=minFrame){
        lastFrame=now;frameNo++;controls.update();renderer.render(scene,camera);
        if(frameNo%3===1)positionModelCallouts(inst);
        var needle=el.querySelector(".df-needle");
        if(needle&&frameNo%3===1)needle.style.transform="rotate("+(controls.getAzimuthalAngle()*180)/Math.PI+"deg)";
      }
      inst.raf = requestAnimationFrame(animate);
    }
    inst.resumeAnimation = function () {
      if (!inst.dead && !inst.raf) inst.raf = requestAnimationFrame(animate);
    };
    inst.resumeAnimation();
  }
  function sizeAnnotation(inst, src) {
    var c = inst.ann,
      r = c.getBoundingClientRect(),
      d = Math.min(devicePixelRatio || 1, 2);
    if (r.width < 2) return;
    c.width = Math.round(r.width * d);
    c.height = Math.round(r.height * d);
    inst.ctx.setTransform(d, 0, 0, d, 0, 0);
    if (src) {
      var im = new Image();
      im.onload = function () {
        inst.ctx.drawImage(im, 0, 0, r.width, r.height);
      };
      im.src = src;
    }
  }
  function sketchSnapshot(inst) {
    return {
      annotation: inst.p.annotation || "",
      texts: JSON.parse(JSON.stringify(inst.p.textAnnotations || [])),
      auto: !!inst.p.autoText,
      ax: num(inst.p.autoTextX, 0.5),
      ay: num(inst.p.autoTextY, 0.13),
    };
  }
  function pushSketchUndo(inst) {
    inst.undoStack.push(sketchSnapshot(inst));
    if (inst.undoStack.length > 8) inst.undoStack.shift();
  }
  function paintShape(ctx, tool, a, b, p) {
    ctx.strokeStyle = p.drawColor;
    ctx.fillStyle = p.drawColor;
    ctx.lineWidth = num(p.drawSize, 4);
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.beginPath();
    if (tool === "circle") {
      var rx = Math.abs(b.x - a.x) / 2,
        ry = Math.abs(b.y - a.y) / 2;
      ctx.ellipse(
        (a.x + b.x) / 2,
        (a.y + b.y) / 2,
        Math.max(1, rx),
        Math.max(1, ry),
        0,
        0,
        Math.PI * 2,
      );
      ctx.stroke();
      return;
    }
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    if (tool === "arrow") {
      var ang = Math.atan2(b.y - a.y, b.x - a.x),
        len = Math.max(10, num(p.drawSize, 4) * 4);
      ctx.beginPath();
      ctx.moveTo(b.x, b.y);
      ctx.lineTo(
        b.x - len * Math.cos(ang - Math.PI / 6),
        b.y - len * Math.sin(ang - Math.PI / 6),
      );
      ctx.lineTo(
        b.x - len * Math.cos(ang + Math.PI / 6),
        b.y - len * Math.sin(ang + Math.PI / 6),
      );
      ctx.closePath();
      ctx.fill();
    }
  }
  function setupDraw(inst) {
    var c = inst.ann,
      down = false,
      start,
      last,
      base;
    function pos(e) {
      var r = c.getBoundingClientRect();
      return { x: e.clientX - r.left, y: e.clientY - r.top };
    }
    c.onpointerdown = function (e) {
      if (!c.classList.contains("active")) return;
      down = true;
      start = last = pos(e);
      base = inst.ctx.getImageData(0, 0, c.width, c.height);
      pushSketchUndo(inst);
      c.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    c.onpointermove = function (e) {
      if (!down) return;
      var q = pos(e),
        p = inst.p,
        tool = inst.drawTool;
      if (tool === "freehand") {
        inst.ctx.strokeStyle = p.drawColor;
        inst.ctx.lineWidth = num(p.drawSize, 4);
        inst.ctx.lineCap = "round";
        inst.ctx.lineJoin = "round";
        inst.ctx.beginPath();
        inst.ctx.moveTo(last.x, last.y);
        inst.ctx.lineTo(q.x, q.y);
        inst.ctx.stroke();
        last = q;
      } else {
        inst.ctx.putImageData(base, 0, 0);
        paintShape(inst.ctx, tool, start, q, p);
      }
      e.preventDefault();
    };
    c.onpointerup = c.onpointercancel = function (e) {
      if (!down) return;
      var q = pos(e);
      if (inst.drawTool !== "freehand") {
        inst.ctx.putImageData(base, 0, 0);
        paintShape(inst.ctx, inst.drawTool, start, q, inst.p);
      }
      down = false;
      inst.p.annotation = c.toDataURL("image/png");
      save();
    };
  }
  function autoTextLines(p) {
    var component =
        p.type === "pipe"
          ? T("Pipe", "أنبوب")
          : p.type === "half-flange"
            ? T("Half Flange", "فلنجة مفردة")
            : T("Double Flange", "فلنجتان"),
      dims =
        p.type === "pipe"
          ? [
              T("Length", "الطول") + ": " + p.gap + " mm",
              T("OD", "القطر الخارجي") + ": " + p.boltDia + " mm",
              T("Wall", "الجدار") + ": " + p.wall + " mm",
            ]
          : p.type === "half-flange"
            ? [
                "F1: " + p.f1 + " mm",
                T("Raise Face", "البروز") + ": " + p.gap + " mm",
                T("Bolts", "البراغي") + ": " + p.boltNo,
              ]
            : [
                "F1: " + p.f1 + " mm",
                T("Gap", "الفجوة") + ": " + p.gap + " mm",
                "F2: " + p.f2 + " mm",
              ];
    var head = [
      p.project && T("Project", "المشروع") + ": " + p.project,
      p.tieIn && T("Tie-in", "الربط") + ": " + p.tieIn,
      component,
    ].filter(Boolean);
    return head.concat(dims);
  }
  function presetPoint(k) {
    return (
      {
        top: [0.5, 0.13],
        bottom: [0.5, 0.87],
        left: [0.16, 0.5],
        right: [0.84, 0.5],
        center: [0.5, 0.5],
      }[k] || [0.5, 0.13]
    );
  }
  function wrapText(ctx, text, max) {
    var words = String(text || "").split(/\s+/),
      lines = [],
      line = "";
    words.forEach(function (w) {
      var q = line ? line + " " + w : w;
      if (ctx.measureText(q).width > max && line) {
        lines.push(line);
        line = w;
      } else line = q;
    });
    if (line) lines.push(line);
    return lines.length ? lines : [""];
  }
  function paintLabel(ctx, lines, x, y, size, color, w, h) {
    ctx.save();
    ctx.font = "800 " + size + "px " + (ar() ? "Arial" : "Inter, Arial");
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    var all = [];
    lines.forEach(function (t) {
      wrapText(ctx, t, Math.min(360, w * 0.72)).forEach(function (z) {
        all.push(z);
      });
    });
    var lh = size * 1.3,
      pad = 8,
      bw = Math.min(
        w - 12,
        Math.max.apply(
          null,
          all
            .map(function (t) {
              return ctx.measureText(t).width;
            })
            .concat([40]),
        ) +
          pad * 2,
      ),
      bh = all.length * lh + pad * 2,
      px = Math.max(bw / 2 + 5, Math.min(w - bw / 2 - 5, x)),
      py = Math.max(bh / 2 + 5, Math.min(h - bh / 2 - 5, y));
    ctx.fillStyle = "rgba(255,255,255,.88)";
    ctx.strokeStyle = "rgba(15,23,42,.28)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(px - bw / 2, py - bh / 2, bw, bh, 7);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = color || "#0f172a";
    all.forEach(function (t, i) {
      ctx.fillText(t, px, py - bh / 2 + pad + lh * (i + 0.5));
    });
    ctx.restore();
    return {
      x1: px - bw / 2,
      y1: py - bh / 2,
      x2: px + bw / 2,
      y2: py + bh / 2,
    };
  }
  function renderTextLayer(inst) {
    if (!inst || !inst.txt) return;
    var c = inst.txt,
      r = c.getBoundingClientRect(),
      d = Math.min(devicePixelRatio || 1, 2),
      ctx = inst.tctx,
      p = inst.p;
    if (r.width < 2) return;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    ctx.clearRect(0, 0, r.width, r.height);
    inst.textHits = [];
    (p.textAnnotations || []).forEach(function (a, i) {
      var box = paintLabel(
        ctx,
        String(a.text || "").split(/\n/),
        a.x * r.width,
        a.y * r.height,
        num(a.size, 18),
        a.color,
        r.width,
        r.height,
      );
      inst.textHits.push({ kind: "manual", index: i, box: box });
    });
    if (p.autoText) {
      var box = paintLabel(
        ctx,
        autoTextLines(p),
        num(p.autoTextX, 0.5) * r.width,
        num(p.autoTextY, 0.13) * r.height,
        num(p.textSize, 18),
        p.drawColor,
        r.width,
        r.height,
      );
      inst.textHits.push({ kind: "auto", box: box });
    }
  }
  function sizeTextLayer(inst) {
    var c = inst.txt,
      r = c.getBoundingClientRect(),
      d = Math.min(devicePixelRatio || 1, 2);
    if (r.width < 2) return;
    c.width = Math.round(r.width * d);
    c.height = Math.round(r.height * d);
    renderTextLayer(inst);
  }
  function addTextAt(p, x, y) {
    var inst = instances[p.id];
    if (inst) pushSketchUndo(inst);
    var text = String(p.textDraft || "").trim();
    if (!text) {
      alert(T("Write the text first.", "اكتب النص أولاً."));
      return false;
    }
    p.textAnnotations.push({
      text: text,
      x: x,
      y: y,
      color: p.drawColor,
      size: p.textSize,
    });
    save();
    renderTextLayer(instances[p.id]);
    return true;
  }
  function addTextPreset(page, i) {
    addTextAt(S.pages[i], 0.5, 0.5);
  }
  function resetTextModes(inst) {
    inst.textMode = false;
    inst.moveMode = false;
    inst.dragText = null;
    inst.txt.classList.remove("text-active", "move-active");
    inst.controls.enabled = true;
    var pb = inst.el.querySelector("[data-action=place-text]"),
      mb = inst.el.querySelector("[data-action=move-text]");
    if (pb) {
      pb.classList.remove("active");
      pb.textContent = "⌖ " + T("Place by click", "وضع بالنقر");
    }
    if (mb) {
      mb.classList.remove("active");
      mb.textContent = "↔ " + T("Move text", "تحريك النصوص");
    }
  }
  function setupTextPlacement(inst) {
    function point(e) {
      var r = inst.txt.getBoundingClientRect();
      return {
        x: e.clientX - r.left,
        y: e.clientY - r.top,
        nx: (e.clientX - r.left) / r.width,
        ny: (e.clientY - r.top) / r.height,
        r: r,
      };
    }
    inst.txt.onpointerdown = function (e) {
      var q = point(e);
      if (inst.textMode) {
        if (addTextAt(inst.p, q.nx, q.ny)) {
          resetTextModes(inst);
          setToolbarActive(inst.el, "orbit");
        }
        e.preventDefault();
        return;
      }
      if (!inst.moveMode) return;
      var hit = inst.textHits
        .slice()
        .reverse()
        .find(function (h) {
          return (
            q.x >= h.box.x1 &&
            q.x <= h.box.x2 &&
            q.y >= h.box.y1 &&
            q.y <= h.box.y2
          );
        });
      if (!hit) return;
      pushSketchUndo(inst);
      inst.dragText = hit;
      inst.txt.setPointerCapture(e.pointerId);
      e.preventDefault();
    };
    inst.txt.onpointermove = function (e) {
      if (!inst.moveMode || !inst.dragText) return;
      var q = point(e),
        x = Math.max(0.03, Math.min(0.97, q.nx)),
        y = Math.max(0.03, Math.min(0.97, q.ny));
      if (inst.dragText.kind === "auto") {
        inst.p.autoTextX = x;
        inst.p.autoTextY = y;
      } else {
        var a = inst.p.textAnnotations[inst.dragText.index];
        if (a) {
          a.x = x;
          a.y = y;
        }
      }
      renderTextLayer(inst);
      e.preventDefault();
    };
    inst.txt.onpointerup = inst.txt.onpointercancel = function () {
      if (!inst.dragText) return;
      inst.dragText = null;
      save();
    };
  }
  function toggleTextPlacement(page, i, b) {
    var p = S.pages[i],
      inst = instances[p.id];
    if (!String(p.textDraft || "").trim())
      return alert(T("Write the text first.", "اكتب النص أولاً."));
    var on = !inst.textMode;
    resetTextModes(inst);
    if (on) {
      inst.textMode = true;
      inst.txt.classList.add("text-active");
      inst.controls.enabled = false;
      b.classList.add("active");
      b.textContent = "✕ " + T("Cancel placement", "إلغاء الوضع");
      inst.ann.classList.remove("active");
      var db = page.querySelector("[data-action=draw]");
      if (db) {
        db.classList.remove("active");
        db.textContent = T("Enable Draw Mode", "تفعيل الرسم");
      }
    }
  }
  function toggleTextMovement(page, i, b) {
    var inst = instances[S.pages[i].id],
      on = !inst.moveMode;
    resetTextModes(inst);
    if (on) {
      inst.moveMode = true;
      inst.txt.classList.add("move-active");
      inst.controls.enabled = false;
      b.classList.add("active");
      b.textContent = "✓ " + T("Finish moving", "إنهاء التحريك");
      inst.ann.classList.remove("active");
      var db = page.querySelector("[data-action=draw]");
      if (db) {
        db.classList.remove("active");
        db.textContent = T("Enable Draw Mode", "تفعيل الرسم");
      }
    }
  }
  function toggleAutoText(page, i, b) {
    var p = S.pages[i],
      inst = instances[p.id];
    if (inst) pushSketchUndo(inst);
    p.autoText = !p.autoText;
    b.classList.toggle("active", p.autoText);
    save();
    renderTextLayer(instances[p.id]);
  }
  function undoText(page, i) {
    var p = S.pages[i];
    p.textAnnotations.pop();
    save();
    renderTextLayer(instances[p.id]);
  }
  function clearText(page, i) {
    var p = S.pages[i];
    p.textAnnotations = [];
    p.autoText = false;
    save();
    renderTextLayer(instances[p.id]);
    var b = page.querySelector("[data-action=toggle-auto-text]");
    if (b) b.classList.remove("active");
  }
  function validHex(v) {
    v = String(v || "").trim();
    if (!/^#[0-9a-f]{6}$/i.test(v)) return "";
    return v.toLowerCase();
  }
  function renderRecentColors(dialog, p) {
    var box = dialog.querySelector("[data-recent-colors]"),
      empty = dialog.querySelector(".df-no-recent");
    if (!box) return;
    box.innerHTML = (p.recentColors || [])
      .map(function (c) {
        return (
          '<button type="button" data-action="pick-color" data-palette-color="' +
          esc(c) +
          '" title="' +
          esc(c) +
          '" style="--paint:' +
          esc(c) +
          '"></button>'
        );
      })
      .join("");
    if (empty)
      empty.style.display =
        p.recentColors && p.recentColors.length ? "none" : "block";
  }
  function switchColorTab(page, tab) {
    var d = page.querySelector("[data-color-dialog]");
    if (!d) return;
    d.querySelectorAll("[data-palette-tab]").forEach(function (x) {
      x.classList.toggle("active", x.dataset.paletteTab === tab);
    });
    d.querySelectorAll("[data-color-panel]").forEach(function (x) {
      x.classList.toggle("active", x.dataset.colorPanel === tab);
    });
    if (tab === "recent") renderRecentColors(d, S.pages[+page.dataset.page]);
  }
  function openColorDialog(page, i, b) {
    var p = S.pages[i],
      d = page.querySelector("[data-color-dialog]"),
      key = b.dataset.modelColor || "",
      color = key ? p.colors[key] : p.drawColor;
    d.dataset.colorKind = key ? "model" : "draw";
    d.dataset.colorKey = key;
    var custom = d.querySelector("[data-palette-custom]"),
      hex = d.querySelector("[data-palette-hex]"),
      preview = d.querySelector(".df-color-preview");
    custom.value = color;
    hex.value = String(color).toUpperCase();
    preview.style.background = color;
    renderRecentColors(d, p);
    switchColorTab(page, "all");
    d.classList.remove("hidden");
  }
  function closeColorDialog(page) {
    var d = page && page.querySelector("[data-color-dialog]");
    if (d) d.classList.add("hidden");
  }
  function applyDialogColor(page, i, color) {
    color = validHex(color);
    if (!color) return;
    var p = S.pages[i],
      d = page.querySelector("[data-color-dialog]"),
      key = d.dataset.colorKey;
    if (d.dataset.colorKind === "model" && key) {
      p.colors[key] = color;
      var btn = page.querySelector('[data-model-color="' + key + '"]');
      if (btn) {
        btn.querySelector("i").style.background = color;
        btn.querySelector("span").textContent = color.toUpperCase();
      }
      if (instances[p.id]) updateModel(page, p);
    } else {
      p.drawColor = color;
      var sw = page.querySelector("[data-color-target=drawColor] i");
      if (sw) sw.style.background = color;
    }
    p.recentColors = (p.recentColors || []).filter(function (x) {
      return x !== color;
    });
    p.recentColors.unshift(color);
    p.recentColors = p.recentColors.slice(0, 12);
    save();
    closeColorDialog(page);
  }
  function applyCustomDialogColor(page, i) {
    var d = page.querySelector("[data-color-dialog]"),
      hex = d.querySelector("[data-palette-hex]"),
      picker = d.querySelector("[data-palette-custom]"),
      color = validHex(hex.value) || validHex(picker.value);
    if (!color)
      return alert(T("Enter a valid HEX color.", "أدخل لون HEX صحيح."));
    applyDialogColor(page, i, color);
  }
  function setToolbarActive(page, tool) {
    page
      .querySelectorAll(".df-sketch-toolbar [data-tool]")
      .forEach(function (x) {
        x.classList.toggle("active", x.dataset.tool === tool);
      });
  }
  function setSketchTool(page, i, tool, b) {
    var p = S.pages[i],
      inst = instances[p.id],
      pop = page.querySelector(".df-text-popover");
    inst.ann.classList.remove("active");
    resetTextModes(inst);
    inst.drawTool = tool;
    setToolbarActive(page, tool);
    if (pop) pop.classList.add("hidden");
    if (tool === "orbit") {
      inst.controls.enabled = true;
      return;
    }
    if (tool === "move") {
      inst.moveMode = true;
      inst.txt.classList.add("move-active");
      inst.controls.enabled = false;
      return;
    }
    if (tool === "text") {
      inst.controls.enabled = true;
      if (pop) pop.classList.remove("hidden");
      var inp = pop && pop.querySelector("[data-df=textDraft]");
      if (inp)
        setTimeout(function () {
          inp.focus();
        }, 0);
      return;
    }
    inst.ann.classList.add("active");
    inst.controls.enabled = false;
  }
  function armTextPlacement(page, i) {
    var p = S.pages[i],
      inst = instances[p.id];
    if (!String(p.textDraft || "").trim())
      return alert(T("Write the text first.", "اكتب النص أولاً."));
    resetTextModes(inst);
    inst.textMode = true;
    inst.txt.classList.add("text-active");
    inst.controls.enabled = false;
    var pop = page.querySelector(".df-text-popover");
    if (pop) pop.classList.add("hidden");
    setToolbarActive(page, "text");
  }
  function cycleSketchSize(page, i, b) {
    var p = S.pages[i],
      sizes = ["2", "4", "6"],
      n = (sizes.indexOf(String(p.drawSize)) + 1) % sizes.length;
    p.drawSize = sizes[n];
    var x = b.querySelector("[data-stroke-size]");
    if (x) x.textContent = p.drawSize;
    save();
  }
  function undoSketch(page, i) {
    var p = S.pages[i],
      inst = instances[p.id],
      snap = inst.undoStack.pop();
    if (!snap) return;
    p.annotation = snap.annotation;
    p.textAnnotations = snap.texts;
    p.autoText = snap.auto;
    p.autoTextX = snap.ax;
    p.autoTextY = snap.ay;
    sizeAnnotation(inst, p.annotation);
    renderTextLayer(inst);
    var ab = page.querySelector("[data-action=toggle-auto-text]");
    if (ab) ab.classList.toggle("active", p.autoText);
    save();
  }
  function clearSketch(page, i) {
    if (
      !confirm(
        T(
          "Clear all drawing and text from this sketch?",
          "مسح كل الرسم والنص من هذا السكيتش؟",
        ),
      )
    )
      return;
    var p = S.pages[i],
      inst = instances[p.id];
    pushSketchUndo(inst);
    inst.ctx.clearRect(0, 0, inst.ann.width, inst.ann.height);
    p.annotation = "";
    p.textAnnotations = [];
    p.autoText = false;
    renderTextLayer(inst);
    var ab = page.querySelector("[data-action=toggle-auto-text]");
    if (ab) ab.classList.remove("active");
    save();
  }
  function toggleDraw(page, b) {
    var p = S.pages[+page.dataset.page],
      inst = instances[p.id],
      on = !inst.ann.classList.contains("active");
    resetTextModes(inst);
    inst.ann.classList.toggle("active", on);
    inst.controls.enabled = !on;
    b.classList.toggle("active", on);
    b.textContent = on
      ? T("Disable Draw Mode", "إيقاف الرسم")
      : T("Enable Draw Mode", "تفعيل الرسم");
  }
  function clearDraw(page, i) {
    var p = S.pages[i],
      inst = instances[p.id];
    inst.ctx.clearRect(0, 0, inst.ann.width, inst.ann.height);
    p.annotation = "";
    save();
  }
  function updateModel(el, p) {
    var inst = instances[p.id];
    if (inst) {
      inst.p = p;
      buildModel(inst);
    }
    var a = el.querySelector("[data-banner=f1]"),
      g = el.querySelector("[data-banner=gap]"),
      f = el.querySelector("[data-banner=f2]");
    if (p.type === "pipe") {
      a.textContent = "Wall: " + p.wall + " mm";
      g.textContent = "Length: " + p.gap + " mm";
      f.textContent = "";
    } else if (p.type === "half-flange") {
      a.textContent = "Flange: " + p.f1 + " mm";
      g.textContent = "Raise Face: " + p.gap + " mm";
      f.textContent = "";
    } else {
      a.textContent = "F1: " + p.f1 + " mm";
      g.textContent = "Gap: " + p.gap + " mm";
      f.textContent = "F2: " + p.f2 + " mm";
    }
  }
  function pipeMesh(length, outer, inner, mat) {
    var s = new THREE.Shape();
    s.absarc(0, 0, outer, 0, Math.PI * 2, false);
    var h = new THREE.Path();
    h.absarc(0, 0, inner, 0, Math.PI * 2, true);
    s.holes.push(h);
    var g = new THREE.ExtrudeGeometry(s, {
      steps: 1,
      depth: length,
      bevelEnabled: false,
    });
    g.center();
    var m = new THREE.Mesh(g, mat);
    m.rotation.y = Math.PI / 2;
    return m;
  }
  function ringMesh(thick, outer, inner, mat, boltCount, boltR) {
    var s = new THREE.Shape();
    s.absarc(0, 0, outer, 0, Math.PI * 2, false);
    var h = new THREE.Path();
    h.absarc(0, 0, inner, 0, Math.PI * 2, true);
    s.holes.push(h);
    if (boltCount)
      for (var i = 0; i < boltCount; i++) {
        var a = (i / boltCount) * Math.PI * 2,
          b = new THREE.Path();
        b.absarc(
          Math.cos(a) * 1.6,
          Math.sin(a) * 1.6,
          boltR,
          0,
          Math.PI * 2,
          true,
        );
        s.holes.push(b);
      }
    var g = new THREE.ExtrudeGeometry(s, {
      steps: 1,
      depth: thick,
      bevelEnabled: !!boltCount,
      bevelThickness: 0.02,
      bevelSize: 0.02,
      bevelSegments: 2,
    });
    g.center();
    var m = new THREE.Mesh(g, mat);
    m.rotation.y = Math.PI / 2;
    return m;
  }
  function mat(c, metal) {
    return new THREE.MeshStandardMaterial({
      color: c,
      metalness: metal || 0.4,
      roughness: 0.25,
      side: THREE.DoubleSide,
    });
  }
  var COMPONENT_KEYS = ["left", "right", "raise", "pipe", "bolt", "compass"];
  function componentBox(inst, key) {
    var box = new THREE.Box3(), found = false;
    if (!inst || !inst.group) return null;
    inst.group.updateMatrixWorld(true);
    inst.group.traverse(function (o) {
      if (o.name === key) {
        var b = new THREE.Box3().setFromObject(o);
        if (!b.isEmpty()) { box.union(b); found = true; }
      }
    });
    return found ? box : null;
  }
  function applyComponentVisibility(inst) {
    if (!inst || !inst.group) return;
    var visible = inst.p.componentVisible || {};
    inst.group.traverse(function (o) {
      if (COMPONENT_KEYS.indexOf(o.name) >= 0) o.visible = visible[o.name] !== false;
    });
    var compass = inst.el.querySelector(".df-compass");
    if (compass) compass.style.display = visible.compass === false ? "none" : "block";
  }
  function updateModelCallouts(inst, rebuild) {
    if (!inst) return;
    var host = inst.el.querySelector(".df-model-callouts");
    if (!host) return;
    host.classList.toggle("hidden", !inst.p.showModelLabels);
    if (!inst.p.showModelLabels) return;
    if (rebuild || !inst.calloutPoints) {
      inst.calloutPoints = {};
      host.innerHTML = "";
      ["left", "right", "raise", "pipe", "bolt"].forEach(function (key) {
        var box = componentBox(inst, key);
        if (!box || inst.p.componentVisible[key] === false) return;
        inst.calloutPoints[key] = box.getCenter(new THREE.Vector3());
        var tag = document.createElement("span");
        tag.dataset.componentCallout = key;
        tag.style.setProperty("--component-color", inst.p.colors[key] || "#2563eb");
        tag.textContent = inst.p.colorLabels[key] || key;
        host.appendChild(tag);
      });
    } else {
      host.querySelectorAll("[data-component-callout]").forEach(function (tag) {
        var key = tag.dataset.componentCallout;
        tag.textContent = inst.p.colorLabels[key] || key;
        tag.style.setProperty("--component-color", inst.p.colors[key] || "#2563eb");
      });
    }
  }
  function positionModelCallouts(inst) {
    if (!inst || !inst.p.showModelLabels || !inst.calloutPoints) return;
    var host = inst.el.querySelector(".df-model-callouts"), box = inst.el.querySelector(".df-webgl");
    if (!host || !box) return;
    var w = box.clientWidth, h = box.clientHeight;
    host.querySelectorAll("[data-component-callout]").forEach(function (tag) {
      var point = inst.calloutPoints[tag.dataset.componentCallout];
      if (!point) return;
      var v = point.clone().project(inst.camera), on = v.z > -1 && v.z < 1;
      tag.style.display = on ? "block" : "none";
      tag.style.left = ((v.x * 0.5 + 0.5) * w) + "px";
      tag.style.top = ((-v.y * 0.5 + 0.5) * h) + "px";
    });
  }
  function drawModelLabelsCapture(ctx, inst, w, h) {
    if (!ctx || !inst || !inst.p.showModelLabels || !inst.calloutPoints) return;
    ctx.save();
    ctx.font = "800 14px Inter, Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    Object.keys(inst.calloutPoints).forEach(function (key) {
      if (inst.p.componentVisible[key] === false) return;
      var v = inst.calloutPoints[key].clone().project(inst.camera);
      if (v.z <= -1 || v.z >= 1) return;
      var x = (v.x * 0.5 + 0.5) * w, y = (-v.y * 0.5 + 0.5) * h, text = inst.p.colorLabels[key] || key, tw = Math.min(230, ctx.measureText(text).width + 18), th = 26;
      ctx.fillStyle = "rgba(255,255,255,.92)";
      ctx.strokeStyle = inst.p.colors[key] || "#2563eb";
      ctx.lineWidth = 2;
      ctx.beginPath();
      if (ctx.roundRect) ctx.roundRect(x - tw / 2, y - th / 2, tw, th, 6);
      else ctx.rect(x - tw / 2, y - th / 2, tw, th);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = "#0f172a";
      ctx.fillText(text, x, y, tw - 10);
    });
    ctx.restore();
  }
  function focusComponent(inst, key) {
    var box = componentBox(inst, key);
    if (!box) return;
    var sphere = box.getBoundingSphere(new THREE.Sphere()), direction = inst.camera.position.clone().sub(inst.controls.target).normalize(), distance = Math.max(2.8, sphere.radius / Math.sin(inst.camera.fov * Math.PI / 360) * 1.45);
    animateView(inst, sphere.center.clone().add(direction.multiplyScalar(distance)), sphere.center, 300);
  }
  function pickModelComponent(inst, event) {
    if (!inst || !inst.group) return "";
    var rect = inst.renderer.domElement.getBoundingClientRect(), mouse = new THREE.Vector2(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1), ray = new THREE.Raycaster();
    ray.setFromCamera(mouse, inst.camera);
    var hits = ray.intersectObject(inst.group, true), key = "";
    for (var i = 0; i < hits.length && !key; i++) {
      var o = hits[i].object;
      while (o && o !== inst.group) {
        if (["left", "right", "raise", "pipe", "bolt"].indexOf(o.name) >= 0) { key = o.name; break; }
        o = o.parent;
      }
    }
    return key;
  }
  function activateAppearanceRow(inst, key) {
    if (!inst || !key) return;
    var details = inst.el.querySelector(".df-model-colors"), row = inst.el.querySelector('[data-component-row="' + key + '"]');
    if (details) details.open = true;
    inst.el.querySelectorAll(".df-appearance-row").forEach(function (x) { x.classList.toggle("active", x === row); });
    highlightComponent(inst, key, true);
    setTimeout(function () { highlightComponent(inst, key, false); }, 900);
    if (row) row.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }
  function highlightComponent(inst, key, on) {
    if (!inst || !inst.group) return;
    inst.group.traverse(function (o) {
      if (!o.material || !o.material.emissive) return;
      var belongs = o.name === key || (o.parent && o.parent.name === key);
      if (belongs && on) {
        if (o.userData.appearanceEmissive == null) o.userData.appearanceEmissive = o.material.emissive.getHex();
        o.material.emissive.setHex(0x3949ab);
      } else if (o.userData.appearanceEmissive != null) o.material.emissive.setHex(o.userData.appearanceEmissive);
    });
  }
  function addBoltSet(group, count, radius, boltR, length, centerX, material) {
    if (!count) return;
    var headDepth = Math.max(0.1, boltR * 0.7);
    for (var j = 0; j < count; j++) {
      var an = (j / count) * Math.PI * 2,
        y = Math.sin(an) * radius,
        z = -Math.cos(an) * radius,
        boltGroup = new THREE.Group(),
        shaft = new THREE.Mesh(
          new THREE.CylinderGeometry(boltR, boltR, length, count > 24 ? 12 : 18),
          material,
        ),
        headA = new THREE.Mesh(
          new THREE.CylinderGeometry(boltR * 1.58, boltR * 1.58, headDepth, 6),
          material,
        ),
        headB = new THREE.Mesh(
          new THREE.CylinderGeometry(boltR * 1.48, boltR * 1.48, headDepth, 6),
          material,
        );
      shaft.rotation.z = Math.PI / 2;
      headA.rotation.z = Math.PI / 2;
      headB.rotation.z = Math.PI / 2;
      headA.position.x = -length / 2 - headDepth / 2;
      headB.position.x = length / 2 + headDepth / 2;
      boltGroup.add(shaft, headA, headB);
      boltGroup.name = "bolt";
      boltGroup.position.set(centerX || 0, y, z);
      group.add(boltGroup);
    }
  }
  function buildModel(inst) {
    if (inst && inst.fallback2D) { drawFallbackModel(inst); return; }
    if (inst.group) {
      inst.scene.remove(inst.group);
      inst.group.traverse(function (o) {
        if (o.geometry && o.geometry.dispose) o.geometry.dispose();
        if (o.material) {
          var materials = Array.isArray(o.material) ? o.material : [o.material];
          materials.forEach(function (m) { if (m && m.dispose) m.dispose(); });
        }
      });
    }
    var p = inst.p,
      g = new THREE.Group(),
      inner = Math.max(0.55, 1.4 - num(p.wall, 8.5) * 0.03),
      pm = mat(p.colors.pipe, 0.5),
      legend = [];
    if (p.type === "pipe") {
      var onlyPipe = pipeMesh(4.6, 1.4, inner, pm);
      onlyPipe.name = "pipe";
      g.add(onlyPipe);
      legend.push([p.colors.pipe, p.colorLabels.pipe || "Pipe", "pipe"]);
    } else {
      var count = Math.max(0, Math.min(64, Math.round(num(p.boltNo, 4)))),
        boltCircle = 1.6,
        requestedHole = Math.max(0.06, num(p.boltDia, 15.61) / 200),
        spacingLimit = count > 1 ? 2 * boltCircle * Math.sin(Math.PI / count) * 0.38 : 0.3,
        hole = Math.min(0.3, requestedHole, Math.max(0.045, spacingLimit)),
        fl = num(p.f1, 23.45) * 0.015,
        rf = Math.max(0.03, num(p.raiseFace, 3.2) * 0.01),
        left = ringMesh(fl, 2, inner, mat(p.colors.left), count, hole);
      left.name = "left";
      left.position.x = -fl / 2;
      var face = ringMesh(rf, 1.5, inner, mat(p.colors.raise, 0.5));
      face.name = "raise";
      face.position.x = rf / 2;
      var pp = pipeMesh(1.8, 1.3, inner, pm);
      pp.position.x = -fl - 0.9;
      var lg = new THREE.Group();
      lg.name = "leftAssembly";
      pp.name = "pipe";
      lg.add(left, face, pp);
      var bm = mat(p.colors.bolt, 0.8),
        br = Math.min(hole * 0.88, Math.max(0.055, num(p.boltDia, 15.61) / 250));
      if (p.type === "half-flange") {
        g.add(lg);
        addBoltSet(g, count, boltCircle, br, fl + rf + 0.2, (-fl + rf) / 2, bm);
        legend.push(
          [p.colors.left, p.colorLabels.left || "L. Flange", "left"],
          [p.colors.raise, p.colorLabels.raise || "Raise Face", "raise"],
          [p.colors.bolt, p.colorLabels.bolt || "Bolt", "bolt"],
        );
      } else {
        var gap = Math.max(0.1, num(p.gap, 6.6) * 0.04),
          fr = num(p.f2, 23.35) * 0.015,
          right = ringMesh(fr, 2, inner, mat(p.colors.right), count, hole),
          face2 = ringMesh(rf, 1.5, inner, mat(p.colors.raise, 0.5)),
          pp2 = pipeMesh(1.8, 1.3, inner, pm),
          rg = new THREE.Group();
        right.name = "right";
        face2.name = "raise";
        rg.name = "rightAssembly";
        pp2.name = "pipe";
        left.position.x = -fl / 2;
        face.position.x = rf / 2;
        lg.position.x = -gap / 2 - rf;
        right.position.x = fr / 2;
        face2.position.x = -rf / 2;
        pp2.position.x = fr + 0.9;
        rg.add(right, face2, pp2);
        rg.position.x = gap / 2;
        g.add(lg, rg);
        var len = fl + fr + rf * 2 + gap + 0.2;
        addBoltSet(g, count, boltCircle, br, len, 0, bm);
        legend.push(
          [p.colors.left, p.colorLabels.left || "L. Flange", "left"],
          [p.colors.right, p.colorLabels.right || "R. Flange", "right"],
          [p.colors.raise, p.colorLabels.raise || "Raise Face", "raise"],
          [p.colors.bolt, p.colorLabels.bolt || "Bolt", "bolt"],
        );
      }
    }
    if (p.componentVisible.pipe !== false && !legend.some(function (x) { return x[2] === "pipe"; }))
      legend.push([p.colors.pipe, p.colorLabels.pipe || "Pipe", "pipe"]);
    if (p.componentVisible.compass !== false)
      legend.push([p.colors.compass, p.colorLabels.compass || "Compass", "compass"]);
    inst.group = g;
    inst.scene.add(g);
    applyComponentVisibility(inst);
    updateModelCallouts(inst, true);
    inst.el.querySelector(".df-legend").innerHTML = legend
      .filter(function (x) {
        var key = x[2];
        return !key || p.componentVisible[key] !== false;
      })
      .map(function (x) {
        return (
          '<span><i class="df-dot" style="background:' +
          esc(x[0]) +
          '"></i>' +
          esc(x[1]) +
          "</span>"
        );
      })
      .join("");
    inst.el.querySelector(".df-compass").style.borderColor = p.colors.compass;
    updateModelBannerOnly(inst.el, p);
  }
  function updateModelBannerOnly(el, p) {
    var a = el.querySelector("[data-banner=f1]"),
      g = el.querySelector("[data-banner=gap]"),
      f = el.querySelector("[data-banner=f2]");
    if (!a) return;
    if (p.type === "pipe") {
      a.textContent = "Wall: " + p.wall + " mm";
      g.textContent = "Length: " + p.gap + " mm";
      f.textContent = "";
    } else if (p.type === "half-flange") {
      a.textContent = "Flange: " + p.f1 + " mm";
      g.textContent = "Raise Face: " + p.gap + " mm";
      f.textContent = "";
    } else {
      a.textContent = "F1: " + p.f1 + " mm";
      g.textContent = "Gap: " + p.gap + " mm";
      f.textContent = "F2: " + p.f2 + " mm";
    }
  }
  async function exportPdf(name) {
    var C = window.jspdf && window.jspdf.jsPDF;
    if (!C) throw Error("PDF engine unavailable");
    var d = new C({ unit: "mm", format: "a4" });
    for (var pi = 0; pi < S.pages.length; pi++) {
      if (pi) d.addPage();
      var p = S.pages[pi],
        y = 14;
      d.setTextColor(15, 23, 42);
      d.setFont("helvetica", "bold");
      d.setFontSize(16);
      d.text("DC FLANGE / PIPE REPORT", 14, y);
      d.setFontSize(9);
      y += 9;
      d.setFont("helvetica", "normal");
      [
        ["Project", p.project, "Gap / Length", p.gap],
        ["Location", p.location, "Bolt Dia", p.boltDia],
        [
          "Date & Time",
          String(p.date || "").replace("T", " "),
          "Bolt No",
          p.boltNo,
        ],
        ["Observer", p.observer, "Raise Face", p.raiseFace],
        ["Booker", p.booker, "Face No", p.faceNo],
        ["Tie in No", p.tieIn, "Page No", p.pageNo],
        ["Set No", p.setNo, "Type", p.type],
      ].forEach(function (r) {
        d.setFontSize(8);
        d.text(r[0] + ": " + r[1], 14, y);
        d.text(r[2] + ": " + r[3], 110, y);
        y += 5;
      });
      var inst = instances[p.id];
      if (inst) {
        try {
          inst.renderer.render(inst.scene, inst.camera);
          var w = inst.renderer.domElement.width,
            h = inst.renderer.domElement.height,
            tmp = document.createElement("canvas");
          tmp.width = w;
          tmp.height = h;
          var cx = tmp.getContext("2d");
          cx.drawImage(inst.renderer.domElement, 0, 0);
          cx.drawImage(inst.ann, 0, 0, w, h);
          cx.drawImage(inst.txt, 0, 0, w, h);
          d.addImage(tmp.toDataURL("image/jpeg", 0.9), "JPEG", 14, y, 182, 72);
          y += 77;
        } catch (e) {}
      }
      d.setFont("helvetica", "bold");
      d.text("Code", 14, y);
      d.text("Description", 38, y);
      d.text("Point ID", 112, y);
      d.text("Remarks", 150, y);
      y += 4;
      d.setFont("helvetica", "normal");
      p.rows.forEach(function (r) {
        if (y > 280) {
          d.addPage();
          y = 14;
        }
        d.rect(14, y - 3, 182, 8);
        d.setFontSize(7);
        d.text(String(r.code || ""), 15, y + 1);
        d.text(
          String(r.description || "")
            .replace(/\n/g, " / ")
            .slice(0, 55),
          39,
          y + 1,
        );
        d.text(String(r.point || "").slice(0, 24), 113, y + 1);
        d.text(String(r.remarks || "").slice(0, 25), 151, y + 1);
        y += 8;
      });
    }
    var file =
      (name || "DC_Flange_Pipe_Report").replace(/[^a-zA-Z0-9._-]+/g, "_") +
      ".pdf";
    if (window.__qcSavePDF) return window.__qcSavePDF(d, file);
    d.save(file);
    return true;
  }
  window.exportDcFlangePdf = exportPdf;
  window.QCDcFlange = {
    getState: function () {
      return JSON.parse(JSON.stringify(S));
    },
    state: S,
    instances: instances,
    getInstance: function (id) { return instances[id] || null; },
    save: save,
    render: render,
    newPage: newPage,
    capturePage: function (id) {
      var inst = instances[id];
      if (!inst) return "";
      try {
        inst.renderer.render(inst.scene, inst.camera);
        var w = inst.renderer.domElement.width,
          h = inst.renderer.domElement.height,
          tmp = document.createElement("canvas");
        tmp.width = w;
        tmp.height = h;
        var cx = tmp.getContext("2d"), p = S.pages.find(function(x){ return x.id === id; }) || inst.p;
        var mode = p && p.sketchPro && p.sketchPro.captureMode || "all";
        var modelVisible = !(p && p.sketchPro && p.sketchPro.layers && p.sketchPro.layers.model && p.sketchPro.layers.model.visible === false);
        if (mode === "sketch" || !modelVisible) { cx.fillStyle = "#ffffff"; cx.fillRect(0, 0, w, h); }
        else { cx.save(); if (mode === "transparent") cx.globalAlpha = 0.35; cx.drawImage(inst.renderer.domElement, 0, 0); cx.restore(); }
        if (mode !== "model") {
          if (mode === "dimensions" && window.DCSketchPro && DCSketchPro.drawFilteredCapture) DCSketchPro.drawFilteredCapture(cx, p, w, h, "dimensions");
          else cx.drawImage(inst.ann, 0, 0, w, h);
          if (mode !== "dimensions") cx.drawImage(inst.txt, 0, 0, w, h);
          if (window.DCSketchPro && DCSketchPro.drawGridCapture) DCSketchPro.drawGridCapture(cx, p, w, h);
        }
        if (p && p.sketchPro && p.sketchPro.autoCrop && window.DCSketchPro && DCSketchPro.cropCanvas) tmp = DCSketchPro.cropCanvas(tmp, p) || tmp;
        return tmp.toDataURL("image/jpeg", 0.9);
      } catch (e) {
        return "";
      }
    },
    highlight: function (id, part) {
      var inst = instances[id];
      if (!inst || !inst.group) return;
      inst.group.traverse(function (o) {
        if (!o.material || !o.material.emissive) return;
        if (o.userData && o.userData.qcBaseEmissive == null)
          o.userData.qcBaseEmissive = o.material.emissive.getHex();
        o.material.emissive.setHex(
          !part || o.name === part || (o.parent && o.parent.name === part)
            ? 0x312e81
            : o.userData.qcBaseEmissive,
        );
      });
      setTimeout(function () {
        if (!instances[id] || !instances[id].group) return;
        instances[id].group.traverse(function (o) {
          if (o.material && o.material.emissive && o.userData.qcBaseEmissive != null)
            o.material.emissive.setHex(o.userData.qcBaseEmissive);
        });
      }, 1200);
    },
  };
  document.addEventListener("qc:pagechange", function (e) {
    var active = e && e.detail && e.detail.to === "flange";
    Object.keys(instances).forEach(function (k) {
      var inst = instances[k];
      if (!inst || inst.fallback2D) return;
      if (active) inst.resumeAnimation && inst.resumeAnimation();
      else if (inst.raf) { cancelAnimationFrame(inst.raf); inst.raf = 0; inst.lifecyclePaused = true; }
    });
  });
  document.addEventListener("visibilitychange", function () {
    if (document.hidden) {
      Object.keys(instances).forEach(function (k) { var inst=instances[k]; if(inst&&inst.raf){cancelAnimationFrame(inst.raf);inst.raf=0;inst.lifecyclePaused=true;} });
    } else if (document.documentElement.dataset.qcActivePage === "flange") {
      Object.keys(instances).forEach(function (k) { var inst=instances[k]; if(inst&&inst.resumeAnimation)inst.resumeAnimation(); });
    }
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
