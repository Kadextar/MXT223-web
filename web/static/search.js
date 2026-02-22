// Global search functionality
let searchData = [];
let selectedIndex = 0;

// Load search data from API
async function loadSearchData() {
    try {
        const token = localStorage.getItem('access_token');
        if (!token) return;

        const headers = {
            'Authorization': `Bearer ${token}`
        };

        const [scheduleRes, teachersRes] = await Promise.all([
            fetch('/api/schedule', { headers }),
            fetch('/api/teachers', { headers }).catch(() => ({ json: async () => [] }))
        ]);

        const scheduleRaw = await scheduleRes.json();
        const schedule = Array.isArray(scheduleRaw) ? scheduleRaw : (scheduleRaw.items || []);
        const teachers = await teachersRes.json();

        searchData = [];
        schedule.forEach(item => {
                searchData.push({
                    type: 'lesson',
                    title: item.subject,
                    meta: `${item.teacher} • ${item.room} • ${item.day_of_week}`,
                    data: item
            });
        });

        const subjects = new Set();
        schedule.forEach(item => {
            if (!subjects.has(item.subject)) {
                subjects.add(item.subject);
                searchData.push({
                    type: 'subject',
                    title: item.subject,
                    meta: `Предмет`,
                    data: { subject: item.subject }
                });
            }
        });

        // Add unique teachers
        const teacherNames = new Set();
        schedule.forEach(item => {
            if (item.teacher && !teacherNames.has(item.teacher)) {
                teacherNames.add(item.teacher);
                searchData.push({
                    type: 'teacher',
                    title: item.teacher,
                    meta: `Преподаватель`,
                    data: { teacher: item.teacher }
                });
            }
        });

        // Add unique rooms
        const rooms = new Set();
        schedule.forEach(item => {
            if (item.room && !rooms.has(item.room)) {
                rooms.add(item.room);
                searchData.push({
                    type: 'room',
                    title: item.room,
                    meta: `Аудитория`,
                    data: { room: item.room }
                });
            }
        });

        console.log(`Search index loaded: ${searchData.length} items`);
    } catch (error) {
        console.error('Failed to load search data:', error);
    }
}

// Open search modal
function openSearch() {
    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.classList.remove('hidden');
        document.getElementById('search-input').focus();

        // Load data if not already loaded
        if (searchData.length === 0) {
            loadSearchData();
        }
    }
}

// Close search modal
function closeSearch() {
    const modal = document.getElementById('search-modal');
    if (modal) {
        modal.classList.add('hidden');
        document.getElementById('search-input').value = '';
        document.getElementById('search-results').innerHTML = '';
        selectedIndex = 0;
    }
}

// Perform search
function performSearch(query) {
    const resultsContainer = document.getElementById('search-results');

    if (!query.trim()) {
        resultsContainer.innerHTML = '';
        return;
    }

    const lowerQuery = query.toLowerCase();
    const results = searchData.filter(item =>
        item.title.toLowerCase().includes(lowerQuery) ||
        item.meta.toLowerCase().includes(lowerQuery)
    ).slice(0, 10);

    displayResults(results, query);
}

// Display search results
function displayResults(results, query) {
    const container = document.getElementById('search-results');

    if (results.length === 0) {
        container.innerHTML = `
            <div class="search-empty">
                <div class="search-empty-icon">🔍</div>
                <div>Ничего не найдено</div>
            </div>
        `;
        return;
    }

    container.innerHTML = results.map((item, index) => {
        const typeLabels = {
            lesson: 'Пара',
            subject: 'Предмет',
            teacher: 'Преподаватель',
            room: 'Аудитория'
        };

        return `
            <div class="search-result-item ${index === 0 ? 'selected' : ''}" 
                 data-index="${index}"
                 onclick="selectResult(${index})">
                <div class="search-result-title">${highlightMatch(item.title, query)}</div>
                <div class="search-result-meta">
                    <span class="search-result-type">${typeLabels[item.type]}</span>
                    ${item.meta}
                </div>
            </div>
        `;
    }).join('');

    selectedIndex = 0;
}

// Highlight matching text
function highlightMatch(text, query) {
    if (!query) return text;
    const regex = new RegExp(`(${escapeRegex(query)})`, 'gi');
    return text.replace(regex, '<mark>$1</mark>');
}

// Escape regex special characters
function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// Update selection highlight
function updateSelection() {
    document.querySelectorAll('.search-result-item').forEach((item, index) => {
        item.classList.toggle('selected', index === selectedIndex);
        if (index === selectedIndex) {
            item.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
        }
    });
}

// Select result
function selectResult(index) {
    const results = document.querySelectorAll('.search-result-item');
    if (index >= 0 && index < results.length) {
        // Get the selected item data
        const item = searchData.filter(item => {
            const query = document.getElementById('search-input').value.toLowerCase();
            return item.title.toLowerCase().includes(query) ||
                item.meta.toLowerCase().includes(query);
        })[index];

        console.log('Selected:', item);

        // Handle selection based on type
        if (item.type === 'subject') {
            // Could navigate to subjects page or filter schedule
            window.location.href = '/subjects.html';
        } else if (item.type === 'teacher') {
            // Could navigate to ratings page
            window.location.href = '/ratings.html';
        }

        closeSearch();
    }
}

// Keyboard navigation
document.addEventListener('keydown', (e) => {
    const modal = document.getElementById('search-modal');
    if (!modal) return;

    const isOpen = !modal.classList.contains('hidden');

    // Ctrl+K or Cmd+K to open
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        if (isOpen) {
            closeSearch();
        } else {
            openSearch();
        }
        return;
    }

    if (!isOpen) return;

    // Esc to close
    if (e.key === 'Escape') {
        e.preventDefault();
        closeSearch();
        return;
    }

    // Arrow navigation
    const results = document.querySelectorAll('.search-result-item');
    if (results.length === 0) return;

    if (e.key === 'ArrowDown') {
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % results.length;
        updateSelection();
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        selectedIndex = (selectedIndex - 1 + results.length) % results.length;
        updateSelection();
    } else if (e.key === 'Enter') {
        e.preventDefault();
        selectResult(selectedIndex);
    }
});

// Initialize search on page load
document.addEventListener('DOMContentLoaded', () => {
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', (e) => {
            performSearch(e.target.value);
        });
    }

    // Load search data in background
    setTimeout(loadSearchData, 1000);
});
