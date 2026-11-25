(function (global) {
  "use strict";

  const RK4_STEP = 1 / 240;
  const MAX_HISTORY_SEC = 10;
  const G_MELDE = 9.81;

  const MODULES = {
    pendulum: {
      id: "pendulum",
      index: "01",
      name: "Bandul Matematis",
      shortName: "Bandul",
      mainMetricLabel: "Periode T (s)",
      secondaryMetricLabel: "Frekuensi f (Hz)",
      graphTitle: "Bagaimana simpangan sudut terhadap waktu?",
      graphYLabel: "Sudut (deg)",
      params: {
        L: { label: "Panjang tali (L)", unit: "m", min: 0.2, max: 3.0, step: 0.05, default: 1.0, decimals: 2 },
        thetaDeg: { label: "Sudut awal (theta_0)", unit: "deg", min: 5, max: 60, step: 1, default: 10, decimals: 0 },
        m: { label: "Massa beban (m)", unit: "kg", min: 0.1, max: 5.0, step: 0.1, default: 1.0, decimals: 1 },
        g: { label: "Gravitasi (g)", unit: "m/s^2", min: 1.0, max: 25.0, step: 0.01, default: 9.81, decimals: 2 }
      },
      presets: [
        { id: "p-ideal", label: "Sudut Kecil (10 deg)", values: { L: 1.0, thetaDeg: 10, m: 1.0, g: 9.81 } },
        { id: "p-long", label: "Tali 2.0 m", values: { L: 2.0, thetaDeg: 10, m: 1.0, g: 9.81 } },
        { id: "p-mass", label: "Uji Massa 4.0 kg", values: { L: 1.0, thetaDeg: 10, m: 4.0, g: 9.81 } },
        { id: "p-large", label: "Sudut Besar (50 deg)", values: { L: 1.0, thetaDeg: 50, m: 1.0, g: 9.81 } },
        { id: "p-moon", label: "Gravitasi Bulan", values: { L: 1.0, thetaDeg: 10, m: 1.0, g: 1.62 } }
      ]
    },
    spring: {
      id: "spring",
      index: "02",
      name: "Sistem Pegas-Massa",
      shortName: "Pegas",
      mainMetricLabel: "Periode T (s)",
      secondaryMetricLabel: "Frekuensi f (Hz)",
      graphTitle: "Bagaimana simpangan pegas terhadap waktu?",
      graphYLabel: "Simpangan (m)",
      params: {
        m: { label: "Massa beban (m)", unit: "kg", min: 0.2, max: 5.0, step: 0.1, default: 1.0, decimals: 1 },
        k: { label: "Konstanta pegas (k)", unit: "N/m", min: 5, max: 100, step: 1, default: 25, decimals: 0 },
        A: { label: "Amplitudo awal (A)", unit: "m", min: 0.05, max: 0.50, step: 0.01, default: 0.25, decimals: 2 },
        b: { label: "Redaman (b)", unit: "N.s/m", min: 0.0, max: 1.5, step: 0.05, default: 0.0, decimals: 2 }
      },
      presets: [
        { id: "s-std", label: "Pegas Standar", values: { m: 1.0, k: 25, A: 0.25, b: 0.0 } },
        { id: "s-mass4", label: "Massa 4x (4.0 kg)", values: { m: 4.0, k: 25, A: 0.25, b: 0.0 } },
        { id: "s-stiff", label: "Pegas Kaku (k=100)", values: { m: 1.0, k: 100, A: 0.25, b: 0.0 } },
        { id: "s-damped", label: "Osilasi Teredam", values: { m: 1.0, k: 25, A: 0.30, b: 0.40 } }
      ]
    },
    melde: {
      id: "melde",
      index: "03",
      name: "Gelombang Tali (Percobaan Melde)",
      shortName: "Melde",
      mainMetricLabel: "Cepat Rambat v (m/s)",
      secondaryMetricLabel: "Panjang Gelombang (m)",
      graphTitle: "Bagaimana cepat rambat berubah terhadap tegangan tali?",
      graphYLabel: "Cepat rambat (m/s)",
      params: {
        mb: { label: "Massa beban gantung (m_b)", unit: "kg", min: 0.1, max: 2.0, step: 0.05, default: 0.5, decimals: 2 },
        mu: { label: "Massa per panjang (mu)", unit: "kg/m", min: 0.001, max: 0.020, step: 0.001, default: 0.005, decimals: 3 },
        L: { label: "Panjang tali (L)", unit: "m", min: 0.5, max: 2.5, step: 0.1, default: 1.5, decimals: 1 },
        f: { label: "Frekuensi vibrator (f)", unit: "Hz", min: 10, max: 150, step: 0.1, default: 31.32, decimals: 2 }
      },
      presets: [
        { id: "m-h2", label: "Harmonik ke-2 (n=2)", values: { mb: 0.5, mu: 0.005, L: 1.5, f: 20.88 } },
        { id: "m-h3", label: "Harmonik ke-3 (n=3)", values: { mb: 0.5, mu: 0.005, L: 1.5, f: 31.32 } },
        { id: "m-t4", label: "Tegangan 4x (m=2.0 kg)", values: { mb: 2.0, mu: 0.005, L: 1.5, f: 41.76 } },
        { id: "m-thick", label: "Tali Lebih Tebal (4x mu)", values: { mb: 0.5, mu: 0.020, L: 1.5, f: 31.32 } }
      ]
    }
  };

  function getDefaults(moduleId) {
    const spec = MODULES[moduleId].params;
    const out = {};
    Object.keys(spec).forEach(function (key) {
      out[key] = spec[key].default;
    });
    return out;
  }

  function validateParam(moduleId, key, rawVal) {
    const def = MODULES[moduleId].params[key];
    const num = Number(rawVal);
    if (rawVal === "" || rawVal === null || !Number.isFinite(num)) {
      return {
        valid: false,
        message: def.label + " harus berupa angka valid antara " + def.min + " dan " + def.max + " " + def.unit + "."
      };
    }
    if (num < def.min || num > def.max) {
      return {
        valid: false,
        message: def.label + " di luar batas (" + def.min + " sampai " + def.max + " " + def.unit + ")."
      };
    }
    return { valid: true, value: num };
  }

  function computePendulumTheory(params) {
    const T = 2 * Math.PI * Math.sqrt(params.L / params.g);
    const f = 1 / T;
    const thetaRad = (params.thetaDeg * Math.PI) / 180;
    const Em = params.m * params.g * params.L * (1 - Math.cos(thetaRad));
    return { T: T, f: f, Em: Em };
  }

  function computeSpringTheory(params) {
    const T = 2 * Math.PI * Math.sqrt(params.m / params.k);
    const f = 1 / T;
    const Em = 0.5 * params.k * params.A * params.A;
    return { T: T, f: f, Em: Em };
  }

  function computeMeldeTheory(params) {
    const F = params.mb * G_MELDE;
    const v = Math.sqrt(F / params.mu);
    const lambda = v / params.f;
    const nExact = (2 * params.L * params.f) / v;
    const nNearest = Math.max(1, Math.round(nExact));
    const fFundamental = v / (2 * params.L);
    const fNearestResonance = nNearest * fFundamental;
    const detune = Math.abs(nExact - nNearest);
    const resonanceFactor = 1 / Math.sqrt(1 + Math.pow(detune * 8, 2));
    return {
      F: F,
      v: v,
      lambda: lambda,
      nExact: nExact,
      nNearest: nNearest,
      fFundamental: fFundamental,
      fNearestResonance: fNearestResonance,
      detune: detune,
      resonanceFactor: resonanceFactor
    };
  }

  function createState(moduleId, params) {
    if (moduleId === "pendulum") {
      const theta0 = (params.thetaDeg * Math.PI) / 180;
      return {
        t: 0,
        theta: theta0,
        omega: 0,
        crossings: [],
        measuredT: null,
        trail: [],
        history: [{ t: 0, val: params.thetaDeg }],
        accumulator: 0,
        sampleTimer: 0
      };
    }
    if (moduleId === "spring") {
      return {
        t: 0,
        x: params.A,
        v: 0,
        crossings: [],
        measuredT: null,
        history: [{ t: 0, val: params.A }],
        accumulator: 0,
        sampleTimer: 0
      };
    }
    return {
      t: 0,
      phase: 0,
      accumulator: 0
    };
  }

  function stepPendulumRK4(state, params, dt) {
    const gOverL = params.g / params.L;
    const prevTheta = state.theta;
    const prevT = state.t;

    const th = state.theta;
    const om = state.omega;

    const k1Th = om;
    const k1Om = -gOverL * Math.sin(th);

    const k2Th = om + 0.5 * dt * k1Om;
    const k2Om = -gOverL * Math.sin(th + 0.5 * dt * k1Th);

    const k3Th = om + 0.5 * dt * k2Om;
    const k3Om = -gOverL * Math.sin(th + 0.5 * dt * k2Th);

    const k4Th = om + dt * k3Om;
    const k4Om = -gOverL * Math.sin(th + dt * k3Th);

    state.theta = th + (dt / 6) * (k1Th + 2 * k2Th + 2 * k3Th + k4Th);
    state.omega = om + (dt / 6) * (k1Om + 2 * k2Om + 2 * k3Om + k4Om);
    state.t = prevT + dt;

    // Detect ascending zero crossings to measure exact simulated period.
    if (prevTheta < 0 && state.theta >= 0) {
      const frac = -prevTheta / (state.theta - prevTheta);
      const tCross = prevT + frac * dt;
      state.crossings.push(tCross);
      if (state.crossings.length >= 2) {
        const len = state.crossings.length;
        state.measuredT = state.crossings[len - 1] - state.crossings[len - 2];
      }
    }
  }

  function stepSpringRK4(state, params, dt) {
    const kOverM = params.k / params.m;
    const bOverM = params.b / params.m;
    const prevX = state.x;
    const prevT = state.t;

    const x0 = state.x;
    const v0 = state.v;

    const k1X = v0;
    const k1V = -kOverM * x0 - bOverM * v0;

    const k2X = v0 + 0.5 * dt * k1V;
    const k2V = -kOverM * (x0 + 0.5 * dt * k1X) - bOverM * k2X;

    const k3X = v0 + 0.5 * dt * k2V;
    const k3V = -kOverM * (x0 + 0.5 * dt * k2X) - bOverM * k3X;

    const k4X = v0 + dt * k3V;
    const k4V = -kOverM * (x0 + dt * k3X) - bOverM * k4X;

    state.x = x0 + (dt / 6) * (k1X + 2 * k2X + 2 * k3X + k4X);
    state.v = v0 + (dt / 6) * (k1V + 2 * k2V + 2 * k3V + k4V);
    state.t = prevT + dt;

    if (prevX < 0 && state.x >= 0) {
      const frac = -prevX / (state.x - prevX);
      const tCross = prevT + frac * dt;
      state.crossings.push(tCross);
      if (state.crossings.length >= 2) {
        const len = state.crossings.length;
        state.measuredT = state.crossings[len - 1] - state.crossings[len - 2];
      }
    }
  }

  function advanceState(moduleId, state, params, frameDt) {
    const clampedDt = Math.min(frameDt, 0.05);
    if (moduleId === "melde") {
      state.t += clampedDt;
      // Scale visual angular speed so high vibrator Hz remains readable on screen.
      const visualOmega = Math.min(24, Math.max(8, params.f * 0.45));
      state.phase += visualOmega * clampedDt;
      return;
    }

    state.accumulator += clampedDt;
    while (state.accumulator >= RK4_STEP) {
      if (moduleId === "pendulum") {
        stepPendulumRK4(state, params, RK4_STEP);
      } else {
        stepSpringRK4(state, params, RK4_STEP);
      }
      state.accumulator -= RK4_STEP;
      state.sampleTimer += RK4_STEP;

      if (state.sampleTimer >= 1 / 60) {
        state.sampleTimer -= 1 / 60;
        const val = moduleId === "pendulum" ? (state.theta * 180) / Math.PI : state.x;
        state.history.push({ t: state.t, val: val });
        if (moduleId === "pendulum") {
          state.trail.push(state.theta);
          if (state.trail.length > 26) state.trail.shift();
        }
        const cutoff = state.t - MAX_HISTORY_SEC;
        while (state.history.length > 2 && state.history[0].t < cutoff) {
          state.history.shift();
        }
      }
    }
  }

  function measureMeldeSpatial(params) {
    const theory = computeMeldeTheory(params);
    const k = (2 * Math.PI * params.f) / theory.v;
    const samples = 400;
    const dx = params.L / samples;
    const nodes = [0];

    let prevY = 0;
    for (let i = 1; i <= samples; i++) {
      const x1 = i * dx;
      const x0 = x1 - dx;
      const rawY = Math.sin(k * x1);
      const y1 = Math.abs(rawY) < 1e-9 ? 0 : rawY;

      if (i > 1) {
        if ((prevY > 0 && y1 < 0) || (prevY < 0 && y1 > 0)) {
          const frac = Math.abs(prevY) / (Math.abs(prevY) + Math.abs(y1));
          const xCross = x0 + frac * dx;
          if (xCross - nodes[nodes.length - 1] > dx * 2) {
            nodes.push(xCross);
          }
        } else if (y1 === 0 && x1 - nodes[nodes.length - 1] > dx * 2) {
          nodes.push(x1);
        }
      }
      prevY = y1;
    }

    const antinodes = [];
    for (let j = 0; j < nodes.length - 1; j++) {
      antinodes.push(0.5 * (nodes[j] + nodes[j + 1]));
    }
    const halfWavesExact = theory.nExact;
    const extraFraction = halfWavesExact - Math.floor(halfWavesExact);
    if (nodes.length >= 1 && extraFraction > 0.5 && nodes[nodes.length - 1] < params.L - dx * 2) {
      const lastNode = nodes[nodes.length - 1];
      const estimatedAntinode = lastNode + theory.lambda * 0.25;
      if (estimatedAntinode <= params.L) {
        antinodes.push(estimatedAntinode);
      }
    }

    if (nodes.length < 2) {
      return {
        theory: theory,
        nodes: nodes,
        antinodes: antinodes,
        hasFullSegment: false,
        lambdaSim: null,
        vSim: null
      };
    }

    let spacingSum = 0;
    for (let j = 1; j < nodes.length; j++) {
      spacingSum += nodes[j] - nodes[j - 1];
    }
    const avgSpacing = spacingSum / (nodes.length - 1);
    const lambdaSim = 2 * avgSpacing;
    const vSim = lambdaSim * params.f;

    return {
      theory: theory,
      nodes: nodes,
      antinodes: antinodes,
      hasFullSegment: true,
      lambdaSim: lambdaSim,
      vSim: vSim
    };
  }

  function measureHeadless(moduleId, params) {
    if (moduleId === "melde") {
      return getSnapshot("melde", createState("melde", params), params);
    }

    const state = createState(moduleId, params);
    const Tth = moduleId === "pendulum"
      ? computePendulumTheory(params).T
      : computeSpringTheory(params).T;
    const maxTime = Math.min(60, Math.max(3.2 * Tth, 1.0));

    while (state.t < maxTime && state.crossings.length < 2) {
      if (moduleId === "pendulum") {
        stepPendulumRK4(state, params, RK4_STEP);
      } else {
        stepSpringRK4(state, params, RK4_STEP);
      }
    }
    return getSnapshot(moduleId, state, params);
  }

  function getSnapshot(moduleId, state, params) {
    if (moduleId === "pendulum") {
      const theory = computePendulumTheory(params);
      const vTangential = params.L * state.omega;
      const Ek = 0.5 * params.m * vTangential * vTangential;
      const Ep = params.m * params.g * params.L * (1 - Math.cos(state.theta));
      const Em = Ek + Ep;
      const Tsim = state.measuredT;
      const fsim = Tsim ? 1 / Tsim : null;
      const errPct = Tsim ? (Math.abs(Tsim - theory.T) / theory.T) * 100 : null;

      let note = "Sudut kecil (theta <= 15 deg): periode RK4 cocok dengan rumus aproksimasi sudut kecil.";
      if (params.thetaDeg > 15) {
        note = "Sudut besar (" + params.thetaDeg + " deg): periode RK4 non-linear lebih panjang daripada rumus sudut kecil karena sin(theta) < theta.";
      }

      return {
        moduleId: moduleId,
        measuring: Tsim === null,
        theoryMain: theory.T,
        simMain: Tsim,
        theorySub: theory.f,
        simSub: fsim,
        errorPct: errPct,
        mainUnit: "s",
        subUnit: "Hz",
        energies: { Ek: Ek, Ep: Ep, Em: Em, EmRef: Math.max(theory.Em, 1e-6) },
        note: note,
        summaryText: "L=" + params.L.toFixed(2) + " m, sudut=" + params.thetaDeg + " deg, m=" + params.m.toFixed(1) + " kg, g=" + params.g.toFixed(2) + " m/s^2"
      };
    }

    if (moduleId === "spring") {
      const theory = computeSpringTheory(params);
      const Ek = 0.5 * params.m * state.v * state.v;
      const Ep = 0.5 * params.k * state.x * state.x;
      const Em = Ek + Ep;
      const Tsim = state.measuredT;
      const fsim = Tsim ? 1 / Tsim : null;
      const errPct = Tsim ? (Math.abs(Tsim - theory.T) / theory.T) * 100 : null;

      let note = "Gerak harmonik bebas (b = 0): energi mekanik total tetap sepanjang osilasi.";
      if (params.b > 0) {
        note = "Osilasi teredam (b = " + params.b.toFixed(2) + "): energi mekanik meluruh oleh gaya gesek dan periode terukur bergeser.";
      }

      return {
        moduleId: moduleId,
        measuring: Tsim === null,
        theoryMain: theory.T,
        simMain: Tsim,
        theorySub: theory.f,
        simSub: fsim,
        errorPct: errPct,
        mainUnit: "s",
        subUnit: "Hz",
        energies: { Ek: Ek, Ep: Ep, Em: Em, EmRef: Math.max(theory.Em, 1e-6) },
        note: note,
        summaryText: "m=" + params.m.toFixed(1) + " kg, k=" + params.k + " N/m, A=" + params.A.toFixed(2) + " m, b=" + params.b.toFixed(2)
      };
    }

    const melde = measureMeldeSpatial(params);
    const theory = melde.theory;
    const isResonant = melde.hasFullSegment && theory.detune < 0.06;
    const errPct = melde.hasFullSegment ? (Math.abs(melde.vSim - theory.v) / theory.v) * 100 : null;

    let note = "Frekuensi mendekati resonansi harmonik ke-" + theory.nNearest + " (" + theory.fNearestResonance.toFixed(2) + " Hz).";
    if (!melde.hasFullSegment) {
      note = "Frekuensi di bawah nada dasar f1 (" + theory.fFundamental.toFixed(2) + " Hz); belum terbentuk 1 segmen penuh.";
    } else if (!isResonant) {
      note = "Di luar resonansi: harmonik terdekat n=" + theory.nNearest + " berada pada f=" + theory.fNearestResonance.toFixed(2) + " Hz.";
    }

    return {
      moduleId: moduleId,
      measuring: !melde.hasFullSegment,
      measuringMessage: melde.hasFullSegment ? "" : "Belum terbentuk 1 segmen penuh (f < f1)",
      theoryMain: theory.v,
      simMain: melde.vSim,
      theorySub: theory.lambda,
      simSub: melde.lambdaSim,
      errorPct: errPct,
      mainUnit: "m/s",
      subUnit: "m",
      melde: {
        F: theory.F,
        nExact: theory.nExact,
        nNearest: theory.nNearest,
        fFundamental: theory.fFundamental,
        fNearestResonance: theory.fNearestResonance,
        isResonant: isResonant,
        resonanceFactor: theory.resonanceFactor,
        nodes: melde.nodes,
        antinodes: melde.antinodes,
        nodeCount: melde.nodes.length,
        antinodeCount: melde.antinodes.length
      },
      note: note,
      summaryText: "m_b=" + params.mb.toFixed(2) + " kg (F=" + theory.F.toFixed(2) + " N), mu=" + params.mu.toFixed(3) + " kg/m, L=" + params.L.toFixed(1) + " m, f=" + params.f.toFixed(2) + " Hz"
    };
  }

  function getHarmonicFrequency(params, harmonicN) {
    const theory = computeMeldeTheory(params);
    return Number((harmonicN * theory.fFundamental).toFixed(2));
  }

  global.WaveLabPhysics = {
    MODULES: MODULES,
    G_MELDE: G_MELDE,
    getDefaults: getDefaults,
    validateParam: validateParam,
    computePendulumTheory: computePendulumTheory,
    computeSpringTheory: computeSpringTheory,
    computeMeldeTheory: computeMeldeTheory,
    createState: createState,
    advanceState: advanceState,
    measureHeadless: measureHeadless,
    getSnapshot: getSnapshot,
    getHarmonicFrequency: getHarmonicFrequency
  };
})(window);
