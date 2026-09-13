/**
 * KeepIt Website — Shared app helpers
 * Loaded on every page that needs auth (login, dashboard, account).
 * Depends on: js/supabase.js (Supabase JS SDK), js/config.js (SUPABASE_CONFIG)
 */

const KeepItApp = (function () {
  let client = null;

  function getClient() {
    if (!client) {
      const cfg = window.SUPABASE_CONFIG;
      client = supabase.createClient(cfg.url, cfg.anonKey);
    }
    return client;
  }

  async function getSession() {
    const { data, error } = await getClient().auth.getSession();
    if (error) {
      console.warn('[KeepIt] getSession error', error);
      return null;
    }
    return data.session || null;
  }

  async function requireAuth() {
    const session = await getSession();
    if (!session) {
      window.location.href = 'login.html';
      return null;
    }
    return session;
  }

  async function signOut() {
    await getClient().auth.signOut();
    window.location.href = 'login.html';
  }

  function initials(nameOrEmail) {
    if (!nameOrEmail) return '?';
    const clean = nameOrEmail.trim();
    const parts = clean.split(/\s+/);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  }

  function displayName(user) {
    if (!user) return '';
    return (user.user_metadata && (user.user_metadata.full_name || user.user_metadata.name)) || user.email || 'Account';
  }

  function avatarUrl(user) {
    return (user && user.user_metadata && user.user_metadata.avatar_url) || null;
  }

  /** Renders the signed-in user chip + dropdown into a container element. */
  function renderUserMenu(containerEl, user) {
    if (!containerEl || !user) return;
    const name = displayName(user);
    const email = user.email || '';
    const avatar = avatarUrl(user);

    containerEl.innerHTML = `
      <div class="user-menu">
        <button class="user-chip" id="userChipBtn" type="button">
          ${avatar
            ? `<img class="user-avatar" src="${avatar}" alt="">`
            : `<span class="user-avatar">${initials(name)}</span>`}
          <span class="chip-label">${escapeHtml(name.split(' ')[0] || 'Account')}</span>
        </button>
        <div class="user-dropdown" id="userDropdown">
          <div class="dd-email">${escapeHtml(email)}</div>
          <a href="chrome-extension://mhldbdlepccoejdjnhogckbgijohddlg/dashboard.html" target="_blank" rel="noopener noreferrer" data-keepit-cta="dashboard">My sessions</a>
          <a href="account.html">Account &amp; billing</a>
          <a href="docs.html">Help &amp; docs</a>
          <button type="button" class="danger" id="signOutBtn">Sign out</button>
        </div>
      </div>
    `;

    const chip = containerEl.querySelector('#userChipBtn');
    const dropdown = containerEl.querySelector('#userDropdown');
    chip.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });
    document.addEventListener('click', () => dropdown.classList.remove('open'));
    containerEl.querySelector('#signOutBtn').addEventListener('click', signOut);
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (c) => ({
      '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    }[c]));
  }

  let toastTimer = null;
  function showToast(message) {
    let el = document.getElementById('kt-toast');
    if (!el) {
      el = document.createElement('div');
      el.id = 'kt-toast';
      el.className = 'toast';
      document.body.appendChild(el);
    }
    el.textContent = message;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 3200);
  }

  function timeAgo(dateInput) {
    const date = new Date(dateInput);
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    const map = [
      ['year', 31536000], ['month', 2592000], ['week', 604800],
      ['day', 86400], ['hour', 3600], ['minute', 60]
    ];
    for (const [unit, secs] of map) {
      const val = Math.floor(seconds / secs);
      if (val >= 1) return `${val} ${unit}${val > 1 ? 's' : ''} ago`;
    }
    return 'just now';
  }

  return {
    getClient, getSession, requireAuth, signOut,
    initials, displayName, avatarUrl, renderUserMenu,
    escapeHtml, showToast, timeAgo
  };
})();

// Cache the current session in a plain global as soon as it resolves. Used by
// js/extension-detect.js to hand the website's session to the extension when
// opening the dashboard — read synchronously at click time (not re-fetched
// via an await in the click handler itself, which would cause window.open()
// to be silently blocked as a pop-up).
KeepItApp.getSession().then((session) => { window.__keepitCachedSession = session; });
