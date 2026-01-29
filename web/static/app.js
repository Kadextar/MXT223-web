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

function init() {
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

    // Запускаем Live Update
    updateLiveStatus();
    setInterval(updateLiveStatus, 30000); // Каждые 30 сек

    // Listeners
    dom.prevWeekBtn.onclick = () => updateWeek(-1);
    dom.nextWeekBtn.onclick = () => updateWeek(1);
}

init();
