import { SUBJECTS_DATA } from './academics.js';
import { SEMESTER_START_DATE, getLessonsForDay, setScheduleData } from './schedule_data.js';
import './theme_init.js';

// --- Authentication Check ---
const token = localStorage.getItem('access_token');
if (!token) {
    window.location.href = '/login.html';
}

// DOM Elements
const teachersContainer = document.getElementById('teachers-container');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const modal = document.getElementById('rating-modal');
const closeModalBtn = document.getElementById('close-modal');
const ratingForm = document.getElementById('rating-form');
const ratingDisplay = document.getElementById('rating-display');
const ratingInput = document.getElementById('rating-input');

let currentSubject = null; // используем название предмета
let currentType = null; // 'lecture' or 'seminar'
let selectedRating = null;
let selectedTags = [];

const DAYS_MAP = {
    0: 'sunday',
    1: 'monday',
    2: 'tuesday',
    3: 'wednesday',
    4: 'thursday',
    5: 'friday',
    6: 'saturday'
};

function getWeekNumber(date) {
    const start = new Date(SEMESTER_START_DATE);
    start.setHours(0, 0, 0, 0);
    const current = new Date(date);
    current.setHours(0, 0, 0, 0);
    if (current < start) return 1;
    const diffDays = Math.ceil((current - start) / (1000 * 60 * 60 * 24));
    return Math.floor(diffDays / 7) + 1;
}

// Load Content: показываем ТОЛЬКО предметы, которые есть сегодня в расписании
async function loadContent() {
    loading.classList.remove('hidden');
    emptyState.classList.add('hidden');
    teachersContainer.innerHTML = '';

    try {
        const resp = await fetch('/api/schedule');
        if (!resp.ok) throw new Error('Failed to load schedule');
        const data = await resp.json();
        setScheduleData(data);

        const now = new Date();
        const week = getWeekNumber(now);
        const dayName = DAYS_MAP[now.getDay()];

        // В выходные занятий нет
        if (dayName === 'saturday' || dayName === 'sunday') {
            emptyState.classList.remove('hidden');
            return;
        }

        const lessonsToday = getLessonsForDay(dayName, week);
        if (!lessonsToday || lessonsToday.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        // Собираем информацию по предметам и типам (lecture/seminar), которые были сегодня
        const metaBySubject = {};
        lessonsToday.forEach((lesson) => {
            const name = lesson.subject;
            if (!metaBySubject[name]) {
                metaBySubject[name] = { hasLecture: false, hasSeminar: false };
            }
            if (lesson.type === 'lecture') metaBySubject[name].hasLecture = true;
            if (lesson.type === 'seminar') metaBySubject[name].hasSeminar = true;
        });

        // Берём только те предметы из SUBJECTS_DATA, которые реально были сегодня
        const validSubjects = SUBJECTS_DATA.filter(
            (s) => metaBySubject[s.name] && (metaBySubject[s.name].hasLecture || metaBySubject[s.name].hasSeminar)
        );

        if (validSubjects.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        validSubjects.forEach((sub) => {
            const card = createSubjectCard(sub, metaBySubject[sub.name]);
            if (card) teachersContainer.appendChild(card);
        });
    } catch (e) {
        console.error('Ratings loadContent error:', e);
        emptyState.classList.remove('hidden');
    } finally {
        loading.classList.add('hidden');
    }
}

function createSubjectCard(sub, meta) {
    const hasLecture = meta?.hasLecture;
    const hasSeminar = meta?.hasSeminar;

    // Если по предмету сегодня нет ни лекций, ни семинаров, карточку не показываем
    if (!hasLecture && !hasSeminar) return null;

    const card = document.createElement('div');
    card.className = 'info-card teacher-card';

    const icon = getSubjectIcon(sub.name);

    let actionsHTML = '';

    if (hasLecture) {
        actionsHTML += `
            <button class="rate-btn lecture-btn" onclick="openRatingModal('${sub.name}', 'lecture')">
                <i class="fas fa-chalkboard-teacher"></i> Лекции
            </button>
        `;
    }

    if (hasSeminar) {
        actionsHTML += `
            <button class="rate-btn seminar-btn" onclick="openRatingModal('${sub.name}', 'seminar')">
                <i class="fas fa-users"></i> Семинары
            </button>
        `;
    }

    card.innerHTML = `
        <div class="card-icon">${icon}</div>
        <div class="card-content">
            <h3 class="subject-title">${sub.name}</h3>
            <div class="rate-actions">
                ${actionsHTML}
            </div>
        </div>
    `;

    return card;
}

function getSubjectIcon(name) {
    const lower = name.toLowerCase();
    if (lower.includes('эконом')) return '📊';
    if (lower.includes('менеджмент') || lower.includes('управл')) return '💼';
    if (lower.includes('гостинич')) return '🏨';
    if (lower.includes('туриз')) return '🌍';
    if (lower.includes('бизнес')) return '🤝';
    if (lower.includes('маркетинг')) return '📈';
    if (lower.includes('истори')) return '📜';
    if (lower.includes('философ')) return '🤔';
    if (lower.includes('прав') || lower.includes('юрид')) return '⚖️';
    if (lower.includes('информа')) return '💻';
    if (lower.includes('язык') || lower.includes('english')) return '🗣️';
    if (lower.includes('спорт') || lower.includes('физкульт')) return '⚽';
    return '📚'; // Default
}

// Modal Functions
window.openRatingModal = function (subjectName, type) {
    const todayStr = new Date().toISOString().split('T')[0];
    const votedKey = `voted_${subjectName}_${type}_${todayStr}`;
    if (localStorage.getItem(votedKey)) {
        alert('Вы уже оценивали этот предмет сегодня.');
        return;
    }

    currentSubject = subjectName;
    currentType = type;

    // Title
    let typeName = 'Занятие';
    if (type === 'lecture') typeName = 'Лекции';
    if (type === 'seminar') typeName = 'Семинары';

    document.getElementById('modal-teacher-name').textContent = subjectName;
    document.getElementById('modal-subject').textContent = `Оцениваем: ${typeName}`;

    const lessonsList = document.getElementById('lessons-list');
    const noLessonsAlert = document.getElementById('no-lessons-alert');
    const selectLabel = document.getElementById('select-lesson-label');

    lessonsList.innerHTML = '';

    // Список конкретных пар сейчас не показываем, только факт, что сегодня было занятие
    noLessonsAlert.classList.add('hidden');
    selectLabel.classList.add('hidden');
    lessonsList.classList.add('hidden');

    modal.classList.remove('hidden');

    // Подгружаем последние комментарии
    loadComments(subjectName, type);
}

function closeModal() {
    modal.classList.add('hidden');
    currentSubject = null;
}

closeModalBtn.addEventListener('click', closeModal);
modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal && !modal.classList.contains('hidden')) closeModal();
});
document.getElementById('back-to-lessons').style.display = 'none';

