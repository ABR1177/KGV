let state = {
    members: [],
    gardens: [],
    events: [],
    news: [],
    currentView: 'dashboard',
    activeMemberId: 'm1', // Default to Max for testing permissions
    settings: {
        totalGardens: 50,
        clubName: "KGV Am Lohmühlenbach e.V.",
        defaultWorkHours: 10,
        feeWater: 25.00,
        feeService: 15.00,
        feePowerBase: 40.00,
        feePool: 10.00,
        workRate: 10.00
    },
    inventory: []
};

let currentMemberFilter = 'all';

const SAMPLE_MEMBERS = [
    {
        id: 'm1',
        firstName: 'Max',
        lastName: 'Mustermann',
        gender: 'männlich',
        birthName: 'Mustermann',
        birthDate: '1980-05-15',
        profession: 'Softwareentwickler',
        address: { street: 'Musterstraße', houseNumber: '1', zip: '12345', city: 'Mühlhausen' },
        phone: { landline: '03601 12345', mobile: '0170 1234567' },
        email: 'max@example.com',
        family: { adults: 2, children: 1 },
        memberNumber: '2023-001',
        isBoardMember: true,
        boardRole: 'Vorsitzender',
        workHours: [
            { id: 'wh1', date: '2024-03-15', hours: 4, description: 'Heckenschnitt am Hauptweg' },
            { id: 'wh2', date: '2024-05-20', hours: 2, description: 'Müllaufsammlung' }
        ]
    },
    {
        id: 'm2',
        firstName: 'Erika',
        lastName: 'Musterfrau',
        gender: 'weiblich',
        birthName: 'Beispiel',
        birthDate: '1985-08-20',
        profession: 'Ärztin',
        address: { street: 'Gartenweg', houseNumber: '12', zip: '12345', city: 'Mühlhausen' },
        phone: { landline: '03601 54321', mobile: '0171 7654321' },
        email: 'erika@example.com',
        family: { adults: 1, children: 0 },
        memberNumber: '2023-002',
        workHours: []
    }
];

const SAMPLE_NEWS = [
    { id: 'n1', date: '2024-06-10', title: 'Wasser am Lohmühlenbach', content: 'Wegen Bauarbeiten am Brunnen wird das Wasser am Lohmühlenbach-Hauptweg am Samstag von 8-12 Uhr abgestellt.' },
    { id: 'n2', date: '2024-06-05', title: 'Container am Eingang', content: 'Der Grünschnittcontainer steht ab dem 15. Juni am Vereinshaus bereit.' }
];

const SAMPLE_EVENTS = [
    { id: 'e1', date: '2024-07-20', title: 'Lohmühlen-Sommerfest', location: 'Festplatz am Bach' },
    { id: 'e2', date: '2024-08-15', title: 'Vorstandsbegehung Nord', location: 'Gärten 1-30' }
];

// --- Initialization ---
document.addEventListener('DOMContentLoaded', () => {
    init();
});

async function init() {
    await loadData();

    // Migration: If landOwner is missing, reset gardens
    if (state.gardens.length > 0 && !state.gardens[0].landOwner) {
        state.gardens = [];
    }

    // Migration: If no members, add sample members
    if (state.members.length === 0) {
        state.members = [...SAMPLE_MEMBERS];
    }

    if (state.gardens.length === 0) {
        seedGardens();
    }

    // Migration: Update club name if default
    if (state.settings.clubName === "Kleingartenverein Musterstadt e.V." || state.settings.clubName === "KGV" || !state.settings.clubName) {
        state.settings.clubName = "KGV Am Lohmühlenbach e.V.";
    }

    if (state.inventory.length === 0) {
        state.inventory = [
            { id: 'inv_1', name: 'Benzin-Rasenmäher', description: 'Marke Einhell, 4-Takt, inkl. Fangkorb', status: 'available', rentedBy: null, rentedSince: null, history: [] },
            { id: 'inv_2', name: 'Heckenschere', description: 'Elektrisch, 60cm Schwertlänge', status: 'available', rentedBy: null, rentedSince: null, history: [] },
            { id: 'inv_3', name: 'Vertikutierer', description: 'Leistungsstark für Moosentfernung', status: 'available', rentedBy: null, rentedSince: null, history: [] }
        ];
    }

    renderStats();
    fetchWeather();
    updateNotifications();
    renderInventoryLog();

    // Check for deep linking (garden=ID)
    const urlParams = new URLSearchParams(window.location.search);
    const linkedGardenId = urlParams.get('garden');
    // Set initial view
    switchView(state.currentView || 'dashboard');

    if (linkedGardenId) {
        switchView('gardens');
        openGardenModal(linkedGardenId);
    } else {
        switchView('dashboard');
    }

    lucide.createIcons();

    // Start Clock
    updateDateTime();
    setInterval(updateDateTime, 10000); // Update every 10s
}

// --- IndexedDB Wrapper ---
const DB_NAME = 'KGVDatabase';
const DB_VERSION = 1;
const STORE_NAME = 'app_state';

function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error('IndexedDB error:', event.target.error);
            reject(event.target.error);
        };
    });
}

function getFromDB(db, key) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readonly');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.get(key);

        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
}

function saveToDB(db, key, data) {
    return new Promise((resolve, reject) => {
        const transaction = db.transaction(STORE_NAME, 'readwrite');
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(data, key);

        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}

// --- Data Persistence ---
let dbInstance = null;

async function loadData() {
    try {
        dbInstance = await initDB();

        // 1. Try loading from IndexedDB
        let savedState = await getFromDB(dbInstance, 'kgv_manager_data');

        // 2. Migration from LocalStorage if IndexedDB is empty
        if (!savedState) {
            const legacyData = localStorage.getItem('kgv_manager_data');
            if (legacyData) {
                console.log("Migrating data from LocalStorage to IndexedDB...");
                try {
                    savedState = JSON.parse(legacyData);
                    // Save to IDB immediately
                    await saveToDB(dbInstance, 'kgv_manager_data', savedState);
                    // Clear LocalStorage to avoid duplicate state
                    localStorage.removeItem('kgv_manager_data');
                } catch (e) {
                    console.error("Failed to parse legacy LocalStorage data", e);
                }
            }
        }

        if (savedState) {
            state = savedState;
        }

    } catch (error) {
        console.error("Failed to load data from IndexedDB:", error);
    }

    ensureStateIntegrity();
}

function ensureStateIntegrity() {
    if (!state) state = {};
    if (!Array.isArray(state.members)) state.members = [];
    if (!Array.isArray(state.gardens)) state.gardens = [];
    if (!Array.isArray(state.news)) state.news = [];
    if (!Array.isArray(state.events)) state.events = [];
    if (!Array.isArray(state.documents)) state.documents = []; // Added documents
    if (!Array.isArray(state.inventory)) state.inventory = []; // Added inventory
    state.inventory.forEach(item => {
        if (!Array.isArray(item.history)) item.history = [];
    });
    if (!state.settings) state.settings = {
        totalGardens: 50,
        clubName: "KGV Am Lohmühlenbach e.V.",
        defaultWorkHours: 10,
        feeWater: 25.00,
        feeService: 15.00,
        feePowerBase: 40.00,
        feePool: 10.00,
        workRate: 10.00
    };

    // Ensure all billing settings exist
    if (state.settings.feeWater === undefined) state.settings.feeWater = 25.00;
    if (state.settings.feeService === undefined) state.settings.feeService = 15.00;
    if (state.settings.feePowerBase === undefined) state.settings.feePowerBase = 40.00;
    if (state.settings.feePool === undefined) state.settings.feePool = 10.00;
    if (state.settings.workRate === undefined) state.settings.workRate = 10.00;

    // Migrate existing gardens
    state.gardens.forEach(g => {
        if (!g.meters) g.meters = { water: 0, electricity: 0 };
        if (!g.leaseStatus) g.leaseStatus = 'open';
        if (g.leaseAmount === undefined) g.leaseAmount = 0;
    });
}

async function saveData() {
    try {
        if (!dbInstance) {
            dbInstance = await initDB();
        }
        await saveToDB(dbInstance, 'kgv_manager_data', state);
    } catch (error) {
        console.error("Failed to save data to IndexedDB:", error);
        showToast("Fehler beim Speichern der Daten!", "error");
    }
}

// --- Seeding ---
function seedGardens() {
    for (let i = 1; i <= state.settings.totalGardens; i++) {
        const landOwner = i <= 30 ? 'Erbengemeinschaft' : 'Stadt Mühlhausen';
        state.gardens.push({
            id: 'garden-' + i,
            number: i,
            size: 300 + (Math.floor(Math.random() * 20) * 5),
            status: 'vacant',
            landOwner: landOwner,
            ownerId: null,
            hasHouse: false,
            houseSize: 0,
            hasOutbuilding: false,
            outbuildingSize: 0,
            hasPool: false,
            inspections: [], // { date: "", person: "", defects: "" }
            meters: {
                water: 0,
                electricity: 0
            },
            history: []
        });
    }
    // Seed initial news/events if empty
    if (state.news.length === 0) state.news = SAMPLE_NEWS;
    if (state.events.length === 0) state.events = SAMPLE_EVENTS;

    saveData();
}

let currentGardenHighlight = null;

// --- UI Logic ---
function switchView(viewName, options = {}) {
    state.currentView = viewName;
    currentGardenHighlight = options.highlight || null;

    // Update Nav First (for robustness)
    const navButtons = {
        dashboard: 'nav-dashboard',
        members: 'nav-members',
        gardens: 'nav-gardens',
        settings: 'nav-settings',
        analytics: 'nav-analytics',
        inventory: 'nav-inventory'
    };

    document.querySelectorAll('.nav-btn').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(navButtons[viewName]);
    if (activeBtn) activeBtn.classList.add('active');

    const views = ['view-dashboard', 'view-members', 'view-gardens', 'view-settings', 'view-analytics', 'view-inventory'];
    views.forEach(v => {
        const el = document.getElementById(v);
        if (el) el.classList.add('hidden');
    });

    const targetView = document.getElementById('view-' + viewName);
    if (targetView) targetView.classList.remove('hidden');

    // Render logic for specific views
    try {
        if (viewName === 'gardens') renderGardens();
        if (viewName === 'members') renderMembers();
        if (viewName === 'dashboard') renderStats();
        if (viewName === 'settings') renderSettings();
        if (viewName === 'analytics') renderAnalytics();
        if (viewName === 'inventory') renderInventory();
    } catch (e) {
        console.error("View render error:", e);
    }

    lucide.createIcons();
}

function updateDateTime() {
    const now = new Date();
    const dateEl = document.getElementById('dashboard-date');
    const timeEl = document.getElementById('dashboard-time');

    if (dateEl) {
        const options = { weekday: 'long', day: '2-digit', month: 'long' };
        dateEl.textContent = now.toLocaleDateString('de-DE', options);
    }

    if (timeEl) {
        timeEl.textContent = now.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
    }
}

function showToast(message, type = 'success') {
    const toast = document.createElement('div');
    toast.className = `fixed bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full text-xs font-bold text-white z-[70] animate-fade-in ${type === 'success' ? 'bg-emerald-500 shadow-lg shadow-emerald-500/20' : 'bg-red-500 shadow-lg shadow-red-500/20'}`;
    toast.style.backdropFilter = 'blur(8px)';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translate(-50%, 10px)';
        toast.style.transition = 'all 0.3s ease';
        setTimeout(() => toast.remove(), 300);
    }, 2000);
}

