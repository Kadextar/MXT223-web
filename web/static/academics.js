import { setScheduleData, getUniqueSubjects, getProgressBySubject } from './schedule_data.js';
import './theme_init.js';

// Init
async function initAcademics() {
    if (!document.getElementById('subjects-list')) return; // Guard: Only run on academics page

    // Check Auth
    const token = localStorage.getItem('access_token');
    if (!token) {
        window.location.replace('/login.html');
        return;
    }

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
    } catch (_) {}

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
