// --- Constants ---
const STORAGE_KEY = 'birthday_manager_data';
const DB_NAME = 'BirthdayDB';
const DB_VERSION = 1;
const STORE_NAME = 'contacts';

const ZODIAC_DATA = [
    { name: 'Steinbock', icon: '♑', element: 'Erde', start: [12, 22], end: [1, 20], fact: 'Feiert nicht, er "optimiert sein Lebensjahr".' },
    { name: 'Wassermann', icon: '♒', element: 'Luft', start: [1, 21], end: [2, 19], fact: 'Findet Geburtstage eigentlich zu "mainstream".' },
    { name: 'Fische', icon: '♓', element: 'Wasser', start: [2, 20], end: [3, 20], fact: 'Hat wahrscheinlich vergessen, dass er selbst Geburtstag hat.' },
    { name: 'Widder', icon: '♈', element: 'Feuer', start: [3, 21], end: [4, 20], fact: 'Rennt mit dem Kopf durch die Wand (auch wenn die Tür offen ist).' },
    { name: 'Stier', icon: '♉', element: 'Erde', start: [4, 21], end: [5, 20], fact: 'Hat das Buffet meistens schon vor der Eröffnung leer gegessen.' },
    { name: 'Zwillinge', icon: '♊', element: 'Luft', start: [5, 21], end: [6, 21], fact: 'Redet so viel, dass die App eine Textbegrenzung braucht.' },
    { name: 'Krebs', icon: '♋', element: 'Wasser', start: [6, 22], end: [7, 22], fact: 'Sensibel. Ein falsches Emoji in der Gratulation und er weint.' },
    { name: 'Löwe', icon: '♌', element: 'Feuer', start: [7, 23], end: [8, 23], fact: 'Erwartet zum Geburtstag eine Parade, mindestens.' },
    { name: 'Jungfrau', icon: '♍', element: 'Erde', start: [8, 24], end: [9, 23], fact: 'Hat die Dankeskarten schon vor der Party fertig sortiert.' },
    { name: 'Waage', icon: '♎', element: 'Luft', start: [9, 24], end: [10, 23], fact: 'Kann sich bis heute nicht entscheiden, welchen Kuchen sie will.' },
    { name: 'Skorpion', icon: '♏', element: 'Wasser', start: [10, 24], end: [11, 22], fact: 'Weiß dein Passwort vermutlich schon, bevor du gratulierst.' },
    { name: 'Schütze', icon: '♐', element: 'Feuer', start: [11, 23], end: [12, 21], fact: 'Schon wieder im Urlaub. Gratulation per Satellitentelefon nötig.' }
];

// --- State ---
let contacts = [];
let currentCalendarDate = new Date();
let currentElementFilter = null;
let db = null;

// --- DB Helper functions ---
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onerror = (event) => reject("DB Error: " + event.target.errorCode);
        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(STORE_NAME)) {
                db.createObjectStore(STORE_NAME, { keyPath: "id" });
            }
        };
        request.onsuccess = (event) => {
            db = event.target.result;
            resolve(db);
        };
    });
}

async function getAllFromDB() {
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], "readonly");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result);
    });
}

async function putToDB(contact) {
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.put(contact);
        request.onsuccess = () => resolve();
    });
}

async function removeFromDB(id) {
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.delete(id);
        request.onsuccess = () => resolve();
    });
}

async function clearDB() {
    return new Promise((resolve) => {
        const transaction = db.transaction([STORE_NAME], "readwrite");
        const store = transaction.objectStore(STORE_NAME);
        const request = store.clear();
        request.onsuccess = () => resolve();
    });
}

// --- Core Helper Functions ---
function safeLucide() {
    if (typeof lucide !== 'undefined' && lucide.createIcons) {
        lucide.createIcons();
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const currentTheme = html.classList.contains('light') ? 'light' : 'dark';
    const newTheme = currentTheme === 'dark' ? 'light' : 'dark';

    if (newTheme === 'light') {
        html.classList.add('light');
    } else {
        html.classList.remove('light');
    }

    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
}

function updateThemeIcon(theme) {
    const btn = document.getElementById('btn-theme-toggle');
    if (!btn) return;

    const icon = btn.querySelector('i');
    if (theme === 'light') {
        icon.setAttribute('data-lucide', 'moon');
        btn.classList.remove('bg-amber-500/10', 'hover:bg-amber-500/20', 'text-amber-400');
        btn.classList.add('bg-indigo-500/10', 'hover:bg-indigo-500/20', 'text-indigo-400');
    } else {
        icon.setAttribute('data-lucide', 'sun');
        btn.classList.remove('bg-indigo-500/10', 'hover:bg-indigo-500/20', 'text-indigo-400');
        btn.classList.add('bg-amber-500/10', 'hover:bg-amber-500/20', 'text-amber-400');
    }
    safeLucide();
}

function initTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    if (savedTheme === 'light') {
        document.documentElement.classList.add('light');
    }
    updateThemeIcon(savedTheme);
}