function renderGardens() {
    const container = document.getElementById('view-gardens');
    if (!container) return;

    // Reset container with title and headers
    container.innerHTML = `
        <div class="px-2 flex justify-between items-end">
            <div>
                <h2 class="text-2xl font-bold text-white mb-1">Gartenplan</h2>
                <p class="text-slate-400 text-sm">Interaktive Karte der Anlage.</p>
            </div>
            ${currentGardenHighlight === 'openLease' ? `
                <button onclick="switchView('gardens')" class="bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest px-3 py-1.5 rounded-lg border border-amber-500/30 flex items-center gap-2 animate-pulse hover:animate-none group">
                    <span class="w-1.5 h-1.5 bg-amber-500 rounded-full"></span>
                    Offene Pacht markiert
                    <i data-lucide="x" class="w-3 h-3 text-amber-500/50 group-hover:text-amber-400"></i>
                </button>
            ` : ''}
        </div>

        <div class="garden-map-container mt-6 no-scrollbar">
            <div class="flex flex-col md:flex-row gap-8 min-w-max p-4 justify-center">
                
                <!-- Frame Erbengemeinschaft -->
                <div class="glass-card p-6 border-indigo-500/10">
                    <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-indigo-400 text-center mb-6 pb-2 border-b border-indigo-500/10">
                        Anlage Erbengemeinschaft
                    </h3>
                    <div id="grid-erben" class="grid grid-cols-3 gap-1.5" style="grid-template-rows: repeat(15, 45px);"></div>
                </div>

                <!-- Frame Stadt -->
                <div class="glass-card p-6 border-teal-500/10">
                    <h3 class="text-[10px] font-black uppercase tracking-[0.2em] text-teal-400 text-center mb-6 pb-2 border-b border-teal-500/10">
                        Anlage Stadt
                    </h3>
                    <div id="grid-stadt" class="grid grid-cols-3 gap-1.5" style="grid-template-rows: repeat(10, 45px);"></div>
                </div>

            </div>
        </div>

        <!-- Legend -->
        <div class="flex flex-wrap gap-4 px-2 mt-4 opacity-70">
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-sm bg-emerald-500/20 border border-emerald-500/50"></div>
                <span class="text-[10px] text-slate-400 uppercase font-bold">Belegt</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-sm bg-amber-500/20 border border-amber-500/50"></div>
                <span class="text-[10px] text-slate-400 uppercase font-bold">Reserviert</span>
            </div>
            <div class="flex items-center gap-2">
                <div class="w-3 h-3 rounded-sm bg-slate-800 border border-slate-700"></div>
                <span class="text-[10px] text-slate-400 uppercase font-bold">Frei</span>
            </div>
        </div>
    `;

    const gridErben = document.getElementById('grid-erben');
    const gridStadt = document.getElementById('grid-stadt');
    if (!gridErben || !gridStadt) return;

    // Helper to get a garden by number
    const getGarden = (num) => state.gardens.find(g => g.number === num);

    // Render Erben Grid (3 Cols x 15 Rows)
    for (let row = 1; row <= 15; row++) {
        for (let col = 1; col <= 3; col++) {
            const cell = document.createElement('div');
            let gardenNum = null;
            let isWay = false;

            if (col === 1) gardenNum = (16 - row); // 15...1
            else if (col === 3) gardenNum = (15 + row); // 16...30
            else isWay = true;

            const garden = gardenNum ? getGarden(gardenNum) : null;
            if (garden) {
                renderGardenCell(cell, garden);
            } else if (isWay) {
                cell.className = 'way-cell';
            }
            gridErben.appendChild(cell);
        }
    }

    // Render Stadt Grid (3 Cols x 10 Rows)
    for (let row = 1; row <= 10; row++) {
        for (let col = 1; col <= 3; col++) {
            const cell = document.createElement('div');
            let gardenNum = null;
            let isWay = false;

            if (col === 1) gardenNum = (41 - row); // 40...31
            else if (col === 3) gardenNum = (40 + row); // 41...50
            else isWay = true;

            const garden = gardenNum ? getGarden(gardenNum) : null;
            if (garden) {
                renderGardenCell(cell, garden);
            } else if (isWay) {
                cell.className = 'way-cell';
            }
            gridStadt.appendChild(cell);
        }
    }
    lucide.createIcons();
}

function renderGardenCell(cell, garden) {
    let statusClass = 'bg-slate-800/50 border-slate-700/50 text-slate-400';
    if (garden.status === 'occupied') statusClass = 'bg-emerald-500/20 border-emerald-500/50 text-emerald-400 font-black';
    if (garden.status === 'reserved') statusClass = 'bg-amber-500/20 border-amber-500/50 text-amber-400 font-black';

    const owner = garden.ownerId ? state.members.find(m => m.id === garden.ownerId) : null;
    const isBoard = owner && owner.isBoardMember;

    let highlightClass = '';
    if (currentGardenHighlight === 'openLease' && garden.leaseStatus === 'open') {
        highlightClass = 'highlight-garden-alert';
    }

    cell.className = `garden-cell border ${statusClass} hover:scale-110 active:scale-95 transition-all ${isBoard ? 'border-red-500/50 shadow-[0_0_10px_rgba(239,68,68,0.2)]' : ''} ${highlightClass}`;
    cell.style.width = '45px';
    cell.style.height = '45px';
    cell.textContent = garden.number;
    if (isBoard) {
        cell.classList.add('text-red-400');
    }
    cell.onclick = () => openGardenModal(garden.id);
}


function openGardenModal(gardenId) {
    const modal = document.getElementById('modal-garden-detail'); // Re-using existing modal ID
    const form = document.getElementById('form-garden-details'); // Assuming this form exists
    const garden = state.gardens.find(g => g.id === gardenId);
    if (!garden) return;

    // Ensure history exists
    if (!garden.history) garden.history = [];
    if (garden.ownerId && garden.history.length === 0) { // Changed memberId to ownerId
        // Auto-add first owner to history if empty
        const m = state.members.find(mem => mem.id === garden.ownerId); // Changed memberId to ownerId
        if (m) {
            garden.history.push({
                id: 'h' + Date.now(),
                date: new Date().toISOString().split('T')[0],
                text: `Pachtbeginn: ${m.firstName || ''} ${m.lastName || ''}`.trim() // Use first/last name
            });
        }
    }

    document.getElementById('modal-garden-id').value = gardenId;
    document.getElementById('modal-garden-number').textContent = garden.number; // Use textContent for number
    document.getElementById('modal-garden-land').textContent = garden.landOwner; // Use textContent for landOwner

    document.getElementById('garden-status').value = garden.status;
    document.getElementById('garden-size').value = garden.size || 300;

    // Populate Tenants Dropdown
    const tenantSelect = document.getElementById('garden-ownerId');
    if (tenantSelect) {
        tenantSelect.innerHTML = '<option value="">Kein Pächter</option>';
        state.members.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')).forEach(m => {
            const opt = document.createElement('option');
            opt.value = m.id;
            opt.textContent = `${m.firstName || ''} ${m.lastName || m.name || 'Unbekannt'}`.trim();
            if (garden.ownerId === m.id) opt.selected = true;
            tenantSelect.appendChild(opt);
        });
    }

    document.getElementById('garden-hasHouse').checked = garden.hasHouse;
    document.getElementById('garden-houseSize').value = garden.houseSize;

    document.getElementById('garden-hasOutbuilding').checked = garden.hasOutbuilding;
    document.getElementById('garden-outbuildingSize').value = garden.outbuildingSize;

    document.getElementById('garden-hasPool').checked = garden.hasPool;

    // Populate Meter Fields & Lease Status
    document.getElementById('garden-meter-water').value = garden.meters?.water || 0;
    document.getElementById('garden-meter-electricity').value = garden.meters?.electricity || 0;
    document.getElementById('garden-leaseStatus').value = garden.leaseStatus || 'open';
    document.getElementById('garden-lease-amount').value = garden.leaseAmount || 0;

    // Initial total cost calculation
    updateModalTotalCost();

    // Render Inspections
    renderInspections(garden.inspections);

    // Render History
    renderGardenHistory(garden);

    // Generate QR Code
    generateGardenQR(gardenId);

    // Show Modal
    if (modal) modal.classList.remove('hidden');

    lucide.createIcons();
}

