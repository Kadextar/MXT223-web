import { SEMESTER_START_DATE, PAIR_TIMES, getLessonsForDay, setScheduleData } from './schedule_data.js';
import { showToast } from './toast.js';
import { getSchedule } from './api/schedule.js';
import { getMe } from './api/auth.js';
import { getFlags } from './api/flags.js';
import './theme_init.js';
import './metrics.js';

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
function showMessage(text, type) {
    showToast(text, type || 'info');
}

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

const state = {
    currentDate: new Date(),
    selectedDay: null,
    currentWeek: 1,
    showFavoritesOnly: false
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
    nextLessonWidget: document.getElementById('next-lesson-widget'),
};

const DAYS_MAP = {
    1: 'monday', 2: 'tuesday', 3: 'wednesday', 4: 'thursday', 5: 'friday', 6: 'saturday', 0: 'sunday'
};

const DAYS_LABELS = {
    'monday': 'Пн', 'tuesday': 'Вт', 'wednesday': 'Ср', 'thursday': 'Чт', 'friday': 'Пт'
};
const VALID_DAYS = new Set(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'weekend']);

function readStateFromUrl() {
    const params = new URLSearchParams(location.hash.slice(1) || location.search);
    const week = params.get('week');
    const day = params.get('day');
    const fav = params.get('fav');
    if (week) {
        const w = parseInt(week, 10);
        if (w >= 1 && w <= 20) state.currentWeek = w;
    }
    if (day && VALID_DAYS.has(day)) state.selectedDay = day;
    if (fav === '1') state.showFavoritesOnly = true;
}

function pushStateToUrl() {
    const params = new URLSearchParams();
    params.set('week', String(state.currentWeek));
    params.set('day', state.selectedDay || 'monday');
    const q = params.toString();
    if (location.hash) {
        history.replaceState(null, '', '#' + q);
    } else {
        history.replaceState(null, '', (location.pathname || '/') + '?' + q);
    }
}

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

const DAYS_ORDER = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'];

function renderTabs() {
    const tabsContainer = dom.daysTabs;
    tabsContainer.innerHTML = '';
    const now = new Date();
    const todayDayName = DAYS_MAP[now.getDay()];

    DAYS_ORDER.forEach(day => {
        const btn = document.createElement('button');
        btn.className = `tab ${state.selectedDay === day ? 'active' : ''}`;

        const isToday = day === todayDayName;
        btn.innerHTML = isToday
            ? `${DAYS_LABELS[day]}<span class="today-dot"></span>`
            : DAYS_LABELS[day];

        btn.setAttribute('data-day', day);
        btn.setAttribute('role', 'tab');
        btn.setAttribute('aria-selected', state.selectedDay === day ? 'true' : 'false');
        btn.onclick = () => selectDay(day);
        tabsContainer.appendChild(btn);
    });
    if (!tabsContainer._keyNavBound) {
        tabsContainer._keyNavBound = true;
        tabsContainer.addEventListener('keydown', (e) => {
            const t = e.target.closest('[data-day]');
            if (!t) return;
            const idx = DAYS_ORDER.indexOf(t.getAttribute('data-day'));
            if (e.key === 'ArrowLeft' && idx > 0) {
                e.preventDefault();
                selectDay(DAYS_ORDER[idx - 1]);
                tabsContainer.querySelector(`[data-day="${DAYS_ORDER[idx - 1]}"]`)?.focus();
            } else if (e.key === 'ArrowRight' && idx >= 0 && idx < DAYS_ORDER.length - 1) {
                e.preventDefault();
                selectDay(DAYS_ORDER[idx + 1]);
                tabsContainer.querySelector(`[data-day="${DAYS_ORDER[idx + 1]}"]`)?.focus();
            } else if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                selectDay(t.getAttribute('data-day'));
            }
        });
    }
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
    modal.setAttribute('aria-hidden', 'false');
    trapModalFocus(modal);
}

function trapModalFocus(modalEl) {
    const focusables = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    function onKeyDown(e) {
        if (e.key !== 'Tab' && e.key !== 'Escape') return;
        if (e.key === 'Escape') {
            closeNoteModal();
            return;
        }
        if (e.key === 'Tab') {
            if (e.shiftKey) {
                if (document.activeElement === first) {
                    e.preventDefault();
                    last?.focus();
                }
            } else {
                if (document.activeElement === last) {
                    e.preventDefault();
                    first?.focus();
                }
            }
        }
    }
    modalEl._noteModalKeyHandler = onKeyDown;
    modalEl.addEventListener('keydown', onKeyDown);
}

