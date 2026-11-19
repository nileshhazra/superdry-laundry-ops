// SuperDry PRO - Smart Laundry Operations Client Logic
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

// Mock database for GitHub Pages Standalone Demo
let mockDb = {
  customers: [],
  orders: [],
  leads: [],
  garmentsCatalog: [],
  storeSettings: {
    storeName: 'SuperDry Laundry & Dry Cleaners',
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

  await detectModeAndInit();
  await refreshAll();

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
  console.log('⚡ SuperDry PRO: Running in Standalone Client Demo Mode (GitHub Pages)');

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
// PERSONA NAVIGATION
// -----------------------------------------------------------------
function setPersona(persona) {
  currentPersona = persona;

  // Toggle active tab buttons
  document.querySelectorAll('.persona-tab').forEach(tab => {
    tab.classList.remove('bg-white', 'text-teal-700', 'shadow-sm');
    tab.classList.add('text-slate-700');
  });

  const activeBtn = document.getElementById(`btn-persona-${persona}`);
  if (activeBtn) {
    activeBtn.classList.add('bg-white', 'text-teal-700', 'shadow-sm');
    activeBtn.classList.remove('text-slate-700');
  }

  // Sync mobile dropdown
  const mobileSelect = document.getElementById('mobile-persona-select');
  if (mobileSelect) mobileSelect.value = persona;

  // Sync mobile pill buttons
  document.querySelectorAll('.mobile-persona-pill').forEach(pill => {
    pill.classList.remove('bg-teal-600', 'text-white', 'shadow-sm');
    pill.classList.add('bg-slate-100', 'text-slate-700');
  });
  const activeMobilePill = document.getElementById(`mbtn-persona-${persona}`);
  if (activeMobilePill) {
    activeMobilePill.classList.remove('bg-slate-100', 'text-slate-700');
    activeMobilePill.classList.add('bg-teal-600', 'text-white', 'shadow-sm');
  }

  // Toggle screens
  document.querySelectorAll('.persona-screen').forEach(screen => screen.classList.add('hidden'));
  const activeScreen = document.getElementById(`screen-${persona}`);
  if (activeScreen) {
    activeScreen.classList.remove('hidden');
  }

  // Update role badge
  const labelMap = {
    admin: 'Super Admin (Store Owner)',
    manager: 'Front Desk / Operations Lead',
    washer: 'Laundry Master (Floor Operator)',
    rider: 'Field Logistics Agent (PWA)'
  };
  const roleEl = document.getElementById('role-context-label');
  if (roleEl) {
    roleEl.innerText = `Active Screen: ${labelMap[persona]}`;
    if (isStaticMode) {
      roleEl.innerHTML = `${roleEl.innerText} <span class="bg-amber-500/20 text-amber-300 text-[10px] px-1.5 py-0.5 rounded font-bold ml-1">GitHub Pages Demo</span>`;
    }
  }

  renderActiveScreen();
  lucide.createIcons();
}

function setManagerTab(tab) {
  currentManagerTab = tab;
  ['leads', 'tagging', 'customers'].forEach(t => {
    const btn = document.getElementById(`mtab-${t}`);
    const view = document.getElementById(`manager-view-${t}`);
    if (!btn || !view) return;
    if (t === tab) {
      btn.className = 'pb-2.5 sm:pb-3 border-b-2 border-teal-600 text-teal-700 flex items-center space-x-1.5 sm:space-x-2 font-semibold shrink-0 whitespace-nowrap';
      view.classList.remove('hidden');
    } else {
      btn.className = 'pb-2.5 sm:pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-1.5 sm:space-x-2 font-semibold shrink-0 whitespace-nowrap';
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
    pBtn.className = 'py-2 rounded-lg bg-teal-600 text-white shadow transition-all flex items-center justify-center space-x-1.5 font-semibold';
    dBtn.className = 'py-2 rounded-lg text-slate-300 hover:text-white transition-all flex items-center justify-center space-x-1.5 font-semibold';
    pView.classList.remove('hidden');
    dView.classList.add('hidden');
  } else {
    dBtn.className = 'py-2 rounded-lg bg-teal-600 text-white shadow transition-all flex items-center justify-center space-x-1.5 font-semibold';
    pBtn.className = 'py-2 rounded-lg text-slate-300 hover:text-white transition-all flex items-center justify-center space-x-1.5 font-semibold';
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
    renderAdminOrders();
  } else if (currentPersona === 'manager') {
    renderManagerLeads();
    renderManagerTagging();
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
    { key: 'PICKUP_REQUESTED', label: '1. Pickup Req', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
    { key: 'PICKED_UP', label: '2. En Route Store', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { key: 'RECEIVED_IN_STORE', label: '3. In Intake/Tag', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
    { key: 'WASHING', label: '4. Washing', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { key: 'DRYING', label: '5. Drying', color: 'bg-sky-50 text-sky-700 border-sky-200' },
    { key: 'IRONING', label: '6. Steam Press', color: 'bg-amber-50 text-amber-700 border-amber-200' },
    { key: 'PACKED', label: '7. Packed & Ready', color: 'bg-teal-50 text-teal-700 border-teal-200' },
    { key: 'OUT_FOR_DELIVERY', label: '8. Out for Delivery', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' }
  ];

  const pipelineContainer = document.getElementById('admin-pipeline-breakdown');
  pipelineContainer.innerHTML = stages.map(s => `
    <div class="border ${s.color} rounded-xl p-2.5 sm:p-3 flex flex-col justify-between min-w-0">
      <span class="text-[9px] sm:text-[10px] font-bold uppercase tracking-wider block opacity-75 truncate">${s.label}</span>
      <span class="text-lg sm:text-xl font-black mt-1 sm:mt-2">${statsData.stageCounts[s.key] || 0}</span>
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
    tbody.innerHTML = `<tr><td colspan="8" class="p-6 text-center text-slate-400">No orders match the selected filter.</td></tr>`;
    return;
  }

  tbody.innerHTML = list.map(o => {
    const isExpress = o.isExpress ? `<span class="bg-red-100 text-red-700 text-[10px] font-extrabold px-1.5 py-0.5 rounded ml-1">⚡ EXPRESS</span>` : '';
    const statusBadges = {
      PICKUP_REQUESTED: 'bg-indigo-100 text-indigo-800',
      PICKED_UP: 'bg-purple-100 text-purple-800',
      RECEIVED_IN_STORE: 'bg-cyan-100 text-cyan-800',
      WASHING: 'bg-blue-100 text-blue-800',
      DRYING: 'bg-sky-100 text-sky-800',
      IRONING: 'bg-amber-100 text-amber-800',
      PACKED: 'bg-teal-100 text-teal-800',
      OUT_FOR_DELIVERY: 'bg-emerald-100 text-emerald-800',
      DELIVERED: 'bg-slate-100 text-slate-700'
    };

    return `
      <tr class="hover:bg-slate-50 transition-colors">
        <td class="p-3.5 font-mono font-bold text-slate-900">${o.id} ${isExpress}</td>
        <td class="p-3.5">
          <div class="font-bold text-slate-900">${o.customerName}</div>
          <div class="text-slate-500 font-mono text-[11px]">${o.customerPhone}</div>
        </td>
        <td class="p-3.5"><span class="bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-medium">${o.zone}</span></td>
        <td class="p-3.5">
          <span class="font-bold text-slate-800">${o.totalPieces} Pieces</span>
          <div class="text-slate-400 text-[10px] truncate max-w-[150px]">${(o.items || []).map(i => i.garmentName).slice(0, 2).join(', ')}...</div>
        </td>
        <td class="p-3.5 font-bold text-slate-900">
          ₹${o.subtotal}
          <div class="text-[10px] ${o.paymentStatus === 'PAID' ? 'text-emerald-600 font-bold' : 'text-amber-600'}">${o.paymentStatus}</div>
        </td>
        <td class="p-3.5"><span class="px-2 py-1 rounded-full text-[10px] font-bold ${statusBadges[o.status] || 'bg-slate-100'}">${o.status.replace(/_/g, ' ')}</span></td>
        <td class="p-3.5 text-slate-600">${new Date(o.promisedDelivery).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td>
        <td class="p-3.5 text-right space-x-1">
          <button onclick="previewThermalTags('${o.id}')" title="Print Garment Tags" class="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg">
            <i data-lucide="printer" class="w-3.5 h-3.5 inline"></i>
          </button>
        </td>
      </tr>
    `;
  }).join('');
  lucide.createIcons();
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
      btn.className = 'px-3 py-1 rounded-md font-bold text-teal-800 bg-white shadow-sm transition-all';
    } else {
      btn.className = 'px-3 py-1 rounded-md font-medium text-slate-600 hover:text-slate-900 transition-all';
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
      active: 'No active inquiries waiting for callback. Your inbox is 100% clean!',
      all: 'No leads found in the system.',
      resolved: 'No resolved leads in this view.',
      archived: 'Archive is empty.'
    };
    container.innerHTML = `<div class="col-span-3 p-8 text-center bg-white rounded-2xl border border-slate-200 text-slate-400 text-xs">${emptyMessages[currentLeadsFilter]}</div>`;
    return;
  }

  container.innerHTML = displayLeads.map(lead => {
    const isResolved = lead.status === 'RESOLVED';
    const isArchived = lead.status === 'ARCHIVED';
    const isUrgent = lead.priority === 'URGENT';
    const attempts = lead.attempts || 1;

    return `
      <div class="bg-white p-5 rounded-2xl border ${isUrgent && !isResolved && !isArchived ? 'border-red-300 ring-2 ring-red-100' : 'border-slate-200'} shadow-sm space-y-3 relative group">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center space-x-1.5 flex-wrap">
              <span class="font-bold text-slate-900 text-sm">${lead.customerName}</span>
              ${attempts > 1 ? `<span class="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-300 animate-pulse">⚠ Called ${attempts}x</span>` : ''}
              ${isUrgent && !isResolved && !isArchived ? '<span class="bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded">SLA URGENT</span>' : ''}
            </div>
            <span class="text-xs font-mono text-slate-500">${lead.phone}</span>
          </div>

          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isResolved ? 'bg-emerald-100 text-emerald-800' : isArchived ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-800'}">
              ${lead.status.replace(/_/g, ' ')}
            </span>
            <button onclick="deleteLead('${lead.id}')" title="Delete lead card permanently" class="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <div class="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
          <div class="flex items-center space-x-1.5 font-bold text-slate-500 text-[10px] uppercase mb-1">
            <i data-lucide="message-square" class="w-3 h-3"></i>
            <span>${lead.channel}</span>
          </div>
          <p class="leading-relaxed">${lead.message}</p>
          ${lead.address ? `<div class="mt-2 text-[11px] text-teal-800 font-medium">📍 ${lead.address} (${lead.zone})</div>` : ''}
        </div>

        <div class="flex items-center justify-between text-xs text-slate-500 pt-2 border-t border-slate-100">
          <span>
            ${!isResolved && !isArchived ? `Callback SLA: <strong class="${lead.slaMinutesRemaining < 10 ? 'text-red-600' : 'text-slate-800'}">${lead.slaMinutesRemaining}m left</strong>` : `<span class="text-slate-400 font-medium">Closed</span>`}
          </span>

          <div class="flex items-center space-x-1.5">
            ${!isResolved && !isArchived ? `
              <button onclick="markLeadResolved('${lead.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold text-[11px]">
                Mark Called
              </button>
              <button onclick="convertLeadToOrder('${lead.id}')" class="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-[11px] flex items-center space-x-1 shadow-sm">
                <i data-lucide="plus" class="w-3 h-3"></i>
                <span>Book Order</span>
              </button>
            ` : `
              <button onclick="archiveLead('${lead.id}')" class="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg font-semibold text-[11px] flex items-center space-x-1">
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
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No orders currently awaiting garment tagging. All incoming clothes are tagged!</div>`;
    return;
  }

  container.innerHTML = ordersToTag.map(o => `
    <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div class="flex flex-wrap items-center gap-1.5 sm:gap-2">
          <span class="font-mono font-bold text-slate-900 shrink-0 whitespace-nowrap">${o.id}</span>
          <span class="text-xs font-bold text-slate-700">${o.customerName}</span>
          <span class="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded shrink-0 whitespace-nowrap">${o.status.replace(/_/g, ' ')}</span>
          ${o.isExpress ? '<span class="bg-red-100 text-red-700 text-[10px] font-black px-1.5 py-0.5 rounded shrink-0 whitespace-nowrap">⚡ EXPRESS</span>' : ''}
        </div>
        <p class="text-xs text-slate-500 mt-1">${o.totalPieces} Pieces Counted • Zone: ${o.zone} • ${o.customerPhone}</p>
        <div class="flex flex-wrap gap-1.5 mt-2">
          ${(o.items || []).map(item => `
            <span class="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-medium">
              #${item.pieceNumber} ${item.garmentName} (${item.service})
              ${item.hasStain ? '<strong class="text-red-600">⚠ Stain</strong>' : ''}
            </span>
          `).join('')}
        </div>
      </div>
      <div class="flex flex-wrap sm:flex-nowrap items-center gap-2 shrink-0 mt-2 md:mt-0">
        <button onclick="previewThermalTags('${o.id}')" class="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold shadow-sm flex items-center space-x-1.5">
          <i data-lucide="printer" class="w-3.5 h-3.5"></i>
          <span>Print Thermal Tags</span>
        </button>
        ${o.status === 'RECEIVED_IN_STORE' ? `
          <button onclick="updateOrderStatus('${o.id}', 'WASHING')" class="px-3 py-1.5 bg-teal-600 hover:bg-teal-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-sm">
            <span>Send to Washers →</span>
          </button>
        ` : ''}
      </div>
    </div>
  `).join('');
  lucide.createIcons();
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
      if (tbody) tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No customers found matching "${query}".</td></tr>`;
      if (mobileCards) mobileCards.innerHTML = `<div class="p-6 text-center text-slate-400 text-xs">No customers found matching "${query}".</div>`;
      return;
    }

    if (tbody) {
      tbody.innerHTML = list.map(c => `
        <tr class="hover:bg-slate-50">
          <td class="p-3 font-mono font-bold text-teal-700">${c.id}</td>
          <td class="p-3 font-bold text-slate-900">${c.name}</td>
          <td class="p-3 font-mono text-slate-600">${c.phone}</td>
          <td class="p-3 text-slate-600">
            <div>${c.address}</div>
            <span class="text-[10px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded">${c.zone}</span>
          </td>
          <td class="p-3 font-bold text-slate-800">${c.totalOrders} Orders</td>
          <td class="p-3 text-right">
            <button onclick="selectCustomerForOrder('${c.id}', '${encodeURIComponent(c.name)}', '${c.phone}', '${encodeURIComponent(c.address)}', '${c.zone}')" class="px-2.5 py-1 bg-teal-50 hover:bg-teal-100 text-teal-700 rounded-md font-bold text-[11px]">
              + New Order
            </button>
          </td>
        </tr>
      `).join('');
    }

    if (mobileCards) {
      mobileCards.innerHTML = list.map(c => `
        <div class="p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
          <div class="flex items-center justify-between">
            <div class="flex items-center space-x-1.5">
              <span class="font-mono text-[10px] font-bold text-teal-700 bg-teal-100/70 px-1.5 py-0.5 rounded">${c.id}</span>
              <span class="font-bold text-slate-900 text-xs">${c.name}</span>
            </div>
            <span class="text-[10px] bg-slate-200 text-slate-700 px-1.5 py-0.5 rounded font-semibold shrink-0">${c.zone}</span>
          </div>
          <div class="text-xs text-slate-600">
            <div class="font-mono text-[11px] text-slate-700">${c.phone}</div>
            <div class="text-[11px] text-slate-500 truncate">${c.address}</div>
          </div>
          <div class="flex items-center justify-between pt-1.5 border-t border-slate-200/80 text-[11px]">
            <span class="font-semibold text-slate-700">${c.totalOrders} Past Orders</span>
            <button onclick="selectCustomerForOrder('${c.id}', '${encodeURIComponent(c.name)}', '${c.phone}', '${encodeURIComponent(c.address)}', '${c.zone}')" class="px-3 py-1 bg-teal-600 hover:bg-teal-700 text-white rounded-lg font-bold text-xs shadow-sm">
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
  packedCol.innerHTML = renderKanbanColumn(packedOrders, 'OUT_FOR_DELIVERY', 'Ready for Dispatch ✓', true);

  lucide.createIcons();
}

function renderKanbanColumn(ordersList, nextStatus, nextBtnLabel, isFinal = false) {
  if (ordersList.length === 0) {
    return `<div class="h-32 flex items-center justify-center text-slate-400 text-xs border border-dashed border-slate-300 rounded-xl">Empty Queue</div>`;
  }

  const sorted = [...ordersList].sort((a, b) => (b.isExpress ? 1 : 0) - (a.isExpress ? 1 : 0));

  return sorted.map(o => {
    const isExpress = o.isExpress;
    return `
      <div class="bg-white p-4 rounded-xl border ${isExpress ? 'border-red-400 ring-2 ring-red-100 shadow-md' : 'border-slate-200'} shadow-sm space-y-3">
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center space-x-1.5">
              <span class="font-mono font-black text-slate-900 text-sm">${o.id}</span>
              ${isExpress ? '<span class="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.2 rounded">⚡ EXPRESS 24H</span>' : ''}
            </div>
            <span class="text-xs font-bold text-slate-700">${o.customerName}</span>
          </div>
          <span class="text-xs font-bold bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full">${o.totalPieces} Pcs</span>
        </div>

        <div class="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
          ${(o.items || []).map(item => `
            <div class="flex items-center justify-between text-[11px] text-slate-700">
              <span>#${item.pieceNumber} ${item.garmentName}</span>
              <span class="text-slate-500 font-medium">${item.service}</span>
            </div>
            ${item.hasStain ? `<div class="text-[10px] text-red-600 font-bold pl-2">⚠ Special: ${item.specialNote || 'Stain Treatment'}</div>` : ''}
          `).join('')}
        </div>

        <div class="flex items-center justify-between pt-2 border-t border-slate-100 text-xs">
          <span class="text-slate-500 text-[10px]">Due: ${new Date(o.promisedDelivery).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          ${!isFinal ? `
            <button onclick="updateOrderStatus('${o.id}', '${nextStatus}')" class="px-3 py-1.5 bg-slate-900 hover:bg-black text-white text-[11px] font-bold rounded-lg shadow-sm transition-transform active:scale-95">
              ${nextBtnLabel}
            </button>
          ` : `
            <span class="text-emerald-700 font-bold text-[11px] flex items-center space-x-1">
              <i data-lucide="check-circle-2" class="w-3.5 h-3.5"></i>
              <span>Packed in Poly-wrap</span>
            </span>
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
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No pending pickups right now. Standby for new orders!</div>`;
    return;
  }

  container.innerHTML = pickups.map(p => `
    <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
      <div class="flex items-start justify-between">
        <div>
          <span class="font-mono text-teal-700 font-bold text-xs">${p.id}</span>
          <h4 class="font-bold text-slate-900 text-sm">${p.customerName}</h4>
          <span class="text-xs text-slate-600 font-mono">${p.customerPhone}</span>
        </div>
        <span class="text-[10px] bg-teal-100 text-teal-800 font-bold px-2 py-0.5 rounded">${p.zone}</span>
      </div>

      <div class="text-xs text-slate-600 bg-white p-2.5 rounded-xl border border-slate-200">
        📍 ${p.customerAddress}
      </div>

      <div class="grid grid-cols-2 gap-2 text-xs">
        <a href="tel:${p.customerPhone}" class="py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 flex items-center justify-center space-x-1.5 shadow-sm">
          <i data-lucide="phone" class="w-3.5 h-3.5 text-teal-600"></i>
          <span>Call Customer</span>
        </a>
        <a href="https://maps.google.com/?q=${encodeURIComponent(p.customerAddress)}" target="_blank" class="py-2 bg-white border border-slate-200 rounded-xl font-bold text-slate-700 flex items-center justify-center space-x-1.5 shadow-sm">
          <i data-lucide="navigation" class="w-3.5 h-3.5 text-blue-600"></i>
          <span>Google Maps</span>
        </a>
      </div>

      <button onclick="promptRiderPickupIntake('${p.id}')" class="w-full py-2.5 bg-teal-600 hover:bg-teal-700 text-white rounded-xl font-bold text-xs shadow flex items-center justify-center space-x-1.5">
        <i data-lucide="check" class="w-4 h-4"></i>
        <span>Confirm Pickup & Bring to Store</span>
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
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No orders ready for delivery at the moment.</div>`;
    return;
  }

  container.innerHTML = clusters.map(cluster => `
    <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
      <div class="bg-slate-100 p-3 flex items-center justify-between border-b border-slate-200">
        <div>
          <span class="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Delivery Cluster</span>
          <h4 class="font-bold text-slate-900 text-sm">${cluster.zoneName}</h4>
        </div>
        <div class="text-right">
          <span class="bg-teal-600 text-white text-xs font-black px-2.5 py-0.5 rounded-full">${cluster.orders.length} Orders</span>
          <div class="text-[10px] text-slate-600 font-bold mt-0.5">Collect: ₹${cluster.totalAmountToCollect}</div>
        </div>
      </div>

      <div class="p-3 divide-y divide-slate-100 space-y-3">
        ${cluster.orders.map(o => `
          <div class="pt-3 first:pt-0 space-y-2 text-xs">
            <div class="flex items-start justify-between">
              <div>
                <div class="font-bold text-slate-900">${o.customerName}</div>
                <div class="text-slate-500 font-mono text-[11px]">${o.customerPhone}</div>
              </div>
              <div class="text-right">
                <div class="font-bold text-slate-900">₹${o.subtotal}</div>
                <span class="text-[10px] ${o.paymentStatus === 'PAID' ? 'text-emerald-600 font-bold' : 'text-amber-600 font-bold'}">${o.paymentStatus}</span>
              </div>
            </div>
            <div class="text-slate-600 text-[11px]">📍 ${o.customerAddress}</div>
            <div class="flex space-x-2 pt-1">
              ${o.status === 'PACKED' ? `
                <button onclick="updateOrderStatus('${o.id}', 'OUT_FOR_DELIVERY')" class="flex-1 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-bold text-[11px]">
                  Load & Start Trip
                </button>
              ` : `
                <button onclick="completeRiderDelivery('${o.id}', ${o.subtotal})" class="flex-1 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-[11px] flex items-center justify-center space-x-1">
                  <i data-lucide="check-circle" class="w-3.5 h-3.5"></i>
                  <span>Mark Delivered & Paid</span>
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

async function promptRiderPickupIntake(orderId) {
  const pieces = prompt('Enter estimated number of pieces collected in laundry bag:', '5');
  if (pieces === null) return;
  await updateOrderStatus(orderId, 'PICKED_UP');
  alert(`Order ${orderId} marked Picked Up! Please hand over clothes at store counter for tagging.`);
}

async function completeRiderDelivery(orderId, amount) {
  const confirmed = confirm(`Confirm delivery for ${orderId}!\nCustomer payment of ₹${amount} received via Cash or UPI?`);
  if (!confirmed) return;

  if (isStaticMode) {
    const order = mockDb.orders.find(o => o.id === orderId);
    if (order) {
      order.status = 'DELIVERED';
      order.paymentStatus = 'PAID';
      order.paymentMode = 'Cash / UPI Received at Doorstep';
    }
    saveDemoState();
    await refreshAll();
    alert(`Delivery completed successfully for ${orderId}!`);
    return;
  }

  await fetch(`/api/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      status: 'DELIVERED',
      paymentStatus: 'PAID',
      paymentMode: 'Cash / UPI Received at Doorstep'
    })
  });
  await refreshAll();
  alert(`Delivery completed successfully for ${orderId}!`);
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
      <div class="bg-white p-4 border-2 border-dashed border-slate-400 w-[72mm] shadow-md text-black font-mono text-[11px] leading-tight space-y-2">
        <div class="text-center border-b border-black pb-1.5">
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

        <div class="border-t border-b border-black py-1">
          <div class="font-black text-xs">${tag.garmentName}</div>
          <div class="font-bold">${tag.service}</div>
          ${tag.hasStain ? `<div class="bg-black text-white px-1 text-[10px] font-bold mt-1">⚠ CARE: ${tag.specialNote || 'STAIN REMOVAL'}</div>` : ''}
          ${tag.isExpress ? `<div class="bg-black text-white px-1 text-[10px] font-black mt-1">⚡ 24H EXPRESS PRIORITY</div>` : ''}
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
      autoReply = `Hi ${senderName || 'there'}! We noticed we missed your call at SuperDry Laundry. Would you like to schedule an instant doorstep pickup? Reply 1 for Pickup, or drop your location pin!`;
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
      autoReply = `Hello from SuperDry Laundry! Our dry cleaning rate is ₹90 for shirts, ₹110 for trousers, and ₹280 for suits with free doorstep pickup. Would you like to schedule a pickup today?`;
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
    resultText.innerHTML = `<strong>Auto-Reply Sent via WhatsApp:</strong><br><em>"${autoReply}"</em><br><br>✓ Lead recorded in Front Desk Callback Hub!`;
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
    resultText.innerHTML = `<strong>Auto-Reply Sent via WhatsApp:</strong><br><em>"${result.autoReplyDispatched}"</em><br><br>✓ Lead recorded in Front Desk Callback Hub!`;
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
      <td class="p-2.5 font-bold text-slate-800">${item.garmentName}</td>
      <td class="p-2.5">${item.service}</td>
      <td class="p-2.5">${item.hasStain ? `<span class="text-red-600 font-bold">⚠ ${item.specialNote}</span>` : '—'}</td>
      <td class="p-2.5 text-right font-bold font-mono">₹${item.rate}</td>
      <td class="p-2.5 text-right">
        <button onclick="removeGarmentItem(${idx})" class="text-red-500 hover:text-red-700 font-bold">✕</button>
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
    await refreshAll();
    return;
  }
  try {
    await fetch(`/api/orders/${orderId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    await refreshAll();
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
  filenameEl.innerText = `📄 ${file.name} (${(file.size / 1024).toFixed(1)} KB)`;
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
      dropZone.classList.add('border-emerald-600', 'bg-emerald-100');
    }, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    dropZone.addEventListener(eventName, (e) => {
      e.preventDefault();
      e.stopPropagation();
      dropZone.classList.remove('border-emerald-600', 'bg-emerald-100');
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
  btn.innerHTML = `<span class="animate-spin inline-block mr-1">⏳</span> Uploading & Processing...`;

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

        btn.innerHTML = `✓ Imported Successfully!`;
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

    btn.innerHTML = `✓ Imported Successfully!`;
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
      statusBadge = `<span class="bg-red-500 text-white text-[10px] font-black px-2 py-0.5 rounded-full animate-pulse">⚠ OVERDUE RETURN (+${r.currentRun ? r.currentRun.unaccountedGapMinutes : 12}m Gap)</span>`;
    } else if (isReturning) {
      statusBadge = `<span class="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded-full">En Route to Store</span>`;
    } else if (isIdle) {
      statusBadge = `<span class="bg-emerald-100 text-emerald-800 text-[10px] font-bold px-2 py-0.5 rounded-full">At Store (Available)</span>`;
    } else {
      statusBadge = `<span class="bg-blue-100 text-blue-800 text-[10px] font-bold px-2 py-0.5 rounded-full">Out Delivering</span>`;
    }

    return `
      <div class="bg-slate-50 p-4 rounded-xl border ${isOverdue ? 'border-red-300 ring-2 ring-red-100 shadow-sm' : 'border-slate-200'} space-y-3">
        <div class="flex items-start justify-between">
          <div class="flex items-center space-x-2.5">
            <div class="w-9 h-9 rounded-full ${isOverdue ? 'bg-red-600' : isIdle ? 'bg-emerald-600' : 'bg-teal-600'} text-white flex items-center justify-center font-bold text-xs">
              ${r.name.split(' ').map(n => n[0]).join('')}
            </div>
            <div>
              <div class="flex items-center space-x-1.5">
                <h4 class="font-bold text-slate-900 text-sm">${r.name}</h4>
                <span class="text-[10px] text-slate-500 font-mono">(${r.vehicle})</span>
              </div>
              <div class="text-[11px] text-slate-500">${r.phone}</div>
            </div>
          </div>
          <div>${statusBadge}</div>
        </div>

        <div class="p-2.5 bg-white rounded-lg border border-slate-200 text-xs space-y-1.5">
          <div class="flex items-center justify-between text-[11px]">
            <span class="text-slate-600 truncate">📍 <strong>Location:</strong> ${r.location.address}</span>
            <span class="text-slate-400 font-mono shrink-0">🔋 ${r.location.batteryLevel}</span>
          </div>

          ${r.currentRun ? `
            <div class="pt-1.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-600">
              <span>Run: <strong>${r.currentRun.zone}</strong> (${r.currentRun.totalOrders} orders)</span>
              <span>Due Back: <strong class="${isOverdue ? 'text-red-600 font-black' : 'text-slate-800'}">${new Date(r.currentRun.expectedReturnAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</strong></span>
            </div>
            ${isOverdue ? `
              <div class="p-1.5 bg-red-50 text-red-700 text-[11px] rounded font-bold">
                🚨 Transit Gap Detected: Rider completed delivery 25m ago (3.8 km away). Delayed returning by +${r.currentRun.unaccountedGapMinutes} minutes.
              </div>
            ` : ''}
          ` : `
            <div class="pt-1 text-[11px] text-emerald-700 font-medium">✓ Ready at counter. No active orders assigned.</div>
          `}
        </div>

        <div class="flex items-center justify-between pt-1">
          <span class="text-[10px] text-slate-400">Punctuality Score: <strong class="text-slate-700">${r.todayStats.integrityScore}%</strong></span>
          <div class="flex space-x-1.5">
            ${isOverdue ? `
              <button onclick="sendRiderWarning('${r.id}')" class="px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-sm">
                <i data-lucide="bell-ring" class="w-3.5 h-3.5"></i>
                <span>Send WA Warning</span>
              </button>
            ` : ''}
            ${!isIdle ? `
              <button onclick="checkInAtStoreCounter('${r.id}')" class="px-3 py-1.5 bg-slate-900 hover:bg-black text-white rounded-lg text-xs font-bold flex items-center space-x-1 shadow-sm">
                <i data-lucide="check" class="w-3.5 h-3.5"></i>
                <span>Mark Arrived at Store</span>
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
      <tr class="hover:bg-slate-50">
        <td class="p-2.5 font-bold text-slate-900">${r.name}</td>
        <td class="p-2.5 text-slate-500 font-mono text-[11px]">${r.vehicle}</td>
        <td class="p-2.5 font-bold">${r.todayStats.completedRuns} Trips</td>
        <td class="p-2.5">
          <span class="font-bold ${r.todayStats.delayedReturns > 0 ? 'text-amber-600' : 'text-emerald-600'}">
            ${Math.round((r.todayStats.onTimeRuns / Math.max(1, r.todayStats.completedRuns)) * 100)}%
          </span>
          <span class="text-[10px] text-slate-400 block">${r.todayStats.delayedReturns} delayed</span>
        </td>
        <td class="p-2.5 font-mono ${r.todayStats.totalUnaccountedGapMins > 0 ? 'text-red-600 font-bold' : 'text-slate-500'}">
          ${r.todayStats.totalUnaccountedGapMins > 0 ? `+${r.todayStats.totalUnaccountedGapMins} mins` : '0 mins'}
        </td>
        <td class="p-2.5 text-right font-black ${isGood ? 'text-emerald-600' : 'text-amber-600'}">
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
    const msg = `ALERT from SuperDry Store Manager: Your Sector 14 delivery run was completed 25 minutes ago. Next batch of 3 customer orders is packed and waiting. Please report back to the store immediately.`;
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
