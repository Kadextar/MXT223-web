import { SEMESTER_START_DATE, PAIR_TIMES, getLessonsForDay } from './schedule_data.js';

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
};

const DAYS_MAP = {
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday',
    0: 'sunday'
};

const DAYS_LABELS = {
    'monday': 'Пн',
    'tuesday': 'Вт',
    'wednesday': 'Ср',
    'thursday': 'Чт',
    'friday': 'Пт'
};

// --- Utils ---
function getWeekNumber(date) {
    const start = new Date(SEMESTER_START_DATE);
    // Сбрасываем время для корректного сравнения
    start.setHours(0, 0, 0, 0);
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);

    if (current < start) return 1;

    const diffTime = Math.abs(current - start);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Прибавляем смещение дня недели начала (если семестр начался не в понедельник)
    // Но для простоты считаем разницу в днях / 7
    return Math.floor(diffDays / 7) + 1;
}

function formatDate(date) {
    const options = { weekday: 'long', day: 'numeric', month: 'long' };
    let str = date.toLocaleDateString('ru-RU', options);
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// --- Render Functions ---
function renderWeekInfo() {
    dom.currentDate.textContent = formatDate(state.currentDate);
    dom.weekNumber.textContent = `${state.currentWeek}-я неделя`;
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

    // Сортируем по парам
    lessons.sort((a, b) => a.pair - b.pair);

    lessons.forEach(lesson => {
        const time = PAIR_TIMES[lesson.pair] || "—";
        const typeClass = lesson.type === 'lecture' ? 'lecture' : 'seminar';
        const typeLabel = lesson.type === 'lecture' ? 'Лекция' : 'Семинар';
        const icon = lesson.type === 'lecture' ? '📘' : '📒';

        const card = document.createElement('div');
        card.className = `lesson-card ${typeClass}`;
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

// --- Logic ---
function selectDay(day) {
    state.selectedDay = day;
    renderTabs();
    renderSchedule();
}

function updateWeek(offset) {
    state.currentWeek += offset;
    if (state.currentWeek < 1) state.currentWeek = 1;
    if (state.currentWeek > 20) state.currentWeek = 20;

    renderWeekInfo();
    renderSchedule();
}

function init() {
    // Определяем текущий день и неделю
    const now = new Date();
    state.currentWeek = getWeekNumber(now);

    // Определяем день недели (0-6, вс-сб) -> (1-7, пн-вс)
    let dayIdx = now.getDay();
    // Если воскресенье (0), показываем понедельник
    if (dayIdx === 0 || dayIdx === 6) {
        state.selectedDay = 'monday';
        if (dayIdx === 0) {
            // Если воскресенье, может показать следующую неделю?
            // Пока оставим текущую логику
        }
    } else {
        state.selectedDay = DAYS_MAP[dayIdx];
    }

    renderWeekInfo();
    renderTabs();
    renderSchedule();

    // Listeners
    dom.prevWeekBtn.onclick = () => updateWeek(-1);
    dom.nextWeekBtn.onclick = () => updateWeek(1);
}

// Start
init();
