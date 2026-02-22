// Check Auth on load
const accessToken = localStorage.getItem('access_token');
if (!accessToken) {
    window.location.href = '/login.html';
}

// DOM
const lessonModal = document.getElementById('lesson-modal');

// Global State
let scheduleData = [];
let teachersData = [];

function showAdminMessage(el, text, isError) {
    if (!el) return;
    el.textContent = text;
    el.classList.remove('hidden', 'success', 'error');
    el.classList.add(isError ? 'error' : 'success');
}

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// API Helper
async function apiCall(endpoint, method = 'GET', data = null) {
    const headers = {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
    };

    try {
        const options = { method, headers };
        if (data) {
            options.body = JSON.stringify(data);
        }

        const response = await fetch(endpoint, options);

        if (response.status === 401 || response.status === 403) {
            alert('Нет доступа или сессия истекла');
            window.location.href = '/login.html';
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error(`API Error (${endpoint}):`, error);
        alert('Ошибка соединения с сервером');
        return null;
    }
}

// Check Admin Status
async function checkAdmin() {
    try {
        const response = await fetch('/api/admin/check', {
            headers: { 'Authorization': `Bearer ${accessToken}` }
        });

        if (!response.ok) {
            alert('Требуются права администратора!');
            window.location.href = '/';
        }
    } catch (e) {
        window.location.href = '/';
    }
}

// Stats Function
async function loadStats() {
    const ids = ['stat-students', 'stat-teachers', 'stat-ratings', 'stat-subs'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '…';
    });
    const data = await apiCall('/api/admin/stats');
    if (data) {
        const set = (id, val) => {
            const el = document.getElementById(id);
            if (el) el.textContent = val != null && val !== '' ? Number(val) : '—';
        };
        set('stat-students', data.students);
        set('stat-teachers', data.teachers);
        set('stat-ratings', data.ratings);
        set('stat-subs', data.subscriptions);
    } else {
        ids.forEach(id => {
            const el = document.getElementById(id);
            if (el) el.textContent = '—';
        });
    }
}

// --- Schedule Functions ---
const DAY_MAPPING = {
    "monday": "Понедельник",
    "tuesday": "Вторник",
    "wednesday": "Среда",
    "thursday": "Четверг",
    "friday": "Пятница"
};

const PAIR_TIMES = {
    1: "08:00 - 09:20",
    2: "09:30 - 10:50",
    3: "11:00 - 12:20"
};

async function loadSchedule() {
    const data = await apiCall('/api/admin/schedule');
    if (data) {
        scheduleData = data;
        renderSchedule(data);
        populateDatalists();
    }
}

