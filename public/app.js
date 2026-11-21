// Bumbledry PRO - Smart Laundry Operations Client Logic
// Dual Mode Architecture: Automatically connects to Node.js backend when running locally,
// or runs seamlessly in Client-Side Demo Mode on GitHub Pages using in-browser storage.

let currentPersona = 'admin';
let currentManagerTab = 'leads';
let currentRiderMode = 'pickup';
let currentLeadsFilter = 'active';
let activeWasherMobileStage = 'all';

let allOrders = [];
let allLeads = [];
let allRiders = [];
let catalog = [];
let statsData = {};
let selectedCustomer = null;
let currentNewOrderItems = [];
let isStaticMode = false;
let currentAdminTableTab = 'orders';
let activePickupOrderId = null;
let activeDeliveryOrderId = null;
let activePodImageData = null;
let activeAdminPodOrderId = null;
let activeReadyNotificationOrderId = null;

// Mock database for GitHub Pages Standalone Demo
let mockDb = {
  customers: [],
  orders: [],
  leads: [],
  garmentsCatalog: [],
  storeSettings: {
    storeName: 'Bumbledry Laundry & Dry Cleaners',
    phone: '+91 98765 43210',
    address: 'Shop 4B, Main Market, Sector 15, Gurugram, Haryana',
    gstin: '06AAAAA0000A1Z5',
    expressSurchargePercent: 50,
    freePickupThreshold: 299
  },
  riders: []
};

// -----------------------------------------------------------------
// INITIALIZATION & MODE DETECTION
// -----------------------------------------------------------------
document.addEventListener('DOMContentLoaded', async () => {
  updateClock();
  setInterval(updateClock, 1000);

  initFranchiseStores();
  updateStoreHeaderDisplay();
  initNotifications();
  await detectModeAndInit();
  initAuth();
  await refreshAll();

  // Multi-user Real-time Auto-Sync every 4 seconds
  setInterval(async () => {
    if (!document.hidden) {
      await refreshAll();
    }
  }, 4000);

  // Multi-tab sync for Standalone Demo Mode & Live Handover Notifications
  window.addEventListener('storage', async (e) => {
    if (e.key === 'superdry_demo_state') {
      const saved = localStorage.getItem('superdry_demo_state');
      if (saved) {
        try {
          mockDb = JSON.parse(saved);
          await refreshAll();
        } catch (err) {}
      }
    } else if (e.key === 'bumbledry_last_broadcast_notif') {
      try {
        const notif = JSON.parse(e.newValue);
        if (notif) {
          liveNotifications.unshift(notif);
          updateNotificationBadge();
          renderNotificationCenter();
          showToastNotification(notif, true);
        }
      } catch (err) {}
    }
  });

  lucide.createIcons();
});

function updateClock() {
  const el = document.getElementById('live-clock');
  if (el) {
    el.innerText = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  }
}

async function detectModeAndInit() {
  try {
    const test = await fetch('/api/stats');
    if (test.ok) {
      isStaticMode = false;
      await fetchCatalog();
      return;
    }
  } catch (err) {
    // Backend unreachable -> activate GitHub Pages client mode
  }

  isStaticMode = true;
  console.log('Bumbledry PRO: Running in Standalone Client Demo Mode (GitHub Pages)');

  // Try loading saved state from browser localStorage
  const savedState = localStorage.getItem('superdry_demo_state');
  if (savedState) {
    try {
      mockDb = JSON.parse(savedState);
    } catch (e) {
      console.warn('Failed parsing saved demo state, loading defaults');
    }
  }

  // If no customers or state yet, load static JSON files
  if (!mockDb.customers || mockDb.customers.length === 0) {
    try {
      const [custRes, stateRes] = await Promise.all([
        fetch('./data/customers.json'),
        fetch('./data/initial_state.json')
      ]);
      mockDb.customers = await custRes.json();
      const initState = await stateRes.json();
      mockDb.orders = initState.orders || [];
      mockDb.leads = initState.leads || [];
      mockDb.garmentsCatalog = initState.garmentsCatalog || [];
      mockDb.storeSettings = initState.storeSettings || mockDb.storeSettings;
      initDefaultRiders();
      saveDemoState();
    } catch (err) {
      console.warn('Fallback: loading embedded demo datasets');
      initDefaultRiders();
    }
  } else if (!mockDb.riders || mockDb.riders.length === 0) {
    initDefaultRiders();
  }

  catalog = mockDb.garmentsCatalog;
  populateCatalogDropdown();

  // Show Demo Mode Indicator
  const roleLabel = document.getElementById('role-context-label');
  if (roleLabel) {
    roleLabel.innerHTML = `${roleLabel.innerText} <span class="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1">GitHub Pages Demo</span>`;
  }
}

function initDefaultRiders() {
  mockDb.riders = [
    {
      id: 'RIDER-01',
      name: 'Rajesh Kumar',
      phone: '+91 9811882233',
      vehicle: 'Honda Activa (HR26-BW-4821)',
      status: 'RETURNING_TO_STORE',
      currentRun: {
        id: 'RUN-201',
        zone: 'Sector 14 - North',
        orderIds: ['ORD-1040', 'ORD-1041'],
        totalOrders: 2,
        dispatchedAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
        allDeliveredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(),
        expectedReturnAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(),
        returnDistanceKm: 3.8,
        normalReturnMins: 12,
        unaccountedGapMinutes: 13,
        isOverdue: true
      },
      location: {
        lat: 28.4740,
        lng: 77.0425,
        address: 'Near Old Railway Road, 3.8 km from Store',
        speedKmh: 0,
        batteryLevel: '74%',
        lastPingAt: new Date().toISOString()
      },
      todayStats: {
        completedRuns: 3,
        onTimeRuns: 2,
        delayedReturns: 1,
        totalUnaccountedGapMins: 26,
        integrityScore: 78
      }
    },
    {
      id: 'RIDER-02',
      name: 'Amit Singh',
      phone: '+91 9822993344',
      vehicle: 'TVS Jupiter (HR26-DE-1190)',
      status: 'IDLE_AT_STORE',
      currentRun: null,
      location: {
        lat: 28.4595,
        lng: 77.0266,
        address: 'At Store (Sector 15 Market Counter)',
        speedKmh: 0,
        batteryLevel: '92%',
        lastPingAt: new Date().toISOString()
      },
      todayStats: {
        completedRuns: 4,
        onTimeRuns: 4,
        delayedReturns: 0,
        totalUnaccountedGapMins: 0,
        integrityScore: 98
      }
    }
  ];
}

function saveDemoState() {
  if (isStaticMode) {
    try {
      localStorage.setItem('superdry_demo_state', JSON.stringify(mockDb));
    } catch (e) {
      console.warn('LocalStorage limit reached or disabled');
    }
  }
}

// -----------------------------------------------------------------
// AUTHENTICATION & ROLE-BASED ACCESS CONTROL (RBAC)
// -----------------------------------------------------------------
const AUTH_USERS = [
  {
    username: 'admin',
    password: 'admin123',
    role: 'admin',
    name: 'Deepak Verma',
    shortRole: 'Admin',
    title: 'Super Admin',
    iconName: 'shield-check',
    scope: 'Central Operations'
  },
  {
    username: 'manager',
    password: 'manager123',
    role: 'manager',
    name: 'Aakash Sharma',
    shortRole: 'Manager',
    title: 'Store Manager',
    iconName: 'clipboard-list',
    scope: 'Front Desk & Dispatch'
  },
  {
    username: 'washer',
    password: 'washer123',
    role: 'washer',
    name: 'Ramesh Singh',
    shortRole: 'Workshop',
    title: 'Workshop Master',
    iconName: 'shirt',
    scope: 'Washing & Ironing'
  },
  {
    username: 'rider',
    password: 'rider123',
    role: 'rider',
    name: 'Rajesh Kumar',
    shortRole: 'Rider',
    title: 'Field Agent',
    iconName: 'bike',
    scope: 'Delivery & Pickups'
  }
];

let currentUser = null;

function initAuth() {
  const saved = localStorage.getItem('bumbledry_auth_user') || localStorage.getItem('tumbledry_auth_user');
  if (saved) {
    try {
      const parsed = JSON.parse(saved);
      const matched = AUTH_USERS.find(u => u.username.toLowerCase() === parsed.username.toLowerCase());
      if (matched) {
        authenticateSuccess(matched, false);
        return;
      }
    } catch (e) {}
  }
  showLoginView();
}

function showLoginView() {
  currentUser = null;
  const authView = document.getElementById('auth-view');
  const appView = document.getElementById('authenticated-app-view');
  if (authView) authView.classList.remove('hidden');
  if (appView) appView.classList.add('hidden');

  const err = document.getElementById('auth-error');
  if (err) err.classList.add('hidden');
  const pass = document.getElementById('login-password');
  if (pass) pass.value = '';
}

function handleLoginSubmit(e) {
  if (e) e.preventDefault();
  const uInput = document.getElementById('login-username');
  const pInput = document.getElementById('login-password');
  const username = (uInput ? uInput.value : '').trim().toLowerCase();
  const password = (pInput ? pInput.value : '').trim();

  const user = AUTH_USERS.find(u => u.username.toLowerCase() === username && u.password === password);
  if (!user) {
    showAuthError('Invalid username or password. Check test credentials below.');
    return;
  }

  authenticateSuccess(user, true);
}

function quickLogin(username, password) {
  selectTestCredential(username, password);
}

function openTestCredentialsModal() {
  const modal = document.getElementById('modal-test-credentials');
  if (modal) {
    modal.classList.remove('hidden');
    if (window.lucide) lucide.createIcons();
  }
}

function closeTestCredentialsModal() {
  const modal = document.getElementById('modal-test-credentials');
  if (modal) modal.classList.add('hidden');
}

function toggleTestCredentialsModal() {
  const modal = document.getElementById('modal-test-credentials');
  if (!modal) return;
  if (modal.classList.contains('hidden')) {
    openTestCredentialsModal();
  } else {
    closeTestCredentialsModal();
  }
}

function selectTestCredential(username, password) {
  closeTestCredentialsModal();
  const uInput = document.getElementById('login-username');
  const pInput = document.getElementById('login-password');
  if (uInput) uInput.value = username;
  if (pInput) pInput.value = password;

  const user = AUTH_USERS.find(u => u.username.toLowerCase() === username.toLowerCase() && u.password === password);
  if (user) {
    authenticateSuccess(user, true);
  }
}

// Global Keyboard Shortcut: ⌘ + Return (Mac) / Ctrl + Enter (Win/Linux) pops test credentials
window.addEventListener('keydown', (e) => {
  if ((e.metaKey || e.ctrlKey) && (e.key === 'Enter' || e.keyCode === 13)) {
    // Only intercept or toggle when in auth view or when test credentials requested
    const authView = document.getElementById('auth-view');
    if (authView && !authView.classList.contains('hidden')) {
      e.preventDefault();
      toggleTestCredentialsModal();
    }
  } else if (e.key === 'Escape' || e.keyCode === 27) {
    closeTestCredentialsModal();
  }
});

// Close modal when clicking on the backdrop
document.addEventListener('DOMContentLoaded', () => {
  const modal = document.getElementById('modal-test-credentials');
  if (modal) {
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeTestCredentialsModal();
      }
    });
  }
});

function showAuthError(msg) {
  const err = document.getElementById('auth-error');
  const txt = document.getElementById('auth-error-text');
  if (err && txt) {
    txt.innerText = msg;
    err.classList.remove('hidden');
  }
}

function authenticateSuccess(user, persist = true) {
  currentUser = user;
  if (persist) {
    localStorage.setItem('bumbledry_auth_user', JSON.stringify(user));
  }

  const authView = document.getElementById('auth-view');
  const appView = document.getElementById('authenticated-app-view');
  if (authView) authView.classList.add('hidden');
  if (appView) appView.classList.remove('hidden');

  // Update Header User Profile Pill with Monochromatic Icons & Clean Spacing
  const iconEl = document.getElementById('current-user-icon');
  const nameEl = document.getElementById('current-user-name');
  const badgeEl = document.getElementById('current-user-role-badge');
  const scopeEl = document.getElementById('current-user-scope');

  if (iconEl) iconEl.innerHTML = `<i data-lucide="${user.iconName || 'user'}" class="w-3 h-3 sm:w-3.5 sm:h-3.5"></i>`;
  if (nameEl) nameEl.innerText = user.name;
  if (badgeEl) badgeEl.innerText = user.shortRole || user.title;
  if (scopeEl) scopeEl.innerText = user.scope;

  applyUserScreenVisibility(user.role);
  renderActiveScreen();
  lucide.createIcons();
}

function logoutUser() {
  localStorage.removeItem('bumbledry_auth_user');
  localStorage.removeItem('tumbledry_auth_user');
  showLoginView();
  lucide.createIcons();
}

function applyUserScreenVisibility(role) {
  currentPersona = role;

  // Hide all screens
  document.querySelectorAll('.persona-screen').forEach(s => s.classList.add('hidden'));

  // Show ONLY relevant screen
  const targetScreen = document.getElementById(`screen-${role}`);
  if (targetScreen) {
    targetScreen.classList.remove('hidden');
  }

  // Admin station monitor visibility
  const adminMonitor = document.getElementById('admin-station-monitor');
  if (adminMonitor) {
    if (currentUser && currentUser.role === 'admin') {
      adminMonitor.classList.remove('hidden');
      updateAdminMonitorTabs(role);
    } else {
      adminMonitor.classList.add('hidden');
    }
  }

  // Admin inspector return bars on non-admin screens
  ['manager', 'washer', 'rider'].forEach(station => {
    const bar = document.getElementById(`admin-return-bar-${station}`);
    if (bar) {
      if (currentUser && currentUser.role === 'admin' && role === station) {
        bar.classList.remove('hidden');
      } else {
        bar.classList.add('hidden');
      }
    }
  });

  // Update Status Strip with Monochromatic Icon (No Emoji)
  const roleEl = document.getElementById('role-context-label');
  if (roleEl && currentUser) {
    roleEl.innerHTML = `<span class="inline-flex items-center space-x-1.5"><i data-lucide="${currentUser.iconName || 'user'}" class="w-3.5 h-3.5 text-[#1E3304] inline"></i><span class="font-bold text-[#1E3304]">${currentUser.title}</span> <span class="text-[#898989] font-normal hidden sm:inline">(${currentUser.name})</span></span>`;
    if (isStaticMode) {
      roleEl.innerHTML += ` <span class="bg-[#EEF4E3] text-[#1E3304] text-[10px] px-2 py-0.5 rounded-full font-bold ml-1 border border-[#D8ECAB]">Standalone Mode</span>`;
    }
  }
}

function adminSwitchView(targetRole) {
  if (!currentUser || currentUser.role !== 'admin') return;
  applyUserScreenVisibility(targetRole);
  renderActiveScreen();
  lucide.createIcons();
}

function updateAdminMonitorTabs(activeRole) {
  const iconMap = {
    admin: 'shield-check',
    manager: 'clipboard-list',
    washer: 'shirt',
    rider: 'bike'
  };
  const labelMap = {
    admin: 'Admin Overview',
    manager: 'Front Desk',
    washer: 'Workshop',
    rider: 'Field Agent'
  };
  ['admin', 'manager', 'washer', 'rider'].forEach(r => {
    const btn = document.getElementById(`admin-tab-${r}`);
    if (!btn) return;
    btn.innerHTML = `<i data-lucide="${iconMap[r]}" class="w-3.5 h-3.5"></i><span>${labelMap[r]}</span>`;
    if (r === activeRole) {
      btn.className = 'px-3 py-1.5 rounded-full text-xs font-bold bg-[#A6CE39] text-[#1E3304] shadow-xs flex items-center space-x-1 whitespace-nowrap';
    } else {
      btn.className = 'px-3 py-1.5 rounded-full text-xs font-medium text-[#545454] hover:text-[#1E293B] hover:bg-[#EEF4E3] flex items-center space-x-1 whitespace-nowrap';
    }
  });
  lucide.createIcons();
}

function setPersona(persona) {
  if (currentUser && currentUser.role === 'admin') {
    adminSwitchView(persona);
  } else if (currentUser) {
    applyUserScreenVisibility(currentUser.role);
  }
}