function createConfetti() {
    const colors = ['#818cf8', '#2dd4bf', '#f43f5e', '#fbbf24', '#a78bfa', '#34d399'];
    const confettiCount = 50;

    for (let i = 0; i < confettiCount; i++) {
        const confetti = document.createElement('div');
        confetti.className = 'confetti confetti-piece';
        confetti.style.left = Math.random() * 100 + 'vw';
        confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        confetti.style.animationDelay = Math.random() * 2 + 's';
        confetti.style.animationDuration = (Math.random() * 2 + 3) + 's';

        document.body.appendChild(confetti);

        setTimeout(() => confetti.remove(), 5000);
    }
}

function checkTodayBirthdays() {
    const today = new Date();
    const todayStr = today.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

    const birthdaysToday = contacts.filter(c => {
        if (!c.date) return false;
        const birthDate = new Date(c.date);
        const birthStr = birthDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
        return birthStr === todayStr;
    });

    if (birthdaysToday.length > 0) {
        setTimeout(() => createConfetti(), 500);
    }
}

function getAvatarColor(name) {
    const colors = [
        { bg: 'bg-rose-500', text: 'text-white' },
        { bg: 'bg-pink-500', text: 'text-white' },
        { bg: 'bg-purple-500', text: 'text-white' },
        { bg: 'bg-indigo-500', text: 'text-white' },
        { bg: 'bg-blue-500', text: 'text-white' },
        { bg: 'bg-cyan-500', text: 'text-white' },
        { bg: 'bg-teal-500', text: 'text-white' },
        { bg: 'bg-emerald-500', text: 'text-white' },
        { bg: 'bg-green-500', text: 'text-white' },
        { bg: 'bg-lime-500', text: 'text-white' },
        { bg: 'bg-amber-500', text: 'text-white' },
        { bg: 'bg-orange-500', text: 'text-white' }
    ];

    let hash = 0;
    for (let i = 0; i < name.length; i++) {
        hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }

    const index = Math.abs(hash) % colors.length;
    return colors[index];
}

window.toggleTheme = toggleTheme;

function getZodiacSign(date) {
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return ZODIAC_DATA.find(sign => {
        const [startM, startD] = sign.start;
        const [endM, endD] = sign.end;

        if (startM === 12 && endM === 1) {
            return (month === 12 && day >= startD) || (month === 1 && day <= endD);
        }

        return (month === startM && day >= startD) || (month === endM && day <= endD);
    }) || { name: 'Unbekannt', fact: '--', element: 'Unbekannt' };
}

function getUpcomingBirthdays() {
    const today = new Date();
    const currentYear = today.getFullYear();

    return contacts.map(contact => {
        if (!contact.date) return null;
        const birthDate = new Date(contact.date);
        if (isNaN(birthDate)) return null;

        let nextBirthday = new Date(currentYear, birthDate.getMonth(), birthDate.getDate());
        const todayNoTime = new Date(today.getFullYear(), today.getMonth(), today.getDate());

        if (nextBirthday < todayNoTime) {
            nextBirthday.setFullYear(currentYear + 1);
        }

        const diffTime = nextBirthday - todayNoTime;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        const newAge = nextBirthday.getFullYear() - birthDate.getFullYear();

        return {
            ...contact,
            nextBirthday,
            diffDays,
            newAge,
            dateStr: birthDate.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' }),
            zodiac: getZodiacSign(birthDate)
        };
    }).filter(c => c !== null).sort((a, b) => a.diffDays - b.diffDays);
}