function renderSchedule(data) {
    const tbody = document.getElementById('schedule-table-body');
    tbody.innerHTML = '';

    // Sort: Day -> Pair
    const dayOrder = { "monday": 1, "tuesday": 2, "wednesday": 3, "thursday": 4, "friday": 5 };
    data.sort((a, b) => {
        if (dayOrder[a.day] !== dayOrder[b.day]) return dayOrder[a.day] - dayOrder[b.day];
        return a.pair - b.pair;
    });

    data.forEach(item => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="День">${DAY_MAPPING[item.day]}</td>
            <td data-label="Пара">${item.pair}</td>
            <td data-label="Предмет">${item.subject}</td>
            <td data-label="Тип">${item.type === 'lecture' ? 'Лекция' : 'Семинар'}</td>
            <td data-label="Аудитория">${item.room}</td>
            <td data-label="Действия">
                <button class="action-btn" style="background:var(--primary); color:white;" onclick="window.editLesson(${item.id})">✏️</button>
                <button class="action-btn btn-delete" onclick="window.deleteLesson(${item.id})">🗑️</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteLesson = async function (id) {
    if (!confirm('Вы уверены, что хотите удалить эту пару?')) return;

    const result = await apiCall(`/api/admin/schedule/${id}`, 'DELETE');
    if (result && result.success) {
        loadSchedule(); // Limit reload to just schedule
    } else {
        alert('Ошибка при удалении: ' + (result?.error || 'Unknown error'));
    }
}

// --- Teachers Functions ---
async function loadTeachers() {
    const data = await apiCall('/api/admin/teachers');
    if (data) {
        teachersData = data;
        renderTeachers(data);
        populateDatalists();
    }
}

function renderTeachers(data) {
    const tbody = document.getElementById('teachers-table-body');
    tbody.innerHTML = '';

    data.forEach(teacher => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td data-label="Имя">${teacher.name}</td>
            <td data-label="Предмет">${teacher.subject || '-'}</td>
            <td data-label="Рейтинг">${teacher.average_rating ? teacher.average_rating.toFixed(1) : 'Нет'}</td>
            <td data-label="Действия">
                <button class="action-btn btn-delete" onclick="window.deleteTeacher(${teacher.id})">Удалить</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

window.deleteTeacher = async function (id) {
    if (!confirm('Вы уверены, что хотите удалить преподавателя?')) return;

    const result = await apiCall(`/api/admin/teachers/${id}`, 'DELETE');
    if (result && result.success) {
        loadTeachers();
    } else {
        alert('Ошибка: ' + (result?.error || 'Unknown error'));
    }
}

async function sendPushNotification() {
    const title = document.getElementById('push-title').value;
    const message = document.getElementById('push-message').value;
    const url = document.getElementById('push-url').value;
    const resultDiv = document.getElementById('push-result');

    if (!message) {
        showAdminMessage(resultDiv, 'Введите текст сообщения', true);
        return;
    }

    if (!confirm('Отправить это уведомление всем подписчикам?')) return;

    const result = await apiCall('/api/admin/push', 'POST', { title, message, url });

    if (result && result.success) {
        showAdminMessage(resultDiv, `Отправлено: ${result.sent}, Ошибок: ${result.failed}`, false);
        document.getElementById('push-message').value = '';
    } else {
        showAdminMessage(resultDiv, result?.error || 'Ошибка отправки', true);
    }
}

// --- Announcements ---
async function loadAnnouncement() {
    const data = await apiCall('/api/announcement');
    if (data) {
        document.getElementById('announcement-input').value = data.message || '';
        const ctx = data.schedule_context;
        if (ctx) {
            const w = document.getElementById('announcement-week');
            const d = document.getElementById('announcement-day');
            if (w) w.value = ctx.week_num || '';
            if (d) d.value = ctx.day || '';
        }
    }
    const stats = await apiCall('/api/admin/announcement-stats');
    const statsEl = document.getElementById('announcement-stats');
    if (statsEl && stats) statsEl.textContent = `Прочитали: ${stats.read_count} из ${stats.total_students}`;

    const reviews = await apiCall('/api/admin/subject-reviews');
    const listEl = document.getElementById('subject-reviews-list-admin');
    if (listEl) {
        if (!reviews || reviews.length === 0) listEl.innerHTML = '<p class="text-muted">Нет отзывов</p>';
        else {
            listEl.innerHTML = reviews.map(r => `
                <div class="subject-review-admin-row">
                    <div><strong>${escapeHtml(r.subject_name)}</strong><br><span class="text-muted">${escapeHtml(r.body)}</span></div>
                    ${r.moderated ? '<span class="text-muted">✓ Опубликован</span>' : `<button type="button" class="btn-add" data-review-id="${r.id}">Модерировать</button>`}
                </div>
            `).join('');
            listEl.querySelectorAll('[data-review-id]').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const id = btn.getAttribute('data-review-id');
                    await apiCall('/api/admin/subject-reviews/' + id + '/moderate', 'POST');
                    loadAnnouncement();
                });
            });
        }
    }
}

document.getElementById('save-announcement-btn').addEventListener('click', async () => {
    const message = document.getElementById('announcement-input').value;
    const weekNum = document.getElementById('announcement-week')?.value;
    const day = document.getElementById('announcement-day')?.value;
    const schedule_context = (weekNum && day) ? { week_num: parseInt(weekNum, 10), day } : null;
    const result = await apiCall('/api/admin/announcement', 'POST', { message, schedule_context });
    if (result && result.success) {
        alert('Объявление обновлено!');
    } else {
        alert('Ошибка при обновлении');
    }
});

