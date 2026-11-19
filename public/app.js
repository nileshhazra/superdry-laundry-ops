// SuperDry Operations Client Logic

let currentPersona = 'admin';
let currentManagerTab = 'leads';
let currentRiderMode = 'pickup';
let currentLeadsFilter = 'active';

let allOrders = [];
let allLeads = [];
let catalog = [];
let statsData = {};
let selectedCustomer = null;
let currentNewOrderItems = [];

// Initialize application on DOM load
document.addEventListener('DOMContentLoaded', async () => {
  updateClock();
  setInterval(updateClock, 1000);
  
  await fetchCatalog();
  await refreshAll();
  
  lucide.createIcons();
});

function updateClock() {
  const el = document.getElementById('live-clock');
  if (el) {
    el.innerText = new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
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
  document.getElementById('role-context-label').innerText = `Active Screen: ${labelMap[persona]}`;

  renderActiveScreen();
  lucide.createIcons();
}

function setManagerTab(tab) {
  currentManagerTab = tab;
  ['leads', 'tagging', 'customers'].forEach(t => {
    const btn = document.getElementById(`mtab-${t}`);
    const view = document.getElementById(`manager-view-${t}`);
    if (t === tab) {
      btn.className = 'pb-3 border-b-2 border-teal-600 text-teal-700 flex items-center space-x-2 font-semibold';
      view.classList.remove('hidden');
    } else {
      btn.className = 'pb-3 border-b-2 border-transparent text-slate-500 hover:text-slate-800 flex items-center space-x-2 font-semibold';
      view.classList.add('hidden');
    }
  });

  if (tab === 'customers') {
    searchCustomers('');
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
  try {
    const res = await fetch('/api/catalog');
    catalog = await res.json();
    populateCatalogDropdown();
  } catch (err) {
    console.error('Error fetching catalog:', err);
  }
}

async function fetchStats() {
  try {
    const res = await fetch('/api/stats');
    statsData = await res.json();
    renderStats();
  } catch (err) {
    console.error('Error fetching stats:', err);
  }
}

async function fetchOrders() {
  try {
    const res = await fetch('/api/orders');
    allOrders = await res.json();
  } catch (err) {
    console.error('Error fetching orders:', err);
  }
}

async function fetchLeads() {
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

  // Pipeline breakdown
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
          <div class="text-slate-400 text-[10px] truncate max-w-[150px]">${o.items.map(i => i.garmentName).slice(0, 2).join(', ')}...</div>
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

// -------------------------------------------------------------
// SCREEN 2: FRONT DESK & STORE MANAGER
// -------------------------------------------------------------
function renderManagerLeads() {
  const container = document.getElementById('leads-card-container');
  const countBadge = document.getElementById('badge-leads-count');
  
  const activeLeads = allLeads.filter(l => l.status !== 'RESOLVED' && l.status !== 'ARCHIVED');
  const resolvedLeads = allLeads.filter(l => l.status === 'RESOLVED');
  const archivedLeads = allLeads.filter(l => l.status === 'ARCHIVED');

  countBadge.innerText = activeLeads.length;

  // Update Toolbar Badges
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
        <!-- Card Header -->
        <div class="flex items-start justify-between">
          <div>
            <div class="flex items-center space-x-1.5 flex-wrap">
              <span class="font-bold text-slate-900 text-sm">${lead.customerName}</span>
              ${attempts > 1 ? `<span class="bg-amber-100 text-amber-800 text-[9px] font-black px-1.5 py-0.5 rounded border border-amber-300 animate-pulse">⚠ Called ${attempts}x</span>` : ''}
              ${isUrgent && !isResolved && !isArchived ? '<span class="bg-red-100 text-red-700 text-[9px] font-black px-1.5 py-0.5 rounded">SLA URGENT</span>' : ''}
            </div>
            <span class="text-xs font-mono text-slate-500">${lead.phone}</span>
          </div>

          <!-- Status badge + Quick card delete/archive controls -->
          <div class="flex items-center space-x-1.5">
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full ${isResolved ? 'bg-emerald-100 text-emerald-800' : isArchived ? 'bg-slate-100 text-slate-500' : 'bg-amber-100 text-amber-800'}">
              ${lead.status.replace(/_/g, ' ')}
            </span>
            <!-- Delete Trash Icon -->
            <button onclick="deleteLead('${lead.id}')" title="Delete lead card permanently" class="p-1 hover:bg-red-50 text-slate-400 hover:text-red-600 rounded transition-colors">
              <i data-lucide="trash-2" class="w-3.5 h-3.5"></i>
            </button>
          </div>
        </div>

        <!-- Payload / Message -->
        <div class="p-3 bg-slate-50 rounded-xl text-xs text-slate-700 border border-slate-100">
          <div class="flex items-center space-x-1.5 font-bold text-slate-500 text-[10px] uppercase mb-1">
            <i data-lucide="message-square" class="w-3 h-3"></i>
            <span>${lead.channel}</span>
          </div>
          <p class="leading-relaxed">${lead.message}</p>
          ${lead.address ? `<div class="mt-2 text-[11px] text-teal-800 font-medium">📍 ${lead.address} (${lead.zone})</div>` : ''}
        </div>

        <!-- Footer Actions -->
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
  try {
    await fetch(`/api/leads/${leadId}`, {
      method: 'DELETE'
    });
    await refreshAll();
  } catch (err) {
    console.error(err);
  }
}

async function clearResolvedLeads(action = 'archive') {
  const confirmed = confirm(action === 'delete' ? 'Permanently delete all resolved leads?' : 'Archive all resolved leads to clean your active inbox?');
  if (!confirmed) return;

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
  // Orders waiting for garment tagging: RECEIVED_IN_STORE or PICKED_UP
  const ordersToTag = allOrders.filter(o => ['PICKED_UP', 'RECEIVED_IN_STORE'].includes(o.status));

  if (ordersToTag.length === 0) {
    container.innerHTML = `<div class="p-8 text-center text-slate-400 text-xs">No orders currently awaiting garment tagging. All incoming clothes are tagged!</div>`;
    return;
  }

  container.innerHTML = ordersToTag.map(o => `
    <div class="py-4 flex flex-col md:flex-row md:items-center justify-between gap-3">
      <div>
        <div class="flex items-center space-x-2">
          <span class="font-mono font-bold text-slate-900">${o.id}</span>
          <span class="text-xs font-bold text-slate-700">${o.customerName}</span>
          <span class="bg-cyan-100 text-cyan-800 text-[10px] font-bold px-2 py-0.5 rounded">${o.status.replace(/_/g, ' ')}</span>
          ${o.isExpress ? '<span class="bg-red-100 text-red-700 text-[10px] font-black px-1.5 py-0.5 rounded">⚡ EXPRESS</span>' : ''}
        </div>
        <p class="text-xs text-slate-500 mt-1">${o.totalPieces} Pieces Counted • Zone: ${o.zone} • ${o.customerPhone}</p>
        <div class="flex flex-wrap gap-1.5 mt-2">
          ${o.items.map(item => `
            <span class="bg-slate-100 border border-slate-200 text-slate-700 text-[10px] px-2 py-0.5 rounded-md font-medium">
              #${item.pieceNumber} ${item.garmentName} (${item.service})
              ${item.hasStain ? '<strong class="text-red-600">⚠ Stain</strong>' : ''}
            </span>
          `).join('')}
        </div>
      </div>
      <div class="flex items-center space-x-2 shrink-0">
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
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(query)}&limit=25`);
      const list = await res.json();
      const tbody = document.getElementById('customers-table-body');
      
      if (list.length === 0) {
        tbody.innerHTML = `<tr><td colspan="6" class="p-6 text-center text-slate-400">No customers found matching "${query}".</td></tr>`;
        return;
      }

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
    } catch (err) {
      console.error(err);
    }
  }, 250);
}

