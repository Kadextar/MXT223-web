import { setScheduleData, getUniqueSubjects, getProgressBySubject } from './schedule_data.js';
import { showToast } from './toast.js';
import './theme_init.js';

// --- Exams (second section on this page) ---
function getAuthHeaders() {
    const t = localStorage.getItem('access_token');
    return t ? { Authorization: `Bearer ${t}` } : {};
}
function getCountdown(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(dateStr + 'T12:00:00');
    examDate.setHours(0, 0, 0, 0);
    const diffDays = Math.round((examDate - today) / (1000 * 60 * 60 * 24));
    if (diffDays < 0) return { label: 'Прошёл', className: 'past' };
    if (diffDays === 0) return { label: 'Сегодня', className: 'today' };
    if (diffDays === 1) return { label: 'Завтра', className: 'tomorrow' };
    return { label: diffDays <= 31 ? `Через ${diffDays} дн.` : `${diffDays} дн.`, className: 'days' };
}
function escapeHtmlExam(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}
async function loadExamReminders() {
    try {
        const r = await fetch('/api/exams/reminders', { headers: getAuthHeaders() });
        if (!r.ok) return new Set();
        const data = await r.json();
        return new Set(data.exam_ids || []);
    } catch {
        return new Set();
    }
}
function renderExams(exams, reminderExamIds) {
    const container = document.getElementById('exams-list');
    if (!container) return;
    if (!exams || exams.length === 0) {
        container.innerHTML = `<div class="empty-state exams-empty"><div class="empty-icon">📋</div><p>Пока нет экзаменов в расписании</p></div>`;
        return;
    }
    container.innerHTML = exams.map((exam) => {
        const countdown = getCountdown(exam.exam_date);
        const isPast = countdown.className === 'past';
        const hasReminder = reminderExamIds.has(exam.id);
        const meta = [];
        if (exam.exam_date) meta.push(`<span><i class="fas fa-calendar-day"></i> ${exam.exam_date}${exam.exam_time ? `, ${escapeHtmlExam(exam.exam_time)}` : ''}</span>`);
        if (exam.teacher) meta.push(`<span><i class="fas fa-chalkboard-teacher"></i> ${escapeHtmlExam(exam.teacher)}</span>`);
        if (exam.room) meta.push(`<span><i class="fas fa-door-open"></i> ${escapeHtmlExam(exam.room)}</span>`);
        if (exam.exam_type) meta.push(`<span><i class="fas fa-tag"></i> ${escapeHtmlExam(exam.exam_type)}</span>`);
        const remindBtn = isPast
            ? '<button type="button" class="exam-remind-btn past" disabled>Экзамен прошёл</button>'
            : hasReminder
                ? `<button type="button" class="exam-remind-btn active" data-exam-id="${exam.id}" data-action="remove"><i class="fas fa-bell-slash"></i> Напоминание включено</button>`
                : `<button type="button" class="exam-remind-btn" data-exam-id="${exam.id}" data-action="add"><i class="fas fa-bell"></i> Напомнить за день</button>`;
        return `<article class="exam-card ${isPast ? 'past' : ''}">
            <div class="exam-card-header"><h3>${escapeHtmlExam(exam.subject)}</h3><span class="exam-countdown ${countdown.className}">${countdown.label}</span></div>
            <div class="exam-meta">${meta.join('')}</div>
            ${exam.notes ? `<div class="exam-notes">${escapeHtmlExam(exam.notes)}</div>` : ''}
            <div class="exam-remind-row">${remindBtn}</div>
        </article>`;
    }).join('');
    container.querySelectorAll('.exam-remind-btn[data-exam-id]').forEach((btn) => btn.addEventListener('click', handleExamRemindClick));
}
async function handleExamRemindClick(e) {
    const btn = e.currentTarget;
    const examId = parseInt(btn.dataset.examId, 10);
    const action = btn.dataset.action;
    if (!examId || !action) return;
    btn.disabled = true;
    try {
        if (action === 'add') {
            const r = await fetch(`/api/exams/${examId}/remind`, { method: 'POST', headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' } });
            if (!r.ok) { const err = await r.json().catch(() => ({})); showToast(err.detail || 'Не удалось включить напоминание', 'error'); btn.disabled = false; return; }
            showToast('Напоминание за день до экзамена включено', 'success');
        } else {
            const r = await fetch(`/api/exams/${examId}/remind`, { method: 'DELETE', headers: getAuthHeaders() });
            if (!r.ok) { showToast('Не удалось отменить напоминание', 'error'); btn.disabled = false; return; }
            showToast('Напоминание отключено', 'info');
        }
        const reminders = await loadExamReminders();
        renderExams(window.__examsList || [], reminders);
    } catch {
        showToast('Ошибка сети. Попробуйте позже.', 'error');
        btn.disabled = false;
    }
}
async function initExams() {
    const container = document.getElementById('exams-list');
    if (!container) return;
    try {
        const [examsRes, reminders] = await Promise.all([fetch('/api/exams'), loadExamReminders()]);
        if (!examsRes.ok) { container.innerHTML = '<div class="empty-state exams-empty"><p>Ошибка загрузки экзаменов</p></div>'; return; }
        const exams = await examsRes.json();
        window.__examsList = Array.isArray(exams) ? exams : [];
        renderExams(window.__examsList, reminders);
    } catch {
        container.innerHTML = '<div class="empty-state exams-empty"><p>Ошибка загрузки. Обновите страницу.</p></div>';
    }
}

// Tabs: Предметы | Экзамены (как Оценка / Лидеры / Мои оценки в рейтинге)
function initAcademicsTabs() {
    const btnSubjects = document.getElementById('tab-btn-subjects');
    const btnExams = document.getElementById('tab-btn-deadlines');
    const viewSubjects = document.getElementById('subjects-view');
    const viewExams = document.getElementById('exams-view');
    if (!btnSubjects || !btnExams || !viewSubjects || !viewExams) return;

    function showView(view, btn) {
        [btnSubjects, btnExams].forEach((b) => {
            b.classList.remove('active');
            b.setAttribute('aria-selected', 'false');
        });
        viewSubjects.classList.add('hidden');
        viewExams.classList.add('hidden');
        view.classList.remove('hidden');
        btn.classList.add('active');
        btn.setAttribute('aria-selected', 'true');
    }

    btnSubjects.addEventListener('click', () => showView(viewSubjects, btnSubjects));
    btnExams.addEventListener('click', () => showView(viewExams, btnExams));
}

// --- Deadlines logic ---
async function loadDeadlines() {
    const listEl = document.getElementById('deadlines-list');
    if (!listEl) return;
    const t = localStorage.getItem('access_token');
    if (!t) {
        listEl.innerHTML = '<li class="text-muted" style="text-align:center;">Войдите, чтобы видеть дедлайны</li>';
        return;
    }
    try {
        const res = await fetch('/api/deadlines', { headers: { Authorization: 'Bearer ' + t } });
        const data = await res.json();
        if (!Array.isArray(data)) {
            listEl.innerHTML = '<li class="text-muted" style="text-align:center;">Ошибка загрузки</li>';
            return;
        }
        if (data.length === 0) {
            listEl.innerHTML = '<li class="text-muted" style="text-align:center;">Нет дедлайнов. Отличная работа! 🎉</li>';
            return;
        }
        const today = new Date().toISOString().slice(0, 10);
        listEl.innerHTML = data.map(d => {
            const overdue = d.due_date < today;
            return `<li class="deadline-item ${overdue ? 'overdue' : ''}" data-id="${d.id}" style="display:flex; justify-content:space-between; align-items:center; background:var(--card-bg); padding:12px 16px; margin-bottom:10px; border-radius:var(--radius-md); border:1px solid var(--card-border);">
                <span class="deadline-title" style="flex:1; font-weight:600; color:var(--text-main);">${escapeHtmlExam(d.title)}</span>
                <span class="deadline-date" style="color:var(--text-muted); font-size:0.85rem; padding-right:15px;">${formatDeadlineDate(d.due_date)}</span>
                <button type="button" class="deadline-delete" data-id="${d.id}" aria-label="Удалить" style="background:transparent; border:none; color:var(--text-muted); font-size:1.2rem; cursor:pointer;">&times;</button>
            </li>`;
        }).join('');
        listEl.querySelectorAll('.deadline-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                const id = btn.getAttribute('data-id');
                const r = await fetch('/api/deadlines/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + t } });
                if (r.ok) loadDeadlines();
            });
        });
    } catch (_) {
        listEl.innerHTML = '<li class="text-muted" style="text-align:center;">Нет соединения</li>';
    }
}

