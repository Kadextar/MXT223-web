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

    // Show Form directly
    document.getElementById('lesson-selection').classList.add('hidden');
    document.getElementById('rating-form').classList.remove('hidden');
    document.getElementById('selected-lesson-info').style.display = 'none';

    // Reset Form
    selectedRating = null;
    selectedTags = [];
    ratingInput.value = '';
    ratingDisplay.textContent = 'Выберите оценку (100-балльная шкала)';
    document.getElementById('comment-input').value = '';
    document.querySelectorAll('.emoji-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));

    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    currentSubject = null;
}

closeModalBtn.addEventListener('click', closeModal);
modal.querySelector('.modal-overlay').addEventListener('click', closeModal);
document.getElementById('back-to-lessons').style.display = 'none';

// Emoji Rating
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        selectedRating = parseInt(this.dataset.rating);
        ratingInput.value = selectedRating;

        document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        const labels = {
            20: '20/100 - Плохо 😞',
            40: '40/100 - Слабо 😐',
            60: '60/100 - Нормально 🙂',
            80: '80/100 - Хорошо 😊',
            100: '100/100 - Отлично! 🤩'
        };
        ratingDisplay.textContent = labels[selectedRating];
    });
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
