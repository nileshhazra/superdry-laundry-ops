const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const XLSX = require('xlsx');

const upload = multer({ storage: multer.memoryStorage() });

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// In-Memory Database initialized from data/
const customersData = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'customers.json'), 'utf8'));
const initialState = JSON.parse(fs.readFileSync(path.join(__dirname, 'data', 'initial_state.json'), 'utf8'));

let customers = [...customersData];
let orders = [...initialState.orders];
let leads = [...initialState.leads];
let garmentsCatalog = [...initialState.garmentsCatalog];
const storeSettings = { ...initialState.storeSettings };

// Staff Test Users for Authentication & RBAC
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

// Authentication API
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body || {};
  const user = AUTH_USERS.find(u => u.username === username && u.password === password);
  if (!user) {
    return res.status(401).json({ error: 'Invalid username or password' });
  }
  const { password: _, ...safeUser } = user;
  res.json({ success: true, user: safeUser });
});

app.get('/api/auth/users', (req, res) => {
  const safeUsers = AUTH_USERS.map(({ password, ...u }) => u);
  res.json({ users: safeUsers });
});

// -------------------------------------------------------------
// 1. STATS / ANALYTICS (For Store Owner / Admin)
// -------------------------------------------------------------
app.get('/api/stats', (req, res) => {
  const totalRevenue = orders
    .filter(o => o.paymentStatus === 'PAID')
    .reduce((sum, o) => sum + o.subtotal, 0);

  const pendingCollection = orders
    .filter(o => o.paymentStatus !== 'PAID')
    .reduce((sum, o) => sum + o.subtotal, 0);

  const activeOrdersCount = orders.filter(o => o.status !== 'DELIVERED').length;
  const completedOrdersCount = orders.filter(o => o.status === 'DELIVERED').length;

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

  const pendingLeads = leads.filter(l => l.status !== 'RESOLVED').length;

  // Breakdown by zone
  const zoneStats = {};
  orders.forEach(o => {
    zoneStats[o.zone] = (zoneStats[o.zone] || 0) + 1;
  });

  res.json({
    totalCustomers: customers.length,
    totalRevenue,
    pendingCollection,
    activeOrdersCount,
    completedOrdersCount,
    pendingLeads,
    stageCounts,
    zoneStats,
    storeSettings
  });
});

// -------------------------------------------------------------
// 2. CUSTOMERS API (Search 2,000+ records)
// -------------------------------------------------------------
app.get('/api/customers', (req, res) => {
  const query = (req.query.q || '').trim().toLowerCase();
  const limit = parseInt(req.query.limit, 10) || 30;

  if (!query) {
    return res.json(customers.slice(0, limit));
  }

  const filtered = customers.filter(c =>
    c.name.toLowerCase().includes(query) ||
    c.phone.toLowerCase().includes(query) ||
    c.address.toLowerCase().includes(query) ||
    c.zone.toLowerCase().includes(query) ||
    c.id.toLowerCase().includes(query)
  );

  res.json(filtered.slice(0, limit));
});

app.post('/api/customers', (req, res) => {
  const { name, phone, address, zone, preferredService } = req.body;
  if (!name || !phone || !address) {
    return res.status(400).json({ error: 'Name, phone, and address are required' });
  }

  const newCust = {
    id: `CUST-${(customers.length + 1).toString().padStart(4, '0')}`,
    name,
    phone,
    address,
    zone: zone || 'Sector 15 - North',
    totalOrders: 0,
    loyaltyPoints: 0,
    preferredService: preferredService || 'Wash & Steam Iron',
    createdAt: new Date().toISOString()
  };

  customers.unshift(newCust);
  res.status(201).json(newCust);
});

