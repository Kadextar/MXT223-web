import { setScheduleData, getUniqueSubjects } from './schedule_data.js';
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
        // Fetch Schedule Data
        const response = await fetch('/api/debug/schedule-nocache');
        if (!response.ok) throw new Error('Failed to load data');
        const data = await response.json();

        setScheduleData(data); // Populate data store
        renderContent();

        // Load exams for second tab
        await loadExams();
        initTabs();
    } catch (error) {
        console.error(error);
        document.getElementById('subjects-list').innerHTML = `<p>Ошибка загрузки.</p>`;
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

function renderContent() {
    const subjectsList = document.getElementById('subjects-list');
    const teachersList = document.getElementById('teachers-list');

    // Calculate teachers from Schedule Data to fill gaps
    const scheduleSubjects = getUniqueSubjects();
    const scheduleTeacherMap = {}; // { "Subject Name": { lectures: [], seminars: [] } }

    scheduleSubjects.forEach(s => {
        // Simple mapping based on type if available, otherwise just list them
        // In our data, 'type' is on the lesson level. getUniqueSubjects aggregates them.
        // Let's refine getUniqueSubjects output or just look at raw teachers
        scheduleTeacherMap[s.name] = s.teachers;
    });

    subjectsList.innerHTML = '';
    teachersList.innerHTML = '';

    SUBJECTS_DATA.forEach((sub, index) => {
        const card = document.createElement('div');
        card.className = 'info-card subject-card';

        // Determine Teachers
        let lectureTeacher = sub.teachers?.lecture;
        let seminarTeacher = sub.teachers?.seminar;

        // If not hardcoded, try to find in schedule
        if (!lectureTeacher || !seminarTeacher) {
            const found = scheduleSubjects.find(s => s.name.includes(sub.name) || sub.name.includes(s.name));
            if (found && found.teachers.length > 0) {
                // If we have hardcoded one but not other, keep hardcoded. 
                // Currently our schedule data doesn't link teacher to type easily in the aggregated view,
                // but usually it's mixed. Let's just join them for now if missing.
                if (!lectureTeacher && !seminarTeacher) {
                    lectureTeacher = found.teachers.join(', ');
                }
            }
        }

        // Formatting HTML
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

        let teachersHTML = '';
        if (lectureTeacher || seminarTeacher) {
            teachersHTML = '<div class="subject-teachers">';
            if (lectureTeacher) teachersHTML += `<div><span class="label">Лекция:</span> ${lectureTeacher}</div>`;
            if (seminarTeacher) teachersHTML += `<div><span class="label">Семинар:</span> ${seminarTeacher}</div>`;
            teachersHTML += '</div>';
        } else if (!sub.isPractice) {
            teachersHTML = '<div class="subject-teachers" style="color: var(--text-muted); font-style: italic;">Преподаватели уточняются</div>';
        }

        card.innerHTML = `
            <div class="subject-number">${index + 1}</div>
            <div class="card-content">
                <div class="subject-header">
                    <h3>${sub.name}</h3>
                    ${sub.type ? `<span class="tag">${sub.type}</span>` : ''}
                </div>
                ${statsHTML}
                ${teachersHTML}
            </div>
        `;
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

async function loadExams() {
    const container = document.getElementById('exams-list');
    if (!container) return;
    try {
        const resp = await fetch('/api/exams');
        if (!resp.ok) throw new Error('Failed to load exams');
        const exams = await resp.json();
        if (!exams.length) {
            container.innerHTML = '<div class="empty-state"><p>Экзамены пока не добавлены.</p></div>';
            return;
        }
        container.innerHTML = '';
        exams.forEach((ex, index) => {
            const card = document.createElement('div');
            card.className = 'info-card subject-card';
            const dateStr = ex.exam_date ? new Date(ex.exam_date).toLocaleDateString('ru-RU') : '';
            const timeStr = ex.exam_time || '';
            const room = ex.room || '';
            card.innerHTML = `
                <div class="subject-number">${index + 1}</div>
                <div class="card-content">
                    <div class="subject-header">
                        <h3>${ex.subject}</h3>
                        ${ex.exam_type ? `<span class="tag">${ex.exam_type}</span>` : ''}
                    </div>
                    <div class="subject-stats">${dateStr}${timeStr ? ' • ' + timeStr : ''}${room ? ' • ' + room : ''}</div>
                    ${ex.teacher ? `<div class="subject-teachers"><div><span class="label">Преподаватель:</span> ${ex.teacher}</div></div>` : ''}
                </div>
            `;
            container.appendChild(card);
        });
    } catch (e) {
        console.error('loadExams error', e);
        container.innerHTML = '<div class="empty-state"><p>Ошибка загрузки экзаменов.</p></div>';
    }
}

function initTabs() {
    const tabSubjects = document.getElementById('tab-subjects');
    const tabExams = document.getElementById('tab-exams');
    const viewSubjects = document.getElementById('subjects-view');
    const viewExams = document.getElementById('exams-view');
    if (!tabSubjects || !tabExams || !viewSubjects || !viewExams) return;

    function setActive(which) {
        if (which === 'subjects') {
            tabSubjects.classList.add('active');
            tabExams.classList.remove('active');
            viewSubjects.classList.remove('hidden');
            viewExams.classList.add('hidden');
        } else {
            tabExams.classList.add('active');
            tabSubjects.classList.remove('active');
            viewExams.classList.remove('hidden');
            viewSubjects.classList.add('hidden');
        }
    }

    tabSubjects.addEventListener('click', () => setActive('subjects'));
    tabExams.addEventListener('click', () => setActive('exams'));
}

initAcademics();