function generateGardenQR(gardenId) {
    const container = document.getElementById('garden-qrcode');
    if (!container) return;
    container.innerHTML = '';

    // Create base URL (strip existing params)
    const baseUrl = window.location.href.split('?')[0];
    const qrUrl = `${baseUrl}?garden=${gardenId}`;

    new QRCode(container, {
        text: qrUrl,
        width: 100,
        height: 100,
        colorDark: "#000000",
        colorLight: "#ffffff",
        correctLevel: QRCode.CorrectLevel.H
    });
}

function renderGardenHistory(garden) {
    const list = document.getElementById('garden-history-list');
    if (!list) return;

    if (!garden.history || garden.history.length === 0) {
        list.innerHTML = '<p class="text-[10px] text-slate-500 italic pb-2">Keine Einträge vorhanden.</p>';
        return;
    }

    list.innerHTML = garden.history.map(h => `
        <div class="flex justify-between items-start gap-3 bg-white/5 p-2 rounded-lg border border-white/5">
            <p class="text-[11px] text-slate-300 leading-tight">${h.text}</p>
            <span class="text-[9px] font-bold text-slate-500 whitespace-nowrap">${new Date(h.date).toLocaleDateString('de-DE')}</span>
        </div>
    `).reverse().join('');
}

function addManualHistoryEntry() {
    const gardenId = document.getElementById('modal-garden-id').value;
    const textInput = document.getElementById('history-text');
    const text = textInput.value.trim();
    if (!text) return;

    const garden = state.gardens.find(g => g.id === gardenId);
    if (garden) {
        if (!garden.history) garden.history = [];
        garden.history.push({
            id: 'h' + Date.now(),
            date: new Date().toISOString().split('T')[0],
            text: text
        });
        saveData();
        renderGardenHistory(garden);
        textInput.value = '';
        showToast('Eintrag gespeichert');
    }
}

function printGardenLabel() {
    const gardenId = document.getElementById('modal-garden-id').value;
    const qrContainer = document.getElementById('garden-qrcode');
    const qrImage = qrContainer.querySelector('img');

    if (!qrImage) {
        showToast('QR-Code konnte nicht geladen werden', 'error');
        return;
    }

    const printWin = window.open('', '_blank');
    printWin.document.write(`
        <html>
            <head>
                <title>Etikett Garten ${gardenId}</title>
                <style>
                    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; }
                    .label { border: 2px solid #000; padding: 20px; text-align: center; border-radius: 10px; width: 300px; }
                    .club { font-size: 12px; font-weight: bold; margin-bottom: 5px; }
                    .number { font-size: 32px; font-weight: 900; margin: 10px 0; }
                    img { width: 150px; height: 150px; margin: 10px 0; }
                    .hint { font-size: 10px; color: #666; margin-top: 10px; }
                </style>
            </head>
            <body onload="window.print(); window.close();">
                <div class="label">
                    <div class="club">KGV AM LOHMÜHLENBACH</div>
                    <div class="number">Garten ${gardenId}</div>
                    <img src="${qrImage.src}" />
                    <div class="hint">Digitaler Garten-Pass</div>
                </div>
            </body>
        </html>
    `);
    printWin.document.close();
}


function closeGardenModal() {
    const modal = document.getElementById('modal-garden-detail');
    if (modal) modal.classList.add('hidden');
}

function renderInspections(inspections) {
    const container = document.getElementById('modal-garden-inspections');
    if (!container) return;
    container.innerHTML = '';

    inspections.forEach((insp, index) => {
        const div = document.createElement('div');
        div.className = 'p-3 bg-white/5 rounded-xl border border-white/5 space-y-2 relative group';
        div.innerHTML = `
        < div class= "grid grid-cols-2 gap-2" >
        <input type="date" value="${insp.date}" onchange="updateInspection(${index}, 'date', this.value)" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white">
            <input type="text" placeholder="Wer?" value="${insp.person}" onchange="updateInspection(${index}, 'person', this.value)" class="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white">
            </div>
            <textarea placeholder="Mängel / Notizen" onchange="updateInspection(${index}, 'defects', this.value)" class="w-full bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-white h-12">${insp.defects}</textarea>
            <button type="button" onclick="removeInspection(${index})" class="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <i data-lucide="minus" class="w-3 h-3"></i>
            </button>
            `;
        container.appendChild(div);
    });
    lucide.createIcons();
}

function addInspectionRow() {
    const gardenId = document.getElementById('modal-garden-id').value;
    const garden = state.gardens.find(g => g.id === gardenId);
    if (garden) {
        garden.inspections.push({ date: new Date().toISOString().split('T')[0], person: '', defects: '' });
        renderInspections(garden.inspections);
    }
}

function updateInspection(index, field, value) {
    const gardenId = document.getElementById('modal-garden-id').value;
    const garden = state.gardens.find(g => g.id === gardenId);
    if (garden && garden.inspections[index]) {
        garden.inspections[index][field] = value;
    }
}

function removeInspection(index) {
    const gardenId = document.getElementById('modal-garden-id').value;
    const garden = state.gardens.find(g => g.id === gardenId);
    if (garden) {
        garden.inspections.splice(index, 1);
        renderInspections(garden.inspections);
    }
}

function saveGardenDetails(event) {
    event.preventDefault();
    const gardenId = document.getElementById('modal-garden-id').value;
    const garden = state.gardens.find(g => g.id === gardenId);

    if (garden) {
        const oldOwnerId = garden.ownerId;
        const newOwnerId = document.getElementById('garden-ownerId').value || null;

        garden.status = document.getElementById('garden-status').value;
        garden.ownerId = newOwnerId;
        garden.size = parseInt(document.getElementById('garden-size').value) || 300;

        // Auto-log owner change
        if (oldOwnerId !== newOwnerId) {
            const m = state.members.find(mem => mem.id === newOwnerId);
            const ownerName = m ? `${m.firstName || ''} ${m.lastName || m.name || ''}`.trim() : 'Kein Pächter';
            if (!garden.history) garden.history = [];
            garden.history.push({
                id: 'h' + Date.now(),
                date: new Date().toISOString().split('T')[0],
                text: `Pächterwechsel: ${ownerName}`
            });
        }

        garden.hasHouse = document.getElementById('garden-hasHouse').checked;
        garden.houseSize = parseInt(document.getElementById('garden-houseSize').value) || 0;
        garden.hasOutbuilding = document.getElementById('garden-hasOutbuilding').checked;
        garden.outbuildingSize = parseInt(document.getElementById('garden-outbuildingSize').value) || 0;
        garden.hasPool = document.getElementById('garden-hasPool').checked;

        // Save Finance/Meter Data
        if (!garden.meters) garden.meters = { water: 0, electricity: 0 };
        garden.meters.water = parseFloat(document.getElementById('garden-meter-water').value) || 0;
        garden.meters.electricity = parseFloat(document.getElementById('garden-meter-electricity').value) || 0;
        garden.leaseStatus = document.getElementById('garden-leaseStatus').value;
        garden.leaseAmount = parseFloat(document.getElementById('garden-lease-amount').value) || 0;

        saveData();
        renderGardens();
        renderStats();
        closeGardenModal();
    }
}