// Excel / CSV Bulk Customer Upload
app.post('/api/customers/upload-excel', upload.single('file'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded. Please upload a .xlsx, .xls, or .csv file.' });
    }

    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
    const firstSheetName = workbook.SheetNames[0];
    const worksheet = workbook.Sheets[firstSheetName];
    const rawRows = XLSX.utils.sheet_to_json(worksheet, { defval: '' });

    if (!rawRows || rawRows.length === 0) {
      return res.status(400).json({ error: 'The uploaded sheet is empty.' });
    }

    let newCount = 0;
    let updatedCount = 0;
    const importedSample = [];

    rawRows.forEach((row, idx) => {
      // Find matching keys case-insensitively
      const getVal = (possibleKeys) => {
        for (const k of Object.keys(row)) {
          const cleanK = k.trim().toLowerCase().replace(/[^a-z0-9]/g, '');
          for (const pk of possibleKeys) {
            if (cleanK === pk) {
              return String(row[k]).trim();
            }
          }
        }
        return '';
      };

      const name = getVal(['name', 'customername', 'fullname', 'clientname', 'customer']);
      let phone = getVal(['phone', 'mobile', 'contact', 'phonenumber', 'mobilenumber', 'cell', 'tel']);
      const address = getVal(['address', 'deliveryaddress', 'location', 'addressline', 'flat', 'house']);
      const zone = getVal(['zone', 'sector', 'area', 'locality']) || 'Sector 15 - North';
      const preferredService = getVal(['preferredservice', 'service', 'servicepreference']) || 'Wash & Steam Iron';
      const pastOrdersStr = getVal(['pastorders', 'totalorders', 'orders']);
      const pastOrders = parseInt(pastOrdersStr, 10) || 0;

      if (!name && !phone) return; // skip junk rows

      // Format phone number
      if (phone && !phone.startsWith('+')) {
        const digits = phone.replace(/\D/g, '');
        if (digits.length === 10) {
          phone = `+91 ${digits}`;
        }
      }

      // Check if customer already exists by phone
      const existingIdx = customers.findIndex(c => c.phone && phone && c.phone.replace(/\D/g, '') === phone.replace(/\D/g, ''));

      if (existingIdx !== -1) {
        // Update existing customer details
        if (name) customers[existingIdx].name = name;
        if (address) customers[existingIdx].address = address;
        if (zone) customers[existingIdx].zone = zone;
        if (preferredService) customers[existingIdx].preferredService = preferredService;
        if (pastOrders > 0) customers[existingIdx].totalOrders = pastOrders;
        updatedCount++;
      } else {
        // Create new customer
        const newId = `CUST-${(customers.length + 1).toString().padStart(4, '0')}`;
        const newCust = {
          id: newId,
          name: name || `Customer ${newId}`,
          phone: phone || '+91 0000000000',
          address: address || 'Store Area, Gurugram',
          zone,
          totalOrders: pastOrders,
          loyaltyPoints: pastOrders * 10,
          preferredService,
          createdAt: new Date().toISOString()
        };
        customers.unshift(newCust);
        newCount++;

        if (importedSample.length < 5) {
          importedSample.push(newCust);
        }
      }
    });

    // Save updated customers back to disk asynchronously
    fs.writeFile(
      path.join(__dirname, 'data', 'customers.json'),
      JSON.stringify(customers, null, 2),
      (err) => { if (err) console.error('Error saving customers.json:', err); }
    );

    res.json({
      success: true,
      totalRowsProcessed: rawRows.length,
      newCount,
      updatedCount,
      totalCustomers: customers.length,
      sample: importedSample
    });
  } catch (err) {
    console.error('Error parsing Excel:', err);
    res.status(500).json({ error: `Failed to parse Excel file: ${err.message}` });
  }
});

// -------------------------------------------------------------
// 3. CATALOG & PRICING
// -------------------------------------------------------------
app.get('/api/catalog', (req, res) => {
  res.json(garmentsCatalog);
});

// -------------------------------------------------------------
// 4. ORDERS API
// -------------------------------------------------------------
app.get('/api/orders', (req, res) => {
  const { status, zone, role } = req.query;
  let result = [...orders];

  if (status) {
    result = result.filter(o => o.status === status);
  }
  if (zone) {
    result = result.filter(o => o.zone === zone);
  }

  // Role-specific filtering if needed
  if (role === 'washer') {
    result = result.filter(o => ['RECEIVED_IN_STORE', 'WASHING', 'DRYING', 'IRONING', 'PACKED'].includes(o.status));
    // Sort Express first, then by promised delivery date
    result.sort((a, b) => {
      if (a.isExpress && !b.isExpress) return -1;
      if (!a.isExpress && b.isExpress) return 1;
      return new Date(a.promisedDelivery) - new Date(b.promisedDelivery);
    });
  } else if (role === 'pickup') {
    result = result.filter(o => ['PICKUP_REQUESTED', 'PICKED_UP'].includes(o.status));
  } else if (role === 'delivery') {
    result = result.filter(o => ['PACKED', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status));
  }

  res.json(result);
});

