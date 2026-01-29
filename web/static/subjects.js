// Subjects Catalog JavaScript

let allSubjects = [];
let currentFilter = 'all';

// Subject icons mapping
const subjectIcons = {
    'Стратегический менеджмент': '🎯',
    'Управление качеством': '⭐',
    'Экономика': '💰',
    'Международный бизнес': '🌍',
    'default': '📚'
};

// Load subjects from API
async function loadSubjects() {
    try {
        const response = await fetch('/api/subjects');
        if (!response.ok) throw new Error('Failed to load subjects');

        const data = await response.json();
        allSubjects = data;

        document.getElementById('loading').classList.add('hidden');

        if (allSubjects.length === 0) {
            document.getElementById('empty-state').classList.remove('hidden');
        } else {
            renderSubjects();
        }
    } catch (error) {
        console.error('Error loading subjects:', error);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
    }
}

// Render subjects based on filter
function renderSubjects() {
    const container = document.getElementById('subjects-grid');
    container.innerHTML = '';

    const filtered = currentFilter === 'all'
        ? allSubjects
        : allSubjects.filter(s => s.types.includes(currentFilter));

    if (filtered.length === 0) {
        document.getElementById('empty-state').classList.remove('hidden');
        return;
    }

    document.getElementById('empty-state').classList.add('hidden');

    filtered.forEach(subject => {
        const card = createSubjectCard(subject);
        container.appendChild(card);
    });
}

// Create subject card element
function createSubjectCard(subject) {
    const card = document.createElement('div');
    card.className = 'subject-card';

    const icon = subjectIcons[subject.name] || subjectIcons.default;

    const typeBadges = subject.types.map(type => {
        const label = type === 'lecture' ? 'Лекция' : 'Семинар';
        return `<span class="type-badge ${type}">${label}</span>`;
    }).join('');

    card.innerHTML = `
        <div class="subject-header">
            <div class="subject-icon">${icon}</div>
            <div class="subject-title">
                <h3>${subject.name}</h3>
                <div class="subject-teacher">
                    👨‍🏫 ${subject.teacher}
                </div>
            </div>
        </div>
        
        <div class="subject-types">
            ${typeBadges}
        </div>
        
        <div class="subject-stats">
            <div class="stat">
                <span class="stat-icon">📖</span>
                <span>${subject.lectures} лекций</span>
            </div>
            <div class="stat">
                <span class="stat-icon">✍️</span>
                <span>${subject.seminars} семинаров</span>
            </div>
            <div class="stat">
                <span class="stat-icon">⏰</span>
                <span>${subject.total_hours} часов</span>
            </div>
        </div>
    `;

    return card;
}

// Filter tabs handler
document.querySelectorAll('.filter-tab').forEach(tab => {
    tab.addEventListener('click', () => {
        // Update active tab
        document.querySelectorAll('.filter-tab').forEach(t => t.classList.remove('active'));
        tab.classList.add('active');

        // Update filter and re-render
        currentFilter = tab.dataset.filter;
        renderSubjects();
    });
});

// Initialize
loadSubjects();
