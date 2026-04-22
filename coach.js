(() => {
  const S = window.SessionCoachShared;
  const todayCard = document.getElementById("todayCard");
  const historyGrid = document.getElementById("historyGrid");
  const runtimeCard = document.getElementById("runtimeCard");
  const debugLog = document.getElementById("debugLog");
  const pageStatus = document.getElementById("pageStatus");
  const importFileInput = document.getElementById("importFileInput");
  const settingsStatus = document.getElementById("settingsStatus");
  const trainingPlanSelect = document.getElementById("trainingPlanSelect");
  const trainingDescription = document.getElementById("trainingDescription");
  const trainingSummary = document.getElementById("trainingSummary");
  const trainingTableWrap = document.getElementById("trainingTableWrap");
  const trainingStatus = document.getElementById("trainingStatus");
  const trainingHistory = document.getElementById("trainingHistory");
  const settingsFields = {
    averageOver: document.getElementById("averageOver"),
    first9Over: document.getElementById("first9Over"),
    checkoutDartsUnder: document.getElementById("checkoutDartsUnder"),
    maxBusts: document.getElementById("maxBusts")
  };

  let activeTab = (window.location.hash || "").replace(/^#/, "") || localStorage.getItem("sessionCoachTab") || "overview";
  let currentTrainingData = null;
  let currentTrainingPlan = null;
  let currentTrainingMetrics = null;
  let trainingDraftSaveTimer = null;
  let suppressTrainingStorageRefreshUntil = 0;

  function metric(label, value, note = "") {
    return `<div class="metric"><strong>${escapeHtml(label)}</strong><span>${escapeHtml(String(value))}</span>${note ? `<small>${escapeHtml(note)}</small>` : ""}</div>`;
  }

  function progressMetric(label, hits, total) {
    const safeTotal = Math.max(0, total || 0);
    const safeHits = Math.max(0, Math.min(safeTotal, hits || 0));
    const percent = safeTotal ? Math.round((safeHits / safeTotal) * 100) : 0;
    return `
      <div class="metric progress-metric">
        <strong>${escapeHtml(label)}</strong>
        <span>${safeHits}/${safeTotal}</span>
        <div class="goal-progress"><div class="goal-progress-fill" style="width:${percent}%"></div></div>
        <small>${percent}% hit rate</small>
      </div>
    `;
  }

  function trainingRatingBar(percent, label = "") {
    const safePercent = Math.max(0, Math.min(100, Math.round(percent || 0)));
    const modifier = safePercent >= 90 ? "is-elite" : safePercent >= 75 ? "is-very-strong" : safePercent >= 60 ? "is-strong" : safePercent >= 40 ? "is-solid" : "is-build";
    return `
      <div class="training-rating ${modifier}">
        <div class="training-rating-bar"><div class="training-rating-fill" style="width:${safePercent}%"></div></div>
        <div class="training-rating-meta"><strong>${safePercent}%</strong>${label ? `<span>${escapeHtml(label)}</span>` : ""}</div>
      </div>
    `;
  }

  function setPageStatus(message, delay = 2200) {
    if (!pageStatus) return;
    pageStatus.textContent = message || "";
    if (message) clearStatusSoon(pageStatus, delay);
  }

  async function renderToday(session) {
    const settings = await S.getSettings();
    if (!session) {
      todayCard.innerHTML = `
        <div class="grid">
          ${metric("Date", S.dateKeyFromTimestamp(), "Waiting for the first tracked leg")}
          ${metric("Matches", "0")}
          ${metric("Legs", "0")}
          ${metric("Perfect legs", "0")}
          ${metric("Leg average target", `>${S.fmtNumber(settings.defaultTargets.averageOver)}`)}
          ${metric("Leg first 9 target", `>${S.fmtNumber(settings.defaultTargets.first9Over)}`)}
          ${metric("Leg checkout target", `<${S.fmtNumber(settings.defaultTargets.checkoutDartsUnder)}`)}
          ${metric("Leg bust target", `≤${S.fmtMaybeInt(settings.defaultTargets.maxBusts)}`)}
        </div>
      `;
      return;
    }

    const summary = session.summary || S.summarizeDay(session).summary;
    todayCard.innerHTML = `
      <div class="grid">
        ${metric("Date", session.date, `${summary.goalRatePercent}% goals hit today`) }
        ${metric("Matches", summary.matches)}
        ${metric("Legs", summary.legs)}
        ${metric("Perfect legs", summary.perfectLegs)}
        ${metric("Mean leg average", `${S.fmtNumber(summary.averageMean)} / >${S.fmtNumber(session.targets.averageOver)}`)}
        ${metric("Mean leg first 9", `${S.fmtNumber(summary.first9Mean)} / >${S.fmtNumber(session.targets.first9Over)}`)}
        ${metric("Mean leg checkout", `${S.fmtNumber(summary.checkoutMean)} / <${S.fmtNumber(session.targets.checkoutDartsUnder)}`)}
        ${metric("Mean leg busts", `${S.fmtNumber(summary.bustsMean)} / ≤${S.fmtMaybeInt(session.targets.maxBusts)}`)}
        ${progressMetric("Average target", summary.goalHits.averageOver, summary.legs)}
        ${progressMetric("First 9 target", summary.goalHits.first9Over, summary.legs)}
        ${progressMetric("Checkout target", summary.goalHits.checkoutDartsUnder, summary.legs)}
        ${progressMetric("Bust target", summary.goalHits.maxBusts, summary.legs)}
      </div>
    `;
  }

  function renderHistory(todaySession, recentSessions) {
    const todayMatches = todaySession?.matches || [];
    const recentDays = recentSessions.filter((session) => session.date !== todaySession?.date);

    const matchesHtml = todayMatches.length ? todayMatches.map((match) => {
      const summary = match.summary || S.summarizeMatch(match, todaySession?.targets || S.DEFAULT_SETTINGS.defaultTargets);
      const legs = match.legs || [];
      return `
        <article class="session-card match-card">
          <h3>Match ${escapeHtml((match.matchId || "").slice(-8) || "—")}</h3>
          <div class="badge">${summary.perfectLegs}/${summary.legs} perfect legs · ${summary.goalRatePercent}% goals hit</div>
          <div class="match-progress-stack">
            ${progressBar("Average", summary.goalHits.averageOver, summary.legs)}
            ${progressBar("First 9", summary.goalHits.first9Over, summary.legs)}
            ${progressBar("Checkout", summary.goalHits.checkoutDartsUnder, summary.legs)}
            ${progressBar("Busts", summary.goalHits.maxBusts, summary.legs)}
          </div>
          <div class="leg-list">
            ${legs.map((leg) => `
              <div class="leg-item">
                <div class="leg-head"><strong>Leg ${leg.legNumber}</strong><span>${leg.goalSummary}</span></div>
                <div class="leg-grid">
                  <span>Avg ${S.fmtNumber(leg.stats.average)}</span>
                  <span>F9 ${S.fmtNumber(leg.stats.first9)}</span>
                  <span>CO ${S.fmtNumber(leg.stats.checkoutDartsPerChance)}</span>
                  <span>Busts ${S.fmtMaybeInt(leg.stats.busts)}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </article>
      `;
    }).join("") : `<div class="empty">No tracked matches today yet.</div>`;

    const daysHtml = recentDays.length ? recentDays.map((session) => {
      const summary = session.summary || S.summarizeDay(session).summary;
      return `
        <article class="session-card day-card">
          <h3>${escapeHtml(session.date)}</h3>
          <div class="badge">${summary.goalRatePercent}% goals hit</div>
          <div class="rows">
            <div class="row"><span>Matches</span><span>${summary.matches}</span></div>
            <div class="row"><span>Legs</span><span>${summary.legs}</span></div>
            <div class="row"><span>Perfect legs</span><span>${summary.perfectLegs}</span></div>
            <div class="row"><span>Mean leg average</span><span>${S.fmtNumber(summary.averageMean)}</span></div>
          </div>
        </article>
      `;
    }).join("") : "";

    historyGrid.innerHTML = `${matchesHtml}${daysHtml}`;
  }

  function progressBar(label, hits, total) {
    const safeTotal = Math.max(0, total || 0);
    const safeHits = Math.max(0, Math.min(safeTotal, hits || 0));
    const percent = safeTotal ? Math.round((safeHits / safeTotal) * 100) : 0;
    return `<div class="bar-row"><div class="row"><span>${escapeHtml(label)}</span><span>${safeHits}/${safeTotal}</span></div><div class="goal-progress"><div class="goal-progress-fill" style="width:${percent}%"></div></div></div>`;
  }

  function renderRuntime(runtime) {
    runtimeCard.textContent = JSON.stringify(runtime, null, 2);
  }

  function renderDebug(entries) {
    if (!entries.length) {
      debugLog.textContent = "Debug log is empty.";
      return;
    }
    debugLog.textContent = entries.map((entry, index) => {
      return `#${index + 1} ${new Date(entry.ts).toLocaleString()}\n${JSON.stringify(entry, null, 2)}`;
    }).join("\n\n");
  }

  async function loadSettings() {
    const settings = await S.getSettings();
    settingsFields.averageOver.value = settings.defaultTargets.averageOver;
    settingsFields.first9Over.value = settings.defaultTargets.first9Over;
    settingsFields.checkoutDartsUnder.value = settings.defaultTargets.checkoutDartsUnder;
    settingsFields.maxBusts.value = settings.defaultTargets.maxBusts;
  }

  function applyPreset(name) {
    const preset = S.TARGET_PRESETS?.[name];
    if (!preset) return;
    settingsFields.averageOver.value = preset.averageOver;
    settingsFields.first9Over.value = preset.first9Over;
    settingsFields.checkoutDartsUnder.value = preset.checkoutDartsUnder;
    settingsFields.maxBusts.value = preset.maxBusts;
    settingsStatus.textContent = `Preset applied: ${name}`;
    setTimeout(() => settingsStatus.textContent = "", 1500);
  }

  async function saveSettings() {
    const settings = await S.getSettings();
    settings.defaultTargets = {
      averageOver: S.safeNumber(settingsFields.averageOver.value) ?? settings.defaultTargets.averageOver,
      first9Over: S.safeNumber(settingsFields.first9Over.value) ?? settings.defaultTargets.first9Over,
      checkoutDartsUnder: S.safeNumber(settingsFields.checkoutDartsUnder.value) ?? settings.defaultTargets.checkoutDartsUnder,
      maxBusts: S.safeNumber(settingsFields.maxBusts.value) ?? settings.defaultTargets.maxBusts
    };
    await S.saveSettings(settings);
    await S.setSessionTargets(S.dateKeyFromTimestamp(), settings.defaultTargets, { createIfMissing: false });
    settingsStatus.textContent = "Leg targets saved.";
    setTimeout(() => settingsStatus.textContent = "", 1800);
    await loadSettings();
    await refresh();
  }

  function activateTab(tabName) {
    const fallbackTab = document.querySelector(`.tab-btn[data-tab="${tabName}"]`) ? tabName : "overview";
    activeTab = fallbackTab;
    localStorage.setItem("sessionCoachTab", activeTab);
    if (window.location.hash.replace(/^#/, "") !== activeTab) {
      history.replaceState(null, "", `#${activeTab}`);
    }
    document.querySelectorAll(".tab-btn").forEach((btn) => btn.classList.toggle("is-active", btn.dataset.tab === activeTab));
    document.querySelectorAll(".tab-pane").forEach((pane) => pane.classList.toggle("is-active", pane.id === `tab-${activeTab}`));
  }

  function renderTrainingSelector(trainingData) {
    trainingPlanSelect.innerHTML = (S.TRAINING_PLANS || []).map((plan) => {
      const selected = plan.id === trainingData.selectedPlanId ? " selected" : "";
      return `<option value="${escapeHtml(plan.id)}"${selected}>${escapeHtml(plan.name)}</option>`;
    }).join("");
  }

  function buildTrainingSummaryHtml(plan, metrics) {
    const blocks = [
      metric("Plan", plan.name, `${plan.rows.length} drills · ${plan.rounds} rounds`),
      metric("Current score", S.fmtNumber(metrics.totalScore, 0, "0"), `${metrics.filledCells}/${metrics.totalCells} cells filled`)
    ];

    if (plan.showAverage !== false) {
      blocks.push(metric("Current average", S.fmtNumber(metrics.overallAverage, 1, "0"), `Across ${metrics.scoredCells || 0} scoring cells`));
    }

    const hasCheckoutRow = (plan.rows || []).some((row) => row.metricType === "checkoutDarts");
    if (hasCheckoutRow) {
      const checkoutNote = metrics.checkout170Average !== null
        ? `${metrics.checkout170Successes}/${plan.rounds} successful 170 finishes · Ø ${S.fmtNumber(metrics.checkout170Average, 1, "—")} darts`
        : `0/${plan.rounds} successful 170 finishes yet`;
      blocks.push(metric("170 checkout avg", S.fmtNumber(metrics.checkout170Average, 1, "—"), checkoutNote));
    }

    return blocks.join("");
  }

  async function renderTraining() {
    const trainingData = await S.getTrainingData();
    renderTrainingSelector(trainingData);
    const plan = S.getTrainingPlan(trainingData.selectedPlanId);
    if (!plan) {
      currentTrainingData = null;
      currentTrainingPlan = null;
      currentTrainingMetrics = null;
      trainingDescription.textContent = "No training plan available yet.";
      trainingSummary.innerHTML = "";
      trainingTableWrap.innerHTML = "<div class=\"empty\">No plan configured.</div>";
      trainingHistory.innerHTML = "";
      return;
    }

    const draft = trainingData.drafts?.[plan.id] || S.createEmptyTrainingDraft(plan.id);
    const metrics = S.computeTrainingMetrics(plan, draft.values);
    currentTrainingData = trainingData;
    currentTrainingPlan = plan;
    currentTrainingMetrics = metrics;
    trainingDescription.textContent = plan.description || "";
    trainingSummary.innerHTML = buildTrainingSummaryHtml(plan, metrics);
    trainingTableWrap.innerHTML = buildTrainingTableHtml(plan, metrics);
    renderTrainingHistory(plan, trainingData.attempts?.[plan.id] || []);
  }

  function buildTrainingTableHtml(plan, metrics) {
    const roundHeaders = Array.from({ length: plan.rounds }, (_, index) => `<th>${escapeHtml((plan.roundLabels && plan.roundLabels[index]) || `Round ${index + 1}`)}</th>`).join("");
    const showAverage = plan.showAverage !== false;
    const rowsHtml = metrics.rows.map((row) => `
      <tr>
        <th>
          <div class="training-label">
            <strong>${escapeHtml(row.title)}</strong>
            ${row.subtitle ? `<small>${escapeHtml(row.subtitle)}</small>` : ""}
          </div>
        </th>
        ${row.values.map((value, index) => `
          <td class="training-cell">
            <input
              class="training-cell-input"
              type="number"
              step="0.1"
              min="0"
              inputmode="decimal"
              data-row-id="${escapeHtml(row.id)}"
              data-round-index="${index}"
              value="${escapeAttribute(value)}"
            >
          </td>
        `).join("")}
        <td class="training-score" data-row-score="${escapeAttribute(row.id)}">${row.includeInScore ? S.fmtNumber(row.score, 0, "0") : "—"}</td>
        ${showAverage ? `<td class="training-average" data-row-average="${escapeAttribute(row.id)}">${S.fmtNumber(row.average, 1, "—")}</td>` : ""}
      </tr>
    `).join("");

    return `
      <table class="training-table">
        <thead>
          <tr>
            <th>Drill</th>
            ${roundHeaders}
            <th>Score</th>
            ${showAverage ? `<th>Average</th>` : ""}
          </tr>
        </thead>
        <tbody>${rowsHtml}</tbody>
        <tfoot>
          <tr>
            <td><strong>Overall</strong></td>
            <td colspan="${plan.rounds}" data-training-filled>${metrics.filledCells}/${metrics.totalCells} cells filled</td>
            <td data-training-total-score>${S.fmtNumber(metrics.totalScore, 0, "0")}</td>
            ${showAverage ? `<td data-training-overall-average>${S.fmtNumber(metrics.overallAverage, 1, "0")}</td>` : ""}
          </tr>
        </tfoot>
      </table>
    `;
  }

  function syncTrainingTableMetrics(plan, metrics) {
    for (const row of metrics.rows) {
      const scoreNode = trainingTableWrap.querySelector(`[data-row-score="${row.id}"]`);
      const avgNode = trainingTableWrap.querySelector(`[data-row-average="${row.id}"]`);
      if (scoreNode) scoreNode.textContent = row.includeInScore ? S.fmtNumber(row.score, 0, "0") : "—";
      if (avgNode) avgNode.textContent = S.fmtNumber(row.average, 1, "—");
    }
    const totalScoreNode = trainingTableWrap.querySelector("[data-training-total-score]");
    const totalAvgNode = trainingTableWrap.querySelector("[data-training-overall-average]");
    const filledNode = trainingTableWrap.querySelector("[data-training-filled]");
    if (totalScoreNode) totalScoreNode.textContent = S.fmtNumber(metrics.totalScore, 0, "0");
    if (totalAvgNode) totalAvgNode.textContent = S.fmtNumber(metrics.overallAverage, 1, "0");
    if (filledNode) filledNode.textContent = `${metrics.filledCells}/${metrics.totalCells} cells filled`;
    trainingSummary.innerHTML = buildTrainingSummaryHtml(plan, metrics);
  }

  function renderTrainingHistory(plan, attempts) {
    if (!attempts.length) {
      trainingHistory.innerHTML = `<div class="empty">No saved attempts for ${escapeHtml(plan.name)} yet.</div>`;
      return;
    }

    const showAverage = plan.showAverage !== false;
    const historyHeaders = Array.from({ length: plan.rounds }, (_, index) => `<th>${escapeHtml((plan.roundLabels && plan.roundLabels[index]) || `R${index + 1}`)}</th>`).join("");
    trainingHistory.innerHTML = attempts.slice(0, 10).map((attempt) => {
      const rowLines = (attempt.rows || []).map((row) => {
        const definition = plan.rows.find((item) => item.id === row.id);
        const label = definition?.title || row.id;
        const values = Array.from({ length: plan.rounds }, (_, roundIndex) => row.values?.[roundIndex] ?? "");
        const valueCells = values.map((value) => `<td>${escapeHtml(value === "" ? "—" : String(value))}</td>`).join("");
        const scoreDisplay = row.metricType === "checkoutDarts" ? "—" : S.fmtNumber(row.score, 0, "0");
        const avgDisplay = S.fmtNumber(row.average, 1, row.metricType === "checkoutDarts" ? "—" : "0");
        return `
          <tr>
            <th>${escapeHtml(label)}</th>
            ${valueCells}
            <td>${scoreDisplay}</td>
            ${showAverage ? `<td>${avgDisplay}</td>` : ""}
            <td>${trainingRatingBar(row.ratingPercent || 0, row.ratingLabel || S.trainingRatingLabel?.(row.ratingPercent || 0) || "")}</td>
          </tr>
        `;
      }).join("");

      const summary = attempt.summary || {};
      const scoreLine = `Score ${S.fmtNumber(summary.totalScore, 0, "0")}`;
      const ratingLine = `Rating ${Math.round(summary.overallRating || 0)}% · ${escapeHtml(summary.overallRatingLabel || S.trainingRatingLabel(summary.overallRating || 0))}`;
      const extraLine = showAverage ? `Avg ${S.fmtNumber(summary.overallAverage, 1, "0")}` : `${attempt.rows?.length || 0} drills`;

      return `
        <details class="session-card training-history-item">
          <summary class="training-history-summary">
            <div>
              <strong>${new Date(attempt.createdAt).toLocaleString()}</strong>
              <span>${scoreLine}</span>
            </div>
            <div>
              <strong>${Math.round(summary.overallRating || 0)}%</strong>
              <span>${escapeHtml(summary.overallRatingLabel || S.trainingRatingLabel(summary.overallRating || 0))}</span>
            </div>
            <div>
              <strong>${extraLine}</strong>
              <span>Saved attempt</span>
            </div>
          </summary>
          <div class="training-history-body">
            <div class="badge">${ratingLine}</div>
            <div class="training-table-wrap training-history-table-wrap">
              <table class="training-table training-history-table">
                <thead>
                  <tr>
                    <th>Drill</th>
                    ${historyHeaders}
                    <th>Score</th>
                    ${showAverage ? `<th>Average</th>` : ""}
                    <th>Rating</th>
                  </tr>
                </thead>
                <tbody>${rowLines}</tbody>
              </table>
            </div>
          </div>
        </details>
      `;
    }).join("");
  }

  function scheduleTrainingDraftSave() {
    if (!currentTrainingPlan || !currentTrainingData) return;
    if (trainingDraftSaveTimer) window.clearTimeout(trainingDraftSaveTimer);
    trainingDraftSaveTimer = window.setTimeout(async () => {
      suppressTrainingStorageRefreshUntil = Date.now() + 1500;
      await S.saveTrainingData(currentTrainingData);
    }, 500);
  }

  function handleTrainingCellInput(event) {
    const target = event.target;
    if (!(target instanceof HTMLInputElement) || !target.matches(".training-cell-input")) return;
    if (!currentTrainingData || !currentTrainingPlan) return;

    const rowId = target.dataset.rowId;
    const roundIndex = Number(target.dataset.roundIndex);
    const draft = currentTrainingData.drafts?.[currentTrainingPlan.id] || S.createEmptyTrainingDraft(currentTrainingPlan.id);
    if (!draft.values[rowId]) draft.values[rowId] = Array.from({ length: currentTrainingPlan.rounds || 5 }, () => "");
    draft.values[rowId][roundIndex] = target.value;
    draft.updatedAt = Date.now();
    currentTrainingData.selectedPlanId = currentTrainingPlan.id;
    currentTrainingData.drafts[currentTrainingPlan.id] = draft;
    currentTrainingMetrics = S.computeTrainingMetrics(currentTrainingPlan, draft.values);
    syncTrainingTableMetrics(currentTrainingPlan, currentTrainingMetrics);
    scheduleTrainingDraftSave();
  }

  function clearStatusSoon(node, delay = 1400) {
    setTimeout(() => {
      if (node.textContent) node.textContent = "";
    }, delay);
  }

  async function handleTrainingPlanChange() {
    const trainingData = await S.getTrainingData();
    trainingData.selectedPlanId = trainingPlanSelect.value;
    await S.saveTrainingData(trainingData);
    trainingStatus.textContent = "Training plan changed.";
    clearStatusSoon(trainingStatus);
    await renderTraining();
  }

  async function handleSaveTrainingAttempt() {
    if (trainingDraftSaveTimer) {
      window.clearTimeout(trainingDraftSaveTimer);
      trainingDraftSaveTimer = null;
    }
    const planId = trainingPlanSelect.value;
    const result = await S.saveTrainingAttempt(planId);
    trainingStatus.textContent = result.saved ? "Attempt saved." : "Nothing saved.";
    clearStatusSoon(trainingStatus, 1800);
    await renderTraining();
  }

  async function handleResetTraining() {
    if (trainingDraftSaveTimer) {
      window.clearTimeout(trainingDraftSaveTimer);
      trainingDraftSaveTimer = null;
    }
    await S.clearTrainingDraft(trainingPlanSelect.value);
    trainingStatus.textContent = "Current sheet reset.";
    clearStatusSoon(trainingStatus);
    await renderTraining();
  }

  async function handleNewAttempt() {
    if (trainingDraftSaveTimer) {
      window.clearTimeout(trainingDraftSaveTimer);
      trainingDraftSaveTimer = null;
    }
    await S.clearTrainingDraft(trainingPlanSelect.value);
    trainingStatus.textContent = "New attempt ready.";
    clearStatusSoon(trainingStatus);
    await renderTraining();
  }

  async function handleExportData() {
    const payload = await S.exportExtensionData();
    const filename = `session-coach-backup-${S.exportDateStamp()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    try {
      if (chrome?.downloads?.download) {
        await chrome.downloads.download({
          url,
          filename,
          saveAs: true,
          conflictAction: "uniquify"
        });
      } else {
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
      }
      setPageStatus(`Exported ${filename}`);
    } finally {
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    }
  }

  async function handleImportClick() {
    importFileInput.value = "";
    try {
      if (typeof importFileInput.showPicker === "function") {
        await importFileInput.showPicker();
      } else {
        importFileInput.click();
      }
    } catch (error) {
      importFileInput.click();
    }
  }

  async function handleImportFileChange(event) {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const rawText = await file.text();
      const payload = JSON.parse(rawText);
      const summary = await S.importExtensionData(payload);
      setPageStatus(`Imported ${summary.dayCount} tracked day(s) and ${summary.trainingAttemptCount} training attempt(s).`, 3200);
      await loadSettings();
      await refresh();
    } catch (error) {
      console.error(error);
      setPageStatus(`Import failed: ${error?.message || "Invalid file"}`, 3600);
    }
  }

  async function refresh() {
    const todayKey = S.dateKeyFromTimestamp();
    const sessions = await S.listRecentSessions(20);
    const runtime = await S.getRuntime();
    const debugEntries = await S.getDebugLog();
    const today = sessions.find((session) => session.date === todayKey) || null;
    await renderToday(today);
    renderHistory(today, sessions);
    renderRuntime(runtime);
    renderDebug(debugEntries);
    await renderTraining();
  }

  function escapeHtml(value) {
    return `${value || ""}`
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function escapeAttribute(value) {
    return `${value ?? ""}`
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  window.addEventListener("hashchange", () => {
    const nextTab = (window.location.hash || "").replace(/^#/, "") || "overview";
    if (nextTab !== activeTab) activateTab(nextTab);
  });

  document.querySelectorAll("[data-preset]").forEach((btn) => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));
  document.querySelectorAll(".tab-btn").forEach((btn) => btn.addEventListener("click", () => activateTab(btn.dataset.tab)));
  document.getElementById("saveSettingsBtn").addEventListener("click", saveSettings);
  document.getElementById("refreshBtn").addEventListener("click", refresh);
  document.getElementById("exportDataBtn").addEventListener("click", handleExportData);
  document.getElementById("importDataBtn").addEventListener("click", handleImportClick);
  importFileInput.addEventListener("change", handleImportFileChange);
  document.getElementById("clearDebugBtn").addEventListener("click", async () => {
    await S.clearDebugLog();
    await refresh();
  });
  trainingPlanSelect.addEventListener("change", handleTrainingPlanChange);
  document.getElementById("saveTrainingBtn").addEventListener("click", handleSaveTrainingAttempt);
  document.getElementById("resetTrainingBtn").addEventListener("click", handleResetTraining);
  document.getElementById("newAttemptBtn").addEventListener("click", handleNewAttempt);
  trainingTableWrap.addEventListener("input", handleTrainingCellInput);

  chrome.storage.onChanged.addListener(async (changes) => {
    const changedKeys = Object.keys(changes || {});
    if (changedKeys.length === 1 && changedKeys[0] === S.STORAGE_KEYS.TRAINING_DATA && Date.now() < suppressTrainingStorageRefreshUntil) {
      return;
    }
    await loadSettings();
    await refresh();
  });

  activateTab(activeTab);
  loadSettings();
  refresh();
})();
