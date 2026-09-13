/**
 * KeepIt Website — Production-grade Extension Detection
 *
 * Detection mechanisms:
 *
 * 1. Web-accessible-resource probe:
 *    Attempts to fetch:
 *      chrome-extension://<EXTENSION_ID>/dashboard.html
 *
 * 2. Runtime postMessage handshake:
 *    Sends:
 *      { type: "CHECK_MY_EXTENSION", requestId }
 *
 *    Expected response:
 *      {
 *        type: "MY_EXTENSION_PRESENT",
 *        version: "1.2.3",
 *        requestId: "..."
 *      }
 *
 * The two mechanisms run independently.
 * A positive result from either mechanism marks the extension as installed.
 *
 * CTA behavior:
 *
 * - data-keepit-cta="install"
 *   Changes the install button into a dashboard link once the extension
 *   is detected.
 *
 * - data-keepit-cta="dashboard"
 *   Opens the extension dashboard when installed.
 *   Otherwise opens the Chrome Web Store listing.
 *
 * Important:
 * Click handling is always synchronous so window.open() retains the
 * browser's user-gesture permission and is not blocked as a popup.
 */

(function () {
  "use strict";

  /*
   * --------------------------------------------------------------------------
   * Configuration
   * --------------------------------------------------------------------------
   */

  const DASHBOARD_PROBE_TIMEOUT_MS = 1500;
  const HANDSHAKE_TIMEOUT_MS = 2000;

  /*
   * --------------------------------------------------------------------------
   * Small utility helpers
   * --------------------------------------------------------------------------
   */

  function getExtensionId() {
    const value = window.KEEPIT_EXTENSION_ID;

    if (typeof value !== "string") {
      return null;
    }

    const id = value.trim();

    return id || null;
  }

  function getStoreUrl() {
    const value = window.KEEPIT_CHROME_WEBSTORE_URL;

    if (typeof value !== "string") {
      return null;
    }

    const url = value.trim();

    return url || null;
  }

  function withTimeout(promise, timeoutMs) {
    let timer = null;

    const timeoutPromise = new Promise((_, reject) => {
      timer = window.setTimeout(() => {
        reject(new Error("Operation timed out."));
      }, timeoutMs);
    });

    return Promise.race([promise, timeoutPromise]).finally(() => {
      if (timer !== null) {
        clearTimeout(timer);
      }
    });
  }

  function createRequestId() {
    try {
      if (
        window.crypto &&
        typeof window.crypto.randomUUID === "function"
      ) {
        return window.crypto.randomUUID();
      }
    } catch (_) {
      // Ignore crypto failures and use the fallback below.
    }

    return [
      "keepit",
      Date.now().toString(36),
      Math.random().toString(36).slice(2),
    ].join("-");
  }

  /*
   * --------------------------------------------------------------------------
   * Extension detection — web accessible resource
   * --------------------------------------------------------------------------
   */

  async function checkExtensionInstalled() {
    const id = getExtensionId();

    if (!id) {
      return false;
    }

    const resourceUrl = `chrome-extension://${id}/dashboard.html`;

    try {
      const response = await withTimeout(
        fetch(resourceUrl, {
          method: "GET",
          cache: "no-store",
          credentials: "omit",
        }),
        DASHBOARD_PROBE_TIMEOUT_MS
      );

      return Boolean(response && response.ok);
    } catch (_) {
      return false;
    }
  }

  /*
   * --------------------------------------------------------------------------
   * Extension detection — runtime postMessage handshake
   * --------------------------------------------------------------------------
   */

  function isValidHandshakeResponse(data, requestId) {
    if (!data || typeof data !== "object") {
      return false;
    }

    if (data.type !== "MY_EXTENSION_PRESENT") {
      return false;
    }

    /*
     * Backward compatibility:
     *
     * If requestId is included by the extension, it MUST match.
     *
     * If requestId is omitted, accept the response so older versions of
     * the extension can still work.
     */
    if (
      Object.prototype.hasOwnProperty.call(data, "requestId") &&
      data.requestId !== requestId
    ) {
      return false;
    }

    return true;
  }

  function checkExtensionViaHandshake() {
    return new Promise((resolve) => {
      const requestId = createRequestId();

      let settled = false;
      let timer = null;

      function cleanup() {
        window.removeEventListener("message", handleMessage);

        if (timer !== null) {
          window.clearTimeout(timer);
          timer = null;
        }
      }

      function finish(detected, version) {
        if (settled) {
          return;
        }

        settled = true;

        cleanup();

        resolve({
          detected: detected === true,
          version:
            typeof version === "string" && version.trim()
              ? version.trim()
              : null,
        });
      }

      function handleMessage(event) {
        /*
         * Only accept events originating from this page/window.
         *
         * This blocks messages coming from iframes or other windows.
         */
        if (event.source !== window) {
          return;
        }

        const data = event.data;

        if (!isValidHandshakeResponse(data, requestId)) {
          return;
        }

        console.info(
          "KeepIt extension detected via runtime handshake.",
          {
            version: data.version || "unknown",
          }
        );

        finish(true, data.version);
      }

      window.addEventListener("message", handleMessage);

      try {
        /*
         * Use this document's exact origin instead of "*".
         *
         * The extension bridge should receive the message because it is
         * running in the same page context.
         */
        window.postMessage(
          {
            type: "CHECK_MY_EXTENSION",
            requestId: requestId,
          },
          window.location.origin
        );
      } catch (error) {
        console.warn(
          "KeepIt extension handshake could not be sent.",
          error
        );

        finish(false, null);
        return;
      }

      timer = window.setTimeout(() => {
        finish(false, null);
      }, HANDSHAKE_TIMEOUT_MS);
    });
  }

  /*
   * --------------------------------------------------------------------------
   * Installation state
   * --------------------------------------------------------------------------
   *
   * null  = detection still running
   * true  = extension detected
   * false = extension not detected
   */

  let installedStatus = null;

  let installCtasUpgraded = false;

  /*
   * --------------------------------------------------------------------------
   * Upgrade installation CTAs
   * --------------------------------------------------------------------------
   */

  function upgradeInstallCtas() {
    if (installCtasUpgraded) {
      /*
       * Still allow dynamically-created buttons below to be upgraded.
       * We intentionally do NOT return here.
       */
    }

    const id = getExtensionId();

    if (!id) {
      return;
    }

    const dashboardUrl =
      `chrome-extension://${id}/dashboard.html`;

    const elements = document.querySelectorAll(
      '[data-keepit-cta="install"]'
    );

    elements.forEach((element) => {
      /*
       * Only modify actual elements.
       */
      if (!(element instanceof HTMLAnchorElement)) {
        return;
      }

      element.href = dashboardUrl;
      element.target = "_blank";
      element.rel = "noopener noreferrer";

      const installedLabel =
        element.getAttribute("data-installed-label");

      if (installedLabel) {
        /*
         * Remove only text nodes.
         *
         * Icons/SVGs/other child elements are preserved.
         */
        Array.from(element.childNodes).forEach((node) => {
          if (node.nodeType === Node.TEXT_NODE) {
            node.remove();
          }
        });

        element.appendChild(
          document.createTextNode(installedLabel)
        );
      }

      element.setAttribute(
        "data-keepit-cta",
        "installed"
      );
    });

    installCtasUpgraded = true;
  }

  /*
   * --------------------------------------------------------------------------
   * Dashboard URL builder
   * --------------------------------------------------------------------------
   */

  function buildDashboardUrl(id) {
    if (!id) {
      return null;
    }

    const base =
      `chrome-extension://${id}/dashboard.html`;

    /*
     * Read the cached website session synchronously.
     *
     * IMPORTANT:
     * Do not fetch/await anything here.
     *
     * This function may be called directly from a click event and the
     * resulting window.open() needs to retain the browser's user gesture.
     */
    const session = window.__keepitCachedSession;

    if (
      session &&
      typeof session === "object" &&
      typeof session.access_token === "string" &&
      typeof session.refresh_token === "string" &&
      session.access_token &&
      session.refresh_token
    ) {
      try {
        const params = new URLSearchParams({
          access_token: session.access_token,
          refresh_token: session.refresh_token,
        });

        return `${base}#${params.toString()}`;
      } catch (error) {
        console.warn(
          "KeepIt could not build the authenticated dashboard URL.",
          error
        );
      }
    }

    return base;
  }

  /*
   * --------------------------------------------------------------------------
   * Open URL safely from a user gesture
   * --------------------------------------------------------------------------
   */

  function openUrl(url) {
    if (!url) {
      return false;
    }

    try {
      const popup = window.open(
        url,
        "_blank",
        "noopener,noreferrer"
      );

      /*
       * window.open() may return null when blocked.
       */
      if (!popup) {
        console.warn(
          "KeepIt popup was blocked by the browser."
        );

        return false;
      }

      try {
        popup.opener = null;
      } catch (_) {
        // Ignore browsers where opener cannot be modified.
      }

      return true;
    } catch (error) {
      console.warn(
        "KeepIt could not open the requested URL.",
        error
      );

      return false;
    }
  }

  /*
   * --------------------------------------------------------------------------
   * Proactive detection
   * --------------------------------------------------------------------------
   */

  const installedPromise = checkExtensionInstalled()
    .then((result) => {
      /*
       * Only mark false if no other mechanism has already positively
       * confirmed the extension.
       */
      if (result === true) {
        installedStatus = true;
        upgradeInstallCtas();
      } else if (installedStatus !== true) {
        installedStatus = false;
      }

      return result;
    })
    .catch(() => {
      if (installedStatus !== true) {
        installedStatus = false;
      }

      return false;
    });

  /*
   * Start the runtime handshake independently.
   *
   * If the handshake succeeds, it wins immediately.
   */
  const handshakePromise = checkExtensionViaHandshake()
    .then(({ detected, version }) => {
      if (!detected) {
        return false;
      }

      installedStatus = true;

      if (version) {
        window.KEEPIT_EXTENSION_VERSION = version;
      }

      upgradeInstallCtas();

      return true;
    })
    .catch((error) => {
      console.warn(
        "KeepIt runtime handshake failed.",
        error
      );

      return false;
    });

  /*
   * --------------------------------------------------------------------------
   * Optional combined completion hook
   * --------------------------------------------------------------------------
   *
   * This does not block the UI and does not affect click handling.
   */

  Promise.allSettled([
    installedPromise,
    handshakePromise,
  ]).then(() => {
    /*
     * If neither mechanism detected the extension, preserve false.
     *
     * If either mechanism detected it, status remains true.
     */
    if (installedStatus !== true) {
      installedStatus = false;
    }

    if (installedStatus === true) {
      upgradeInstallCtas();
    }
  });

  /*
   * --------------------------------------------------------------------------
   * Handle install CTA clicks
   * --------------------------------------------------------------------------
   *
   * Uses event delegation so dynamically-rendered buttons work too.
   */

  document.addEventListener(
    "click",
    (event) => {
      const target = event.target;

      if (!(target instanceof Element)) {
        return;
      }

      const element = target.closest(
        '[data-keepit-cta="dashboard"]'
      );

      if (!element) {
        return;
      }

      /*
       * Stop the browser from following the original href.
       */
      event.preventDefault();

      const storeUrl = getStoreUrl();
      const id = getExtensionId();

      const dashboardUrl = id
        ? buildDashboardUrl(id)
        : null;

      /*
       * ------------------------------------------------------------
       * Extension confirmed installed
       * ------------------------------------------------------------
       */

      if (
        installedStatus === true &&
        dashboardUrl
      ) {
        openUrl(dashboardUrl);
        return;
      }

      /*
       * ------------------------------------------------------------
       * Extension confirmed not installed
       * ------------------------------------------------------------
       */

      if (installedStatus === false) {
        if (storeUrl) {
          openUrl(storeUrl);
        } else {
          console.warn(
            "KeepIt Chrome Web Store URL is not configured."
          );
        }

        return;
      }

      /*
       * ------------------------------------------------------------
       * Detection is still pending
       * ------------------------------------------------------------
       *
       * IMPORTANT:
       *
       * Do NOT await the detection promise here.
       *
       * Doing so would move window.open() outside the original click
       * event and Chrome may block it as a popup.
       *
       * We therefore open the best known destination synchronously.
       */

      openUrl(
        dashboardUrl || storeUrl
      );
    },
    false
  );

  /*
   * --------------------------------------------------------------------------
   * Dynamic DOM support
   * --------------------------------------------------------------------------
   *
   * CTAs can be inserted after this script loads.
   *
   * MutationObserver upgrades newly-added install CTAs whenever the extension
   * has already been detected.
   */

  if (
    typeof MutationObserver === "function"
  ) {
    const observer = new MutationObserver(() => {
      if (installedStatus === true) {
        upgradeInstallCtas();
      }
    });

    try {
      observer.observe(document.documentElement, {
        childList: true,
        subtree: true,
      });
    } catch (error) {
      console.warn(
        "KeepIt CTA observer could not be started.",
        error
      );
    }
  }

  /*
   * --------------------------------------------------------------------------
   * Public status helpers
   * --------------------------------------------------------------------------
   *
   * These are intentionally read-only helpers for debugging/integration.
   */

  window.keepItExtensionDetection = Object.freeze({
    isInstalled: function () {
      return installedStatus === true;
    },

    getStatus: function () {
      return installedStatus;
    },

    getVersion: function () {
      return (
        typeof window.KEEPIT_EXTENSION_VERSION === "string"
          ? window.KEEPIT_EXTENSION_VERSION
          : null
      );
    },
  });
})();