// -----------------------------------------------------------------
// SCREEN 3: LAUNDRY MASTER / WASHERMAN KANBAN
// -----------------------------------------------------------------
let activeWasherMobileStage = 'all';

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

  // Sync mobile pills counter
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

  // Sort: Express first
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

        <!-- Garment checklist -->
        <div class="space-y-1 bg-slate-50 p-2.5 rounded-lg border border-slate-100 text-xs">
          ${o.items.map(item => `
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

  pickupBadge.innerText = pendingPickups.length;
  deliveryBadge.innerText = readyDeliveries.length;

  if (currentRiderMode === 'pickup') {
    renderRiderPickups(pendingPickups);
  } else {
    await renderRiderDeliveries();
  }
}

function renderRiderPickups(pickups) {
  const container = document.getElementById('rider-pickups-list');
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

      <!-- Action buttons -->
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
  try {
    const res = await fetch('/api/logistics/routes');
    const clusters = await res.json();

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
  } catch (err) {
    console.error(err);
  }
}

async function promptRiderPickupIntake(orderId) {
  const pieces = prompt('Enter estimated number of pieces collected in laundry bag:', '5');
  if (pieces === null) return;
  await updateOrderStatus(orderId, 'PICKED_UP');
  alert(`Order ${orderId} marked Picked Up! Please hand over clothes at store counter for tagging.`);
}

async function completeRiderDelivery(orderId, amount) {
  const mode = confirm(`Confirm delivery for ${orderId}!\nCustomer payment of ₹${amount} received via Cash or UPI?`);
  if (!mode) return;
  
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
    const res = await fetch(`/api/orders/${orderId}/tags`);
    const data = await res.json();
    const container = document.getElementById('print-thermal-container');

    container.innerHTML = data.tags.map(tag => `
      <div class="bg-white p-4 border-2 border-dashed border-slate-400 w-[72mm] shadow-md text-black font-mono text-[11px] leading-tight space-y-2">
        <div class="text-center border-b border-black pb-1.5">
          <div class="font-extrabold text-sm uppercase">${data.storeSettings.storeName}</div>
          <div class="text-[9px]">${data.storeSettings.phone} • ${data.storeSettings.address}</div>
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

        <!-- Simulated Barcode -->
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

  try {
    const res = await fetch('/api/whatsapp/simulate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type,
        senderPhone,
        senderName,
        messageText,
        addressText
      })
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

// -----------------------------------------------------------------
// NEW ORDER POS MODAL & BILLING
// -----------------------------------------------------------------
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
  select.innerHTML = catalog.map(g => `
    <option value="${g.name}" data-wash="${g.rateWashIron}" data-dry="${g.rateDryClean}">
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
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(query)}&limit=6`);
      const results = await res.json();

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
    } catch (err) {
      console.error(err);
    }
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

    // Immediately trigger thermal tag preview for printing!
    await previewThermalTags(newOrder.id);
  } catch (err) {
    console.error(err);
    alert('Failed to save order.');
  }
}