// Rating Logic (Slider & Input)
const ratingRange = document.getElementById('rating-range');
const ratingNumber = document.getElementById('rating-number');
const ratingVerdict = document.getElementById('rating-verdict');
const emojiSpan = ratingVerdict.querySelector('.rating-emoji');
const textSpan = ratingVerdict.querySelector('.rating-text');

function updateRatingVisuals(value) {
    value = parseInt(value);
    if (isNaN(value)) value = 0;

    // Clamp
    if (value < 0) value = 0;
    if (value > 100) value = 100;

    // Update both inputs
    ratingRange.value = value;
    ratingNumber.value = value;
    ratingInput.value = value; // Hidden input for form submission
    selectedRating = value; // Global var for logic

    // Determine Verdict
    let emoji = '😐';
    let text = 'Нормально';

    if (value >= 90) { emoji = '🤩'; text = 'Великолепно!'; }
    else if (value >= 80) { emoji = '😊'; text = 'Отлично'; }
    else if (value >= 70) { emoji = '🙂'; text = 'Хорошо'; }
    else if (value >= 50) { emoji = '😐'; text = 'Нормально'; }
    else if (value >= 30) { emoji = '😕'; text = 'Так себе'; }
    else { emoji = '😞'; text = 'Плохо'; }

    // Update DOM only if changed to avoid heavy repaints/animations re-triggering constantly
    if (emojiSpan.textContent !== emoji) {
        emojiSpan.textContent = emoji;
        // Re-trigger animation
        emojiSpan.style.animation = 'none';
        emojiSpan.offsetHeight; /* trigger reflow */
        emojiSpan.style.animation = 'bounceIn 0.3s cubic-bezier(0.175, 0.885, 0.32, 1.275)';
    }
    textSpan.textContent = text;
}

// Event Listeners
ratingRange.addEventListener('input', (e) => updateRatingVisuals(e.target.value));
ratingNumber.addEventListener('input', (e) => updateRatingVisuals(e.target.value));

ratingNumber.addEventListener('blur', function () {
    // Ensure valid number on blur
    let val = parseInt(this.value);
    if (isNaN(val) || val < 0) val = 0;
    if (val > 100) val = 100;
    updateRatingVisuals(val);
});