// --- Data Management ---
async function loadData() {
    try {
        await initDB();
        let storedContacts = await getAllFromDB();

        const oldData = localStorage.getItem(STORAGE_KEY);
        if (oldData && storedContacts.length === 0) {
            try {
                const migrated = JSON.parse(oldData);
                for (const c of migrated) {
                    await putToDB(c);
                }
                storedContacts = migrated;
            } catch (e) {
                console.error("Migration failed", e);
            }
        }

        if (storedContacts.length === 0 && !oldData) {
            contacts = [
                { id: 1, name: 'Max Mustermann', date: '1990-05-20', caffeine: 'Medium', hate: 'Stau', insider: 'Story 1', punctuality: 5 },
                { id: 2, name: 'Erika Musterfrau', date: '1985-11-15', caffeine: 'High', hate: 'Pizza', insider: 'Story 2', punctuality: -10 }
            ];
            for (const c of contacts) await putToDB(c);
        } else {
            contacts = storedContacts;
        }
        renderApp();
    } catch (e) {
        console.error("DB Init failed", e);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) contacts = JSON.parse(stored);
        renderApp();
    }
}

async function saveData() {
    renderApp();
}

async function saveContact(data, id = null) {
    if (id && id !== '') {
        const index = contacts.findIndex(c => c.id == id);
        if (index !== -1) {
            const updated = { ...contacts[index], ...data };
            contacts[index] = updated;
            await putToDB(updated);
        }
    } else {
        const newContact = {
            id: Date.now(),
            ...data
        };
        contacts.push(newContact);
        await putToDB(newContact);
    }
    saveData();
}

async function deleteContact(id) {
    if (confirm('Löschen?')) {
        contacts = contacts.filter(c => c.id !== id);
        await removeFromDB(id);
        saveData();
        closeProfileModal();
    }
}