function formatDeadlineDate(s) {
    const d = new Date(s);
    return d.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short', year: 'numeric' });
}

function initDeadlines() {
    const form = document.getElementById('deadline-form');
    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            const title = document.getElementById('deadline-title').value.trim();
            const due = document.getElementById('deadline-date').value;
            if (!title || !due) return;
            const t = localStorage.getItem('access_token');
            if (!t) return;
            try {
                const res = await fetch('/api/deadlines', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + t },
                    body: JSON.stringify({ title, due_date: due })
                });
                if (res.ok) {
                    document.getElementById('deadline-title').value = '';
                    document.getElementById('deadline-date').value = '';
                    loadDeadlines();
                    showToast('Дедлайн добавлен 📅', 'success');
                } else showToast('Ошибка при добавлении', 'error');
            } catch (_) { showToast('Ошибка сети', 'error'); }
        });
    }
    loadDeadlines();
}

// Init
async function initAcademics() {
    if (!document.getElementById('subjects-list')) return; // Guard: Only run on academics page

    // Check Auth
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.replace('/login.html');
        return;
    }

    initAcademicsTabs();
    initExams(); // load exams section in parallel
    initDeadlines();

    try {
        // Try to load from cache first for immediate render
        const cached = localStorage.getItem('cached_schedule');
        if (cached) {
            const parsed = JSON.parse(cached);
            setScheduleData(Array.isArray(parsed) ? parsed : (parsed.items || []));
            renderContent();
        }

        const response = await fetch('/api/schedule');
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();
        const list = Array.isArray(data) ? data : (data.items || []);

        localStorage.setItem('cached_schedule', JSON.stringify(list));
        localStorage.setItem('cached_schedule_time', new Date().toISOString());

        setScheduleData(list);
        renderContent();

    } catch (error) {
        console.error(error);
        if (!localStorage.getItem('cached_schedule')) {
            document.getElementById('subjects-list').innerHTML = `<p>Ошибка загрузки.</p>`;
        }
    }
}