function setManagerTab(tab) {
  currentManagerTab = tab;
  ['leads', 'tagging', 'customers'].forEach(t => {
    const btn = document.getElementById(`mtab-${t}`);
    const view = document.getElementById(`manager-view-${t}`);
    if (!btn || !view) return;
    if (t === tab) {
      btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#1E3304] text-[#A6CE39] shadow-sm flex items-center space-x-1.5 shrink-0 whitespace-nowrap transition-all';
      view.classList.remove('hidden');
    } else {
      btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-medium text-[#545454] hover:text-[#1E293B] flex items-center space-x-1.5 shrink-0 whitespace-nowrap transition-all';
      view.classList.add('hidden');
    }
  });

  if (tab === 'leads') {
    renderManagerLeads();
  } else if (tab === 'tagging') {
    renderManagerTagging();
  } else if (tab === 'customers') {
    const q = document.getElementById('cust-search-input')?.value || '';
    searchCustomers(q);
  }
  lucide.createIcons();
}

function setRiderMode(mode) {
  currentRiderMode = mode;
  const pBtn = document.getElementById('rider-tab-pickup');
  const dBtn = document.getElementById('rider-tab-delivery');
  const pView = document.getElementById('rider-view-pickup');
  const dView = document.getElementById('rider-view-delivery');

  if (mode === 'pickup') {
    pBtn.className = 'py-2 rounded-full bg-[#A6CE39] text-[#1E3304] shadow transition-all flex items-center justify-center space-x-1.5 font-bold';
    dBtn.className = 'py-2 rounded-full text-neutral-400 hover:text-white transition-all flex items-center justify-center space-x-1.5 font-medium';
    pView.classList.remove('hidden');
    dView.classList.add('hidden');
  } else {
    dBtn.className = 'py-2 rounded-full bg-[#A6CE39] text-[#1E3304] shadow transition-all flex items-center justify-center space-x-1.5 font-bold';
    pBtn.className = 'py-2 rounded-full text-neutral-400 hover:text-white transition-all flex items-center justify-center space-x-1.5 font-medium';
    dView.classList.remove('hidden');
    pView.classList.add('hidden');
  }
  renderRiderScreen();
  lucide.createIcons();
}

// -----------------------------------------------------------------
// DATA FETCHING & SYNCHRONIZATION
// -----------------------------------------------------------------
async function refreshAll() {
  await Promise.all([
    fetchStats(),
    fetchOrders(),
    fetchLeads(),
    fetchFleet()
  ]);
  renderActiveScreen();
}

async function fetchCatalog() {
  if (isStaticMode) {
    catalog = mockDb.garmentsCatalog;
    populateCatalogDropdown();
    return;
  }
  try {
    const res = await fetch('/api/catalog');
    catalog = await res.json();
    populateCatalogDropdown();
  } catch (err) {
    console.error('Error fetching catalog:', err);
  }
}

async function fetchStats() {
  if (isStaticMode) {
    const orders = mockDb.orders || [];
    const totalRevenue = orders.filter(o => o.paymentStatus === 'PAID').reduce((sum, o) => sum + o.subtotal, 0);
    const pendingCollection = orders.filter(o => o.paymentStatus !== 'PAID').reduce((sum, o) => sum + o.subtotal, 0);
    const activeOrdersCount = orders.filter(o => o.status !== 'DELIVERED').length;
    const completedOrdersCount = orders.filter(o => o.status === 'DELIVERED').length;
    const pendingLeads = (mockDb.leads || []).filter(l => l.status !== 'RESOLVED' && l.status !== 'ARCHIVED').length;

    const stageCounts = {
      PICKUP_REQUESTED: orders.filter(o => o.status === 'PICKUP_REQUESTED').length,
      PICKED_UP: orders.filter(o => o.status === 'PICKED_UP').length,
      RECEIVED_IN_STORE: orders.filter(o => o.status === 'RECEIVED_IN_STORE').length,
      WASHING: orders.filter(o => o.status === 'WASHING').length,
      DRYING: orders.filter(o => o.status === 'DRYING').length,
      IRONING: orders.filter(o => o.status === 'IRONING').length,
      PACKED: orders.filter(o => o.status === 'PACKED').length,
      OUT_FOR_DELIVERY: orders.filter(o => o.status === 'OUT_FOR_DELIVERY').length,
      DELIVERED: completedOrdersCount
    };

    statsData = {
      totalCustomers: mockDb.customers ? mockDb.customers.length : 2000,
      totalRevenue,
      pendingCollection,
      activeOrdersCount,
      completedOrdersCount,
      pendingLeads,
      stageCounts,
      storeSettings: mockDb.storeSettings
    };
    renderStats();
    return;
  }

  try {
    const res = await fetch('/api/stats');
    statsData = await res.json();
    renderStats();
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function fetchOrders() {
  if (isStaticMode) {
    allOrders = [...(mockDb.orders || [])];
    return;
  }
  try {
    const res = await fetch('/api/orders');
    allOrders = await res.json();
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

async function fetchLeads() {
  if (isStaticMode) {
    allLeads = [...(mockDb.leads || [])];
    return;
  }
  try {
    const res = await fetch('/api/leads');
    allLeads = await res.json();
  } catch (err) {
    console.error('Error fetching leads:', err);
  }
}

function renderActiveScreen() {
  if (currentPersona === 'admin') {
    if (currentAdminTableTab === 'pod') {
      renderAdminPodTable();
    } else {
      renderAdminOrders();
    }
  } else if (currentPersona === 'manager') {
    renderManagerLeads();
    renderManagerTagging();
    renderDispatchRecommendations();
  } else if (currentPersona === 'washer') {
    renderWasherKanban();
  } else if (currentPersona === 'rider') {
    renderRiderScreen();
  }
}

// -----------------------------------------------------------------
// SCREEN 1: SUPER ADMIN
// -----------------------------------------------------------------
function renderStats() {
  if (!statsData.stageCounts) return;

  document.getElementById('stat-revenue').innerText = `₹${(statsData.totalRevenue || 0).toLocaleString('en-IN')}`;
  document.getElementById('stat-pending-revenue').innerText = `${(statsData.pendingCollection || 0).toLocaleString('en-IN')}`;
  document.getElementById('stat-active-orders').innerText = statsData.activeOrdersCount || 0;
  document.getElementById('stat-completed-orders').innerText = statsData.completedOrdersCount || 0;
  document.getElementById('stat-pending-leads').innerText = statsData.pendingLeads || 0;
  document.getElementById('stat-total-customers').innerText = (statsData.totalCustomers || 2000).toLocaleString('en-IN');

  const stages = [
    { key: 'PICKUP_REQUESTED', label: '1. Pickup Req' },
    { key: 'PICKED_UP', label: '2. En Route' },
    { key: 'RECEIVED_IN_STORE', label: '3. In Store' },
    { key: 'WASHING', label: '4. Washing' },
    { key: 'DRYING', label: '5. Drying' },
    { key: 'IRONING', label: '6. Ironing' },
    { key: 'PACKED', label: '7. Packed' },
    { key: 'OUT_FOR_DELIVERY', label: '8. Delivery' }
  ];

  const pipelineContainer = document.getElementById('admin-pipeline-breakdown');
  pipelineContainer.innerHTML = stages.map(s => `
    <div class="bg-[#F8FAF3] rounded-xl p-2.5 sm:p-3 flex flex-col justify-between border border-[#E2E8D5] min-w-0">
      <span class="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider block text-[#545454] truncate">${s.label}</span>
      <span class="text-xl sm:text-2xl font-black text-[#1E293B] mt-1">${statsData.stageCounts[s.key] || 0}</span>
    </div>
  `).join('');
}

function renderAdminOrders() {
  const filter = document.getElementById('admin-filter-status').value;
  const tbody = document.getElementById('admin-orders-table');

  let list = allOrders;
  if (filter) {
    list = list.filter(o => o.status === filter);
  }

  if (list.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-[#898989]">No orders match the selected filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(o => {
    const isExpress = o.isExpress ? `<span class="bg-[#1E3304] text-[#A6CE39] text-[9px] font-bold px-2 py-0.5 rounded-full ml-1 border border-[#A6CE39]">EXPRESS</span>` : '';
    const statusBadges = {
      PICKUP_REQUESTED: 'bg-[#F8FAF3] text-[#1E3304] border border-[#E2E8D5]',
      PICKED_UP: 'bg-[#F8FAF3] text-[#1E3304] border border-[#E2E8D5]',
      RECEIVED_IN_STORE: 'bg-[#F8FAF3] text-[#1E3304] border border-[#E2E8D5]',
      WASHING: 'bg-amber-50 text-amber-900 border border-amber-200',
      DRYING: 'bg-[#F8FAF3] text-[#1E3304] border border-[#E2E8D5]',
      IRONING: 'bg-[#F8FAF3] text-[#1E3304] border border-[#E2E8D5]',
      PACKED: 'bg-[#F3F9E4] text-[#5A7812] border border-[#D8ECAB]',
      OUT_FOR_DELIVERY: 'bg-blue-50 text-blue-900 border border-blue-200',
      DELIVERED: 'bg-[#1E3304] text-[#A6CE39] font-bold border border-[#A6CE39]'
    };

    return `
      <tr class="hover:bg-[#F8FAF3] transition-colors">
        <td class="p-3.5 font-mono font-bold text-[#1E293B]">${o.id} ${isExpress}</td>
        <td class="p-3.5">
          <div class="font-bold text-[#1E293B]">${o.customerName}</div>
          <div class="text-[#545454] font-mono text-[11px]">${o.customerPhone}</div>
        </td>
        <td class="p-3.5"><span class="bg-[#EEF4E3] text-[#1E293B] px-2 py-0.5 rounded-full font-medium text-[11px]">${o.zone}</span></td>
        <td class="p-3.5">
          <span class="font-bold text-[#1E293B]">${o.totalPieces} Pieces</span>
          <div class="text-[#898989] text-[10px] truncate max-w-[150px]">${(o.items || []).map(i => i.garmentName).slice(0, 2).join(', ')}...</div>
        </td>
        <td class="p-3.5 font-bold text-[#1E293B]">
          ₹${o.subtotal}
          <div class="text-[10px] ${o.paymentStatus === 'PAID' ? 'text-[#5A7812] font-bold' : 'text-[#FFC043]'}">${o.paymentStatus}</div>
        </td>
        <td class="p-3.5"><span class="px-2.5 py-1 rounded-full text-[10px] font-bold ${statusBadges[o.status] || 'bg-[#F8FAF3] text-[#1E293B]'}">${o.status.replace(/_/g, ' ')}</span></td>
        <td class="p-3.5 text-[#545454]">${new Date(o.promisedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
        <td class="p-3.5 text-right space-x-1">
          <button onclick="previewThermalTags('${o.id}')" title="Print Garment Tags" class="p-1.5 bg-[#EEF4E3] hover:bg-[#E2E8D5] text-[#1E293B] rounded-full">
            <i data-lucide="printer" class="w-3.5 h-3.5 inline"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
}

function setAdminTableTab(tab) {
  currentAdminTableTab = tab;
  const tabs = ['orders', 'pod', 'reconciliation', 'franchise'];
  
  tabs.forEach(t => {
    const btn = document.getElementById(`atab-${t}`);
    const view = document.getElementById(`admin-${t}-view`);
    if (btn) {
      if (t === tab) {
        btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-bold bg-[#1E3304] text-[#A6CE39] shadow-sm transition-all whitespace-nowrap flex items-center space-x-1';
      } else {
        btn.className = 'px-3.5 py-1.5 rounded-full text-xs font-semibold text-[#545454] hover:text-[#1E293B] transition-all whitespace-nowrap flex items-center space-x-1';
      }
    }
    if (view) {
      if (t === tab) {
        view.classList.remove('hidden');
      } else {
        view.classList.add('hidden');
      }
    }
  });

  const filterContainer = document.getElementById('admin-orders-filter-container');
  if (filterContainer) {
    if (tab === 'orders') {
      filterContainer.classList.remove('hidden');
    } else {
      filterContainer.classList.add('hidden');
    }
  }

  if (tab === 'orders') {
    renderAdminOrders();
  } else if (tab === 'pod') {
    renderAdminPodTable();
  } else if (tab === 'reconciliation') {
    renderAdminReconciliation();
  } else if (tab === 'franchise') {
    renderFranchiseHub();
  }
  lucide.createIcons();
}

function renderAdminPodTable() {
  const tbody = document.getElementById('admin-pod-table');
  if (!tbody) return;

  const delivered = allOrders.filter(o => o.status === 'DELIVERED' || o.podImage);
  if (delivered.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-[#898989]">No delivered orders logged yet. Once a rider completes delivery, photos appear here for audit.</td></tr>`;
    return;
  }

  tbody.innerHTML = delivered.map(o => {
    const isVerified = Boolean(o.podVerified);
    return `
      <tr class="hover:bg-[#F8FAF3] transition-colors border-b border-[#EEF4E3]">
        <td class="p-3.5 font-mono font-bold text-[#1E293B]">${o.id}</td>
        <td class="p-3.5">
          <div class="font-bold text-[#1E293B]">${o.customerName}</div>
          <div class="text-[#545454] font-mono text-[11px]">${o.customerPhone}</div>
        </td>
        <td class="p-3.5 font-medium text-[#1E293B]">${o.assignedRider || 'Rajesh Kumar'}</td>
        <td class="p-3.5"><span class="bg-[#EEF4E3] text-[#1E293B] px-2 py-0.5 rounded-full font-medium text-[11px]">${o.paymentMode || 'UPI / QR'}</span></td>
        <td class="p-3.5 font-bold text-[#1E293B]">₹${o.subtotal}</td>
        <td class="p-3.5 text-[#545454]">${o.deliveredAt ? new Date(o.deliveredAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' }) : 'Today'}</td>
        <td class="p-3.5">
          ${o.podImage ? `
            <button onclick="openAdminPodModal('${o.id}')" class="flex items-center space-x-1.5 px-3 py-1 bg-[#2D5A1E] text-white hover:bg-neutral-800 rounded-full font-bold text-[11px] transition">
              <i data-lucide="image" class="w-3.5 h-3.5"></i>
              <span>View Photo</span>
            </button>
          ` : `<span class="text-[#898989] text-[11px]">No Photo Attached</span>`}
        </td>
        <td class="p-3.5 text-right">
          ${isVerified ? `
            <span class="bg-[#F3F9E4] text-[#5A7812] font-bold text-[10px] px-2.5 py-1 rounded-full border border-[#D8ECAB]">
              Verified Authentic
            </span>
          ` : `
            <button onclick="openAdminPodModal('${o.id}')" class="bg-red-50 text-[#E11900] hover:bg-red-100 font-bold text-[10px] px-2.5 py-1 rounded-full border border-red-200 transition">
              Audit Pending
            </button>
          `}
        </td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
}

function openAdminPodModal(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  activeAdminPodOrderId = orderId;
  document.getElementById('admin-pod-title').innerText = `Payment Proof: ${order.id}`;
  document.getElementById('admin-pod-cust-name').innerText = order.customerName;
  document.getElementById('admin-pod-amount').innerText = `₹${order.subtotal}`;
  document.getElementById('admin-pod-rider-info').innerText = `Delivered by: ${order.assignedRider || 'Rajesh Kumar'} • Mode: ${order.paymentMode || 'UPI / QR Code'}`;
  document.getElementById('admin-pod-timestamp').innerText = order.deliveredAt ? `Delivered: ${new Date(order.deliveredAt).toLocaleString('en-IN')}` : 'Delivered Today';

  const fullImg = document.getElementById('admin-pod-full-image');
  const imgWrapper = document.getElementById('admin-pod-image-wrapper');
  if (order.podImage) {
    fullImg.src = order.podImage;
    fullImg.classList.remove('hidden');
    imgWrapper.classList.remove('p-8');
  } else {
    fullImg.src = '';
    fullImg.classList.add('hidden');
    imgWrapper.innerHTML = '<span class="text-neutral-400 text-xs p-8">No photo/screenshot submitted for this order.</span>';
  }

  const statusBanner = document.getElementById('admin-pod-status-banner');
  const verifyBtn = document.getElementById('btn-admin-verify-pod');

  if (order.podVerified) {
    statusBanner.className = 'p-3 rounded-2xl text-xs font-semibold bg-[#F3F9E4] text-[#5A7812] border border-[#D8ECAB]';
    statusBanner.innerHTML = 'Payment verified and approved by Admin. No fraud detected.';
    verifyBtn.innerHTML = '<i data-lucide="shield-alert" class="w-4 h-4"></i><span>Flag Discrepancy</span>';
  } else {
    statusBanner.className = 'p-3 rounded-2xl text-xs font-semibold bg-red-50 text-[#E11900] border border-red-200';
    statusBanner.innerHTML = 'Awaiting Admin audit. Check UPI reference ID and timestamp on screenshot.';
    verifyBtn.innerHTML = '<i data-lucide="shield-check" class="w-4 h-4"></i><span>Verify Payment Authentic</span>';
  }

  document.getElementById('modal-admin-pod-viewer').classList.remove('hidden');
  lucide.createIcons();
}

function closeAdminPodModal() {
  document.getElementById('modal-admin-pod-viewer').classList.add('hidden');
  activeAdminPodOrderId = null;
}

async function togglePodVerification() {
  if (!activeAdminPodOrderId) return;
  const order = allOrders.find(o => o.id === activeAdminPodOrderId);
  if (!order) return;

  const newStatus = !order.podVerified;

  if (isStaticMode) {
    order.podVerified = newStatus;
    saveDemoState();
    openAdminPodModal(activeAdminPodOrderId);
    renderAdminPodTable();
    return;
  }

  try {
    const res = await fetch(`/api/orders/${activeAdminPodOrderId}/verify-pod`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ verified: newStatus })
    });
    const data = await res.json();
    order.podVerified = data.order.podVerified;
    openAdminPodModal(activeAdminPodOrderId);
    renderAdminPodTable();
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------
// SCREEN 2: FRONT DESK & STORE MANAGER
// -----------------------------------------------------------------
function setLeadsFilter(filter) {
  currentLeadsFilter = filter;
  ['active', 'all', 'resolved', 'archived'].forEach(f => {
    const btn = document.getElementById(`lfilter-${f}`);
    if (!btn) return;
    if (f === filter) {
      btn.className = 'px-3 py-1 rounded-full font-bold text-[#1E293B] bg-white shadow-sm transition-all shrink-0 whitespace-nowrap';
    } else {
      btn.className = 'px-3 py-1 rounded-full font-medium text-[#545454] hover:text-[#1E293B] transition-all shrink-0 whitespace-nowrap';
    }
  });
  renderManagerLeads();
  lucide.createIcons();
}

function renderManagerLeads() {
  const container = document.getElementById('leads-card-container');
  const countBadge = document.getElementById('badge-leads-count');

  const activeLeads = allLeads.filter(l => l.status !== 'RESOLVED' && l.status !== 'ARCHIVED');
  const resolvedLeads = allLeads.filter(l => l.status === 'RESOLVED');
  const archivedLeads = allLeads.filter(l => l.status === 'ARCHIVED');

  if (countBadge) countBadge.innerText = activeLeads.length;

  const countActiveEl = document.getElementById('lcount-active');
  const countAllEl = document.getElementById('lcount-all');
  const countResolvedEl = document.getElementById('lcount-resolved');
  const countArchivedEl = document.getElementById('lcount-archived');

  if (countActiveEl) countActiveEl.innerText = activeLeads.length;
  if (countAllEl) countAllEl.innerText = allLeads.length;
  if (countResolvedEl) countResolvedEl.innerText = resolvedLeads.length;
  if (countArchivedEl) countArchivedEl.innerText = archivedLeads.length;

  let displayLeads = allLeads;
  if (currentLeadsFilter === 'active') {
    displayLeads = activeLeads;
  } else if (currentLeadsFilter === 'resolved') {
    displayLeads = resolvedLeads;
  } else if (currentLeadsFilter === 'archived') {
    displayLeads = archivedLeads;
  }

  if (displayLeads.length === 0) {
    const emptyMessages = {
      active: 'No active inquiries waiting for callback. Inbox is clean.',
      all: 'No leads found in the system.',
      resolved: 'No resolved leads in this view.',
      archived: 'Archive is empty.'
    };
    container.innerHTML = `<div class="col-span-3 p-8 text-center bg-white rounded-2xl border border-[#E2E8D5] text-[#898989] text-xs">${emptyMessages[currentLeadsFilter]}</div>`;
    return;
  }

  container.innerHTML = displayLeads.map(lead => {
    const isResolved = lead.status === 'RESOLVED';
    const isArchived = lead.status === 'ARCHIVED';
    const isUrgent = lead.priority === 'URGENT';
    const attempts = lead.attempts || 1;

    return `
      <div class="bg-white p-5 rounded-2xl border ${isUrgent && !isResolved && !isArchived ? 'border-[#E11900] ring-1 ring-[#E11900]' : 'border-[#E2E8D5]'} space-y-3 relative">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center space-x-1.5 flex-wrap">
              <span class="font-bold text-[#1E293B] text-sm">${lead.customerName}</span>
              ${attempts > 1 ? `<span class="bg-[#FFC043]/20 text-[#1E293B] text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-[#FFC043]">Called ${attempts}x</span>` : ''}
              ${isUrgent && !isResolved && !isArchived ? '<span class="bg-red-50 text-[#E11900] text-[9px] font-bold px-1.5 py-0.5 rounded-full">SLA URGENT</span>' : ''}
            </div>
            <span class="text-xs font-mono text-[#545454]">${lead.phone}</span>
          </div>

          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isResolved ? 'bg-[#F3F9E4] text-[#5A7812]' : isArchived ? 'bg-[#EEF4E3] text-[#545454]' : 'bg-amber-50 text-amber-900'}">
              ${lead.status.replace(/_/g, ' ')}
            </span>
            <button onclick="deleteLead('${lead.id}')" title="Delete lead card permanently" class="p-1 hover:bg-red-50 text-[#898989] hover:text-[#E11900] rounded-full transition-colors">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="p-3 bg-[#F8FAF3] rounded-xl text-xs text-[#1E293B] border border-[#E2E8D5]">
          <div class="flex items-center space-x-1.5 font-bold text-[#545454] text-[10px] uppercase mb-1">
            <span class="w-1.5 h-1.5 rounded-full bg-[#A6CE39]"></span>
            <span>${lead.channel}</span>
          </div>
          <p class="leading-relaxed">${lead.message}</p>
          ${lead.address ? `<div class="mt-2 text-[11px] text-[#1E293B] font-medium">${lead.address} (${lead.zone})</div>` : ''}
        </div>

        <div class="flex items-center justify-between text-xs text-[#545454] pt-2 border-t border-[#E2E8D5]">
          <span>
            ${!isResolved && !isArchived ? `Callback SLA: <strong class="${lead.slaMinutesRemaining < 10 ? 'text-[#E11900]' : 'text-[#1E293B]'}">${lead.slaMinutesRemaining}m left</strong>` : `<span class="text-[#898989]">Closed</span>`}
          </span>

          <div class="flex items-center space-x-1.5">
            ${!isResolved && !isArchived ? `
              <button onclick="markLeadResolved('${lead.id}')" class="px-3 py-1.5 bg-[#EEF4E3] hover:bg-[#E2E8D5] text-[#1E293B] rounded-full font-semibold text-xs transition-all">
                Mark Called
              </button>
              <button onclick="convertLeadToOrder('${lead.id}')" class="px-3.5 py-1.5 bg-[#2D5A1E] hover:bg-[#234717] text-white rounded-full font-bold text-xs flex items-center space-x-1 shadow-sm transition-all">
                <i data-lucide="plus" class="w-3 h-3"></i>
                <span>Book Order</span>
              </button>
            ` : `
              <button onclick="archiveLead('${lead.id}')" class="px-3 py-1.5 bg-[#EEF4E3] hover:bg-[#E2E8D5] text-[#1E293B] rounded-full font-semibold text-xs flex items-center space-x-1 transition-all">
                <i data-lucide="archive" class="w-3 h-3"></i>
                <span>${isArchived ? 'Archived' : 'Archive'}</span>
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

async function markLeadResolved(leadId) {
  if (isStaticMode) {
    const lead = mockDb.leads.find(l => l.id === leadId);
    if (lead) lead.status = 'RESOLVED';
    saveDemoState();
    await refreshAll();
    return;
  }
  try {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'RESOLVED' })
    });
    await refreshAll();
  } catch (err) {
    console.error(err);
  }
}

async function archiveLead(leadId) {
  if (isStaticMode) {
    const lead = mockDb.leads.find(l => l.id === leadId);
    if (lead) lead.status = 'ARCHIVED';
    saveDemoState();
    await refreshAll();
    return;
  }
  try {
    await fetch(`/api/leads/${leadId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'ARCHIVED' })
    });
    await refreshAll();
  } catch (err) {
    console.error(err);
  }
}

async function deleteLead(leadId) {
  if (!confirm('Are you sure you want to delete this lead card?')) return;
  if (isStaticMode) {
    mockDb.leads = mockDb.leads.filter(l => l.id !== leadId);
    saveDemoState();
    await refreshAll();
    return;
  }
  try {
    await fetch(`/api/leads/${leadId}`, { method: 'DELETE' });
    await refreshAll();
  } catch (err) {
    console.error(err);
  }
}

async function clearResolvedLeads(action = 'archive') {
  const confirmed = confirm(action === 'delete' ? 'Permanently delete all resolved leads?' : 'Archive all resolved leads to clean your active inbox?');
  if (!confirmed) return;

  if (isStaticMode) {
    if (action === 'delete') {
      mockDb.leads = mockDb.leads.filter(l => l.status !== 'RESOLVED');
    } else {
      mockDb.leads.forEach(l => { if (l.status === 'RESOLVED') l.status = 'ARCHIVED'; });
    }
    saveDemoState();
    await refreshAll();
    return;
  }

  try {
    await fetch('/api/leads/clear-resolved', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action })
    });
    await refreshAll();
  } catch (err) {
    console.error(err);
  }
}

function convertLeadToOrder(leadId) {
  const lead = allLeads.find(l => l.id === leadId);
  if (!lead) return;
  openNewOrderModal();
  document.getElementById('order-cust-search').value = lead.phone;
  searchOrderCustomer(lead.phone);
}

function renderManagerTagging() {
  const container = document.getElementById('tagging-orders-list');
  const ordersToTag = allOrders.filter(o => ['PICKED_UP', 'RECEIVED_IN_STORE'].includes(o.status));

  if (ordersToTag.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-[#898989] text-xs">No orders awaiting garment tagging. All incoming clothes are tagged.</div>`;
    return;
  }

  container.innerHTML = ordersToTag.map(o => `
    <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span class="font-mono font-bold text-[#1E293B] shrink-0 whitespace-nowrap">${o.id}</span>
          <span class="text-xs font-bold text-[#1E293B]">${o.customerName}</span>
          <span class="bg-[#EEF4E3] text-[#1E293B] text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 whitespace-nowrap">${o.status.replace(/_/g, ' ')}</span>
          ${o.isExpress ? '<span class="bg-[#2D5A1E] text-white text-[9px] font-bold px-1.5 py-0.5 rounded-full border border-[#E11900] shrink-0 whitespace-nowrap">EXPRESS</span>' : ''}
        </div>
        <p class="text-xs text-[#545454] mt-1">${o.totalPieces} Pieces Counted • Zone: ${o.zone} • ${o.customerPhone}</p>
        <div class="flex flex-wrap gap-1.5 mt-2">
          ${(o.items || []).map(item => `
            <span class="bg-[#F8FAF3] border border-[#E2E8D5] text-[#1E293B] text-[10px] px-2.5 py-0.5 rounded-full font-medium">
              #${item.pieceNumber} ${item.garmentName} (${item.service})
              ${item.hasStain ? '<strong class="text-[#E11900]">Stain Care</strong>' : ''}
            </span>
          `).join('')}
        </div>
      </div>
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 mt-2 md:mt-0">
        <button onclick="previewThermalTags('${o.id}')" class="px-4 py-2 bg-[#2D5A1E] hover:bg-[#234717] text-white rounded-full text-xs font-bold shadow-sm flex items-center space-x-1.5 transition-all">
          <i data-lucide="printer" class="w-3.5 h-3.5"></i>
          <span>Print Tags</span>
        </button>
        ${o.status === 'RECEIVED_IN_STORE' ? `
          <button onclick="updateOrderStatus('${o.id}', 'WASHING')" class="px-4 py-2 bg-[#A6CE39] hover:bg-[#92BA2B] text-[#1E3304] rounded-full text-xs font-bold flex items-center space-x-1 shadow-sm transition-all">
            <span>Send to Washers →</span>
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

function renderDispatchRecommendations() {
  const container = document.getElementById('dispatch-recommendations-list');
  if (!container) return;

  const readyOrders = allOrders.filter(o => ['PACKED', 'OUT_FOR_DELIVERY'].includes(o.status));
  const pendingPickups = allOrders.filter(o => o.status === 'PICKUP_REQUESTED');

  const recs = [];

  // 1. Same Zone Combining (Pickup + Delivery)
  const pickupZones = [...new Set(pendingPickups.map(p => p.zone))];
  pickupZones.forEach(zone => {
    const pInZone = pendingPickups.filter(p => p.zone === zone);
    const dInZone = readyOrders.filter(d => d.zone === zone);
    if (dInZone.length > 0) {
      recs.push({
        type: 'COMBINE',
        zone,
        title: `Combine Pickup & Delivery in ${zone}`,
        badge: `${pInZone.length} Pickups • ${dInZone.length} Deliveries`,
        badgeColor: 'bg-[#F3F9E4] text-[#5A7812] border-[#D8ECAB]',
        description: `Rider going to ${zone} for pickup (${pInZone[0].customerName}). ${dInZone.length} order(s) are ready for delivery in the same area. Dispatched together to avoid duplicate round-trips.`,
        actionLabel: `Assign Combined Run`,
        actionFn: `combineZoneTrip('${zone}', 'Rajesh Kumar')`
      });
    }
  });

  // 2. Early Delivery Opportunity (Due tomorrow, packed today)
  const tomorrowStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
  const earlyOrders = readyOrders.filter(o => o.promisedDelivery && o.promisedDelivery.startsWith(tomorrowStr));
  if (earlyOrders.length > 0) {
    const o = earlyOrders[0];
    recs.push({
      type: 'EARLY',
      zone: o.zone,
      title: `Early Delivery Candidate (${o.customerName})`,
      badge: `Due Tomorrow • Packed Today`,
      badgeColor: 'bg-blue-50 text-[#276EF1] border-blue-200',
      description: `Order #${o.id} in ${o.zone} is finished ahead of SLA. Call customer now to deliver early alongside today's trips and save tomorrow's vehicle fuel.`,
      actionLabel: `Call Customer`,
      actionFn: `window.open('tel:${o.customerPhone}')`
    });
  }

  // 3. Rider Proximity
  const availableRiders = (allRiders || []).filter(r => r.status === 'IDLE_AT_STORE');
  if (availableRiders.length > 0 && pendingPickups.length > 0) {
    recs.push({
      type: 'DISPATCH',
      zone: pendingPickups[0].zone,
      title: `Rider Available at Store: ${availableRiders[0].name}`,
      badge: `Standby at Counter`,
      badgeColor: 'bg-[#EEF4E3] text-[#1E293B] border-[#E2E8D5]',
      description: `${availableRiders[0].name} is idle at store counter. Nearest pending pickup is ${pendingPickups[0].customerName} in ${pendingPickups[0].zone}.`,
      actionLabel: `Dispatch ${availableRiders[0].name}`,
      actionFn: `assignOrderRider('${pendingPickups[0].id}', '${availableRiders[0].name}')`
    });
  }

  if (recs.length === 0) {
    container.innerHTML = `
      <div class="col-span-full p-4 rounded-xl bg-[#F8FAF3] text-neutral-500 text-center">
        All logistics routes currently balanced. No duplicate turns detected.
      </div>
    `;
    return;
  }

  container.innerHTML = recs.map(r => `
    <div class="p-3.5 rounded-xl border border-[#E2E8D5] bg-[#F8FAF3] space-y-2">
      <div class="flex items-start justify-between">
        <div>
          <span class="font-bold text-[#1E293B] text-xs">${r.title}</span>
          <div class="text-[11px] text-[#545454] mt-0.5 leading-relaxed">${r.description}</div>
        </div>
        <span class="text-[10px] font-bold px-2 py-0.5 rounded-full border ${r.badgeColor} shrink-0 ml-2">${r.badge}</span>
      </div>
      <div class="pt-1 flex justify-end">
        <button onclick="${r.actionFn}" class="px-3.5 py-1 bg-[#2D5A1E] hover:bg-[#234717] text-white rounded-full font-bold text-[11px] transition">
          ${r.actionLabel}
        </button>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

async function combineZoneTrip(zone, riderName) {
  const readyOrders = allOrders.filter(o => ['PACKED', 'OUT_FOR_DELIVERY'].includes(o.status) && o.zone === zone);
  const pendingPickups = allOrders.filter(o => o.status === 'PICKUP_REQUESTED' && o.zone === zone);

  for (const o of readyOrders) {
    await updateOrderStatus(o.id, 'OUT_FOR_DELIVERY');
  }
  for (const p of pendingPickups) {
    p.assignedRider = riderName;
  }
  if (isStaticMode) saveDemoState();
  alert(`Combined run generated for ${riderName} in ${zone}! Loaded ${readyOrders.length} deliveries + ${pendingPickups.length} pickups.`);
  await refreshAll();
}

async function assignOrderRider(orderId, riderName) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;
  order.assignedRider = riderName;
  if (isStaticMode) {
    saveDemoState();
  } else {
    try {
      await fetch(`/api/orders/${orderId}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignedRider: riderName })
      });
    } catch (e) {}
  }
  alert(`Order ${orderId} assigned to ${riderName}!`);
  await refreshAll();
}

