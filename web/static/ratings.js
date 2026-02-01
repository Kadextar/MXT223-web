import { SUBJECTS_DATA } from './academics.js';

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

// Load Content
async function loadContent() {
    loading.classList.remove('hidden');
    emptyState.classList.add('hidden');
    teachersContainer.innerHTML = '';

    // Simulate delay for "fetching"
    setTimeout(() => {
        renderSubjects();
        loading.classList.add('hidden');
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
        const card = createSubjectCard(sub);
        teachersContainer.appendChild(card);
    });
}

function createSubjectCard(sub) {
    const card = document.createElement('div');
    card.className = 'info-card teacher-card';

    const icon = getSubjectIcon(sub.name);

    // Actions
    let actionsHTML = '';

    // Lecture Button
    actionsHTML += `
        <button class="rate-btn lecture-btn" onclick="openRatingModal('${sub.id}', '${sub.name}', 'lecture')">
            <i class="fas fa-chalkboard-teacher"></i> Лекции
        </button>
    `;

    // Seminar Button
    actionsHTML += `
        <button class="rate-btn seminar-btn" onclick="openRatingModal('${sub.id}', '${sub.name}', 'seminar')">
            <i class="fas fa-users"></i> Семинары
        </button>
    `;

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
window.openRatingModal = function (subjectId, subjectName, type) {
    currentSubject = subjectId;
    currentType = type;

    // Title
    let typeName = 'Занятие';
    if (type === 'lecture') typeName = 'Лекции';
    if (type === 'seminar') typeName = 'Семинары';

    document.getElementById('modal-teacher-name').textContent = subjectName;
    document.getElementById('modal-subject').textContent = `Оцениваем: ${typeName}`;

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

    modal.classList.remove('hidden');
}

function closeModal() {
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
ratingForm.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!selectedRating) {
        alert('Пожалуйста, выберите оценку');
        return;
    }

    const review = {
        subjectId: currentSubject,
        type: currentType,
        rating: selectedRating,
        tags: selectedTags,
        comment: document.getElementById('comment-input').value,
        date: new Date().toISOString()
    };

    const reviews = JSON.parse(localStorage.getItem('my_reviews') || '[]');
    reviews.push(review);
    localStorage.setItem('my_reviews', JSON.stringify(reviews));

    alert('✅ Ваш отзыв сохранен! Он анонимен.');
    closeModal();
});

// Init
loadContent();