// --- Forms & Modals ---

// Datalists
function populateDatalists() {
    // Subjects
    const subjects = [...new Set(scheduleData.map(i => i.subject))];
    const subList = document.getElementById('subjects-list');
    subList.innerHTML = subjects.map(s => `<option value="${s}">`).join('');

    // Teachers
    const teaList = document.getElementById('teachers-list');
    teaList.innerHTML = teachersData.map(t => `<option value="${t.name}">`).join('');
}

// Add Lesson
// Edit Lesson
let editingLessonId = null;

window.editLesson = function (id) {
    const lesson = scheduleData.find(item => item.id === id);
    if (!lesson) return;

    editingLessonId = id;

    // Fill form
    const form = document.getElementById('lesson-form');
    form.day.value = lesson.day;
    form.pair.value = lesson.pair;
    form.subject.value = lesson.subject;
    form.type.value = lesson.type;
    form.teacher.value = lesson.teacher;
    form.room.value = lesson.room;

    // Change UI
    document.getElementById('lesson-modal-title').textContent = 'Редактировать пару';
    document.getElementById('lesson-submit-btn').textContent = 'Сохранить';

    lessonModal.classList.remove('hidden');
}

// Reset form on close
function resetLessonForm() {
    editingLessonId = null;
    document.getElementById('lesson-form').reset();
    document.getElementById('lesson-modal-title').textContent = 'Добавить пару';
    document.getElementById('lesson-submit-btn').textContent = 'Добавить';
    lessonModal.classList.add('hidden');
}

document.getElementById('add-lesson-btn').addEventListener('click', () => {
    editingLessonId = null;
    document.getElementById('lesson-form').reset();
    document.getElementById('lesson-modal-title').textContent = 'Добавить пару';
    document.getElementById('lesson-submit-btn').textContent = 'Добавить';
    lessonModal.classList.remove('hidden');
});

document.getElementById('close-lesson-modal').addEventListener('click', resetLessonForm);
lessonModal.querySelector('.modal-overlay').addEventListener('click', resetLessonForm);

document.getElementById('lesson-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        day: formData.get('day'),
        pair: parseInt(formData.get('pair')),
        subject: formData.get('subject'),
        type: formData.get('type'),
        teacher: formData.get('teacher'),
        room: formData.get('room'),
        week_start: 1,
        week_end: 18
    };

    let result;
    if (editingLessonId) {
        // UPDATE
        result = await apiCall(`/api/admin/schedule/${editingLessonId}`, 'PUT', data);
    } else {
        // CREATE
        result = await apiCall('/api/admin/schedule', 'POST', data);
    }

    if (result && result.success) {
        resetLessonForm();
        loadSchedule();
    } else {
        alert('Ошибка: ' + (result?.error || 'Unknown'));
    }
});

// Add Teacher
const teacherModal = document.getElementById('teacher-modal');
document.getElementById('add-teacher-btn').addEventListener('click', () => {
    teacherModal.classList.remove('hidden');
});
document.getElementById('close-teacher-modal').addEventListener('click', () => {
    teacherModal.classList.add('hidden');
});
teacherModal.querySelector('.modal-overlay').addEventListener('click', () => {
    teacherModal.classList.add('hidden');
});

document.getElementById('teacher-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);
    const data = {
        name: formData.get('name'),
        subject: formData.get('subject')
    };

    const result = await apiCall('/api/admin/teachers', 'POST', data);
    if (result && result.success) {
        teacherModal.classList.add('hidden');
        e.target.reset();
        loadTeachers();
    } else {
        alert('Ошибка: ' + (result?.error || 'Unknown'));
    }
});

// Tabs
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.admin-section').forEach(s => s.classList.remove('active'));

        btn.classList.add('active');
        document.getElementById(btn.dataset.tab).classList.add('active');
    });
});

// Init
checkAdmin();
loadStats();
loadSchedule();
loadTeachers();
loadAnnouncement();