app.post('/api/orders', (req, res) => {
  const {
    customerId,
    customerName,
    customerPhone,
    customerAddress,
    zone,
    items,
    isExpress,
    notes
  } = req.body;

  if (!customerName || !customerPhone || !items || items.length === 0) {
    return res.status(400).json({ error: 'Customer details and items are required' });
  }

  let subtotal = 0;
  const processedItems = items.map((item, idx) => {
    subtotal += item.rate || 0;
    return {
      pieceNumber: idx + 1,
      garmentName: item.garmentName,
      service: item.service || 'Wash & Steam Iron',
      rate: item.rate,
      specialNote: item.specialNote || '',
      hasStain: Boolean(item.hasStain)
    };
  });

  if (isExpress) {
    subtotal = Math.round(subtotal * 1.5);
  }

  const nextIdNum = 1000 + orders.length + 1;
  const now = new Date();
  const promised = new Date(now.getTime() + (isExpress ? 24 : 48) * 3600 * 1000);

  const newOrder = {
    id: `ORD-${nextIdNum}`,
    customerId: customerId || `CUST-${Math.floor(Math.random() * 9000 + 1000)}`,
    customerName,
    customerPhone,
    customerAddress,
    zone: zone || 'Sector 15 - North',
    status: 'RECEIVED_IN_STORE',
    isExpress: Boolean(isExpress),
    totalPieces: processedItems.length,
    items: processedItems,
    subtotal,
    paymentStatus: 'PENDING',
    paymentMode: 'COD / UPI on Delivery',
    notes: notes || '',
    createdAt: now.toISOString(),
    promisedDelivery: promised.toISOString(),
    assignedRider: null,
    assignedWasher: 'Suresh Care Master'
  };

  orders.unshift(newOrder);

  // Update customer total orders
  const custIndex = customers.findIndex(c => c.id === customerId || c.phone === customerPhone);
  if (custIndex !== -1) {
    customers[custIndex].totalOrders += 1;
    customers[custIndex].loyaltyPoints += Math.floor(subtotal / 10);
  }

  res.status(201).json(newOrder);
});

// Update Order Status
app.patch('/api/orders/:id/status', (req, res) => {
  const { id } = req.params;
  const { status, paymentStatus, paymentMode, assignedRider, assignedWasher } = req.body;

  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  if (status) order.status = status;
  if (paymentStatus) order.paymentStatus = paymentStatus;
  if (paymentMode) order.paymentMode = paymentMode;
  if (assignedRider !== undefined) order.assignedRider = assignedRider;
  if (assignedWasher !== undefined) order.assignedWasher = assignedWasher;

  res.json(order);
});

// Pickup Intake from Doorstep by Delivery Rider
app.post('/api/orders/:id/pickup-intake', (req, res) => {
  const { id } = req.params;
  const { pieces, weightKg, serviceType, notes, preferredDeliverySlot } = req.body;

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = 'PICKED_UP';
  if (pieces !== undefined) order.totalPieces = parseInt(pieces, 10) || order.totalPieces;
  if (weightKg !== undefined) order.weightKg = parseFloat(weightKg) || null;
  if (serviceType) order.serviceType = serviceType;
  if (notes) order.notes = notes;
  if (preferredDeliverySlot) order.preferredDeliverySlot = preferredDeliverySlot;
  order.pickedUpAt = new Date().toISOString();

  res.json({ success: true, order });
});

// Delivery Completion with Proof-of-Delivery (POD) / Payment Photo
app.post('/api/orders/:id/complete-delivery', (req, res) => {
  const { id } = req.params;
  const { paymentMode, podImage, amountCollected, notes } = req.body;

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.status = 'DELIVERED';
  order.paymentStatus = 'PAID';
  order.paymentMode = paymentMode || 'UPI';
  order.podImage = podImage || null; // base64 data URL or uploaded photo
  order.podVerified = false; // pending Admin audit
  order.deliveredAt = new Date().toISOString();
  if (amountCollected !== undefined) order.subtotal = amountCollected;
  if (notes) order.deliveryNotes = notes;

  res.json({ success: true, order });
});