// Metadata for subjects
export const SUBJECTS_DATA = [
    {
        id: 'strat_man',
        name: 'Стратегический менеджмент в гостиничном хозяйстве',
        type: 'Обязательный',
        credits: 6,
        hours: 180,
        lectures: 18,
        seminars: 18,
        teachers: {
            lecture: 'Усманова Нигина Маруповна',
            seminar: 'Бурхонова Наргиза Миршохидовна'
        }
    },
    {
        id: 'econ',
        name: 'Мировая экономика и международные экономические отношения',
        type: 'Выборочный',
        credits: 6,
        hours: 180,
        lectures: 18,
        seminars: 18,
        teachers: {
            lecture: 'Халимов Шахбоз Халимович',
            seminar: 'Амриева Шахзода Шухратовна'
        }
    },
    {
        id: 'quality',
        name: 'Качество и безопасность в гостиничной деятельности',
        type: 'Обязательный',
        credits: 6,
        hours: 180,
        lectures: 18,
        seminars: 18,
        teachers: {
            lecture: 'Махмудова Азиза Пирмаматовна',
            seminar: 'Мир-Джафарова Азиза Джавохировна'
        }
    },
    {
        id: 'hotel_business',
        name: 'Международный гостиничный бизнес',
        type: 'Обязательный',
        credits: 5,
        hours: 150,
        lectures: 18,
        seminars: 18,
        teachers: {
            lecture: 'Амриддинова Райхона Садриддиновна',
            seminar: 'Мейлиев Абдугани Наджмиддинович'
        }
    },
    {
        id: 'coursework',
        name: 'Курсовая работа (Международный гостиничный бизнес)',
        type: 'Обязательный',
        credits: 1,
        hours: 30,
        isCoursework: true,
        // Usually same teacher as lecture
        teachers: {
            lecture: 'Амриддинова Райхона Садриддиновна'
        }
    },
    {
        id: 'practice',
        name: 'Квалификационная практика',
        type: 'Обязательный',
        credits: 6,
        hours: 180,
        isPractice: true
    },
    {
        id: 'enlightenment',
        name: 'Урок просвещения',
        type: 'Обязательный',
        credits: 0,
        hours: 0,
        lectures: 0,
        seminars: 0
    }
];