let customerSearchTimer = null;
function searchCustomers(query) {
  clearTimeout(customerSearchTimer);
  customerSearchTimer = setTimeout(async () => {
    let list = [];
    if (isStaticMode) {
      const q = (query || '').toLowerCase().trim();
      const allCust = mockDb.customers || [];
      if (!q) {
        list = allCust.slice(0, 25);
      } else {
        list = allCust.filter(c =>
          (c.name && c.name.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q)) ||
          (c.address && c.address.toLowerCase().includes(q)) ||
          (c.zone && c.zone.toLowerCase().includes(q))
        ).slice(0, 25);
      }
    } else {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(query)}&limit=25`);
        list = await res.json();
      } catch (err) {
        console.error(err);
      }
    }

    const tbody = document.getElementById('customers-table-body');
    const mobileCards = document.getElementById('customers-mobile-cards');

    if (list.length === 0) {
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-[#898989]">No customers found matching "${query}".</td></tr>`;
      if (mobileCards) mobileCards.innerHTML = `<div class="p-6 text-center text-[#898989] text-xs">No customers found matching "${query}".</div>`;
      return;
    }

    if (tbody) {
      tbody.innerHTML = list.map(c => `
        <tr class="hover:bg-[#F8FAF3] transition-colors">
          <td class="p-3 font-mono font-bold text-[#1E293B]">${c.id}</td>
          <td class="p-3 font-bold text-[#1E293B]">${c.name}</td>
          <td class="p-3 font-mono text-[#545454]">${c.phone}</td>
          <td class="p-3 text-[#545454]">
            <div>${c.address}</div>
            <span class="text-[10px] bg-[#EEF4E3] text-[#1E293B] px-2 py-0.5 rounded-full font-medium">${c.zone}</span>
          </td>
          <td class="p-3 font-bold text-[#1E293B]">${c.totalOrders} Orders</td>
          <td class="p-3 text-right">
            <button onclick="selectCustomerForOrder('${c.id}', '${encodeURIComponent(c.name)}', '${c.phone}', '${encodeURIComponent(c.address)}', '${c.zone}')" class="px-3.5 py-1.5 bg-[#2D5A1E] hover:bg-[#234717] text-white rounded-full font-bold text-xs shadow-sm transition-all">
              + New Order
            </button>
          </td>
        </tr>
      `).join('');
    }

    if (mobileCards) {
      mobileCards.innerHTML = list.map(c => `
        <div class="p-3.5 bg-white border border-[#E2E8D5] rounded-2xl space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5">
              <span class="font-mono text-[10px] font-bold text-[#1E293B] bg-[#EEF4E3] px-2 py-0.5 rounded-full">${c.id}</span>
              <span class="font-bold text-[#1E293B] text-xs">${c.name}</span>
            </div>
            <span class="text-[10px] bg-[#EEF4E3] text-[#1E293B] px-2 py-0.5 rounded-full font-semibold shrink-0">${c.zone}</span>
          </div>
          <div class="text-xs text-[#545454]">
            <div class="font-mono text-[11px] text-[#1E293B]">${c.phone}</div>
            <div class="text-[11px] text-[#898989] truncate">${c.address}</div>
          </div>
          <div class="flex items-center justify-between pt-2 border-t border-[#E2E8D5] text-xs">
            <span class="font-medium text-[#545454]">${c.totalOrders} Orders</span>
            <button onclick="selectCustomerForOrder('${c.id}', '${encodeURIComponent(c.name)}', '${c.phone}', '${encodeURIComponent(c.address)}', '${c.zone}')" class="px-3.5 py-1.5 bg-[#2D5A1E] hover:bg-[#234717] text-white rounded-full font-bold text-xs shadow-sm transition-all">
              + New Order
            </button>
          </div>
        </div>
      `).join('');
    }
  }, 150);
}

// -----------------------------------------------------------------
// SCREEN 3: LAUNDRY MASTER / WASHERMAN KANBAN
// -----------------------------------------------------------------
function filterWasherMobileCol(stage) {
  activeWasherMobileStage = stage;
  const stages = ['all', 'intake', 'washing', 'ironing', 'packed'];

  stages.forEach(s => {
    const pill = document.getElementById(`wstage-${s}`);
    if (pill) {
      if (s === stage) {
        pill.className = 'washer-stage-pill px-3 py-1.5 rounded-lg text-xs font-bold bg-slate-900 text-white shadow-sm shrink-0';
      } else {
        pill.className = 'washer-stage-pill px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 shrink-0';
      }
    }
  });

  const cols = ['intake', 'washing', 'ironing', 'packed'];
  cols.forEach(c => {
    const colEl = document.getElementById(`washer-card-col-${c}`);
    if (colEl) {
      if (stage === 'all' || stage === c) {
        colEl.classList.remove('hidden');
      } else {
        colEl.classList.add('hidden');
      }
    }
  });
}