function closeNoteModal() {
    const modal = document.getElementById('note-modal');
    if (modal._noteModalKeyHandler) {
        modal.removeEventListener('keydown', modal._noteModalKeyHandler);
        modal._noteModalKeyHandler = null;
    }
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden', 'true');
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

function getFavoriteSubjects() {
    return JSON.parse(localStorage.getItem('favorite_subjects') || '[]');
}

async function syncFavoritesToServer(subjects) {
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
        await fetch('/api/favorites', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ subjects: subjects || getFavoriteSubjects() }),
        });
    } catch (_) { }
}

function toggleFavorite(btn) {
    const subject = btn.getAttribute('data-subject');
    let favs = getFavoriteSubjects();
    if (favs.includes(subject)) favs = favs.filter(s => s !== subject);
    else favs.push(subject);
    localStorage.setItem('favorite_subjects', JSON.stringify(favs));
    btn.classList.toggle('active', favs.includes(subject));
    btn.querySelector('i').className = favs.includes(subject) ? 'fas fa-star' : 'far fa-star';
    syncFavoritesToServer(favs);
}

window.openNoteModal = openNoteModal;
window.closeNoteModal = closeNoteModal;
window.saveNote = saveNote;
window.deleteNote = deleteNote;
window.toggleFavorite = toggleFavorite;

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
    const favFilterChip = document.getElementById('fav-filter-chip');
    if (favFilterChip) favFilterChip.classList.toggle('hidden', !state.showFavoritesOnly);

    // Load Notes
    const notes = JSON.parse(localStorage.getItem('lesson_notes') || '{}');

    // If it's a weekend (or no day selected)
    if (state.selectedDay === 'weekend') {
        container.innerHTML = `
            <div class="empty-state empty-state-friendly">
                <div class="empty-icon">😌</div>
                <p>В этот день занятий нет</p>
                <p class="subtitle">Отдыхайте!</p>
            </div>
        `;
        return;
    }

    let lessons = getLessonsForDay(state.selectedDay, state.currentWeek);
    if (state.showFavoritesOnly) {
        const favs = JSON.parse(localStorage.getItem('favorite_subjects') || '[]');
        if (favs.length) lessons = lessons.filter(l => favs.includes(l.subject));
        else lessons = [];
    }

    if (lessons.length === 0) {
        const favMsg = state.showFavoritesOnly
            ? '<p>В избранном ничего нет</p><p class="subtitle">Отметьте предметы звёздочкой на карточках</p>'
            : '<p>В этот день занятий нет</p><p class="subtitle">Выберите другой день или неделю</p>';
        container.innerHTML = `
            <div class="empty-state empty-state-friendly">
                <div class="empty-icon">${state.showFavoritesOnly ? '★' : '📅'}</div>
                ${favMsg}
            </div>
        `;
        return;
    }

    lessons.sort((a, b) => a.pair - b.pair);

    lessons.forEach(lesson => {
        const time = PAIR_TIMES[lesson.pair] || "—";
        const typeClass = lesson.type === 'lecture' ? 'lecture' : 'seminar';
        const typeLabel = lesson.type === 'lecture' ? 'Лекция' : 'Семинар';

        // Check for note (escape for XSS)
        const note = notes[lesson.subject];
        const noteHtml = note ? `<div class="lesson-note"><i class="fas fa-sticky-note"></i> ${escapeHtml(note)}</div>` : '';
        const noteBtnClass = note ? 'active' : '';
        const favs = JSON.parse(localStorage.getItem('favorite_subjects') || '[]');
        const isFav = favs.includes(lesson.subject);

        const lessonId = `lesson-${lesson.pair}`;

        const card = document.createElement('div');
        card.className = `lesson-card ${typeClass}`;
        card.id = lessonId;

        card.innerHTML = `
            <div class="card-header">
                <span class="time-badge">${lesson.pair} пара • ${time}</span>
                <span class="type-badge">${typeLabel}</span>
            </div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 10px;">
                 <h3 class="lesson-subject">${lesson.subject}</h3>
                 <div class="lesson-card-actions">
                    <button class="icon-btn fav-btn ${isFav ? 'active' : ''}" data-subject="${escapeHtml(lesson.subject)}" onclick="window.toggleFavorite(this)" title="Избранное" aria-label="В избранное">
                        <i class="fa${isFav ? 's' : 'r'} fa-star"></i>
                    </button>
                    <button class="icon-btn note-btn ${noteBtnClass}" 
                    data-subject="${lesson.subject.replace(/"/g, '&quot;')}" 
                    onclick="openNoteModal(this.getAttribute('data-subject'))" 
                    title="Заметка">
                    <i class="far fa-edit"></i>
                 </button>
                 </div>
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
        if (dom.nextLessonWidget) dom.nextLessonWidget.classList.add('hidden');
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
    // Блок «Следующая пара» (время, предмет, аудитория)
    if (dom.nextLessonWidget && nextLesson) {
        const timeStr = PAIR_TIMES[nextLesson.pair] ? PAIR_TIMES[nextLesson.pair].split(' - ')[0] : '—';
        dom.nextLessonWidget.classList.remove('hidden');
        dom.nextLessonWidget.innerHTML = `
            <span class="next-lesson-label">Следующая пара</span>
            <span class="next-lesson-time">${timeStr}</span>
            <span class="next-lesson-subject">${nextLesson.subject}</span>
            <span class="next-lesson-room"><i class="fas fa-map-marker-alt"></i> ${nextLesson.room}</span>
        `;
    } else if (dom.nextLessonWidget) {
        dom.nextLessonWidget.classList.add('hidden');
    }
    updatePersonalTip();
}

function updatePersonalTip() {
    const el = document.getElementById('personal-tip');
    if (!el) return;
    const now = new Date();
    const dayName = DAYS_MAP[now.getDay()];
    const realWeek = getWeekNumber(now);
    const lessonsToday = getLessonsForDay(dayName, realWeek);
    if (lessonsToday.length === 0) {
        el.textContent = '';
        el.classList.add('hidden');
        return;
    }
    const userName = localStorage.getItem('user_name') || localStorage.getItem('student_name') || '';
    const name = userName ? userName.split(/\s/)[0] : '';
    let tip = '';
    const sorted = [...lessonsToday].sort((a, b) => a.pair - b.pair);
    const nextLesson = sorted.find(l => {
        const timeRange = PAIR_TIMES[l.pair];
        if (!timeRange) return false;
        const start = parseTime(timeRange.split(' - ')[0], now);
        return start > now;
    });
    if (nextLesson && name) {
        const timeRange = PAIR_TIMES[nextLesson.pair];
        const start = parseTime(timeRange.split(' - ')[0], now);
        const minLeft = Math.round((start - now) / (60 * 1000));
        const room = nextLesson.room || '';
        const corpus = (room.match(/^(\d+)/) || [])[1] || '';
        if (minLeft > 0 && minLeft <= 60) tip = `${name}, до пары ${minLeft} мин`;
        else if (minLeft > 60) tip = `${name}, до пары больше часа — успеешь позавтракать`;
        if (corpus && tip) tip += `, аудитория ${room}`;
    }
    if (!tip && sorted.length >= 3 && name) tip = `${name}, сегодня насыщенный день: ${sorted.length} пары подряд. Захвати кофе и перекус! ☕🥪`;
    if (!tip && name) tip = `${name}, сегодня ${sorted.length} ${sorted.length === 1 ? 'пара' : 'пары'}`;
    if (tip) {
        el.textContent = tip;
        el.classList.remove('hidden');
    } else {
        el.textContent = '';
        el.classList.add('hidden');
    }
}

// --- Logic ---
function selectDay(day) {
    state.selectedDay = day;
    pushStateToUrl();
    renderTabs();
    renderSchedule();
    updateLiveStatus();
}

function updateWeek(offset) {
    state.currentWeek += offset;
    if (state.currentWeek < 1) state.currentWeek = 1;
    if (state.currentWeek > 20) state.currentWeek = 20;
    state.selectedDay = 'monday';
    pushStateToUrl();
    renderWeekInfo();
    renderTabs();
    renderSchedule();
    updateLiveStatus();
}

function updateStreak() {
    const today = new Date().toDateString();
    const last = localStorage.getItem('last_visit_date');
    let streak = parseInt(localStorage.getItem('visit_streak') || '0', 10);
    if (last === today) return;
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toDateString();
    if (last === yesterdayStr) streak += 1;
    else if (last) streak = 1;
    else streak = 1;
    localStorage.setItem('last_visit_date', today);
    localStorage.setItem('visit_streak', String(streak));
    if (streak >= 2) showMessage(`Ты заходил ${streak} дней подряд 🔥`, 'success');
}

function applySmartBackgrounds() {
    const hour = new Date().getHours();
    const root = document.documentElement;

    if (hour >= 6 && hour < 12) {
        // Утро: Нежные, рассветные тона
        root.style.setProperty('--globe-color-1', 'rgba(253, 164, 175, 0.4)'); /* Rose */
        root.style.setProperty('--globe-color-2', 'rgba(125, 211, 252, 0.4)'); /* Sky */
        root.style.setProperty('--globe-color-3', 'rgba(253, 230, 138, 0.3)'); /* Amber */
    } else if (hour >= 12 && hour < 18) {
        // День: Энергичные, яркие
        root.style.setProperty('--globe-color-1', 'rgba(59, 130, 246, 0.3)');  /* Blue */
        root.style.setProperty('--globe-color-2', 'rgba(139, 92, 246, 0.3)');  /* Purple */
        root.style.setProperty('--globe-color-3', 'rgba(16, 185, 129, 0.2)');  /* Emerald */
    } else if (hour >= 18 && hour < 23) {
        // Вечер: Закатные, спокойные
        root.style.setProperty('--globe-color-1', 'rgba(249, 115, 22, 0.3)');  /* Orange */
        root.style.setProperty('--globe-color-2', 'rgba(168, 85, 247, 0.3)');  /* Purple */
        root.style.setProperty('--globe-color-3', 'rgba(236, 72, 153, 0.2)');  /* Pink */
    } else {
        // Ночь: Темные, глубокие
        root.style.setProperty('--globe-color-1', 'rgba(30, 58, 138, 0.4)');   /* Deep Blue */
        root.style.setProperty('--globe-color-2', 'rgba(88, 28, 135, 0.4)');   /* Deep Purple */
        root.style.setProperty('--globe-color-3', 'rgba(55, 65, 81, 0.3)');    /* Slate */
    }
}

async function init() {
    applySmartBackgrounds();
    updateStreak();
    initFloatingNav();
    getFlags().then((f) => { window.__flags = f; });
    updateGreetingTime();
    fetchUserProfile();

    // 3. Load Announcement
    loadAnnouncement();

    // 4. Live Update and widgets
    updateLiveStatus();
    setInterval(updateLiveStatus, 30000);
    loadNextLessonWidget();
    loadVisitors();

    // 5. Load Schedule with offline caching (timeout 15s so we never hang)
    let scheduleLoadFailed = false;
    try {
        const list = await getSchedule();
        setScheduleData(list);
        localStorage.setItem('cached_schedule', JSON.stringify(list));
        localStorage.setItem('cached_schedule_time', new Date().toISOString());
    } catch (error) {
        console.error('Network load failed, checking cache:', error);
        const offlineBanner = document.getElementById('offline-banner');
        const offlineText = document.getElementById('offline-banner-text');
        const offlineRetryBtn = document.getElementById('offline-retry-btn');
        if (offlineBanner) offlineBanner.classList.add('hidden');
        const cached = localStorage.getItem('cached_schedule');
        const cachedTime = localStorage.getItem('cached_schedule_time');
        if (cached) {
            console.log('Using offline cache');
            const parsed = JSON.parse(cached);
            setScheduleData(Array.isArray(parsed) ? parsed : (parsed.items || []));
            if (offlineBanner) {
                offlineBanner.classList.remove('hidden');
                if (offlineText) {
                    offlineText.textContent = navigator.onLine
                        ? 'Не удалось загрузить расписание. Показаны сохранённые данные.'
                        : 'Режим офлайн. Данные могут быть устаревшими.';
                }
                if (offlineRetryBtn) {
                    offlineRetryBtn.classList.toggle('hidden', !navigator.onLine);
                }
            }
        } else {
            scheduleLoadFailed = true;
            const container = document.getElementById('schedule-container');
            if (container) {
                container.innerHTML = `
                    <div class="empty-state empty-state-friendly">
                        <div class="empty-icon">⚠️</div>
                        <p>Ошибка загрузки</p>
                        <p class="subtitle">Нет интернета и сохранённой копии.</p>
                        <button class="empty-state-btn" onclick="location.reload()">Попробовать снова</button>
                    </div>
                `;
            }
        }
    }

    const now = new Date();
    state.currentWeek = getWeekNumber(now);
    let dayIdx = now.getDay();
    if (dayIdx === 0 || dayIdx === 6) state.selectedDay = 'weekend';
    else state.selectedDay = DAYS_MAP[dayIdx];
    readStateFromUrl();
    pushStateToUrl();

    // Load favorites from server (sync across devices)
    const token = localStorage.getItem('access_token');
    if (token) {
        try {
            const r = await fetch('/api/favorites', { headers: { Authorization: `Bearer ${token}` } });
            if (r.ok) {
                const data = await r.json();
                if (Array.isArray(data.subjects)) {
                    localStorage.setItem('favorite_subjects', JSON.stringify(data.subjects));
                }
            }
        } catch (_) { }
    }

    renderWeekInfo();
    renderTabs();
    if (!scheduleLoadFailed) renderSchedule();
    updateAppBadge();
    updateRateAfterLessonBanner();

    // Retry schedule load (when banner "Обновить" is shown)
    document.getElementById('offline-retry-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('offline-retry-btn');
        const banner = document.getElementById('offline-banner');
        if (btn) btn.disabled = true;
        try {
            const list = await getSchedule();
            setScheduleData(list);
            localStorage.setItem('cached_schedule', JSON.stringify(list));
            localStorage.setItem('cached_schedule_time', new Date().toISOString());
            if (banner) banner.classList.add('hidden');
            renderSchedule();
            updateAppBadge();
            showMessage('Расписание обновлено', 'success');
        } catch (e) {
            showMessage('Не удалось загрузить. Попробуйте позже.', 'error');
        }
        if (btn) btn.disabled = false;
    });
    setInterval(updateRateAfterLessonBanner, 60 * 1000);
    updatePersonalTip();
    loadPoll();
    initSocialMood();
    loadSocialStatus();
    initCopyTodayAndPdf();
    initDaysSwipe();
    initNoteVoice();

    // Listeners for Week Navigation
    const currentWeekBtn = document.getElementById('current-week-btn');
    const nextWeekBtn = document.getElementById('next-week-btn');

    if (currentWeekBtn && nextWeekBtn) {
        currentWeekBtn.onclick = () => {
            const now = new Date();
            state.currentWeek = getWeekNumber(now);
            state.selectedDay = DAYS_MAP[now.getDay()] || 'monday';
            if (state.selectedDay === 'saturday' || state.selectedDay === 'sunday') state.selectedDay = 'weekend';
            pushStateToUrl();
            currentWeekBtn.classList.add('active');
            nextWeekBtn.classList.remove('active');
            renderWeekInfo();
            renderTabs();
            renderSchedule();
            updateLiveStatus();
        };

        nextWeekBtn.onclick = () => {
            const now = new Date();
            state.currentWeek = getWeekNumber(now) + 1;
            state.selectedDay = 'monday';
            pushStateToUrl();
            nextWeekBtn.classList.add('active');
            currentWeekBtn.classList.remove('active');
            renderWeekInfo();
            renderTabs();
            renderSchedule();
            updateLiveStatus();
        };
    } else if (dom.prevWeekBtn && dom.nextWeekBtn) {
        // Fallback for old buttons if they exist
        dom.prevWeekBtn.onclick = () => updateWeek(-1);
        dom.nextWeekBtn.onclick = () => updateWeek(1);
    }

    const closeBannerBtn = document.getElementById('close-banner-btn');
    if (closeBannerBtn) {
        closeBannerBtn.onclick = () => {
            const banner = document.getElementById('announcement-banner');
            banner.classList.add('hidden');
            if (banner.dataset.createdAt) localStorage.setItem('closed_announcement_date', banner.dataset.createdAt);
        };
    }
    const favFilterChip = document.getElementById('fav-filter-chip');
    const favFilterChipClose = document.getElementById('fav-filter-chip-close');
    if (favFilterChip && favFilterChipClose) {
        favFilterChipClose.onclick = () => {
            state.showFavoritesOnly = false;
            favFilterChip.classList.add('hidden');
            pushStateToUrl();
            renderSchedule();
        };
        if (state.showFavoritesOnly) favFilterChip.classList.remove('hidden');
    }
    initPullToRefresh();
    initLessonReminders();
}

async function loadPoll() {
    const block = document.getElementById('poll-block');
    const questionEl = document.getElementById('poll-question');
    const optionsEl = document.getElementById('poll-options');
    const thanksEl = document.getElementById('poll-thanks');
    if (!block || !questionEl || !optionsEl) return;
    try {
        const r = await fetch('/api/polls');
        if (!r.ok) return;
        const polls = await r.json();
        const poll = Array.isArray(polls) && polls.length > 0 ? polls[0] : null;
        if (!poll || !poll.question || !poll.options || !poll.options.length) {
            block.classList.add('hidden');
            return;
        }
        block.classList.remove('hidden');
        thanksEl.classList.add('hidden');
        questionEl.textContent = poll.question;
        optionsEl.innerHTML = poll.options.map((opt, i) =>
            `<button type="button" class="poll-option-btn" data-poll-id="${poll.id}" data-option-index="${i}">${escapeHtml(opt)}</button>`
        ).join('');
        optionsEl.classList.remove('hidden');
        optionsEl.querySelectorAll('.poll-option-btn').forEach(btn => {
            btn.addEventListener('click', async () => {
                const pollId = parseInt(btn.getAttribute('data-poll-id'), 10);
                const optionIndex = parseInt(btn.getAttribute('data-option-index'), 10);
                const token = localStorage.getItem('access_token');
                try {
                    const res = await fetch(`/api/polls/${pollId}/vote`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            ...(token ? { Authorization: `Bearer ${token}` } : {}),
                        },
                        body: JSON.stringify({ option_index: optionIndex }),
                    });
                    if (res.ok) {
                        optionsEl.classList.add('hidden');
                        questionEl.classList.add('hidden');
                        thanksEl.classList.remove('hidden');
                        setTimeout(() => {
                            block.classList.add('hidden');
                        }, 2000);
                    } else {
                        const err = await res.json().catch(() => ({}));
                        showMessage(err.detail || 'Не удалось проголосовать', 'error');
                    }
                } catch (e) {
                    showMessage('Ошибка сети', 'error');
                }
            });
        });
    } catch (_) {
        block.classList.add('hidden');
    }
}

function updateAppBadge() {
    if (typeof navigator.setAppBadge !== 'function') return;
    const now = new Date();
    const dayIdx = now.getDay();
    if (dayIdx === 0 || dayIdx === 6) {
        navigator.setAppBadge(0);
        return;
    }
    const dayName = DAYS_MAP[dayIdx];
    const week = getWeekNumber(now);
    const lessons = getLessonsForDay(dayName, week);
    const count = lessons.length;
    try {
        navigator.setAppBadge(count);
    } catch (_) { }
}

function initPullToRefresh() {
    const container = dom.scheduleContainer;
    if (!container) return;
    let startY = 0;
    const threshold = 60;
    const pullEl = document.createElement('div');
    pullEl.className = 'pull-refresh-indicator';
    pullEl.setAttribute('aria-hidden', 'true');
    pullEl.innerHTML = '<i class="fas fa-sync-alt"></i> Потяните для обновления';
    container.insertBefore(pullEl, container.firstChild);
    container.addEventListener('touchstart', (e) => { startY = e.touches[0].clientY; }, { passive: true });
    container.addEventListener('touchmove', (e) => {
        const y = e.touches[0].clientY;
        if (y > startY && container.scrollTop === 0 && y - startY < 120) {
            const px = Math.min(y - startY, 80);
            pullEl.style.setProperty('--pull', px + 'px');
            pullEl.classList.toggle('active', px > 10);
        }
    }, { passive: true });
    container.addEventListener('touchend', async () => {
        const pull = parseInt(getComputedStyle(pullEl).getPropertyValue('--pull') || '0', 10);
        pullEl.style.setProperty('--pull', '0');
        pullEl.classList.remove('active');
        if (pull >= threshold) {
            pullEl.classList.add('active', 'refreshing');
            try {
                const list = await getSchedule();
                setScheduleData(list);
                localStorage.setItem('cached_schedule', JSON.stringify(list));
                renderSchedule();
                updateLiveStatus();
                updateAppBadge();
                showMessage('Расписание обновлено', 'success');
            } catch (e) {
                showMessage('Ошибка обновления', 'error');
            }
            pullEl.classList.remove('refreshing');
        }
    }, { passive: true });
}

function updateRateAfterLessonBanner() {
    const banner = document.getElementById('rate-after-lesson-banner');
    const textEl = document.getElementById('rate-after-lesson-text');
    const linkEl = document.getElementById('rate-after-lesson-link');
    if (!banner || !textEl) return;
    const now = new Date();
    const dayIdx = now.getDay();
    if (dayIdx === 0 || dayIdx === 6) {
        banner.classList.add('hidden');
        return;
    }
    const dayName = DAYS_MAP[dayIdx];
    const week = getWeekNumber(now);
    const lessons = getLessonsForDay(dayName, week);
    const todayStr = now.toISOString().split('T')[0];
    let toShow = null;
    for (const lesson of lessons) {
        const timeRange = PAIR_TIMES[lesson.pair];
        if (!timeRange) continue;
        const parts = timeRange.split(' - ');
        const endStr = parts[1] ? parts[1].trim() : null;
        if (!endStr) continue;
        const end = parseTime(endStr, now);
        if (now <= end) continue;
        const type = (lesson.type || 'lecture').toLowerCase();
        const key = `voted_${lesson.subject}_${type}_${todayStr}`;
        if (!localStorage.getItem(key)) {
            toShow = { subject: lesson.subject, type };
            break;
        }
    }
    if (toShow) {
        textEl.textContent = `Как прошла пара по «${toShow.subject}»?`;
        if (linkEl) linkEl.href = '/ratings.html';
        banner.classList.remove('hidden');
    } else {
        banner.classList.add('hidden');
    }
}

function initLessonReminders() {
    if (!('Notification' in window) || Notification.permission === 'denied') return;
    if (Notification.permission === 'granted') scheduleReminderCheck();
    else document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && Notification.permission === 'default') {
            Notification.requestPermission().then(p => { if (p === 'granted') scheduleReminderCheck(); });
        }
    });
    const asked = localStorage.getItem('notification_reminder_asked');
    if (!asked) {
        setTimeout(() => {
            Notification.requestPermission().then(p => {
                localStorage.setItem('notification_reminder_asked', '1');
                if (p === 'granted') scheduleReminderCheck();
            });
        }, 3000);
    }
}

function scheduleReminderCheck() {
    const minutes = parseInt(localStorage.getItem('reminder_minutes') || '15', 10);
    if (minutes <= 0) return;
    const check = () => {
        const now = new Date();
        const dayIdx = now.getDay();
        const dayName = DAYS_MAP[dayIdx];
        const week = getWeekNumber(now);
        const lessons = getLessonsForDay(dayName, week);
        const inM = new Date(now.getTime() + minutes * 60 * 1000);
        for (const lesson of lessons) {
            const timeRange = PAIR_TIMES[lesson.pair];
            if (!timeRange) continue;
            const [startStr] = timeRange.split(' - ');
            const start = parseTime(startStr, now);
            if (start > now && start <= inM) {
                if (!document.hidden) return;
                try {
                    new Notification(`Через ${minutes} мин пара`, { body: `${lesson.subject}, ${lesson.room}`, icon: '/static/icons/icon-192x192.png' });
                } catch (_) { }
                return;
            }
        }
    };
    setInterval(check, 60 * 1000);
    check();
}

// --- Announcement Loading ---


// --- User Profile & Greeting ---
async function fetchUserProfile() {
    try {
        const cachedName = localStorage.getItem('user_name');
        if (cachedName) {
            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.textContent = cachedName;
        }
        const token = localStorage.getItem('access_token');
        if (!token) return;
        const data = await getMe();
        console.log('Profile Fetched:', data);
        if (data.name) {
            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.textContent = data.name;
            localStorage.setItem('user_name', data.name);
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

async function loadNextLessonWidget() {
    const el = dom.nextLessonWidget;
    if (!el) return;
    try {
        const res = await fetch('/api/next');
        const data = await res.json();
        const next = data.next;
        if (next && next.subject) {
            el.classList.remove('hidden');
            const content = document.getElementById('next-lesson-content');
            if (content) {
                const min = next.in_minutes != null ? next.in_minutes : '?';
                content.innerHTML = `<strong>${next.subject}</strong> через ${min} мин · ${next.room || ''}`;
            }
        } else {
            el.classList.add('hidden');
        }
    } catch (_) {
        el.classList.add('hidden');
    }
}

let visitorsTodayCount = 0;

async function loadVisitors() {
    try {
        const opts = {};
        const t = localStorage.getItem('access_token');
        if (t) opts.headers = { Authorization: 'Bearer ' + t };
        const res = await fetch('/api/stats/visitors', opts);
        const data = await res.json();
        visitorsTodayCount = data.visitors_today || 0;
        updateStatsBar();
    } catch (_) { }
}

function updateStatsBar() {
    const el = document.getElementById('stats-bar');
    if (!el) return;
    el.classList.add('hidden');
}

function initCopyTodayAndPdf() {
    // Calendar, share, copy, PDF moved to profile/settings
}

function initDaysSwipe() {
    const tabs = dom.daysTabs;
    if (!tabs) return;
    let startX = 0;
    tabs.addEventListener('touchstart', (e) => { startX = e.touches[0].clientX; }, { passive: true });
    tabs.addEventListener('touchend', (e) => {
        const endX = e.changedTouches[0].clientX;
        const diff = startX - endX;
        const idx = DAYS_ORDER.indexOf(state.selectedDay);
        if (Math.abs(diff) > 50) {
            if (diff > 0 && idx < DAYS_ORDER.length - 1) {
                state.selectedDay = DAYS_ORDER[idx + 1];
                pushStateToUrl();
                renderTabs();
                renderSchedule();
                tabs.querySelector(`[data-day="${state.selectedDay}"]`)?.focus();
            } else if (diff < 0 && idx > 0) {
                state.selectedDay = DAYS_ORDER[idx - 1];
                pushStateToUrl();
                renderTabs();
                renderSchedule();
                tabs.querySelector(`[data-day="${state.selectedDay}"]`)?.focus();
            }
        }
    }, { passive: true });
}

function initNoteVoice() {
    const btn = document.getElementById('note-voice-btn');
    const input = document.getElementById('note-input');
    if (!btn || !input) return;
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        btn.style.display = 'none';
        return;
    }
    const rec = new SpeechRecognition();
    rec.lang = 'ru-RU';
    rec.continuous = false;
    rec.interimResults = false;
    btn.onclick = () => {
        if (rec.recording) {
            rec.stop();
            return;
        }
        btn.classList.add('recording');
        rec.onresult = (e) => {
            const text = e.results[0][0].transcript;
            input.value = (input.value ? input.value + ' ' : '') + text;
            btn.classList.remove('recording');
        };
        rec.onerror = () => btn.classList.remove('recording');
        rec.onend = () => btn.classList.remove('recording');
        rec.start();
    };
}

// Call these in init
async function loadAnnouncement() {
    const skeleton = document.getElementById('announcement-skeleton');
    try {
        const response = await fetch('/api/announcement');
        const data = await response.json();
        if (skeleton) skeleton.classList.add('hidden');

        if (data && data.message) {
            // Check if this specific announcement was already closed
            const lastClosed = localStorage.getItem('closed_announcement_date');
            if (lastClosed === data.created_at) {
                return; // User already closed this announcement
            }

            const banner = document.getElementById('announcement-banner');
            const text = document.getElementById('announcement-text');
            let msg = data.message;
            if (data.schedule_context && (data.schedule_context.week_num || data.schedule_context.day)) {
                const w = data.schedule_context.week_num;
                const d = data.schedule_context.day;
                const dayShort = { monday: 'пн', tuesday: 'вт', wednesday: 'ср', thursday: 'чт', friday: 'пт' }[d] || d;
                msg = (w ? `Неделя ${w}` : '') + (w && dayShort ? ', ' : '') + (dayShort ? dayShort : '') + (msg ? ': ' + msg : '');
            }
            text.textContent = msg;
            banner.classList.remove('hidden');
            banner.dataset.createdAt = data.created_at;
            const token = localStorage.getItem('access_token');
            fetch('/api/announcement/read', { method: 'POST', headers: token ? { Authorization: 'Bearer ' + token } : {} }).catch(() => { });
        }
    } catch (error) {
        console.error('Failed to load announcement:', error);
        if (skeleton) skeleton.classList.add('hidden');
    }
}



// --- Social Mood Status ---
let selectedEmoji = null;

async function loadSocialStatus() {
    const marquee = document.getElementById('mood-marquee');
    if (!marquee) return;
    try {
        const res = await fetch('/api/status');
        if (!res.ok) return;
        const statuses = await res.json();
        if (statuses && statuses.length > 0) {
            marquee.innerHTML = statuses.map(s => {
                const name = s.name ? s.name.split(' ')[0] : 'Студент';
                const text = s.status_text ? `<span class="mood-text">${escapeHtml(s.status_text)}</span>` : '';
                return `
                    <div class="mood-item">
                        <span class="mood-emoji">${escapeHtml(s.emoji)}</span>
                        <span class="mood-name">${escapeHtml(name)}</span>
                        ${text}
                    </div>
                `;
            }).join('');
        } else {
            marquee.innerHTML = '<span class="mood-item empty">Пока нет статусов на сегодня... Отметьтесь первым!</span>';
        }
    } catch (e) {
        console.error('Failed to load social status:', e);
    }
}

function initSocialMood() {
    const btn = document.getElementById('add-mood-btn');
    const modal = document.getElementById('mood-modal');
    const saveBtn = document.getElementById('save-mood-btn');
    const emojiBtns = document.querySelectorAll('.emoji-btn');
    const input = document.getElementById('mood-text');

    if (!btn || !modal) return;

    window.closeMoodModal = () => {
        modal.classList.add('hidden');
    };

    btn.onclick = () => {
        if (!localStorage.getItem('access_token')) {
            showMessage('Оставлять статус могут только авторизованные студенты', 'error');
            return;
        }
        modal.classList.remove('hidden');
    };

    emojiBtns.forEach(eb => {
        eb.onclick = () => {
            emojiBtns.forEach(b => b.classList.remove('selected'));
            eb.classList.add('selected');
            selectedEmoji = eb.getAttribute('data-emoji');
        };
    });

    if (saveBtn) {
        saveBtn.onclick = async () => {
            if (!selectedEmoji) {
                showMessage('Выберите эмодзи!', 'error');
                return;
            }
            const token = localStorage.getItem('access_token');
            if (!token) return;

            saveBtn.disabled = true;
            saveBtn.textContent = 'Отправка...';
            try {
                const res = await fetch('/api/status', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': 'Bearer ' + token
                    },
                    body: JSON.stringify({
                        emoji: selectedEmoji,
                        status_text: input.value.trim()
                    })
                });

                if (res.ok) {
                    showMessage('Статус обновлён!', 'success');
                    closeMoodModal();
                    loadSocialStatus();
                } else {
                    showMessage('Не удалось обновить статус', 'error');
                }
            } catch (e) {
                showMessage('Ошибка сети', 'error');
            }
            saveBtn.disabled = false;
            saveBtn.textContent = 'Поделиться';
        };
    }
}

window.addEventListener('online', () => { showMessage('Соединение восстановлено', 'success'); });

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('/sw.js')
            .then(reg => console.log('SW Registered:', reg.scope))
            .catch(err => console.error('SW Registration failed:', err));
    });
}

init();
