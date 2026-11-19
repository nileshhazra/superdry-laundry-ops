# SuperDry PRO - Smart Laundry & Dry Cleaning Operations Platform

SuperDry PRO is an operations management and logistics platform built for laundry and dry-cleaning businesses. It connects store front desk, plant operators, and field delivery agents into a single unified workflow.

---

## 🚀 Key Persona Capabilities

1. **👑 Store Owner / Super Admin**:
   - Executive dashboard: Collected revenue, pending COD/UPI, active in-process orders, and total customer base (2,000+ records).
   - 8-stage laundry pipeline velocity tracking.
   - Master orders ledger with real-time status filtering.
   - **Fleet Radar & Anti-Slacking Tracker**: Live GPS location, return SLA countdowns, and daily transit gap discrepancy audits.
   - Bulk Excel/CSV customer upload with auto-mapping & deduplication.

2. **📋 Front Desk / Store Manager**:
   - **Inbound Leads & Missed Calls (Anti-Loss Hub)**: Automated lead capture with callback SLA countdown timers, repeated caller detection (`⚠ Called 2x`), and 1-click archiving/cleaning.
   - **Tagging & Intake Counter**: Piece counting, garment stain inspection, and 1-click thermal barcode tag preview (58mm/80mm ESC/POS compatible).
   - **Fast POS Order Creation**: Search 2,000+ customers by name or phone, add garment breakdowns, care notes, and express delivery toggle.

3. **👕 Laundry Master / Washerman (Floor View)**:
   - Urgency-sorted Kanban board (Intake $\rightarrow$ In Washers $\rightarrow$ Dry & Steam Iron $\rightarrow$ Packed & Ready).
   - Express priority badges (24-hour turnaround pinned first).
   - Mobile stage switcher for quick filtering on handheld devices.

4. **🛵 Field Logistics Agent (PWA)**:
   - Mobile PWA with proximity-sorted pickup requests, 1-tap calling, and Google Maps geonavigation.
   - Zonal route batching for deliveries (cluster orders in the same direction).
   - **Mandatory Return-to-Store Loop**: Automatic countdown back to store with counter check-in to close the trip.

5. **💬 WhatsApp Cloud API Integration**:
   - Webhook engine for inbound messages, missed call alerts, and live GPS location pins.

---

## 🛠 Tech Stack

- **Backend**: Node.js & Express
- **Frontend**: Responsive Single-Page Application (HTML5, Tailwind CSS, Lucide Icons)
- **Data Engine**: JSON-backed local storage (ready for PostgreSQL)
- **File Processing**: SheetJS (`xlsx`) & Multer for bulk Excel imports

---

## 🏁 Quickstart (Local Run)

1. Clone the repository:
   ```bash
   git clone <YOUR_GITHUB_REPO_URL>
   cd td-operations-application
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application:
   ```bash
   npm start
   ```

4. Open your browser:
   Visit [http://localhost:3000](http://localhost:3000)
