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

    // Actions
    let actionsHTML = '';

    // Always show Lecture/Seminar for standard subjects
    actionsHTML = `
        <div class="rate-actions">
            <button class="rate-btn outline" onclick="openRatingModal('${sub.id}', '${sub.name}', 'lecture')">
                Оценить лекции
            </button>
            <button class="rate-btn outline" onclick="openRatingModal('${sub.id}', '${sub.name}', 'seminar')">
                Оценить семинары
            </button>
        </div>
    `;

    // Teacher names logic
    let teacherInfo = '';
    if (sub.teachers) {
        if (sub.teachers.lecture && sub.teachers.seminar) {
            teacherInfo = `<div class="teacher-names">
                <div><span style="opacity:0.7">Лек:</span> ${sub.teachers.lecture}</div>
                <div><span style="opacity:0.7">Сем:</span> ${sub.teachers.seminar}</div>
            </div>`;
        } else if (sub.teachers.lecture) {
            teacherInfo = `<div class="teacher-names">Ведет: ${sub.teachers.lecture}</div>`;
        }
    }

    card.innerHTML = `
        <h3 class="teacher-name">${sub.name}</h3>
        <span class="badge" style="margin-bottom: 10px; display: inline-block;">${sub.type}</span>
        ${teacherInfo}
        <div style="margin-top: auto;">
            ${actionsHTML}
        </div>
    `;

    return card;
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