// Admin POD Verification
app.patch('/api/orders/:id/verify-pod', (req, res) => {
  const { id } = req.params;
  const { verified } = req.body;
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  order.podVerified = Boolean(verified);
  order.podVerifiedAt = new Date().toISOString();
  res.json({ success: true, order });
});

// Workshop Worker Assignment & Accountability
app.patch('/api/orders/:id/assign-worker', (req, res) => {
  const { id } = req.params;
  const { workerType, workerName } = req.body; // workerType: 'washer' | 'ironer' | 'dryclean'

  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  if (!order.assignedWorkers) order.assignedWorkers = {};
  if (workerType && workerName) {
    order.assignedWorkers[workerType] = workerName;
  }
  order.assignedWasher = workerName; // fallback compatibility

  res.json({ success: true, order });
});

// WhatsApp "Order Ready - Confirm Availability" Trigger
app.post('/api/orders/:id/notify-ready', (req, res) => {
  const { id } = req.params;
  const order = orders.find(o => o.id === id);
  if (!order) return res.status(404).json({ error: 'Order not found' });

  const msg = `Hello ${order.customerName}! Your Bumbledry laundry order #${order.id} (${order.totalPieces} pieces) is packed and ready. Please reply with your availability today or tomorrow (e.g., Morning 10-12 or Evening 5-7) so our rider can deliver smoothly!`;

  order.readyNotificationSent = true;
  order.readyNotificationSentAt = new Date().toISOString();
  order.readyNotificationMessage = msg;

  res.json({
    success: true,
    sentTo: order.customerPhone,
    customerName: order.customerName,
    message: msg
  });
});

// Logistics & Dispatch Route Recommendations
app.get('/api/logistics/recommendations', (req, res) => {
  const readyOrders = orders.filter(o => ['PACKED', 'OUT_FOR_DELIVERY'].includes(o.status));
  const pendingPickups = orders.filter(o => o.status === 'PICKUP_REQUESTED');

  // 1. Combine Pickup with Ready Deliveries in same zone
  const combineRecommendations = [];
  const zonesWithPickups = [...new Set(pendingPickups.map(p => p.zone))];

  zonesWithPickups.forEach(zone => {
    const pickupsInZone = pendingPickups.filter(p => p.zone === zone);
    const deliveriesInZone = readyOrders.filter(d => d.zone === zone);
    if (deliveriesInZone.length > 0) {
      combineRecommendations.push({
        zone,
        pickupCount: pickupsInZone.length,
        deliveryCount: deliveriesInZone.length,
        pickups: pickupsInZone.map(p => ({ id: p.id, name: p.customerName, phone: p.customerPhone })),
        deliveries: deliveriesInZone.map(d => ({ id: d.id, name: d.customerName, phone: d.customerPhone, amount: d.subtotal })),
        savingNote: `Dispatched rider can fulfill ${deliveriesInZone.length} drop(s) while executing ${pickupsInZone.length} pickup(s) in ${zone}. Saves 1 trip (~6-8 km).`
      });
    }
  });

  // 2. Early Delivery Opportunities (orders packed today whose promised delivery is tomorrow)
  const tomorrowStr = new Date(Date.now() + 24 * 3600 * 1000).toISOString().split('T')[0];
  const earlyDeliveryOpportunities = readyOrders.filter(o => {
    return o.promisedDelivery && o.promisedDelivery.startsWith(tomorrowStr);
  }).map(o => ({
    id: o.id,
    customerName: o.customerName,
    phone: o.customerPhone,
    zone: o.zone,
    address: o.customerAddress,
    amount: o.subtotal,
    promisedDelivery: o.promisedDelivery,
    suggestion: `Ready today ahead of SLA! Call customer to deliver alongside today's ${o.zone} cluster to eliminate tomorrow's run.`
  }));

  res.json({
    combineRecommendations,
    earlyDeliveryOpportunities,
    idleRiders: riders.filter(r => r.status === 'IDLE_AT_STORE')
  });
});