// Tags
document.querySelectorAll('.tag-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        const tag = this.dataset.tag;
        if (selectedTags.includes(tag)) {
            selectedTags = selectedTags.filter(t => t !== tag);
            this.classList.remove('active');
        } else {
            selectedTags.push(tag);
            this.classList.add('active');
        }
    });
});

// Submit
ratingForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!selectedRating) {
        alert('Пожалуйста, выберите оценку');
        return;
    }

    const token = localStorage.getItem('access_token');

    try {
        const response = await fetch('/api/ratings', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                subject_name: document.getElementById('modal-teacher-name').textContent,
                subject_type: currentType,
                rating: selectedRating,
                tags: selectedTags,
                comment: document.getElementById('comment-input').value,
                date: new Date().toISOString().split('T')[0]
            })
        });

        if (response.ok) {
            const todayStr = new Date().toISOString().split('T')[0];
            const votedKey = `voted_${currentSubject}_${currentType}_${todayStr}`;
            localStorage.setItem(votedKey, 'true');

            alert('✅ Ваш голос принят! Спасибо.');
            closeModal();
            loadLeaderboard();
            loadComments(currentSubject, currentType);
        } else {
            alert('❌ Ошибка при отправке. Возможно, вы уже голосовали сегодня или предмета нет в расписании.');
        }
    } catch (error) {
        console.error('Error:', error);
        alert('Ошибка сети.');
    }
});

// Leaderboard Logic
async function loadLeaderboard() {
    const container = document.getElementById('leaderboard-list');
    if (!container) return; // Only if element exists

    try {
        const response = await fetch('/api/ratings/leaderboard');
        if (!response.ok) return;

        const data = await response.json();
        const top3 = data.slice(0, 3); // Get Top 3

        container.innerHTML = top3.map((item, index) => {
            let medal = '';
            if (index === 0) medal = '🥇';
            if (index === 1) medal = '🥈';
            if (index === 2) medal = '🥉';

            return `
                <div class="leader-item">
                    <span class="leader-rank">${medal}</span>
                    <span class="leader-name">${item.subject}</span>
                    <span class="leader-score">${item.average}</span>
                </div>
            `;
        }).join('');

        if (top3.length === 0) {
            container.innerHTML = '<div class="leader-empty">Пока нет голосов</div>';
        }
    } catch (e) {
        console.error("Leaderboard error:", e);
    }
}

// Загрузка комментариев для модалки
async function loadComments(subjectName, type) {
    const container = document.getElementById('comments-list');
    if (!container) return;
    container.innerHTML = '<p class="text-muted">Загрузка отзывов...</p>';

    try {
        const params = new URLSearchParams({
            subject_name: subjectName,
            subject_type: type
        });
        const resp = await fetch(`/api/ratings/comments?${params.toString()}`);
        if (!resp.ok) {
            container.innerHTML = '';
            return;
        }
        const data = await resp.json();
        if (!data.length) {
            container.innerHTML = '<p class="text-muted">Пока нет комментариев</p>';
            return;
        }
        container.innerHTML = data.map((c) => {
            const dateStr = c.lesson_date || '';
            const ratingStr = typeof c.rating === 'number' ? `${c.rating}/100` : '';
            const comment = c.comment || '';
            return `
                <div class="comment-item">
                    <div class="comment-meta">
                        <span>${ratingStr}</span>
                        <span>${dateStr}</span>
                    </div>
                    <p>${comment ? comment.replace(/</g, '&lt;') : ''}</p>
                </div>
            `;
        }).join('');
    } catch (e) {
        console.error('loadComments error', e);
        container.innerHTML = '';
    }
}

// Tab Logic
// Tab Logic
window.initTabs = function () {
    console.log('Initializing Tabs...');
    // Use ID selectors for safety in case classes vary
    const btnEval = document.getElementById('tab-btn-eval');
    const btnRate = document.getElementById('tab-btn-rate');

    const viewEval = document.getElementById('evaluation-view');
    const viewRate = document.getElementById('leaderboard-view');

    if (!btnEval || !btnRate || !viewEval || !viewRate) {
        console.error('Tab elements not found!');
        return;
    }

    function setActive(tabName) {
        if (tabName === 'evaluation') {
            btnEval.classList.add('active');
            btnRate.classList.remove('active');
            viewEval.classList.remove('hidden');
            viewRate.classList.add('hidden');
        } else {
            btnRate.classList.add('active');
            btnEval.classList.remove('active');
            viewRate.classList.remove('hidden');
            viewEval.classList.add('hidden');
        }
    }

    btnEval.addEventListener('click', () => setActive('evaluation'));
    btnRate.addEventListener('click', () => setActive('leaderboard'));
};

// Init
loadContent();
loadLeaderboard();
initTabs();
