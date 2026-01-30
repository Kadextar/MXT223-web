// Check Auth on load
const accessToken = localStorage.getItem('access_token');
if (!accessToken) {
    window.location.href = '/login.html';
}

// Global State
let scheduleData = [];
let teachersData = [];

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
    const data = await apiCall('/api/schedule');
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
            <td>${DAY_MAPPING[item.day]}</td>
            <td>${item.pair}</td>
            <td>${item.subject}</td>
            <td>${item.type === 'lecture' ? 'Лекция' : 'Семинар'}</td>
            <td>${item.room}</td>
            <td>
                <button class="action-btn btn-delete" onclick="window.deleteLesson(${item.id})">Удалить</button>
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
    const data = await apiCall('/api/teachers');
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
            <td>${teacher.name}</td>
            <td>${teacher.subject || '-'}</td>
            <td>${teacher.average_rating ? teacher.average_rating.toFixed(1) : 'Нет'}</td>
            <td>
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

// --- Announcements ---
async function loadAnnouncement() {
    const data = await apiCall('/api/announcement');
    if (data && data.message) {
        document.getElementById('announcement-input').value = data.message;
    }
}

document.getElementById('save-announcement-btn').addEventListener('click', async () => {
    const message = document.getElementById('announcement-input').value;
    const result = await apiCall('/api/admin/announcement', 'POST', { message });
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
const lessonModal = document.getElementById('lesson-modal');
document.getElementById('add-lesson-btn').addEventListener('click', () => {
    lessonModal.classList.remove('hidden');
});
document.getElementById('close-lesson-modal').addEventListener('click', () => {
    lessonModal.classList.add('hidden');
});
lessonModal.querySelector('.modal-overlay').addEventListener('click', () => {
    lessonModal.classList.add('hidden');
});

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
        week_start: 1, // Default to all semester
        week_end: 18
    };

    const result = await apiCall('/api/admin/schedule', 'POST', data);
    if (result && result.success) {
        lessonModal.classList.add('hidden');
        e.target.reset();
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
loadSchedule();
loadTeachers();
loadAnnouncement();
