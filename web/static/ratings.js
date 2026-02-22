import { SUBJECTS_DATA } from './academics.js';
import { getFlags } from './api/flags.js';
import { showToast } from './toast.js';
import './theme_init.js';

const PENDING_RATINGS_KEY = 'pending_ratings';
function getPending() { return JSON.parse(localStorage.getItem(PENDING_RATINGS_KEY) || '[]'); }
function setPending(arr) { localStorage.setItem(PENDING_RATINGS_KEY, JSON.stringify(arr)); }

async function flushPendingRatings() {
    const pending = getPending();
    if (pending.length === 0) return;
    const token = localStorage.getItem('access_token');
    if (!token) return;
    for (const item of pending) {
        try {
            const res = await fetch('/api/rate-teacher', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ teacher_id: item.teacher_id, rating: item.rating, tags: [], comment: null })
            });
            if (res.ok) {
                const rest = pending.filter(p => p !== item);
                setPending(rest);
            }
        } catch (_) {}
    }
    if (getPending().length === 0) showToast('Оценки отправлены', 'success');
}

window.addEventListener('online', flushPendingRatings);

getFlags().then((f) => {
    window.__flags = f;
    if (f.new_ratings_ui) document.body.classList.add('new-ratings-ui');
});

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

let currentSubject = null;
let currentType = null; // 'lecture' or 'seminar'
let selectedRating = null;
let selectedTags = [];

let teachersBySubject = {};

async function loadContent() {
    loading.classList.remove('hidden');
    emptyState.classList.add('hidden');
    teachersContainer.innerHTML = '';
    try {
        const res = await fetch('/api/ratings');
        if (res.ok) {
            const list = await res.json();
            list.forEach(t => {
                if (t.subject && !teachersBySubject[t.subject]) teachersBySubject[t.subject] = t.id;
            });
        }
    } catch (_) {}
    setTimeout(() => {
        renderSubjects();
        loading.classList.add('hidden');
        flushPendingRatings();
    }, 300);
}

function renderSubjects() {
    const validSubjects = SUBJECTS_DATA.filter(s =>
        (s.lectures > 0 || s.seminars > 0) &&
        !s.isPractice &&
        !s.isCoursework &&
        s.id !== 'enlightenment'
    );

    if (validSubjects.length === 0) {
        emptyState.classList.remove('hidden');
        return;
    }

    validSubjects.forEach(sub => {
        const teacherId = teachersBySubject[sub.name];
        const card = createSubjectCard(sub, teacherId);
        teachersContainer.appendChild(card);
    });
}

function createSubjectCard(sub, teacherId) {
    const card = document.createElement('div');
    card.className = 'info-card teacher-card';

    const icon = getSubjectIcon(sub.name);
    let actionsHTML = '';
    actionsHTML += `<button class="rate-btn lecture-btn" onclick="openRatingModal('${sub.id}', '${sub.name}', 'lecture')"><i class="fas fa-chalkboard-teacher"></i> Лекции</button>`;
    actionsHTML += `<button class="rate-btn seminar-btn" onclick="openRatingModal('${sub.id}', '${sub.name}', 'seminar')"><i class="fas fa-users"></i> Семинары</button>`;

    let quickStarsHTML = '';
    if (teacherId) {
        quickStarsHTML = `<div class="quick-rating" data-teacher-id="${teacherId}"><span class="quick-rating-label">Быстрая оценка</span><div class="quick-stars">${[1,2,3,4,5].map(i => `<button type="button" class="quick-star" data-rating="${i}" aria-label="Оценка ${i}">★</button>`).join('')}</div></div>`;
    }

    card.innerHTML = `
        <div class="card-icon">${icon}</div>
        <div class="card-content">
            <h3 class="subject-title">${sub.name}</h3>
            ${quickStarsHTML}
            <div class="rate-actions">${actionsHTML}</div>
        </div>
    `;

    if (teacherId) {
        card.querySelectorAll('.quick-star').forEach(btn => {
            btn.addEventListener('click', () => submitQuickRating(teacherId, parseInt(btn.getAttribute('data-rating'), 10), card));
        });
    }
    return card;
}