function renderWasherKanban() {
  const intakeCol = document.getElementById('washer-col-intake');
  const washingCol = document.getElementById('washer-col-washing');
  const ironingCol = document.getElementById('washer-col-ironing');
  const packedCol = document.getElementById('washer-col-packed');

  const intakeOrders = allOrders.filter(o => o.status === 'RECEIVED_IN_STORE');
  const washingOrders = allOrders.filter(o => o.status === 'WASHING');
  const ironingOrders = allOrders.filter(o => ['DRYING', 'IRONING'].includes(o.status));
  const packedOrders = allOrders.filter(o => o.status === 'PACKED');

  document.getElementById('washer-count-intake').innerText = intakeOrders.length;
  document.getElementById('washer-count-washing').innerText = washingOrders.length;
  document.getElementById('washer-count-ironing').innerText = ironingOrders.length;
  document.getElementById('washer-count-packed').innerText = packedOrders.length;

  const mIntake = document.getElementById('mcount-wintake');
  const mWashing = document.getElementById('mcount-wwashing');
  const mIroning = document.getElementById('mcount-wironing');
  const mPacked = document.getElementById('mcount-wpacked');
  if (mIntake) mIntake.innerText = intakeOrders.length;
  if (mWashing) mWashing.innerText = washingOrders.length;
  if (mIroning) mIroning.innerText = ironingOrders.length;
  if (mPacked) mPacked.innerText = packedOrders.length;

  intakeCol.innerHTML = renderKanbanColumn(intakeOrders, 'WASHING', 'Move to Washers →');
  washingCol.innerHTML = renderKanbanColumn(washingOrders, 'DRYING', 'Move to Drying →');
  ironingCol.innerHTML = renderKanbanColumn(ironingOrders, 'PACKED', 'Pack & Ready for Rider →');
  packedCol.innerHTML = renderKanbanColumn(packedOrders, 'OUT_FOR_DELIVERY', 'Ready for Dispatch', true);

  lucide.createIcons();
}

function renderKanbanColumn(ordersList, nextStatus, nextBtnLabel, isFinal = false) {
  if (ordersList.length === 0) {
    return `<div class="h-28 flex items-center justify-center text-neutral-400 text-xs border border-dashed border-[#E2E8D5] rounded-2xl">Queue empty</div>`;
  }

  const sorted = [...ordersList].sort((a, b) => (b.isExpress ? 1 : 0) - (a.isExpress ? 1 : 0));

  return sorted.map(o => {
    const isExpress = o.isExpress;
    return `
      <div class="bg-white p-4 rounded-2xl border ${isExpress ? 'border-[#A6CE39] ring-1 ring-[#A6CE39]' : 'border-[#E2E8D5]'} shadow-sm space-y-3">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center space-x-1.5">
              <span class="font-mono font-bold text-[#1E293B] text-sm">${o.id}</span>
              ${isExpress ? '<span class="bg-[#1E3304] text-[#A6CE39] text-[9px] font-bold px-2 py-0.5 rounded-full border border-[#A6CE39]">EXPRESS 24H</span>' : ''}
            </div>
            <span class="text-xs font-semibold text-neutral-700">${o.customerName}</span>
          </div>
          <span class="text-xs font-semibold bg-[#F8FAF3] text-[#1E293B] px-2.5 py-0.5 rounded-full">${o.totalPieces} Pcs</span>
        </div>

        <div class="space-y-1 bg-[#F8FAF3] p-3 rounded-xl border border-[#EEF4E3] text-xs">
          ${(o.items || []).map(item => `
            <div class="flex items-center justify-between text-[11px] text-neutral-700">
              <span>#${item.pieceNumber} ${item.garmentName}</span>
              <span class="text-neutral-500 font-medium">${item.service}</span>
            </div>
            ${item.hasStain ? `<div class="text-[10px] text-[#E11900] font-semibold pl-2">Special: ${item.specialNote || 'Stain Treatment'}</div>` : ''}
          `).join('')}
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-[#EEF4E3] text-xs">
          <div>
            <span class="text-neutral-500 text-[10px] block">Due ${new Date(o.promisedDelivery).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
            <span class="text-[10px] text-neutral-400 font-medium">${o.assignedWasher || 'Staff: Suresh & Ramesh'}</span>
          </div>
          ${!isFinal ? `
            <button onclick="updateOrderStatus('${o.id}', '${nextStatus}')" class="px-3.5 py-1.5 bg-[#2D5A1E] hover:bg-[#234717] text-[#A6CE39] text-xs font-bold rounded-full transition-transform active:scale-95">
              ${nextBtnLabel}
            </button>
          ` : `
            <div class="flex items-center space-x-1.5">
              <button onclick="openWhatsAppReadyModal('${o.id}')" class="px-2.5 py-1 bg-[#A6CE39] hover:bg-[#92BA2B] text-[#1E3304] rounded-full text-[10px] font-bold flex items-center space-x-1 shadow-sm transition">
                <i data-lucide="send" class="w-2.5 h-2.5"></i>
                <span>Notify</span>
              </button>
              <span class="text-[#A6CE39] font-semibold text-xs flex items-center space-x-1">
                <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
                <span>Packed</span>
              </span>
            </div>
          `}
        </div>
      </div>
    `;
  }).join('');
}

// -----------------------------------------------------------------
// SCREEN 4: FIELD AGENT (PWA)
// -----------------------------------------------------------------
async function renderRiderScreen() {
  const pickupBadge = document.getElementById('rider-badge-pickups');
  const deliveryBadge = document.getElementById('rider-badge-deliveries');

  const pendingPickups = allOrders.filter(o => o.status === 'PICKUP_REQUESTED');
  const readyDeliveries = allOrders.filter(o => ['PACKED', 'OUT_FOR_DELIVERY'].includes(o.status));

  if (pickupBadge) pickupBadge.innerText = pendingPickups.length;
  if (deliveryBadge) deliveryBadge.innerText = readyDeliveries.length;

  if (currentRiderMode === 'pickup') {
    renderRiderPickups(pendingPickups);
  } else {
    await renderRiderDeliveries();
  }
}

function renderRiderPickups(pickups) {
  const container = document.getElementById('rider-pickups-list');
  if (!container) return;

  if (pickups.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-neutral-400 text-xs">No pending pickups right now.</div>`;
    return;
  }

  container.innerHTML = pickups.map(p => `
    <div class="bg-white p-4 rounded-2xl border border-[#E2E8D5] shadow-sm space-y-3">
      <div class="flex items-start justify-between">
        <div>
          <span class="font-mono text-neutral-500 font-semibold text-xs">${p.id}</span>
          <h4 class="font-bold text-[#1E293B] text-sm">${p.customerName}</h4>
          <span class="text-xs text-neutral-500 font-mono">${p.customerPhone}</span>
        </div>
        <span class="text-[10px] bg-[#EEF4E3] text-[#1E293B] font-semibold px-2.5 py-0.5 rounded-full">${p.zone}</span>
      </div>

      <div class="text-xs text-neutral-700 bg-[#F8FAF3] p-3 rounded-xl border border-[#EEF4E3]">
        ${p.customerAddress}
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs">
        <a href="tel:${p.customerPhone}" class="py-2.5 bg-[#EEF4E3] hover:bg-[#E2E8D5] rounded-full font-semibold text-[#1E293B] flex items-center justify-center space-x-1.5 transition">
          <i data-lucide="phone" class="w-3.5 h-3.5"></i>
          <span>Call</span>
        </a>
        <a href="https://maps.google.com/?q=${encodeURIComponent(p.customerAddress)}" target="_blank" class="py-2.5 bg-[#EEF4E3] hover:bg-[#E2E8D5] rounded-full font-semibold text-[#1E293B] flex items-center justify-center space-x-1.5 transition">
          <i data-lucide="navigation" class="w-3.5 h-3.5"></i>
          <span>Directions</span>
        </a>
      </div>

      <button onclick="promptRiderPickupIntake('${p.id}')" class="w-full py-3 bg-[#2D5A1E] hover:bg-[#234717] text-[#A6CE39] rounded-full font-bold text-xs transition flex items-center justify-center space-x-1.5 active:scale-98">
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>Confirm Pickup</span>
      </button>
    </div>
  `).join('');
  lucide.createIcons();
}

async function renderRiderDeliveries() {
  const container = document.getElementById('rider-delivery-clusters');
  if (!container) return;

  let clusters = [];
  if (isStaticMode) {
    const readyOrders = (mockDb.orders || []).filter(o => ['PACKED', 'OUT_FOR_DELIVERY'].includes(o.status));
    const zonesMap = {};
    readyOrders.forEach(o => {
      if (!zonesMap[o.zone]) {
        zonesMap[o.zone] = { zoneName: o.zone, orders: [], totalPieces: 0, totalAmountToCollect: 0 };
      }
      zonesMap[o.zone].orders.push(o);
      zonesMap[o.zone].totalPieces += o.totalPieces;
      if (o.paymentStatus !== 'PAID') zonesMap[o.zone].totalAmountToCollect += o.subtotal;
    });
    clusters = Object.values(zonesMap).sort((a, b) => b.orders.length - a.orders.length);
  } else {
    try {
      const res = await fetch('/api/logistics/routes');
      clusters = await res.json();
    } catch (err) {
      console.error(err);
    }
  }

  if (clusters.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-neutral-400 text-xs">No orders ready for delivery.</div>`;
    return;
  }

  container.innerHTML = clusters.map(cluster => `
    <div class="bg-white rounded-2xl border border-[#E2E8D5] shadow-sm overflow-hidden">
      <div class="bg-[#F8FAF3] p-4 flex items-center justify-between border-b border-[#E2E8D5]">
        <div>
          <span class="text-[10px] uppercase font-bold text-neutral-500 tracking-wider">Cluster</span>
          <h4 class="font-bold text-[#1E293B] text-sm">${cluster.zoneName}</h4>
        </div>
        <div class="text-right">
          <span class="bg-[#2D5A1E] text-white text-xs font-bold px-2.5 py-0.5 rounded-full">${cluster.orders.length} Orders</span>
          <div class="text-[10px] text-neutral-600 font-semibold mt-0.5">Collect ₹${cluster.totalAmountToCollect}</div>
        </div>
      </div>

      <div class="p-4 divide-y divide-[#EEF4E3] space-y-3">
        ${cluster.orders.map(o => `
          <div class="pt-3 first:pt-0 space-y-2 text-xs">
            <div class="flex items-start justify-between">
              <div>
                <div class="font-bold text-[#1E293B]">${o.customerName}</div>
                <div class="text-neutral-500 font-mono text-[11px]">${o.customerPhone}</div>
              </div>
              <div class="text-right">
                <div class="font-bold text-[#1E293B]">₹${o.subtotal}</div>
                <span class="text-[10px] font-bold ${o.paymentStatus === 'PAID' ? 'text-[#5A7812]' : 'text-[#FFC043]'}">${o.paymentStatus}</span>
              </div>
            </div>
            <div class="text-neutral-600 text-[11px]">${o.customerAddress}</div>
            <div class="flex items-center space-x-1.5 pt-1">
              <a href="tel:${o.customerPhone}" class="px-2.5 py-2 bg-[#EEF4E3] hover:bg-[#E2E8D5] text-[#1E293B] rounded-full text-xs font-semibold flex items-center justify-center space-x-1 shrink-0" title="Call Customer">
                <i data-lucide="phone" class="w-3.5 h-3.5"></i>
              </a>
              <a href="https://maps.google.com/?q=${encodeURIComponent(o.customerAddress || o.zone)}" target="_blank" class="px-2.5 py-2 bg-[#EEF4E3] hover:bg-[#E2E8D5] text-[#1E293B] rounded-full text-xs font-semibold flex items-center justify-center space-x-1 shrink-0" title="Navigate with Google Maps">
                <i data-lucide="navigation" class="w-3.5 h-3.5"></i>
              </a>
              <button onclick="openDynamicUpiQrModal('${o.id}')" class="px-2.5 py-2 bg-[#F8FAF3] hover:bg-[#EEF4E3] border border-[#E2E8D5] text-[#2D5A1E] rounded-full text-xs font-bold flex items-center justify-center space-x-1 shrink-0" title="Show Dynamic UPI QR">
                <i data-lucide="qr-code" class="w-3.5 h-3.5"></i>
                <span class="hidden sm:inline">UPI QR</span>
              </button>
              ${o.status === 'PACKED' ? `
                <button onclick="updateOrderStatus('${o.id}', 'OUT_FOR_DELIVERY')" class="flex-1 py-2 bg-[#2D5A1E] hover:bg-[#234717] text-[#A6CE39] rounded-full font-bold text-xs transition">
                  Start Trip
                </button>
              ` : `
                <button onclick="completeRiderDelivery('${o.id}', ${o.subtotal})" class="flex-1 py-2 bg-[#A6CE39] hover:bg-[#92BA2B] text-[#1E3304] rounded-full font-bold text-xs flex items-center justify-center space-x-1 transition">
                  <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                  <span>Delivered & Paid</span>
                </button>
              `}
            </div>
          </div>
        `).join('')}
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

function promptRiderPickupIntake(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  activePickupOrderId = orderId;
  document.getElementById('modal-pickup-order-title').innerText = `Pickup: ${order.id}`;
  document.getElementById('modal-pickup-cust-name').innerText = order.customerName;
  document.getElementById('modal-pickup-cust-address').innerText = order.customerAddress;
  document.getElementById('modal-pickup-cust-phone').innerText = order.customerPhone;

  document.getElementById('pickup-input-pieces').value = order.totalPieces > 0 ? order.totalPieces : '5';
  document.getElementById('pickup-input-weight').value = order.weightKg || '';
  document.getElementById('pickup-input-notes').value = order.notes || '';

  document.getElementById('modal-rider-pickup').classList.remove('hidden');
  lucide.createIcons();
}

function closeRiderPickupModal() {
  document.getElementById('modal-rider-pickup').classList.add('hidden');
  activePickupOrderId = null;
}

async function submitRiderPickupIntake() {
  if (!activePickupOrderId) return;

  const pieces = parseInt(document.getElementById('pickup-input-pieces').value, 10) || 1;
  const weightKg = parseFloat(document.getElementById('pickup-input-weight').value) || null;
  const serviceType = document.getElementById('pickup-input-service').value;
  const preferredDeliverySlot = document.getElementById('pickup-input-slot').value;
  const notes = document.getElementById('pickup-input-notes').value.trim();

  const order = allOrders.find(o => o.id === activePickupOrderId);
  if (!order) return;

  if (isStaticMode) {
    order.status = 'PICKED_UP';
    order.totalPieces = pieces;
    order.weightKg = weightKg;
    order.serviceType = serviceType;
    order.preferredDeliverySlot = preferredDeliverySlot;
    order.notes = notes;
    order.pickedUpAt = new Date().toISOString();
    saveDemoState();
    broadcastHandoverNotification(order.id, 'PICKED_UP');
    closeRiderPickupModal();
    await refreshAll();
    alert(`Order ${order.id} marked Picked Up with preferred delivery slot saved! Hand over at store counter.`);
    return;
  }

  try {
    const res = await fetch(`/api/orders/${activePickupOrderId}/pickup-intake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pieces, weightKg, serviceType, preferredDeliverySlot, notes })
    });
    if (res.ok) {
      closeRiderPickupModal();
      await refreshAll();
      alert(`Order ${order.id} marked Picked Up! Preferred delivery time: ${preferredDeliverySlot}.`);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to submit pickup intake.');
  }
}

function completeRiderDelivery(orderId, amount) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  activeDeliveryOrderId = orderId;
  activePodImageData = null;

  document.getElementById('modal-del-order-title').innerText = `Deliver: ${order.id}`;
  document.getElementById('modal-del-cust-name').innerText = order.customerName;
  document.getElementById('modal-del-cust-phone').innerText = order.customerPhone;
  document.getElementById('modal-del-address').innerText = order.customerAddress;
  document.getElementById('modal-del-amount').innerText = `₹${amount || order.subtotal}`;

  removePodImagePreview();
  const fileInput = document.getElementById('rider-pod-file-input');
  if (fileInput) fileInput.value = '';

  document.getElementById('modal-rider-delivery').classList.remove('hidden');
  lucide.createIcons();
}

function closeRiderDeliveryModal() {
  document.getElementById('modal-rider-delivery').classList.add('hidden');
  activeDeliveryOrderId = null;
  activePodImageData = null;
}

function handlePodFileSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (e) => {
    activePodImageData = e.target.result;
    const previewImg = document.getElementById('pod-image-preview');
    const previewContainer = document.getElementById('pod-image-preview-container');
    const triggerBox = document.getElementById('pod-upload-trigger');

    previewImg.src = activePodImageData;
    previewContainer.classList.remove('hidden');
    triggerBox.classList.add('hidden');
    lucide.createIcons();
  };
  reader.readAsDataURL(file);
}

function removePodImagePreview() {
  activePodImageData = null;
  const previewContainer = document.getElementById('pod-image-preview-container');
  const triggerBox = document.getElementById('pod-upload-trigger');
  const fileInput = document.getElementById('rider-pod-file-input');
  const previewImg = document.getElementById('pod-image-preview');

  if (previewImg) previewImg.src = '';
  if (previewContainer) previewContainer.classList.add('hidden');
  if (triggerBox) triggerBox.classList.remove('hidden');
  if (fileInput) fileInput.value = '';
}

