import { setScheduleData, getUniqueSubjects } from './schedule_data.js';

// Init
async function initAcademics() {
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

    } catch (error) {
        console.error(error);
        document.getElementById('subjects-list').innerHTML = `<p>Ошибка загрузки.</p>`;
    }
}

function renderContent() {
    const subjects = getUniqueSubjects();
    const subjectsList = document.getElementById('subjects-list');
    const teachersList = document.getElementById('teachers-list');

    subjectsList.innerHTML = '';
    teachersList.innerHTML = '';

    // Render Subjects
    subjects.forEach(sub => {
        const card = document.createElement('div');
        card.className = 'info-card';
        card.innerHTML = `
            <div class="card-icon" style="background: rgba(59, 130, 246, 0.1); color: #3b82f6;">📚</div>
            <div class="card-content">
                <h3>${sub.name}</h3>
                <p>${sub.teachers.join(', ') || 'Преподаватель не указан'}</p>
                <span class="badge" style="background: rgba(0,0,0,0.05); color: var(--text-muted); font-size: 0.8rem; padding: 2px 8px; border-radius: 6px;">
                    ${sub.type === 'lecture' ? 'Лекция' : 'Семинар/Практика'}
                </span>
            </div>
        `;
        subjectsList.appendChild(card);
    });

    // Extract Unique Teachers
    const allTeachers = new Set();
    subjects.forEach(s => s.teachers.forEach(t => allTeachers.add(t)));

    // Render Teachers
    allTeachers.forEach(teacher => {
        const card = document.createElement('div');
        card.className = 'info-card';
        // Random avatar color
        const colors = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6'];
        const color = colors[Math.floor(Math.random() * colors.length)];

        card.innerHTML = `
            <div class="card-icon" style="background: ${color}20; color: ${color}; border-radius: 50%;">
                <i class="fas fa-chalkboard-teacher"></i>
            </div>
            <div class="card-content">
                <h3>${teacher}</h3>
                <p>Преподаватель</p>
                <!-- Can add linked subjects later -->
            </div>
        `;
        teachersList.appendChild(card);
    });
}

initAcademics();
