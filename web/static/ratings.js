// Ratings Page JavaScript

let currentTeacherId = null;
let selectedRating = null;
let selectedTags = [];

// DOM Elements
const teachersContainer = document.getElementById('teachers-container');
const loading = document.getElementById('loading');
const emptyState = document.getElementById('empty-state');
const modal = document.getElementById('rating-modal');
const closeModalBtn = document.getElementById('close-modal');
const ratingForm = document.getElementById('rating-form');
const ratingDisplay = document.getElementById('rating-display');
const ratingInput = document.getElementById('rating-input');

// Load teachers on page load
async function loadTeachers() {
    try {
        const response = await fetch('/api/teachers');
        const teachers = await response.json();

        loading.classList.add('hidden');

        if (teachers.length === 0) {
            emptyState.classList.remove('hidden');
            return;
        }

        renderTeachers(teachers);
    } catch (error) {
        console.error('Failed to load teachers:', error);
        loading.classList.add('hidden');
        emptyState.classList.remove('hidden');
    }
}

function renderTeachers(teachers) {
    teachersContainer.innerHTML = '';

    teachers.forEach(teacher => {
        const card = createTeacherCard(teacher);
        teachersContainer.appendChild(card);
    });
}

function createTeacherCard(teacher) {
    const card = document.createElement('div');
    card.className = 'teacher-card';

    const avgRating = teacher.average_rating || 0;
    const grade = getGrade(avgRating);
    const gradeClass = `grade-${grade}`;

    card.innerHTML = `
        <h3 class="teacher-name">${teacher.name}</h3>
        <p class="teacher-subject">${teacher.subject || 'Предмет не указан'}</p>
        
        ${teacher.total_ratings > 0 ? `
            <div class="teacher-rating">
                <span class="rating-score">${avgRating.toFixed(1)}</span>
                <span class="rating-grade ${gradeClass}">${grade}</span>
            </div>
            <p class="rating-count">📊 ${teacher.total_ratings} из 9 студентов оценили</p>
        ` : `
            <p class="rating-count">Еще нет оценок</p>
        `}
        
        <button class="rate-btn" onclick="openRatingModal(${teacher.id}, '${teacher.name}', '${teacher.subject || ''}')">
            Оценить преподавателя
        </button>
    `;

    return card;
}

function getGrade(rating) {
    if (rating >= 90) return 5;
    if (rating >= 70) return 4;
    if (rating >= 60) return 3;
    return 2;
}

// Modal Functions
window.openRatingModal = function (teacherId, teacherName, subject) {
    currentTeacherId = teacherId;
    document.getElementById('modal-teacher-name').textContent = teacherName;
    document.getElementById('modal-subject').textContent = subject;

    // Reset form
    selectedRating = null;
    selectedTags = [];
    ratingInput.value = '';
    ratingDisplay.textContent = 'Выберите оценку';
    document.getElementById('comment-input').value = '';
    document.getElementById('student-id-input').value = '';

    // Reset buttons
    document.querySelectorAll('.emoji-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));

    modal.classList.remove('hidden');
}

function closeModal() {
    modal.classList.add('hidden');
    currentTeacherId = null;
}

closeModalBtn.addEventListener('click', closeModal);
modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

// Emoji Rating
document.querySelectorAll('.emoji-btn').forEach(btn => {
    btn.addEventListener('click', function () {
        selectedRating = parseInt(this.dataset.rating);
        ratingInput.value = selectedRating;

        // Update active state
        document.querySelectorAll('.emoji-btn').forEach(b => b.classList.remove('active'));
        this.classList.add('active');

        // Update display
        const labels = {
            20: '20/100 - Плохо',
            40: '40/100 - Неудовлетворительно',
            60: '60/100 - Удовлетворительно',
            80: '80/100 - Хорошо',
            100: '100/100 - Отлично!'
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

// Form Submit
ratingForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    if (!selectedRating) {
        alert('Пожалуйста, выберите оценку');
        return;
    }

    const studentId = document.getElementById('student-id-input').value.trim();
    if (!studentId) {
        alert('Пожалуйста, введите ваш ID');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
        const response = await fetch(`/api/teachers/${currentTeacherId}/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                student_id: studentId,
                rating: selectedRating,
                tags: selectedTags.join(', '),
                comment: document.getElementById('comment-input').value.trim()
            })
        });

        const result = await response.json();

        if (result.success) {
            alert('✅ Спасибо за вашу оценку!');
            closeModal();
            loadTeachers(); // Reload to show updated ratings
        } else {
            alert('❌ Ошибка: ' + (result.error || 'Не удалось сохранить оценку'));
        }
    } catch (error) {
        console.error('Submit error:', error);
        alert('❌ Ошибка при отправке оценки');
    } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Отправить оценку';
    }
});

// Load announcement
async function loadAnnouncement() {
    try {
        const response = await fetch('/api/announcement');
        const data = await response.json();

        if (data && data.message) {
            const banner = document.getElementById('announcement-banner');
            const text = document.getElementById('announcement-text');
            text.textContent = data.message;
            banner.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Failed to load announcement:', error);
    }
}

// Initialize
loadTeachers();
loadAnnouncement();
