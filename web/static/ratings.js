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
    teachersContainer.innerHTML = '';

    // Simulate delay for "fetching"
    setTimeout(() => {
        renderSubjects();
        loading.classList.add('hidden');
    }, 500);
}

function renderSubjects() {
    // Filter out items that are not useful for rating (like 'enlightenment' if needed, but let's keep all valid ones)
    // Actually, 'enlightenment' has 0 hours/credits, maybe skip it?
    // User said "Enlightenment is Obligatory", so maybe keep it if it has a teacher. It has 0 lectures/seminars.
    // Let's filter items with > 0 lectures or seminars or Practice/Coursework

    const validSubjects = SUBJECTS_DATA.filter(s =>
        (s.lectures > 0 || s.seminars > 0) &&
        !s.isPractice &&
        !s.isCoursework &&
        s.id !== 'enlightenment'
    );

    validSubjects.forEach(sub => {
        const card = createSubjectCard(sub);
        teachersContainer.appendChild(card);
    });
}

function createSubjectCard(sub) {
    const card = document.createElement('div');
    card.className = 'info-card teacher-card'; // Reuse info-card from academics style if possible, but we are in ratings.css which has teacher-card
    // We will inject styles to match Light Frost in css later.

    // Get stats from local storage
    const storageKey = `rating_${sub.id}`;
    const savedRating = JSON.parse(localStorage.getItem(storageKey) || 'null'); // { lecture: float, seminar: float, count: int }

    // Actions
    let actionsHTML = '';

    if (sub.isPractice) {
        actionsHTML = `
            <button class="rate-btn" onclick="openRatingModal('${sub.id}', '${sub.name}', 'practice')">
                Оценить практику
            </button>
        `;
    } else if (sub.isCoursework) {
        actionsHTML = `
            <button class="rate-btn" onclick="openRatingModal('${sub.id}', '${sub.name}', 'coursework')">
                Оценить курсовую
            </button>
        `;
    } else {
        // Lecture and Seminar buttons
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
    }

    // Teacher names
    let teacherInfo = '';
    if (sub.teachers) {
        if (sub.teachers.lecture && sub.teachers.seminar) {
            teacherInfo = `<p class="teacher-names">Лек: ${sub.teachers.lecture}<br>Сем: ${sub.teachers.seminar}</p>`;
        } else if (sub.teachers.lecture) {
            teacherInfo = `<p class="teacher-names">Ведет: ${sub.teachers.lecture}</p>`;
        }
    }

    card.innerHTML = `
        <h3 class="teacher-name">${sub.name}</h3>
        <span class="badge" style="margin-bottom: 10px; display: inline-block;">${sub.type}</span>
        ${teacherInfo}
        <div style="margin-top: 15px;">
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
    if (type === 'practice') typeName = 'Практику';
    if (type === 'coursework') typeName = 'Курсовую работу';

    document.getElementById('modal-teacher-name').textContent = subjectName;
    document.getElementById('modal-subject').textContent = `Оцениваем: ${typeName}`;

    // Hide lesson selection (legacy), Show Form directly
    document.getElementById('lesson-selection').classList.add('hidden');
    document.getElementById('rating-form').classList.remove('hidden');

    // Hide "Selected Info" (Legacy)
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
document.getElementById('back-to-lessons').style.display = 'none'; // Hide legacy back button

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

    // Save to LocalStorage (Simulation)
    const review = {
        subjectId: currentSubject,
        type: currentType,
        rating: selectedRating,
        tags: selectedTags,
        comment: document.getElementById('comment-input').value,
        date: new Date().toISOString()
    };

    // Store in a list
    const reviews = JSON.parse(localStorage.getItem('my_reviews') || '[]');
    reviews.push(review);
    localStorage.setItem('my_reviews', JSON.stringify(reviews));

    alert('✅ Ваш отзыв сохранен! Он анонимен.');
    closeModal();
});

// Init
loadContent();