function renderStats() {
    try {
        const gardens = Array.isArray(state.gardens) ? state.gardens : [];
        const occupiedCount = gardens.filter(g => g.status === 'occupied').length;
        const statsOccupied = document.getElementById('stat-gardens-occupied');
        const statsMembers = document.getElementById('stat-members-total');
        const progressBar = document.getElementById('progress-gardens');

        if (statsOccupied) statsOccupied.textContent = occupiedCount;
        if (statsMembers) statsMembers.textContent = state.members.length;

        if (progressBar) {
            const total = state.settings?.totalGardens || 50;
            const percentage = (occupiedCount / total) * 100;
            progressBar.style.width = percentage + '%';
        }

        // Render News
        const newsContainer = document.getElementById('dashboard-news');
        if (newsContainer) {
            const newsItems = Array.isArray(state.news) ? state.news : [];
            newsContainer.innerHTML = newsItems.map(n => `
            <div class="glass-card p-4 border-slate-700/30 hover:bg-white/5 transition-all">
                <div class="flex justify-between items-start mb-1">
                    <h4 class="text-xs font-bold text-white">${n.title || 'Mitteilung'}</h4>
                    <span class="text-[9px] font-medium text-slate-500">${n.date ? new Date(n.date).toLocaleDateString('de-DE') : ''}</span>
                </div>
                <p class="text-[11px] text-slate-400 leading-relaxed">${n.content || ''}</p>
            </div>
            `).join('') || '<p class="text-xs text-slate-500 px-2 italic">Keine aktuellen Mitteilungen.</p>';
        }

        // Render Events
        const eventsContainer = document.getElementById('dashboard-events');
        if (eventsContainer) {
            const eventItems = Array.isArray(state.events) ? state.events : [];
            eventsContainer.innerHTML = [...eventItems].sort((a, b) => new Date(a.date) - new Date(b.date)).map(e => `
            <div class="glass-card p-4 flex items-center gap-4 border-slate-700/30 hover:bg-white/5 transition-all">
                <div class="bg-indigo-500/10 p-2 rounded-lg text-indigo-400">
                    <i data-lucide="calendar" class="w-4 h-4"></i>
                </div>
                <div>
                    <h4 class="text-xs font-bold text-white">${e.title || 'Termin'}</h4>
                    <div class="flex items-center gap-2 mt-0.5">
                        <span class="text-[9px] font-medium text-slate-500">${e.date ? new Date(e.date).toLocaleDateString('de-DE') : ''}</span>
                        <span class="text-[9px] font-bold text-indigo-400/80 uppercase tracking-tighter">• ${e.location || 'Verein'}</span>
                    </div>
                </div>
            </div>
            `).join('') || '<p class="text-xs text-slate-500 px-2 italic">Keine anstehenden Termine.</p>';
        }

        // Render Finance Alert on Dashboard
        const financeAlertContainer = document.getElementById('dashboard-finance-alert');
        if (financeAlertContainer) {
            const unpaidGardens = gardens.filter(g => g.leaseStatus === 'open');
            if (unpaidGardens.length > 0) {
                financeAlertContainer.innerHTML = `
                    <div class="glass-card p-4 border-red-500/20 bg-red-500/5 flex items-center justify-between">
                        <div class="flex items-center gap-3">
                            <div class="p-2 bg-red-500/10 rounded-lg">
                                <i data-lucide="alert-circle" class="w-5 h-5 text-red-400"></i>
                            </div>
                            <div>
                                <h4 class="text-[10px] font-black text-red-400 uppercase tracking-widest leading-none mb-1">Finanz-Hinweis</h4>
                                <p class="text-xs text-slate-300">${unpaidGardens.length} Gärten haben noch eine offene Pachtzahlung.</p>
                            </div>
                        </div>
                        <button onclick="switchView('gardens', { highlight: 'openLease' })" class="text-[10px] font-bold text-slate-500 hover:text-white transition-colors uppercase tracking-widest">Details</button>
                    </div>
                `;
                financeAlertContainer.classList.remove('hidden');
            } else {
                financeAlertContainer.classList.add('hidden');
            }
        }

        lucide.createIcons();
    } catch (err) {
        console.error("Dashboard render error", err);
    }
}

// --- Member Logic ---
function openMemberModal(memberId = null) {
    const modal = document.getElementById('modal-member-detail');
    const form = document.getElementById('form-member-details');
    const title = document.getElementById('member-modal-title');

    form.reset();
    document.getElementById('modal-member-id').value = '';

    if (memberId) {
        const member = state.members.find(m => m.id === memberId);
        if (member) {
            title.textContent = 'Mitglied bearbeiten';
            document.getElementById('modal-member-id').value = member.id;
            document.getElementById('member-firstName').value = member.firstName || '';
            document.getElementById('member-lastName').value = member.lastName || '';
            document.getElementById('member-birthName').value = member.birthName || '';
            document.getElementById('member-birthDate').value = member.birthDate || '';
            document.getElementById('member-gender').value = member.gender || '';
            document.getElementById('member-profession').value = member.profession || '';
            document.getElementById('member-street').value = member.address?.street || '';
            document.getElementById('member-houseNumber').value = member.address?.houseNumber || '';
            document.getElementById('member-zip').value = member.address?.zip || '';
            document.getElementById('member-city').value = member.address?.city || '';
            document.getElementById('member-phoneLandline').value = member.phone?.landline || '';
            document.getElementById('member-phoneMobile').value = member.phone?.mobile || '';
            document.getElementById('member-email').value = member.email || '';
            document.getElementById('member-adults').value = member.family?.adults || 1;
            document.getElementById('member-children').value = member.family?.children || 0;

            const isBoard = member.isBoardMember || false;
            document.getElementById('member-isBoardMember').checked = isBoard;
            document.getElementById('member-boardRole').value = member.boardRole || '';
            toggleBoardRoleVisibility(isBoard);

            // Render Work Hours
            renderWorkLogs(member.id);

            // Show delete button ONLY for authorized board members (Chairman / Deputy)
            const activeMember = state.members.find(m => m.id === state.activeMemberId);
            const isAuthorized = activeMember && activeMember.isBoardMember &&
                ['Vorsitzender', 'Stellvertreter des Vorsitzenden'].includes(activeMember.boardRole);

            const delBtn = document.getElementById('btn-delete-member');
            if (delBtn) {
                if (isAuthorized) {
                    delBtn.classList.remove('hidden');
                } else {
                    delBtn.classList.add('hidden');
                }
            }
        }
    } else {
        title.textContent = 'Neuaufnahme Mitglied';
        toggleBoardRoleVisibility(false);

        // Hide delete button for new members
        const delBtn = document.getElementById('btn-delete-member');
        if (delBtn) delBtn.classList.add('hidden');
    }

    if (modal) modal.classList.remove('hidden');
    lucide.createIcons();
}

function closeMemberModal() {
    const modal = document.getElementById('modal-member-detail');
    if (modal) modal.classList.add('hidden');
}

function saveMemberDetails(event) {
    event.preventDefault();
    const memberId = document.getElementById('modal-member-id').value;

    const memberData = {
        firstName: document.getElementById('member-firstName').value,
        lastName: document.getElementById('member-lastName').value,
        birthName: document.getElementById('member-birthName').value,
        birthDate: document.getElementById('member-birthDate').value,
        gender: document.getElementById('member-gender').value,
        profession: document.getElementById('member-profession').value,
        address: {
            street: document.getElementById('member-street').value,
            houseNumber: document.getElementById('member-houseNumber').value,
            zip: document.getElementById('member-zip').value,
            city: document.getElementById('member-city').value
        },
        phone: {
            landline: document.getElementById('member-phoneLandline').value,
            mobile: document.getElementById('member-phoneMobile').value
        },
        email: document.getElementById('member-email').value,
        family: {
            adults: parseInt(document.getElementById('member-adults').value) || 1,
            children: parseInt(document.getElementById('member-children').value) || 0
        },
        isBoardMember: document.getElementById('member-isBoardMember').checked,
        boardRole: document.getElementById('member-boardRole').value
    };

    if (memberId) {
        // Update
        const index = state.members.findIndex(m => m.id === memberId);
        if (index !== -1) {
            state.members[index] = { ...state.members[index], ...memberData };
        }
    } else {
        // Add New
        const newMember = {
            id: 'm-' + Date.now(),
            memberNumber: (2024 + state.members.length).toString() + '-' + (state.members.length + 1).toString().padStart(3, '0'),
            ...memberData,
            joinedDate: new Date().toISOString().split('T')[0]
        };
        state.members.push(newMember);
    }

    saveData();
    closeMemberModal();
    if (state.currentView === 'members') renderMembers();
    if (state.currentView === 'dashboard') renderStats();
}

function renderWorkLogs(memberId) {
    const member = state.members.find(m => m.id === memberId);
    if (!member) return;

    const list = document.getElementById('work-log-list');
    const logs = member.workHours || [];
    const total = logs.reduce((sum, log) => sum + parseFloat(log.hours || 0), 0);
    const required = state.settings.defaultWorkHours || 10;
    const percentage = Math.min((total / required) * 100, 100);

    const summaryEl = document.getElementById('work-hours-summary');
    const progressEl = document.getElementById('work-hours-progress');
    if (summaryEl) summaryEl.textContent = `${total} / ${required} Std.`;
    if (progressEl) progressEl.style.width = percentage + '%';

    if (list) {
        list.innerHTML = logs.sort((a, b) => new Date(b.date) - new Date(a.date)).map(log => `
            <div class="bg-white/5 border border-white/5 p-2 rounded-lg flex justify-between items-center group/log">
                <div>
                    <p class="text-[11px] font-bold text-slate-200">${log.description}</p>
                    <p class="text-[9px] text-slate-500">${new Date(log.date).toLocaleDateString('de-DE')} • ${log.hours} Std.</p>
                </div>
                <button onclick="removeWorkLog('${member.id}', '${log.id}')" class="p-1.5 text-slate-600 hover:text-red-400 opacity-0 group-hover/log:opacity-100 transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
        `).join('') || '<p class="text-[10px] text-slate-600 italic px-1">Keine Einträge vorhanden.</p>';
    }
    lucide.createIcons();
}

function addWorkLog() {
    const memberId = document.getElementById('modal-member-id').value;
    if (!memberId) {
        alert('Bitte erst das Mitglied speichern.');
        return;
    }

    const hours = document.getElementById('log-hours').value;
    const date = document.getElementById('log-date').value;
    const desc = document.getElementById('log-desc').value;

    if (!hours || !date || !desc) return;

    const member = state.members.find(m => m.id === memberId);
    if (member) {
        if (!member.workHours) member.workHours = [];
        member.workHours.push({
            id: 'wh' + Date.now(),
            date: date,
            hours: parseFloat(hours),
            description: desc
        });
        saveData();
        renderWorkLogs(memberId);

        // Reset form
        document.getElementById('log-hours').value = '';
        document.getElementById('log-date').value = '';
        document.getElementById('log-desc').value = '';
    }
}

function removeWorkLog(memberId, logId) {
    const member = state.members.find(m => m.id === memberId);
    if (member && confirm('Eintrag löschen?')) {
        member.workHours = member.workHours.filter(l => l.id !== logId);
        saveData();
        renderWorkLogs(memberId);
    }
}

