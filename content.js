(() => {
  const S = window.SessionCoachShared;
  const STATE = {
    settings: null,
    runtime: null,
    overlayEl: null,
    panelEl: null,
    panelBackdropEl: null,
    floatingButtonEl: null,
    hiddenTabEl: null,
    injectedMenuEntryEl: null,
    menuObserver: null,
    overlayRefreshTimer: null,
    routeInjectionTimer: null,
    adapter: null,
    dragState: null,
    forceOverlayOpen: false
  };



  class AutodartsAdapter {
    constructor() {
      this.playerName = "";
      this.currentOutMode = "SI/DO";
      this.currentLeg = null;
      this.activeVisit = null;
      this.knownPlayerScore = null;
      this.knownPlayerId = null;
      this.knownBoardId = null;
      this.currentUserId = null;
      this.currentUserName = "";
      this.currentBoardId = null;
      this.currentMatchId = null;
      this.ownPlayerIndex = null;
      this.activePlayerIndex = null;
      this.lastProcessedEventSignature = null;
      this.lastSeenState = null;
      this.currentVisitDartsLeft = 3;
      this.isTrackedTurnActive = false;
    }

    setSettings(settings) {
      this.playerName = settings.trackedPlayerName || "";
    }

    getResolvedDisplayName() {
      return this.currentUserName || this.playerName || "";
    }

    hasIdentityHints() {
      return Boolean(
        this.playerName ||
        this.currentUserName ||
        this.currentUserId ||
        this.currentBoardId ||
        this.knownPlayerId ||
        this.knownBoardId
      );
    }

    getEffectiveScore() {
      if (this.activeVisit && this.isTrackedTurnActive && typeof this.activeVisit.provisionalScore === "number") {
        return this.activeVisit.provisionalScore;
      }
      return typeof this.knownPlayerScore === "number" ? this.knownPlayerScore : null;
    }

    getLivePreview() {
      const visit = this.activeVisit;
      const leg = this.currentLeg;
      if (!leg) return null;

      const preview = {
        average: null,
        first9: null,
        checkoutDartsPerChance: leg.checkoutStarted ? leg.checkoutDarts : null,
        busts: leg.busts ?? 0
      };

      const previewDarts = (this.isTrackedTurnActive && visit ? visit.dartsUsed : 0);
      const previewScored = (this.isTrackedTurnActive && visit ? visit.pointSum : 0);
      const totalDarts = (leg.ownDarts || 0) + previewDarts;
      const totalScored = (leg.ownScored || 0) + previewScored;
      if (totalDarts > 0) {
        preview.average = (totalScored / totalDarts) * 3;
      }

      const remainingFirst9Slots = Math.max(0, 9 - (leg.first9Darts || 0));
      const previewFirst9Applied = Math.min(remainingFirst9Slots, previewDarts);
      const previewFirst9Scored = previewFirst9Applied > 0 && previewDarts > 0
        ? previewScored * (previewFirst9Applied / previewDarts)
        : 0;
      const totalFirst9Darts = (leg.first9Darts || 0) + previewFirst9Applied;
      const totalFirst9Scored = (leg.first9Scored || 0) + previewFirst9Scored;
      if (totalFirst9Darts > 0) {
        preview.first9 = (totalFirst9Scored / totalFirst9Darts) * 3;
      }

      if (leg.checkoutStarted) {
        preview.checkoutDartsPerChance = (leg.checkoutDarts || 0) + previewDarts;
      }

      return preview;
    }

    resetRuntimeFields(runtimeOverrides = {}) {
      return {
        currentScore: null,
        currentSuggestedRoute: null,
        currentAltRoute: null,
        currentCheckoutMaxDarts: 3,
        currentOutMode: this.currentOutMode || "SI/DO",
        trackedPlayerResolved: this.getResolvedDisplayName(),
        lastKnownPlayerScore: null,
        isInMatch: false,
        activeMatchId: null,
        ...runtimeOverrides
      };
    }

    async clearActiveMatch(reason = "idle") {
      if (this.currentMatchId) {
        await this.markMatchEnded(reason);
      }
      this.currentLeg = null;
      this.activeVisit = null;
      this.knownPlayerScore = null;
      this.knownPlayerId = null;
      this.ownPlayerIndex = null;
      this.activePlayerIndex = null;
      this.lastSeenState = null;
      this.currentVisitDartsLeft = 3;
      this.isTrackedTurnActive = false;
      this.currentMatchId = null;
      const runtime = await S.getRuntime();
    STATE.runtime = runtime;
      await S.saveRuntime({
        ...runtime,
        ...this.resetRuntimeFields({
          adapterStatus: reason === "waiting" ? "waiting" : "idle",
          lastAdapterUpdate: Date.now()
        })
      });
    }

    async markMatchEnded(reason = "ended") {
      const matchId = this.currentMatchId;
      if (!matchId) return;
      const todayKey = S.dateKeyFromTimestamp();
      await S.upsertSession(todayKey, (session) => {
        const match = (session.matches || []).find((item) => item.matchId === matchId);
        if (match) {
          match.endedAt = match.endedAt || Date.now();
          match.updatedAt = Date.now();
          match.endReason = reason;
        }
        return session;
      });
    }

    captureIdentityHints(value) {
      if (!value || typeof value !== "object") return;
      const root = value.data && typeof value.data === "object" ? value.data : value;
      const channel = `${value.channel || root.channel || ""}`.toLowerCase();
      const topic = `${value.topic || root.topic || ""}`;

      if (channel.includes("autodarts.boards")) {
        const boardId = topic.match(/^([^.]+)\./)?.[1] || null;
        if (boardId) {
          this.currentBoardId = this.currentBoardId || boardId;
          this.knownBoardId = this.knownBoardId || boardId;
        }
      }

      if (channel.includes("autodarts.users")) {
        const topicUserId = topic.match(/^([^.]+)\./)?.[1] || null;
        const userId = root.userId || root.host?.id || topicUserId || null;
        if (userId) this.currentUserId = this.currentUserId || userId;
      }

      if (channel.includes("autodarts.friends")) {
        const topicUserId = topic.match(/^([^.]+)\./)?.[1] || null;
        const userId = root.userId || topicUserId || null;
        if (!this.currentUserId && userId && root.activity?.activity === "playing-match") {
          this.currentUserId = userId;
        }
      }

      const hostName = `${root.host?.name || ""}`.trim();
      const hostId = root.host?.id || root.hostId || null;
      if (!this.currentUserName && hostName) {
        if ((this.currentUserId && hostId && hostId === this.currentUserId) || (this.playerName && this.playerMatches(hostName))) {
          this.currentUserName = hostName;
        }
      }
    }

    async processEnvelope(type, payload) {
      const maybeObj = payload?.data ?? payload;
      if (!maybeObj || typeof maybeObj !== "object") return;

      this.captureIdentityHints(maybeObj);

      const lifecycle = this.extractMatchLifecycle(maybeObj);
      if (lifecycle?.ended) {
        await this.clearActiveMatch("idle");
        return;
      }

      const matchRef = this.extractMatchReference(maybeObj);
      if (matchRef?.matchId) this.currentMatchId = matchRef.matchId;

      const snapshot = this.extractSnapshotCandidate(maybeObj);
      const boardState = this.extractBoardState(maybeObj);
      const throwEvent = this.extractThrowEvent(maybeObj);
      const visit = this.extractVisitCandidate(maybeObj);

      if (snapshot) await this.applySnapshot(snapshot);
      if (visit) await this.applyVisit(visit);
      if (boardState) await this.applyBoardState(boardState);
      if (throwEvent) await this.applyThrowEvent(throwEvent);

      const runtimeBefore = await S.getRuntime();
      const isInMatch = Boolean(this.currentMatchId || matchRef?.started || snapshot || runtimeBefore.isInMatch);
      await S.saveRuntime({
        ...runtimeBefore,
        adapterStatus: isInMatch ? "live" : "waiting",
        currentDailyKey: isInMatch ? S.dateKeyFromTimestamp() : runtimeBefore.currentDailyKey,
        currentOutMode: this.currentOutMode,
        trackedPlayerResolved: this.getResolvedDisplayName() || "",
        lastKnownPlayerScore: typeof this.knownPlayerScore === "number" ? this.knownPlayerScore : null,
        isInMatch,
        activeMatchId: this.currentMatchId,
        lastAdapterUpdate: Date.now()
      });
    }

    extractMatchReference(value) {
      if (!value || typeof value !== "object") return null;
      const root = value.data && typeof value.data === "object" ? value.data : value;
      const channel = `${value.channel || root.channel || ""}`.toLowerCase();
      const topic = `${value.topic || root.topic || ""}`.toLowerCase();
      const eventName = `${root.event || value.event || ""}`.toLowerCase();
      const body = root.body;

      let matchId = root.id || root.matchId || root.matchID || body?.matchId || body?.matchID || null;
      let started = false;

      if (channel.includes("autodarts.boards") && topic.includes(".matches") && ["start", "started", "create"].includes(eventName)) {
        started = true;
      }

      if (channel.includes("autodarts.friends") && root.activity?.activity === "playing-match") {
        matchId = root.activity?.body?.matchID || matchId;
        started = Boolean(matchId);
      }

      if (channel.includes("autodarts.users") && eventName === "active-match") {
        matchId = typeof body === "string" ? body : (body?.id || body?.matchId || body?.matchID || matchId);
        started = Boolean(matchId);
      }

      if (channel.includes("autodarts.matches") && matchId) started = true;
      return matchId || started ? { matchId, started } : null;
    }

    extractMatchLifecycle(value) {
      if (!value || typeof value !== "object") return null;
      const root = value.data && typeof value.data === "object" ? value.data : value;
      const channel = `${value.channel || root.channel || ""}`.toLowerCase();
      const topic = `${value.topic || root.topic || ""}`.toLowerCase();
      const eventName = `${root.event || value.event || root.data?.event || root.body?.event || ""}`.toLowerCase();
      const body = root.body;
      const status = `${root.status || (body && body.status) || ""}`.toLowerCase();
      const type = `${root.type || value.type || ""}`.toLowerCase();
      const errorText = `${root.error || value.error || ""}`.toLowerCase();
      const matchId = root.id || root.matchId || root.matchID || (body && (body.matchId || body.matchID)) || null;
      const finished = Boolean(
        root.finished ||
        root.gameFinished ||
        (body && body.finished) ||
        (body && body.gameFinished) ||
        ["aborted", "cancelled", "canceled", "finished", "ended", "done"].includes(status) ||
        ["match_cancelled", "match_canceled", "match_aborted", "match_finished", "game_finished", "game_over", "match_deleted", "delete"].includes(eventName) ||
        (channel.includes("autodarts.boards") && topic.includes(".matches") && eventName === "delete") ||
        (channel.includes("autodarts.users") && eventName === "active-match" && (body === null || body === undefined)) ||
        (channel.includes("autodarts.matches") && type === "error" && errorText.includes("match not found"))
      );
      if (!channel.includes("autodarts.matches") && !channel.includes("autodarts.boards") && !channel.includes("autodarts.users") && !channel.includes("autodarts.friends") && !matchId && !finished) {
        return null;
      }
      return { ended: finished, matchId };
    }

    normalizePlayerName(value) {
      return `${value || ""}`.trim().toLowerCase();
    }

    playerMatches(name) {
      const normalizedName = this.normalizePlayerName(name);
      if (!normalizedName) return false;
      const trackedNames = [this.playerName, this.currentUserName]
        .map((value) => this.normalizePlayerName(value))
        .filter(Boolean);
      return trackedNames.includes(normalizedName);
    }

    extractPlayerAliases(value) {
      if (!value || typeof value !== "object") return [];
      const aliases = [
        value.boardName,
        value.host?.name,
        value.name,
        value.username,
        value.playerName,
        value.displayName,
        value.nickname,
        value.user,
        value.player
      ];
      return [...new Set(aliases.map((item) => `${item || ""}`.trim()).filter(Boolean))];
    }

    chooseOwnPlayerIndex(players) {
      if (!Array.isArray(players) || !players.length) return null;

      const boardHints = [this.currentBoardId, this.knownBoardId].filter(Boolean);
      const userHints = [this.currentUserId, this.knownPlayerId].filter(Boolean);
      const trackedNames = [this.playerName, this.currentUserName]
        .map((value) => this.normalizePlayerName(value))
        .filter(Boolean);

      let bestIndex = null;
      let bestScore = -1;
      let bestIsUnique = true;

      players.forEach((player, index) => {
        if (!player) return;
        let score = 0;

        const ids = [player.userId, player.hostId, player.playerId].filter(Boolean);
        if (userHints.length && ids.some((id) => userHints.includes(id))) score += 100;
        if (this.currentUserId && player.hostId && player.hostId === this.currentUserId) score += 80;
        if (this.currentUserId && player.userId && player.userId === this.currentUserId) score += 90;
        if (this.knownPlayerId && player.playerId && player.playerId === this.knownPlayerId) score += 70;

        if (trackedNames.length) {
          const aliases = (player.aliases || []).map((value) => this.normalizePlayerName(value));
          if (aliases.some((alias) => trackedNames.includes(alias))) score += 40;
        }

        if (boardHints.length && player.boardId && boardHints.includes(player.boardId)) score += 20;

        if (score > bestScore) {
          bestIndex = index;
          bestScore = score;
          bestIsUnique = true;
        } else if (score === bestScore) {
          bestIsUnique = false;
        }
      });

      if (bestScore > 0 && bestIsUnique) return bestIndex;
      if (bestScore >= 90) return bestIndex;
      if (players.length === 1) return 0;
      return null;
    }

    parseAutodartsMatchState(value) {
      if (!value || typeof value !== "object") return null;
      const payload = value.data && typeof value.data === "object" ? value.data : value;
      if (!Array.isArray(payload.players)) return null;

      const players = payload.players.map((player, index) => {
        const aliases = this.extractPlayerAliases(player);
        const explicitScore = S.safeNumber(payload.gameScores?.[index]);
        const rows = Array.isArray(payload.chalkboards?.[index]?.rows) ? payload.chalkboards[index].rows : [];
        const scoredRows = rows.filter((row) => S.safeNumber(row?.score) !== null);
        const lastRow = scoredRows[scoredRows.length - 1] || null;
        const lastRowScore = S.safeNumber(lastRow?.score);
        let score = explicitScore;
        if (score === null) score = lastRowScore;

        let dartsLeftInVisit = 3;
        const round = S.safeNumber(lastRow?.round) ?? 0;
        const roundMod = ((round % 3) + 3) % 3;
        dartsLeftInVisit = roundMod === 0 ? 3 : Math.max(1, 3 - roundMod);
        if (explicitScore !== null && lastRowScore !== null && explicitScore !== lastRowScore) {
          dartsLeftInVisit = Math.max(0, 2);
        }

        return {
          index,
          aliases,
          playerName: aliases[0] || "",
          playerId: player?.id || player?.playerId || player?.hostId || player?.host?.id || null,
          hostId: player?.hostId || player?.host?.id || null,
          userId: player?.userId || null,
          boardId: player?.boardId || null,
          score,
          lastRowScore,
          dartsLeftInVisit,
          active: payload.player === index || Boolean(player?.turn || player?.isCurrentPlayer || player?.active)
        };
      });

      const ownIndex = this.chooseOwnPlayerIndex(players);
      if (ownIndex === null || ownIndex < 0) return null;
      const own = players[ownIndex];
      const activePlayerIndex = S.safeNumber(payload.player);
      const active = activePlayerIndex === ownIndex || Boolean(own.active);

      this.ownPlayerIndex = ownIndex;
      this.activePlayerIndex = activePlayerIndex;
      this.knownBoardId = this.knownBoardId || own.boardId || this.currentBoardId || null;
      this.knownPlayerId = this.knownPlayerId || own.userId || own.hostId || own.playerId || null;
      this.currentUserName = this.currentUserName || own.playerName || "";

      return {
        kind: "match",
        matchId: payload.id || payload.matchId || this.currentMatchId || null,
        finished: Boolean(payload.finished || payload.gameFinished),
        playerName: own.playerName,
        aliases: own.aliases,
        playerId: own.playerId,
        hostId: own.hostId,
        userId: own.userId,
        boardId: own.boardId,
        score: own.score,
        active,
        dartsLeftInVisit: active ? own.dartsLeftInVisit : 3,
        ownIndex,
        activePlayerIndex,
        allPlayers: players
      };
    }

    parseAutodartsLobbyState(value) {
      if (!value || typeof value !== "object") return null;
      const payload = value.data && typeof value.data === "object" ? value.data : value;
      if (!Array.isArray(payload.players) || !payload.id) return null;
      const players = payload.players.map((player, index) => ({
        index,
        aliases: this.extractPlayerAliases(player),
        playerName: this.extractPlayerAliases(player)[0] || "",
        playerId: player?.id || player?.playerId || player?.hostId || player?.host?.id || null,
        hostId: player?.hostId || player?.host?.id || null,
        userId: player?.userId || null,
        boardId: player?.boardId || null
      }));
      const ownIndex = this.chooseOwnPlayerIndex(players);
      if (ownIndex === null || ownIndex < 0) return null;
      const own = players[ownIndex];
      this.ownPlayerIndex = ownIndex;
      this.knownBoardId = this.knownBoardId || own.boardId || this.currentBoardId || null;
      this.knownPlayerId = this.knownPlayerId || own.userId || own.hostId || own.playerId || null;
      this.currentUserName = this.currentUserName || own.playerName || "";
      return {
        kind: "lobby",
        matchId: payload.id,
        finished: false,
        playerName: own.playerName,
        aliases: own.aliases,
        playerId: own.playerId,
        hostId: own.hostId,
        userId: own.userId,
        boardId: own.boardId,
        score: null,
        active: false,
        dartsLeftInVisit: 3,
        ownIndex,
        activePlayerIndex: null,
        allPlayers: players
      };
    }

    extractSnapshotCandidate(obj) {
      let best = this.parseAutodartsMatchState(obj) || this.parseAutodartsLobbyState(obj) || null;
      const walk = (value) => {
        if (!value || typeof value !== "object") return;
        const direct = this.parseAutodartsMatchState(value) || this.parseAutodartsLobbyState(value);
        if (direct) best = direct;
        if (Array.isArray(value)) {
          value.forEach(walk);
          return;
        }
        const modeGuess = this.extractMode(value);
        if (modeGuess) this.currentOutMode = modeGuess;
        Object.values(value).forEach(walk);
      };
      walk(obj);
      return best;
    }

    extractMode(value) {
      if (!value || typeof value !== "object") return null;
      const modeCandidate =
        value.outMode ||
        value.finishMode ||
        value.gameMode ||
        value.mode ||
        value.settings?.out ||
        value.settings?.outMode ||
        value.rules?.out ||
        value.rules?.outMode;
      return modeCandidate ? S.normalizeOutMode(modeCandidate) : null;
    }

    extractVisitCandidate(obj) {
      if (!obj || typeof obj !== "object") return null;
      const root = obj.data && typeof obj.data === "object" ? obj.data : obj;
      const channel = `${obj.channel || root.channel || ""}`.toLowerCase();
      if (!channel.includes("autodarts.matches")) return null;
      const eventName = `${root.event || ""}`.toLowerCase();
      const body = root.body && typeof root.body === "object" ? root.body : null;
      const playerName = `${body?.player || root.player || ""}`.trim();
      const score = S.safeNumber(body?.score ?? body?.remaining ?? body?.rest ?? root.score);
      if (!["turn_start", "round_start"].includes(eventName) && !body?.isCheckout) return null;
      return {
        eventName,
        playerName,
        remainingAfter: score,
        matchId: root.matchId || body?.matchId || null,
        checkout: Boolean(body?.isCheckout)
      };
    }

    extractBoardState(obj) {
      if (!obj || typeof obj !== "object") return null;
      const root = obj.data && typeof obj.data === "object" ? obj.data : obj;
      const channel = `${obj.channel || root.channel || ""}`.toLowerCase();
      if (!channel.includes("autodarts.boards")) return null;
      const topic = `${obj.topic || root.topic || ""}`;
      const numThrows = S.safeNumber(root.numThrows);
      const status = `${root.status || ""}`.toLowerCase();
      const eventName = `${root.event || ""}`.toLowerCase();
      if (numThrows === null && !status && !eventName) return null;
      return { topic, numThrows, status, eventName, connected: Boolean(root.connected) };
    }

    extractThrowEvent(obj) {
      if (!obj || typeof obj !== "object") return null;
      const root = obj.data && typeof obj.data === "object" ? obj.data : obj;
      const eventName = `${root.event || ""}`.toLowerCase();
      const channel = `${obj.channel || root.channel || ""}`.toLowerCase();
      if (eventName !== "throw" || !channel.includes("autodarts.matches")) return null;
      const body = root.body && typeof root.body === "object" ? root.body : null;
      const segment = body?.segment || root.segment || null;
      if (!segment || typeof segment !== "object") return null;
      const points = S.safeNumber(segment.multiplier) !== null && S.safeNumber(segment.number) !== null
        ? S.safeNumber(segment.multiplier) * S.safeNumber(segment.number)
        : (segment.name === "SB" ? 25 : segment.name === "DB" ? 50 : null);
      if (points === null) return null;
      return {
        matchId: root.matchId || body?.matchId || null,
        points,
        segmentName: `${segment.name || ""}`.trim(),
        playerName: `${body?.player || ""}`.trim()
      };
    }

    async applySnapshot(snapshot) {
      if (!snapshot) return;
      if (snapshot.finished) {
        await this.clearActiveMatch("idle");
        return;
      }

      this.currentMatchId = snapshot.matchId || this.currentMatchId;
      this.ownPlayerIndex = snapshot.ownIndex ?? this.ownPlayerIndex;
      this.activePlayerIndex = snapshot.activePlayerIndex ?? this.activePlayerIndex;
      this.knownPlayerId = this.knownPlayerId || snapshot.playerId || snapshot.hostId || snapshot.userId || null;
      this.knownBoardId = this.knownBoardId || snapshot.boardId || this.currentBoardId || null;
      this.currentUserName = this.currentUserName || snapshot.playerName || "";

      if (typeof snapshot.score === "number") {
        if (!this.currentLeg) {
          this.currentLeg = this.createLeg(snapshot.score);
        } else if (snapshot.score > this.currentLeg.lastScore && this.currentLeg.lastScore !== null) {
          await this.finalizeLeg(false, "score-reset");
          this.currentLeg = this.createLeg(snapshot.score);
        }
        this.currentLeg.lastScore = snapshot.score;
        this.knownPlayerScore = snapshot.score;
      }

      const wasOwnTurn = this.isTrackedTurnActive;
      const isOwnTurn = Boolean(snapshot.active);
      this.lastSeenState = snapshot;

      if (wasOwnTurn && !isOwnTurn) {
        await this.finalizeOwnVisit("turn-ended", typeof snapshot.score === "number" ? snapshot.score : this.knownPlayerScore);
      }

      this.isTrackedTurnActive = isOwnTurn;
      this.currentVisitDartsLeft = isOwnTurn ? Math.max(0, Math.min(3, S.safeNumber(snapshot.dartsLeftInVisit) ?? 3)) : 3;

      if (isOwnTurn) {
        this.beginOwnTurn(typeof snapshot.score === "number" ? snapshot.score : this.knownPlayerScore);
        if (typeof snapshot.score === "number") {
          if (this.activeVisit && !this.activeVisit.dartsUsed) {
            this.activeVisit.startScore = snapshot.score;
            this.activeVisit.provisionalScore = snapshot.score;
          }
          if (this.activeVisit && this.activeVisit.dartsUsed > 0 && snapshot.score <= this.activeVisit.startScore) {
            this.activeVisit.provisionalScore = snapshot.score;
          }
        }
        await this.updateCheckoutAdvice(this.getEffectiveScore(), this.currentVisitDartsLeft);
      } else {
        await this.updateCheckoutAdvice(null, 0);
      }
    }

    beginOwnTurn(score) {
      const startScore = typeof score === "number" ? score : this.knownPlayerScore;
      if (typeof startScore !== "number") return;
      if (this.activeVisit && this.activeVisit.dartsUsed > 0) return;
      this.activeVisit = {
        startScore,
        provisionalScore: startScore,
        dartsUsed: 0,
        pointSum: 0,
        segments: []
      };
      if (!this.currentLeg) {
        this.currentLeg = this.createLeg(startScore);
      }
    }

    createLeg(startScore = 501) {
      const normalizedStart = startScore || 501;
      return {
        startedAt: Date.now(),
        startScore: normalizedStart,
        lastScore: normalizedStart,
        ownDarts: 0,
        ownScored: 0,
        first9Darts: 0,
        first9Scored: 0,
        checkoutStarted: this.isFinishable(normalizedStart, 3),
        checkoutDarts: 0,
        busts: 0,
        completed: false,
        visitCount: 0
      };
    }

    isFinishable(score, maxDarts = 3) {
      if (typeof score !== "number") return false;
      return Boolean(S.recommendCheckout(score, this.currentOutMode, {}, maxDarts).primary);
    }

    async applyBoardState(boardState) {
      if (!boardState) return;
      if (this.knownBoardId && boardState.topic && !boardState.topic.includes(this.knownBoardId)) return;
      if (typeof boardState.numThrows === "number" && this.isTrackedTurnActive) {
        this.currentVisitDartsLeft = Math.max(0, 3 - Math.max(0, Math.min(3, boardState.numThrows)));
        await this.updateCheckoutAdvice(this.getEffectiveScore(), this.currentVisitDartsLeft);
        return;
      }
      if (["started", "manual reset", "reset"].includes(boardState.eventName) && this.isTrackedTurnActive) {
        this.currentVisitDartsLeft = 3;
        this.beginOwnTurn(this.knownPlayerScore);
        await this.updateCheckoutAdvice(this.getEffectiveScore(), 3);
      }
    }

    async applyThrowEvent(throwEvent) {
      if (!throwEvent) return;
      if (this.currentMatchId && throwEvent.matchId && throwEvent.matchId !== this.currentMatchId) return;
      if (!this.isTrackedTurnActive) return;
      this.beginOwnTurn(this.knownPlayerScore);
      if (!this.activeVisit) return;
      this.activeVisit.dartsUsed += 1;
      this.activeVisit.pointSum += Math.max(0, throwEvent.points || 0);
      if (throwEvent.segmentName) this.activeVisit.segments.push(S.normalizeSegmentLabel(throwEvent.segmentName));
      this.activeVisit.provisionalScore = Math.max(0, this.activeVisit.startScore - this.activeVisit.pointSum);
      this.currentVisitDartsLeft = Math.max(0, 3 - this.activeVisit.dartsUsed);
      await this.updateCheckoutAdvice(this.activeVisit.provisionalScore, this.currentVisitDartsLeft);
    }

    async applyVisit(visit) {
      if (!visit) return;
      if (this.currentMatchId && visit.matchId && visit.matchId !== this.currentMatchId) return;
      const signature = [visit.eventName, visit.playerName, visit.remainingAfter, visit.matchId, visit.checkout].join("|");
      if (signature === this.lastProcessedEventSignature) return;
      this.lastProcessedEventSignature = signature;

      const eventName = `${visit.eventName || ""}`.toLowerCase();
      const ownTurnByName = visit.playerName && this.playerMatches(visit.playerName);
      if (!["turn_start", "round_start"].includes(eventName) || !ownTurnByName) return;

      if (this.activeVisit && this.activeVisit.dartsUsed > 0) {
        await this.finalizeOwnVisit("turn-replaced", typeof visit.remainingAfter === "number" ? visit.remainingAfter : this.knownPlayerScore);
      }

      if (typeof visit.remainingAfter === "number") {
        this.knownPlayerScore = visit.remainingAfter;
        if (!this.currentLeg) this.currentLeg = this.createLeg(visit.remainingAfter);
        else this.currentLeg.lastScore = visit.remainingAfter;
      }
      this.isTrackedTurnActive = true;
      this.currentVisitDartsLeft = 3;
      this.beginOwnTurn(this.knownPlayerScore);
      await this.updateCheckoutAdvice(this.getEffectiveScore(), 3);
    }

    async finalizeOwnVisit(reason, finalScoreOverride = null) {
      if (!this.activeVisit) {
        if (typeof finalScoreOverride === "number") this.knownPlayerScore = finalScoreOverride;
        return;
      }
      const visit = this.activeVisit;
      this.activeVisit = null;

      if (!visit.dartsUsed) {
        if (typeof finalScoreOverride === "number") this.knownPlayerScore = finalScoreOverride;
        return;
      }

      const startScore = typeof visit.startScore === "number" ? visit.startScore : (this.knownPlayerScore || 0);
      let finalScore = typeof finalScoreOverride === "number" ? finalScoreOverride : this.knownPlayerScore;
      if (typeof finalScore !== "number") finalScore = visit.provisionalScore;
      finalScore = Math.max(0, finalScore);

      let scored = Math.max(0, startScore - finalScore);
      let bust = false;
      if (visit.pointSum > 0 && finalScore >= startScore) {
        bust = true;
        scored = 0;
        finalScore = startScore;
      }
      const checkout = finalScore === 0;

      if (!this.currentLeg) this.currentLeg = this.createLeg(startScore);
      const leg = this.currentLeg;
      leg.visitCount += 1;
      leg.ownDarts += visit.dartsUsed;
      leg.ownScored += scored;
      const first9RemainingSlots = Math.max(0, 9 - leg.first9Darts);
      const first9Applied = Math.min(first9RemainingSlots, visit.dartsUsed);
      const first9Share = first9Applied > 0 && visit.dartsUsed > 0 ? scored * (first9Applied / visit.dartsUsed) : 0;
      leg.first9Darts += first9Applied;
      leg.first9Scored += first9Share;
      if (!leg.checkoutStarted && this.isFinishable(startScore, 3)) {
        leg.checkoutStarted = true;
      }
      if (leg.checkoutStarted) {
        leg.checkoutDarts += visit.dartsUsed;
      }
      if (bust) leg.busts += 1;
      leg.lastScore = finalScore;
      this.knownPlayerScore = finalScore;

      try {
        await S.recordAdvisorVisit({
          playerName: this.getResolvedDisplayName() || this.currentUserName || "",
          segments: visit.segments || [],
          checkout,
          startScore,
          outMode: this.currentOutMode
        });
      } catch (error) {
        await S.appendDebugEntry({ ts: Date.now(), kind: "advisor-profile-error", message: error?.message || String(error) });
      }

      this.currentVisitDartsLeft = 3;
      this.isTrackedTurnActive = false;
      await this.updateCheckoutAdvice(null, 0);

      if (checkout) {
        await this.finalizeLeg(true, reason || "checkout");
      }
    }

    async finalizeLeg(won, reason) {
      if (!this.currentLeg || this.currentLeg.completed) return;
      const leg = this.currentLeg;
      leg.completed = true;
      const todayKey = S.dateKeyFromTimestamp();
      await S.upsertSession(todayKey, (session) => {
        session.matches = Array.isArray(session.matches) ? session.matches : [];
        let match = session.matches.find((item) => item.matchId === (this.currentMatchId || "unknown-match"));
        if (!match) {
          match = S.createEmptyMatch(this.currentMatchId || `match-${Date.now()}`, session.targets, { outMode: this.currentOutMode, variant: "X01" });
          session.matches.unshift(match);
        }
        const legStats = {
          darts: leg.ownDarts,
          scored: leg.ownScored,
          average: leg.ownDarts > 0 ? (leg.ownScored / leg.ownDarts) * 3 : null,
          first9: leg.first9Darts > 0 ? (leg.first9Scored / leg.first9Darts) * 3 : null,
          checkoutDartsPerChance: leg.checkoutStarted ? leg.checkoutDarts : null,
          busts: leg.busts
        };
        const goalStatus = S.calcGoalStatus(legStats, session.targets || S.DEFAULT_SETTINGS.defaultTargets);
        match.legs = Array.isArray(match.legs) ? match.legs : [];
        match.legs.push({
          legNumber: match.legs.length + 1,
          won: Boolean(won),
          reason: reason || "completed",
          startedAt: leg.startedAt,
          endedAt: Date.now(),
          stats: legStats,
          goalStatus,
          goalSummary: S.computeGoalSummary(goalStatus)
        });
        match.updatedAt = Date.now();
        match.meta = { ...(match.meta || {}), outMode: this.currentOutMode, variant: "X01" };
        match.summary = S.summarizeMatch(match, session.targets);
        S.recalcSessionStats(session);
        return session;
      });
      this.currentLeg = null;
    }

    async updateCheckoutAdvice(score, maxDarts = 3) {
      const runtime = await S.getRuntime();
    STATE.runtime = runtime;
      const profile = await S.getAdvisorProfile();
      const profileSummary = S.getAdvisorProfileSummary(profile);
      const safeMaxDarts = Math.max(0, Math.min(3, S.safeNumber(maxDarts) ?? 3));
      const shouldShow = Boolean(this.currentMatchId && this.isTrackedTurnActive && typeof score === "number" && safeMaxDarts > 0);
      const recommendation = shouldShow
        ? S.recommendCheckoutDetailed(score, this.currentOutMode, profile, safeMaxDarts)
        : { primary: null, alternative: null, reasoning: [], confidence: profileSummary.confidence || "low" };
      await S.saveRuntime({
        ...runtime,
        currentScore: shouldShow ? score : null,
        currentSuggestedRoute: recommendation.primary,
        currentAltRoute: recommendation.alternative,
        currentAdvisorReasons: recommendation.reasoning || [],
        currentAdvisorConfidence: recommendation.confidence || profileSummary.confidence || "low",
        currentOutMode: this.currentOutMode,
        currentCheckoutMaxDarts: safeMaxDarts,
        lastKnownPlayerScore: typeof this.knownPlayerScore === "number" ? this.knownPlayerScore : null,
        trackedPlayerResolved: this.getResolvedDisplayName() || "",
        isInMatch: Boolean(this.currentMatchId),
        activeMatchId: this.currentMatchId,
        lastAdapterUpdate: Date.now()
      });
    }
  }



  function firstFinite(obj, keys) {
    for (const key of keys) {
      const value = S.safeNumber(obj[key]);
      if (value !== null) return value;
    }
    return null;
  }

  async function init() {
    STATE.settings = await S.getSettings();
    STATE.runtime = await S.getRuntime();
    STATE.adapter = new AutodartsAdapter();
    STATE.adapter.setSettings(STATE.settings);

    buildOverlay();
    bindMessages();
    setupStorageListener();
    setupUiRefreshLoops();
    setupMutationObserver();
    syncThemeFromPage();
    tryInjectMenuEntry();

    window.addEventListener("resize", handleViewportUpdate, { passive: true });
    await S.getOrCreateSession(S.dateKeyFromTimestamp());
    await renderOverlay();
  }

  function injectBridge() {
    if (document.getElementById("sc-page-bridge")) return;
    const script = document.createElement("script");
    script.id = "sc-page-bridge";
    script.src = chrome.runtime.getURL("page-bridge.js");
    (document.head || document.documentElement).appendChild(script);
  }

  function buildOverlayPeekTab() {
    if (STATE.hiddenTabEl) return;
    const tab = document.createElement("button");
    tab.id = "sc-overlay-peek";
    tab.type = "button";
    tab.innerHTML = `
      <span class="sc-peek-icon">🪈</span>
      <div>
        <strong>Session Coach</strong>
        <span>Öffnen</span>
      </div>
    `;
    tab.addEventListener("click", async () => {
      STATE.forceOverlayOpen = true;
      STATE.settings.overlayHidden = false;
      await S.saveSettings(STATE.settings);
      applyOverlaySettings();
      await renderOverlay();
    });
    document.documentElement.appendChild(tab);
    STATE.hiddenTabEl = tab;
  }

  function getOverlayVisibilityState(runtime = STATE.runtime) {
    const mode = STATE.settings?.overlayVisibilityMode || "match-only";
    const enabled = Boolean(STATE.settings?.enabled);
    const inMatch = Boolean(runtime?.isInMatch);
    const manuallyHidden = Boolean(STATE.settings?.overlayHidden);
    const allowedByMode = mode === "always" || inMatch || STATE.forceOverlayOpen;
    const showOverlay = enabled && !manuallyHidden && allowedByMode;
    const showPeekTab = enabled && !showOverlay;
    return { mode, enabled, inMatch, manuallyHidden, allowedByMode, showOverlay, showPeekTab };
  }

  function buildOverlay() {
    if (STATE.overlayEl) return;

    const overlay = document.createElement("div");
    overlay.id = "sc-overlay";
    overlay.innerHTML = `
      <div class="sc-overlay-header">
        <div class="sc-overlay-title">
          <strong>Session Coach</strong>
          <span id="sc-overlay-date">Waiting for data…</span>
        </div>
        <div class="sc-overlay-actions">
          <button class="sc-mini-btn" id="sc-open-panel" type="button">Coach</button>
          <button class="sc-mini-btn" id="sc-toggle-compact" type="button">Compact</button>
          <button class="sc-mini-btn" id="sc-hide-overlay" type="button">Ausblenden</button>
          <button class="sc-mini-btn sc-mini-btn-wide" id="sc-toggle-collapse" type="button">Einklappen</button>
        </div>
      </div>
      <div class="sc-metrics-grid">
        <div class="sc-card sc-status-gray" data-card="average">
          <div class="sc-card-label">Average</div>
          <div class="sc-card-main">—</div>
          <div class="sc-card-sub">Target —</div>
        </div>
        <div class="sc-card sc-status-gray" data-card="first9">
          <div class="sc-card-label">First 9</div>
          <div class="sc-card-main">—</div>
          <div class="sc-card-sub">Target —</div>
        </div>
        <div class="sc-card sc-status-gray" data-card="checkout">
          <div class="sc-card-label">Checkout</div>
          <div class="sc-card-main">—</div>
          <div class="sc-card-sub">Target —</div>
        </div>
        <div class="sc-card sc-status-gray" data-card="busts">
          <div class="sc-card-label">Busts</div>
          <div class="sc-card-main">—</div>
          <div class="sc-card-sub">Target —</div>
        </div>
        <div class="sc-card sc-status-gray route-card" data-card="route" style="grid-column: 1 / -1;">
          <div class="sc-card-label">Checkout advisor</div>
          <div class="sc-card-main">—</div>
          <div class="sc-card-sub">Waiting for a finishable score</div>
        </div>
      </div>
      <div class="sc-statusline">
        <span id="sc-status-text">Adapter: waiting</span>
        <span id="sc-goal-summary">Goals: 0/4</span>
      </div>
    `;

    document.documentElement.appendChild(overlay);
    STATE.overlayEl = overlay;
    buildOverlayPeekTab();

    overlay.querySelector("#sc-open-panel").addEventListener("click", openPanel);
    overlay.querySelector("#sc-hide-overlay").addEventListener("click", async () => {
      STATE.forceOverlayOpen = false;
      STATE.settings.overlayHidden = true;
      await S.saveSettings(STATE.settings);
      applyOverlaySettings();
    });
    overlay.querySelector("#sc-toggle-compact").addEventListener("click", async () => {
      STATE.settings.overlayCompact = !STATE.settings.overlayCompact;
      await S.saveSettings(STATE.settings);
      applyOverlaySettings();
      await renderOverlay();
    });
    overlay.querySelector("#sc-toggle-collapse").addEventListener("click", async () => {
      STATE.settings.overlayCollapsed = !STATE.settings.overlayCollapsed;
      await S.saveSettings(STATE.settings);
      applyOverlaySettings();
      await renderOverlay();
    });
    enableOverlayDragging(overlay.querySelector(".sc-overlay-header"));

    applyOverlaySettings();
  }

  function applyOverlaySettings() {
    if (!STATE.overlayEl) return;
    const visibility = getOverlayVisibilityState();
    STATE.overlayEl.style.display = visibility.showOverlay ? "" : "none";
    if (STATE.hiddenTabEl) STATE.hiddenTabEl.style.display = visibility.showPeekTab ? "" : "none";

    if (!visibility.showOverlay) return;

    STATE.overlayEl.classList.remove("sc-pos-top-right", "sc-pos-top-left", "sc-pos-bottom-right", "sc-pos-bottom-left", "sc-pos-custom");
    STATE.overlayEl.style.top = "";
    STATE.overlayEl.style.right = "";
    STATE.overlayEl.style.bottom = "";
    STATE.overlayEl.style.left = "";

    const position = STATE.settings.overlayPosition || "auto";
    if (position === "custom" && STATE.settings.overlayOffset && typeof STATE.settings.overlayOffset.x === "number" && typeof STATE.settings.overlayOffset.y === "number") {
      STATE.overlayEl.classList.add("sc-pos-custom");
      STATE.overlayEl.style.left = `${Math.max(8, Math.round(STATE.settings.overlayOffset.x))}px`;
      STATE.overlayEl.style.top = `${Math.max(8, Math.round(STATE.settings.overlayOffset.y))}px`;
    } else if (position === "auto") {
      applyAutoDockPosition();
    } else {
      STATE.overlayEl.classList.add(`sc-pos-${position}`);
    }

    STATE.overlayEl.classList.toggle("sc-compact", Boolean(STATE.settings.overlayCompact));
    STATE.overlayEl.classList.toggle("sc-collapsed", Boolean(STATE.settings.overlayCollapsed));
  }

  function applyAutoDockPosition() {
    if (!STATE.overlayEl) return;
    const sidebar = getMenuContainer();
    const header = document.querySelector("header");
    const safeTop = header ? Math.max(18, Math.round(header.getBoundingClientRect().bottom + 12)) : 18;

    if (sidebar && window.innerWidth >= 1180) {
      const rect = sidebar.getBoundingClientRect();
      const proposedLeft = Math.round(rect.right + 18);
      const maxLeft = Math.max(12, window.innerWidth - STATE.overlayEl.offsetWidth - 16);
      STATE.overlayEl.classList.add("sc-pos-custom");
      STATE.overlayEl.style.left = `${Math.min(proposedLeft, maxLeft)}px`;
      STATE.overlayEl.style.top = `${Math.max(72, Math.round(rect.top + 12))}px`;
    } else {
      STATE.overlayEl.classList.add("sc-pos-top-right");
      STATE.overlayEl.style.top = `${safeTop}px`;
      STATE.overlayEl.style.right = "18px";
    }
  }

  function bindMessages() {
    window.addEventListener("message", async (event) => {
      if (event.source !== window) return;
      const data = event.data;
      if (!data || data.source !== "session-coach-bridge") return;

      if (data.type === "bridge:ready") {
        await S.appendDebugEntry({ ts: Date.now(), kind: "bridge-ready", href: location.href });
        STATE.runtime = await S.saveRuntime({
          ...(await S.getRuntime()),
          ...STATE.adapter.resetRuntimeFields({
            adapterStatus: "waiting",
            lastAdapterUpdate: Date.now()
          })
        });
        await renderOverlay();
        return;
      }

      if (["ws:message", "fetch:json"].includes(data.type)) {
        try {
          if (STATE.settings.debugMode) {
            await S.appendDebugEntry({
              ts: Date.now(),
              kind: data.type,
              sample: minimizePayload(data.payload)
            });
          }
          await STATE.adapter.processEnvelope(data.type, data.payload);
          await renderOverlay();
          if (STATE.panelEl) await renderPanel();
        } catch (error) {
          await S.appendDebugEntry({
            ts: Date.now(),
            kind: "adapter-error",
            message: error?.message || String(error)
          });
        }
      }
    });
  }

  function minimizePayload(payload) {
    try {
      const json = JSON.stringify(payload);
      if (json.length <= 1200) return payload;
      return json.slice(0, 1200) + "…";
    } catch {
      return String(payload);
    }
  }

  function setupStorageListener() {
    chrome.storage.onChanged.addListener(async (changes) => {
      if (changes[S.STORAGE_KEYS.SETTINGS]) {
        STATE.settings = await S.getSettings();
        STATE.adapter.setSettings(STATE.settings);
        applyOverlaySettings();
        await renderOverlay();
        if (STATE.panelEl) await renderPanel();
      }
      if (changes[S.STORAGE_KEYS.RUNTIME] || changes[S.STORAGE_KEYS.DAILY_SESSIONS]) {
        if (changes[S.STORAGE_KEYS.RUNTIME]) {
          STATE.runtime = await S.getRuntime();
          if (STATE.runtime.isInMatch) STATE.forceOverlayOpen = false;
          if (!STATE.runtime.isInMatch && (STATE.settings?.overlayVisibilityMode || "match-only") === "match-only" && !STATE.settings?.overlayHidden) {
            STATE.forceOverlayOpen = false;
          }
          applyOverlaySettings();
        }
        await renderOverlay();
        if (STATE.panelEl) await renderPanel();
      }
    });
  }

  function setupUiRefreshLoops() {
    if (STATE.overlayRefreshTimer) clearInterval(STATE.overlayRefreshTimer);
    STATE.overlayRefreshTimer = setInterval(renderOverlay, 5000);

    if (STATE.routeInjectionTimer) clearInterval(STATE.routeInjectionTimer);
    STATE.routeInjectionTimer = setInterval(() => {
      syncThemeFromPage();
      tryInjectMenuEntry();
      if ((STATE.settings?.overlayPosition || "auto") === "auto") applyOverlaySettings();
    }, 2500);
  }

  function setupMutationObserver() {
    if (STATE.menuObserver) return;
    STATE.menuObserver = new MutationObserver(() => {
      syncThemeFromPage();
      tryInjectMenuEntry();
      if ((STATE.settings?.overlayPosition || "auto") === "auto") applyOverlaySettings();
    });
    STATE.menuObserver.observe(document.documentElement, { childList: true, subtree: true });
  }

  function handleViewportUpdate() {
    syncThemeFromPage();
    if ((STATE.settings?.overlayPosition || "auto") === "auto") {
      applyOverlaySettings();
    }
  }

  function syncThemeFromPage() {
    const root = document.documentElement;
    const themeSource = document.querySelector("aside, nav, header, main, body") || document.body || root;
    const styles = getComputedStyle(themeSource);
    const bodyStyles = getComputedStyle(document.body || root);
    const bg = pickColor(styles.backgroundColor, bodyStyles.backgroundColor, "rgba(18, 24, 37, 0.96)");
    const text = pickColor(styles.color, bodyStyles.color, "#f7f9fd");
    const accent = detectAccentColor() || "#7d9dff";

    root.style.setProperty("--sc-bg", mixWithBlack(bg, 0.56));
    root.style.setProperty("--sc-bg-soft", withAlpha(text, 0.06));
    root.style.setProperty("--sc-bg-strong", mixWithBlack(bg, 0.7));
    root.style.setProperty("--sc-border", withAlpha(text, 0.12));
    root.style.setProperty("--sc-text", text);
    root.style.setProperty("--sc-muted", withAlpha(text, 0.72));
    root.style.setProperty("--sc-accent", accent);
  }

  function detectAccentColor() {
    const candidates = [
      ...document.querySelectorAll("[aria-current='page'], [aria-selected='true'], .active, .Mui-selected, [class*='selected'], [class*='active']")
    ].slice(0, 16);

    for (const el of candidates) {
      const styles = getComputedStyle(el);
      const colors = [styles.color, styles.backgroundColor, styles.borderColor];
      for (const color of colors) {
        if (isMeaningfulColor(color)) return color;
      }
    }
    return null;
  }

  function pickColor(...colors) {
    for (const color of colors) {
      if (isMeaningfulColor(color)) return color;
    }
    return colors[colors.length - 1];
  }

  function isMeaningfulColor(color) {
    return Boolean(color) && color !== "transparent" && color !== "rgba(0, 0, 0, 0)";
  }

  function parseRgb(color) {
    const text = `${color || ""}`.trim();
    const rgba = text.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/i);
    if (rgba) return [Number(rgba[1]), Number(rgba[2]), Number(rgba[3])];
    const hex6 = text.match(/^#([0-9a-f]{6})$/i);
    if (hex6) {
      const value = hex6[1];
      return [parseInt(value.slice(0, 2), 16), parseInt(value.slice(2, 4), 16), parseInt(value.slice(4, 6), 16)];
    }
    const hex3 = text.match(/^#([0-9a-f]{3})$/i);
    if (hex3) {
      const value = hex3[1];
      return [parseInt(value[0] * 2, 16), parseInt(value[1] * 2, 16), parseInt(value[2] * 2, 16)];
    }
    return [125, 157, 255];
  }

  function withAlpha(color, alpha) {
    const [r, g, b] = parseRgb(color);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  function mixWithBlack(color, blackAmount) {
    const [r, g, b] = parseRgb(color);
    const factor = Math.max(0, Math.min(1, 1 - blackAmount));
    return `rgba(${Math.round(r * factor)}, ${Math.round(g * factor)}, ${Math.round(b * factor)}, 0.96)`;
  }

  async function renderOverlay() {
    if (!STATE.overlayEl) return;
    const todayKey = S.dateKeyFromTimestamp();
    const sessions = await S.getDailySessions();
    const runtime = await S.getRuntime();
    STATE.runtime = runtime;
    const session = sessions[todayKey] || null;
    const livePreview = STATE.adapter?.getLivePreview ? STATE.adapter.getLivePreview() : null;
    const activeTargets = session?.targets || STATE.settings?.defaultTargets || S.DEFAULT_SETTINGS.defaultTargets;
    const liveGoalStatus = livePreview ? S.calcGoalStatus(livePreview, activeTargets) : {
      averageOver: "gray",
      first9Over: "gray",
      checkoutDartsUnder: "gray",
      maxBusts: "gray"
    };
    const todaySummary = session?.summary || { matches: 0, legs: 0, goalRatePercent: 0, perfectLegs: 0 };

    document.getElementById("sc-overlay-date").textContent = runtime.isInMatch ? "Current leg" : `Today · ${todayKey}`;
    document.getElementById("sc-status-text").textContent = `Adapter: ${runtime.adapterStatus || "waiting"}${runtime.trackedPlayerResolved ? ` · ${runtime.trackedPlayerResolved}` : ""}`;
    document.getElementById("sc-goal-summary").textContent = livePreview
      ? `Leg goals: ${S.computeGoalSummary(liveGoalStatus)}`
      : `Today: ${todaySummary.matches} matches · ${todaySummary.legs} legs · ${todaySummary.goalRatePercent}%`;
    const collapseBtn = document.getElementById("sc-toggle-collapse");
    if (collapseBtn) collapseBtn.textContent = STATE.settings.overlayCollapsed ? "Ausklappen" : "Einklappen";
    const hideBtn = document.getElementById("sc-hide-overlay");
    if (hideBtn) hideBtn.textContent = "Ausblenden";
    applyOverlaySettings();

    renderMetricCard("average", livePreview?.average, activeTargets?.averageOver, ">", liveGoalStatus?.averageOver);
    renderMetricCard("first9", livePreview?.first9, activeTargets?.first9Over, ">", liveGoalStatus?.first9Over);
    renderMetricCard("checkout", livePreview?.checkoutDartsPerChance, activeTargets?.checkoutDartsUnder, "<", liveGoalStatus?.checkoutDartsUnder);
    renderMetricCard("busts", livePreview?.busts, activeTargets?.maxBusts, "≤", liveGoalStatus?.maxBusts, true);

    const routeCard = STATE.overlayEl.querySelector('[data-card="route"]');
    const main = routeCard.querySelector(".sc-card-main");
    const sub = routeCard.querySelector(".sc-card-sub");
    const hasAdvisor = Boolean(runtime.isInMatch && runtime.currentSuggestedRoute && typeof runtime.currentScore === "number");
    routeCard.style.display = hasAdvisor ? "" : "none";
    routeCard.classList.remove("sc-status-green", "sc-status-yellow", "sc-status-red", "sc-status-gray");
    routeCard.classList.add(hasAdvisor ? "sc-status-green" : "sc-status-gray");

    if (hasAdvisor) {
      main.textContent = `${runtime.currentScore} → ${S.routeForDisplay(runtime.currentSuggestedRoute)}`;
      const reasons = Array.isArray(runtime.currentAdvisorReasons) ? runtime.currentAdvisorReasons.filter(Boolean).slice(0, 2) : [];
      const baseLine = runtime.currentAltRoute
        ? `Alt: ${S.routeForDisplay(runtime.currentAltRoute)} · ${runtime.currentCheckoutMaxDarts || 3} Darts · ${runtime.currentOutMode || "SI/DO"}`
        : `${runtime.currentCheckoutMaxDarts || 3} Darts · ${runtime.currentOutMode || "SI/DO"}`;
      sub.textContent = reasons.length
        ? `${baseLine} · ${reasons.join(" · ")} · ${runtime.currentAdvisorConfidence || "low"} confidence`
        : `${baseLine} · ${runtime.currentAdvisorConfidence || "low"} confidence`;
    } else {
      main.textContent = "—";
      sub.textContent = "Advisor only while you can finish";
    }
  }

  function renderMetricCard(key, value, target, symbol, status, integer = false) {
    const card = STATE.overlayEl.querySelector(`[data-card="${key}"]`);
    if (!card) return;
    const main = card.querySelector(".sc-card-main");
    const sub = card.querySelector(".sc-card-sub");
    card.classList.remove("sc-status-green", "sc-status-yellow", "sc-status-red", "sc-status-gray");
    card.classList.add(`sc-status-${status || "gray"}`);
    main.textContent = integer ? S.fmtMaybeInt(value) : S.fmtNumber(value);
    sub.textContent = target === undefined || target === null
      ? "Target —"
      : `Target ${symbol}${integer ? S.fmtMaybeInt(target) : S.fmtNumber(target)}`;
  }

  function enableOverlayDragging(handle) {
    if (!handle) return;

    handle.addEventListener("pointerdown", (event) => {
      if (event.target.closest("button")) return;
      const rect = STATE.overlayEl.getBoundingClientRect();
      STATE.dragState = {
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        offsetX: rect.left,
        offsetY: rect.top
      };
      STATE.overlayEl.classList.add("sc-dragging");
      handle.setPointerCapture?.(event.pointerId);
    });

    handle.addEventListener("pointermove", (event) => {
      if (!STATE.dragState || STATE.dragState.pointerId !== event.pointerId) return;
      const dx = event.clientX - STATE.dragState.startX;
      const dy = event.clientY - STATE.dragState.startY;
      const maxX = Math.max(8, window.innerWidth - STATE.overlayEl.offsetWidth - 8);
      const maxY = Math.max(8, window.innerHeight - STATE.overlayEl.offsetHeight - 8);
      const nextX = Math.min(maxX, Math.max(8, STATE.dragState.offsetX + dx));
      const nextY = Math.min(maxY, Math.max(8, STATE.dragState.offsetY + dy));
      STATE.overlayEl.classList.remove("sc-pos-top-right", "sc-pos-top-left", "sc-pos-bottom-right", "sc-pos-bottom-left");
      STATE.overlayEl.classList.add("sc-pos-custom");
      STATE.overlayEl.style.left = `${nextX}px`;
      STATE.overlayEl.style.top = `${nextY}px`;
      STATE.overlayEl.style.right = "auto";
      STATE.overlayEl.style.bottom = "auto";
    });

    const stopDragging = async (event) => {
      if (!STATE.dragState || (event && STATE.dragState.pointerId !== event.pointerId)) return;
      const rect = STATE.overlayEl.getBoundingClientRect();
      STATE.overlayEl.classList.remove("sc-dragging");
      STATE.dragState = null;
      STATE.settings.overlayPosition = "custom";
      STATE.settings.overlayOffset = { x: rect.left, y: rect.top };
      await S.saveSettings(STATE.settings);
    };

    handle.addEventListener("pointerup", stopDragging);
    handle.addEventListener("pointercancel", stopDragging);
  }

  async function openPanel() {
    if (STATE.panelEl) {
      closePanel();
      return;
    }

    const backdrop = document.createElement("div");
    backdrop.id = "sc-panel-backdrop";
    backdrop.addEventListener("click", closePanel);

    const panel = document.createElement("div");
    panel.id = "sc-panel";
    panel.innerHTML = `
      <div class="sc-panel-header">
        <div>
          <h2>Session Coach</h2>
          <p>Today, recent sessions, targets and the live adapter status.</p>
        </div>
        <div class="sc-panel-header-actions">
          <button class="sc-mini-btn sc-open-training-btn" id="sc-open-training-page" type="button">Training</button>
          <button class="sc-close-btn" type="button">Close</button>
        </div>
      </div>
      <section class="sc-section">
        <h3>Today</h3>
        <div class="sc-today-grid" id="sc-panel-today"></div>
      </section>
      <section class="sc-section">
        <h3>Matches today</h3>
        <div class="sc-history-grid" id="sc-panel-history"></div>
      </section>
      <section class="sc-section">
        <h3>Default targets</h3>
        <div class="sc-panel-toolbar">
          <div class="preset-row">
            <button class="sc-mini-btn" data-preset="starter" type="button">Starter</button>
            <button class="sc-mini-btn" data-preset="solid" type="button">Solid</button>
            <button class="sc-mini-btn" data-preset="push" type="button">Push</button>
          </div>
          <button class="sc-mini-btn" id="sc-save-settings" type="button">Save</button>
        </div>
        <div class="sc-settings-grid">
          <label class="sc-settings-field"><span>Average over</span><input id="sc-target-average" type="number" step="0.1" min="0"></label>
          <label class="sc-settings-field"><span>First 9 over</span><input id="sc-target-first9" type="number" step="0.1" min="0"></label>
          <label class="sc-settings-field"><span>Checkout darts under</span><input id="sc-target-checkout" type="number" step="0.1" min="0"></label>
          <label class="sc-settings-field"><span>Max busts</span><input id="sc-target-busts" type="number" step="1" min="0"></label>
        </div>
        <div class="sc-panel-note" id="sc-settings-note"></div>
      </section>
      <section class="sc-section">
        <h3>Debug snapshot</h3>
        <div class="sc-debug-block" id="sc-panel-debug"></div>
      </section>
    `;

    panel.querySelector(".sc-close-btn").addEventListener("click", closePanel);
    panel.querySelector("#sc-open-training-page").addEventListener("click", () => {
      openCoachPage("training");
    });
    panel.querySelectorAll("[data-preset]").forEach((btn) => btn.addEventListener("click", () => applyPanelPreset(btn.dataset.preset)));
    panel.querySelector("#sc-save-settings").addEventListener("click", savePanelSettings);

    document.documentElement.appendChild(backdrop);
    document.documentElement.appendChild(panel);
    STATE.panelEl = panel;
    STATE.panelBackdropEl = backdrop;
    await renderPanel();
  }

  function closePanel() {
    STATE.panelEl?.remove();
    STATE.panelBackdropEl?.remove();
    STATE.panelEl = null;
    STATE.panelBackdropEl = null;
  }



  function applyPanelPreset(name) {
    if (!STATE.panelEl) return;
    const preset = S.TARGET_PRESETS?.[name];
    if (!preset) return;
    STATE.panelEl.querySelector("#sc-target-average").value = preset.averageOver;
    STATE.panelEl.querySelector("#sc-target-first9").value = preset.first9Over;
    STATE.panelEl.querySelector("#sc-target-checkout").value = preset.checkoutDartsUnder;
    STATE.panelEl.querySelector("#sc-target-busts").value = preset.maxBusts;
    const note = STATE.panelEl.querySelector("#sc-settings-note");
    if (note) note.textContent = `Preset applied: ${name}`;
  }

  async function savePanelSettings() {
    if (!STATE.panelEl) return;
    const settings = await S.getSettings();
    settings.defaultTargets = {
      averageOver: S.safeNumber(STATE.panelEl.querySelector("#sc-target-average")?.value) ?? settings.defaultTargets.averageOver,
      first9Over: S.safeNumber(STATE.panelEl.querySelector("#sc-target-first9")?.value) ?? settings.defaultTargets.first9Over,
      checkoutDartsUnder: S.safeNumber(STATE.panelEl.querySelector("#sc-target-checkout")?.value) ?? settings.defaultTargets.checkoutDartsUnder,
      maxBusts: S.safeNumber(STATE.panelEl.querySelector("#sc-target-busts")?.value) ?? settings.defaultTargets.maxBusts
    };
    await S.saveSettings(settings);
    await S.setSessionTargets(S.dateKeyFromTimestamp(), settings.defaultTargets, { createIfMissing: false });
    const note = STATE.panelEl.querySelector("#sc-settings-note");
    if (note) note.textContent = "Targets saved and applied to today.";
    await renderPanel();
    await renderOverlay();
  }

  async function renderPanel() {
    if (!STATE.panelEl) return;
    const sessions = await S.listRecentSessions(10);
    const runtime = await S.getRuntime();
    STATE.runtime = runtime;
    const debug = await S.getDebugLog();
    const todayKey = S.dateKeyFromTimestamp();
    const today = sessions.find((entry) => entry.date === todayKey) || null;

    const todayEl = STATE.panelEl.querySelector("#sc-panel-today");
    const historyEl = STATE.panelEl.querySelector("#sc-panel-history");
    const debugEl = STATE.panelEl.querySelector("#sc-panel-debug");
    const averageInput = STATE.panelEl.querySelector("#sc-target-average");
    const first9Input = STATE.panelEl.querySelector("#sc-target-first9");
    const checkoutInput = STATE.panelEl.querySelector("#sc-target-checkout");
    const bustsInput = STATE.panelEl.querySelector("#sc-target-busts");
    const panelSettings = await S.getSettings();
    if (averageInput) averageInput.value = panelSettings.defaultTargets.averageOver;
    if (first9Input) first9Input.value = panelSettings.defaultTargets.first9Over;
    if (checkoutInput) checkoutInput.value = panelSettings.defaultTargets.checkoutDartsUnder;
    if (bustsInput) bustsInput.value = panelSettings.defaultTargets.maxBusts;

    if (today) {
      todayEl.innerHTML = [
        row("Date", today.date),
        row("Matches", `${today.summary.matches}`),
        row("Legs", `${today.summary.legs}`),
        row("Perfect legs", `${today.summary.perfectLegs}`),
        row("Goal rate", `${today.summary.goalRatePercent}%`),
        row("Leg average", `${S.fmtNumber(today.summary.averageMean)} / >${S.fmtNumber(today.targets.averageOver)}`),
        row("Leg first 9", `${S.fmtNumber(today.summary.first9Mean)} / >${S.fmtNumber(today.targets.first9Over)}`),
        row("Leg checkout", `${S.fmtNumber(today.summary.checkoutMean)} / <${S.fmtNumber(today.targets.checkoutDartsUnder)}`),
        row("Leg busts", `${S.fmtNumber(today.summary.bustsMean)} / ≤${S.fmtMaybeInt(today.targets.maxBusts)}`),
        goalBarRow("Average target", today.summary.goalHits.averageOver, today.summary.legs),
        goalBarRow("First 9 target", today.summary.goalHits.first9Over, today.summary.legs),
        goalBarRow("Checkout target", today.summary.goalHits.checkoutDartsUnder, today.summary.legs),
        goalBarRow("Bust target", today.summary.goalHits.maxBusts, today.summary.legs)
      ].join("");
    } else {
      todayEl.innerHTML = [
        row("Date", todayKey),
        row("Matches", "0"),
        row("Legs", "0"),
        row("Status", "Waiting for first x01 leg")
      ].join("");
    }

    const matches = today?.matches || [];
    historyEl.innerHTML = matches.length ? matches.map((match) => {
      const summary = match.summary || S.summarizeMatch(match, today?.targets || panelSettings.defaultTargets);
      const legs = match.legs || [];
      return `
        <div class="sc-history-item sc-match-card">
          <h4>Match ${escapeHtml((match.matchId || "").slice(-8) || "—")}</h4>
          <div class="sc-goal-badge">${summary.perfectLegs}/${summary.legs} perfect legs · ${summary.goalRatePercent}% goals hit</div>
          ${goalBarRow("Average", summary.goalHits.averageOver, summary.legs)}
          ${goalBarRow("First 9", summary.goalHits.first9Over, summary.legs)}
          ${goalBarRow("Checkout", summary.goalHits.checkoutDartsUnder, summary.legs)}
          ${goalBarRow("Busts", summary.goalHits.maxBusts, summary.legs)}
          <div class="sc-leg-list">
            ${legs.map((leg) => `
              <div class="sc-leg-item">
                <div class="sc-leg-head"><strong>Leg ${leg.legNumber}</strong><span>${leg.goalSummary}</span></div>
                <div class="sc-leg-grid">
                  <span>Avg ${S.fmtNumber(leg.stats.average)}</span>
                  <span>F9 ${S.fmtNumber(leg.stats.first9)}</span>
                  <span>CO ${S.fmtNumber(leg.stats.checkoutDartsPerChance)}</span>
                  <span>Busts ${S.fmtMaybeInt(leg.stats.busts)}</span>
                </div>
              </div>
            `).join("")}
          </div>
        </div>
      `;
    }).join("") : `<div class="sc-history-item">No tracked matches today yet.</div>`;

    debugEl.textContent = JSON.stringify({
      runtime,
      latestDebugEntries: debug.slice(0, 5)
    }, null, 2);
  }

  function row(label, value) {
    return `<div class="sc-card"><div class="sc-row"><span>${escapeHtml(label)}</span><span>${escapeHtml(String(value))}</span></div></div>`;
  }

  function goalBarRow(label, hits, total) {
    const safeTotal = Math.max(0, total || 0);
    const safeHits = Math.max(0, Math.min(safeTotal, hits || 0));
    const percent = safeTotal ? Math.round((safeHits / safeTotal) * 100) : 0;
    return `<div class="sc-card sc-goal-progress-card"><div class="sc-row"><span>${escapeHtml(label)}</span><span>${safeHits}/${safeTotal}</span></div><div class="sc-goal-progress"><div class="sc-goal-progress-fill" style="width:${percent}%"></div></div></div>`;
  }

  function escapeHtml(value) {
    return `${value || ""}`
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function removeInjectedMenuEntries() {
    document.getElementById("sc-menu-entry")?.remove();
    document.getElementById("sc-menu-entry-training")?.remove();
  }

  function openCoachPage(tab = "overview") {
    const hash = tab && tab !== "overview" ? `#${tab}` : "";
    window.open(chrome.runtime.getURL(`coach.html${hash}`), "_blank", "noopener,noreferrer");
  }

  function tryInjectMenuEntry() {
    const existing = document.getElementById("sc-menu-entry");
    const existingTraining = document.getElementById("sc-menu-entry-training");
    const mount = findMenuMountTarget();

    if (mount) {
      const alreadyNative = existing && existingTraining
        && existing.dataset.scEntryType === "native"
        && existingTraining.dataset.scEntryType === "native"
        && existing.parentElement === mount.container
        && existingTraining.parentElement === mount.container;
      if (alreadyNative && document.contains(existing) && document.contains(existingTraining)) return;

      removeInjectedMenuEntries();
      STATE.floatingButtonEl = null;

      const entry = buildMenuEntry(mount.template, { text: "Session Coach", icon: "whistle" });
      entry.id = "sc-menu-entry";
      entry.dataset.scEntryType = "native";
      entry.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openPanel();
      });

      const trainingEntry = buildMenuEntry(mount.template, { text: "Training", icon: "none" });
      trainingEntry.id = "sc-menu-entry-training";
      trainingEntry.dataset.scEntryType = "native";
      trainingEntry.classList.add("sc-submenu-entry");
      trainingEntry.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        openCoachPage("training");
      });

      mount.container.insertBefore(entry, mount.insertBefore || null);
      mount.container.insertBefore(trainingEntry, entry.nextSibling);
      STATE.injectedMenuEntryEl = entry;
      return;
    }

    if (!existing || existing.dataset.scEntryType !== "floating") {
      removeInjectedMenuEntries();
      const floating = document.createElement("button");
      floating.id = "sc-menu-entry";
      floating.dataset.scEntryType = "floating";
      floating.className = "sc-floating-entry";
      floating.type = "button";
      floating.textContent = "Session Coach";
      floating.addEventListener("click", openPanel);
      document.documentElement.appendChild(floating);
      STATE.floatingButtonEl = floating;
    }
  }

  function isVisibleElement(el) {
    if (!el || !document.contains(el)) return false;
    const rect = el.getBoundingClientRect();
    if (!rect.width || !rect.height) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && style.opacity !== "0";
  }

  function findPreferredMenuAnchor() {
    const exactPriority = ["tools", "meine boards", "statistiken", "spielhistorie", "spiele", "lobbys", "spielen"];
    const labels = new Set(["spielen", "lobbys", "spiele", "turniere", "spielhistorie", "statistiken", "meine boards", "tools", "friends", "lobby", "matches", "training", "stats", "statistics", "settings", "home"]);
    const textCandidates = [...document.querySelectorAll("aside *, nav *, [role='navigation'] *")]
      .filter((el) => isVisibleElement(el))
      .map((el) => ({ el, text: cleanText(el.textContent), rect: el.getBoundingClientRect() }))
      .filter(({ el, text, rect }) => {
        if (!text || !labels.has(text.toLowerCase())) return false;
        if (rect.left > 260 || rect.top < 40 || rect.height < 10 || rect.height > 80) return false;
        return ![...el.children].some((child) => cleanText(child.textContent).toLowerCase() === text.toLowerCase());
      });

    textCandidates.sort((a, b) => {
      const ai = exactPriority.indexOf(a.text.toLowerCase());
      const bi = exactPriority.indexOf(b.text.toLowerCase());
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.rect.top - b.rect.top;
    });

    if (textCandidates[0]?.el) return textCandidates[0].el;

    const genericPattern = /^(spielen|lobbys|spiele|turniere|spielhistorie|statistiken|meine boards|tools|friends|lobby|matches|training|stats|statistics|settings|home)$/i;
    const clickables = [...document.querySelectorAll("aside a, aside button, nav a, nav button, [role='navigation'] a, [role='navigation'] button, a, button, [role='button']")];
    const candidates = clickables
      .filter((el) => isVisibleElement(el))
      .map((el) => ({ el, text: cleanText(el.textContent), rect: el.getBoundingClientRect() }))
      .filter(({ text, rect }) => text && text.length <= 36 && rect.left < 320 && rect.top > 40 && rect.height >= 20 && genericPattern.test(text));

    candidates.sort((a, b) => {
      const ai = exactPriority.indexOf(a.text.toLowerCase());
      const bi = exactPriority.indexOf(b.text.toLowerCase());
      if (ai !== -1 || bi !== -1) return (ai === -1 ? 999 : ai) - (bi === -1 ? 999 : bi);
      return a.rect.top - b.rect.top;
    });

    return candidates[0]?.el || null;
  }

  function resolveMenuNode(anchorEl) {
    if (!anchorEl) return anchorEl;
    const direct = anchorEl.closest("li, [role='menuitem'], [class*='ListItem'], [class*='list-item'], [class*='item'], a, button");
    if (direct) return direct;

    let best = anchorEl;
    let current = anchorEl;
    for (let i = 0; i < 6 && current?.parentElement; i += 1) {
      current = current.parentElement;
      const rect = current.getBoundingClientRect();
      if (rect.left < 220 && rect.width >= 90 && rect.width <= 320 && rect.height >= 24 && rect.height <= 76) {
        best = current;
      }
    }
    return best;
  }

  function getMenuContainer() {
    const preferredAnchor = findPreferredMenuAnchor();
    if (preferredAnchor) {
      return preferredAnchor.closest("aside, nav, [role='navigation'], [class*='sidebar'], [class*='menu']") || preferredAnchor.parentElement;
    }
    return findMenuMountTarget()?.container?.closest("aside, nav, [role='navigation']") || document.querySelector("aside nav, nav[role='navigation'], aside, nav");
  }

  function findMenuMountTarget() {
    const preferredAnchor = findPreferredMenuAnchor();
    if (preferredAnchor) {
      const template = resolveMenuNode(preferredAnchor);
      const container = template.parentElement;
      if (container) {
        return {
          template,
          container,
          insertBefore: template.nextSibling
        };
      }
    }

    const navigations = [
      ...document.querySelectorAll("aside nav, nav[role='navigation'], aside, nav, [role='navigation'], [class*='sidebar'], [class*='menu']")
    ].filter((el) => isVisibleElement(el));

    for (const nav of navigations) {
      const items = [...nav.querySelectorAll("a, button, [role='button']")].filter((el) => {
        const text = cleanText(el.textContent);
        const rect = el.getBoundingClientRect();
        return text && text.length <= 36 && rect.left < 320 && rect.height >= 20 && isVisibleElement(el);
      });
      if (!items.length) continue;

      const templateButton = items.find((el) => /tools|meine boards|stats|statistics|lobby|spielen|spiele/i.test(cleanText(el.textContent))) || items[items.length - 1];
      const template = resolveMenuNode(templateButton);
      const container = template.parentElement || nav;
      return {
        template,
        container,
        insertBefore: template.nextSibling
      };
    }

    return null;
  }

  function getWhistleSvgMarkup() {
    return `
      <svg class="sc-whistle-icon" viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <g fill="currentColor">
          <circle cx="6.6" cy="16.2" r="2.2"></circle>
          <path d="M11 10.2a4.8 4.8 0 0 1 6.8 0l1.9 1.9a1.2 1.2 0 0 1-.85 2.05H16.8a3.3 3.3 0 0 0-3.18 4.2 1.2 1.2 0 0 1-1.7 1.38L8.7 18.1a3.65 3.65 0 0 0 .5-1.83c0-.49-.1-.96-.28-1.4l4.56-2.53A1.2 1.2 0 0 0 14 11.3l-3 1.67v-.37A3.4 3.4 0 0 1 11 10.2Z"></path>
          <path d="M18.2 10.7 20 9a1 1 0 1 1 1.4 1.4l-1.5 1.5-.7-.7Z"></path>
        </g>
      </svg>
    `;
  }

  function createWhistleIcon() {
    const template = document.createElement("template");
    template.innerHTML = getWhistleSvgMarkup().trim();
    return template.content.firstElementChild;
  }

  function injectWhistleIcon(root, clickable = root) {
    if (!root) return;

    const iconHost = root.querySelector("svg, img, [class*='icon'], [data-testid*='icon']");
    if (iconHost) {
      if (iconHost.matches("svg, img")) {
        iconHost.replaceWith(createWhistleIcon());
      } else {
        iconHost.classList.add("sc-menu-icon-slot");
        const nestedGraphic = iconHost.querySelector("svg, img");
        if (nestedGraphic) nestedGraphic.replaceWith(createWhistleIcon());
        else iconHost.prepend(createWhistleIcon());
      }
      return;
    }

    const slot = document.createElement("span");
    slot.className = "sc-menu-icon-slot";
    slot.appendChild(createWhistleIcon());
    clickable.prepend(slot);
  }

  function injectSpacerIcon(root, clickable = root) {
    if (!root) return;

    const iconHost = root.querySelector("svg, img, [class*='icon'], [data-testid*='icon']");
    if (iconHost) {
      if (iconHost.matches("svg, img")) {
        const spacer = document.createElement("span");
        spacer.className = "sc-menu-icon-slot sc-menu-icon-spacer";
        iconHost.replaceWith(spacer);
      } else {
        iconHost.classList.add("sc-menu-icon-slot", "sc-menu-icon-spacer");
        iconHost.innerHTML = "";
      }
      return;
    }

    const slot = document.createElement("span");
    slot.className = "sc-menu-icon-slot sc-menu-icon-spacer";
    clickable.prepend(slot);
  }

  function buildMenuEntry(template, options = {}) {
    const text = options.text || "Session Coach";
    const iconMode = options.icon || "whistle";

    if (template) {
      const clone = template.cloneNode(true);
      clone.classList.add("sc-native-entry");
      clone.removeAttribute?.("href");
      clone.removeAttribute?.("aria-current");
      clone.querySelectorAll?.("[aria-current='page'], [aria-selected='true']").forEach((el) => {
        el.removeAttribute("aria-current");
        el.removeAttribute("aria-selected");
      });

      const clickable = clone.matches("a, button") ? clone : clone.querySelector("a, button") || clone;
      if (clickable.tagName === "A") clickable.removeAttribute("href");
      clickable.setAttribute("role", "button");
      clickable.setAttribute("aria-label", text);
      clickable.classList.add("sc-native-entry-clickable");
      replacePrimaryText(clickable, text);
      if (iconMode === "whistle") {
        injectWhistleIcon(clone, clickable);
      } else {
        injectSpacerIcon(clone, clickable);
      }
      return clone;
    }

    const fallback = document.createElement("button");
    fallback.type = "button";
    fallback.className = "sc-nav-fallback";
    const iconHtml = iconMode === "whistle"
      ? `<span class="sc-menu-icon-slot sc-menu-icon-fallback">${getWhistleSvgMarkup()}</span>`
      : `<span class="sc-menu-icon-slot sc-menu-icon-spacer" aria-hidden="true"></span>`;
    fallback.innerHTML = `${iconHtml}<span>${text}</span>`;
    return fallback;
  }

  function replacePrimaryText(root, text) {
    const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
      acceptNode(node) {
        return cleanText(node.textContent) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      }
    });

    let firstNode = null;
    const extraNodes = [];
    while (walker.nextNode()) {
      if (!firstNode) firstNode = walker.currentNode;
      else extraNodes.push(walker.currentNode);
    }

    if (firstNode) {
      firstNode.textContent = text;
      extraNodes.forEach((node) => {
        node.textContent = "";
      });
    } else {
      root.append(text);
    }
  }

  function ensureMenuBadge(root) {
    const existing = root.querySelector(".sc-nav-badge");
    if (existing) return;
    const badge = document.createElement("span");
    badge.className = "sc-nav-badge";
    badge.textContent = "SC";
    root.prepend(badge);
  }

  function cleanText(value) {
    return `${value || ""}`.replace(/\s+/g, " ").trim();
  }

  function bootstrap() {
    injectBridge();
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        init();
      }, { once: true });
      return;
    }
    init();
  }

  bootstrap();
})();
