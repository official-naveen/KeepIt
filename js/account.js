/**
 * KeepIt Website — Account & Billing
 * Calls the SAME Supabase Edge Functions the extension popup uses:
 *   POST /functions/v1/create-subscription   body: { billing_cycle }
 *   POST /functions/v1/cancel-subscription
 *   POST /functions/v1/refund-subscription
 */

(async function () {
  const client = KeepItApp.getClient();
  const session = await KeepItApp.requireAuth();
  if (!session) return;
  const user = session.user;
  const supabaseConfig = window.SUPABASE_CONFIG;

  let billingCycle = 'monthly';
  let subscription = null;

  const els = {
    userMenu: document.getElementById('userMenuContainer'),
    avatar: document.getElementById('profileAvatar'),
    name: document.getElementById('profileName'),
    email: document.getElementById('profileEmail'),
    statSessions: document.getElementById('statSessions'),
    statFolders: document.getElementById('statFolders'),
    planBadge: document.getElementById('planBadge'),
    planBody: document.getElementById('planBody'),
    signOutBtn: document.getElementById('accountSignOutBtn'),
  };

  KeepItApp.renderUserMenu(els.userMenu, user);
  renderProfile();
  els.signOutBtn.addEventListener('click', KeepItApp.signOut);

  await Promise.all([loadSubscription(), loadStats()]);
  renderPlanCard();

  function renderProfile() {
    const name = KeepItApp.displayName(user);
    const avatar = KeepItApp.avatarUrl(user);
    els.avatar.innerHTML = avatar
      ? `<img src="${avatar}" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover;">`
      : KeepItApp.initials(name);
    els.name.textContent = name;
    els.email.textContent = user.email || '';
  }

  async function loadStats() {
    try {
      const [{ count: sessionCount }, { data: folderRows }] = await Promise.all([
        client.from('sessions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        client.from('folders').select('id').eq('user_id', user.id),
      ]);
      els.statSessions.textContent = sessionCount ?? 0;
      els.statFolders.textContent = (folderRows || []).length;
    } catch (e) {
      console.warn('stats load failed', e);
    }
  }

  async function loadSubscription() {
    try {
      const { data } = await client
        .from('subscriptions')
        .select('is_premium, subscription_id, subscription_status, subscription_plan_id, subscription_ends_at')
        .eq('user_id', user.id)
        .maybeSingle();
      subscription = data || null;
      if (subscription && subscription.subscription_ends_at && new Date(subscription.subscription_ends_at) < new Date()) {
        subscription.is_premium = false;
      }
    } catch (e) {
      console.warn('subscription load failed', e);
    }
  }

  function renderPlanCard() {
    const isPremium = !!(subscription && subscription.is_premium);
    const isRefunded = !!(subscription && subscription.subscription_status === 'refunded');

    if (isRefunded) {
      els.planBadge.textContent = 'Refunded';
      els.planBadge.className = 'plan-badge';
      els.planBadge.style.background = 'rgba(16, 185, 129, 0.15)';
      els.planBadge.style.color = '#34d399';
      els.planBadge.style.border = '1px solid rgba(16, 185, 129, 0.3)';

      els.planBody.innerHTML = `
        <div style="background: rgba(16, 185, 129, 0.1); border: 1px solid rgba(16, 185, 129, 0.25); border-radius: var(--radius-md); padding: 16px; margin-bottom: 16px;">
          <h4 style="color: #34d399; font-size: 14.5px; font-weight: 700; margin-bottom: 6px; display: flex; align-items: center; gap: 6px;">
            <span>💸</span> 100% Refund Processed &amp; Issued
          </h4>
          <p style="color: var(--text-secondary); font-size: 13px; line-height: 1.5; margin: 0;">
            A full 100% refund was issued for your KeepIt Pro subscription via Razorpay. Funds will credit to your original payment method within <strong>5–7 working days</strong>.
          </p>
        </div>

        <div class="billing-row"><span class="k">Status</span><span class="v" style="color:#34d399;">Refunded (Full 100%)</span></div>
        <div class="billing-row"><span class="k">Subscription ID</span><span class="v" style="font-size:12px;">${KeepItApp.escapeHtml(subscription.subscription_id || '—')}</span></div>
        <div class="billing-row"><span class="k">Support Contact</span><span class="v" style="font-size:12px;"><a href="mailto:contact.naveen.work@gmail.com" style="color:#818cf8;">contact.naveen.work@gmail.com</a></span></div>

        <p style="color: var(--text-muted); font-size: 12.5px; margin-top: 16px;">
          Need to re-subscribe? Select a billing cycle below to upgrade back to KeepIt Pro anytime.
        </p>

        <div class="plan-toggle" id="billingToggle" style="margin-top: 12px;">
          <button type="button" class="active" data-cycle="monthly">Monthly</button>
          <button type="button" data-cycle="yearly">Yearly (save more)</button>
        </div>
        <button class="btn-cta-primary" id="upgradeBtn" type="button" style="width:100%; justify-content:center;">
          Re-Subscribe to Pro
        </button>
      `;

      document.querySelectorAll('#billingToggle button').forEach(btn => {
        btn.addEventListener('click', () => {
          billingCycle = btn.getAttribute('data-cycle');
          document.querySelectorAll('#billingToggle button').forEach(b => b.classList.toggle('active', b === btn));
        });
      });
      document.getElementById('upgradeBtn').addEventListener('click', handleUpgrade);
      return;
    }

    els.planBadge.textContent = isPremium ? 'Pro' : 'Free';
    els.planBadge.className = 'plan-badge ' + (isPremium ? 'pro' : 'free');

    if (isPremium) {
      const ends = subscription.subscription_ends_at
        ? new Date(subscription.subscription_ends_at).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
        : '—';
      const status = subscription.subscription_status || 'active';
      els.planBody.innerHTML = `
        <div class="billing-row"><span class="k">Status</span><span class="v" style="text-transform:capitalize;">${KeepItApp.escapeHtml(status)}</span></div>
        <div class="billing-row"><span class="k">Renews / ends</span><span class="v">${ends}</span></div>
        <div class="billing-row"><span class="k">Subscription ID</span><span class="v" style="font-size:12px;">${KeepItApp.escapeHtml(subscription.subscription_id || '—')}</span></div>
        <div class="modal-actions" style="justify-content:flex-start; margin-top:18px; flex-wrap:wrap;">
          <button class="btn-sm" id="cancelSubBtn" type="button">Cancel subscription</button>
          <button class="btn-sm danger" id="refundSubBtn" type="button">Request refund (within 7 days)</button>
        </div>
      `;
      document.getElementById('cancelSubBtn').addEventListener('click', handleCancel);
      document.getElementById('refundSubBtn').addEventListener('click', handleRefund);
    } else {
      els.planBody.innerHTML = `
        <p style="color:var(--text-secondary); font-size:14px; margin-bottom:16px;">
          Unlock unlimited folders, unlimited cloud sessions, and priority sync with KeepIt Pro.
        </p>
        <div class="plan-toggle" id="billingToggle">
          <button type="button" class="active" data-cycle="monthly">Monthly</button>
          <button type="button" data-cycle="yearly">Yearly (save more)</button>
        </div>
        <button class="btn-cta-primary" id="upgradeBtn" type="button" style="width:100%; justify-content:center;">
          Upgrade to Pro
        </button>
      `;
      document.querySelectorAll('#billingToggle button').forEach(btn => {
        btn.addEventListener('click', () => {
          billingCycle = btn.getAttribute('data-cycle');
          document.querySelectorAll('#billingToggle button').forEach(b => b.classList.toggle('active', b === btn));
        });
      });
      document.getElementById('upgradeBtn').addEventListener('click', handleUpgrade);
    }
  }

  async function callEdgeFunction(name, body) {
    const { data: { session: freshSession } } = await client.auth.getSession();
    if (!freshSession || !freshSession.access_token) {
      throw new Error('Your session expired. Please sign in again.');
    }
    const res = await fetch(`${supabaseConfig.url}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${freshSession.access_token}`,
        'Content-Type': 'application/json'
      },
      body: body ? JSON.stringify(body) : undefined
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || `Request to ${name} failed.`);
    return data;
  }

  async function handleUpgrade() {
    const btn = document.getElementById('upgradeBtn');
    btn.disabled = true;
    btn.textContent = 'Opening checkout…';
    try {
      const data = await callEdgeFunction('create-subscription', { billing_cycle: billingCycle });
      if (!data.short_url) throw new Error('Could not create checkout link.');
      KeepItApp.showToast('Opening Razorpay checkout in a new tab…');
      window.open(data.short_url, '_blank');
    } catch (err) {
      KeepItApp.showToast(err.message || 'Could not start checkout.');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Upgrade to Pro';
    }
  }

  async function handleCancel() {
    if (!window.confirm('Cancel your KeepIt Pro subscription? You\'ll keep Pro access until the end of the current billing cycle.')) return;
    const btn = document.getElementById('cancelSubBtn');
    btn.disabled = true;
    btn.textContent = 'Cancelling…';
    try {
      await callEdgeFunction('cancel-subscription');
      KeepItApp.showToast('Subscription set to cancel at the end of this cycle.');
      await loadSubscription();
      renderPlanCard();
    } catch (err) {
      KeepItApp.showToast(err.message || 'Could not cancel subscription.');
      btn.disabled = false;
      btn.textContent = 'Cancel subscription';
    }
  }

  async function handleRefund() {
    if (!window.confirm('Request a full refund? Under the KeepIt Terms of Service, refunds are available within 7 calendar days of purchase and Pro access will be revoked immediately if approved.')) return;
    const btn = document.getElementById('refundSubBtn');
    btn.disabled = true;
    btn.textContent = 'Processing…';
    try {
      const data = await callEdgeFunction('refund-subscription');
      window.alert(
        'Refund issued.\n\n' +
        'Funds will be credited to your original payment method within 5–7 working days.\n' +
        `Reference subscription ID: ${(subscription && subscription.subscription_id) || 'N/A'}`
      );
      await loadSubscription();
      renderPlanCard();
    } catch (err) {
      KeepItApp.showToast(err.message || 'Could not process refund.');
      btn.disabled = false;
      btn.textContent = 'Request refund (within 7 days)';
    }
  }
})();
