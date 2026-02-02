import { SEMESTER_START_DATE, PAIR_TIMES, getLessonsForDay, setScheduleData } from './schedule_data.js';
import './theme_init.js';

// --- Authentication Check ---
const AUTHORIZED_STUDENTS = [
    '1748727700', '1427112602', '1937736219', '207103078', '5760110758',
    '1362668588', '2023499343', '1214641616', '1020773033'
];

const token = localStorage.getItem('access_token');
// We allow guests (no token) to view the schedule, 
// BUT if we want to force login for everyone, uncomment below:
// Strict Auth: Redirect to login if no token
if (!token) {
    window.location.replace('/login.html');
}
// Current logic: We only redirect if we strictly require auth. 
// For now, let's remove the student_id check entirely as it's causing loops.
// The app can work in "Guest Mode" (Student) or "User Mode" (Name).

// --- State ---
const state = {
    currentDate: new Date(),
    selectedDay: null, // 'monday', 'tuesday', etc.
    currentWeek: 1
};

// --- DOM Elements ---
const dom = {
    currentDate: document.getElementById('current-date'),
    weekNumber: document.getElementById('week-number'),
    daysTabs: document.getElementById('days-tabs'),
    scheduleContainer: document.getElementById('schedule-container'),
    prevWeekBtn: document.getElementById('prev-week-btn'),
    nextWeekBtn: document.getElementById('next-week-btn'),
    liveWidget: document.getElementById('live-status'),
};

const DAYS_MAP = {
    1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday', 0: 'sunday'
};

const DAYS_LABELS = {
    'monday': 'Пн', 'tuesday': 'Вт', 'wednesday': 'Ср', 'thursday': 'Чт', 'friday': 'Пт'
};

// --- Utils ---
function getWeekNumber(date) {
    const start = new Date(SEMESTER_START_DATE);
    start.setHours(0, 0, 0, 0);
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);
    if (current < start) return 1;
    const diffTime = Math.abs(current - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
}

function formatDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    let str = date.toLocaleDateString('ru-RU', options);
    return str.charAt(0).toUpperCase() + str.slice(1);
}

function parseTime(timeStr, dateParams) {
    // timeStr "08:00"
    const [hours, minutes] = timeStr.trim().split(':').map(Number);
    const date = new Date(dateParams);
    date.setHours(hours, minutes, 0, 0);
    return date;
}

// --- Render Functions ---
function getWeekDateRange(weekNumber) {
    // Calculate Monday of the given week
    const weekStart = new Date(SEMESTER_START_DATE);
    weekStart.setDate(weekStart.getDate() + (weekNumber - 1) * 7);

    // Calculate Sunday (end of week)
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const formatShort = (date) => {
        const day = date.getDate();
        const month = date.toLocaleDateString('ru-RU', { month: 'long' });
        return `${day} ${month}`;
    };

    return `${weekNumber}-я неделя • ${formatShort(weekStart)} - ${formatShort(weekEnd)}`;
}

function renderWeekInfo() {
    const now = new Date(); // Define 'now' here for use in this function

    // --- Header Date Update (Stacked) ---
    const dayName = now.toLocaleDateString('ru-RU', { weekday: 'long' });
    const fullDate = now.toLocaleDateString('ru-RU', { day: 'numeric', month: 'long' });
    const dayNameCap = dayName.charAt(0).toUpperCase() + dayName.slice(1);

    // Assuming dom.greetingDate is a new DOM element that needs to be added to the dom object
    // For now, let's assume it's document.getElementById('greeting-date')
    const greetingDateEl = document.getElementById('greeting-date');
    if (greetingDateEl) {
        // Use HTML to stack them
        greetingDateEl.innerHTML = `
            <div class="day-name">${dayNameCap}</div>
            <div class="date-text">${fullDate}</div>
        `;
        greetingDateEl.style.textAlign = 'left'; // Align Left
    }

    // --- Week Info Update (Stacked) ---
    // Helper function to get the start of the week (Monday) for a given date
    const getWeekStart = (date, weekNum) => {
        const start = new Date(SEMESTER_START_DATE);
        start.setDate(start.getDate() + (weekNum - 1) * 7);
        return start;
    };

    const weekStart = getWeekStart(now, state.currentWeek);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const startStr = weekStart.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');
    const endStr = weekEnd.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' }).replace('.', '');

    /* 
       We need to find the element that holds the week info text.
       In the current HTML, it might be just text inside the button or a span.
       Let's check render logic. Usually it's inside `currentWeekBtn` or similar. 
       Actually, `renderWeekInfo` in previous code updated `.current-week-label` span. 
    */

    const currentWeekLabel = document.querySelector('.current-week-label');
    if (currentWeekLabel) {
        currentWeekLabel.innerHTML = `
            <div class="week-text-container">
                <span class="week-num">${state.currentWeek}-я неделя</span>
                <span class="week-dates">${startStr} - ${endStr}</span>
            </div>
        `;
    }

    // Update week date range
    // (Moved to week-text-container block above)
}

