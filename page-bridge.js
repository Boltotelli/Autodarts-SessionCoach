(() => {
  if (window.__SESSION_COACH_BRIDGE__) return;
  window.__SESSION_COACH_BRIDGE__ = true;

  const post = (type, payload) => {
    try {
      window.postMessage({
        source: "session-coach-bridge",
        type,
        payload,
        ts: Date.now()
      }, "*");
    } catch (error) {
      // ignored
    }
  };

  const parseJson = (value) => {
    if (typeof value !== "string") return value;
    const trimmed = value.trim();
    if (!trimmed) return value;
    if (!(trimmed.startsWith("{") || trimmed.startsWith("["))) return value;
    try {
      return JSON.parse(trimmed);
    } catch {
      return value;
    }
  };

  const NativeWebSocket = window.WebSocket;
  if (NativeWebSocket) {
    window.WebSocket = function SessionCoachWebSocket(url, protocols) {
      const socket = protocols ? new NativeWebSocket(url, protocols) : new NativeWebSocket(url);
      socket.addEventListener("message", (event) => {
        post("ws:message", {
          url,
          data: parseJson(event.data)
        });
      });
      const originalSend = socket.send;
      socket.send = function patchedSend(data) {
        post("ws:send", {
          url,
          data: parseJson(data)
        });
        return originalSend.call(this, data);
      };
      return socket;
    };
    window.WebSocket.prototype = NativeWebSocket.prototype;
    Object.setPrototypeOf(window.WebSocket, NativeWebSocket);
  }

  const originalFetch = window.fetch;
  if (originalFetch) {
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      try {
        const url = typeof args[0] === "string" ? args[0] : (args[0]?.url || "");
        const cloned = response.clone();
        const contentType = cloned.headers.get("content-type") || "";
        if (contentType.includes("application/json")) {
          cloned.json().then((data) => {
            post("fetch:json", { url, data });
          }).catch(() => {});
        }
      } catch {
        // ignored
      }
      return response;
    };
  }

  post("bridge:ready", { href: location.href });
})();
