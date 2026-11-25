(function (global) {
  "use strict";

  function readThemeColors() {
    const cs = getComputedStyle(document.documentElement);
    return {
      bg: cs.getPropertyValue("--bg").trim() || "#F5F2EB",
      surface: cs.getPropertyValue("--surface").trim() || "#FFFDF8",
      sunk: cs.getPropertyValue("--surface-sunk").trim() || "#ECE7DC",
      text: cs.getPropertyValue("--text").trim() || "#182026",
      muted: cs.getPropertyValue("--text-muted").trim() || "#4A5560",
      primary: cs.getPropertyValue("--primary").trim() || "#133C55",
      secondary: cs.getPropertyValue("--secondary").trim() || "#0F6B5B",
      accent: cs.getPropertyValue("--accent").trim() || "#B83A1B",
      border: cs.getPropertyValue("--border").trim() || "#C7BFAF",
      borderStrong: cs.getPropertyValue("--border-strong").trim() || "#787166"
    };
  }

  function resizeCanvas(canvas) {
    const rect = canvas.getBoundingClientRect();
    const cssWidth = Math.max(240, Math.floor(rect.width));
    const cssHeight = Math.max(150, Math.floor(rect.height));
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.floor(cssWidth * dpr);
    const targetH = Math.floor(cssHeight * dpr);

    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    const ctx = canvas.getContext("2d");
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { ctx: ctx, w: cssWidth, h: cssHeight };
  }

  function drawArrow(ctx, x1, y1, x2, y2, color) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy);
    if (len < 4) return;

    const headLen = Math.min(10, len * 0.35);
    const angle = Math.atan2(dy, dx);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x2, y2);
    ctx.lineTo(x2 - headLen * Math.cos(angle - Math.PI / 6), y2 - headLen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(x2 - headLen * Math.cos(angle + Math.PI / 6), y2 - headLen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawPendulumApparatus(ctx, w, h, state, params, colors) {
    ctx.fillStyle = colors.sunk;
    ctx.fillRect(0, 0, w, h);

    const pivotX = w * 0.5;
    const pivotY = 38;
    const maxLenPx = Math.max(90, h - 86);
    const minLenPx = Math.max(48, maxLenPx * 0.25);
    const lenRatio = (params.L - 0.2) / (3.0 - 0.2);
    const ropeLenPx = minLenPx + lenRatio * (maxLenPx - minLenPx);

    // Support beam at top.
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(pivotX - 68, pivotY);
    ctx.lineTo(pivotX + 68, pivotY);
    ctx.stroke();

    // Equilibrium plumb line.
    ctx.save();
    ctx.setLineDash([5, 5]);
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 1.25;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(pivotX, pivotY + ropeLenPx + 18);
    ctx.stroke();
    ctx.restore();

    // Protractor arc from -60 to +60 degrees.
    const arcR = Math.min(54, ropeLenPx * 0.65);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, arcR, Math.PI / 2 - Math.PI / 3, Math.PI / 2 + Math.PI / 3);
    ctx.stroke();

    // Motion trail arc.
    if (state.trail && state.trail.length > 1) {
      ctx.save();
      for (let i = 1; i < state.trail.length; i++) {
        const a0 = state.trail[i - 1];
        const a1 = state.trail[i];
        ctx.strokeStyle = colors.secondary;
        ctx.globalAlpha = (i / state.trail.length) * 0.55;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(pivotX + ropeLenPx * Math.sin(a0), pivotY + ropeLenPx * Math.cos(a0));
        ctx.lineTo(pivotX + ropeLenPx * Math.sin(a1), pivotY + ropeLenPx * Math.cos(a1));
        ctx.stroke();
      }
      ctx.restore();
    }

    const bobX = pivotX + ropeLenPx * Math.sin(state.theta);
    const bobY = pivotY + ropeLenPx * Math.cos(state.theta);
    const bobR = 11 + 3.6 * Math.sqrt(params.m);

    // String.
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(pivotX, pivotY);
    ctx.lineTo(bobX, bobY);
    ctx.stroke();

    // Pivot pin.
    ctx.fillStyle = colors.text;
    ctx.beginPath();
    ctx.arc(pivotX, pivotY, 4.5, 0, Math.PI * 2);
    ctx.fill();

    // Tangential velocity vector arrow.
    const vTan = params.L * state.omega;
    const arrowScale = 22;
    const vxPx = vTan * Math.cos(state.theta) * arrowScale;
    const vyPx = -vTan * Math.sin(state.theta) * arrowScale;
    drawArrow(ctx, bobX, bobY, bobX + vxPx, bobY + vyPx, colors.accent);

    // Mass bob.
    ctx.fillStyle = colors.primary;
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(bobX, bobY, bobR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    // Readout annotations.
    const compact = w < 460;
    ctx.fillStyle = colors.text;
    ctx.font = compact ? '600 11px "IBM Plex Mono", monospace' : '600 12px "IBM Plex Mono", monospace';
    ctx.textAlign = "left";
    const angleDeg = (state.theta * 180) / Math.PI;
    ctx.fillText("theta = " + angleDeg.toFixed(1) + " deg", 12, 22);
    ctx.fillText("v = " + vTan.toFixed(2) + " m/s", 12, 39);

    if (compact) {
      ctx.fillStyle = colors.muted;
      ctx.fillText("L=" + params.L.toFixed(2) + "m | g=" + params.g.toFixed(2), 12, 56);
    } else {
      ctx.textAlign = "right";
      ctx.fillStyle = colors.muted;
      ctx.fillText("L = " + params.L.toFixed(2) + " m | g = " + params.g.toFixed(2) + " m/s^2", w - 14, 24);
    }
    ctx.textAlign = "right";
    ctx.fillStyle = colors.accent;
    ctx.fillText("Panah: vektor kecepatan", w - 12, h - 12);
  }

  function drawSpringApparatus(ctx, w, h, state, params, colors) {
    ctx.fillStyle = colors.sunk;
    ctx.fillRect(0, 0, w, h);

    const wallX = 42;
    const trackY = h * 0.56;
    const blockH = 44 + 6 * Math.sqrt(params.m);
    const blockW = 54 + 6 * Math.sqrt(params.m);
    const eqX = Math.max(wallX + 120, w * 0.54);
    const maxAmpPx = Math.min(eqX - wallX - 88, w - eqX - blockW * 0.5 - 24);
    const pxPerMeter = Math.max(60, maxAmpPx / 0.50);
    const blockCenterX = eqX + state.x * pxPerMeter;
    const blockLeftX = blockCenterX - blockW * 0.5;
    const blockTopY = trackY - blockH;

    // Frictionless bench track.
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallX, trackY);
    ctx.lineTo(w - 18, trackY);
    ctx.stroke();

    // Fixed left wall with hatch marks.
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 2;
    ctx.fillRect(wallX - 16, trackY - 90, 16, 98);
    ctx.strokeRect(wallX - 16, trackY - 90, 16, 98);

    // Ruler ticks in meters around equilibrium.
    ctx.font = '500 11px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    [-0.4, -0.2, 0, 0.2, 0.4].forEach(function (tickVal) {
      const tx = eqX + tickVal * pxPerMeter;
      if (tx > wallX + 18 && tx < w - 20) {
        ctx.strokeStyle = tickVal === 0 ? colors.secondary : colors.borderStrong;
        ctx.lineWidth = tickVal === 0 ? 1.5 : 1;
        ctx.beginPath();
        ctx.moveTo(tx, trackY);
        ctx.lineTo(tx, trackY + 9);
        ctx.stroke();
        ctx.fillStyle = tickVal === 0 ? colors.secondary : colors.muted;
        ctx.fillText((tickVal === 0 ? "0" : tickVal.toFixed(1)) + " m", tx, trackY + 23);
      }
    });

    // Dashed equilibrium reference line.
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(eqX, trackY - blockH - 30);
    ctx.lineTo(eqX, trackY);
    ctx.stroke();
    ctx.restore();

    // Coiled spring between wallX and blockLeftX.
    const springY = trackY - blockH * 0.5;
    const springSpan = Math.max(36, blockLeftX - wallX);
    const coils = 13;
    const lead = 12;
    const bodySpan = Math.max(12, springSpan - lead * 2);
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(wallX, springY);
    ctx.lineTo(wallX + lead, springY);
    for (let i = 0; i < coils; i++) {
      const segStart = wallX + lead + (i / coils) * bodySpan;
      const segMid = segStart + bodySpan / (coils * 2);
      const amp = i % 2 === 0 ? -13 : 13;
      ctx.lineTo(segMid, springY + amp);
    }
    ctx.lineTo(blockLeftX - lead, springY);
    ctx.lineTo(blockLeftX, springY);
    ctx.stroke();

    // Mass block.
    ctx.fillStyle = colors.primary;
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 1.5;
    ctx.fillRect(blockLeftX, blockTopY, blockW, blockH);
    ctx.strokeRect(blockLeftX, blockTopY, blockW, blockH);

    ctx.fillStyle = colors.surface;
    ctx.font = '600 12px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(params.m.toFixed(1) + " kg", blockCenterX, blockTopY + blockH * 0.56);

    // Restoring force arrow F = -k * x.
    const force = -params.k * state.x;
    const forceArrowLen = Math.max(-70, Math.min(70, force * 3.5));
    drawArrow(ctx, blockCenterX, blockTopY - 14, blockCenterX + forceArrowLen, blockTopY - 14, colors.accent);

    // Top readouts.
    const compact = w < 460;
    ctx.fillStyle = colors.text;
    ctx.font = compact ? '600 11px "IBM Plex Mono", monospace' : '600 12px "IBM Plex Mono", monospace';
    ctx.textAlign = "left";
    ctx.fillText("x = " + state.x.toFixed(3) + " m", 12, 22);
    ctx.fillText("v = " + state.v.toFixed(2) + " m/s", 12, 39);

    ctx.textAlign = "right";
    ctx.fillStyle = colors.muted;
    ctx.fillText(compact ? "k=" + params.k + " | b=" + params.b.toFixed(2) : "k = " + params.k + " N/m | b = " + params.b.toFixed(2), w - 12, 22);
    ctx.fillStyle = colors.accent;
    ctx.fillText("Panah: gaya pemulih F = -kx", w - 12, h - 12);
  }

  function drawMeldeApparatus(ctx, w, h, state, params, snapshot, colors) {
    ctx.fillStyle = colors.sunk;
    ctx.fillRect(0, 0, w, h);

    const melde = snapshot.melde;
    const vibX = 56;
    const pulleyX = w - 72;
    const stringY = h * 0.44;
    const stringSpan = Math.max(120, pulleyX - vibX);
    const ampMaxPx = Math.min(48, h * 0.24);
    const ampPx = 10 + ampMaxPx * melde.resonanceFactor;

    // Vibrator housing on left.
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 2;
    ctx.fillRect(14, stringY - 26, vibX - 18, 52);
    ctx.strokeRect(14, stringY - 26, vibX - 18, 52);
    ctx.fillStyle = colors.text;
    ctx.font = '600 11px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText("VIB", 14 + (vibX - 18) * 0.5, stringY + 4);

    // Pulley wheel & hanging weight on right.
    const pulleyR = 14;
    ctx.fillStyle = colors.surface;
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(pulleyX, stringY + pulleyR, pulleyR, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();

    const ropeDropX = pulleyX + pulleyR;
    const weightTopY = stringY + pulleyR + 36;
    const weightW = 34 + 10 * Math.sqrt(params.mb);
    const weightH = 26 + 8 * Math.sqrt(params.mb);

    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(ropeDropX, stringY + pulleyR);
    ctx.lineTo(ropeDropX, weightTopY);
    ctx.stroke();

    ctx.fillStyle = colors.primary;
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 1.5;
    ctx.fillRect(ropeDropX - weightW * 0.5, weightTopY, weightW, weightH);
    ctx.strokeRect(ropeDropX - weightW * 0.5, weightTopY, weightW, weightH);

    ctx.fillStyle = colors.surface;
    ctx.font = '600 10px "IBM Plex Mono", monospace';
    ctx.textAlign = "center";
    ctx.fillText(params.mb.toFixed(2) + "kg", ropeDropX, weightTopY + weightH * 0.62);

    // Equilibrium center line along string.
    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = colors.borderStrong;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(vibX, stringY);
    ctx.lineTo(pulleyX, stringY);
    ctx.stroke();
    ctx.restore();

    // Dashed standing wave envelope (+/-).
    const k = (2 * Math.PI * params.f) / snapshot.theoryMain;
    const steps = 160;
    ctx.save();
    ctx.setLineDash([3, 3]);
    ctx.strokeStyle = colors.secondary;
    ctx.lineWidth = 1.25;
    [-1, 1].forEach(function (sign) {
      ctx.beginPath();
      for (let i = 0; i <= steps; i++) {
        const u = i / steps;
        const xMeters = u * params.L;
        const px = vibX + u * stringSpan;
        const py = stringY + sign * ampPx * Math.abs(Math.sin(k * xMeters));
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.stroke();
    });
    ctx.restore();

    // Active vibrating string waveform.
    const cosPhase = Math.cos(state.phase);
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const xMeters = u * params.L;
      const px = vibX + u * stringSpan;
      const py = stringY - ampPx * Math.sin(k * xMeters) * cosPhase;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Node markers: diamonds + "S" text label.
    melde.nodes.forEach(function (xM) {
      const px = vibX + (xM / params.L) * stringSpan;
      ctx.fillStyle = colors.accent;
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.moveTo(px, stringY - 6);
      ctx.lineTo(px + 6, stringY);
      ctx.lineTo(px, stringY + 6);
      ctx.lineTo(px - 6, stringY);
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = colors.accent;
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText("S", px, stringY - 11);
    });

    // Antinode markers: circles + "P" text label along upper envelope.
    melde.antinodes.forEach(function (xM) {
      const px = vibX + (xM / params.L) * stringSpan;
      const envY = stringY - ampPx;
      ctx.fillStyle = colors.secondary;
      ctx.strokeStyle = colors.surface;
      ctx.lineWidth = 1.25;
      ctx.beginPath();
      ctx.arc(px, envY, 4.5, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();

      ctx.fillStyle = colors.secondary;
      ctx.font = '600 10px "IBM Plex Mono", monospace';
      ctx.textAlign = "center";
      ctx.fillText("P", px, envY - 9);
    });

    // Top telemetry annotations and shape-coded legend.
    const compact = w < 520;
    ctx.fillStyle = colors.text;
    ctx.font = compact ? '600 10.5px "IBM Plex Mono", monospace' : '600 12px "IBM Plex Mono", monospace';
    ctx.textAlign = "left";
    ctx.fillText("F = " + melde.F.toFixed(2) + " N | n = " + melde.nExact.toFixed(2), 12, 22);

    ctx.fillStyle = melde.isResonant ? colors.secondary : colors.muted;
    const statusLabel = compact
      ? (melde.isResonant
          ? "Resonansi n=" + melde.nNearest + " (" + melde.nodeCount + "S, " + melde.antinodeCount + "P)"
          : "Luar resonansi (" + melde.nodeCount + "S, " + melde.antinodeCount + "P)")
      : (melde.isResonant
          ? "Resonansi Harmonik ke-" + melde.nNearest + " (" + melde.nodeCount + " Simpul, " + melde.antinodeCount + " Perut)"
          : "Di luar resonansi (" + melde.nodeCount + " Simpul, " + melde.antinodeCount + " Perut)");
    ctx.fillText(statusLabel, 12, h - 12);

    ctx.fillStyle = colors.muted;
    if (compact) {
      ctx.textAlign = "left";
      ctx.fillText("S = Simpul | P = Perut", 12, 38);
    } else {
      ctx.textAlign = "right";
      ctx.fillText("Simbol: [Belah Ketupat] S = Simpul | [Lingkaran] P = Perut", w - 14, 24);
    }
  }

  function drawTimeGraph(ctx, w, h, state, params, moduleId, colors) {
    ctx.fillStyle = colors.sunk;
    ctx.fillRect(0, 0, w, h);

    const padL = 52;
    const padR = 16;
    const padT = 18;
    const padB = 30;
    const plotW = Math.max(80, w - padL - padR);
    const plotH = Math.max(60, h - padT - padB);

    const tEnd = Math.max(10, state.t);
    const tStart = Math.max(0, tEnd - 10);
    const yBound = moduleId === "pendulum"
      ? Math.max(12, params.thetaDeg * 1.15)
      : Math.max(0.08, params.A * 1.15);

    // Plot box & zero axis.
    ctx.fillStyle = colors.surface;
    ctx.fillRect(padL, padT, plotW, plotH);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, padT, plotW, plotH);

    const midY = padT + plotH * 0.5;
    ctx.strokeStyle = colors.borderStrong;
    ctx.beginPath();
    ctx.moveTo(padL, midY);
    ctx.lineTo(padL + plotW, midY);
    ctx.stroke();

    // Vertical 2-second gridlines.
    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = colors.muted;
    ctx.textAlign = "center";
    const firstTick = Math.ceil(tStart / 2) * 2;
    for (let ts = firstTick; ts <= tEnd; ts += 2) {
      const px = padL + ((ts - tStart) / 10) * plotW;
      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.fillText(ts.toFixed(0) + "s", px, padT + plotH + 16);
    }

    // Y-axis ticks.
    ctx.textAlign = "right";
    const fmtY = moduleId === "pendulum" ? 0 : 2;
    ctx.fillText("+" + yBound.toFixed(fmtY), padL - 6, padT + 10);
    ctx.fillText("0", padL - 6, midY + 4);
    ctx.fillText("-" + yBound.toFixed(fmtY), padL - 6, padT + plotH);

    // Plot curve.
    const pts = state.history || [];
    if (pts.length > 0) {
      ctx.strokeStyle = colors.primary;
      ctx.lineWidth = 2;
      ctx.beginPath();
      let started = false;
      let lastX = padL;
      let lastY = midY;
      for (let i = 0; i < pts.length; i++) {
        const pt = pts[i];
        if (pt.t < tStart) continue;
        const px = padL + ((pt.t - tStart) / 10) * plotW;
        const py = midY - (pt.val / yBound) * (plotH * 0.46);
        if (!started) {
          ctx.moveTo(px, py);
          started = true;
        } else {
          ctx.lineTo(px, py);
        }
        lastX = px;
        lastY = py;
      }
      ctx.stroke();

      ctx.fillStyle = colors.accent;
      ctx.beginPath();
      ctx.arc(lastX, lastY, 4, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMeldeGraph(ctx, w, h, params, snapshot, colors) {
    ctx.fillStyle = colors.sunk;
    ctx.fillRect(0, 0, w, h);

    const padL = 52;
    const padR = 18;
    const padT = 18;
    const padB = 30;
    const plotW = Math.max(80, w - padL - padR);
    const plotH = Math.max(60, h - padT - padB);

    const fMax = 22;
    const vMax = Math.max(40, Math.ceil(Math.sqrt(fMax / params.mu) / 10) * 10);

    ctx.fillStyle = colors.surface;
    ctx.fillRect(padL, padT, plotW, plotH);
    ctx.strokeStyle = colors.border;
    ctx.lineWidth = 1;
    ctx.strokeRect(padL, padT, plotW, plotH);

    ctx.font = '500 10px "IBM Plex Mono", monospace';
    ctx.fillStyle = colors.muted;
    ctx.textAlign = "center";
    [0, 5, 10, 15, 20].forEach(function (fTick) {
      const px = padL + (fTick / fMax) * plotW;
      ctx.strokeStyle = colors.border;
      ctx.beginPath();
      ctx.moveTo(px, padT);
      ctx.lineTo(px, padT + plotH);
      ctx.stroke();
      ctx.fillText(fTick + " N", px, padT + plotH + 16);
    });

    ctx.textAlign = "right";
    ctx.fillText(vMax + " m/s", padL - 6, padT + 10);
    ctx.fillText((vMax * 0.5).toFixed(0), padL - 6, padT + plotH * 0.5 + 4);
    ctx.fillText("0", padL - 6, padT + plotH);

    // Draw v = sqrt(F / mu) curve.
    ctx.strokeStyle = colors.primary;
    ctx.lineWidth = 2.2;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const F = (i / 100) * fMax;
      const v = Math.sqrt(F / params.mu);
      const px = padL + (F / fMax) * plotW;
      const py = padT + plotH - Math.min(1, v / vMax) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Highlight active (F, v) point.
    const curF = snapshot.melde.F;
    const curV = snapshot.theoryMain;
    const dotX = padL + Math.min(1, curF / fMax) * plotW;
    const dotY = padT + plotH - Math.min(1, curV / vMax) * plotH;

    ctx.save();
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(dotX, padT + plotH);
    ctx.lineTo(dotX, dotY);
    ctx.lineTo(padL, dotY);
    ctx.stroke();
    ctx.restore();

    ctx.fillStyle = colors.accent;
    ctx.beginPath();
    ctx.arc(dotX, dotY, 5, 0, Math.PI * 2);
    ctx.fill();

    const coordText = "(" + curF.toFixed(1) + " N, " + curV.toFixed(1) + " m/s)";
    const alignRight = dotX > padL + plotW * 0.58;
    ctx.textAlign = alignRight ? "right" : "left";
    const labelX = alignRight ? dotX - 8 : dotX + 10;
    const labelY = Math.min(padT + plotH - 10, dotY + 18);
    const textW = ctx.measureText(coordText).width;
    const boxX = alignRight ? labelX - textW - 4 : labelX - 4;
    ctx.fillStyle = colors.surface;
    ctx.fillRect(boxX, labelY - 11, textW + 8, 15);
    ctx.fillStyle = colors.text;
    ctx.fillText(coordText, labelX, labelY);
  }

  function renderAll(apparatusCanvas, graphCanvas, moduleId, state, params, snapshot) {
    const colors = readThemeColors();

    if (apparatusCanvas) {
      const appBox = resizeCanvas(apparatusCanvas);
      if (moduleId === "pendulum") {
        drawPendulumApparatus(appBox.ctx, appBox.w, appBox.h, state, params, colors);
      } else if (moduleId === "spring") {
        drawSpringApparatus(appBox.ctx, appBox.w, appBox.h, state, params, colors);
      } else {
        drawMeldeApparatus(appBox.ctx, appBox.w, appBox.h, state, params, snapshot, colors);
      }
    }

    if (graphCanvas) {
      const gBox = resizeCanvas(graphCanvas);
      if (moduleId === "melde") {
        drawMeldeGraph(gBox.ctx, gBox.w, gBox.h, params, snapshot, colors);
      } else {
        drawTimeGraph(gBox.ctx, gBox.w, gBox.h, state, params, moduleId, colors);
      }
    }
  }

  global.WaveLabCanvas = {
    renderAll: renderAll
  };
})(window);
