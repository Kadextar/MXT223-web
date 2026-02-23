/**
 * Exams page: list with countdown + "Remind 1 day before" (push).
 */
import { showToast } from './toast.js';

const token = localStorage.getItem('access_token');
if (!token) {
    window.location.replace('/login.html');
}

function getAuthHeaders() {
    return { Authorization: `Bearer ${token}` };
}

/**
 * @param {string} dateStr YYYY-MM-DD
 * @returns {{ label: string, className: string }}
 */
function getCountdown(dateStr) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const examDate = new Date(dateStr + 'T12:00:00');
    examDate.setHours(0, 0, 0, 0);
    const diffMs = examDate - today;
    const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return { label: 'Прошёл', className: 'past' };
    if (diffDays === 0) return { label: 'Сегодня', className: 'today' };
    if (diffDays === 1) return { label: 'Завтра', className: 'tomorrow' };
    if (diffDays <= 31) return { label: `Через ${diffDays} дн.`, className: 'days' };
    return { label: `${diffDays} дн.`, className: 'days' };
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

async function loadReminders() {
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
        container.innerHTML = `
            <div class="empty-state exams-empty">
                <div class="empty-icon">📋</div>
                <p>Пока нет экзаменов в расписании</p>
                <p class="subtitle">Они появятся, когда админ добавит сессию</p>
            </div>`;
        return;
    }

    const today = new Date().toISOString().slice(0, 10);

    container.innerHTML = exams.map((exam) => {
        const countdown = getCountdown(exam.exam_date);
        const isPast = countdown.className === 'past';
        const hasReminder = reminderExamIds.has(exam.id);
        const subject = escapeHtml(exam.subject);
        const teacher = exam.teacher ? escapeHtml(exam.teacher) : '';
        const room = exam.room ? escapeHtml(exam.room) : '';
        const examType = exam.exam_type ? escapeHtml(exam.exam_type) : '';
        const time = exam.exam_time ? escapeHtml(exam.exam_time) : '';
        const notes = exam.notes ? escapeHtml(exam.notes) : '';

        const meta = [];
        if (exam.exam_date) meta.push(`<span><i class="fas fa-calendar-day"></i> ${exam.exam_date}${time ? `, ${time}` : ''}</span>`);
        if (teacher) meta.push(`<span><i class="fas fa-chalkboard-teacher"></i> ${teacher}</span>`);
        if (room) meta.push(`<span><i class="fas fa-door-open"></i> ${room}</span>`);
        if (examType) meta.push(`<span><i class="fas fa-tag"></i> ${examType}</span>`);

        const remindBtn = isPast
            ? '<button type="button" class="exam-remind-btn past" disabled>Экзамен прошёл</button>'
            : hasReminder
                ? `<button type="button" class="exam-remind-btn active" data-exam-id="${exam.id}" data-action="remove" aria-label="Отменить напоминание">
                       <i class="fas fa-bell-slash"></i> Напоминание включено
                   </button>`
                : `<button type="button" class="exam-remind-btn" data-exam-id="${exam.id}" data-action="add" aria-label="Напомнить за день до экзамена">
                       <i class="fas fa-bell"></i> Напомнить за день
                   </button>`;

        return `
            <article class="exam-card ${isPast ? 'past' : ''}" data-exam-id="${exam.id}">
                <div class="exam-card-header">
                    <h3>${subject}</h3>
                    <span class="exam-countdown ${countdown.className}" aria-label="До экзамена">${countdown.label}</span>
                </div>
                <div class="exam-meta">${meta.join('')}</div>
                ${notes ? `<div class="exam-notes">${notes}</div>` : ''}
                <div class="exam-remind-row">${remindBtn}</div>
            </article>`;
    }).join('');

    container.querySelectorAll('.exam-remind-btn[data-exam-id]').forEach((btn) => {
        btn.addEventListener('click', handleRemindClick);
    });
}

async function handleRemindClick(e) {
    const btn = e.currentTarget;
    const examId = parseInt(btn.dataset.examId, 10);
    const action = btn.dataset.action;
    if (!examId || !action) return;

    btn.disabled = true;
    try {
        if (action === 'add') {
            const r = await fetch(`/api/exams/${examId}/remind`, {
                method: 'POST',
                headers: { ...getAuthHeaders(), 'Content-Type': 'application/json' },
            });
            if (!r.ok) {
                const err = await r.json().catch(() => ({}));
                showToast(err.detail || 'Не удалось включить напоминание', 'error');
                btn.disabled = false;
                return;
            }
            showToast('Напоминание за день до экзамена включено', 'success');
        } else {
            const r = await fetch(`/api/exams/${examId}/remind`, {
                method: 'DELETE',
                headers: getAuthHeaders(),
            });
            if (!r.ok) {
                showToast('Не удалось отменить напоминание', 'error');
                btn.disabled = false;
                return;
            }
            showToast('Напоминание отключено', 'info');
        }
        const reminders = await loadReminders();
        const exams = window.__examsList || [];
        renderExams(exams, reminders);
    } catch (err) {
        showToast('Ошибка сети. Попробуйте позже.', 'error');
        btn.disabled = false;
    }
}

async function init() {
    const container = document.getElementById('exams-list');
    if (!container) return;

    try {
        const [examsRes, remindersRes] = await Promise.all([
            fetch('/api/exams'),
            loadReminders(),
        ]);

        if (!examsRes.ok) {
            container.innerHTML = '<div class="empty-state exams-empty"><p>Ошибка загрузки экзаменов</p></div>';
            return;
        }

        const exams = await examsRes.json();
        window.__examsList = Array.isArray(exams) ? exams : [];
        renderExams(window.__examsList, remindersRes);
    } catch (err) {
        console.error(err);
        container.innerHTML = '<div class="empty-state exams-empty"><p>Ошибка загрузки. Обновите страницу.</p></div>';
    }
}

init();
