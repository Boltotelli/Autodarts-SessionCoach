(() => {
  if (window.SessionCoachShared) return;

  const STORAGE_KEYS = {
    SETTINGS: "sessionCoachSettings",
    DAILY_SESSIONS: "sessionCoachDailySessions",
    DEBUG_LOG: "sessionCoachDebugLog",
    RUNTIME: "sessionCoachRuntime",
    ADVISOR_PROFILE: "sessionCoachAdvisorProfile",
    TRAINING_DATA: "sessionCoachTrainingData"
  };

  const DEFAULT_SETTINGS = {
    enabled: true,
    debugMode: true,
    trackedPlayerName: "",
    overlayCompact: false,
    overlayCollapsed: false,
    overlayVisibilityMode: "match-only",
    overlayHidden: false,
    overlayPosition: "auto",
    overlayOffset: null,
    defaultTargets: {
      averageOver: 55,
      first9Over: 60,
      checkoutDartsUnder: 5.0,
      maxBusts: 3
    }
  };

  const TARGET_PRESETS = {
    starter: { averageOver: 45, first9Over: 50, checkoutDartsUnder: 6.0, maxBusts: 4 },
    solid: { averageOver: 55, first9Over: 60, checkoutDartsUnder: 5.0, maxBusts: 3 },
    push: { averageOver: 65, first9Over: 72, checkoutDartsUnder: 4.0, maxBusts: 2 }
  };

  const DEFAULT_RUNTIME = {
    currentScore: null,
    currentSuggestedRoute: null,
    currentAltRoute: null,
    currentAdvisorReasons: [],
    currentAdvisorConfidence: "low",
    currentOutMode: "SI/DO",
    currentCheckoutMaxDarts: 3,
    currentDailyKey: null,
    adapterStatus: "waiting",
    lastAdapterUpdate: null,
    trackedPlayerResolved: "",
    lastKnownPlayerScore: null,
    isInMatch: false,
    activeMatchId: null
  };

  const DEFAULT_ADVISOR_PROFILE = {
    playerName: "",
    updatedAt: null,
    sample: {
      visits: 0,
      throws: 0,
      checkouts: 0
    },
    segments: {},
    doubles: {},
    routes: {}
  };

  const TRAINING_PLANS = [
    {
      id: "checkouts-cluster-170",
      name: "Checkout Cluster + 170",
      description: "Manual five-round drill with focused number throws, a nine-dart scoring drill and repeated 170 finish attempts.",
      rounds: 5,
      rows: [
        { id: "throw19", title: "Throw @19's Score", subtitle: "what you Hit", metricType: "score", includeInScore: true, perfectRoundScore: 171, weight: 1 },
        { id: "throw20", title: "Throw @20's Score", subtitle: "what you Hit", metricType: "score", includeInScore: true, perfectRoundScore: 180, weight: 1 },
        { id: "highscore9", title: "Highscore with 9", subtitle: "Throw 9 Darts and total your Score", metricType: "score", includeInScore: true, perfectRoundScore: 540, weight: 1.2 },
        { id: "threeAny", title: "Three of any Number", subtitle: "Only score if all 3 Darts hit the Same score", metricType: "score", includeInScore: true, perfectRoundScore: 180, weight: 0.9 },
        { id: "throw18", title: "Throw @18's Score", subtitle: "what you Hit", metricType: "score", includeInScore: true, perfectRoundScore: 162, weight: 1 },
        { id: "check170", title: "How many to check out 170", subtitle: "Enter darts used, or 0 if you did not finish", metricType: "checkoutDarts", includeInScore: false, ignoreZeroForAverage: true, weight: 0.9 }
      ]
    },
    {
      id: "round-the-board-count-hits",
      name: "Round the Board Count the Hits",
      description: "Go clockwise around the dartboard order (1, 18, 4 … 20, Bull). Enter only your Treffer per target. The coach converts hits into points automatically: 4 Treffer on 1 = 4 points, 6 Treffer on 20 = 120 points, Bull uses 25 points per hit.",
      rounds: 1,
      roundLabels: ["Treffer"],
      showAverage: false,
      rows: [
        { id: "rtb1", title: "1", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 1, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb18", title: "18", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 18, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb4", title: "4", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 4, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb13", title: "13", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 13, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb6", title: "6", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 6, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb10", title: "10", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 10, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb15", title: "15", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 15, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb2", title: "2", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 2, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb17", title: "17", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 17, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb3", title: "3", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 3, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb19", title: "19", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 19, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb7", title: "7", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 7, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb16", title: "16", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 16, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb8", title: "8", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 8, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb11", title: "11", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 11, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb14", title: "14", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 14, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb9", title: "9", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 9, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb12", title: "12", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 12, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb5", title: "5", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 5, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtb20", title: "20", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 20, includeInScore: true, perfectRoundScore: 9, weight: 1 },
        { id: "rtbBull", title: "Bull", subtitle: "Enter hits from 3 darts", metricType: "targetHits", targetValue: 25, includeInScore: true, perfectRoundScore: 6, weight: 1 }
      ]
    }
  ];

  const DEFAULT_TRAINING_DATA = {
    selectedPlanId: TRAINING_PLANS[0]?.id || null,
    drafts: {},
    attempts: {}
  };

  const DOUBLEABLE_VALUES = new Set();
  for (let i = 1; i <= 20; i += 1) DOUBLEABLE_VALUES.add(i * 2);
  DOUBLEABLE_VALUES.add(50);

  const DARTS = [];
  for (let i = 1; i <= 20; i += 1) {
    DARTS.push({ label: `S${i}`, value: i, segment: `S${i}`, ring: "S", doubleKey: null, tripleKey: null });
    DARTS.push({ label: `D${i}`, value: i * 2, segment: `D${i}`, ring: "D", doubleKey: `D${i}`, tripleKey: null });
    DARTS.push({ label: `T${i}`, value: i * 3, segment: `T${i}`, ring: "T", doubleKey: null, tripleKey: `T${i}` });
  }
  DARTS.push({ label: "SB", value: 25, segment: "SB", ring: "S", doubleKey: null, tripleKey: null });
  DARTS.push({ label: "DB", value: 50, segment: "DB", ring: "D", doubleKey: "DB", tripleKey: null });

  const CHECKOUT_CACHE = new Map();
  const CHECKOUT_BOGEY_DO = new Set([169, 168, 166, 165, 163, 162, 159]);
  const STANDARD_DOUBLE_PRIORITY = [
    "D16", "D20", "D10", "D8", "D12", "D18", "D6", "D14", "D4", "D2",
    "DB", "D7", "D5", "D9", "D11", "D13", "D15", "D17", "D19", "D1", "D3"
  ];
  const STANDARD_TRIPLE_PRIORITY = [
    "T20", "T19", "T18", "T17", "T16", "T15", "T14", "T13", "T12", "T11",
    "T10", "T9", "T8", "T7", "T6", "T5", "T4", "T3", "T2", "T1"
  ];

  const EXPORT_SCHEMA_VERSION = 1;

  function clone(value) {
    return JSON.parse(JSON.stringify(value));
  }

  function storageGet(keys) {
    return new Promise((resolve) => chrome.storage.local.get(keys, resolve));
  }

  function storageGetAll() {
    return new Promise((resolve) => chrome.storage.local.get(null, resolve));
  }

  function storageSet(obj) {
    return new Promise((resolve) => chrome.storage.local.set(obj, resolve));
  }

  async function getSettings() {
    const result = await storageGet([STORAGE_KEYS.SETTINGS]);
    return deepMerge(clone(DEFAULT_SETTINGS), result[STORAGE_KEYS.SETTINGS] || {});
  }

  async function saveSettings(settings) {
    const merged = deepMerge(clone(DEFAULT_SETTINGS), settings || {});
    await storageSet({ [STORAGE_KEYS.SETTINGS]: merged });
    return merged;
  }

  function createEmptySummary() {
    return {
      matches: 0,
      legs: 0,
      finishedMatches: 0,
      averageMean: null,
      first9Mean: null,
      checkoutMean: null,
      bustsMean: null,
      perfectLegs: 0,
      goalHits: {
        averageOver: 0,
        first9Over: 0,
        checkoutDartsUnder: 0,
        maxBusts: 0
      },
      goalRatePercent: 0
    };
  }

  function createEmptySession(sessionKey, targets) {
    return {
      date: sessionKey,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      targets: deepMerge(clone(DEFAULT_SETTINGS.defaultTargets), targets || {}),
      matches: [],
      summary: createEmptySummary(),
      notes: []
    };
  }

  function ensureSessionShape(session, targets) {
    const base = createEmptySession(session?.date || dateKeyFromTimestamp(), targets || session?.targets);
    const merged = deepMerge(base, session || {});
    merged.targets = deepMerge(clone(DEFAULT_SETTINGS.defaultTargets), merged.targets || {});
    if (!Array.isArray(merged.matches)) merged.matches = [];
    merged.matches = merged.matches.map((match, index) => ensureMatchShape(match, merged.targets, index + 1));
    merged.summary = summarizeDay(merged).summary;
    return merged;
  }

  function createEmptyMatch(matchId, targets, meta = {}) {
    return {
      matchId: matchId || `match-${Date.now()}`,
      startedAt: Date.now(),
      updatedAt: Date.now(),
      endedAt: null,
      meta: {
        outMode: meta.outMode || null,
        variant: meta.variant || "X01"
      },
      legs: [],
      summary: {
        legs: 0,
        averageMean: null,
        first9Mean: null,
        checkoutMean: null,
        bustsMean: null,
        perfectLegs: 0,
        goalHits: {
          averageOver: 0,
          first9Over: 0,
          checkoutDartsUnder: 0,
          maxBusts: 0
        },
        goalRatePercent: 0
      },
      targets: deepMerge(clone(DEFAULT_SETTINGS.defaultTargets), targets || {})
    };
  }

  function ensureMatchShape(match, targets, fallbackNumber = 1) {
    const base = createEmptyMatch(match?.matchId || `legacy-${fallbackNumber}`, targets, match?.meta);
    const merged = deepMerge(base, match || {});
    merged.targets = deepMerge(clone(targets || DEFAULT_SETTINGS.defaultTargets), merged.targets || {});
    if (!Array.isArray(merged.legs)) merged.legs = [];
    merged.legs = merged.legs.map((leg, index) => ensureLegShape(leg, merged.targets, index + 1));
    merged.summary = summarizeMatch(merged, merged.targets);
    return merged;
  }

  function ensureLegShape(leg, targets, fallbackNumber = 1) {
    const stats = {
      darts: safeNumber(leg?.stats?.darts) || 0,
      scored: safeNumber(leg?.stats?.scored) || 0,
      average: safeNumber(leg?.stats?.average),
      first9: safeNumber(leg?.stats?.first9),
      checkoutDartsPerChance: safeNumber(leg?.stats?.checkoutDartsPerChance),
      busts: safeNumber(leg?.stats?.busts) || 0
    };
    const targetSet = deepMerge(clone(DEFAULT_SETTINGS.defaultTargets), targets || {});
    const goalStatus = calcGoalStatus(stats, targetSet);
    return {
      legNumber: safeNumber(leg?.legNumber) || fallbackNumber,
      won: Boolean(leg?.won),
      reason: leg?.reason || "completed",
      startedAt: leg?.startedAt || Date.now(),
      endedAt: leg?.endedAt || Date.now(),
      stats,
      goalStatus,
      goalSummary: computeGoalSummary(goalStatus)
    };
  }

  function summarizeMatch(match, targets = DEFAULT_SETTINGS.defaultTargets) {
    const legs = Array.isArray(match?.legs) ? match.legs : [];
    const summary = {
      legs: legs.length,
      averageMean: meanOf(legs.map((leg) => leg?.stats?.average)),
      first9Mean: meanOf(legs.map((leg) => leg?.stats?.first9)),
      checkoutMean: meanOf(legs.map((leg) => leg?.stats?.checkoutDartsPerChance)),
      bustsMean: meanOf(legs.map((leg) => leg?.stats?.busts)),
      perfectLegs: legs.filter((leg) => computeGoalSummary(leg.goalStatus) === "4/4").length,
      goalHits: {
        averageOver: legs.filter((leg) => leg.goalStatus?.averageOver === "green").length,
        first9Over: legs.filter((leg) => leg.goalStatus?.first9Over === "green").length,
        checkoutDartsUnder: legs.filter((leg) => leg.goalStatus?.checkoutDartsUnder === "green").length,
        maxBusts: legs.filter((leg) => leg.goalStatus?.maxBusts === "green").length
      },
      goalRatePercent: 0
    };
    summary.goalRatePercent = summary.legs ? Math.round(((summary.goalHits.averageOver + summary.goalHits.first9Over + summary.goalHits.checkoutDartsUnder + summary.goalHits.maxBusts) / (summary.legs * 4)) * 100) : 0;
    return summary;
  }

  function summarizeDay(session) {
    const safeSession = ensureSessionShape(session, session?.targets);
    const matches = safeSession.matches || [];
    const allLegs = matches.flatMap((match) => match.legs || []);
    const summary = createEmptySummary();
    summary.matches = matches.length;
    summary.finishedMatches = matches.filter((match) => match.endedAt).length;
    summary.legs = allLegs.length;
    summary.averageMean = meanOf(allLegs.map((leg) => leg?.stats?.average));
    summary.first9Mean = meanOf(allLegs.map((leg) => leg?.stats?.first9));
    summary.checkoutMean = meanOf(allLegs.map((leg) => leg?.stats?.checkoutDartsPerChance));
    summary.bustsMean = meanOf(allLegs.map((leg) => leg?.stats?.busts));
    summary.perfectLegs = allLegs.filter((leg) => computeGoalSummary(leg.goalStatus) === "4/4").length;
    summary.goalHits.averageOver = allLegs.filter((leg) => leg.goalStatus?.averageOver === "green").length;
    summary.goalHits.first9Over = allLegs.filter((leg) => leg.goalStatus?.first9Over === "green").length;
    summary.goalHits.checkoutDartsUnder = allLegs.filter((leg) => leg.goalStatus?.checkoutDartsUnder === "green").length;
    summary.goalHits.maxBusts = allLegs.filter((leg) => leg.goalStatus?.maxBusts === "green").length;
    summary.goalRatePercent = summary.legs ? Math.round(((summary.goalHits.averageOver + summary.goalHits.first9Over + summary.goalHits.checkoutDartsUnder + summary.goalHits.maxBusts) / (summary.legs * 4)) * 100) : 0;
    safeSession.summary = summary;
    return safeSession;
  }

  async function getDailySessions() {
    const result = await storageGet([STORAGE_KEYS.DAILY_SESSIONS]);
    const raw = result[STORAGE_KEYS.DAILY_SESSIONS] || {};
    const normalized = {};
    for (const [key, value] of Object.entries(raw)) {
      normalized[key] = summarizeDay(ensureSessionShape(value, value?.targets));
    }
    return normalized;
  }

  async function saveDailySessions(dailySessions) {
    await storageSet({ [STORAGE_KEYS.DAILY_SESSIONS]: dailySessions || {} });
  }

  async function getRuntime() {
    const result = await storageGet([STORAGE_KEYS.RUNTIME]);
    return deepMerge(clone(DEFAULT_RUNTIME), result[STORAGE_KEYS.RUNTIME] || {});
  }

  async function saveRuntime(runtime) {
    const merged = deepMerge(clone(DEFAULT_RUNTIME), runtime || {});
    await storageSet({ [STORAGE_KEYS.RUNTIME]: merged });
    return merged;
  }

  async function getAdvisorProfile() {
    const result = await storageGet([STORAGE_KEYS.ADVISOR_PROFILE]);
    return deepMerge(clone(DEFAULT_ADVISOR_PROFILE), result[STORAGE_KEYS.ADVISOR_PROFILE] || {});
  }

  async function saveAdvisorProfile(profile) {
    const merged = deepMerge(clone(DEFAULT_ADVISOR_PROFILE), profile || {});
    merged.updatedAt = Date.now();
    await storageSet({ [STORAGE_KEYS.ADVISOR_PROFILE]: merged });
    return merged;
  }

  function trainingScorePercent(value, perfect, power = 0.6) {
    const safeValue = safeNumber(value) || 0;
    const safePerfect = safeNumber(perfect) || 0;
    if (safePerfect <= 0 || safeValue <= 0) return 0;
    return clamp(Math.pow(safeValue / safePerfect, power) * 100, 0, 100);
  }

  function training170SpeedPercent(averageDarts) {
    const avg = safeNumber(averageDarts);
    if (!avg || avg <= 0) return 0;
    if (avg <= 3) return 100;
    return clamp(100 - ((avg - 3) * 20), 0, 100);
  }

  function trainingRatingLabel(percent) {
    const value = safeNumber(percent) || 0;
    if (value >= 90) return "Elite";
    if (value >= 75) return "Very strong";
    if (value >= 60) return "Strong";
    if (value >= 40) return "Solid";
    return "Build-up";
  }

  function exportDateStamp(ts = Date.now()) {
    const date = new Date(ts);
    const y = date.getFullYear();
    const m = `${date.getMonth() + 1}`.padStart(2, "0");
    const d = `${date.getDate()}`.padStart(2, "0");
    const hh = `${date.getHours()}`.padStart(2, "0");
    const mm = `${date.getMinutes()}`.padStart(2, "0");
    const ss = `${date.getSeconds()}`.padStart(2, "0");
    return `${y}${m}${d}-${hh}${mm}${ss}`;
  }

  function normalizeImportedDailySessions(rawSessions) {
    const normalized = {};
    for (const [key, value] of Object.entries(rawSessions || {})) {
      normalized[key] = summarizeDay(ensureSessionShape(value, value?.targets));
    }
    return normalized;
  }

  async function exportExtensionData() {
    const stored = await storageGet(Object.values(STORAGE_KEYS));
    return {
      extension: "autodarts-session-coach",
      schemaVersion: EXPORT_SCHEMA_VERSION,
      exportedAt: new Date().toISOString(),
      data: {
        [STORAGE_KEYS.SETTINGS]: deepMerge(clone(DEFAULT_SETTINGS), stored[STORAGE_KEYS.SETTINGS] || {}),
        [STORAGE_KEYS.DAILY_SESSIONS]: normalizeImportedDailySessions(stored[STORAGE_KEYS.DAILY_SESSIONS] || {}),
        [STORAGE_KEYS.DEBUG_LOG]: Array.isArray(stored[STORAGE_KEYS.DEBUG_LOG]) ? stored[STORAGE_KEYS.DEBUG_LOG] : [],
        [STORAGE_KEYS.RUNTIME]: deepMerge(clone(DEFAULT_RUNTIME), stored[STORAGE_KEYS.RUNTIME] || {}),
        [STORAGE_KEYS.ADVISOR_PROFILE]: deepMerge(clone(DEFAULT_ADVISOR_PROFILE), stored[STORAGE_KEYS.ADVISOR_PROFILE] || {}),
        [STORAGE_KEYS.TRAINING_DATA]: normalizeTrainingData(stored[STORAGE_KEYS.TRAINING_DATA] || {})
      }
    };
  }

  async function importExtensionData(payload) {
    const source = payload?.data && typeof payload.data === "object" ? payload.data : payload || {};
    const imported = {
      [STORAGE_KEYS.SETTINGS]: deepMerge(clone(DEFAULT_SETTINGS), source[STORAGE_KEYS.SETTINGS] || source.settings || {}),
      [STORAGE_KEYS.DAILY_SESSIONS]: normalizeImportedDailySessions(source[STORAGE_KEYS.DAILY_SESSIONS] || source.dailySessions || {}),
      [STORAGE_KEYS.DEBUG_LOG]: Array.isArray(source[STORAGE_KEYS.DEBUG_LOG] || source.debugLog) ? (source[STORAGE_KEYS.DEBUG_LOG] || source.debugLog) : [],
      [STORAGE_KEYS.RUNTIME]: deepMerge(clone(DEFAULT_RUNTIME), source[STORAGE_KEYS.RUNTIME] || source.runtime || {}),
      [STORAGE_KEYS.ADVISOR_PROFILE]: deepMerge(clone(DEFAULT_ADVISOR_PROFILE), source[STORAGE_KEYS.ADVISOR_PROFILE] || source.advisorProfile || {}),
      [STORAGE_KEYS.TRAINING_DATA]: normalizeTrainingData(source[STORAGE_KEYS.TRAINING_DATA] || source.trainingData || {})
    };
    await storageSet(imported);
    return {
      importedAt: Date.now(),
      dayCount: Object.keys(imported[STORAGE_KEYS.DAILY_SESSIONS] || {}).length,
      trainingAttemptCount: Object.values(imported[STORAGE_KEYS.TRAINING_DATA]?.attempts || {}).reduce((sum, list) => sum + (Array.isArray(list) ? list.length : 0), 0)
    };
  }

  function getTrainingPlan(planId) {
    return TRAINING_PLANS.find((plan) => plan.id === planId) || TRAINING_PLANS[0] || null;
  }

  function createEmptyTrainingDraft(planId) {
    const plan = getTrainingPlan(planId);
    const values = {};
    if (plan) {
      for (const row of plan.rows || []) {
        values[row.id] = Array.from({ length: plan.rounds || 5 }, () => "");
      }
    }
    return {
      planId: plan?.id || planId || null,
      values,
      updatedAt: Date.now()
    };
  }

  function normalizeTrainingData(trainingData) {
    const normalized = deepMerge(clone(DEFAULT_TRAINING_DATA), trainingData || {});
    if (!getTrainingPlan(normalized.selectedPlanId)) normalized.selectedPlanId = TRAINING_PLANS[0]?.id || null;
    if (!normalized.drafts || typeof normalized.drafts !== "object") normalized.drafts = {};
    if (!normalized.attempts || typeof normalized.attempts !== "object") normalized.attempts = {};

    for (const plan of TRAINING_PLANS) {
      if (!normalized.drafts[plan.id]) normalized.drafts[plan.id] = createEmptyTrainingDraft(plan.id);
      const draft = normalized.drafts[plan.id];
      if (!draft.values || typeof draft.values !== "object") draft.values = {};
      for (const row of plan.rows || []) {
        const rowValues = Array.isArray(draft.values[row.id]) ? draft.values[row.id].slice(0, plan.rounds || 5) : [];
        while (rowValues.length < (plan.rounds || 5)) rowValues.push("");
        draft.values[row.id] = rowValues.map((value) => value === null || value === undefined ? "" : `${value}`);
      }
      draft.planId = plan.id;
      if (!Array.isArray(normalized.attempts[plan.id])) normalized.attempts[plan.id] = [];
    }
    return normalized;
  }

  async function getTrainingData() {
    const result = await storageGet([STORAGE_KEYS.TRAINING_DATA]);
    return normalizeTrainingData(result[STORAGE_KEYS.TRAINING_DATA] || {});
  }

  async function saveTrainingData(trainingData) {
    const normalized = normalizeTrainingData(trainingData);
    await storageSet({ [STORAGE_KEYS.TRAINING_DATA]: normalized });
    return normalized;
  }

  function computeTrainingMetrics(plan, values) {
    const safePlan = getTrainingPlan(plan?.id || plan);
    const rowDefinitions = safePlan?.rows || [];
    const rounds = safePlan?.rounds || 5;
    const rows = rowDefinitions.map((row) => {
      const rawValues = Array.isArray(values?.[row.id]) ? values[row.id] : [];
      const parsedValues = Array.from({ length: rounds }, (_, index) => safeNumber(rawValues[index]));
      const filledValues = parsedValues.filter((value) => typeof value === "number");
      const scoringValues = row.metricType === "checkoutDarts"
        ? filledValues.filter((value) => !row.ignoreZeroForAverage || value > 0)
        : filledValues;
      const hitTotal = filledValues.reduce((sum, value) => sum + value, 0);
      const score = row.includeInScore === false
        ? null
        : row.metricType === "targetHits"
          ? hitTotal * (safeNumber(row.targetValue) || 0)
          : hitTotal;
      const average = row.metricType === "targetHits"
        ? null
        : scoringValues.length ? scoringValues.reduce((sum, value) => sum + value, 0) / scoringValues.length : null;
      const successfulAttempts = row.metricType === "checkoutDarts" ? scoringValues.length : null;
      let ratingPercent = 0;
      let ratingNote = "";
      let detailValue = null;

      if (row.metricType === "checkoutDarts") {
        const successRatePercent = rounds ? (successfulAttempts / rounds) * 100 : 0;
        const speedPercent = training170SpeedPercent(average);
        ratingPercent = (successRatePercent * 0.7) + (speedPercent * 0.3);
        detailValue = {
          successRatePercent,
          speedPercent,
          successfulAttempts,
          averageDarts: average
        };
        ratingNote = successfulAttempts
          ? `${successfulAttempts}/${rounds} finishes · Ø ${fmtNumber(average, 1, "—")} darts`
          : `0/${rounds} finishes`;
      } else {
        const perfectRound = safeNumber(row.perfectRoundScore) || 0;
        const perfectTotal = perfectRound * rounds;
        const ratingBase = row.metricType === "targetHits" ? hitTotal : score;
        ratingPercent = trainingScorePercent(ratingBase, perfectTotal, row.ratingPower || 0.6);
        detailValue = {
          perfectRound,
          perfectTotal,
          score,
          hitTotal
        };
        ratingNote = row.metricType === "targetHits"
          ? `${fmtNumber(hitTotal, 0, "0")} / ${fmtNumber(perfectTotal, 0, "0")} hits`
          : perfectTotal ? `${fmtNumber(score, 0, "0")} / ${fmtNumber(perfectTotal, 0, "0")} max` : "";
      }

      return {
        id: row.id,
        title: row.title,
        subtitle: row.subtitle || "",
        metricType: row.metricType || "score",
        includeInScore: row.includeInScore !== false,
        weight: safeNumber(row.weight) || 1,
        values: Array.from({ length: rounds }, (_, index) => rawValues[index] ?? ""),
        parsedValues,
        filled: filledValues.length,
        score,
        average,
        successfulAttempts,
        ratingPercent,
        ratingLabel: trainingRatingLabel(ratingPercent),
        ratingNote,
        detailValue
      };
    });

    const scoreRows = rows.filter((row) => row.includeInScore && typeof row.score === "number");
    const totalScore = scoreRows.reduce((sum, row) => sum + row.score, 0);
    const filledCells = rows.reduce((sum, row) => sum + row.filled, 0);
    const scoredCells = scoreRows.reduce((sum, row) => sum + row.filled, 0);
    const totalCells = rowDefinitions.length * rounds;
    const checkoutRow = rows.find((row) => row.metricType === "checkoutDarts") || null;
    const weightedRows = rows.filter((row) => row.weight > 0);
    const totalWeight = weightedRows.reduce((sum, row) => sum + row.weight, 0);
    const overallRating = totalWeight
      ? weightedRows.reduce((sum, row) => sum + (row.ratingPercent * row.weight), 0) / totalWeight
      : 0;
    const sortedByRating = rows.slice().sort((a, b) => b.ratingPercent - a.ratingPercent);
    return {
      rows,
      totalScore,
      filledCells,
      scoredCells,
      totalCells,
      overallAverage: scoredCells ? totalScore / scoredCells : 0,
      checkout170Average: checkoutRow?.average ?? null,
      checkout170Successes: checkoutRow?.successfulAttempts ?? 0,
      overallRating,
      overallRatingLabel: trainingRatingLabel(overallRating),
      strongestRowId: sortedByRating[0]?.id || null,
      strongestRowTitle: sortedByRating[0]?.title || null,
      weakestRowId: sortedByRating[sortedByRating.length - 1]?.id || null,
      weakestRowTitle: sortedByRating[sortedByRating.length - 1]?.title || null
    };
  }

  async function updateTrainingDraft(planId, mutator) {
    const trainingData = await getTrainingData();
    const plan = getTrainingPlan(planId);
    if (!plan) return trainingData;
    const draft = trainingData.drafts[plan.id] || createEmptyTrainingDraft(plan.id);
    const nextDraft = mutator ? (mutator(clone(draft)) || draft) : draft;
    nextDraft.planId = plan.id;
    nextDraft.updatedAt = Date.now();
    trainingData.selectedPlanId = plan.id;
    trainingData.drafts[plan.id] = normalizeTrainingData({ drafts: { [plan.id]: nextDraft } }).drafts[plan.id];
    return saveTrainingData(deepMerge(trainingData, {}));
  }

  async function clearTrainingDraft(planId) {
    const trainingData = await getTrainingData();
    const plan = getTrainingPlan(planId);
    if (!plan) return trainingData;
    trainingData.selectedPlanId = plan.id;
    trainingData.drafts[plan.id] = createEmptyTrainingDraft(plan.id);
    return saveTrainingData(trainingData);
  }

  async function saveTrainingAttempt(planId) {
    const trainingData = await getTrainingData();
    const plan = getTrainingPlan(planId);
    if (!plan) return { trainingData, saved: null };
    const draft = trainingData.drafts[plan.id] || createEmptyTrainingDraft(plan.id);
    const metrics = computeTrainingMetrics(plan, draft.values);
    const attempt = {
      id: `attempt-${Date.now()}`,
      planId: plan.id,
      createdAt: Date.now(),
      values: clone(draft.values),
      summary: {
        totalScore: metrics.totalScore,
        overallAverage: metrics.overallAverage,
        filledCells: metrics.filledCells,
        scoredCells: metrics.scoredCells,
        totalCells: metrics.totalCells,
        checkout170Average: metrics.checkout170Average,
        checkout170Successes: metrics.checkout170Successes,
        overallRating: metrics.overallRating,
        overallRatingLabel: metrics.overallRatingLabel,
        strongestRowTitle: metrics.strongestRowTitle,
        weakestRowTitle: metrics.weakestRowTitle
      },
      rows: metrics.rows.map((row) => ({
        id: row.id,
        score: row.score,
        average: row.average,
        filled: row.filled,
        values: row.values,
        metricType: row.metricType,
        successfulAttempts: row.successfulAttempts,
        ratingPercent: row.ratingPercent,
        ratingLabel: row.ratingLabel
      }))
    };
    if (!Array.isArray(trainingData.attempts[plan.id])) trainingData.attempts[plan.id] = [];
    trainingData.attempts[plan.id].unshift(attempt);
    trainingData.attempts[plan.id] = trainingData.attempts[plan.id].slice(0, 20);
    trainingData.drafts[plan.id] = createEmptyTrainingDraft(plan.id);
    trainingData.selectedPlanId = plan.id;
    const savedData = await saveTrainingData(trainingData);
    return { trainingData: savedData, saved: attempt };
  }

  function normalizeSegmentLabel(segmentLabel) {
    const raw = `${segmentLabel || ""}`.trim().toUpperCase();
    if (!raw) return null;
    if (["SB", "25"].includes(raw)) return "SB";
    if (["DB", "50", "BULL"].includes(raw)) return "DB";
    if (/^[SDT]\d{1,2}$/.test(raw)) return raw;
    if (/^MISS/.test(raw)) return "MISS";
    return raw;
  }

  function ensureProfileCounter(map, key, seed = {}) {
    if (!key) return null;
    if (!map[key]) map[key] = { ...seed };
    return map[key];
  }

  function preferenceFromCounts(map, key, field = "hits") {
    if (!map || !key) return 0;
    const values = Object.values(map).map((item) => safeNumber(item?.[field]) || 0);
    const maxValue = values.length ? Math.max(...values) : 0;
    if (!maxValue) return 0;
    return (safeNumber(map?.[key]?.[field]) || 0) / maxValue;
  }

  function advisorConfidence(profile) {
    const throws = safeNumber(profile?.sample?.throws) || 0;
    const checkouts = safeNumber(profile?.sample?.checkouts) || 0;
    const score = throws + (checkouts * 8);
    if (score >= 250) return "high";
    if (score >= 90) return "medium";
    return "low";
  }

  async function recordAdvisorVisit({ playerName = "", segments = [], checkout = false, startScore = null, outMode = "SI/DO" } = {}) {
    const profile = await getAdvisorProfile();
    if (playerName && !profile.playerName) profile.playerName = playerName;
    profile.sample.visits = (safeNumber(profile.sample.visits) || 0) + 1;

    const normalizedSegments = (segments || []).map(normalizeSegmentLabel).filter(Boolean);
    for (const segment of normalizedSegments) {
      const item = ensureProfileCounter(profile.segments, segment, { hits: 0 });
      item.hits += 1;
      profile.sample.throws = (safeNumber(profile.sample.throws) || 0) + 1;
    }

    if (checkout && normalizedSegments.length) {
      profile.sample.checkouts = (safeNumber(profile.sample.checkouts) || 0) + 1;
      const finalSegment = normalizedSegments[normalizedSegments.length - 1];
      const doubleKey = /^D\d+$/.test(finalSegment) || finalSegment === "DB" ? finalSegment : null;
      if (doubleKey) {
        const item = ensureProfileCounter(profile.doubles, doubleKey, { hits: 0, finishes: 0 });
        item.hits += 1;
        item.finishes += 1;
      }
      const routeKey = `${safeNumber(startScore) || 0}|${normalizeOutMode(outMode)}|${normalizedSegments.join("-")}`;
      const routeItem = ensureProfileCounter(profile.routes, routeKey, { wins: 0 });
      routeItem.wins += 1;
    }

    await saveAdvisorProfile(profile);
    return profile;
  }

  function getAdvisorProfileSummary(profile) {
    const doubles = Object.entries(profile?.doubles || {})
      .sort((a, b) => (safeNumber(b[1]?.finishes) || 0) - (safeNumber(a[1]?.finishes) || 0))
      .slice(0, 3)
      .map(([label, item]) => `${label} (${safeNumber(item?.finishes) || 0})`);
    const segments = Object.entries(profile?.segments || {})
      .filter(([label]) => /^T\d+$/.test(label) || /^S20$/.test(label) || /^S19$/.test(label))
      .sort((a, b) => (safeNumber(b[1]?.hits) || 0) - (safeNumber(a[1]?.hits) || 0))
      .slice(0, 3)
      .map(([label, item]) => `${label} (${safeNumber(item?.hits) || 0})`);
    return {
      confidence: advisorConfidence(profile),
      topDoubles: doubles,
      topSegments: segments,
      throws: safeNumber(profile?.sample?.throws) || 0,
      checkouts: safeNumber(profile?.sample?.checkouts) || 0
    };
  }

  async function upsertSession(sessionKey, updater) {
    const sessions = await getDailySessions();
    const settings = await getSettings();
    const existing = ensureSessionShape(sessions[sessionKey] || createEmptySession(sessionKey, settings.defaultTargets), settings.defaultTargets);
    const updated = ensureSessionShape(updater ? (updater(clone(existing)) || existing) : existing, settings.defaultTargets);
    updated.date = sessionKey;
    updated.targets = deepMerge(clone(settings.defaultTargets), updated.targets || {});
    updated.updatedAt = Date.now();
    sessions[sessionKey] = summarizeDay(updated);
    await saveDailySessions(sessions);
    return sessions[sessionKey];
  }

  async function getOrCreateSession(sessionKey) {
    return upsertSession(sessionKey, (session) => session);
  }

  async function setSessionTargets(sessionKey, targets, options = {}) {
    const createIfMissing = options.createIfMissing !== false;
    const sessions = await getDailySessions();
    if (!sessions[sessionKey] && !createIfMissing) return null;
    return upsertSession(sessionKey, (session) => {
      session.targets = deepMerge(clone(session.targets || DEFAULT_SETTINGS.defaultTargets), targets || {});
      session.matches = (session.matches || []).map((match, index) => ensureMatchShape({ ...match, targets: session.targets }, session.targets, index + 1));
      return session;
    });
  }

  async function listRecentSessions(limit = 20) {
    const sessions = await getDailySessions();
    return Object.values(sessions)
      .map((session) => summarizeDay(session))
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, limit);
  }

  async function appendDebugEntry(entry) {
    const settings = await getSettings();
    if (!settings.debugMode) return;
    const result = await storageGet([STORAGE_KEYS.DEBUG_LOG]);
    const log = result[STORAGE_KEYS.DEBUG_LOG] || [];
    const next = [entry, ...log].slice(0, 50);
    await storageSet({ [STORAGE_KEYS.DEBUG_LOG]: next });
  }

  async function getDebugLog() {
    const result = await storageGet([STORAGE_KEYS.DEBUG_LOG]);
    return result[STORAGE_KEYS.DEBUG_LOG] || [];
  }

  async function clearDebugLog() {
    await storageSet({ [STORAGE_KEYS.DEBUG_LOG]: [] });
  }

  function dateKeyFromTimestamp(ts = Date.now()) {
    const date = new Date(ts);
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
  }

  function deepMerge(base, extra) {
    if (!extra || typeof extra !== "object") return base;
    const out = Array.isArray(base) ? [...base] : { ...base };
    for (const [key, value] of Object.entries(extra)) {
      if (value && typeof value === "object" && !Array.isArray(value) && base[key] && typeof base[key] === "object" && !Array.isArray(base[key])) {
        out[key] = deepMerge(base[key], value);
      } else {
        out[key] = value;
      }
    }
    return out;
  }

  function safeNumber(value) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string") {
      const normalized = value.replace(",", ".").trim();
      const num = Number(normalized);
      if (Number.isFinite(num)) return num;
    }
    return null;
  }

  function clamp(num, min, max) {
    return Math.min(max, Math.max(min, num));
  }

  function fmtNumber(value, digits = 1, empty = "—") {
    if (typeof value !== "number" || !Number.isFinite(value)) return empty;
    return value.toFixed(digits);
  }

  function fmtMaybeInt(value, empty = "—") {
    if (typeof value !== "number" || !Number.isFinite(value)) return empty;
    return `${Math.round(value)}`;
  }

  function titleCase(str) {
    return `${str || ""}`.replace(/\b\w/g, (c) => c.toUpperCase());
  }

  function meanOf(values) {
    const filtered = (values || []).map((value) => safeNumber(value)).filter((value) => value !== null);
    if (!filtered.length) return null;
    return filtered.reduce((sum, value) => sum + value, 0) / filtered.length;
  }

  function calcGoalStatus(stats, targets) {
    const statuses = {
      averageOver: "gray",
      first9Over: "gray",
      checkoutDartsUnder: "gray",
      maxBusts: "gray"
    };

    if (typeof stats?.average === "number") {
      const delta = stats.average - targets.averageOver;
      statuses.averageOver = delta >= 0 ? "green" : delta >= -2 ? "yellow" : "red";
    }

    if (typeof stats?.first9 === "number") {
      const delta = stats.first9 - targets.first9Over;
      statuses.first9Over = delta >= 0 ? "green" : delta >= -2 ? "yellow" : "red";
    }

    if (typeof stats?.checkoutDartsPerChance === "number") {
      const delta = targets.checkoutDartsUnder - stats.checkoutDartsPerChance;
      statuses.checkoutDartsUnder = delta >= 0 ? "green" : delta >= -0.5 ? "yellow" : "red";
    }

    if (typeof stats?.busts === "number") {
      const remaining = targets.maxBusts - stats.busts;
      statuses.maxBusts = remaining >= 1 ? "green" : remaining === 0 ? "yellow" : "red";
    }

    return statuses;
  }

  function computeGoalSummary(goalStatus) {
    const entries = Object.values(goalStatus || {});
    const complete = entries.filter((v) => v === "green").length;
    return `${complete}/4`;
  }

  function recalcSessionStats(session) {
    return summarizeDay(session);
  }

  function normalizeOutMode(value) {
    if (!value) return "SI/DO";
    const text = `${value}`.toLowerCase();
    if (text.includes("single") && text.includes("out")) return "SI/SO";
    if (text.includes("straight") && text.includes("out")) return "SI/SO";
    if (text.includes("double") && text.includes("out")) return "SI/DO";
    if (text.includes("do")) return "SI/DO";
    if (text.includes("so")) return "SI/SO";
    return "SI/DO";
  }

  function buildCheckoutRoutes(score, outMode = "SI/DO", maxDarts = 3) {
    const normalizedOutMode = normalizeOutMode(outMode);
    const normalizedMaxDarts = Math.max(1, Math.min(3, safeNumber(maxDarts) || 3));
    const cacheKey = `${score}|${normalizedOutMode}|${normalizedMaxDarts}`;
    if (CHECKOUT_CACHE.has(cacheKey)) return CHECKOUT_CACHE.get(cacheKey);

    const results = [];
    const requiredDoubleFinish = normalizedOutMode === "SI/DO";

    function canFinishWith(dart) {
      if (!requiredDoubleFinish) return true;
      return dart.ring === "D";
    }

    function walk(remaining, dartsLeft, current) {
      if (remaining < 0) return;
      if (dartsLeft === 0) {
        if (remaining === 0 && current.length > 0 && canFinishWith(current[current.length - 1])) {
          results.push(current.slice());
        }
        return;
      }

      for (const dart of DARTS) {
        if (dart.value > remaining) continue;
        if (dartsLeft === 1) {
          if (dart.value !== remaining) continue;
          if (!canFinishWith(dart)) continue;
        }
        current.push(dart);
        walk(remaining - dart.value, dartsLeft - 1, current);
        current.pop();
      }
    }

    for (let length = 1; length <= normalizedMaxDarts; length += 1) {
      walk(score, length, []);
    }

    const deduped = [];
    const seen = new Set();
    for (const route of results) {
      const key = route.map((x) => x.label).join(" ");
      if (seen.has(key)) continue;
      seen.add(key);
      deduped.push(route);
    }

    CHECKOUT_CACHE.set(cacheKey, deduped);
    return deduped;
  }

  function preferenceScore(label, orderedLabels, start = 42, step = 1.5, fallback = 0) {
    const index = orderedLabels.indexOf(label);
    return index >= 0 ? Math.max(fallback, start - (index * step)) : fallback;
  }

  function sumRouteValue(route) {
    return (route || []).reduce((total, dart) => total + (dart?.value || 0), 0);
  }

  function finishPreferenceScore(lastDart, outMode, routeLength) {
    if (!lastDart) return 0;
    const normalizedOutMode = normalizeOutMode(outMode);

    if (normalizedOutMode === "SI/DO") {
      if (lastDart.label === "DB") return routeLength === 1 ? 34 : 6;
      return preferenceScore(lastDart.label, STANDARD_DOUBLE_PRIORITY, 42, 1.35, lastDart.ring === "D" ? 8 : -20);
    }

    if (lastDart.label === "DB") return routeLength === 1 ? 30 : 8;
    if (lastDart.ring === "S") return 26 - Math.min(18, Math.max(0, lastDart.value - 1) * 0.6);
    if (lastDart.ring === "D") return preferenceScore(lastDart.label, STANDARD_DOUBLE_PRIORITY, 28, 0.9, 10);
    if (lastDart.ring === "T") return preferenceScore(lastDart.label, STANDARD_TRIPLE_PRIORITY, 18, 0.6, 6);
    return 0;
  }

  function scoreRoute(route, totalScore, outMode = "SI/DO", profile = {}) {
    const normalizedOutMode = normalizeOutMode(outMode);
    let score = 0;
    score += Math.max(0, 140 - (route.length * 24));

    const doubles = profile?.doubles || {};
    const triples = profile?.triples || {};
    const segments = profile?.segments || {};
    const routes = profile?.routes || {};
    const first = route[0] || null;
    const second = route[1] || null;
    const last = route[route.length - 1] || null;
    const remainingAfterFirst = first ? totalScore - first.value : null;

    if (first?.tripleKey) {
      score += preferenceScore(first.tripleKey, STANDARD_TRIPLE_PRIORITY, 26, 0.9, 6);
      score += preferenceFromCounts(segments, first.tripleKey, "hits") * 14;
    } else if (route.length === 2 && first?.ring === "S" && last?.ring === "D") {
      score += 20;
      score += preferenceFromCounts(segments, first.label, "hits") * 10;
    } else if (route.length === 1) {
      score += 16;
    } else if (first) {
      score -= 8;
      score += preferenceFromCounts(segments, first.label, "hits") * 8;
    }

    if (second?.tripleKey) {
      score += preferenceScore(second.tripleKey, STANDARD_TRIPLE_PRIORITY, 16, 0.6, 4);
      score += preferenceFromCounts(segments, second.tripleKey, "hits") * 8;
      if (route.length === 3 && typeof remainingAfterFirst === "number" && remainingAfterFirst <= 70) {
        score -= 26;
      }
    } else if (second) {
      score += preferenceFromCounts(segments, second.label, "hits") * 5;
    }

    if (route.length === 3 && first?.tripleKey && second?.ring === "S" && last?.ring === "D") {
      score += 16;
    }

    const setupDarts = route.slice(0, -1);
    for (const dart of setupDarts) {
      if (dart.label === "DB") score -= 36;
      else if (dart.label === "SB") score -= 22;
      else if (dart.ring === "D") score -= 10;
      else if (dart.ring === "S") score -= 8;
    }

    score += finishPreferenceScore(last, normalizedOutMode, route.length);
    if (last?.doubleKey) score += preferenceFromCounts(doubles, last.doubleKey, "finishes") * 16;

    if (last?.label === "DB" && route.length > 1) score -= 18;

    const leaveBeforeLast = totalScore - sumRouteValue(route.slice(0, -1));
    if (last?.ring === "D" && typeof leaveBeforeLast === "number" && last.value === leaveBeforeLast) {
      score += preferenceScore(last.label, STANDARD_DOUBLE_PRIORITY, 14, 0.6, 2);
    }

    for (const dart of route) {
      if (dart.doubleKey && doubles[dart.doubleKey]) {
        const item = doubles[dart.doubleKey];
        const preference = (safeNumber(item?.attempts) || 0) > 0
          ? ((safeNumber(item?.hits) || 0) / Math.max(1, safeNumber(item?.attempts) || 1))
          : preferenceFromCounts(doubles, dart.doubleKey, "finishes");
        score += preference * 6;
      }
      if (dart.tripleKey && triples[dart.tripleKey]) {
        const item = triples[dart.tripleKey];
        const preference = (safeNumber(item?.attempts) || 0) > 0
          ? ((safeNumber(item?.hits) || 0) / Math.max(1, safeNumber(item?.attempts) || 1))
          : preferenceFromCounts(segments, dart.tripleKey, "hits");
        score += preference * 4;
      }
    }

    const exactRouteKey = `${safeNumber(totalScore) || 0}|${normalizedOutMode}|${route.map((dart) => dart.label).join("-")}`;
    const exactRouteWins = safeNumber(routes?.[exactRouteKey]?.wins) || 0;
    if (exactRouteWins > 0) score += Math.min(18, exactRouteWins * 3.2);

    return score;
  }

  function buildAdvisorReasons(route, totalScore, profile = {}, outMode = "SI/DO") {
    const reasons = [];
    const first = route?.[0] || null;
    const last = route?.[route.length - 1] || null;
    const doubles = profile?.doubles || {};
    const segments = profile?.segments || {};
    const routes = profile?.routes || {};
    const normalizedOutMode = normalizeOutMode(outMode);

    if (last?.doubleKey && preferenceFromCounts(doubles, last.doubleKey, "finishes") >= 0.45) {
      reasons.push(`${last.doubleKey} is one of your better finishing doubles`);
    }
    if (first?.label && preferenceFromCounts(segments, first.label, "hits") >= 0.45) {
      reasons.push(`${first.label} shows up often in your own throws`);
    }
    if (first?.tripleKey && preferenceFromCounts(segments, first.tripleKey, "hits") >= 0.45) {
      reasons.push(`${first.tripleKey} fits your preferred scoring lane`);
    }

    const exactRouteKey = `${safeNumber(totalScore) || 0}|${normalizedOutMode}|${(route || []).map((dart) => dart.label).join("-")}`;
    if ((safeNumber(routes?.[exactRouteKey]?.wins) || 0) > 0) {
      reasons.push(`You have already finished with this route before`);
    }

    if (!reasons.length) reasons.push("Fallbacks to the standard checkout table for this score");
    return reasons.slice(0, 3);
  }

  function recommendCheckout(score, outMode = "SI/DO", profile = {}, maxDarts = 3) {
    const detailed = recommendCheckoutDetailed(score, outMode, profile, maxDarts);
    return {
      primary: detailed.primary,
      alternative: detailed.alternative
    };
  }

  function recommendCheckoutDetailed(score, outMode = "SI/DO", profile = {}, maxDarts = 3) {
    const normalizedScore = safeNumber(score);
    const normalizedOutMode = normalizeOutMode(outMode);
    const normalizedMaxDarts = Math.max(1, Math.min(3, safeNumber(maxDarts) || 3));
    const maxCheckout = normalizedOutMode === "SI/SO" ? 180 : 170;

    if (!normalizedScore || normalizedScore < 2 || normalizedScore > maxCheckout) {
      return { primary: null, alternative: null, reasoning: ["No checkout possible"], confidence: advisorConfidence(profile) };
    }

    if (normalizedOutMode === "SI/DO" && CHECKOUT_BOGEY_DO.has(normalizedScore)) {
      return { primary: null, alternative: null, reasoning: ["No checkout possible"], confidence: advisorConfidence(profile) };
    }

    const routes = buildCheckoutRoutes(normalizedScore, normalizedOutMode, normalizedMaxDarts);
    if (!routes.length) return { primary: null, alternative: null, reasoning: ["No checkout possible"], confidence: advisorConfidence(profile) };

    const ranked = routes
      .map((route) => ({ route, routeScore: scoreRoute(route, normalizedScore, normalizedOutMode, profile) }))
      .sort((a, b) => b.routeScore - a.routeScore);

    const primary = ranked[0]?.route || null;
    const alternative = ranked.find((item, index) => {
      if (index === 0) return false;
      return item.route.map((x) => x.label).join(" ") !== primary?.map((x) => x.label).join(" ");
    })?.route || null;

    return {
      primary: primary ? primary.map((x) => x.label).join(" ") : null,
      alternative: alternative ? alternative.map((x) => x.label).join(" ") : null,
      reasoning: primary ? buildAdvisorReasons(primary, normalizedScore, profile, normalizedOutMode) : ["No checkout possible"],
      confidence: advisorConfidence(profile)
    };
  }

  function routeForDisplay(route) {
    return route ? route.replace(/\bS(\d+)\b/g, "$1") : "—";
  }

  function summarizeSession(session) {
    const safeSession = summarizeDay(session || createEmptySession(dateKeyFromTimestamp(), DEFAULT_SETTINGS.defaultTargets));
    return {
      date: safeSession.date || "—",
      goalSummary: safeSession.summary.legs ? `${safeSession.summary.perfectLegs}/${safeSession.summary.legs} perfect legs` : "0 legs",
      avg: fmtNumber(safeSession.summary.averageMean),
      first9: fmtNumber(safeSession.summary.first9Mean),
      checkout: fmtNumber(safeSession.summary.checkoutMean),
      busts: fmtNumber(safeSession.summary.bustsMean),
      matches: safeSession.summary.matches,
      legs: safeSession.summary.legs,
      goalRatePercent: safeSession.summary.goalRatePercent
    };
  }

  window.SessionCoachShared = {
    STORAGE_KEYS,
    DEFAULT_SETTINGS,
    TARGET_PRESETS,
    DEFAULT_RUNTIME,
    DEFAULT_ADVISOR_PROFILE,
    TRAINING_PLANS,
    DEFAULT_TRAINING_DATA,
    DOUBLEABLE_VALUES,
    DARTS,
    clone,
    storageGet,
    storageGetAll,
    storageSet,
    getSettings,
    saveSettings,
    getDailySessions,
    saveDailySessions,
    getOrCreateSession,
    setSessionTargets,
    upsertSession,
    listRecentSessions,
    appendDebugEntry,
    getDebugLog,
    clearDebugLog,
    dateKeyFromTimestamp,
    createEmptySession,
    createEmptyMatch,
    ensureSessionShape,
    ensureMatchShape,
    ensureLegShape,
    summarizeMatch,
    summarizeDay,
    deepMerge,
    safeNumber,
    clamp,
    fmtNumber,
    fmtMaybeInt,
    titleCase,
    meanOf,
    calcGoalStatus,
    computeGoalSummary,
    recalcSessionStats,
    normalizeOutMode,
    buildCheckoutRoutes,
    recommendCheckout,
    routeForDisplay,
    summarizeSession,
    getRuntime,
    saveRuntime,
    getAdvisorProfile,
    saveAdvisorProfile,
    getTrainingPlan,
    getTrainingData,
    saveTrainingData,
    createEmptyTrainingDraft,
    computeTrainingMetrics,
    updateTrainingDraft,
    clearTrainingDraft,
    saveTrainingAttempt,
    recordAdvisorVisit,
    getAdvisorProfileSummary,
    recommendCheckoutDetailed,
    normalizeSegmentLabel,
    trainingRatingLabel,
    exportDateStamp,
    exportExtensionData,
    importExtensionData
  };
})();