// --- Backup & Restore ---
window.exportBackup = function () {
    const data = JSON.stringify(contacts, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `geburtstage_backup_${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

window.triggerImport = function () {
    document.getElementById('import-file').click();
}

window.importBackup = async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    if (!confirm('Alle aktuellen Kontakte werden durch das Backup ersetzt. Fortfahren?')) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        try {
            const imported = JSON.parse(e.target.result);
            if (Array.isArray(imported)) {
                await clearDB();
                contacts = imported;
                for (let c of contacts) {
                    await putToDB(c);
                }
                renderApp();
                alert('Backup erfolgreich eingespielt!');
            }
        } catch (err) {
            alert('Fehler beim Einlesen des Backups.');
        }
    };
    reader.readAsText(file);
}

window.importICal = async function (event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        const text = e.target.result;
        const vevents = text.split('BEGIN:VEVENT');
        vevents.shift(); // Remove content before first VEVENT

        let importedCount = 0;
        const newContacts = [];

        vevents.forEach(eventStr => {
            const summaryMatch = eventStr.match(/SUMMARY:(.*)/);
            const dtStartMatch = eventStr.match(/DTSTART;?(?:VALUE=DATE)?:(\d{8})/);

            if (summaryMatch && dtStartMatch) {
                let name = summaryMatch[1].trim();
                // Strip common prefixes like "Geburtstag von "
                name = name.replace(/Geburtstag von\s+/i, '');

                const dateStr = dtStartMatch[1]; // YYYYMMDD
                const year = dateStr.substring(0, 4);
                const month = dateStr.substring(4, 6);
                const day = dateStr.substring(6, 8);
                const date = `${year}-${month}-${day}`;

                newContacts.push({
                    id: Date.now() + Math.random(),
                    name,
                    date,
                    caffeine: 'Medium',
                    socialBattery: 50,
                    partyType: 'Eskalations-Profi',
                    punctuality: 0,
                    snack: 'Vom iCal Import'
                });
                importedCount++;
            }
        });

        if (newContacts.length > 0) {
            if (confirm(`${importedCount} Kontakte aus iCal gefunden. Sollen diese hinzugefügt werden?`)) {
                for (let c of newContacts) {
                    contacts.push(c);
                    await putToDB(c);
                }
                renderApp();
                alert(`${importedCount} Kontakte erfolgreich importiert!`);
            }
        } else {
            alert('Keine gültigen Geburtstage in der iCal-Datei gefunden.');
        }
    };
    reader.readAsText(file);
    event.target.value = ''; // Reset file input
}

// --- View / Render Logic ---

function renderApp() {
    renderLanding();
    renderCalendar();
    updateStats();
    renderZodiacFilter();
    renderContactsList();
    safeLucide();
}

function renderLanding() {
    const listEl = document.getElementById('landing-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const upcoming = getUpcomingBirthdays().slice(0, 5);

    if (upcoming.length === 0) {
        listEl.innerHTML = `<p class="text-slate-500 text-center italic text-xs py-4">Keine Geburtstage.</p>`;
    } else {
        upcoming.forEach(item => {
            const isSoon = item.diffDays <= 7;
            listEl.appendChild(createBirthdayCard(item, isSoon));
        });
    }

    const next = upcoming[0];
    const nextNameEl = document.getElementById('dashboard-next-name');
    if (nextNameEl) {
        nextNameEl.textContent = next ? `${next.name} (${next.diffDays} T.)` : '--';
    }
}

function renderContactsList() {
    const listEl = document.getElementById('contacts-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    const searchInput = document.getElementById('contact-search');
    const searchTerm = searchInput ? searchInput.value.toLowerCase() : '';

    const allSorted = getUpcomingBirthdays();

    const filtered = allSorted.filter(c => {
        const matchesSearch = c.name.toLowerCase().includes(searchTerm);
        const matchesElement = currentElementFilter ? (c.zodiac && c.zodiac.element === currentElementFilter) : true;
        return matchesSearch && matchesElement;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `<p class="text-slate-500 text-center italic text-sm py-8">Keine Kontakte gefunden.</p>`;
    } else {
        filtered.forEach(item => {
            listEl.appendChild(createBirthdayCard(item, false));
        });
    }
    safeLucide();
}

function renderZodiacFilter() {
    const container = document.getElementById('zodiac-filter-container');
    if (!container) return;
    container.innerHTML = '';

    if (!container.className.includes('grid')) {
        container.className = 'grid grid-cols-2 gap-2 pb-4 hidden';
    }

    const elements = ['Feuer', 'Erde', 'Luft', 'Wasser'];
    const elementConfig = {
        'Feuer': { icon: 'flame', color: 'rose', bg: 'bg-rose-500/10', border: 'border-rose-500/20', text: 'text-rose-400', emoji: '🔥' },
        'Erde': { icon: 'flower', color: 'emerald', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', text: 'text-emerald-400', emoji: '🌍' },
        'Luft': { icon: 'wind', color: 'sky', bg: 'bg-sky-500/10', border: 'border-sky-500/20', text: 'text-sky-400', emoji: '💨' },
        'Wasser': { icon: 'droplets', color: 'blue', bg: 'bg-blue-500/10', border: 'border-blue-500/20', text: 'text-blue-400', emoji: '💧' }
    };

    elements.forEach(el => {
        const config = elementConfig[el];
        const isActive = currentElementFilter === el;
        const btn = document.createElement('button');
        btn.className = `p-3 rounded-xl border flex flex-col items-center gap-2 transition-all duration-200 ${isActive ? 'bg-indigo-600 border-indigo-500 shadow-lg scale-[1.02]' : `${config.bg} ${config.border} hover:bg-white/5`}`;
        const header = document.createElement('div');
        header.className = 'flex items-center gap-2 mb-1';
        header.innerHTML = `<i data-lucide="${config.icon}" class="w-4 h-4 ${isActive ? 'text-white' : config.text}"></i><span class="text-xs font-bold uppercase ${isActive ? 'text-white' : 'text-slate-400'}">${el} ${config.emoji}</span>`;
        const signs = ZODIAC_DATA.filter(z => z.element === el).map(z => z.name).join(', ');
        const signsEl = document.createElement('div');
        signsEl.className = `text-[10px] text-center leading-tight opacity-80 ${isActive ? 'text-indigo-200' : 'text-slate-500'}`;
        signsEl.textContent = signs;
        btn.appendChild(header);
        btn.appendChild(signsEl);
        btn.onclick = () => {
            currentElementFilter = isActive ? null : el;
            renderZodiacFilter();
            renderContactsList();
        };
        container.appendChild(btn);
    });
}

function setFilterMode(mode) {
    const pill = document.getElementById('filter-pill');
    const container = document.getElementById('zodiac-filter-container');
    if (!pill || !container) return;

    const allBtns = document.querySelectorAll('#view-contacts .flex button[onclick^="setFilterMode"]');
    const btnAll = allBtns[0];
    const btnElements = allBtns[1];

    if (mode === 'all') {
        pill.style.transform = 'translateX(0)';
        pill.style.left = '4px';
        pill.style.right = 'auto';
        container.classList.add('hidden');
        if (btnAll) { btnAll.classList.add('text-white'); btnAll.classList.remove('text-slate-400'); }
        if (btnElements) { btnElements.classList.add('text-slate-400'); btnElements.classList.remove('text-white'); }
        currentElementFilter = null;
        renderZodiacFilter();
        renderContactsList();
    } else {
        pill.style.transform = 'translateX(100%)';
        container.classList.remove('hidden');
        if (btnAll) { btnAll.classList.add('text-slate-400'); btnAll.classList.remove('text-white'); }
        if (btnElements) { btnElements.classList.add('text-white'); btnElements.classList.remove('text-slate-400'); }
    }
}

function createBirthdayCard(item, highlight) {
    const card = document.createElement('div');
    const dateDisplay = item.nextBirthday.toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
    const avatarColor = getAvatarColor(item.name);
    const isToday = item.diffDays === 0;

    card.className = `glass-card p-4 flex items-center justify-between group cursor-pointer transition-all hover:scale-[1.02] ${highlight ? 'border-indigo-500/50 bg-indigo-500/10' : 'border-white/5 active:bg-white/5'} ${isToday ? 'birthday-today' : ''}`;
    card.onclick = () => openProfile(item.id);

    card.innerHTML = `
        <div class="flex items-center gap-4">
            <div class="w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm ${highlight ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20' : avatarColor.bg + ' ' + avatarColor.text}">
                ${item.name.charAt(0)}
            </div>
            <div>
                <h3 class="font-bold text-white text-sm leading-tight">${item.name} ${isToday ? '🎂' : ''}</h3>
                <p class="text-[10px] text-slate-400 uppercase tracking-wide">Wird <span class="text-indigo-400 font-bold">${item.newAge}</span> am ${dateDisplay}</p>
            </div>
        </div>
        <div>
            <span class="text-[10px] font-bold ${isToday ? 'text-white bg-indigo-500' : 'text-slate-500 bg-slate-800'} px-2 py-1 rounded-full border ${isToday ? 'border-indigo-400' : 'border-slate-700'}">
                ${isToday ? '🎉 HEUTE' : item.diffDays + ' T.'}
            </span>
        </div>
    `;
    return card;
}

// --- Modals ---
function openProfile(id) {
    const contact = getUpcomingBirthdays().find(c => c.id === id);
    if (!contact) return;

    document.getElementById('profile-initials').textContent = contact.name.charAt(0);
    document.getElementById('profile-name').textContent = contact.name;
    document.getElementById('profile-age-info').textContent = `Wird ${contact.newAge} Jahre alt`;
    document.getElementById('profile-caffeine').textContent = contact.caffeine || 'Unbekannt';
    document.getElementById('profile-hate').textContent = contact.hate || 'Nichts';
    document.getElementById('profile-insider').textContent = contact.insider ? `"${contact.insider}"` : 'Keine Story.';
    document.getElementById('profile-punctuality').textContent = (contact.punctuality || 0) + ' Min';

    // New Fields
    document.getElementById('profile-social-battery').textContent = (contact.socialBattery || 50) + '%';
    document.getElementById('profile-battery-bar').style.width = (contact.socialBattery || 50) + '%';
    document.getElementById('profile-party-type').textContent = contact.partyType || 'Gast';
    document.getElementById('profile-snack').textContent = contact.snack || 'Allesesser';

    if (contact.zodiac) {
        document.getElementById('profile-zodiac-name').textContent = contact.zodiac.name;
        document.getElementById('profile-zodiac-fact').textContent = contact.zodiac.fact;
    }

    const btnDel = document.getElementById('btn-delete-contact');
    const btnEdit = document.getElementById('btn-edit-contact');
    btnDel.onclick = () => deleteContact(id);
    btnEdit.onclick = () => editContact(id);

    document.getElementById('modal-profile').classList.remove('hidden');
}

function closeProfileModal() {
    document.getElementById('modal-profile').classList.add('hidden');
}

function editContact(id) {
    closeProfileModal();
    const contact = contacts.find(c => c.id === id);
    if (!contact) return;

    document.getElementById('input-id').value = contact.id;
    document.getElementById('input-name').value = contact.name;
    document.getElementById('input-date').value = contact.date;
    document.getElementById('input-caffeine').value = contact.caffeine || 'Medium';
    document.getElementById('input-hate').value = contact.hate || '';
    document.getElementById('input-insider').value = contact.insider || '';
    document.getElementById('input-punctuality').value = contact.punctuality || 0;
    document.getElementById('slider-val-punctuality').textContent = (contact.punctuality || 0) + ' Min';

    // New Fields
    document.getElementById('input-social-battery').value = contact.socialBattery || 50;
    document.getElementById('val-social-battery').textContent = (contact.socialBattery || 50) + '%';
    document.getElementById('input-party-type').value = contact.partyType || 'Buffet-Wächter';
    document.getElementById('input-snack').value = contact.snack || '';

    document.getElementById('modal-add-title').textContent = 'Kontakt bearbeiten';
    showContactModal();
}

// --- Calendar & Stats ---
function renderCalendar() {
    const gridEl = document.getElementById('calendar-grid');
    if (!gridEl) return;
    gridEl.innerHTML = '';
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    const today = new Date();
    const monthLabel = document.getElementById('current-month-label');
    if (monthLabel) monthLabel.textContent = currentCalendarDate.toLocaleDateString('de-DE', { month: 'short', year: 'numeric' });
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDay = (firstDay.getDay() + 6) % 7;
    for (let i = 0; i < startingDay; i++) {
        const cell = document.createElement('div');
        cell.className = 'aspect-square';
        gridEl.appendChild(cell);
    }
    for (let day = 1; day <= daysInMonth; day++) {
        const cell = document.createElement('div');
        const isToday = day === today.getDate() && month === today.getMonth() && year === today.getFullYear();
        const hasBirthday = contacts.some(c => {
            const d = new Date(c.date);
            return d.getDate() === day && d.getMonth() === month;
        });
        let className = 'aspect-square flex items-center justify-center rounded-lg text-xs font-medium cursor-default ';
        if (hasBirthday) className += 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/20 font-bold';
        else if (isToday) className += 'bg-emerald-500/20 text-emerald-400 border-2 border-emerald-500 font-bold';
        else className += 'text-slate-400 hover:bg-white/5';
        cell.className = className;
        cell.textContent = day;
        gridEl.appendChild(cell);
    }
}

function updateStats() {
    const totalEl = document.getElementById('stat-total-analytics');
    if (totalEl) totalEl.textContent = contacts.length;

    const today = new Date();
    const thisMonthCount = contacts.filter(c => new Date(c.date).getMonth() === today.getMonth()).length;
    const monthEl = document.getElementById('dashboard-count-month');
    if (monthEl) monthEl.textContent = thisMonthCount;

    if (contacts.length > 0) {
        // Calculate Ages
        const now = new Date();
        const ages = contacts.map(c => {
            const birthDate = new Date(c.date);
            let age = now.getFullYear() - birthDate.getFullYear();
            const m = now.getMonth() - birthDate.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < birthDate.getDate())) age--;
            return age;
        });

        const minAge = Math.min(...ages);
        const maxAge = Math.max(...ages);
        const avgAge = Math.round(ages.reduce((a, b) => a + b, 0) / ages.length);

        const minEl = document.getElementById('stat-min-age');
        const maxEl = document.getElementById('stat-max-age');
        const avgEl = document.getElementById('stat-avg-age');

        if (minEl) minEl.textContent = minAge;
        if (maxEl) maxEl.textContent = maxAge;
        if (avgEl) avgEl.textContent = avgAge;

        // Ø Punctuality
        const sumPunc = contacts.reduce((acc, c) => acc + (parseInt(c.punctuality) || 0), 0);
        const avgPunc = Math.round(sumPunc / contacts.length);
        const puncEl = document.getElementById('stat-avg-punctuality');
        if (puncEl) puncEl.textContent = avgPunc > 0 ? `+${avgPunc} m` : `${avgPunc} m`;

        // Ø Social Battery
        const sumBatt = contacts.reduce((acc, c) => acc + (parseInt(c.socialBattery) || 50), 0);
        const avgBatt = Math.round(sumBatt / contacts.length);
        const battEl = document.getElementById('stat-avg-battery');
        if (battEl) battEl.textContent = avgBatt + '%';

        // Top Caffeine
        const cafCounts = {};
        contacts.forEach(c => cafCounts[c.caffeine || 'Medium'] = (cafCounts[c.caffeine || 'Medium'] || 0) + 1);
        const topCaf = Object.keys(cafCounts).reduce((a, b) => cafCounts[a] > cafCounts[b] ? a : b);
        const cafEl = document.getElementById('stat-common-caffeine');
        if (cafEl) cafEl.textContent = topCaf;

        // Top Snack
        const snackCounts = {};
        contacts.forEach(c => { if (c.snack) snackCounts[c.snack] = (snackCounts[c.snack] || 0) + 1; });
        const topSnack = Object.keys(snackCounts).length > 0 ? Object.keys(snackCounts).reduce((a, b) => snackCounts[a] > snackCounts[b] ? a : b) : 'N/A';
        const snackEl = document.getElementById('stat-top-snack');
        if (snackEl) snackEl.textContent = topSnack;
    }

    renderElementStats();
    renderPartyTypeStats();
    renderOracle();
}

function renderElementStats() {
    const container = document.getElementById('element-radar-container');
    const verdictEl = document.getElementById('element-verdict');
    if (!container || !verdictEl) return;
    container.innerHTML = '';
    if (contacts.length === 0) {
        container.innerHTML = '<p class="text-xs text-slate-500 text-center">Keine Daten.</p>';
        verdictEl.textContent = 'Das Universum schweigt.';
        return;
    }
    const elements = { 'Feuer': 0, 'Erde': 0, 'Luft': 0, 'Wasser': 0 };
    let assigned = 0;
    contacts.forEach(c => {
        if (c.date) {
            const z = c.zodiac || getZodiacSign(new Date(c.date));
            if (z && z.element && elements[z.element] !== undefined) { elements[z.element]++; assigned++; }
        }
    });
    if (assigned === 0) return;
    const config = {
        'Feuer': { color: 'bg-rose-500', bg: 'bg-rose-500/20', icon: 'flame', label: 'Feuer' },
        'Erde': { color: 'bg-emerald-500', bg: 'bg-emerald-500/20', icon: 'flower', label: 'Erde' },
        'Luft': { color: 'bg-sky-500', bg: 'bg-sky-500/20', icon: 'wind', label: 'Luft' },
        'Wasser': { color: 'bg-blue-500', bg: 'bg-blue-500/20', icon: 'droplets', label: 'Wasser' }
    };
    let dominantElement = ''; let maxCount = -1;
    Object.keys(elements).forEach(el => {
        const count = elements[el]; const pct = Math.round((count / assigned) * 100);
        if (count > maxCount) { maxCount = count; dominantElement = el; }
        else if (count === maxCount) dominantElement = 'Balanced';
        const row = document.createElement('div');
        row.className = 'space-y-1';
        row.innerHTML = `<div class="flex justify-between text-[10px] font-bold uppercase text-slate-400"><span class="flex items-center gap-1.5"><i data-lucide="${config[el].icon}" class="w-3 h-3"></i> ${config[el].label}</span><span>${pct}%</span></div><div class="h-2 w-full ${config[el].bg} rounded-full overflow-hidden"><div class="h-full ${config[el].color} transition-all duration-500" style="width: ${pct}%"></div></div>`;
        container.appendChild(row);
    });
    const verdicts = { 'Feuer': "Explosive Stimmung! Feuerlöscher bereitstellen.", 'Erde': "Bodenständig. Viel Gerede über Versicherungen.", 'Luft': "Viel Gerede, wenig Essen.", 'Wasser': "Emotional und tiefgründig.", 'Balanced': "Harmonisches Gleichgewicht." };
    verdictEl.textContent = verdicts[dominantElement] || verdicts['Balanced'];
}

function renderPartyTypeStats() {
    const container = document.getElementById('party-type-container');
    if (!container) return;
    container.innerHTML = '';
    if (contacts.length === 0) return;

    const counts = {};
    contacts.forEach(c => { const t = c.partyType || 'Gast'; counts[t] = (counts[t] || 0) + 1; });
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);

    sorted.forEach(([type, count]) => {
        const pct = Math.round((count / contacts.length) * 100);
        const row = document.createElement('div');
        row.className = 'space-y-1';
        row.innerHTML = `<div class="flex justify-between text-[10px] font-bold text-slate-400 uppercase"><span>${type}</span><span>${count}</span></div><div class="h-1.5 w-full bg-white/5 rounded-full overflow-hidden"><div class="h-full bg-indigo-500 opacity-60 rounded-full" style="width: ${pct}%"></div></div>`;
        container.appendChild(row);
    });
}

function renderOracle() {
    const meterEl = document.getElementById('oracle-meter');
    const statusEl = document.getElementById('oracle-status');
    const glowEl = document.getElementById('oracle-glow');
    if (!meterEl || !statusEl || contacts.length === 0) return;

    // Logic: More Caffeine + Low Social Battery + Late Punctuality = High Escalation
    const avgBatt = contacts.reduce((acc, c) => acc + (parseInt(c.socialBattery) || 50), 0) / contacts.length;
    const highCaf = contacts.filter(c => c.caffeine === 'Extreme' || c.caffeine === 'Death').length / contacts.length;
    const eskalationsProtis = contacts.filter(c => c.partyType === 'Eskalations-Profi').length / contacts.length;

    // Score from 0 to 100
    let score = 20; // Base level
    score += (100 - avgBatt) * 0.4; // Low battery often leads to weird decisions
    score += highCaf * 50;
    score += eskalationsProtis * 60;
    score = Math.min(100, Math.round(score));

    meterEl.textContent = score + '%';

    let status = 'Sicher.'; let color = 'rgba(79, 70, 229, 0.5)';
    if (score > 30) { status = 'Es knistert.'; color = 'rgba(234, 179, 8, 0.5)'; }
    if (score > 60) { status = 'Polonaise-Gefahr!'; color = 'rgba(244, 63, 94, 0.5)'; }
    if (score > 85) { status = 'TOTALE ESKALATION!'; color = 'rgba(255, 0, 0, 0.7)'; }

    statusEl.textContent = status;
    if (glowEl) glowEl.style.backgroundColor = color;
}

// --- Global Functions ---
window.switchView = function (viewName) {
    document.querySelectorAll('.view-section').forEach(el => el.classList.remove('active'));
    document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
    document.getElementById('view-' + viewName)?.classList.add('active');
    document.querySelector(`.nav-item[data-target="${viewName}"]`)?.classList.add('active');
    const titles = { 'landing': 'Dashboard', 'contacts': 'Alle Kontakte', 'analytics': 'Statistiken', 'setup': 'App-Setup' };
    document.getElementById('header-subtitle').textContent = titles[viewName] || 'App';
    localStorage.setItem('bm_last_view', viewName);
    safeLucide();
};

window.openAddContactModal = function () {
    document.getElementById('form-add-contact').reset();
    document.getElementById('input-id').value = '';
    document.getElementById('slider-val-punctuality').textContent = '0 Min';
    document.getElementById('val-social-battery').textContent = '50%';
    document.getElementById('modal-add-title').textContent = 'Neuer Kontakt';
    document.getElementById('modal-add').classList.remove('hidden');
};

function showContactModal() { document.getElementById('modal-add').classList.remove('hidden'); }
window.closeAddModal = function () { document.getElementById('modal-add').classList.add('hidden'); };

// --- Setup ---
function setupEventListeners() {
    document.getElementById('contact-search')?.addEventListener('input', () => renderContactsList());
    document.getElementById('form-add-contact')?.addEventListener('submit', (e) => {
        e.preventDefault();
        const data = {
            name: document.getElementById('input-name').value,
            date: document.getElementById('input-date').value,
            caffeine: document.getElementById('input-caffeine').value,
            hate: document.getElementById('input-hate').value,
            insider: document.getElementById('input-insider').value,
            punctuality: document.getElementById('input-punctuality').value,
            socialBattery: document.getElementById('input-social-battery').value,
            partyType: document.getElementById('input-party-type').value,
            snack: document.getElementById('input-snack').value
        };
        if (data.name && data.date) {
            saveContact(data, document.getElementById('input-id').value);
            window.closeAddModal();
            document.getElementById('contact-search').value = '';
            setFilterMode('all');
            window.switchView('contacts');
        } else alert('Pflichtfelder fehlen!');
    });
    document.getElementById('btn-prev-month').addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1); renderCalendar(); });
    document.getElementById('btn-next-month').addEventListener('click', () => { currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1); renderCalendar(); });
}

document.addEventListener('DOMContentLoaded', () => {
    initTheme();
    loadData();
    renderApp();
    setupEventListeners();
    const last = localStorage.getItem('bm_last_view');
    if (last) window.switchView(last);
});