async function submitRiderDeliveryCompletion() {
  if (!activeDeliveryOrderId) return;

  const modeEl = document.querySelector('input[name="del-payment-mode"]:checked');
  const paymentMode = modeEl ? modeEl.value : 'UPI / QR Code';

  const order = allOrders.find(o => o.id === activeDeliveryOrderId);
  if (!order) return;

  if (isStaticMode) {
    order.status = 'DELIVERED';
    order.paymentStatus = 'PAID';
    order.paymentMode = paymentMode;
    order.podImage = activePodImageData;
    order.podVerified = false;
    order.deliveredAt = new Date().toISOString();
    saveDemoState();
    broadcastHandoverNotification(order.id, 'DELIVERED');
    closeRiderDeliveryModal();
    await refreshAll();
    alert(`Delivery confirmed for ${order.id}! Payment proof recorded for Admin audit.`);
    return;
  }

  try {
    const res = await fetch(`/api/orders/${activeDeliveryOrderId}/complete-delivery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        paymentMode,
        podImage: activePodImageData,
        amountCollected: order.subtotal
      })
    });
    if (res.ok) {
      closeRiderDeliveryModal();
      await refreshAll();
      alert(`Delivery confirmed for ${order.id}! Payment proof recorded for Admin audit.`);
    }
  } catch (err) {
    console.error(err);
    alert('Failed to submit delivery completion.');
  }
}

function openWhatsAppReadyModal(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  activeReadyNotificationOrderId = orderId;
  document.getElementById('wa-ready-cust-name').innerText = order.customerName;
  document.getElementById('wa-ready-cust-phone').innerText = order.customerPhone;
  document.getElementById('wa-ready-order-id').innerText = `Order #${order.id} • ${order.totalPieces} Pieces (${order.zone})`;

  const msg = `Hello ${order.customerName}! Your Bumbledry laundry order #${order.id} (${order.totalPieces} pieces) is packed and ready. Please reply with your availability today or tomorrow (e.g. Morning 10-12 or Evening 5-7) so our rider can deliver smoothly!`;
  document.getElementById('wa-ready-msg-text').value = msg;

  document.getElementById('modal-whatsapp-ready').classList.remove('hidden');
  lucide.createIcons();
}

function closeWhatsAppReadyModal() {
  document.getElementById('modal-whatsapp-ready').classList.add('hidden');
  activeReadyNotificationOrderId = null;
}

async function sendWhatsAppReadyMessage() {
  if (!activeReadyNotificationOrderId) return;
  const order = allOrders.find(o => o.id === activeReadyNotificationOrderId);
  if (!order) return;

  const msg = document.getElementById('wa-ready-msg-text').value;
  const cleanPhone = order.customerPhone.replace(/\D/g, '');

  if (isStaticMode) {
    order.readyNotificationSent = true;
    order.readyNotificationSentAt = new Date().toISOString();
    saveDemoState();
    closeWhatsAppReadyModal();
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    alert(`WhatsApp notification dispatched to ${order.customerName}! Availability response will update delivery queue.`);
    return;
  }

  try {
    await fetch(`/api/orders/${order.id}/notify-ready`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: msg })
    });
    closeWhatsAppReadyModal();
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`, '_blank');
    alert(`WhatsApp notification dispatched to ${order.customerName}! Availability response will update delivery queue.`);
    await refreshAll();
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------
// THERMAL PRINTER TAG PREVIEW (58mm / 80mm ESC/POS FORMAT)
// -----------------------------------------------------------------
async function previewThermalTags(orderId) {
  try {
    let order, storeSettings;

    if (isStaticMode) {
      order = mockDb.orders.find(o => o.id === orderId);
      storeSettings = mockDb.storeSettings;
    } else {
      const res = await fetch(`/api/orders/${orderId}/tags`);
      const data = await res.json();
      order = data.order;
      storeSettings = data.storeSettings;
    }

    if (!order) return;

    const tags = (order.items || []).map(item => ({
      orderId: order.id,
      pieceCode: `${order.id}-P${item.pieceNumber.toString().padStart(2, '0')}`,
      pieceNumber: item.pieceNumber,
      totalPieces: order.totalPieces,
      customerName: order.customerName,
      customerPhone: order.customerPhone,
      garmentName: item.garmentName,
      service: item.service,
      isExpress: order.isExpress,
      hasStain: item.hasStain,
      specialNote: item.specialNote,
      promisedDelivery: order.promisedDelivery
    }));

    const container = document.getElementById('print-thermal-container');
    container.innerHTML = tags.map(tag => `
      <div class="bg-white p-4 border-2 border-dashed border-slate-400 w-[72mm] shadow-md text-[#1E293B] font-mono text-[11px] leading-tight space-y-2">
        <div class="text-center border-b border-[#A6CE39] pb-1.5">
          <div class="font-extrabold text-sm uppercase">${storeSettings.storeName}</div>
          <div class="text-[9px]">${storeSettings.phone} • ${storeSettings.address}</div>
        </div>

        <div class="flex justify-between font-bold text-xs pt-1">
          <span>ORD: ${tag.orderId}</span>
          <span>PIECE [ ${tag.pieceNumber.toString().padStart(2, '0')} / ${tag.totalPieces.toString().padStart(2, '0')} ]</span>
        </div>

        <div>
          <div><strong>Cust:</strong> ${tag.customerName}</div>
          <div><strong>Phone:</strong> ${tag.customerPhone}</div>
          <div><strong>Promised:</strong> ${new Date(tag.promisedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</div>
        </div>

        <div class="border-t border-b border-[#A6CE39] py-1">
          <div class="font-black text-xs">${tag.garmentName}</div>
          <div class="font-bold">${tag.service}</div>
          ${tag.hasStain ? `<div class="bg-[#2D5A1E] text-white px-1 text-[10px] font-bold mt-1">CARE: ${tag.specialNote || 'STAIN REMOVAL'}</div>` : ''}
          ${tag.isExpress ? `<div class="bg-[#2D5A1E] text-white px-1 text-[10px] font-black mt-1">24H EXPRESS PRIORITY</div>` : ''}
        </div>

        <div class="text-center pt-1">
          <div class="text-2xl tracking-[4px] font-bold font-mono">|||| | ||||| || |||</div>
          <div class="text-[9px] tracking-wider font-bold">*${tag.pieceCode}*</div>
        </div>
      </div>
    `).join('');

    document.getElementById('modal-thermal-tags').classList.remove('hidden');
    lucide.createIcons();
  } catch (err) {
    console.error(err);
  }
}

function closeThermalModal() {
  document.getElementById('modal-thermal-tags').classList.add('hidden');
}

// -----------------------------------------------------------------
// WHATSAPP WEBHOOK SIMULATOR
// -----------------------------------------------------------------
function openWhatsAppModal(type = 'MISSED_CALL') {
  document.getElementById('sim-event-type').value = type;
  updateSimForm();
  document.getElementById('sim-result-box').classList.add('hidden');
  document.getElementById('modal-whatsapp-sim').classList.remove('hidden');
  lucide.createIcons();
}

function closeWhatsAppModal() {
  document.getElementById('modal-whatsapp-sim').classList.add('hidden');
}

function updateSimForm() {
  const type = document.getElementById('sim-event-type').value;
  const msgField = document.getElementById('sim-field-message');
  const addrField = document.getElementById('sim-field-address');

  if (type === 'LOCATION_PIN') {
    msgField.classList.add('hidden');
    addrField.classList.remove('hidden');
  } else {
    msgField.classList.remove('hidden');
    addrField.classList.add('hidden');
  }
}

async function submitWhatsAppSim() {
  const type = document.getElementById('sim-event-type').value;
  const senderPhone = document.getElementById('sim-phone').value;
  const senderName = document.getElementById('sim-name').value;
  const messageText = document.getElementById('sim-message').value;
  const addressText = document.getElementById('sim-address').value;

  if (isStaticMode) {
    const cleanPhone = (senderPhone || '+91 9899112233').replace(/\D/g, '');
    const existing = mockDb.leads.find(l => l.phone.replace(/\D/g, '') === cleanPhone);

    let autoReply = '';
    if (type === 'MISSED_CALL') {
      autoReply = `Hi ${senderName || 'there'}! We noticed we missed your call at Bumbledry Laundry. Would you like to schedule an instant doorstep pickup? Reply 1 for Pickup, or drop your location pin!`;
      if (existing) {
        existing.attempts = (existing.attempts || 1) + 1;
        existing.channel = 'WhatsApp Missed Call';
        existing.message = `Repeated missed call #${existing.attempts}. Callback template re-sent.`;
        existing.status = 'PENDING_CALLBACK';
        existing.priority = 'URGENT';
        existing.slaMinutesRemaining = 10;
      } else {
        mockDb.leads.unshift({
          id: `LEAD-${100 + mockDb.leads.length + 1}`,
          customerName: senderName || 'Potential Client',
          phone: senderPhone,
          channel: 'WhatsApp Missed Call',
          message: 'Missed voice call. Automated callback template dispatched.',
          zone: 'Sector 14 - North',
          address: '',
          status: 'PENDING_CALLBACK',
          attempts: 1,
          createdAt: new Date().toISOString(),
          slaMinutesRemaining: 15,
          priority: 'URGENT'
        });
      }
    } else if (type === 'LOCATION_PIN') {
      autoReply = `Thank you! We have received your location pin. Rider Rajesh Kumar has been dispatched for pickup between 3:00 PM - 5:00 PM. Order tracking ID: ORD-${1000 + mockDb.orders.length + 1}.`;
      const locMsg = `Customer shared GPS location: 28.4595° N, 77.0266° E (${addressText || 'Sector 15 Main Market'})`;

      if (existing) {
        existing.channel = 'WhatsApp Live Location';
        existing.message = locMsg;
        existing.address = addressText || '#42, Pocket 2, Sector 15, Gurugram';
        existing.status = 'LOCATION_RECEIVED';
      } else {
        mockDb.leads.unshift({
          id: `LEAD-${100 + mockDb.leads.length + 1}`,
          customerName: senderName || 'WhatsApp Customer',
          phone: senderPhone,
          channel: 'WhatsApp Live Location',
          message: locMsg,
          zone: 'Sector 15 - North',
          address: addressText || '#42, Pocket 2, Sector 15, Gurugram',
          status: 'LOCATION_RECEIVED',
          attempts: 1,
          createdAt: new Date().toISOString(),
          slaMinutesRemaining: 10,
          priority: 'HIGH'
        });
      }

      mockDb.orders.unshift({
        id: `ORD-${1000 + mockDb.orders.length + 1}`,
        customerId: `CUST-${Math.floor(Math.random() * 8000 + 1000)}`,
        customerName: senderName,
        customerPhone: senderPhone,
        customerAddress: addressText || '#42, Pocket 2, Sector 15, Gurugram',
        zone: 'Sector 15 - North',
        status: 'PICKUP_REQUESTED',
        isExpress: false,
        totalPieces: 0,
        items: [],
        subtotal: 0,
        paymentStatus: 'PENDING',
        paymentMode: 'COD / UPI on Delivery',
        createdAt: new Date().toISOString(),
        promisedDelivery: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
        assignedRider: 'Rajesh Kumar (Field Agent)'
      });
    } else {
      autoReply = `Hello from Bumbledry Laundry! Our dry cleaning rate is ₹90 for shirts, ₹110 for trousers, and ₹280 for suits with free doorstep pickup. Would you like to schedule a pickup today?`;
      if (existing) {
        existing.attempts = (existing.attempts || 1) + 1;
        existing.message = messageText || existing.message;
        existing.status = 'PENDING_CALLBACK';
      } else {
        mockDb.leads.unshift({
          id: `LEAD-${100 + mockDb.leads.length + 1}`,
          customerName: senderName || 'WhatsApp User',
          phone: senderPhone,
          channel: 'WhatsApp Chat',
          message: messageText || 'Inquiry about dry cleaning rates',
          zone: 'DLF Phase 2 - East',
          address: '',
          status: 'PENDING_CALLBACK',
          attempts: 1,
          createdAt: new Date().toISOString(),
          slaMinutesRemaining: 20,
          priority: 'NORMAL'
        });
      }
    }

    saveDemoState();
    const resultBox = document.getElementById('sim-result-box');
    const resultText = document.getElementById('sim-result-text');
    resultBox.classList.remove('hidden');
    resultText.innerHTML = `<strong>Auto-Reply Sent via WhatsApp:</strong><br><em>"${autoReply}"</em><br><br>Lead recorded in Front Desk Callback Hub.`;
    await refreshAll();
    return;
  }

  try {
    const res = await fetch('/api/whatsapp/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, senderPhone, senderName, messageText, addressText })
    });
    const result = await res.json();
    const resultBox = document.getElementById('sim-result-box');
    const resultText = document.getElementById('sim-result-text');
    resultBox.classList.remove('hidden');
    resultText.innerHTML = `<strong>Auto-Reply Sent via WhatsApp:</strong><br><em>"${result.autoReplyDispatched}"</em><br><br>Lead recorded in Front Desk Callback Hub.`;
    await refreshAll();
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------
// NEW ORDER POS MODAL & BILLING
// -------------------------------------------------------------
function openNewOrderModal() {
  selectedCustomer = null;
  currentNewOrderItems = [];
  document.getElementById('order-cust-search').value = '';
  document.getElementById('selected-cust-card').classList.add('hidden');
  document.getElementById('order-express-check').checked = false;
  renderOrderItemsTable();
  document.getElementById('modal-new-order').classList.remove('hidden');
  lucide.createIcons();
}

function closeNewOrderModal() {
  document.getElementById('modal-new-order').classList.add('hidden');
}

function populateCatalogDropdown() {
  const select = document.getElementById('quick-garment-select');
  if (!select) return;
  select.innerHTML = (catalog || []).map(g => `
    <option value="${g.name}" data-wash="${g.rateWashIron || 35}" data-dry="${g.rateDryClean || 90}">
      ${g.name}
    </option>
  `).join('');
}

let orderSearchTimer = null;
function searchOrderCustomer(query) {
  clearTimeout(orderSearchTimer);
  const dropdown = document.getElementById('order-cust-dropdown');
  if (!query || query.length < 2) {
    dropdown.classList.add('hidden');
    return;
  }

  orderSearchTimer = setTimeout(async () => {
    let results = [];
    if (isStaticMode) {
      const q = query.toLowerCase().trim();
      results = (mockDb.customers || []).filter(c =>
        (c.name && c.name.toLowerCase().includes(q)) ||
        (c.phone && c.phone.includes(q))
      ).slice(0, 6);
    } else {
      try {
        const res = await fetch(`/api/customers?q=${encodeURIComponent(query)}&limit=6`);
        results = await res.json();
      } catch (err) {
        console.error(err);
      }
    }

    if (results.length === 0) {
      dropdown.innerHTML = `<div class="p-3 text-slate-400 text-xs">No customer found. <a href="javascript:void(0)" onclick="closeNewOrderModal(); openNewCustomerModal();" class="text-teal-600 font-bold underline">Create New</a></div>`;
    } else {
      dropdown.innerHTML = results.map(c => `
        <div onclick="selectCustomerForOrder('${c.id}', '${encodeURIComponent(c.name)}', '${c.phone}', '${encodeURIComponent(c.address)}', '${c.zone}')" class="p-2.5 hover:bg-slate-50 cursor-pointer text-xs">
          <div class="font-bold text-slate-900">${c.name} <span class="font-normal font-mono text-slate-500">(${c.phone})</span></div>
          <div class="text-slate-500 text-[11px]">${c.address}</div>
        </div>
      `).join('');
    }
    dropdown.classList.remove('hidden');
  }, 200);
}

function selectCustomerForOrder(id, name, phone, address, zone) {
  selectedCustomer = {
    id,
    name: decodeURIComponent(name),
    phone,
    address: decodeURIComponent(address),
    zone
  };

  document.getElementById('order-cust-dropdown').classList.add('hidden');
  document.getElementById('order-cust-search').value = selectedCustomer.name;

  document.getElementById('sel-cust-name').innerText = selectedCustomer.name;
  document.getElementById('sel-cust-phone').innerText = selectedCustomer.phone;
  document.getElementById('sel-cust-address').innerText = selectedCustomer.address;
  document.getElementById('sel-cust-zone').innerText = selectedCustomer.zone;
  document.getElementById('selected-cust-card').classList.remove('hidden');

  document.getElementById('modal-new-order').classList.remove('hidden');
}

function addGarmentItem() {
  const gSelect = document.getElementById('quick-garment-select');
  const sSelect = document.getElementById('quick-service-select');
  const stainNote = document.getElementById('quick-stain-note').value;

  const garmentName = gSelect.value;
  const service = sSelect.value;
  const opt = gSelect.options[gSelect.selectedIndex];

  let rate = service === 'Dry Clean' ? parseInt(opt.getAttribute('data-dry'), 10) : parseInt(opt.getAttribute('data-wash'), 10);
  if (!rate || rate === 0) rate = 50;

  currentNewOrderItems.push({
    garmentName,
    service,
    rate,
    specialNote: stainNote,
    hasStain: Boolean(stainNote)
  });

  document.getElementById('quick-stain-note').value = '';
  renderOrderItemsTable();
}

function removeGarmentItem(index) {
  currentNewOrderItems.splice(index, 1);
  renderOrderItemsTable();
}

function renderOrderItemsTable() {
  const tbody = document.getElementById('order-items-table');
  const countSpan = document.getElementById('order-items-count');
  countSpan.innerText = currentNewOrderItems.length;

  if (currentNewOrderItems.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-slate-400">No garments added yet. Use the selector above.</td></tr>`;
    recalculateOrderTotal();
    return;
  }

  tbody.innerHTML = currentNewOrderItems.map((item, idx) => `
    <tr>
      <td class="p-2.5 font-bold font-mono">${idx + 1}</td>
      <td class="p-2.5 font-semibold text-[#1E293B]">${item.garmentName}</td>
      <td class="p-2.5">${item.service}</td>
      <td class="p-2.5">${item.hasStain ? `<span class="text-[#E11900] font-semibold">${item.specialNote}</span>` : '—'}</td>
      <td class="p-2.5 text-right font-bold font-mono">₹${item.rate}</td>
      <td class="p-2.5 text-right">
        <button onclick="removeGarmentItem(${idx})" class="text-neutral-500 hover:text-[#1E293B] font-semibold text-xs">Remove</button>
      </td>
    </tr>
  `).join('');

  recalculateOrderTotal();
}

function recalculateOrderTotal() {
  const isExpress = document.getElementById('order-express-check').checked;
  let subtotal = currentNewOrderItems.reduce((sum, item) => sum + item.rate, 0);
  if (isExpress) {
    subtotal = Math.round(subtotal * 1.5);
  }
  document.getElementById('order-total-amount').innerText = `₹${subtotal}`;
}

async function submitNewOrder() {
  if (!selectedCustomer) {
    alert('Please select or search for a customer first.');
    return;
  }
  if (currentNewOrderItems.length === 0) {
    alert('Please add at least 1 garment to the order.');
    return;
  }

  const isExpress = document.getElementById('order-express-check').checked;

  if (isStaticMode) {
    let subtotal = currentNewOrderItems.reduce((sum, i) => sum + i.rate, 0);
    if (isExpress) subtotal = Math.round(subtotal * 1.5);

    const nextIdNum = 1000 + mockDb.orders.length + 1;
    const now = new Date();
    const promised = new Date(now.getTime() + (isExpress ? 24 : 48) * 3600 * 1000);

    const newOrder = {
      id: `ORD-${nextIdNum}`,
      customerId: selectedCustomer.id,
      customerName: selectedCustomer.name,
      customerPhone: selectedCustomer.phone,
      customerAddress: selectedCustomer.address,
      zone: selectedCustomer.zone,
      status: 'RECEIVED_IN_STORE',
      isExpress,
      totalPieces: currentNewOrderItems.length,
      items: currentNewOrderItems.map((item, idx) => ({ ...item, pieceNumber: idx + 1 })),
      subtotal,
      paymentStatus: 'PENDING',
      paymentMode: 'COD / UPI on Delivery',
      createdAt: now.toISOString(),
      promisedDelivery: promised.toISOString(),
      assignedWasher: 'Suresh Care Master'
    };

    mockDb.orders.unshift(newOrder);
    saveDemoState();
    closeNewOrderModal();
    await refreshAll();
    await previewThermalTags(newOrder.id);
    return;
  }

  try {
    const res = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customerId: selectedCustomer.id,
        customerName: selectedCustomer.name,
        customerPhone: selectedCustomer.phone,
        customerAddress: selectedCustomer.address,
        zone: selectedCustomer.zone,
        items: currentNewOrderItems,
        isExpress
      })
    });
    const newOrder = await res.json();
    closeNewOrderModal();
    await refreshAll();
    await previewThermalTags(newOrder.id);
  } catch (err) {
    console.error(err);
    alert('Failed to save order.');
  }
}