function deleteMember() {
    const memberId = document.getElementById('modal-member-id').value;
    if (!memberId) return;

    const member = state.members.find(m => m.id === memberId);
    if (!member) return;

    const confirmMsg = `Möchtest du das Mitglied "${member.firstName} ${member.lastName}" wirklich unwiderruflich löschen?\n\nDie Zuordnung zu Gärten wird automatisch aufgehoben.`;

    if (confirm(confirmMsg)) {
        // Remove from members
        state.members = state.members.filter(m => m.id !== memberId);

        // Clear garden assignments
        state.gardens.forEach(garden => {
            if (garden.ownerId === memberId) {
                garden.ownerId = null;
                garden.status = 'vacant'; // Optionally reset status
            }
        });

        saveData();
        closeMemberModal();
        if (state.currentView === 'members') renderMembers();
        if (state.currentView === 'dashboard') renderStats();
    }
}

function renderMembers() {
    const list = document.getElementById('members-list');
    const container = document.getElementById('view-members');
    if (!list || !container) return;

    // Header for member view
    const headerHtml = `
            <div class="px-2 mb-6 space-y-4">
                <div class="flex justify-between items-center">
                    <div>
                        <h2 class="text-2xl font-bold text-white mb-1">Mitgliederverwaltung</h2>
                        <p class="text-slate-400 text-sm">Liste aller Vereinsmitglieder.</p>
                    </div>
                    <button onclick="openMemberModal()" class="p-3 bg-emerald-500 rounded-xl text-white shadow-lg shadow-emerald-500/20 active:scale-95 transition-all">
                        <i data-lucide="plus" class="w-5 h-5"></i>
                    </button>
                </div>

                <!-- Filter Row -->
                <div class="flex gap-2 p-1 bg-white/5 rounded-xl border border-white/5 w-fit">
                    <button onclick="setMemberFilter('all')" 
                        class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentMemberFilter === 'all' ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : 'text-slate-500 hover:text-slate-300'}">
                        Alle
                    </button>
                    <button onclick="setMemberFilter('board')" 
                        class="px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${currentMemberFilter === 'board' ? 'bg-red-500 text-white shadow-lg shadow-red-500/20' : 'text-slate-500 hover:text-slate-300'}">
                        Vorstand
                    </button>
                </div>
            </div>
            `;

    container.innerHTML = headerHtml + '<div id="members-list" class="space-y-4 px-2 pb-24"></div>';
    const dynamicList = document.getElementById('members-list');

    let filteredMembers = [...state.members];
    if (currentMemberFilter === 'board') {
        filteredMembers = filteredMembers.filter(m => m.isBoardMember);
    }

    filteredMembers.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')).forEach(member => {
        const assignedGardens = state.gardens.filter(g => g.ownerId === member.id);
        const gardenNumbers = assignedGardens.map(g => g.number).join(', ') || 'Kein Garten';

        const firstName = member.firstName || '';
        const lastName = member.lastName || member.name || 'Unbekannt';
        const initials = (firstName.charAt(0) + lastName.charAt(0)).toUpperCase() || '?';

        const boardBadge = member.isBoardMember
            ? `<span class="mt-1 inline-block px-1.5 py-0.5 bg-red-500/20 text-red-400 text-[9px] font-black uppercase tracking-tighter rounded border border-red-500/20">${member.boardRole || 'Vorstand'}</span>`
            : '';

        const div = document.createElement('div');
        div.className = 'glass-card p-4 flex justify-between items-center hover:bg-white/5 transition-all cursor-pointer group';
        div.onclick = () => openMemberModal(member.id);
        div.innerHTML = `
            <div class="flex items-center gap-4">
                <div class="w-10 h-10 ${member.isBoardMember ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-indigo-500/10 text-indigo-400'} rounded-full flex items-center justify-center font-bold">
                    ${initials}
                </div>
                <div>
                    <h3 class="text-white font-bold group-hover:text-indigo-400 transition-colors">${firstName} ${lastName}</h3>
                    <p class="text-[10px] text-slate-500 uppercase tracking-widest font-bold">Nr. ${member.memberNumber || '---'}</p>
                    ${boardBadge}
                </div>
            </div>
            <div class="text-right">
                <span class="text-[9px] text-slate-500 uppercase font-black tracking-widest block mb-0.5">Parzelle</span>
                <span class="text-xs text-slate-300 font-medium">${gardenNumbers}</span>
            </div>
            `;
        dynamicList.appendChild(div);
    });
    lucide.createIcons();
}

function setMemberFilter(filter) {
    currentMemberFilter = filter;
    renderMembers();
}

function toggleBoardRoleVisibility(force = null) {
    const checkbox = document.getElementById('member-isBoardMember');
    const roleContainer = document.getElementById('container-board-role');
    const workContainer = document.getElementById('container-work-hours');
    const isChecked = force !== null ? force : checkbox.checked;

    if (roleContainer) {
        if (isChecked) {
            roleContainer.classList.remove('hidden');
        } else {
            roleContainer.classList.add('hidden');
        }
    }

    if (workContainer) {
        if (isChecked) {
            workContainer.classList.add('hidden');
        } else {
            workContainer.classList.remove('hidden');
        }
    }
}

function resetData() {
    if (confirm('Bist du sicher? Alle eingetragenen Daten und Begehungen werden gelöscht.')) {
        const req = indexedDB.deleteDatabase(DB_NAME);
        req.onsuccess = function () {
            console.log("Database deleted successfully");
            // Also clean legacy storage just in case
            localStorage.removeItem('kgv_manager_data');
            location.reload();
        };
        req.onerror = function () {
            console.log("Couldn't delete database");
        };
        req.onblocked = function () {
            console.log("Couldn't delete database due to the operation being blocked");
        };
    }
}

function exportBackup() {
    const dataStr = JSON.stringify(state, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);

    let exportFileDefaultName = `kgv_backup_${new Date().toISOString().split('T')[0]}.json`;

    let linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    showToast('Backup erfolgreich exportiert!', 'success');
}

function importBackup(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async function (e) {
        try {
            const importedState = JSON.parse(e.target.result);
            if (importedState && typeof importedState === 'object') {
                if (confirm('Achtung: Das Importieren überschreibt alle aktuellen Daten. Fortfahren?')) {
                    state = importedState;
                    await saveData();
                    showToast('Backup erfolgreich importiert! Lade neu...', 'success');
                    setTimeout(() => location.reload(), 1500);
                }
            } else {
                showToast('Ungültige Backup-Datei.', 'error');
            }
        } catch (error) {
            console.error('Import error:', error);
            showToast('Fehler beim Lesen der Datei.', 'error');
        }
    };
    reader.readAsText(file);
    // Reset input
    event.target.value = '';
}

function renderSettings() {
    const select = document.getElementById('active-user-select');
    if (!select) return;

    select.innerHTML = '<option value="">-- Profil wählen --</option>';
    state.members.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        const roleStr = m.isBoardMember ? ` (${m.boardRole})` : '';
        opt.textContent = `${m.firstName || ''} ${m.lastName || m.name || ''}${roleStr}`.trim();
        if (state.activeMemberId === m.id) opt.selected = true;
        select.appendChild(opt);
    });

    // Populate Global Finance Settings
    const feeWater = document.getElementById('settings-fee-water');
    const feeService = document.getElementById('settings-fee-service');
    const feePower = document.getElementById('settings-fee-power');
    const feePool = document.getElementById('settings-fee-pool');
    const workRate = document.getElementById('settings-work-rate');

    if (feeWater) feeWater.value = state.settings.feeWater || 25;
    if (feeService) feeService.value = state.settings.feeService || 15;
    if (feePower) feePower.value = state.settings.feePowerBase || 40;
    if (feePool) feePool.value = state.settings.feePool || 10;
    if (workRate) workRate.value = state.settings.workRate || 10;

    // Toggle Admin visibility based on active user
    const activeMember = state.members.find(m => m.id === state.activeMemberId);
    const isAdmin = activeMember && activeMember.isBoardMember;
    const adminArea = document.getElementById('admin-setup-area');
    if (adminArea) {
        if (isAdmin) adminArea.classList.remove('hidden');
        else adminArea.classList.add('hidden');
    }

    renderAdminNews();
    renderAdminEvents();
    renderAdminDocuments();
    renderAdminInventory();

    const adminAreaInv = document.getElementById('admin-inventory-area');
    if (adminAreaInv) {
        if (isAdmin) adminAreaInv.classList.remove('hidden');
        else adminAreaInv.classList.add('hidden');
    }
}

function renderAdminInventory() {
    const list = document.getElementById('admin-inventory-list');
    if (!list) return;

    list.innerHTML = state.inventory.map(item => {
        const lastReturn = [...item.history].reverse().find(h => h.action === 'returned');
        const historySnippet = lastReturn ?
            `<p class="text-[8px] text-slate-500 mt-1 italic border-l border-white/10 pl-2">Zuletzt: ${lastReturn.condition} (${lastReturn.duration} Tage)</p>` : '';

        return `
            <div class="bg-white/5 p-4 rounded-xl border border-white/5 flex items-center justify-between group">
                <div class="flex items-center gap-4">
                    <div class="p-2 bg-amber-500/10 rounded-lg text-amber-400">
                        <i data-lucide="wrench" class="w-4 h-4"></i>
                    </div>
                    <div>
                        <h4 class="text-xs font-bold text-white">${item.name}</h4>
                        <p class="text-[10px] text-slate-500">${item.status === 'rented' ? 'Verliehen an ' + (state.members.find(m => m.id === item.rentedBy)?.lastName || 'Unbekannt') : 'Im Lager'}</p>
                        ${historySnippet}
                    </div>
                </div>
                <div class="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onclick="editInventoryItem('${item.id}')" class="p-2 text-slate-500 hover:text-amber-400 transition-colors">
                        <i data-lucide="edit-2" class="w-4 h-4"></i>
                    </button>
                    <button onclick="removeInventoryItem('${item.id}')" class="p-2 text-slate-500 hover:text-red-400 transition-colors">
                        <i data-lucide="trash-2" class="w-4 h-4"></i>
                    </button>
                </div>
            </div>
        `;
    }).join('') || '<p class="text-[10px] text-slate-500 italic px-2">Noch keine Geräte erfasst.</p>';
    lucide.createIcons();
}