// Thermal Tag Layout generator for Printer
app.get('/api/orders/:id/tags', (req, res) => {
  const { id } = req.params;
  const order = orders.find(o => o.id === id);
  if (!order) {
    return res.status(404).json({ error: 'Order not found' });
  }

  const tags = order.items.map(item => ({
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

  res.json({
    order,
    tags,
    storeSettings
  });
});

// -------------------------------------------------------------
// 5. INQUIRIES & MISSED CALLS (Front Desk Lead Management)
// -------------------------------------------------------------
app.get('/api/leads', (req, res) => {
  const { status, filter } = req.query;
  let result = leads.filter(l => l.status !== 'DELETED');

  if (filter === 'active') {
    result = result.filter(l => l.status !== 'RESOLVED' && l.status !== 'ARCHIVED');
  } else if (filter === 'resolved') {
    result = result.filter(l => l.status === 'RESOLVED');
  } else if (filter === 'archived') {
    result = result.filter(l => l.status === 'ARCHIVED');
  }

  res.json(result);
});

app.post('/api/leads', (req, res) => {
  const { customerName, phone, message, channel, address, zone } = req.body;
  const cleanPhone = (phone || '').replace(/\D/g, '');

  // Deduplication check: if active lead exists with same phone, update it
  const existing = leads.find(l => l.phone.replace(/\D/g, '') === cleanPhone && l.status !== 'DELETED');
  if (existing) {
    existing.attempts = (existing.attempts || 1) + 1;
    existing.message = `${message || 'Repeated inquiry'} (Attempt #${existing.attempts})`;
    existing.status = 'PENDING_CALLBACK'; // re-open
    existing.priority = 'URGENT';
    existing.slaMinutesRemaining = 10;
    existing.updatedAt = new Date().toISOString();
    return res.json(existing);
  }

  const newLead = {
    id: `LEAD-${100 + leads.length + 1}`,
    customerName: customerName || 'Unknown Customer',
    phone,
    channel: channel || 'WhatsApp Inbound',
    message: message || 'Inquired about laundry pickup',
    zone: zone || 'Sector 15 - North',
    address: address || '',
    status: 'PENDING_CALLBACK',
    attempts: 1,
    createdAt: new Date().toISOString(),
    slaMinutesRemaining: 15,
    priority: 'HIGH'
  };

  leads.unshift(newLead);
  res.status(201).json(newLead);
});

// Update Lead Status (e.g. RESOLVED, ARCHIVED, or notes)
app.patch('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const { status, notes } = req.body;

  const lead = leads.find(l => l.id === id);
  if (!lead) {
    return res.status(404).json({ error: 'Lead not found' });
  }

  if (status) lead.status = status;
  if (notes) lead.notes = notes;

  res.json(lead);
});

// Delete a Lead
app.delete('/api/leads/:id', (req, res) => {
  const { id } = req.params;
  const idx = leads.findIndex(l => l.id === id);
  if (idx !== -1) {
    leads.splice(idx, 1);
    return res.json({ success: true, message: `Lead ${id} deleted` });
  }
  res.status(404).json({ error: 'Lead not found' });
});

// Clear / Archive All Resolved Leads
app.post('/api/leads/clear-resolved', (req, res) => {
  const action = req.body.action || 'archive'; // 'archive' or 'delete'
  let count = 0;

  if (action === 'delete') {
    const originalLen = leads.length;
    leads = leads.filter(l => l.status !== 'RESOLVED');
    count = originalLen - leads.length;
  } else {
    leads.forEach(l => {
      if (l.status === 'RESOLVED') {
        l.status = 'ARCHIVED';
        count++;
      }
    });
  }

  res.json({ success: true, count, remaining: leads.length });
});

// -------------------------------------------------------------
// 6. ROUTE CLUSTERING (For Delivery Man)
// -------------------------------------------------------------
app.get('/api/logistics/routes', (req, res) => {
  // Group ready orders by Zone for batch delivery runs
  const readyOrders = orders.filter(o => ['PACKED', 'OUT_FOR_DELIVERY'].includes(o.status));

  const zonesMap = {};
  readyOrders.forEach(o => {
    if (!zonesMap[o.zone]) {
      zonesMap[o.zone] = {
        zoneName: o.zone,
        orders: [],
        totalPieces: 0,
        totalAmountToCollect: 0
      };
    }
    zonesMap[o.zone].orders.push(o);
    zonesMap[o.zone].totalPieces += o.totalPieces;
    if (o.paymentStatus !== 'PAID') {
      zonesMap[o.zone].totalAmountToCollect += o.subtotal;
    }
  });

  const clusters = Object.values(zonesMap).sort((a, b) => b.orders.length - a.orders.length);
  res.json(clusters);
});

// -------------------------------------------------------------
// 6B. FLEET TRACKING & ANTI-SLACKING ENGINE
// -------------------------------------------------------------
let riders = [
  {
    id: 'RIDER-01',
    name: 'Rajesh Kumar',
    phone: '+91 9811882233',
    vehicle: 'Honda Activa (HR26-BW-4821)',
    status: 'RETURNING_TO_STORE', // 'IDLE_AT_STORE' | 'OUT_FOR_DELIVERY' | 'RETURNING_TO_STORE' | 'OVERDUE_RETURN'
    currentRun: {
      id: 'RUN-201',
      zone: 'Sector 14 - North',
      orderIds: ['ORD-1040', 'ORD-1041'],
      totalOrders: 2,
      dispatchedAt: new Date(Date.now() - 48 * 60 * 1000).toISOString(),
      allDeliveredAt: new Date(Date.now() - 25 * 60 * 1000).toISOString(), // 25 mins ago!
      expectedReturnAt: new Date(Date.now() - 10 * 60 * 1000).toISOString(), // 10 mins overdue!
      returnDistanceKm: 3.8,
      normalReturnMins: 12,
      unaccountedGapMinutes: 13,
      isOverdue: true
    },
    location: {
      lat: 28.4740,
      lng: 77.0425,
      address: 'Near Old Railway Road, 3.8 km from Store',
      speedKmh: 0, // stationary!
      batteryLevel: '74%',
      lastPingAt: new Date().toISOString()
    },
    todayStats: {
      completedRuns: 3,
      onTimeRuns: 2,
      delayedReturns: 1,
      totalUnaccountedGapMins: 26,
      integrityScore: 78 // Score based on punctuality
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

app.get('/api/fleet', (req, res) => {
  // Update dynamically overdue state
  const now = Date.now();
  riders.forEach(r => {
    if (r.currentRun && r.status === 'RETURNING_TO_STORE') {
      const expTime = new Date(r.currentRun.expectedReturnAt).getTime();
      if (now > expTime) {
        r.status = 'OVERDUE_RETURN';
        r.currentRun.isOverdue = true;
        r.currentRun.unaccountedGapMinutes = Math.round((now - expTime) / (60 * 1000));
      }
    }
  });
  res.json(riders);
});

// GPS Location Ping from Rider's phone
app.post('/api/fleet/ping', (req, res) => {
  const { riderId, lat, lng, speed, battery, address } = req.body;
  const rider = riders.find(r => r.id === (riderId || 'RIDER-01'));
  if (!rider) return res.status(404).json({ error: 'Rider not found' });

  rider.location = {
    lat: lat || rider.location.lat,
    lng: lng || rider.location.lng,
    speedKmh: speed || 0,
    batteryLevel: battery || rider.location.batteryLevel,
    address: address || rider.location.address,
    lastPingAt: new Date().toISOString()
  };

  res.json({ success: true, location: rider.location });
});

// Start a Return Phase after deliveries
app.post('/api/fleet/start-return', (req, res) => {
  const { riderId } = req.body;
  const rider = riders.find(r => r.id === (riderId || 'RIDER-01'));
  if (!rider) return res.status(404).json({ error: 'Rider not found' });

  const now = new Date();
  const normalReturnMins = 15;
  const expectedReturn = new Date(now.getTime() + normalReturnMins * 60 * 1000);

  rider.status = 'RETURNING_TO_STORE';
  if (!rider.currentRun) {
    rider.currentRun = {
      id: `RUN-${Math.floor(Math.random() * 800 + 100)}`,
      zone: 'Sector 14 - North',
      orderIds: ['ORD-1040', 'ORD-1041'],
      totalOrders: 2,
      dispatchedAt: new Date(now.getTime() - 25 * 60 * 1000).toISOString()
    };
  }

  rider.currentRun.allDeliveredAt = now.toISOString();
  rider.currentRun.expectedReturnAt = expectedReturn.toISOString();
  rider.currentRun.normalReturnMins = normalReturnMins;
  rider.currentRun.unaccountedGapMinutes = 0;
  rider.currentRun.isOverdue = false;

  res.json({
    success: true,
    rider,
    message: `Return clock initiated. Expected back at store by ${expectedReturn.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}`
  });
});

// Store Counter Check-in (Closes the trip and calculates transit gap)
app.post('/api/fleet/check-in-store', (req, res) => {
  const { riderId } = req.body;
  const rider = riders.find(r => r.id === (riderId || 'RIDER-01'));
  if (!rider) return res.status(404).json({ error: 'Rider not found' });

  let gapMinutes = 0;
  if (rider.currentRun && rider.currentRun.expectedReturnAt) {
    const diffMs = Date.now() - new Date(rider.currentRun.expectedReturnAt).getTime();
    if (diffMs > 0) {
      gapMinutes = Math.round(diffMs / (60 * 1000));
    }
  }

  rider.todayStats.completedRuns += 1;
  if (gapMinutes > 5) {
    rider.todayStats.delayedReturns += 1;
    rider.todayStats.totalUnaccountedGapMins += gapMinutes;
    rider.todayStats.integrityScore = Math.max(50, rider.todayStats.integrityScore - 10);
  } else {
    rider.todayStats.onTimeRuns += 1;
    rider.todayStats.integrityScore = Math.min(100, rider.todayStats.integrityScore + 2);
  }

  // Reset to idle at store
  rider.status = 'IDLE_AT_STORE';
  rider.currentRun = null;
  rider.location.address = 'At Store (Sector 15 Market Counter)';

  res.json({
    success: true,
    rider,
    gapMinutes,
    message: gapMinutes > 5
      ? `Trip closed with ${gapMinutes} min unaccounted transit gap logged in owner audit.`
      : `Trip closed on-time! Rider marked Available at store.`
  });
});

// Send WhatsApp Reminder to Overdue Rider
app.post('/api/fleet/send-warning', (req, res) => {
  const { riderId } = req.body;
  const rider = riders.find(r => r.id === (riderId || 'RIDER-01'));
  if (!rider) return res.status(404).json({ error: 'Rider not found' });

  const msg = `ALERT from Bumbledry Store Manager: Your Sector 14 delivery run was completed ${rider.currentRun ? rider.currentRun.unaccountedGapMinutes : 15} minutes ago. Next batch of 3 customer orders is packed and waiting. Please report back to the store immediately.`;
  
  res.json({
    success: true,
    sentTo: rider.phone,
    riderName: rider.name,
    message: msg
  });
});

// -------------------------------------------------------------
// 7. WHATSAPP SIMULATION & WEBHOOK ENGINE
// -------------------------------------------------------------
app.post('/api/whatsapp/simulate', (req, res) => {
  const { type, senderPhone, senderName, messageText, locationCoordinates, addressText } = req.body;
  const cleanPhone = (senderPhone || '+91 9899112233').replace(/\D/g, '');

  let createdLead = null;
  let autoReply = '';

  // Check for existing lead with same phone to prevent duplicate cards
  const existingLead = leads.find(l => l.phone.replace(/\D/g, '') === cleanPhone);

  if (type === 'MISSED_CALL') {
    autoReply = `Hi ${senderName || 'there'}! We noticed we missed your call at Bumbledry Laundry. Would you like to schedule an instant doorstep pickup? Reply 1 for Pickup, or drop your location pin!`;

    if (existingLead) {
      existingLead.attempts = (existingLead.attempts || 1) + 1;
      existingLead.channel = 'WhatsApp Missed Call';
      existingLead.message = `Repeated missed call #${existingLead.attempts}. Automated callback template re-sent.`;
      existingLead.status = 'PENDING_CALLBACK'; // re-open card
      existingLead.priority = 'URGENT';
      existingLead.slaMinutesRemaining = 10;
      existingLead.updatedAt = new Date().toISOString();
      createdLead = existingLead;
    } else {
      createdLead = {
        id: `LEAD-${100 + leads.length + 1}`,
        customerName: senderName || 'Potential Client',
        phone: senderPhone || '+91 9899112233',
        channel: 'WhatsApp Missed Call',
        message: 'Missed voice call. System dispatched automated WhatsApp callback template.',
        zone: 'Sector 14 - North',
        address: '',
        status: 'PENDING_CALLBACK',
        attempts: 1,
        createdAt: new Date().toISOString(),
        slaMinutesRemaining: 15,
        priority: 'URGENT'
      };
      leads.unshift(createdLead);
    }
  } else if (type === 'LOCATION_PIN') {
    const locMsg = `Customer shared GPS location: ${locationCoordinates || '28.4595° N, 77.0266° E'} (${addressText || 'Sector 15 Main Market'})`;

    if (existingLead) {
      existingLead.channel = 'WhatsApp Live Location';
      existingLead.message = locMsg;
      existingLead.address = addressText || existingLead.address || '#42, Pocket 2, Sector 15, Gurugram';
      existingLead.status = 'LOCATION_RECEIVED';
      existingLead.priority = 'HIGH';
      existingLead.slaMinutesRemaining = 10;
      existingLead.updatedAt = new Date().toISOString();
      createdLead = existingLead;
    } else {
      createdLead = {
        id: `LEAD-${100 + leads.length + 1}`,
        customerName: senderName || 'WhatsApp Customer',
        phone: senderPhone || '+91 9877665544',
        channel: 'WhatsApp Live Location',
        message: locMsg,
        zone: 'Sector 15 - North',
        address: addressText || '#42, Pocket 2, Sector 15, Gurugram',
        status: 'LOCATION_RECEIVED',
        attempts: 1,
        createdAt: new Date().toISOString(),
        slaMinutesRemaining: 10,
        priority: 'HIGH'
      };
      leads.unshift(createdLead);
    }

    // Auto-generate a PICKUP_REQUESTED order if not already pending
    const nextOrderNum = 1000 + orders.length + 1;
    const newOrder = {
      id: `ORD-${nextOrderNum}`,
      customerId: `CUST-${Math.floor(Math.random() * 8000 + 1000)}`,
      customerName: createdLead.customerName,
      customerPhone: createdLead.phone,
      customerAddress: createdLead.address,
      zone: createdLead.zone,
      status: 'PICKUP_REQUESTED',
      isExpress: false,
      totalPieces: 0,
      items: [],
      subtotal: 0,
      paymentStatus: 'PENDING',
      paymentMode: 'COD / UPI on Delivery',
      createdAt: new Date().toISOString(),
      promisedDelivery: new Date(Date.now() + 48 * 3600 * 1000).toISOString(),
      assignedRider: 'Rajesh Kumar (Field Agent)',
      assignedWasher: null
    };
    orders.unshift(newOrder);

    autoReply = `Thank you! We have received your location pin. Rider Rajesh Kumar has been dispatched for pickup between 3:00 PM - 5:00 PM. Order tracking ID: ORD-${nextOrderNum}.`;
  } else {
    // Normal Chat Inquiry
    autoReply = `Hello from Bumbledry Laundry! Our dry cleaning rate is ₹90 for shirts, ₹110 for trousers, and ₹280 for suits with free doorstep pickup. Would you like to schedule a pickup today?`;

    if (existingLead) {
      existingLead.attempts = (existingLead.attempts || 1) + 1;
      existingLead.message = messageText || existingLead.message;
      existingLead.status = 'PENDING_CALLBACK';
      existingLead.updatedAt = new Date().toISOString();
      createdLead = existingLead;
    } else {
      createdLead = {
        id: `LEAD-${100 + leads.length + 1}`,
        customerName: senderName || 'WhatsApp User',
        phone: senderPhone || '+91 9955443322',
        channel: 'WhatsApp Chat',
        message: messageText || 'Inquiry about dry cleaning rates',
        zone: 'DLF Phase 2 - East',
        address: '',
        status: 'PENDING_CALLBACK',
        attempts: 1,
        createdAt: new Date().toISOString(),
        slaMinutesRemaining: 20,
        priority: 'NORMAL'
      };
      leads.unshift(createdLead);
    }
  }

  res.json({
    success: true,
    lead: createdLead,
    autoReplyDispatched: autoReply
  });
});

app.listen(PORT, () => {
  console.log(`Bumbledry Laundry Management System is live at http://localhost:${PORT}`);
});
