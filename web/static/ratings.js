// Ratings Page JavaScript

// --- Authentication Check ---
const AUTHORIZED_STUDENTS = [
    '1748727700', '1427112602', '1937736219', '207103078', '5760110758',
    '1362668588', '2023499343', '1214641616', '1020773033'
];

const studentId = localStorage.getItem('student_id');
if (!studentId || !AUTHORIZED_STUDENTS.includes(studentId)) {
    window.location.href = '/login.html';
}

// --- Constants ---
const PAIR_TIMES = {
    1: { start: '08:00', end: '09:20' },
    2: { start: '09:30', end: '10:50' },
    3: { start: '11:00', end: '12:20' }
};

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
        if (!response.ok) throw new Error('Network response was not ok');

        const teachers = await response.json();

        // Ensure loading is hidden
        loading.classList.add('hidden');

        if (!Array.isArray(teachers) || teachers.length === 0) {
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

let currentLessonData = null;

// Modal Functions
window.openRatingModal = async function (teacherId, teacherName, subject) {
    currentTeacherId = teacherId;
    document.getElementById('modal-teacher-name').textContent = teacherName;
    document.getElementById('modal-subject').textContent = subject;

    // Show lesson selection, hide form
    document.getElementById('lesson-selection').classList.remove('hidden');
    document.getElementById('rating-form').classList.add('hidden');

    // Load today's lessons
    try {
        const response = await fetch(`/api/teachers/${teacherId}/today-lessons`);
        const data = await response.json();

        if (data.error) {
            alert('Ошибка: ' + data.error);
            closeModal();
            return;
        }

        renderLessons(data.lessons, data.today);
    } catch (error) {
        console.error('Failed to load lessons:', error);
        alert('Не удалось загрузить занятия');
        closeModal();
    }

    modal.classList.remove('hidden');
}

function renderLessons(lessons, today) {
    const lessonsList = document.getElementById('lessons-list');
    const noLessonsMsg = document.getElementById('no-lessons-msg');

    lessonsList.innerHTML = '';

    const completedLessons = lessons.filter(l => l.is_completed);

    if (completedLessons.length === 0) {
        noLessonsMsg.classList.remove('hidden');
        lessonsList.classList.add('hidden');
        return;
    }

    noLessonsMsg.classList.add('hidden');
    lessonsList.classList.remove('hidden');

    lessons.forEach(lesson => {
        const card = document.createElement('div');
        card.className = `lesson-card ${!lesson.is_completed ? 'disabled' : ''}`;

        const pairTimes = {
            1: '08:00-09:20',
            2: '09:30-10:50',
            3: '11:00-12:20'
        };

        card.innerHTML = `
            <div class="lesson-header">
                <span class="lesson-title">${lesson.pair_number} пара (${pairTimes[lesson.pair_number]})</span>
                <span class="lesson-status ${lesson.is_completed ? 'completed' : 'in-progress'}">
                    ${lesson.is_completed ? '✓ Завершено' : '⏳ Идёт'}
                </span>
            </div>
            <div class="lesson-details">
                ${lesson.subject} (${lesson.lesson_type})<br>
                Аудитория: ${lesson.room}
            </div>
        `;

        if (lesson.is_completed) {
            card.addEventListener('click', () => selectLesson(lesson));
        }

        lessonsList.appendChild(card);
    });
}

function selectLesson(lesson) {
    currentLessonData = lesson;

    // Hide lesson selection, show form
    document.getElementById('lesson-selection').classList.add('hidden');
    document.getElementById('rating-form').classList.remove('hidden');

    // Show selected lesson info
    const pairTimes = {
        1: '08:00-09:20',
        2: '09:30-10:50',
        3: '11:00-12:20'
    };

    document.getElementById('selected-lesson-info').innerHTML = `
        <strong>Оцениваете:</strong> ${lesson.subject} (${lesson.lesson_type})<br>
        <strong>Пара:</strong> ${lesson.pair_number} (${pairTimes[lesson.pair_number]})<br>
        <strong>Аудитория:</strong> ${lesson.room}
    `;

    // Reset form
    selectedRating = null;
    selectedTags = [];
    ratingInput.value = '';
    ratingDisplay.textContent = 'Выберите оценку';
    document.getElementById('comment-input').value = '';

    // Reset buttons
    document.querySelectorAll('.emoji-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelectorAll('.tag-btn').forEach(btn => btn.classList.remove('active'));
}

function closeModal() {
    modal.classList.add('hidden');
    currentTeacherId = null;
}

closeModalBtn.addEventListener('click', closeModal);
modal.querySelector('.modal-overlay').addEventListener('click', closeModal);

// Back to lesson selection
document.getElementById('back-to-lessons').addEventListener('click', function () {
    document.getElementById('rating-form').classList.add('hidden');
    document.getElementById('lesson-selection').classList.remove('hidden');
});

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

    if (!currentLessonData) {
        alert('Ошибка: занятие не выбрано');
        return;
    }

    const submitBtn = document.getElementById('submit-btn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Отправка...';

    try {
        // Use student_id from localStorage
        const storedStudentId = localStorage.getItem('student_id');

        const response = await fetch(`/api/teachers/${currentTeacherId}/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                student_id: storedStudentId,
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
            // Check if banner was closed before
            const isClosed = localStorage.getItem('bannerClosed');

            // Allow showing if messaged matches stored or simple check
            // For simplicity, just check existence
            if (!isClosed) {
                const banner = document.getElementById('announcement-banner');
                const text = document.getElementById('announcement-text');
                const closeBtn = document.getElementById('close-banner-btn');

                text.textContent = data.message;
                banner.classList.remove('hidden');

                if (closeBtn) {
                    closeBtn.addEventListener('click', () => {
                        banner.classList.add('hidden');
                        localStorage.setItem('bannerClosed', 'true');
                    });
                }
            }
        }
    } catch (error) {
        console.error('Failed to load announcement:', error);
    }
}

// Initialize
loadTeachers();
loadAnnouncement();