function saveInventoryItem() {
    const idInput = document.getElementById('admin-inv-id');
    const nameInput = document.getElementById('admin-inv-name');
    const descInput = document.getElementById('admin-inv-desc');

    if (!nameInput?.value) return;

    const id = idInput.value;
    if (id) {
        // Update existing
        const item = state.inventory.find(i => i.id === id);
        if (item) {
            item.name = nameInput.value;
            item.description = descInput.value;
            showToast('Gerät aktualisiert');
        }
    } else {
        // Create new
        const newItem = {
            id: 'inv_' + Date.now(),
            name: nameInput.value,
            description: descInput.value,
            status: 'available',
            rentedBy: null,
            rentedSince: null,
            history: []
        };
        state.inventory.push(newItem);
        showToast('Gerät hinzugefügt');
    }

    saveData();
    cancelInventoryEdit(); // Reset form
    renderAdminInventory();
    renderInventory();
}

function editInventoryItem(id) {
    const item = state.inventory.find(i => i.id === id);
    if (!item) return;

    document.getElementById('admin-inv-id').value = item.id;
    document.getElementById('admin-inv-name').value = item.name;
    document.getElementById('admin-inv-desc').value = item.description || '';

    document.getElementById('admin-inv-title').textContent = 'Gerät bearbeiten';
    document.getElementById('admin-inv-save-text').textContent = 'Änderungen speichern';
    document.getElementById('admin-inv-cancel').classList.remove('hidden');

    // Scroll to visible title instead of hidden input
    document.getElementById('admin-inv-title').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function cancelInventoryEdit() {
    document.getElementById('admin-inv-id').value = '';
    document.getElementById('admin-inv-name').value = '';
    document.getElementById('admin-inv-desc').value = '';

    document.getElementById('admin-inv-title').textContent = 'Neues Gerät hinzufügen';
    document.getElementById('admin-inv-save-text').textContent = 'Gerät speichern';
    document.getElementById('admin-inv-cancel').classList.add('hidden');
}

function removeInventoryItem(id) {
    if (!confirm('Gerät wirklich aus dem Bestand entfernen?')) return;
    state.inventory = state.inventory.filter(i => i.id !== id);
    saveData();
    renderAdminInventory();
    renderInventory();
    showToast('Gerät entfernt');
}

function renderInventory() {
    const list = document.getElementById('inventory-list');
    if (!list) return;

    list.innerHTML = state.inventory.map(item => {
        let statusBadge = '';
        let actionBtn = '';
        let infoLine = '';

        if (item.status === 'available') {
            statusBadge = '<span class="badge badge-available">Verfügbar</span>';
            actionBtn = `<button onclick="openRentalModal('${item.id}')" class="px-4 py-2 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-emerald-500/20 transition-all active:scale-95">Ausleihen</button>`;
        } else if (item.status === 'rented') {
            const member = state.members.find(m => m.id === item.rentedBy);
            const start = new Date(item.rentedSince);
            const days = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));

            statusBadge = `<span class="badge badge-rented">Verliehen an ${member ? member.lastName : 'Unbekannt'}</span>`;
            actionBtn = `<button onclick="openReturnModal('${item.id}')" class="px-4 py-2 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-[10px] font-black uppercase tracking-widest rounded-lg border border-amber-500/20 transition-all active:scale-95">Zurückgeben</button>`;
            infoLine = `<p class="text-[9px] text-slate-500 mt-1">Seit: ${start.toLocaleDateString()} (${days} Tage)</p>`;
        } else {
            statusBadge = '<span class="badge badge-maintenance">In Wartung</span>';
        }

        return `
            <div class="glass-card p-6 flex items-center justify-between gap-4 border-slate-700/30">
                <div class="flex items-center gap-4">
                    <div class="p-3 bg-indigo-500/10 rounded-2xl text-indigo-400">
                        <i data-lucide="wrench" class="w-6 h-6"></i>
                    </div>
                    <div>
                        <div class="flex items-center gap-2 mb-1">
                            <h3 class="text-sm font-bold text-white">${item.name}</h3>
                            ${statusBadge}
                        </div>
                        <p class="text-xs text-slate-400 max-w-[200px]">${item.description || ''}</p>
                        ${infoLine}
                    </div>
                </div>
                <div>
                    ${actionBtn}
                </div>
            </div>
        `;
    }).join('') || '<p class="text-xs text-slate-500 px-4 italic">Noch keine Geräte im Inventar erfasst.</p>';
    lucide.createIcons();
}

function openRentalModal(itemId) {
    const item = state.inventory.find(i => i.id === itemId);
    if (!item) return;

    const modal = document.getElementById('modal-rental');
    const nameEl = document.getElementById('rental-item-name');
    const idInput = document.getElementById('rental-item-id');
    const select = document.getElementById('rental-member-select');

    if (modal && nameEl && idInput && select) {
        nameEl.textContent = item.name;
        idInput.value = itemId;

        // Populate members
        select.innerHTML = state.members.sort((a, b) => (a.lastName || '').localeCompare(b.lastName || '')).map(m => `
            <option value="${m.id}">${m.firstName} ${m.lastName}</option>
        `).join('');

        modal.classList.remove('hidden');
    }
}

function closeRentalModal() {
    const modal = document.getElementById('modal-rental');
    if (modal) modal.classList.add('hidden');
}

function confirmRental() {
    const itemId = document.getElementById('rental-item-id')?.value;
    const memberId = document.getElementById('rental-member-select')?.value;

    if (!itemId || !memberId) return;

    const item = state.inventory.find(i => i.id === itemId);
    if (item) {
        item.status = 'rented';
        item.rentedBy = memberId;
        item.rentedSince = new Date().toISOString();
        item.history.push({
            action: 'rented',
            memberId: memberId,
            date: new Date().toISOString()
        });

        saveData();
        renderInventory();
        renderAdminInventory();
        renderInventoryLog();
        closeRentalModal();
        showToast('Gerät verliehen');
    }
}

function openReturnModal(itemId) {
    const item = state.inventory.find(i => i.id === itemId);
    if (!item) return;

    document.getElementById('return-item-id').value = itemId;
    document.getElementById('return-condition').value = 'Einwandfrei';
    document.getElementById('return-note').value = '';

    document.getElementById('modal-return').classList.remove('hidden');
}

function closeReturnModal() {
    document.getElementById('modal-return').classList.add('hidden');
}

function confirmReturn() {
    const itemId = document.getElementById('return-item-id').value;
    const condition = document.getElementById('return-condition').value;
    const note = document.getElementById('return-note').value;

    const item = state.inventory.find(i => i.id === itemId);
    if (item) {
        const start = new Date(item.rentedSince);
        const days = Math.floor((new Date() - start) / (1000 * 60 * 60 * 24));

        item.status = 'available';
        item.history.push({
            action: 'returned',
            memberId: item.rentedBy,
            date: new Date().toISOString(),
            condition: condition,
            note: note,
            duration: days
        });

        item.rentedBy = null;
        item.rentedSince = null;

        saveData();
        renderInventory();
        renderAdminInventory();
        renderInventoryLog();
        updateNotifications(); // Badge update
        closeReturnModal();
        showToast('Gerät erfolgreich zurückgegeben');
    }
}

