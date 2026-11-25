(function () {
  "use strict";

  const Physics = window.WaveLabPhysics;
  const CanvasView = window.WaveLabCanvas;

  const state = {
    activeModule: "pendulum",
    isPlaying: true,
    speed: 1,
    activePresetId: null,
    params: {},
    simStates: {},
    validationError: null,
    trials: [],
    filterModule: "all",
    lastFrameTs: null
  };

  const els = {
    themeToggleBtn: document.getElementById("themeToggleBtn"),
    openFormulaBtn: document.getElementById("openFormulaBtn"),
    closeFormulaBtn: document.getElementById("closeFormulaBtn"),
    formulaModal: document.getElementById("formulaModal"),
    moduleTabs: Array.from(document.querySelectorAll(".module-tab")),
    moduleHeading: document.getElementById("moduleHeading"),
    timeReadout: document.getElementById("timeReadout"),
    apparatusCanvas: document.getElementById("apparatusCanvas"),
    graphCanvas: document.getElementById("graphCanvas"),
    graphTitle: document.getElementById("graphTitle"),
    playPauseBtn: document.getElementById("playPauseBtn"),
    resetBtn: document.getElementById("resetBtn"),
    speedBtns: Array.from(document.querySelectorAll(".speed-btn")),
    harmonicLockBar: document.getElementById("harmonicLockBar"),
    harmonicBtns: Array.from(document.querySelectorAll(".harmonic-btn")),
    energySection: document.getElementById("energySection"),
    energyTotalReadout: document.getElementById("energyTotalReadout"),
    ekVal: document.getElementById("ekVal"),
    epVal: document.getElementById("epVal"),
    ekBar: document.getElementById("ekBar"),
    epBar: document.getElementById("epBar"),
    presetList: document.getElementById("presetList"),
    paramErrorBanner: document.getElementById("paramErrorBanner"),
    paramErrorText: document.getElementById("paramErrorText"),
    restoreParamBtn: document.getElementById("restoreParamBtn"),
    paramControls: document.getElementById("paramControls"),
    gravityShortcuts: document.getElementById("gravityShortcuts"),
    gravityBtns: Array.from(document.querySelectorAll(".gravity-btn")),
    measuringBanner: document.getElementById("measuringBanner"),
    measuringText: document.getElementById("measuringText"),
    quickMeasureBtn: document.getElementById("quickMeasureBtn"),
    theoryMainLabel: document.getElementById("theoryMainLabel"),
    theoryMainVal: document.getElementById("theoryMainVal"),
    simMainLabel: document.getElementById("simMainLabel"),
    simMainVal: document.getElementById("simMainVal"),
    errorPctVal: document.getElementById("errorPctVal"),
    subMetricLabel: document.getElementById("subMetricLabel"),
    subMetricVal: document.getElementById("subMetricVal"),
    physicsInsight: document.getElementById("physicsInsight"),
    recordTrialBtn: document.getElementById("recordTrialBtn"),
    recordFeedback: document.getElementById("recordFeedback"),
    exportCsvBtn: document.getElementById("exportCsvBtn"),
    printTableBtn: document.getElementById("printTableBtn"),
    clearLogBtn: document.getElementById("clearLogBtn"),
    filterBtns: Array.from(document.querySelectorAll(".filter-btn")),
    logEmptyState: document.getElementById("logEmptyState"),
    logTableWrap: document.getElementById("logTableWrap"),
    logTableBody: document.getElementById("logTableBody")
  };

  function initModuleData() {
    Object.keys(Physics.MODULES).forEach(function (modId) {
      state.params[modId] = Physics.getDefaults(modId);
      state.simStates[modId] = Physics.createState(modId, state.params[modId]);
    });
  }

  function applyTheme(mode) {
    document.documentElement.setAttribute("data-theme", mode);
    els.themeToggleBtn.setAttribute("aria-pressed", String(mode === "dark"));
    els.themeToggleBtn.textContent = mode === "dark" ? "Tema: Gelap" : "Tema: Terang";
    localStorage.setItem("wavelab-theme", mode);
    renderFrame();
  }

  function renderPresets() {
    const mod = Physics.MODULES[state.activeModule];
    els.presetList.innerHTML = "";
    mod.presets.forEach(function (preset) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "preset-btn" + (state.activePresetId === preset.id ? " is-active" : "");
      btn.textContent = preset.label;
      btn.addEventListener("click", function () {
        applyPreset(preset);
      });
      els.presetList.appendChild(btn);
    });
  }

  function applyPreset(preset) {
    const modId = state.activeModule;
    state.activePresetId = preset.id;
    state.params[modId] = Object.assign({}, preset.values);
    state.validationError = null;
    updateErrorBanner();
    resetCurrentSimulation();
    renderPresets();
    renderParamInputs();
    updateUIReadouts();
    renderFrame();
  }

  function updateErrorBanner() {
    if (!state.validationError) {
      els.paramErrorBanner.hidden = true;
      els.paramErrorText.textContent = "";
      return;
    }
    els.paramErrorBanner.hidden = false;
    els.paramErrorText.textContent = state.validationError.message;
  }

  function syncParamInputsFromState() {
    const modId = state.activeModule;
    const modSpec = Physics.MODULES[modId].params;
    Object.keys(modSpec).forEach(function (key) {
      const val = state.params[modId][key];
      const rangeEl = document.getElementById("range-" + modId + "-" + key);
      const numEl = document.getElementById("num-" + modId + "-" + key);
      if (rangeEl) rangeEl.value = String(val);
      if (numEl) numEl.value = String(val);
    });
  }

  function renderParamInputs() {
    const modId = state.activeModule;
    const modSpec = Physics.MODULES[modId].params;
    els.paramControls.innerHTML = "";

    Object.keys(modSpec).forEach(function (key) {
      const def = modSpec[key];
      const currentVal = state.params[modId][key];

      const wrapper = document.createElement("div");
      wrapper.className = "param-item";

      const head = document.createElement("div");
      head.className = "param-head";

      const label = document.createElement("label");
      const numId = "num-" + modId + "-" + key;
      const rangeId = "range-" + modId + "-" + key;
      label.setAttribute("for", numId);
      label.textContent = def.label;

      const inputGroup = document.createElement("div");
      inputGroup.className = "param-input-group";

      const numInput = document.createElement("input");
      numInput.type = "number";
      numInput.id = numId;
      numInput.className = "param-number";
      numInput.min = String(def.min);
      numInput.max = String(def.max);
      numInput.step = String(def.step);
      numInput.value = String(currentVal);

      const unitSpan = document.createElement("span");
      unitSpan.className = "param-unit";
      unitSpan.textContent = def.unit;

      inputGroup.appendChild(numInput);
      inputGroup.appendChild(unitSpan);
      head.appendChild(label);
      head.appendChild(inputGroup);

      const rangeInput = document.createElement("input");
      rangeInput.type = "range";
      rangeInput.id = rangeId;
      rangeInput.className = "param-range";
      rangeInput.setAttribute("aria-label", "Slider " + def.label);
      rangeInput.min = String(def.min);
      rangeInput.max = String(def.max);
      rangeInput.step = String(def.step);
      rangeInput.value = String(currentVal);

      rangeInput.addEventListener("input", function () {
        const res = Physics.validateParam(modId, key, rangeInput.value);
        if (res.valid) {
          state.activePresetId = null;
          state.validationError = null;
          state.params[modId][key] = res.value;
          numInput.value = String(res.value);
          updateErrorBanner();
          resetCurrentSimulation();
          renderPresets();
          updateUIReadouts();
          renderFrame();
        }
      });

      numInput.addEventListener("input", function () {
        const res = Physics.validateParam(modId, key, numInput.value);
        if (!res.valid) {
          state.validationError = {
            key: key,
            inputEl: numInput,
            prevValue: state.params[modId][key],
            message: res.message
          };
          updateErrorBanner();
          return;
        }
        state.activePresetId = null;
        state.validationError = null;
        state.params[modId][key] = res.value;
        rangeInput.value = String(res.value);
        updateErrorBanner();
        resetCurrentSimulation();
        renderPresets();
        updateUIReadouts();
        renderFrame();
      });

      wrapper.appendChild(head);
      wrapper.appendChild(rangeInput);
      els.paramControls.appendChild(wrapper);
    });

    els.gravityShortcuts.hidden = modId !== "pendulum";
  }

  function resetCurrentSimulation() {
    const modId = state.activeModule;
    state.simStates[modId] = Physics.createState(modId, state.params[modId]);
    els.recordFeedback.textContent = "";
  }

  function switchModule(modId) {
    state.activeModule = modId;
    state.activePresetId = null;
    state.validationError = null;
    updateErrorBanner();

    els.moduleTabs.forEach(function (tab) {
      const active = tab.dataset.module === modId;
      tab.classList.toggle("is-active", active);
      tab.setAttribute("aria-selected", String(active));
      tab.tabIndex = active ? 0 : -1;
    });

    const mod = Physics.MODULES[modId];
    els.moduleHeading.textContent = mod.index + " " + mod.name;
    els.graphTitle.textContent = mod.graphTitle;
    els.harmonicLockBar.hidden = modId !== "melde";
    els.energySection.hidden = modId === "melde";

    renderPresets();
    renderParamInputs();
    updateUIReadouts();
    renderFrame();
  }

  function updateUIReadouts() {
    const modId = state.activeModule;
    const mod = Physics.MODULES[modId];
    const simState = state.simStates[modId];
    const params = state.params[modId];
    const snap = Physics.getSnapshot(modId, simState, params);

    els.timeReadout.textContent = "t = " + simState.t.toFixed(2) + " s";

    if (modId === "melde") {
      els.theoryMainLabel.textContent = "Teori (v = akar(F/mu))";
      els.simMainLabel.textContent = "Simulasi (lambda x f)";
      els.subMetricLabel.textContent = "Panjang Gelombang (Teori / Sim)";
    } else {
      els.theoryMainLabel.textContent = "Teori (T rumus)";
      els.simMainLabel.textContent = "Simulasi (T ukur RK4)";
      els.subMetricLabel.textContent = "Frekuensi f (Teori / Sim)";
    }

    els.theoryMainVal.textContent = snap.theoryMain.toFixed(4) + " " + snap.mainUnit;

    if (snap.measuring) {
      els.measuringBanner.hidden = false;
      els.measuringText.textContent = snap.measuringMessage || "Mengukur 1 siklus penuh...";
      els.quickMeasureBtn.hidden = modId === "melde";
      els.simMainVal.textContent = "Menunggu siklus...";
      els.errorPctVal.textContent = "-";
      els.subMetricVal.textContent = snap.theorySub.toFixed(4) + " / - " + snap.subUnit;
    } else {
      els.measuringBanner.hidden = true;
      els.simMainVal.textContent = snap.simMain.toFixed(4) + " " + snap.mainUnit;
      els.errorPctVal.textContent = snap.errorPct.toFixed(3) + " %";
      els.subMetricVal.textContent = snap.theorySub.toFixed(4) + " / " + snap.simSub.toFixed(4) + " " + snap.subUnit;
    }

    els.physicsInsight.textContent = snap.note;

    if (modId !== "melde" && snap.energies) {
      const ref = snap.energies.EmRef;
      const ekPct = Math.min(100, (snap.energies.Ek / ref) * 100);
      const epPct = Math.min(100, (snap.energies.Ep / ref) * 100);
      els.energyTotalReadout.textContent = "E_total = " + snap.energies.Em.toFixed(3) + " J";
      els.ekVal.textContent = snap.energies.Ek.toFixed(3) + " J";
      els.epVal.textContent = snap.energies.Ep.toFixed(3) + " J";
      els.ekBar.style.width = ekPct.toFixed(1) + "%";
      els.epBar.style.width = epPct.toFixed(1) + "%";
    }

    els.recordTrialBtn.disabled = modId === "melde" && snap.measuring;
    return snap;
  }

  function renderFrame() {
    const modId = state.activeModule;
    const simState = state.simStates[modId];
    const params = state.params[modId];
    const snap = Physics.getSnapshot(modId, simState, params);
    CanvasView.renderAll(els.apparatusCanvas, els.graphCanvas, modId, simState, params, snap);
  }

  function handleQuickMeasure() {
    const modId = state.activeModule;
    if (modId === "melde") return;
    const measured = Physics.measureHeadless(modId, state.params[modId]);
    if (measured.simMain !== null) {
      state.simStates[modId].measuredT = measured.simMain;
      updateUIReadouts();
      renderFrame();
    }
  }

  function handleRecordTrial() {
    const modId = state.activeModule;
    const mod = Physics.MODULES[modId];
    let snap = Physics.getSnapshot(modId, state.simStates[modId], state.params[modId]);

    if (snap.measuring) {
      if (modId === "melde") {
        els.recordFeedback.textContent = "Naikkan frekuensi hingga minimal f1 agar panjang gelombang dapat diukur.";
        return;
      }
      snap = Physics.measureHeadless(modId, state.params[modId]);
      state.simStates[modId].measuredT = snap.simMain;
      updateUIReadouts();
    }

    state.trials.push({
      id: state.trials.length + 1,
      moduleId: modId,
      moduleName: mod.shortName,
      paramSummary: snap.summaryText,
      theoryText: snap.theoryMain.toFixed(4) + " " + snap.mainUnit,
      simText: snap.simMain.toFixed(4) + " " + snap.mainUnit,
      errorPct: snap.errorPct.toFixed(3) + " %",
      note: snap.note
    });

    renderTrialTable();
    els.recordFeedback.textContent = "Tercatat sebagai uji #" + state.trials.length + " (" + mod.shortName + ").";
  }

  function renderTrialTable() {
    const rows = state.trials.filter(function (item) {
      return state.filterModule === "all" || item.moduleId === state.filterModule;
    });

    if (rows.length === 0) {
      els.logEmptyState.hidden = false;
      els.logTableWrap.hidden = true;
      els.logTableBody.innerHTML = "";
      return;
    }

    els.logEmptyState.hidden = true;
    els.logTableWrap.hidden = false;
    els.logTableBody.innerHTML = "";

    rows.forEach(function (row) {
      const tr = document.createElement("tr");
      const cells = [
        { text: String(row.id), mono: true },
        { text: row.moduleName, mono: false },
        { text: row.paramSummary, mono: true },
        { text: row.theoryText, mono: true },
        { text: row.simText, mono: true },
        { text: row.errorPct, mono: true },
        { text: row.note, mono: false }
      ];
      cells.forEach(function (c) {
        const td = document.createElement("td");
        if (c.mono) td.className = "mono-cell";
        td.textContent = c.text;
        tr.appendChild(td);
      });
      els.logTableBody.appendChild(tr);
    });
  }

  function exportCsv() {
    if (state.trials.length === 0) return;
    const header = ["No", "Modul", "Parameter", "Nilai Teori", "Nilai Simulasi", "Galat (%)", "Catatan Fisis"];
    const lines = [header.join(",")];
    state.trials.forEach(function (r) {
      const vals = [r.id, r.moduleName, r.paramSummary, r.theoryText, r.simText, r.errorPct, r.note].map(function (v) {
        return '"' + String(v).replace(/"/g, '""') + '"';
      });
      lines.push(vals.join(","));
    });

    const blob = new Blob([lines.join("\n")], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "validasi-getaran-gelombang.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  function animationLoop(ts) {
    if (state.lastFrameTs === null) state.lastFrameTs = ts;
    const dt = (ts - state.lastFrameTs) / 1000;
    state.lastFrameTs = ts;

    if (state.isPlaying) {
      const modId = state.activeModule;
      Physics.advanceState(modId, state.simStates[modId], state.params[modId], dt * state.speed);
      updateUIReadouts();
      renderFrame();
    }
    requestAnimationFrame(animationLoop);
  }

  function bindEvents() {
    els.themeToggleBtn.addEventListener("click", function () {
      const current = document.documentElement.getAttribute("data-theme");
      applyTheme(current === "dark" ? "light" : "dark");
    });

    els.openFormulaBtn.addEventListener("click", function () {
      if (typeof els.formulaModal.showModal === "function") {
        els.formulaModal.showModal();
      } else {
        els.formulaModal.setAttribute("open", "true");
      }
    });

    els.closeFormulaBtn.addEventListener("click", function () {
      if (typeof els.formulaModal.close === "function") {
        els.formulaModal.close();
      } else {
        els.formulaModal.removeAttribute("open");
      }
    });

    els.formulaModal.addEventListener("click", function (ev) {
      if (ev.target === els.formulaModal && typeof els.formulaModal.close === "function") {
        els.formulaModal.close();
      }
    });

    els.moduleTabs.forEach(function (tab, idx) {
      tab.addEventListener("click", function () {
        switchModule(tab.dataset.module);
      });
      tab.addEventListener("keydown", function (ev) {
        if (ev.key === "ArrowRight" || ev.key === "ArrowLeft") {
          ev.preventDefault();
          const dir = ev.key === "ArrowRight" ? 1 : -1;
          const nextIdx = (idx + dir + els.moduleTabs.length) % els.moduleTabs.length;
          els.moduleTabs[nextIdx].focus();
          switchModule(els.moduleTabs[nextIdx].dataset.module);
        }
      });
    });

    els.playPauseBtn.addEventListener("click", function () {
      state.isPlaying = !state.isPlaying;
      els.playPauseBtn.textContent = state.isPlaying ? "Jeda" : "Mulai";
    });

    els.resetBtn.addEventListener("click", function () {
      resetCurrentSimulation();
      updateUIReadouts();
      renderFrame();
    });

    els.speedBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.speed = Number(btn.dataset.speed);
        els.speedBtns.forEach(function (other) {
          const active = other === btn;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", String(active));
        });
      });
    });

    els.harmonicBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        const n = Number(btn.dataset.n);
        const fTarget = Physics.getHarmonicFrequency(state.params.melde, n);
        const clamped = Math.min(150, Math.max(10, fTarget));
        state.params.melde.f = clamped;
        state.activePresetId = null;
        state.validationError = null;
        updateErrorBanner();
        syncParamInputsFromState();
        renderPresets();
        updateUIReadouts();
        renderFrame();
      });
    });

    els.gravityBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.params.pendulum.g = Number(btn.dataset.g);
        state.activePresetId = null;
        state.validationError = null;
        updateErrorBanner();
        syncParamInputsFromState();
        resetCurrentSimulation();
        renderPresets();
        updateUIReadouts();
        renderFrame();
      });
    });

    els.restoreParamBtn.addEventListener("click", function () {
      if (!state.validationError) return;
      const err = state.validationError;
      state.params[state.activeModule][err.key] = err.prevValue;
      state.validationError = null;
      updateErrorBanner();
      syncParamInputsFromState();
      updateUIReadouts();
      renderFrame();
      if (err.inputEl) err.inputEl.focus();
    });

    els.quickMeasureBtn.addEventListener("click", handleQuickMeasure);
    els.recordTrialBtn.addEventListener("click", handleRecordTrial);

    els.filterBtns.forEach(function (btn) {
      btn.addEventListener("click", function () {
        state.filterModule = btn.dataset.filter;
        els.filterBtns.forEach(function (other) {
          const active = other === btn;
          other.classList.toggle("is-active", active);
          other.setAttribute("aria-pressed", String(active));
        });
        renderTrialTable();
      });
    });

    els.exportCsvBtn.addEventListener("click", exportCsv);
    els.printTableBtn.addEventListener("click", function () {
      window.print();
    });
    els.clearLogBtn.addEventListener("click", function () {
      state.trials = [];
      renderTrialTable();
      els.recordFeedback.textContent = "Semua catatan pengujian dihapus.";
    });

    if (typeof ResizeObserver === "function") {
      const ro = new ResizeObserver(function () {
        renderFrame();
      });
      ro.observe(els.apparatusCanvas);
      ro.observe(els.graphCanvas);
    } else {
      window.addEventListener("resize", renderFrame);
    }
  }

  initModuleData();
  const savedTheme = localStorage.getItem("wavelab-theme") || "light";
  bindEvents();
  applyTheme(savedTheme);
  switchModule("pendulum");
  renderTrialTable();
  requestAnimationFrame(animationLoop);
})();