// -----------------------------------------------------------------
// NEW CUSTOMER MODAL
// -----------------------------------------------------------------
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

  try {
    const res = await fetch('/api/customers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, address, zone })
    });
    const newCust = await res.json();
    closeNewCustomerModal();
    alert(`Customer ${newCust.name} (${newCust.id}) registered successfully!`);
    
    // Auto-select for order if POS is opened
    selectCustomerForOrder(newCust.id, encodeURIComponent(newCust.name), newCust.phone, encodeURIComponent(newCust.address), newCust.zone);
  } catch (err) {
    console.error(err);
  }
}

// -----------------------------------------------------------------
// STATUS ADVANCEMENT HELPER
// -----------------------------------------------------------------
async function updateOrderStatus(orderId, newStatus) {
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

// -----------------------------------------------------------------
// BULK CUSTOMER EXCEL UPLOAD HANDLERS
// -----------------------------------------------------------------
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

  try {
    const formData = new FormData();
    formData.append('file', selectedExcelFile);

    const res = await fetch('/api/customers/upload-excel', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.error || 'Failed to process file');
    }

    // Show result stats in modal
    document.getElementById('excel-stat-new').innerText = data.newCount;
    document.getElementById('excel-stat-updated').innerText = data.updatedCount;
    document.getElementById('excel-stat-total').innerText = data.totalCustomers.toLocaleString('en-IN');
    document.getElementById('excel-upload-result').classList.remove('hidden');

    // Refresh all tables and stats
    await refreshAll();
    if (typeof searchCustomers === 'function') {
      searchCustomers('');
    }

    btn.innerHTML = `✓ Imported Successfully!`;
    setTimeout(() => {
      btn.innerHTML = originalHtml;
      btn.disabled = false;
    }, 2000);

    lucide.createIcons();
  } catch (err) {
    console.error('Error uploading excel:', err);
    alert(`Upload failed: ${err.message}`);
    btn.innerHTML = originalHtml;
    btn.disabled = false;
  }
}

// -----------------------------------------------------------------
// FLEET RADAR & ANTI-SLACKING TRACKER
// -----------------------------------------------------------------
let allRiders = [];

async function fetchFleet() {
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

        <!-- Telemetry & Location Details -->
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
                🚨 Transit Gap Detected: Rider completed delivery 25m ago (3.8 km away). Rider has delayed returning by +${r.currentRun.unaccountedGapMinutes} minutes.
              </div>
            ` : ''}
          ` : `
            <div class="pt-1 text-[11px] text-emerald-700 font-medium">✓ Ready at counter. No active orders assigned.</div>
          `}
        </div>

        <!-- Action Buttons -->
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