function escapeHtml(text) {
    if (text == null) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function getProgressForSubject(subjectName, progressMap) {
    if (!progressMap[subjectName]) {
        const key = Object.keys(progressMap).find(k => k.includes(subjectName) || subjectName.includes(k));
        return key ? progressMap[key] : { lecture: 0, seminar: 0 };
    }
    return progressMap[subjectName];
}

async function openSubjectModal(sub) {
    const scheduleSubjects = getUniqueSubjects();
    let lectureTeacher = sub.teachers?.lecture;
    let seminarTeacher = sub.teachers?.seminar;
    if (!lectureTeacher || !seminarTeacher) {
        const found = scheduleSubjects.find(s => s.name.includes(sub.name) || sub.name.includes(s.name));
        if (found && found.teachers?.length) {
            if (!lectureTeacher && !seminarTeacher) lectureTeacher = found.teachers.join(', ');
        }
    }

    let statsText = '';
    if (sub.isPractice) statsText = `${sub.credits} кредитов • ${sub.hours} часов`;
    else if (sub.isCoursework) statsText = `${sub.credits} кредит • ${sub.hours} часов`;
    else if (sub.credits > 0) statsText = `${sub.credits} кредитов • ${sub.hours} часов • ${sub.lectures || 0} лекций • ${sub.seminars || 0} семинаров`;
    else statsText = 'Без кредитов';

    let teachersBlock = '';
    if (lectureTeacher || seminarTeacher) {
        teachersBlock = '<div class="subject-detail-teachers">';
        if (lectureTeacher) teachersBlock += `<div><span class="label">Лекция:</span> ${lectureTeacher}</div>`;
        if (seminarTeacher) teachersBlock += `<div><span class="label">Семинар:</span> ${seminarTeacher}</div>`;
        teachersBlock += '</div>';
    } else if (!sub.isPractice) {
        teachersBlock = '<p class="subject-detail-muted">Преподаватели уточняются</p>';
    }

    const progress = getProgressBySubject();
    const prog = getProgressForSubject(sub.name, progress);
    const totalL = sub.lectures || 0;
    const totalS = sub.seminars || 0;
    let progressBlock = '';
    if (totalL > 0 || totalS > 0) {
        progressBlock = '<div class="subject-detail-progress">';
        if (totalL > 0) progressBlock += `<div>Лекции: пройдено ${prog.lecture}/${totalL}</div>`;
        if (totalS > 0) progressBlock += `<div>Семинары: пройдено ${prog.seminar}/${totalS}</div>`;
        progressBlock += '</div>';
    }

    let summaryBlock = '';
    try {
        const res = await fetch('/api/ratings/subject-summary?subject=' + encodeURIComponent(sub.name));
        const summary = await res.json();
        if (summary && (summary.average != null || (summary.top_tags && summary.top_tags.length) || (summary.reviews && summary.reviews.length))) {
            summaryBlock = '<div class="subject-detail-summary">';
            if (summary.average != null && summary.count > 0) {
                summaryBlock += `<p class="subject-summary-avg">Средний балл: <strong>${summary.average}</strong> (оценок: ${summary.count})</p>`;
            }
            if (summary.top_tags && summary.top_tags.length) {
                summaryBlock += `<p class="subject-summary-tags">Чаще отмечают: ${summary.top_tags.slice(0, 5).join(', ')}</p>`;
            }
            if (summary.reviews && summary.reviews.length) {
                summaryBlock += '<p class="subject-summary-reviews-title">Последние отзывы:</p><ul class="subject-summary-reviews">';
                summary.reviews.forEach(r => {
                    summaryBlock += `<li>${escapeHtml(r.body)}</li>`;
                });
                summaryBlock += '</ul>';
            }
            summaryBlock += '</div>';
        }
    } catch (_) { }

    document.getElementById('subject-modal-body').innerHTML = `
        <h2 class="subject-detail-title">${sub.name}</h2>
        ${sub.type ? `<span class="tag">${sub.type}</span>` : ''}
        <p class="subject-detail-stats">${statsText}</p>
        ${progressBlock}
        ${summaryBlock}
        ${teachersBlock}
    `;
    document.getElementById('subject-modal').classList.remove('hidden');
}

function renderContent() {
    const subjectsList = document.getElementById('subjects-list');
    const teachersList = document.getElementById('teachers-list');
    const scheduleSubjects = getUniqueSubjects();
    const progressMap = getProgressBySubject();

    subjectsList.innerHTML = '';
    teachersList.innerHTML = '';

    SUBJECTS_DATA.forEach((sub, index) => {
        const card = document.createElement('div');
        card.className = 'info-card subject-card subject-card-clickable';

        let statsHTML = '';
        if (sub.isPractice) {
            statsHTML = `<div class="subject-stats">${sub.credits} кредитов • ${sub.hours} часов</div>`;
        } else if (sub.isCoursework) {
            statsHTML = `<div class="subject-stats">${sub.credits} кредит • ${sub.hours} часов</div>`;
        } else if (sub.credits > 0) {
            statsHTML = `<div class="subject-stats">${sub.credits} кредитов • ${sub.hours} часов • ${sub.lectures} лекций • ${sub.seminars} семинаров</div>`;
        } else {
            statsHTML = `<div class="subject-stats" style="color: var(--text-muted);">Без кредитов</div>`;
        }

        const prog = getProgressForSubject(sub.name, progressMap);
        const totalL = sub.lectures || 0;
        const totalS = sub.seminars || 0;
        let progressHTML = '';
        if (totalL > 0 || totalS > 0) {
            progressHTML = '<div class="subject-progress">';
            if (totalL > 0) progressHTML += `<div class="subject-progress-row"><span class="subject-progress-label">Лекция:</span> пройдено ${prog.lecture}/${totalL}</div>`;
            if (totalS > 0) progressHTML += `<div class="subject-progress-row"><span class="subject-progress-label">Семинар:</span> пройдено ${prog.seminar}/${totalS}</div>`;
            progressHTML += '</div>';
        }

        card.innerHTML = `
            <div class="subject-number">${index + 1}</div>
            <div class="card-content">
                <div class="subject-header">
                    <h3>${sub.name}</h3>
                    ${sub.type ? `<span class="tag">${sub.type}</span>` : ''}
                </div>
                ${statsHTML}
                ${progressHTML}
                <div class="subject-tap-hint">Нажмите, чтобы подробнее</div>
            </div>
        `;
        card.addEventListener('click', () => openSubjectModal(sub));
        subjectsList.appendChild(card);
    });

    // --- Teachers Tab (Aggregated from valid subjects) ---
    // We already have hardcoded teachers + schedule teachers.
    const allTeachers = new Set();

    // Add hardcoded
    SUBJECTS_DATA.forEach(s => {
        if (s.teachers?.lecture) allTeachers.add(s.teachers.lecture);
        if (s.teachers?.seminar) allTeachers.add(s.teachers.seminar);
    });

    // Add remaining from schedule
    scheduleSubjects.forEach(s => s.teachers.forEach(t => allTeachers.add(t)));

    allTeachers.forEach(teacher => {
        if (!teacher) return;
        const card = document.createElement('div');
        card.className = 'info-card';
        // Random avatar color
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        card.innerHTML = `
            <div class="card-icon" style="background: ${color}20; color: ${color}; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                <i class="fas fa-user-tie"></i>
            </div>
            <div class="card-content">
                <h3>${teacher}</h3>
                <p>Преподаватель</p>
            </div>
        `;
        teachersList.appendChild(card);
    });
}

const subjectModal = document.getElementById('subject-modal');
const subjectModalClose = document.getElementById('subject-modal-close');
const subjectModalOverlay = document.querySelector('.subject-modal-overlay');

if (subjectModalClose) subjectModalClose.addEventListener('click', () => subjectModal.classList.add('hidden'));
if (subjectModalOverlay) subjectModalOverlay.addEventListener('click', () => subjectModal.classList.add('hidden'));

initAcademics();