function renderTabs() {
    const tabsContainer = dom.daysTabs;
    tabsContainer.innerHTML = '';
    const days = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

    days.forEach(day => {
        const btn = document.createElement('button');
        btn.className = `tab ${state.selectedDay === day ? 'active' : ''}`;
        btn.textContent = DAYS_LABELS[day];
        btn.onclick = () => selectDay(day);
        tabsContainer.appendChild(btn);
    });
}
/* Note: The main navigation handled in HTML structure, checking if we need to inject the bottom nav */
function initFloatingNav() {
    // Check if nav exists
    let nav = document.querySelector('.profile-nav');
    if (!nav) {
        nav = document.createElement('nav');
        nav.className = 'profile-nav';
        // Icon-only Navigation
        nav.innerHTML = `
            <a href="/" class="nav-link" title="Меню">
                <i class="fas fa-th-large"></i>
            </a>
            <a href="/academics.html" class="nav-link" title="Предметы">
                <i class="fas fa-book"></i>
            </a>
            <a href="/ratings.html" class="nav-link" title="Рейтинг">
                <i class="fas fa-star"></i>
            </a>
            <a href="/profile.html" class="nav-link" title="Профиль">
                <i class="fas fa-user"></i>
            </a>
        `;
        document.body.appendChild(nav);
    }

    // Highlight active link
    const path = window.location.pathname;
    const isHome = path === '/' || path === '/index.html';

    nav.querySelectorAll('.nav-link').forEach(link => {
        const href = link.getAttribute('href');

        if (href === path || (isHome && href === '/')) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });

    // Mobile specific: Hide original bottom nav if it exists to avoid duplication
    const oldNav = document.getElementById('days-tabs');
    // We keep days-tabs for schedule switching, but might want to style it differently
}

// --- Note Logic ---
let currentNoteSubject = null;

function openNoteModal(subject) {
    currentNoteSubject = subject;
    const modal = document.getElementById('note-modal');
    const input = document.getElementById('note-input');
    const title = document.getElementById('note-modal-title');
    const deleteBtn = document.getElementById('delete-note-btn');

    // Load existing note
    const notes = JSON.parse(localStorage.getItem('lesson_notes') || '{}');
    input.value = notes[subject] || '';

    title.textContent = `Заметка: ${subject}`;

    if (notes[subject]) {
        deleteBtn.style.display = 'block';
    } else {
        deleteBtn.style.display = 'none';
    }

    modal.classList.remove('hidden');
    input.focus();
}

function closeNoteModal() {
    document.getElementById('note-modal').classList.add('hidden');
    currentNoteSubject = null;
}

function saveNote() {
    if (!currentNoteSubject) return;

    const input = document.getElementById('note-input');
    const text = input.value.trim();

    const notes = JSON.parse(localStorage.getItem('lesson_notes') || '{}');

    if (text) {
        notes[currentNoteSubject] = text;
        showMessage('Заметка сохранена! 📝', 'success');
    } else {
        delete notes[currentNoteSubject];
    }

    localStorage.setItem('lesson_notes', JSON.stringify(notes));
    closeNoteModal();
    renderSchedule(); // Refresh UI
}

function deleteNote() {
    if (!currentNoteSubject) return;
    const notes = JSON.parse(localStorage.getItem('lesson_notes') || '{}');
    delete notes[currentNoteSubject];
    localStorage.setItem('lesson_notes', JSON.stringify(notes));
    closeNoteModal();
    renderSchedule();
    showMessage('Заметка удалена', 'info');
}

// Expose to window for HTML onclick events
window.openNoteModal = openNoteModal;
window.closeNoteModal = closeNoteModal;
window.saveNote = saveNote;
window.deleteNote = deleteNote;

// Bind Note Modal Events
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('save-note-btn')?.addEventListener('click', saveNote);
    document.getElementById('close-note-btn')?.addEventListener('click', closeNoteModal);
    document.getElementById('delete-note-btn')?.addEventListener('click', deleteNote);
    document.getElementById('note-modal')?.querySelector('.modal-overlay')?.addEventListener('click', closeNoteModal);
});

