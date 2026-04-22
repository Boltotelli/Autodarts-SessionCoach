(() => {
  const S = window.SessionCoachShared;
  const byId = (id) => document.getElementById(id);

  const elements = {
    enabled: byId("enabled"),
    overlayCompact: byId("overlayCompact"),
    overlayVisibilityMode: byId("overlayVisibilityMode"),
    overlayPosition: byId("overlayPosition"),
    trackedPlayerName: byId("trackedPlayerName"),
    averageOver: byId("averageOver"),
    first9Over: byId("first9Over"),
    checkoutDartsUnder: byId("checkoutDartsUnder"),
    maxBusts: byId("maxBusts"),
    statusText: byId("statusText")
  };

  async function loadSettings() {
    const settings = await S.getSettings();
    elements.enabled.checked = settings.enabled;
    elements.overlayCompact.checked = settings.overlayCompact;
    elements.overlayVisibilityMode.value = ["match-only", "always"].includes(settings.overlayVisibilityMode)
      ? settings.overlayVisibilityMode
      : "match-only";
    elements.overlayPosition.value = ["auto", "top-right", "top-left", "bottom-right", "bottom-left"].includes(settings.overlayPosition)
      ? settings.overlayPosition
      : "auto";
    elements.trackedPlayerName.value = settings.trackedPlayerName || "";
    elements.averageOver.value = settings.defaultTargets.averageOver;
    elements.first9Over.value = settings.defaultTargets.first9Over;
    elements.checkoutDartsUnder.value = settings.defaultTargets.checkoutDartsUnder;
    elements.maxBusts.value = settings.defaultTargets.maxBusts;
  }



  function applyPreset(name) {
    const preset = S.TARGET_PRESETS?.[name];
    if (!preset) return;
    elements.averageOver.value = preset.averageOver;
    elements.first9Over.value = preset.first9Over;
    elements.checkoutDartsUnder.value = preset.checkoutDartsUnder;
    elements.maxBusts.value = preset.maxBusts;
    elements.statusText.textContent = `Preset applied: ${name}`;
    setTimeout(() => { elements.statusText.textContent = ""; }, 1800);
  }

  async function save() {
    const currentSettings = await S.getSettings();
    const nextSettings = {
      enabled: elements.enabled.checked,
      overlayCompact: elements.overlayCompact.checked,
      overlayVisibilityMode: elements.overlayVisibilityMode.value,
      overlayPosition: elements.overlayPosition.value,
      trackedPlayerName: elements.trackedPlayerName.value.trim(),
      overlayOffset: elements.overlayPosition.value === "auto" ? null : (currentSettings.overlayOffset ?? null),
      defaultTargets: {
        averageOver: S.safeNumber(elements.averageOver.value) ?? S.DEFAULT_SETTINGS.defaultTargets.averageOver,
        first9Over: S.safeNumber(elements.first9Over.value) ?? S.DEFAULT_SETTINGS.defaultTargets.first9Over,
        checkoutDartsUnder: S.safeNumber(elements.checkoutDartsUnder.value) ?? S.DEFAULT_SETTINGS.defaultTargets.checkoutDartsUnder,
        maxBusts: S.safeNumber(elements.maxBusts.value) ?? S.DEFAULT_SETTINGS.defaultTargets.maxBusts
      }
    };

    await S.saveSettings(nextSettings);
    elements.statusText.textContent = "Saved. Reload play.autodarts.io if the overlay is already open.";
    setTimeout(() => {
      elements.statusText.textContent = "";
    }, 3000);
  }

  async function resetDefaults() {
    await S.saveSettings(S.DEFAULT_SETTINGS);
    await loadSettings();
    elements.statusText.textContent = "Defaults restored.";
    setTimeout(() => {
      elements.statusText.textContent = "";
    }, 2500);
  }

  document.querySelectorAll("[data-preset]").forEach((btn) => btn.addEventListener("click", () => applyPreset(btn.dataset.preset)));
  document.getElementById("saveBtn").addEventListener("click", save);
  document.getElementById("resetBtn").addEventListener("click", resetDefaults);
  document.getElementById("openCoachPage").addEventListener("click", () => {
    chrome.tabs.create({ url: chrome.runtime.getURL("coach.html") });
  });

  loadSettings();
})();