function renderInventoryLog() {
    const list = document.getElementById('inventory-protocol-list');
    if (!list) return;

    // Aggregate all history into actual transactions
    let transactions = [];
    state.inventory.forEach(item => {
        // Find pairs of rented/returned
        for (let i = 0; i < item.history.length; i++) {
            const h = item.history[i];
            if (h.action === 'rented') {
                // Find corresponding return (next return for this member/item)
                const returnEvent = item.history.slice(i + 1).find(next => next.action === 'returned' && next.memberId === h.memberId);

                transactions.push({
                    dateRented: h.date,
                    itemName: item.name,
                    memberId: h.memberId,
                    dateReturned: returnEvent ? returnEvent.date : null,
                    condition: returnEvent ? (returnEvent.condition || 'Zurückgegeben') : 'Noch ausgeliehen'
                });
            }
        }
    });

    // Sort by rental date descending
    transactions.sort((a, b) => new Date(b.dateRented) - new Date(a.dateRented));

    list.innerHTML = transactions.map(tr => {
        const member = state.members.find(m => m.id === tr.memberId);
        const rentDate = new Date(tr.dateRented);
        const returnDate = tr.dateReturned ? new Date(tr.dateReturned) : null;

        const cond = tr.condition || 'Unbekannt';
        const condClass = cond === 'Einwandfrei' ? 'text-emerald-400' :
            cond.includes('Defekt') || cond.includes('Reparatur') ? 'text-red-400' : 'text-amber-400';

        return `
            <tr>
                <td class="px-4 py-3 text-[10px] text-white whitespace-nowrap">
                    ${rentDate.toLocaleDateString()} <span class="text-slate-500 ml-1">${rentDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </td>
                <td class="px-4 py-3 text-[10px] font-bold text-white">${tr.itemName}</td>
                <td class="px-4 py-3 text-[10px] text-slate-300">${member ? member.lastName : 'Unbekannt'}</td>
                <td class="px-4 py-3 text-[10px] text-white whitespace-nowrap">
                    ${returnDate ?
                `${returnDate.toLocaleDateString()} <span class="text-slate-500 ml-1">${returnDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>` :
                '<span class="text-amber-500 animate-pulse">Aktiv</span>'}
                </td>
                <td class="px-4 py-3 text-[10px] font-bold text-right ${condClass}">${tr.condition}</td>
            </tr>
        `;
    }).join('') || '<tr><td colspan="5" class="px-4 py-8 text-center text-[10px] text-slate-500 italic">Noch keine Protokoll-Einträge vorhanden.</td></tr>';
}

function clearInventoryLog() {
    if (!confirm('Möchtest du das gesamte Leih-Protokoll wirklich unwiderruflich löschen?')) return;

    state.inventory.forEach(item => {
        item.history = [];
    });

    saveData();
    renderInventoryLog();
    renderAdminInventory(); // Refresh admin view too
    showToast('Protokoll geleert');
}

function renderAdminDocuments() {
    const list = document.getElementById('admin-doc-list');
    if (!list) return;

    if (!state.documents || state.documents.length === 0) {
        list.innerHTML = '<p class="text-xs text-slate-500 italic">Keine Dokumente im Archiv.</p>';
        return;
    }

    const activeMember = state.members.find(m => m.id === state.activeMemberId);
    const isBoard = activeMember && (activeMember.role === 'chairman' || activeMember.role === 'deputy');

    list.innerHTML = state.documents.map(doc => `
            <div class="flex justify-between items-center bg-white/5 p-3 rounded-xl border border-white/5 group">
                <div class="flex items-center gap-3">
                    <i data-lucide="file-text" class="w-4 h-4 text-slate-400"></i>
                    <a href="${doc.url}" target="_blank" class="text-xs font-bold text-white hover:text-emerald-400 transition-colors">${doc.name}</a>
                </div>
                ${isBoard ? `
                <button onclick="removeDocument('${doc.id}')" class="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            ` : ''}
            </div>
            `).join('');
    lucide.createIcons();
}

function addDocument() {
    const name = document.getElementById('admin-doc-name').value.trim();
    const url = document.getElementById('admin-doc-url').value.trim();
    if (!name || !url) return;

    if (!Array.isArray(state.documents)) state.documents = [];
    state.documents.push({
        id: 'd' + Date.now(),
        name,
        url
    });
    saveData();
    renderAdminDocuments();
    document.getElementById('admin-doc-name').value = '';
    document.getElementById('admin-doc-url').value = '';
    showToast('Dokument hinzugefügt');
}

function removeDocument(id) {
    if (confirm('Dokument aus Archiv entfernen?')) {
        state.documents = state.documents.filter(d => d.id !== id);
        saveData();
        renderAdminDocuments();
    }
}

function renderAdminNews() {
    const list = document.getElementById('admin-news-list');
    if (!list) return;
    list.innerHTML = (state.news || []).map(n => `
            <div class="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between items-center group">
                <div>
                    <p class="text-xs font-bold text-white">${n.title}</p>
                    <p class="text-[9px] text-slate-500">${new Date(n.date).toLocaleDateString('de-DE')}</p>
                </div>
                <button onclick="removeNewsEntry('${n.id}')" class="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
            `).join('');
    lucide.createIcons();
}

function addNewsEntry() {
    const title = document.getElementById('admin-news-title').value;
    const content = document.getElementById('admin-news-content').value;
    if (!title || !content) return;

    state.news.unshift({
        id: 'n' + Date.now(),
        date: new Date().toISOString().split('T')[0],
        title,
        content
    });
    saveData();
    renderAdminNews();
    renderStats();
    showToast('Mitteilung veröffentlicht!');
    document.getElementById('admin-news-title').value = '';
    document.getElementById('admin-news-content').value = '';
}

function removeNewsEntry(id) {
    if (confirm('Eintrag löschen?')) {
        state.news = state.news.filter(n => n.id !== id);
        saveData();
        renderAdminNews();
        renderStats(); // Always update dashboard
    }
}

function renderAdminEvents() {
    const list = document.getElementById('admin-event-list');
    if (!list) return;
    list.innerHTML = (state.events || []).map(e => `
            <div class="bg-white/5 p-2 rounded-lg border border-white/5 flex justify-between items-center group">
                <div>
                    <p class="text-xs font-bold text-white">${e.title}</p>
                    <p class="text-[9px] text-slate-500">${new Date(e.date).toLocaleDateString('de-DE')} • ${e.location}</p>
                </div>
                <button onclick="removeEventEntry('${e.id}')" class="p-1 text-slate-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    <i data-lucide="trash-2" class="w-3 h-3"></i>
                </button>
            </div>
            `).join('');
    lucide.createIcons();
}

function addEventEntry() {
    const title = document.getElementById('admin-event-title').value;
    const date = document.getElementById('admin-event-date').value;
    const location = document.getElementById('admin-event-location').value;
    if (!title || !date || !location) return;

    state.events.push({
        id: 'e' + Date.now(),
        date,
        title,
        location
    });
    saveData();
    renderAdminEvents();
    renderStats();
    showToast('Termin angelegt!');
    document.getElementById('admin-event-title').value = '';
    document.getElementById('admin-event-date').value = '';
    document.getElementById('admin-event-location').value = '';
}

function removeEventEntry(id) {
    if (confirm('Termin löschen?')) {
        state.events = state.events.filter(e => e.id !== id);
        saveData();
        renderAdminEvents();
        renderStats(); // Always update dashboard
    }
}

function setActiveUser(memberId) {
    state.activeMemberId = memberId;
    saveData();
    renderStats(); // Update dashboard if needed
}

// --- Analytics Logic ---
function renderAnalytics() {
    renderGenderDist();
    renderAverageAge();
    renderCityDist();
    renderLeaseStats();
    renderSizeStats();
    renderInventoryStats();
}

function renderGenderDist() {
    const container = document.getElementById('analytics-gender-bars');
    if (!container) return;

    const stats = { männlich: 0, weiblich: 0, divers: 0, unbekannt: 0 };
    state.members.forEach(m => {
        const g = m.gender || 'unbekannt';
        if (stats[g] !== undefined) stats[g]++;
        else stats.unbekannt++;
    });

    const total = state.members.length || 1;
    const colors = { männlich: 'bg-indigo-500', weiblich: 'bg-rose-400', divers: 'bg-amber-400', unbekannt: 'bg-slate-600' };

    container.innerHTML = Object.entries(stats).map(([label, count]) => {
        const percent = (count / total) * 100;
        if (count === 0 && label === 'unbekannt') return '';
        return `
            <div class="space-y-1.5">
                <div class="flex justify-between text-[10px] font-black uppercase tracking-widest">
                    <span class="text-slate-400">${label}</span>
                    <span class="text-white">${count} (${Math.round(percent)}%)</span>
                </div>
                <div class="w-full bg-white/5 h-2 rounded-full overflow-hidden">
                    <div class="${colors[label]} h-full transition-all duration-1000" style="width: ${percent}%"></div>
                </div>
            </div>
        `;
    }).join('');
}

function renderAverageAge() {
    const el = document.getElementById('analytics-avg-age');
    if (!el) return;

    let totalAge = 0;
    let count = 0;
    const currentYear = new Date().getFullYear();

    state.members.forEach(m => {
        if (m.birthDate) {
            const birthYear = new Date(m.birthDate).getFullYear();
            const age = currentYear - birthYear;
            if (!isNaN(age)) {
                totalAge += age;
                count++;
            }
        }
    });

    const avg = count > 0 ? Math.round(totalAge / count) : 0;
    el.textContent = avg || '--';
}

function renderCityDist() {
    const container = document.getElementById('analytics-city-list');
    if (!container) return;

    const cities = {};
    state.members.forEach(m => {
        const city = m.address?.city || 'Unbekannt';
        cities[city] = (cities[city] || 0) + 1;
    });

    container.innerHTML = Object.entries(cities)
        .sort((a, b) => b[1] - a[1])
        .map(([city, count]) => `
            <div class="city-stat">
                <span class="text-[10px] font-bold text-white truncate max-w-[100px]">${city}</span>
                <span class="text-[10px] font-black text-indigo-400 bg-indigo-500/10 px-2 py-0.5 rounded-md">${count}</span>
            </div>
        `).join('');
}

function renderLeaseStats() {
    const minEl = document.getElementById('stats-lease-min');
    const maxEl = document.getElementById('stats-lease-max');
    const avgEl = document.getElementById('stats-lease-avg');
    if (!minEl || !maxEl || !avgEl) return;

    const leases = state.gardens.map(g => parseFloat(g.leaseAmount) || 0).filter(l => l > 0);

    if (leases.length === 0) {
        minEl.textContent = '0,00';
        maxEl.textContent = '0,00';
        avgEl.textContent = '0,00';
        return;
    }

    const min = Math.min(...leases);
    const max = Math.max(...leases);
    const avg = leases.reduce((a, b) => a + b, 0) / leases.length;

    minEl.textContent = min.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
    maxEl.textContent = max.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
    avgEl.textContent = avg.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
}

function renderSizeStats() {
    const minEl = document.getElementById('stats-size-min');
    const maxEl = document.getElementById('stats-size-max');
    const avgEl = document.getElementById('stats-size-avg');
    if (!minEl || !maxEl || !avgEl) return;

    const sizes = state.gardens.map(g => parseInt(g.size) || 0).filter(s => s > 0);

    if (sizes.length === 0) {
        minEl.textContent = '0';
        maxEl.textContent = '0';
        avgEl.textContent = '0';
        return;
    }

    const min = Math.min(...sizes);
    const max = Math.max(...sizes);
    const avg = Math.round(sizes.reduce((a, b) => a + b, 0) / sizes.length);

    minEl.textContent = min + ' m²';
    maxEl.textContent = max + ' m²';
    avgEl.textContent = avg + ' m²';
}

function renderInventoryStats() {
    const topItemEl = document.getElementById('analytics-top-item');
    const topCountEl = document.getElementById('analytics-top-item-count');
    const avgDurationEl = document.getElementById('analytics-avg-duration');
    if (!topItemEl || !avgDurationEl) return;

    const rentalCounts = {};
    let totalDuration = 0;
    let shareableReturns = 0;

    state.inventory.forEach(item => {
        item.history.forEach(h => {
            if (h.action === 'rented') {
                rentalCounts[item.id] = (rentalCounts[item.id] || 0) + 1;
            }
            if (h.action === 'returned' && h.duration !== undefined) {
                totalDuration += h.duration;
                shareableReturns++;
            }
        });
    });

    // Top Item
    let topId = null;
    let maxRentals = 0;
    Object.entries(rentalCounts).forEach(([id, count]) => {
        if (count > maxRentals) {
            maxRentals = count;
            topId = id;
        }
    });

    if (topId) {
        const item = state.inventory.find(i => i.id === topId);
        topItemEl.textContent = item ? item.name : '--';
        topCountEl.textContent = `${maxRentals} Ausleihen`;
    } else {
        topItemEl.textContent = '--';
        topCountEl.textContent = '-- Ausleihen';
    }

    // Avg Duration
    const avg = shareableReturns > 0 ? (totalDuration / shareableReturns).toFixed(1) : 0;
    avgDurationEl.textContent = avg;
}


// --- Global Finance Settings Management ---
function saveGlobalFinanceSettings() {
    state.settings.feeWater = parseFloat(document.getElementById('settings-fee-water').value) || 0;
    state.settings.feeService = parseFloat(document.getElementById('settings-fee-service').value) || 0;
    state.settings.feePowerBase = parseFloat(document.getElementById('settings-fee-power').value) || 0;
    state.settings.feePool = parseFloat(document.getElementById('settings-fee-pool').value) || 0;
    state.settings.workRate = parseFloat(document.getElementById('settings-work-rate').value) || 0;

    saveData();
    showToast('Finanz-Einstellungen gespeichert');
}

function calculateTotalGardenCost(garden) {
    if (!garden) return 0;
    let total = parseFloat(garden.leaseAmount) || 0;
    total += parseFloat(state.settings.feeWater) || 0;
    total += parseFloat(state.settings.feeService) || 0;
    total += parseFloat(state.settings.feePowerBase) || 0;
    if (garden.hasPool) {
        total += parseFloat(state.settings.feePool) || 0;
    }
    return total;
}

function updateModalTotalCost() {
    const lease = parseFloat(document.getElementById('garden-lease-amount').value) || 0;
    const hasPool = document.getElementById('garden-hasPool').checked;

    let total = lease;
    total += parseFloat(state.settings.feeWater) || 0;
    total += parseFloat(state.settings.feeService) || 0;
    total += parseFloat(state.settings.feePowerBase) || 0;
    if (hasPool) {
        total += parseFloat(state.settings.feePool) || 0;
    }

    document.getElementById('modal-garden-total-cost').textContent = total.toLocaleString('de-DE', { minimumFractionDigits: 2 }) + ' €';
}

// --- Weather Logic ---
async function fetchWeather() {
    const widget = document.getElementById('weather-widget');
    if (!widget) return;

    try {
        const lat = 51.21;
        const lon = 10.45;
        const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,relative_humidity_2m,is_day,weather_code,wind_speed_10m&timezone=Europe%2FBerlin`);

        if (!response.ok) throw new Error('Weather API error');

        const data = await response.json();
        const current = data.current;

        // Update DOM
        document.getElementById('weather-temp').textContent = `${Math.round(current.temperature_2m)}°C`;
        document.getElementById('weather-wind').textContent = `Wind: ${Math.round(current.wind_speed_10m)} km/h`;
        document.getElementById('weather-humidity').textContent = `Feuchte: ${current.relative_humidity_2m}%`;

        const descEl = document.getElementById('weather-desc');
        const iconContainer = document.getElementById('weather-icon');

        const weatherInfo = getWeatherInfo(current.weather_code, current.is_day);
        descEl.textContent = weatherInfo.text;
        iconContainer.innerHTML = `<i data-lucide="${weatherInfo.icon}" class="w-7 h-7"></i>`;

        widget.classList.remove('hidden');
        lucide.createIcons();
    } catch (e) {
        console.error("Weather fetch failed:", e);
        widget.classList.add('hidden');
    }
}