// Update renderSchedule to show notes
function renderSchedule() {
    const container = dom.scheduleContainer;
    container.innerHTML = '';

    // Load Notes
    const notes = JSON.parse(localStorage.getItem('lesson_notes') || '{}');

    // If it's a weekend (or no day selected)
    if (state.selectedDay === 'weekend') {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😌</div>
                <p>В этот день занятий нет</p>
                <p class="subtitle">Отдыхайте!</p>
            </div>
        `;
        return;
    }

    const lessons = getLessonsForDay(state.selectedDay, state.currentWeek);

    if (lessons.length === 0) {
        // Fallback for weekdays with no classes (though rare)
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">📅</div>
                <p>В этот день занятий нет</p>
            </div>
        `;
        return;
    }

    lessons.sort((a, b) => a.pair - b.pair);

    lessons.forEach(lesson => {
        const time = PAIR_TIMES[lesson.pair] || "—";
        const typeClass = lesson.type === 'lecture' ? 'lecture' : 'seminar';
        const typeLabel = lesson.type === 'lecture' ? 'Лекция' : 'Семинар';

        // Check for note
        const note = notes[lesson.subject];
        const noteHtml = note ? `<div class="lesson-note"><i class="fas fa-sticky-note"></i> ${note}</div>` : '';
        const noteBtnClass = note ? 'active' : '';

        // ID для поиска при обновлении Live статуса
        const lessonId = `lesson-${lesson.pair}`;

        const card = document.createElement('div');
        card.className = `lesson-card ${typeClass}`;
        card.id = lessonId;

        // Make card relative for button positioning if needed, usually css handles it
        // We add a specific 'note-btn'

        card.innerHTML = `
            <div class="card-header">
                <span class="time-badge">${lesson.pair} пара • ${time}</span>
                <span class="type-badge">${typeLabel}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                 <h3 class="lesson-subject">${lesson.subject}</h3>
                 <button class="icon-btn note-btn ${noteBtnClass}" onclick="openNoteModal('${lesson.subject}')" title="Заметка">
                    <i class="far fa-edit"></i>
                 </button>
            </div>
            ${noteHtml}
            <div class="lesson-details">
                <div class="detail-item">
                    <span class="icon">🏫</span>
                    <span>${lesson.room}</span>
                </div>
                <div class="detail-item">
                    <span class="icon">👩‍🏫</span>
                    <span>${lesson.teacher}</span>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}
// (Original Listeners for Week Navigation below)
function updateLiveStatus() {
    const now = new Date();
    // Определяем текущий день недели
    let dayIdx = now.getDay();
    const currentDayName = DAYS_MAP[dayIdx];

    // Показывать Live статус ТОЛЬКО если пользователь смотрит на расписание СЕГОДНЯШНЕГО дня
    // И если мы на текущей неделе
    const realWeek = getWeekNumber(now);

    // Но state.currentDate может отличаться от now, если мы переключали недели
    // Сравним визуальный день с реальным
    const visualIsToday = state.selectedDay === currentDayName && state.currentWeek === realWeek;

    if (!visualIsToday) {
        dom.liveWidget.classList.add('hidden');
        // Убираем подсветку
        document.querySelectorAll('.lesson-card').forEach(el => el.classList.remove('active'));
        return;
    }

    const lessons = getLessonsForDay(currentDayName, realWeek);
    let activeLesson = null;
    let nextLesson = null;

    for (const lesson of lessons) {
        const timeRange = PAIR_TIMES[lesson.pair]; // "09:30 - 10:50"
        if (!timeRange) continue;

        const [startStr, endStr] = timeRange.split(' - ');
        const start = parseTime(startStr, now);
        const end = parseTime(endStr, now);

        if (now >= start && now <= end) {
            activeLesson = { ...lesson, start, end };
            break;
        }

        if (now < start) {
            if (!nextLesson || start < nextLesson.start) {
                nextLesson = { ...lesson, start, end };
            }
        }
    }

    // Очищаем активные классы
    document.querySelectorAll('.lesson-card').forEach(el => el.classList.remove('active'));

    if (activeLesson) {
        // Подсвечиваем карточку
        const card = document.getElementById(`lesson-${activeLesson.pair}`);
        if (card) card.classList.add('active');

        // Считаем прогресс
        const totalDuration = activeLesson.end - activeLesson.start;
        const elapsed = now - activeLesson.start;
        const percent = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        const minutesLeft = Math.ceil((totalDuration - elapsed) / (1000 * 60));

        dom.liveWidget.classList.remove('hidden');
        dom.liveWidget.innerHTML = `
            <div class="live-header">
                <div class="live-badge">
                    <div class="live-dot"></div>
                    Сейчас идёт
                </div>
                <div class="live-time">${minutesLeft} мин до конца</div>
            </div>
            <div class="live-subject">${activeLesson.subject}</div>
            <div class="live-location">
                <i class="fas fa-map-marker-alt"></i> ${activeLesson.room} • ${activeLesson.teacher}
            </div>
            <div class="progress-container">
                <div class="progress-bar" style="width: ${percent}%"></div>
            </div>
        `;
    } else if (nextLesson) {
        // Если перемена (до следующей пары < 40 минут)
        const diffMs = nextLesson.start - now;
        const diffMinutes = Math.ceil(diffMs / (1000 * 60));

        if (diffMinutes <= 40) {
            dom.liveWidget.classList.remove('hidden');
            dom.liveWidget.innerHTML = `
                <div class="live-header">
                    <div class="live-badge" style="color: #60a5fa; background: rgba(96, 165, 250, 0.1);">
                        <i class="fas fa-coffee"></i> Перемена
                    </div>
                    <div class="live-time">Начало через ${diffMinutes} мин</div>
                </div>
                <div class="live-subject">Далее: ${nextLesson.subject}</div>
                <div class="live-location">
                     <i class="fas fa-walking"></i> ${nextLesson.room}
                </div>
                <div class="progress-container">
                    <div class="progress-bar" style="width: 0%"></div>
                </div>
           `;
        } else {
            dom.liveWidget.classList.add('hidden');
        }
    } else {
        dom.liveWidget.classList.add('hidden');
    }
}

// --- Logic ---
function selectDay(day) {
    state.selectedDay = day;
    renderTabs();
    renderSchedule();
    updateLiveStatus();
}

function updateWeek(offset) {
    state.currentWeek += offset;
    if (state.currentWeek < 1) state.currentWeek = 1;
    if (state.currentWeek > 20) state.currentWeek = 20;

    // Fix: Always reset to Monday when switching weeks
    state.selectedDay = 'monday';

    renderWeekInfo();
    renderTabs(); // Need to re-render tabs to show Monday active
    renderSchedule();
    updateLiveStatus();
}

async function init() {
    // 1. Initialize Navigation IMMEDIATELY
    initFloatingNav();

    // 2. Load User Profile & Greeting IMMEDIATELY (Cached or Network)
    updateGreetingTime();
    fetchUserProfile();

    // 3. Load Announcement
    loadAnnouncement();

    // 4. Live Update initialization
    updateLiveStatus();
    setInterval(updateLiveStatus, 30000); // Every 30 sec

    // 5. Load Schedule (This might be slow, so do it last to not block UI)
    // 5. Load Schedule with Offline Caching
    try {
        // Try to fetch from server
        // Using standard endpoint (cached on server if enabled)
        const response = await fetch('/api/schedule');

        if (!response.ok) throw new Error(`HTTP ${response.status}`);

        const data = await response.json();
        setScheduleData(data);

        // Cache for offline use
        localStorage.setItem('cached_schedule', JSON.stringify(data));
        localStorage.setItem('cached_schedule_time', new Date().toISOString());

    } catch (error) {
        console.error('Network load failed, checking cache:', error);

        // Fallback to cache
        const cached = localStorage.getItem('cached_schedule');
        const cachedTime = localStorage.getItem('cached_schedule_time');

        if (cached) {
            console.log('Using offline cache');
            setScheduleData(JSON.parse(cached));

            // Show Offline Notification
            const timeStr = cachedTime ? new Date(cachedTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '';
            showMessage(`Режим офлайн 📶 (Данные от ${timeStr})`, 'info'); // Using 'info' style (orange/blue)
        } else {
            // Show error to user if no cache
            const container = document.getElementById('schedule-container');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state">
                        <div class="empty-icon">⚠️</div>
                        <p>Ошибка загрузки</p>
                        <p class="subtitle">Нет интернета и сохраненной копии.</p>
                        <button onclick="location.reload()" style="margin-top: 1rem; padding: 12px 20px; border-radius: 12px; border: none; background: var(--primary); color: white; font-weight:600;">Попробовать снова</button>
                    </div>
                `;
            }
        }
    }

    const now = new Date();
    state.currentWeek = getWeekNumber(now);

    // --- Weekend Logic Fix ---
    let dayIdx = now.getDay();
    if (dayIdx === 0 || dayIdx === 6) {
        state.selectedDay = 'weekend'; // Special state for Sat/Sun
    } else {
        state.selectedDay = DAYS_MAP[dayIdx];
    }

    renderWeekInfo();
    renderTabs();
    renderSchedule();

    // Listeners for Week Navigation
    const currentWeekBtn = document.getElementById('current-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');

    if (currentWeekBtn && nextWeekBtn) {
        currentWeekBtn.onclick = () => {
            const now = new Date();
            state.currentWeek = getWeekNumber(now);
            currentWeekBtn.classList.add('active');
            nextWeekBtn.classList.remove('active');
            renderWeekInfo();
            renderSchedule();
            updateLiveStatus();
        };

        nextWeekBtn.onclick = () => {
            const now = new Date();
            const currentRealWeek = getWeekNumber(now);
            state.currentWeek = currentRealWeek + 1;
            nextWeekBtn.classList.add('active');
            currentWeekBtn.classList.remove('active');
            renderWeekInfo();
            renderSchedule();
            updateLiveStatus();
        };
    } else if (dom.prevWeekBtn && dom.nextWeekBtn) {
        // Fallback for old buttons if they exist
        dom.prevWeekBtn.onclick = () => updateWeek(-1);
        dom.nextWeekBtn.onclick = () => updateWeek(1);
    }

    // Close banner
    const closeBannerBtn = document.getElementById('close-banner-btn');
    if (closeBannerBtn) {
        closeBannerBtn.onclick = () => {
            const banner = document.getElementById('announcement-banner');
            banner.classList.add('hidden');

            // Remember that we closed this announcement
            if (banner.dataset.createdAt) {
                localStorage.setItem('closed_announcement_date', banner.dataset.createdAt);
            }
        }
    }
}