async function submitQuickRating(teacherId, stars, cardEl) {
    const rating = stars * 20;
    if (!navigator.onLine) {
        const pending = getPending();
        pending.push({ teacher_id: teacherId, rating });
        setPending(pending);
        showToast('Оценка сохранится при появлении сети', 'info');
        return;
    }
    const token = localStorage.getItem('access_token');
    if (!token) return;
    try {
        const res = await fetch('/api/rate-teacher', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ teacher_id: teacherId, rating, tags: [], comment: null })
        });
        if (res.ok) {
            const count = parseInt(localStorage.getItem('achievement_rated_count') || '0', 10) + 1;
            localStorage.setItem('achievement_rated_count', String(count));
            showToast('Спасибо за оценку!', 'success');
            const starsWrap = cardEl.querySelector('.quick-stars');
            if (starsWrap) starsWrap.querySelectorAll('.quick-star').forEach((b, i) => b.classList.toggle('active', i < stars));
        }
    } catch (_) {
        const pending = getPending();
        pending.push({ teacher_id: teacherId, rating });
        setPending(pending);
        showToast('Оценка сохранится при появлении сети', 'info');
    }
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
window.openRatingModal = function (subjectId, subjectName, type) {
    currentSubject = subjectId;
    currentType = type;

    // Title
    let typeName = 'Занятие';
    if (type === 'lecture') typeName = 'Лекции';
    if (type === 'seminar') typeName = 'Семинары';

    document.getElementById('modal-teacher-name').textContent = subjectName;
    document.getElementById('modal-subject').textContent = `Оцениваем: ${typeName}`;

    const commentInput = document.getElementById('comment-input');
    if (commentInput) commentInput.value = '';

    // Simulate finding today's lessons
    // In a real app, you'd filter by date and subjectId
    const today = new Date().toISOString().split('T')[0];
    const hasLessonsToday = false; // Mock: Force empty state for now to show the alert

    const lessonsList = document.getElementById('lessons-list');
    const noLessonsAlert = document.getElementById('no-lessons-alert');
    const selectLabel = document.getElementById('select-lesson-label');

    lessonsList.innerHTML = '';

    if (hasLessonsToday) {
        noLessonsAlert.classList.add('hidden');
        selectLabel.classList.remove('hidden');
        // valid logic to render lessons...
    } else {
        noLessonsAlert.classList.remove('hidden');
        selectLabel.classList.add('hidden'); // Hide "Select lesson" label
    }

    loadSubjectReviews(subjectName);
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden', 'false');
    const firstFocusable = modal.querySelector('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    if (firstFocusable) firstFocusable.focus();
    trapRatingModalFocus(modal);
}

function trapRatingModalFocus(modalEl) {
    const focusables = modalEl.querySelectorAll('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])');
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    function onKeyDown(e) {
        if (e.key === 'Escape') {
            closeModal();
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
    modalEl._ratingModalKeyHandler = onKeyDown;
    modalEl.addEventListener('keydown', onKeyDown);
}

async function loadSubjectReviews(subjectName) {
    const list = document.getElementById('subject-reviews-list');
    if (!list) return;
    try {
        const res = await fetch('/api/subject-reviews?subject=' + encodeURIComponent(subjectName));
        const data = await res.json();
        list.innerHTML = data.length ? data.slice(0, 3).map(r => `<div class="subject-review-item">${escapeHtml(r.body)}</div>`).join('') : '<p class="text-muted">Пока нет отзывов</p>';
    } catch (_) {
        list.innerHTML = '';
    }
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function closeModal() {
    if (modal._ratingModalKeyHandler) {
        modal.removeEventListener('keydown', modal._ratingModalKeyHandler);
        modal._ratingModalKeyHandler = null;
    }
    modal.classList.add('hidden');
    currentSubject = null;
}

closeModalBtn.addEventListener('click', closeModal);
modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
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
            const votedKey = `voted_${currentSubject}_${currentType}_${new Date().toISOString().split('T')[0]}`;
            localStorage.setItem(votedKey, 'true');
            const count = parseInt(localStorage.getItem('achievement_rated_count') || '0', 10) + 1;
            localStorage.setItem('achievement_rated_count', String(count));
            alert('✅ Ваш голос принят! Спасибо.');
            closeModal();
            // Refresh Leaderboard
            loadLeaderboard();
        } else {
            alert('❌ Ошибка при отправке. Возможно, вы уже голосовали сегодня?');
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

// My Ratings (list + weekly chart)
async function loadMyRatings() {
    const loadingEl = document.getElementById('my-ratings-loading');
    const emptyEl = document.getElementById('my-ratings-empty');
    const contentEl = document.getElementById('my-ratings-content');
    const listEl = document.getElementById('my-ratings-list');
    const chartWrap = document.getElementById('my-ratings-chart-wrap');
    if (!listEl || !chartWrap) return;

    loadingEl.classList.remove('hidden');
    emptyEl.classList.add('hidden');
    contentEl.classList.add('hidden');

    try {
        const token = localStorage.getItem('access_token');
        const res = await fetch('/api/ratings/my', { headers: { Authorization: `Bearer ${token}` } });
        if (!res.ok) {
            loadingEl.classList.add('hidden');
            emptyEl.classList.remove('hidden');
            return;
        }
        const data = await res.json();
        const ratings = data.ratings || [];
        const byWeek = data.by_week || [];

        loadingEl.classList.add('hidden');
        if (ratings.length === 0) {
            emptyEl.classList.remove('hidden');
            return;
        }
        contentEl.classList.remove('hidden');

        // Chart: simple bar by week
        chartWrap.innerHTML = '';
        if (byWeek.length > 0) {
            const maxAvg = Math.max(...byWeek.map(w => w.average), 1);
            const chartEl = document.createElement('div');
            chartEl.className = 'my-ratings-chart';
            chartEl.setAttribute('role', 'img');
            chartEl.setAttribute('aria-label', 'Средний балл по неделям');
            chartEl.innerHTML = byWeek.map((w, i) => {
                const pct = Math.round((w.average / maxAvg) * 100);
                return `<div class="my-ratings-chart-bar-wrap" title="Неделя ${w.week}: ${w.average}">
                    <div class="my-ratings-chart-bar" style="height:${Math.max(8, pct)}%"></div>
                    <span class="my-ratings-chart-label">${w.week}</span>
                </div>`;
            }).join('');
            chartWrap.appendChild(chartEl);
        }

        listEl.innerHTML = ratings.map(r => {
            const typeLabel = r.subject_type === 'lecture' ? 'Лекция' : 'Семинар';
            const comment = r.comment ? `<p class="my-rating-comment">${escapeHtml(r.comment)}</p>` : '';
            return `<div class="my-rating-item info-card">
                <div class="my-rating-header">
                    <strong>${escapeHtml(r.subject_name)}</strong>
                    <span class="my-rating-badge">${typeLabel}</span>
                </div>
                <div class="my-rating-meta">${r.lesson_date} · ${r.rating}/100</div>
                ${comment}
            </div>`;
        }).join('');
    } catch (e) {
        loadingEl.classList.add('hidden');
        emptyEl.classList.remove('hidden');
        emptyEl.querySelector('p').textContent = 'Ошибка загрузки';
    }
}

// Tab Logic
window.initTabs = function () {
    const btnEval = document.getElementById('tab-btn-eval');
    const btnRate = document.getElementById('tab-btn-rate');
    const btnMy = document.getElementById('tab-btn-my');
    const viewEval = document.getElementById('evaluation-view');
    const viewRate = document.getElementById('leaderboard-view');
    const viewMy = document.getElementById('my-ratings-view');

    if (!btnEval || !btnRate || !viewEval || !viewRate) return;
    const tabs = [
        { id: 'evaluation', btn: btnEval, view: viewEval, onShow: () => {} },
        { id: 'leaderboard', btn: btnRate, view: viewRate, onShow: loadLeaderboard },
        { id: 'my', btn: btnMy, view: viewMy, onShow: loadMyRatings },
    ].filter(t => t.view);

    function setActive(tabId) {
        tabs.forEach(t => {
            t.btn.classList.toggle('active', t.id === tabId);
            if (t.view) t.view.classList.toggle('hidden', t.id !== tabId);
            if (t.id === tabId && t.onShow) t.onShow();
        });
    }

    btnEval.addEventListener('click', () => setActive('evaluation'));
    btnRate.addEventListener('click', () => setActive('leaderboard'));
    if (btnMy) btnMy.addEventListener('click', () => setActive('my'));
};

// Init
loadContent();
loadLeaderboard();
initTabs();