function getWeatherInfo(code, isDay) {
    const mapping = {
        0: { text: 'Klarer Himmel', icon: isDay ? 'sun' : 'moon' },
        1: { text: 'Heiter', icon: isDay ? 'cloud-sun' : 'cloud-moon' },
        2: { text: 'Leicht bewölkt', icon: 'cloud' },
        3: { text: 'Bewölkt', icon: 'clouds' },
        45: { text: 'Nebel', icon: 'cloud-fog' },
        48: { text: 'Raureifnebel', icon: 'cloud-fog' },
        51: { text: 'Leichter Niesel', icon: 'cloud-drizzle' },
        53: { text: 'Nieselregen', icon: 'cloud-drizzle' },
        55: { text: 'Starker Niesel', icon: 'cloud-drizzle' },
        61: { text: 'Leichter Regen', icon: 'cloud-rain' },
        63: { text: 'Regen', icon: 'cloud-rain' },
        65: { text: 'Starker Regen', icon: 'cloud-rain' },
        71: { text: 'Leichter Schneefall', icon: 'cloud-snow' },
        73: { text: 'Schneefall', icon: 'cloud-snow' },
        75: { text: 'Starker Schneefall', icon: 'cloud-snow' },
        80: { text: 'Leichte Regenschauer', icon: 'cloud-rain-wind' },
        81: { text: 'Regenschauer', icon: 'cloud-rain-wind' },
        82: { text: 'Starke Regenschauer', icon: 'cloud-heavy-rain' },
        95: { text: 'Gewitter', icon: 'cloud-lightning' }
    };

    const res = mapping[code] || { text: 'Unbekannt', icon: 'cloud' };
    if (res.icon === 'clouds') res.icon = 'cloud';
    return res;
}

// --- Notification Logic ---
function toggleNotifications() {
    const popover = document.getElementById('notifications-popover');
    popover.classList.toggle('hidden');
}

function updateNotifications() {
    const list = document.getElementById('notifications-list');
    const badge = document.getElementById('notification-badge');
    if (!list || !badge) return;

    const notifications = [];

    // Check for overdue rentals (> 3 days)
    const now = new Date();
    state.inventory.forEach(item => {
        if (item.status === 'rented' && item.rentedSince) {
            const start = new Date(item.rentedSince);
            const days = Math.floor((now - start) / (1000 * 60 * 60 * 24));

            if (days >= 3) {
                const member = state.members.find(m => m.id === item.rentedBy);
                notifications.push({
                    type: 'warning',
                    title: 'Rückgabe überfällig',
                    text: `${item.name} ist seit ${days} Tagen bei ${member?.lastName || 'Mitglied'}`,
                    itemId: item.id
                });
            }
        }
    });

    if (notifications.length > 0) {
        badge.classList.remove('hidden');
        list.innerHTML = notifications.map(notif => `
            <div class="p-3 bg-white/5 rounded-xl border border-white/5 space-y-1">
                <div class="flex items-center gap-2 mb-1">
                    <div class="p-1 bg-amber-500/10 rounded text-amber-500">
                        <i data-lucide="alert-triangle" class="w-3 h-3"></i>
                    </div>
                    <h5 class="text-[10px] font-black text-white uppercase tracking-wider">${notif.title}</h5>
                </div>
                <p class="text-[10px] text-slate-400 leading-relaxed">${notif.text}</p>
            </div>
        `).join('');
    } else {
        badge.classList.add('hidden');
        list.innerHTML = '<p class="text-[10px] text-slate-500 italic text-center py-4">Keine neuen Meldungen.</p>';
    }

    lucide.createIcons();
}

// --- Export Logic ---
function exportMembersToCSV() {
    if (!state.members || state.members.length === 0) {
        showToast('Keine Mitglieder zum Exportieren vorhanden.', 'error');
        return;
    }

    const headers = [
        'ID', 'Vorname', 'Nachname', 'Geschlecht', 'Geburtsname', 'Geburtsdatum',
        'Beruf', 'Straße', 'Hausnummer', 'PLZ', 'Ort', 'Telefon Festnetz',
        'Telefon Mobil', 'E-Mail', 'Erwachsene', 'Kinder', 'Mitgliedsnummer',
        'Vorstand', 'Rolle'
    ];

    const rows = state.members.map(m => [
        m.id,
        m.firstName || '',
        m.lastName || '',
        m.gender || '',
        m.birthName || '',
        m.birthDate || '',
        m.profession || '',
        m.address?.street || '',
        m.address?.houseNumber || '',
        m.address?.zip || '',
        m.address?.city || '',
        m.phone?.landline || '',
        m.phone?.mobile || '',
        m.email || '',
        m.family?.adults || 0,
        m.family?.children || 0,
        m.memberNumber || '',
        m.isBoardMember ? 'Ja' : 'Nein',
        m.boardRole || ''
    ]);

    // Use semicolon for better Excel compatibility in DE locale
    let csvContent = "\uFEFF" // Byte Order Mark for UTF-8 compatibility
        + headers.join(";") + "\n"
        + rows.map(e => e.map(val => `"${val}"`).join(";")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Mitgliederliste_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    showToast('Mitgliederliste wurde exportiert.');
}