// -------------------------------------------------------------
// NEW CUSTOMER MODAL
// -------------------------------------------------------------
function openNewCustomerModal() {
  document.getElementById('modal-new-customer').classList.remove('hidden');
}

function closeNewCustomerModal() {
  document.getElementById('modal-new-customer').classList.add('hidden');
}

async function submitNewCustomer() {
  const name = document.getElementById('new-cust-name').value.trim();
  const phone = document.getElementById('new-cust-phone').value.trim();
  const address = document.getElementById('new-cust-address').value.trim();
  const zone = document.getElementById('new-cust-zone').value;

  if (!name || !phone || !address) {
    alert('Name, phone, and address are required.');
    return;
  }

  if (isStaticMode) {
    const newId = `CUST-${(mockDb.customers.length + 1).toString().padStart(4, '0')}`;
    const newCust = {
      id: newId,
      name,
      phone,
      address,
      zone,
      totalOrders: 0,
      loyaltyPoints: 0,
      preferredService: 'Wash & Steam Iron',
      createdAt: new Date().toISOString()
    };
    mockDb.customers.unshift(newCust);
    saveDemoState();
    closeNewCustomerModal();
    alert(`Customer ${newCust.name} (${newCust.id}) registered successfully!`);
    selectCustomerForOrder(newCust.id, encodeURIComponent(newCust.name), newCust.phone, encodeURIComponent(newCust.address), newCust.zone);
    await refreshAll();
    return;
  }

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, address, zone })
    });
    const newCust = await res.json();
    closeNewCustomerModal();
    alert(`Customer ${newCust.name} (${newCust.id}) registered successfully!`);
    selectCustomerForOrder(newCust.id, encodeURIComponent(newCust.name), newCust.phone, encodeURIComponent(newCust.address), newCust.zone);
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------
// STATUS ADVANCEMENT HELPER
// -------------------------------------------------------------
async function updateOrderStatus(orderId, newStatus) {
  if (isStaticMode) {
    const order = mockDb.orders.find(o => o.id === orderId);
    if (order) order.status = newStatus;
    saveDemoState();
    broadcastHandoverNotification(orderId, newStatus);
    await refreshAll();
    if (newStatus === 'PACKED') {
      openWhatsAppReadyModal(orderId);
    }
    return;
  }
  try {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    broadcastHandoverNotification(orderId, newStatus);
    await refreshAll();
    if (newStatus === 'PACKED') {
      openWhatsAppReadyModal(orderId);
    }
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------
// BULK CUSTOMER EXCEL UPLOAD HANDLERS
// -------------------------------------------------------------
let selectedExcelFile = null;

function openExcelUploadModal() {
  selectedExcelFile = null;
  const fileInput = document.getElementById('excel-file-input');
  if (fileInput) fileInput.value = '';

  const filenameEl = document.getElementById('excel-selected-filename');
  if (filenameEl) {
    filenameEl.innerText = '';
    filenameEl.classList.add('hidden');
  }

  const resultBox = document.getElementById('excel-upload-result');
  if (resultBox) resultBox.classList.add('hidden');

  const btnSubmit = document.getElementById('btn-submit-excel');
  if (btnSubmit) btnSubmit.disabled = true;

  document.getElementById('modal-excel-upload').classList.remove('hidden');
  setupExcelDropZone();
  lucide.createIcons();
}

function closeExcelUploadModal() {
  document.getElementById('modal-excel-upload').classList.add('hidden');
}

function handleExcelFileSelected(event) {
  const file = event.target.files[0];
  if (file) {
    processSelectedExcelFile(file);
  }
}

function processSelectedExcelFile(file) {
  selectedExcelFile = file;
  const filenameEl = document.getElementById('excel-selected-filename');
  filenameEl.innerText = `${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
  filenameEl.classList.remove('hidden');

  document.getElementById('btn-submit-excel').disabled = false;
  document.getElementById('excel-upload-result').classList.add('hidden');
}

function setupExcelDropZone() {
  const dropZone = document.getElementById('excel-drop-zone');
  if (!dropZone || dropZone.dataset.setup) return;
  dropZone.dataset.setup = 'true';

  ['dragenter', 'dragover'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.add('border-[#A6CE39]', 'bg-[#EEF4E3]');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-[#A6CE39]', 'bg-[#EEF4E3]');
    }, false);
  });

  dropZone.addEventListener('drop', (e) => {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
      processSelectedExcelFile(files[0]);
    }
  }, false);
}

async function uploadExcelFile() {
  if (!selectedExcelFile) {
    alert('Please select an Excel or CSV file to upload.');
    return;
  }

  const btn = document.getElementById('btn-submit-excel');
  const originalHtml = btn.innerHTML;
  btn.disabled = true;
  btn.innerHTML = `<i data-lucide="loader-2" class="w-3.5 h-3.5 animate-spin inline-block mr-1"></i> Uploading & Processing...`;
  lucide.createIcons();

  // CLIENT-SIDE PARSING (GitHub Pages Demo Mode via SheetJS)
  if (isStaticMode && typeof XLSX !== 'undefined') {
    try {
      const reader = new FileReader();
      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });

        let newCount = 0;
        let updatedCount = 0;

        rows.forEach(row => {
          const getVal = (keys) => {
            for (const k of Object.keys(row)) {
              const clean = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
              if (keys.includes(clean)) return String(row[k]).trim();
            }
            return '';
          };

          const name = getVal(['name', 'customername', 'fullname', 'clientname', 'customer']);
          let phone = getVal(['phone', 'mobile', 'contact', 'phonenumber', 'mobilenumber']);
          const address = getVal(['address', 'deliveryaddress', 'location']);
          const zone = getVal(['zone', 'sector', 'area']) || 'Sector 15 - North';

          if (!name && !phone) return;
          if (phone && !phone.startsWith('+')) {
            const digits = phone.replace(/\D/g, '');
            if (digits.length === 10) phone = `+91 ${digits}`;
          }

          const existingIdx = mockDb.customers.findIndex(c => c.phone && phone && c.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));
          if (existingIdx !== -1) {
            if (name) mockDb.customers[existingIdx].name = name;
            if (address) mockDb.customers[existingIdx].address = address;
            if (zone) mockDb.customers[existingIdx].zone = zone;
            updatedCount++;
          } else {
            const newId = `CUST-${(mockDb.customers.length + 1).toString().padStart(4, '0')}`;
            mockDb.customers.unshift({
              id: newId,
              name: name || `Customer ${newId}`,
              phone: phone || '+91 0000000000',
              address: address || 'Store Area, Gurugram',
              zone,
              totalOrders: 0,
              loyaltyPoints: 0,
              preferredService: 'Wash & Steam Iron',
              createdAt: new Date().toISOString()
            });
            newCount++;
          }
        });

        saveDemoState();
        document.getElementById('excel-stat-new').innerText = newCount;
        document.getElementById('excel-stat-updated').innerText = updatedCount;
        document.getElementById('excel-stat-total').innerText = mockDb.customers.length.toLocaleString('en-IN');
        document.getElementById('excel-upload-result').classList.remove('hidden');

        await refreshAll();
        searchCustomers('');

        btn.innerHTML = `Imported Successfully`;
        setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 2000);
      };
      reader.readAsArrayBuffer(selectedExcelFile);
      return;
    } catch (err) {
      console.error(err);
    }
  }

  // Node.js Backend Upload
  try {
    const formData = new FormData();
    formData.append('file', selectedExcelFile);

    const res = await fetch('/api/customers/upload-excel', {
      method: 'POST',
      body: formData
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Failed to process file');

    document.getElementById('excel-stat-new').innerText = data.newCount;
    document.getElementById('excel-stat-updated').innerText = data.updatedCount;
    document.getElementById('excel-stat-total').innerText = data.totalCustomers.toLocaleString('en-IN');
    document.getElementById('excel-upload-result').classList.remove('hidden');

    await refreshAll();
    searchCustomers('');

    btn.innerHTML = `Imported Successfully`;
    setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 2000);
    lucide.createIcons();
  } catch (err) {
    console.error('Error uploading excel:', err);
    alert(`Upload failed: ${err.message}`);
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

// -------------------------------------------------------------
// FLEET RADAR & ANTI-SLACKING TRACKER
// -------------------------------------------------------------
async function fetchFleet() {
  if (isStaticMode) {
    allRiders = mockDb.riders || [];
    renderFleetCards(allRiders);
    renderFleetAuditTable(allRiders);
    return;
  }
  try {
    const res = await fetch('/api/fleet');
    allRiders = await res.json();
    renderFleetCards(allRiders);
    renderFleetAuditTable(allRiders);
  } catch (err) {
    console.error('Error fetching fleet:', err);
  }
}

function renderFleetCards(riders) {
  const container = document.getElementById('admin-fleet-cards');
  if (!container) return;

  container.innerHTML = riders.map(r => {
    const isOverdue = r.status === 'OVERDUE_RETURN';
    const isReturning = r.status === 'RETURNING_TO_STORE';
    const isIdle = r.status === 'IDLE_AT_STORE';

    let statusBadge = '';
    if (isOverdue) {
      statusBadge = `<span class="bg-red-50 text-[#E11900] border border-red-200 text-[10px] font-bold px-2.5 py-0.5 rounded-full">Delayed (+${r.currentRun ? r.currentRun.unaccountedGapMinutes : 12}m)</span>`;
    } else if (isReturning) {
      statusBadge = `<span class="bg-[#EEF4E3] text-[#1E293B] text-[10px] font-semibold px-2.5 py-0.5 rounded-full">En Route</span>`;
    } else if (isIdle) {
      statusBadge = `<span class="bg-[#F3F9E4] text-[#5A7812] text-[10px] font-semibold px-2.5 py-0.5 rounded-full">Available</span>`;
    } else {
      statusBadge = `<span class="bg-[#EEF4E3] text-neutral-800 text-[10px] font-semibold px-2.5 py-0.5 rounded-full">In Transit</span>`;
    }

    return `
      <div class="bg-white p-4 rounded-2xl border ${isOverdue ? 'border-red-300 ring-1 ring-red-200' : 'border-[#E2E8D5]'} shadow-sm space-y-3">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-3">
            <div class="w-9 h-9 rounded-full ${isOverdue ? 'bg-[#E11900] text-white' : isIdle ? 'bg-[#A6CE39] text-[#1E3304]' : 'bg-[#1E3304] text-[#A6CE39]'} flex items-center justify-center font-bold text-xs">
              ${r.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div class="flex items-center space-x-1.5">
                <h4 class="font-bold text-[#1E293B] text-sm">${r.name}</h4>
                <span class="text-[10px] text-neutral-500 font-mono">(${r.vehicle})</span>
              </div>
              <div class="text-[11px] text-neutral-500">${r.phone}</div>
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="p-3 bg-[#F8FAF3] rounded-xl border border-[#EEF4E3] text-xs space-y-1.5">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-neutral-700 truncate"><strong>Location:</strong> ${r.location.address}</span>
            <span class="text-neutral-500 font-mono shrink-0 font-semibold">${r.location.batteryLevel}</span>
          </div>

          ${r.currentRun ? `
            <div class="pt-1.5 border-t border-[#E2E8D5] flex items-center justify-between text-[11px] text-neutral-600">
              <span>Run: <strong>${r.currentRun.zone}</strong> (${r.currentRun.totalOrders} orders)</span>
              <span>Due: <strong class="${isOverdue ? 'text-[#E11900] font-bold' : 'text-[#1E293B]'}">${new Date(r.currentRun.expectedReturnAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></span>
            </div>
            ${isOverdue ? `
              <div class="p-2 bg-red-50 text-[#E11900] text-[11px] rounded-lg font-semibold border border-red-100">
                Transit Gap: Completed delivery 25m ago. Delayed by +${r.currentRun.unaccountedGapMinutes}m.
              </div>
            ` : ''}
          ` : `
            <div class="pt-1 text-[11px] text-[#5A7812] font-bold">Available at store. Standby.</div>
          `}
        </div>

        <div class="flex items-center justify-between pt-1">
          <span class="text-[10px] text-neutral-500">Punctuality: <strong class="text-[#1E293B] font-semibold">${r.todayStats.integrityScore}%</strong></span>
          <div class="flex space-x-2">
            ${isOverdue ? `
              <button onclick="sendRiderWarning('${r.id}')" class="px-3.5 py-1.5 bg-[#E11900] hover:bg-red-700 text-white rounded-full text-xs font-semibold flex items-center space-x-1 transition">
                <i data-lucide="bell-ring" class="w-3.5 h-3.5"></i>
                <span>Send Alert</span>
              </button>
            ` : ''}
            ${!isIdle ? `
              <button onclick="checkInAtStoreCounter('${r.id}')" class="px-3.5 py-1.5 bg-[#2D5A1E] hover:bg-[#234717] text-[#A6CE39] rounded-full text-xs font-bold flex items-center space-x-1 transition">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>Check In</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');
  lucide.createIcons();
}

function renderFleetAuditTable(riders) {
  const tbody = document.getElementById('fleet-audit-table');
  if (!tbody) return;

  tbody.innerHTML = riders.map(r => {
    const isGood = r.todayStats.integrityScore >= 90;
    return `
      <tr class="hover:bg-[#F8FAF3] transition-colors border-b border-[#EEF4E3]">
        <td class="p-3 font-semibold text-[#1E293B]">${r.name}</td>
        <td class="p-3 text-neutral-500 font-mono text-[11px]">${r.vehicle}</td>
        <td class="p-3 font-semibold text-[#1E293B]">${r.todayStats.completedRuns} Trips</td>
        <td class="p-3">
          <span class="font-semibold ${r.todayStats.delayedReturns > 0 ? 'text-[#FFC043]' : 'text-[#A6CE39]'}">
            ${Math.round((r.todayStats.onTimeRuns / Math.max(1, r.todayStats.completedRuns)) * 100)}%
          </span>
          <span class="text-[10px] text-neutral-400 block">${r.todayStats.delayedReturns} delayed</span>
        </td>
        <td class="p-3 font-mono ${r.todayStats.totalUnaccountedGapMins > 0 ? 'text-[#E11900] font-semibold' : 'text-neutral-500'}">
          ${r.todayStats.totalUnaccountedGapMins > 0 ? `+${r.todayStats.totalUnaccountedGapMins}m` : '0m'}
        </td>
        <td class="p-3 text-right font-bold ${isGood ? 'text-[#A6CE39]' : 'text-[#FFC043]'}">
          ${r.todayStats.integrityScore} / 100
        </td>
      </tr>
    `;
  }).join('');
}

async function sendRiderWarning(riderId) {
  if (isStaticMode) {
    const rider = mockDb.riders.find(r => r.id === riderId);
    if (!rider) return;
    const msg = `ALERT from Bumbledry Store Manager: Your Sector 14 delivery run was completed 25 minutes ago. Next batch of 3 customer orders is packed and waiting. Please report back to the store immediately.`;
    alert(`WhatsApp Warning dispatched to ${rider.name} (${rider.phone})!\n\n"${msg}"`);
    return;
  }
  try {
    const res = await fetch('/api/fleet/send-warning', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riderId })
    });
    const data = await res.json();
    alert(`WhatsApp Warning dispatched to ${data.riderName} (${data.sentTo})!\n\n"${data.message}"`);
  } catch (err) {
    console.error(err);
  }
}

async function checkInAtStoreCounter(riderId) {
  if (isStaticMode) {
    const rider = mockDb.riders.find(r => r.id === riderId);
    if (!rider) return;
    rider.todayStats.completedRuns += 1;
    rider.todayStats.delayedReturns += 1;
    rider.todayStats.totalUnaccountedGapMins += 11;
    rider.todayStats.integrityScore = Math.max(50, rider.todayStats.integrityScore - 5);
    rider.status = 'IDLE_AT_STORE';
    rider.currentRun = null;
    rider.location.address = 'At Store (Sector 15 Market Counter)';
    saveDemoState();
    alert('Trip closed with 11 min unaccounted transit gap logged in owner audit.');
    await refreshAll();
    return;
  }
  try {
    const res = await fetch('/api/fleet/check-in-store', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ riderId })
    });
    const data = await res.json();
    alert(data.message);
    await refreshAll();
  } catch (err) {
    console.error(err);
  }
}


// =================================================================
// MULTI-STORE FRANCHISE & ONBOARDING SYSTEM (STORE-IN-A-BOX)
// =================================================================
const defaultFranchiseStores = [
  {
    id: 'STORE-101',
    code: '101',
    name: 'Sector 15 Flagship',
    city: 'Gurugram',
    address: 'Shop 4B, Main Market, Sector 15, Gurugram, Haryana - 122001',
    phone: '+91 98765 43210',
    manager: 'Aakash Sharma',
    gstin: '06AAAAA0000A1Z5',
    upiVpa: 'bumbledry.sec15@icici',
    geofenceKm: 5.0,
    dailyTarget: 15000,
    activeRiders: 2,
    workshopStaff: 3
  },
  {
    id: 'STORE-102',
    code: '102',
    name: 'Cyber City Hub',
    city: 'Gurugram',
    address: 'DLF Cyber City, Building 10 Ground Arcade, Gurugram - 122002',
    phone: '+91 98111 22334',
    manager: 'Pooja Mehta',
    gstin: '06BBBBB1111B2Z6',
    upiVpa: 'bumbledry.cyber@hdfcbank',
    geofenceKm: 4.0,
    dailyTarget: 22000,
    activeRiders: 3,
    workshopStaff: 4
  },
  {
    id: 'STORE-103',
    code: '103',
    name: 'Indirapuram Central',
    city: 'Ghaziabad',
    address: 'Plot 12, Aditya Mall Commercial Complex, Indirapuram - 201014',
    phone: '+91 99222 33445',
    manager: 'Vikas Gupta',
    gstin: '09CCCCC2222C3Z7',
    upiVpa: 'bumbledry.ind@sbi',
    geofenceKm: 6.0,
    dailyTarget: 18000,
    activeRiders: 2,
    workshopStaff: 3
  }
];

const defaultFranchiseRates = [
  { service: 'Wash & Fold (Laundry)', unit: 'Per Kilogram', sla: '24 Hours', rate: 79 },
  { service: 'Wash & Steam Iron (Signature)', unit: 'Per Kilogram', sla: '24 Hours', rate: 109 },
  { service: 'Formal Shirt / Trouser Dry Clean', unit: 'Per Piece', sla: '48 Hours', rate: 149 },
  { service: '2-Piece Men Suit / Blazer Care', unit: 'Per Set', sla: '48 Hours', rate: 399 },
  { service: 'Deluxe Silk Saree / Lehenga Care', unit: 'Per Piece', sla: '72 Hours', rate: 349 },
  { service: 'Premium Sneaker & Shoe Spa', unit: 'Per Pair', sla: '48 Hours', rate: 299 },
  { service: 'Heavy Blanket / Quilt Sanitization', unit: 'Per Piece', sla: '48 Hours', rate: 399 }
];

let franchiseStores = [...defaultFranchiseStores];
let activeStoreId = 'STORE-101';
let standardFranchiseRates = [...defaultFranchiseRates];
let currentCorridorFilter = 'all';

function initFranchiseStores() {
  const savedStores = localStorage.getItem('bumbledry_franchise_stores');
  if (savedStores) {
    try { franchiseStores = JSON.parse(savedStores); } catch (e) {}
  }
  const savedActive = localStorage.getItem('bumbledry_active_store_id');
  if (savedActive && franchiseStores.some(s => s.id === savedActive)) {
    activeStoreId = savedActive;
  }
  const savedRates = localStorage.getItem('bumbledry_standard_rates');
  if (savedRates) {
    try { standardFranchiseRates = JSON.parse(savedRates); } catch (e) {}
  }
}

function getActiveStore() {
  return franchiseStores.find(s => s.id === activeStoreId) || franchiseStores[0];
}

function updateStoreHeaderDisplay() {
  const store = getActiveStore();
  const nameEl = document.getElementById('header-store-name');
  const codeEl = document.getElementById('header-store-code');
  const statusEl = document.getElementById('status-store-label');

  if (nameEl) nameEl.innerText = store.name;
  if (codeEl) codeEl.innerText = `#${store.code}`;
  if (statusEl) statusEl.innerText = `${store.name} (${store.city})`;
}

function switchActiveBranch(storeId) {
  const target = franchiseStores.find(s => s.id === storeId);
  if (!target) return;
  activeStoreId = storeId;
  localStorage.setItem('bumbledry_active_store_id', storeId);
  updateStoreHeaderDisplay();
  closeStoreProfileModal();
  refreshAll();
  lucide.createIcons();
}

function openStoreProfileModal() {
  const modal = document.getElementById('modal-store-profile');
  if (!modal) return;

  const store = getActiveStore();
  const branchGrid = document.getElementById('modal-branch-selector-grid');
  if (branchGrid) {
    branchGrid.innerHTML = franchiseStores.map(s => {
      const isSelected = s.id === activeStoreId;
      return `
        <button type="button" onclick="switchActiveBranch('${s.id}')" class="p-2.5 rounded-xl text-left border transition-all ${isSelected ? 'bg-[#EEF4E3] border-[#A6CE39] ring-1 ring-[#A6CE39]' : 'bg-[#F8FAF3] border-[#E2E8D5] hover:border-[#A6CE39]'}">
          <div class="flex items-center justify-between">
            <span class="font-bold text-[#1E293B] text-xs">${s.name}</span>
            <span class="text-[9px] font-mono px-1 rounded ${isSelected ? 'bg-[#1E3304] text-[#A6CE39]' : 'bg-[#E2E8D5] text-[#545454]'}">#${s.code}</span>
          </div>
          <div class="text-[10px] text-[#545454] truncate mt-0.5">${s.city} • ${s.manager}</div>
        </button>
      `;
    }).join('');
  }

  // Populate form fields
  const nameInput = document.getElementById('store-name-input');
  const codeInput = document.getElementById('store-code-input');
  const phoneInput = document.getElementById('store-phone-input');
  const upiInput = document.getElementById('store-upi-input');
  const addrInput = document.getElementById('store-address-input');
  const gstinInput = document.getElementById('store-gstin-input');
  const radInput = document.getElementById('store-radius-input');

  if (nameInput) nameInput.value = store.name || '';
  if (codeInput) codeInput.value = store.code || '';
  if (phoneInput) phoneInput.value = store.phone || '';
  if (upiInput) upiInput.value = store.upiVpa || '';
  if (addrInput) addrInput.value = store.address || '';
  if (gstinInput) gstinInput.value = store.gstin || '';
  if (radInput) radInput.value = store.geofenceKm || 5;

  modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeStoreProfileModal() {
  const modal = document.getElementById('modal-store-profile');
  if (modal) modal.classList.add('hidden');
}

function saveStoreProfile(e) {
  if (e) e.preventDefault();
  const store = getActiveStore();
  if (!store) return;

  const nameInput = document.getElementById('store-name-input');
  const codeInput = document.getElementById('store-code-input');
  const phoneInput = document.getElementById('store-phone-input');
  const upiInput = document.getElementById('store-upi-input');
  const addrInput = document.getElementById('store-address-input');
  const gstinInput = document.getElementById('store-gstin-input');
  const radInput = document.getElementById('store-radius-input');

  if (nameInput) store.name = nameInput.value.trim();
  if (codeInput) store.code = codeInput.value.trim();
  if (phoneInput) store.phone = phoneInput.value.trim();
  if (upiInput) store.upiVpa = upiInput.value.trim();
  if (addrInput) store.address = addrInput.value.trim();
  if (gstinInput) store.gstin = gstinInput.value.trim();
  if (radInput) store.geofenceKm = parseFloat(radInput.value) || 5;

  localStorage.setItem('bumbledry_franchise_stores', JSON.stringify(franchiseStores));
  updateStoreHeaderDisplay();
  closeStoreProfileModal();
  renderFranchiseHub();
  alert('Store profile updated successfully!');
}

function openOnboardFranchiseModal() {
  closeStoreProfileModal();
  const modal = document.getElementById('modal-onboard-franchise');
  if (modal) modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeOnboardFranchiseModal() {
  const modal = document.getElementById('modal-onboard-franchise');
  if (modal) modal.classList.add('hidden');
}

function handleOnboardFranchise(e) {
  if (e) e.preventDefault();
  const name = document.getElementById('new-branch-name').value.trim();
  const city = document.getElementById('new-branch-city').value.trim();
  const code = document.getElementById('new-branch-code').value.trim();
  const address = document.getElementById('new-branch-address').value.trim();
  const manager = document.getElementById('new-branch-manager').value.trim();
  const phone = document.getElementById('new-branch-phone').value.trim();

  const newStore = {
    id: `STORE-${code}`,
    code: code,
    name: name,
    city: city,
    address: address,
    phone: phone,
    manager: manager,
    gstin: `06AAAAA${code}00A1Z5`,
    upiVpa: `bumbledry.${code.toLowerCase()}@icici`,
    geofenceKm: 5.0,
    dailyTarget: 20000,
    activeRiders: 2,
    workshopStaff: 3
  };

  franchiseStores.push(newStore);
  localStorage.setItem('bumbledry_franchise_stores', JSON.stringify(franchiseStores));
  closeOnboardFranchiseModal();
  switchActiveBranch(newStore.id);
  alert(`Congratulations! Franchise Branch "${name}" has been onboarded and launched!`);
}

function renderFranchiseHub() {
  const grid = document.getElementById('franchise-stores-grid');
  if (grid) {
    grid.innerHTML = franchiseStores.map(s => {
      const isSelected = s.id === activeStoreId;
      return `
        <div class="bg-white p-4 rounded-2xl border transition-all ${isSelected ? 'border-[#A6CE39] ring-2 ring-[#A6CE39]/30 bg-[#F8FAF3]' : 'border-[#E2E8D5] hover:border-[#A6CE39]'} space-y-3">
          <div class="flex items-start justify-between">
            <div>
              <div class="flex items-center space-x-1.5">
                <span class="font-black text-[#1E293B] text-sm">${s.name}</span>
                <span class="text-[9px] font-mono px-1.5 py-0.2 rounded-full font-bold ${isSelected ? 'bg-[#1E3304] text-[#A6CE39]' : 'bg-[#EEF4E3] text-[#2D5A1E]'}">#${s.code}</span>
              </div>
              <p class="text-[11px] text-[#545454] mt-0.5">${s.city}</p>
            </div>
            ${isSelected ? '<span class="text-[10px] bg-[#A6CE39] text-[#1E3304] font-black px-2 py-0.5 rounded-full">ACTIVE</span>' : ''}
          </div>

          <div class="text-[11px] text-[#545454] space-y-1 bg-white p-2.5 rounded-xl border border-[#EEF4E3]">
            <div><strong>Manager:</strong> ${s.manager} (${s.phone})</div>
            <div><strong>UPI VPA:</strong> <code class="font-mono text-[#1E3304]">${s.upiVpa || 'bumbledry@bank'}</code></div>
            <div><strong>Coverage:</strong> ${s.geofenceKm} KM Radius</div>
          </div>

          <div class="pt-1 flex items-center justify-between">
            <span class="text-[11px] text-[#545454]">Fleet: <strong>${s.activeRiders} Riders</strong> • <strong>${s.workshopStaff} Staff</strong></span>
            ${!isSelected ? `
              <button onclick="switchActiveBranch('${s.id}')" class="px-3 py-1 bg-[#EEF4E3] hover:bg-[#A6CE39] text-[#1E3304] rounded-full text-xs font-bold transition-all">
                Switch Branch
              </button>
            ` : `
              <button onclick="openStoreProfileModal()" class="px-3 py-1 bg-white border border-[#E2E8D5] hover:border-[#A6CE39] text-[#1E293B] rounded-full text-xs font-semibold transition-all">
                Edit Profile
              </button>
            `}
          </div>
        </div>
      `;
    }).join('');
  }

  const ratesTable = document.getElementById('franchise-rates-table');
  if (ratesTable) {
    ratesTable.innerHTML = standardFranchiseRates.map((r, i) => `
      <tr class="hover:bg-[#F8FAF3] border-b border-[#EEF4E3]">
        <td class="p-2.5 font-bold text-[#1E293B]">${r.service}</td>
        <td class="p-2.5 text-[#545454]">${r.unit}</td>
        <td class="p-2.5 text-[#545454] font-medium">${r.sla}</td>
        <td class="p-2.5 text-right">
          <input type="number" id="rate-input-${i}" value="${r.rate}" class="w-20 px-2 py-1 bg-[#F8FAF3] border border-[#E2E8D5] rounded-lg text-xs font-mono font-bold text-right text-[#1E293B] focus:ring-1 focus:ring-[#A6CE39] focus:outline-none">
        </td>
      </tr>
    `).join('');
  }
}

function saveStoreRateCard() {
  standardFranchiseRates.forEach((r, i) => {
    const input = document.getElementById(`rate-input-${i}`);
    if (input) {
      r.rate = parseInt(input.value, 10) || r.rate;
    }
  });
  localStorage.setItem('bumbledry_standard_rates', JSON.stringify(standardFranchiseRates));
  alert('Franchise Price Master updated successfully!');
}

function exportStoreDataJson() {
  const exportPayload = {
    store: getActiveStore(),
    allStores: franchiseStores,
    orders: allOrders,
    leads: allLeads,
    catalog: standardFranchiseRates,
    exportedAt: new Date().toISOString()
  };

  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `bumbledry_${getActiveStore().code}_backup.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function importStoreDataJson(event) {
  const file = event.target.files && event.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (data.allStores) franchiseStores = data.allStores;
      if (data.store) activeStoreId = data.store.id;
      if (data.orders) allOrders = data.orders;
      if (data.catalog) standardFranchiseRates = data.catalog;

      localStorage.setItem('bumbledry_franchise_stores', JSON.stringify(franchiseStores));
      localStorage.setItem('bumbledry_active_store_id', activeStoreId);
      updateStoreHeaderDisplay();
      refreshAll();
      alert('Store data and franchise settings imported successfully!');
    } catch (err) {
      alert('Invalid store backup JSON file format.');
    }
  };
  reader.readAsText(file);
}

// =================================================================
// DAILY CASH & EOD RECONCILIATION ENGINE
// =================================================================
function renderAdminReconciliation() {
  const delivered = allOrders.filter(o => o.status === 'DELIVERED');
  const activeWorkshop = allOrders.filter(o => ['WASHING', 'DRYING', 'IRONING'].includes(o.status));
  const packed = allOrders.filter(o => o.status === 'PACKED');
  const totalBilled = allOrders.reduce((sum, o) => sum + (o.subtotal || 0), 0);

  let cashCollected = 0;
  let digitalCollected = 0;
  delivered.forEach(o => {
    if (o.paymentMode === 'CASH') {
      cashCollected += (o.subtotal || 0);
    } else {
      digitalCollected += (o.subtotal || 0);
    }
  });

  const intakePieces = allOrders.reduce((sum, o) => sum + (o.totalPieces || 0), 0);
  const packedPieces = packed.reduce((sum, o) => sum + (o.totalPieces || 0), 0);
  const deliveredPieces = delivered.reduce((sum, o) => sum + (o.totalPieces || 0), 0);
  const overnightPieces = activeWorkshop.reduce((sum, o) => sum + (o.totalPieces || 0), 0);

  const bEl = document.getElementById('eod-stat-billed');
  const cEl = document.getElementById('eod-stat-cash');
  const dEl = document.getElementById('eod-stat-digital');
  const oEl = document.getElementById('eod-stat-overnight');
  const countEl = document.getElementById('eod-stat-order-count');

  if (bEl) bEl.innerText = `₹${totalBilled.toLocaleString('en-IN')}`;
  if (cEl) cEl.innerText = `₹${cashCollected.toLocaleString('en-IN')}`;
  if (dEl) dEl.innerText = `₹${digitalCollected.toLocaleString('en-IN')}`;
  if (oEl) oEl.innerText = `${overnightPieces} pcs`;
  if (countEl) countEl.innerText = allOrders.length;

  const inP = document.getElementById('eod-intake-pieces');
  const pkP = document.getElementById('eod-packed-pieces');
  const dlP = document.getElementById('eod-delivered-pieces');
  const ovP = document.getElementById('eod-overnight-pieces');

  if (inP) inP.innerText = `${intakePieces} pcs`;
  if (pkP) pkP.innerText = `${packedPieces} pcs`;
  if (dlP) dlP.innerText = `${deliveredPieces} pcs`;
  if (ovP) ovP.innerText = `${overnightPieces} pcs`;

  const expectedDrawerEl = document.getElementById('drawer-expected-total');
  if (expectedDrawerEl) expectedDrawerEl.innerText = `₹${cashCollected.toLocaleString('en-IN')}`;

  calculateEodCashDrawer();
}

function calculateEodCashDrawer() {
  const n500 = parseInt(document.getElementById('denom-500')?.value || '0', 10) || 0;
  const n200 = parseInt(document.getElementById('denom-200')?.value || '0', 10) || 0;
  const n100 = parseInt(document.getElementById('denom-100')?.value || '0', 10) || 0;
  const nCoins = parseInt(document.getElementById('denom-coins')?.value || '0', 10) || 0;

  const t500 = n500 * 500;
  const t200 = n200 * 200;
  const t100 = n100 * 100;
  const tCoins = nCoins;

  const totalCounted = t500 + t200 + t100 + tCoins;

  const el500 = document.getElementById('denom-total-500');
  const el200 = document.getElementById('denom-total-200');
  const el100 = document.getElementById('denom-total-100');
  const elCoins = document.getElementById('denom-total-coins');
  const countedEl = document.getElementById('drawer-counted-total');
  const alertEl = document.getElementById('drawer-variance-alert');

  if (el500) el500.innerText = `₹${t500.toLocaleString('en-IN')}`;
  if (el200) el200.innerText = `₹${t200.toLocaleString('en-IN')}`;
  if (el100) el100.innerText = `₹${t100.toLocaleString('en-IN')}`;
  if (elCoins) elCoins.innerText = `₹${tCoins.toLocaleString('en-IN')}`;
  if (countedEl) countedEl.innerText = `₹${totalCounted.toLocaleString('en-IN')}`;

  const expectedStr = (document.getElementById('drawer-expected-total')?.innerText || '0').replace(/[^0-9]/g, '');
  const expectedNum = parseInt(expectedStr, 10) || 0;
  const variance = totalCounted - expectedNum;

  if (alertEl) {
    if (totalCounted === 0 && expectedNum > 0) {
      alertEl.className = 'text-[11px] font-bold p-2.5 rounded-xl text-center bg-[#F8FAF3] text-[#545454]';
      alertEl.innerText = `Enter physical cash notes counted in counter drawer to verify match.`;
    } else if (variance === 0) {
      alertEl.className = 'text-[11px] font-bold p-2.5 rounded-xl text-center bg-[#EEF4E3] text-[#2D5A1E]';
      alertEl.innerText = `Exact match! Physical cash matches system expected collection (₹${totalCounted}).`;
    } else if (variance > 0) {
      alertEl.className = 'text-[11px] font-bold p-2.5 rounded-xl text-center bg-blue-50 text-[#276EF1]';
      alertEl.innerText = `Drawer Surplus: +₹${variance.toLocaleString('en-IN')} excess cash in drawer.`;
    } else {
      alertEl.className = 'text-[11px] font-bold p-2.5 rounded-xl text-center bg-rose-50 text-rose-700';
      alertEl.innerText = `Drawer Shortage: -₹${Math.abs(variance).toLocaleString('en-IN')} cash missing from expected balance!`;
    }
  }
}

function generateStoreCloseWhatsAppSummary() {
  const store = getActiveStore();
  const dateStr = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  const billed = document.getElementById('eod-stat-billed')?.innerText || '₹0';
  const cash = document.getElementById('eod-stat-cash')?.innerText || '₹0';
  const digital = document.getElementById('eod-stat-digital')?.innerText || '₹0';
  const counted = document.getElementById('drawer-counted-total')?.innerText || '₹0';
  const delivered = document.getElementById('eod-delivered-pieces')?.innerText || '0 pcs';
  const overnight = document.getElementById('eod-overnight-pieces')?.innerText || '0 pcs';
  const notes = document.getElementById('eod-manager-notes')?.value || 'All shifts closed cleanly.';

  const waText = 
`*BUMBLEDRY STORE DAILY CLOSE REPORT*
*Branch:* ${store.name} (#${store.code})
*Date:* ${dateStr}
*Manager:* ${store.manager}

*FINANCIAL SUMMARY:*
• Total Orders Billed: ${allOrders.length}
• Total Gross Revenue: ${billed}
• Cash in Drawer: ${counted} (Expected: ${cash})
• Digital / UPI Collections: ${digital}

*GARMENT INVENTORY:*
• Cleared & Delivered: ${delivered}
• Overnight in Workshop: ${overnight}

*MANAGER REMARKS:*
"${notes}"

Verified by Store Console`;

  const textarea = document.getElementById('eod-whatsapp-text');
  if (textarea) textarea.value = waText;

  const modal = document.getElementById('modal-eod-summary');
  if (modal) modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeEodSummaryModal() {
  const modal = document.getElementById('modal-eod-summary');
  if (modal) modal.classList.add('hidden');
}

function copyEodSummaryText() {
  const textarea = document.getElementById('eod-whatsapp-text');
  if (!textarea) return;
  navigator.clipboard.writeText(textarea.value).then(() => {
    const btn = document.getElementById('btn-copy-eod-text');
    if (btn) {
      btn.innerText = 'Copied!';
      setTimeout(() => { btn.innerText = 'Copy Text'; }, 2000);
    }
  });
}

function shareEodViaWhatsApp() {
  const textarea = document.getElementById('eod-whatsapp-text');
  if (!textarea) return;
  const store = getActiveStore();
  const phone = store.phone.replace(/[^0-9]/g, '');
  const url = `https://wa.me/${phone}?text=${encodeURIComponent(textarea.value)}`;
  window.open(url, '_blank');
}

function printEodReconciliationSheet() {
  window.print();
}

// =================================================================
// SMART DIRECTIONAL CORRIDORS & EARLY EXPEDITE
// =================================================================
function filterCorridor(corridor) {
  currentCorridorFilter = corridor;
  ['all', 'north', 'east', 'south'].forEach(c => {
    const btn = document.getElementById(`corridor-tab-${c}`);
    if (!btn) return;
    if (c === corridor.toLowerCase()) {
      btn.className = 'px-2.5 py-1 rounded-full text-[11px] font-bold bg-[#1E3304] text-[#A6CE39]';
    } else {
      btn.className = 'px-2.5 py-1 rounded-full text-[11px] font-medium bg-[#EEF4E3] text-[#545454] hover:text-[#1E293B]';
    }
  });
  renderDispatchRecommendations();
}

async function expediteEarlyOrder(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;
  await updateOrderStatus(orderId, 'PACKED');
  alert(`Order ${orderId} (${order.customerName}) expedited to PACKED in workshop! Ready for rider dispatch.`);
  refreshAll();
}

// =================================================================
// DYNAMIC UPI QR CODE GENERATOR
// =================================================================
function openDynamicUpiQrModal(orderId) {
  const order = allOrders.find(o => o.id === orderId);
  if (!order) return;

  const store = getActiveStore();
  const amount = order.subtotal || 650;
  const vpa = store.upiVpa || 'bumbledry@icici';

  const orderLabel = document.getElementById('qr-order-id-label');
  const amountLabel = document.getElementById('qr-order-amount-label');
  const vpaLabel = document.getElementById('qr-store-vpa-label');
  const container = document.getElementById('qr-canvas-container');

  if (orderLabel) orderLabel.innerText = `Order: ${order.id} • ${order.customerName}`;
  if (amountLabel) amountLabel.innerText = `₹${amount}`;
  if (vpaLabel) vpaLabel.innerText = vpa;

  if (container) {
    container.innerHTML = `
      <svg class="w-36 h-36 text-[#1E3A2F]" viewBox="0 0 100 100" fill="currentColor">
        <path d="M10,10 h24 v24 h-24 z M14,14 v16 h16 v-16 z M18,18 h8 v8 h-8 z" />
        <path d="M66,10 h24 v24 h-24 z M70,14 v16 h16 v-16 z M74,18 h8 v8 h-8 z" />
        <path d="M10,66 h24 v24 h-24 z M14,70 v16 h16 v-16 z M18,74 h8 v8 h-8 z" />
        <rect x="42" y="14" width="6" height="6" />
        <rect x="52" y="14" width="6" height="6" />
        <rect x="42" y="24" width="6" height="6" />
        <rect x="52" y="30" width="6" height="6" />
        <rect x="14" y="44" width="6" height="6" />
        <rect x="24" y="44" width="6" height="6" />
        <rect x="34" y="44" width="6" height="6" />
        <rect x="44" y="44" width="12" height="12" fill="#A6CE39" />
        <rect x="60" y="44" width="6" height="6" />
        <rect x="74" y="44" width="6" height="6" />
        <rect x="84" y="44" width="6" height="6" />
        <rect x="42" y="66" width="6" height="6" />
        <rect x="52" y="66" width="6" height="6" />
        <rect x="66" y="66" width="6" height="6" />
        <rect x="76" y="74" width="6" height="6" />
        <rect x="84" y="84" width="6" height="6" />
        <rect x="42" y="80" width="6" height="6" />
        <rect x="52" y="80" width="6" height="6" />
      </svg>
      <div class="text-[10px] font-mono text-[#545454] font-bold">SCAN WITH ANY UPI APP</div>
    `;
  }

  const modal = document.getElementById('modal-dynamic-upi-qr');
  if (modal) modal.classList.remove('hidden');
  lucide.createIcons();
}

function closeDynamicUpiQrModal() {
  const modal = document.getElementById('modal-dynamic-upi-qr');
  if (modal) modal.classList.add('hidden');
}


// =================================================================
// REAL-TIME PROCESS HANDOVER & NOTIFICATION SYSTEM
// =================================================================
let liveNotifications = [];

const HANDOVER_LEVEL_MAP = {
  'PICKED_UP': {
    from: { role: 'rider', name: 'Rajesh Kumar (Field Rider)' },
    to: { role: 'manager', name: 'Aakash Sharma (Front Desk)' },
    badge: 'FIELD RIDER',
    badgeColor: 'bg-[#EEF4E3] text-[#2D5A1E]',
    action: 'Pickup Completed',
    summary: (order) => `Picked up ${order.totalPieces || 1} pcs from ${order.customerName} in ${order.zone}. Rider returning to counter.`
  },
  'RECEIVED_IN_STORE': {
    from: { role: 'manager', name: 'Aakash Sharma (Front Desk)' },
    to: { role: 'washer', name: 'Ramesh Singh (Washing Lead)' },
    badge: 'FRONT DESK',
    badgeColor: 'bg-[#F8FAF3] text-[#1E293B]',
    action: 'Intake Tagged',
    summary: (order) => `Order #${order.id} (${order.totalPieces || 1} pcs) tagged & queued for Washing Station.`
  },
  'WASHING': {
    from: { role: 'washer', name: 'Ramesh Singh (Washing Lead)' },
    to: { role: 'washer', name: 'Anil Verma (Dry Clean Specialist)' },
    badge: 'WORKSHOP: WASH',
    badgeColor: 'bg-[#EEF4E3] text-[#2D5A1E]',
    action: 'Washing Cycle Started',
    summary: (order) => `Order #${order.id} loaded into commercial washer. Next: Hydro-extraction & Drying.`
  },
  'DRYING': {
    from: { role: 'washer', name: 'Anil Verma (Dry Clean Specialist)' },
    to: { role: 'washer', name: 'Suresh Yadav (Steam Press)' },
    badge: 'WORKSHOP: DRYING',
    badgeColor: 'bg-[#EEF4E3] text-[#2D5A1E]',
    action: 'Drying & Inspection',
    summary: (order) => `Order #${order.id} dried & passed stain inspection. Queued for steam press.`
  },
  'IRONING': {
    from: { role: 'washer', name: 'Anil Verma (Dry Cleaning)' },
    to: { role: 'washer', name: 'Suresh Yadav (Steam Press)' },
    badge: 'WORKSHOP: PRESS',
    badgeColor: 'bg-[#EEF4E3] text-[#2D5A1E]',
    action: 'Steam Ironing Underway',
    summary: (order) => `Steam press & crease finishing in progress for Order #${order.id} (${order.customerName}).`
  },
  'PACKED': {
    from: { role: 'washer', name: 'Suresh Yadav (Steam Press)' },
    to: { role: 'manager', name: 'Aakash Sharma & Field Riders' },
    badge: 'WORKSHOP: PACKED',
    badgeColor: 'bg-[#1E3304] text-[#A6CE39]',
    action: 'Order Packed & Ready',
    summary: (order) => `Quality passed! Order #${order.id} (${order.customerName}, ${order.zone}) is packed on hanger.`
  },
  'OUT_FOR_DELIVERY': {
    from: { role: 'manager', name: 'Aakash Sharma (Front Desk)' },
    to: { role: 'rider', name: 'Rajesh Kumar (Field Rider)' },
    badge: 'DISPATCH',
    badgeColor: 'bg-[#2D5A1E] text-white',
    action: 'Dispatched for Delivery',
    summary: (order) => `Order #${order.id} handed to Rajesh Kumar for doorstep delivery in ${order.zone}.`
  },
  'DELIVERED': {
    from: { role: 'rider', name: 'Rajesh Kumar (Field Rider)' },
    to: { role: 'manager', name: 'Aakash Sharma & Super Admin' },
    badge: 'DELIVERY COMPLETE',
    badgeColor: 'bg-[#A6CE39] text-[#1E3304]',
    action: 'Delivered & Paid',
    summary: (order) => `Delivered to ${order.customerName}. Payment of ₹${order.subtotal} collected (POD uploaded).`
  }
};

function initNotifications() {
  const saved = localStorage.getItem('bumbledry_live_notifications');
  if (saved) {
    try {
      liveNotifications = JSON.parse(saved);
    } catch (e) {}
  }

  // Pre-seed 3 recent realistic handover notifications if empty
  if (!liveNotifications || liveNotifications.length === 0) {
    liveNotifications = [
      {
        id: 'NOTIF-101',
        orderId: 'ORD-1042',
        badge: 'WORKSHOP: PACKED',
        badgeColor: 'bg-[#1E3304] text-[#A6CE39]',
        action: 'Order Packed & Ready',
        summary: 'Quality passed! Order #ORD-1042 (Pooja Rao, Sector 15) is packed on hanger.',
        from: { role: 'washer', name: 'Suresh Yadav (Steam Press)' },
        to: { role: 'manager', name: 'Aakash Sharma & Field Riders' },
        timestamp: new Date(Date.now() - 4 * 60 * 1000).toISOString(),
        read: false
      },
      {
        id: 'NOTIF-102',
        orderId: 'ORD-1040',
        badge: 'DISPATCH',
        badgeColor: 'bg-[#2D5A1E] text-white',
        action: 'Dispatched for Delivery',
        summary: 'Order #ORD-1040 handed to Rajesh Kumar for doorstep delivery in DLF Phase 4.',
        from: { role: 'manager', name: 'Aakash Sharma (Front Desk)' },
        to: { role: 'rider', name: 'Rajesh Kumar (Field Rider)' },
        timestamp: new Date(Date.now() - 15 * 60 * 1000).toISOString(),
        read: false
      },
      {
        id: 'NOTIF-103',
        orderId: 'ORD-1045',
        badge: 'FRONT DESK',
        badgeColor: 'bg-[#F8FAF3] text-[#1E293B]',
        action: 'Intake Tagged',
        summary: 'Order #ORD-1045 (3 pcs) tagged & queued for Washing Station.',
        from: { role: 'manager', name: 'Aakash Sharma (Front Desk)' },
        to: { role: 'washer', name: 'Ramesh Singh (Washing Lead)' },
        timestamp: new Date(Date.now() - 32 * 60 * 1000).toISOString(),
        read: true
      }
    ];
    saveNotifications();
  }

  updateNotificationBadge();
  renderNotificationCenter();
}

function saveNotifications() {
  try {
    localStorage.setItem('bumbledry_live_notifications', JSON.stringify(liveNotifications.slice(0, 50)));
  } catch (e) {}
}

function updateNotificationBadge() {
  const badge = document.getElementById('notification-badge');
  if (!badge) return;
  const unreadCount = liveNotifications.filter(n => !n.read).length;
  if (unreadCount > 0) {
    badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
    badge.classList.remove('hidden');
  } else {
    badge.innerText = '0';
    badge.classList.add('hidden');
  }
}

function broadcastHandoverNotification(orderId, newStatus) {
  const config = HANDOVER_LEVEL_MAP[newStatus];
  if (!config) return;

  const order = allOrders.find(o => o.id === orderId) || { id: orderId, customerName: 'Customer', zone: 'Sector 15', totalPieces: 1, subtotal: 0 };
  const notif = {
    id: 'NOTIF-' + Date.now(),
    orderId: order.id,
    badge: config.badge,
    badgeColor: config.badgeColor,
    action: config.action,
    summary: config.summary(order),
    from: config.from,
    to: config.to,
    timestamp: new Date().toISOString(),
    read: false
  };

  liveNotifications.unshift(notif);
  saveNotifications();
  updateNotificationBadge();
  renderNotificationCenter();
  showToastNotification(notif);

  try {
    localStorage.setItem('bumbledry_last_broadcast_notif', JSON.stringify(notif));
  } catch (e) {}
}

function showToastNotification(notif, isCrossTab = false) {
  const container = document.getElementById('live-toast-container');
  if (!container) return;

  playNotificationChime();

  const toastId = `toast-${notif.id}`;
  const toastEl = document.createElement('div');
  toastEl.id = toastId;
  toastEl.className = 'pointer-events-auto bg-[#1E3A2F] text-white p-3.5 rounded-2xl border border-[#A6CE39]/30 shadow-2xl flex items-start space-x-3 transition-all transform duration-300 translate-y-0 opacity-100';
  toastEl.innerHTML = `
    <div class="w-8 h-8 rounded-full bg-[#A6CE39] text-[#1E3304] flex items-center justify-center shrink-0 font-bold mt-0.5">
      <i data-lucide="bell" class="w-4 h-4"></i>
    </div>
    <div class="flex-1 min-w-0">
      <div class="flex items-center justify-between">
        <span class="text-[10px] uppercase font-black tracking-wider text-[#A6CE39]">${notif.badge}</span>
        <span class="text-[10px] text-neutral-400">Just now</span>
      </div>
      <h5 class="font-bold text-xs text-white truncate mt-0.5">${notif.action}: ${notif.orderId}</h5>
      <p class="text-[11px] text-neutral-300 leading-snug mt-1">${notif.summary}</p>
      <div class="text-[10px] text-neutral-400 mt-1.5 flex items-center space-x-1 border-t border-white/10 pt-1">
        <span>Handover: <strong>${notif.from.name}</strong></span>
        <span>→</span>
        <span class="text-[#A6CE39]"><strong>${notif.to.name}</strong></span>
      </div>
    </div>
    <button onclick="dismissToast('${toastId}')" class="text-neutral-400 hover:text-white p-1">
      <i data-lucide="x" class="w-3.5 h-3.5"></i>
    </button>
  `;

  container.appendChild(toastEl);
  lucide.createIcons();

  setTimeout(() => {
    dismissToast(toastId);
  }, 6000);
}

function dismissToast(toastId) {
  const toast = document.getElementById(toastId);
  if (!toast) return;
  toast.classList.add('opacity-0', 'translate-y-2');
  setTimeout(() => {
    if (toast.parentNode) toast.parentNode.removeChild(toast);
  }, 300);
}

function playNotificationChime() {
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    const ctx = new AudioContext();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    const now = ctx.currentTime;
    osc.frequency.setValueAtTime(587.33, now);
    osc.frequency.setValueAtTime(880.00, now + 0.12);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.55);
    osc.start(now);
    osc.stop(now + 0.55);
  } catch (e) {}
}

function testNotificationChime() {
  playNotificationChime();
  const testNotif = {
    id: 'TEST-' + Date.now(),
    orderId: 'ORD-1044',
    badge: 'WORKSHOP: PRESS',
    badgeColor: 'bg-[#EEF4E3] text-[#2D5A1E]',
    action: 'Steam Ironing Underway',
    summary: 'Steam press & crease finishing in progress for Order #ORD-1044 (Priya Sharma).',
    from: { role: 'washer', name: 'Anil Verma (Dry Clean)' },
    to: { role: 'washer', name: 'Suresh Yadav (Steam Press)' },
    timestamp: new Date().toISOString(),
    read: false
  };
  showToastNotification(testNotif);
}

function toggleNotificationCenter(e) {
  if (e && e.stopPropagation) e.stopPropagation();
  const dropdown = document.getElementById('notification-dropdown');
  if (!dropdown) return;
  if (dropdown.classList.contains('hidden')) {
    dropdown.classList.remove('hidden');
    renderNotificationCenter();
  } else {
    dropdown.classList.add('hidden');
  }
}

function renderNotificationCenter() {
  const container = document.getElementById('notifications-list-container');
  if (!container) return;

  if (liveNotifications.length === 0) {
    container.innerHTML = `
      <div class="p-8 text-center text-[#898989] text-xs">
        <i data-lucide="bell-off" class="w-6 h-6 mx-auto mb-2 text-[#898989]"></i>
        <div>No notifications right now.</div>
        <div class="text-[10px] text-[#545454] mt-0.5">Station handover events will appear here in real time.</div>
      </div>
    `;
    lucide.createIcons();
    return;
  }

  container.innerHTML = liveNotifications.map(n => `
    <div class="p-3.5 hover:bg-[#F8FAF3] transition-colors ${!n.read ? 'bg-[#EEF4E3]/30' : ''} space-y-1.5">
      <div class="flex items-center justify-between">
        <span class="text-[9px] font-black tracking-wider uppercase px-2 py-0.5 rounded-full ${n.badgeColor || 'bg-[#F8FAF3] text-[#1E293B]'}">${n.badge}</span>
        <span class="text-[10px] text-[#545454]">${new Date(n.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
      </div>
      <div class="font-bold text-[#1E293B] text-xs flex items-center justify-between">
        <span>${n.action}: <strong class="font-mono text-[#1E3304]">${n.orderId}</strong></span>
        ${!n.read ? '<span class="w-2 h-2 rounded-full bg-[#E11900] shrink-0" title="Unread"></span>' : ''}
      </div>
      <p class="text-[11px] text-[#545454] leading-relaxed">${n.summary}</p>
      <div class="text-[10px] text-[#898989] flex items-center space-x-1 pt-0.5">
        <span>From: <strong class="text-[#1E293B]">${n.from.name}</strong></span>
        <span>→</span>
        <span>To: <strong class="text-[#2D5A1E]">${n.to.name}</strong></span>
      </div>
    </div>
  `).join('');
  lucide.createIcons();
}

function markAllNotificationsRead() {
  liveNotifications.forEach(n => { n.read = true; });
  saveNotifications();
  updateNotificationBadge();
  renderNotificationCenter();
}

function clearAllNotifications() {
  liveNotifications = [];
  saveNotifications();
  updateNotificationBadge();
  renderNotificationCenter();
}

// Close notification dropdown when clicking outside
document.addEventListener('click', (e) => {
  const dropdown = document.getElementById('notification-dropdown');
  const bellBtn = document.getElementById('btn-notification-bell');
  if (dropdown && !dropdown.classList.contains('hidden')) {
    if (!dropdown.contains(e.target) && !bellBtn.contains(e.target)) {
      dropdown.classList.add('hidden');
    }
  }
});
