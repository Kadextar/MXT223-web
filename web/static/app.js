import { SEMESTER_START_DATE, PAIR_TIMES, getLessonsForDay, setScheduleData } from './schedule_data.js';

// --- Authentication Check ---
const AUTHORIZED_STUDENTS = [
    '1748727700', '1427112602', '1937736219', '207103078', '5760110758',
    '1362668588', '2023499343', '1214641616', '1020773033'
];

const studentId = localStorage.getItem('student_id');
if (!studentId || !AUTHORIZED_STUDENTS.includes(studentId)) {
    window.location.href = '/login.html';
}

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
    dom.currentDate.textContent = formatDate(state.currentDate);
    if (dom.weekNumber) {
        dom.weekNumber.textContent = `${state.currentWeek}-я неделя`;
    }

    // Update week date range
    const weekDateRangeEl = document.getElementById('week-date-range');
    if (weekDateRangeEl) {
        weekDateRangeEl.textContent = getWeekDateRange(state.currentWeek);
    }
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
            <a href="/schedule.html" class="nav-link" title="Расписание">
                <i class="fas fa-calendar-alt"></i>
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

function renderSchedule() {
    const container = dom.scheduleContainer;
    container.innerHTML = '';

    const lessons = getLessonsForDay(state.selectedDay, state.currentWeek);

    if (lessons.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">😌</div>
                <p>В этот день занятий нет</p>
                <p class="subtitle">Отдыхайте!</p>
            </div>
        `;
        return;
    }

    lessons.sort((a, b) => a.pair - b.pair);

    lessons.forEach(lesson => {
        const time = PAIR_TIMES[lesson.pair] || "—";
        const typeClass = lesson.type === 'lecture' ? 'lecture' : 'seminar';
        const typeLabel = lesson.type === 'lecture' ? 'Лекция' : 'Семинар';

        // ID для поиска при обновлении Live статуса
        const lessonId = `lesson-${lesson.pair}`;

        const card = document.createElement('div');
        card.className = `lesson-card ${typeClass}`;
        card.id = lessonId;
        card.innerHTML = `
            <div class="card-header">
                <span class="time-badge">${lesson.pair} пара • ${time}</span>
                <span class="type-badge">${typeLabel}</span>
            </div>
            <h3 class="lesson-subject">${lesson.subject}</h3>
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

    renderWeekInfo();
    renderSchedule();
    updateLiveStatus();
}

async function init() {
    // Load schedule data from API
    // TEMP: Using nocache endpoint as workaround for persistent cache issue
    try {
        const response = await fetch('/api/debug/schedule-nocache');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        setScheduleData(data);
    } catch (error) {
        console.error('Failed to load schedule:', error);

        // Show error to user
        const container = document.getElementById('schedule-container');
        if (container) {
            container.innerHTML = `
                <div class="empty-state">
                    <div class="empty-icon">⚠️</div>
                    <p>Ошибка загрузки</p>
                    <p class="subtitle">${error.message}</p>
                    <button onclick="location.reload()" style="margin-top: 1rem; padding: 0.5rem 1rem; border-radius: 8px; border: none; background: var(--primary); color: white;">Попробовать снова</button>
                </div>
            `;
            return; // Stop initialization
        }
    }

    const now = new Date();
    state.currentWeek = getWeekNumber(now);

    let dayIdx = now.getDay();
    if (dayIdx === 0 || dayIdx === 6) {
        state.selectedDay = 'monday';
    } else {
        state.selectedDay = DAYS_MAP[dayIdx];
    }

    renderWeekInfo();
    renderTabs();
    renderSchedule();

    // Initialize new floating navigation
    initFloatingNav();

    // Запускаем Live Update
    updateLiveStatus();
    setInterval(updateLiveStatus, 30000); // Каждые 30 сек

    // Загружаем объявление
    loadAnnouncement();

    // Listeners
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

init();