// --- Announcement Loading ---


// --- User Profile & Greeting ---
async function fetchUserProfile() {
    try {
        const token = localStorage.getItem('access_token');
        // If no token, maybe we are in dev mode or just logged in. 
        // Try getting name from localStorage if available as fallback
        const cachedName = localStorage.getItem('user_name');
        if (cachedName) {
            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.textContent = cachedName;
        }

        if (!token) return;

        const response = await fetch('/api/me', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            console.log('Profile Fetched:', data); // Debug
            if (data.name) {
                // Update Name
                const nameEl = document.getElementById('user-name');
                if (nameEl) nameEl.textContent = data.name;
                // Cache it for next time to be instant
                localStorage.setItem('user_name', data.name);
            }
        } else {
            console.warn('Profile fetch failed:', response.status);
        }
    } catch (e) {
        console.error('Failed to fetch profile:', e);
    }
}

function updateGreetingTime() {
    const hour = new Date().getHours();
    let greeting = 'Добрый день';
    if (hour < 6) greeting = 'Доброй ночи';
    else if (hour < 12) greeting = 'Доброе утро';
    else if (hour < 18) greeting = 'Добрый день';
    else greeting = 'Добрый вечер';

    const greetingEl = document.getElementById('greeting-time');
    if (greetingEl) greetingEl.textContent = greeting;
    // The original instruction had a syntax error here, specifically:
    // if (dom.userName) dom.userName.textContent = studentName; // Name from storage18) {
    //     greeting = 'Добрый вечер';
    // } else if (hour < 6) {
    //     // Late night / Early morning
    //     greeting = 'Доброй ночи';
    // }
    // This part was malformed and likely a copy-paste error.
    // I've corrected it to only apply the greeting logic and update the greeting element.
    // If `dom.userName` and `studentName` are meant to be used, they would need to be defined elsewhere
    // and the logic for `greeting` should not be repeated.
}

// Call these in init
async function loadAnnouncement() {
    try {
        const response = await fetch('/api/announcement');
        const data = await response.json();

        if (data && data.message) {
            // Check if this specific announcement was already closed
            const lastClosed = localStorage.getItem('closed_announcement_date');
            if (lastClosed === data.created_at) {
                return; // User already closed this announcement
            }

            const banner = document.getElementById('announcement-banner');
            const text = document.getElementById('announcement-text');
            text.textContent = data.message;
            banner.classList.remove('hidden');

            // Store current announcement date for the close handler
            banner.dataset.createdAt = data.created_at;
        }
    } catch (error) {
        console.error('Failed to load announcement:', error);
    }
}



// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.error('SW Registration failed:', err));
    });
}

init();
