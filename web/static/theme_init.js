const THEME_KEY = 'theme';
const ACCENT_KEY = 'accent';
const AMOLED_KEY = 'amoled';
const LARGE_FONT_KEY = 'large_font';
const THEME_BY_TIME_KEY = 'theme_by_time';

const ACCENT_COLORS = {
    blue: { primary: '#5b7cff', secondary: '#a78bfa' },
    purple: { primary: '#8b5cf6', secondary: '#a78bfa' },
    green: { primary: '#10b981', secondary: '#34d399' },
    orange: { primary: '#f59e0b', secondary: '#06b6d4' }
};

function prefersLight() {
    return typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches;
}

function getResolvedTheme(theme) {
    if (theme === 'system') return prefersLight() ? 'light' : 'dark';
    if (theme === 'time') {
        const h = new Date().getHours();
        return (h >= 6 && h < 21) ? 'light' : 'dark';
    }
    return theme;
}

export function applyTheme(theme) {
    const resolved = getResolvedTheme(theme);
    if (resolved === 'light') document.body.classList.add('light-mode');
    else document.body.classList.remove('light-mode');
}

export function applyAccent(accent) {
    const colors = ACCENT_COLORS[accent] || ACCENT_COLORS.blue;
    document.documentElement.style.setProperty('--primary', colors.primary);
    document.documentElement.style.setProperty('--secondary', colors.secondary);
}

export function applyAmoled(on) {
    if (on) document.body.classList.add('amoled');
    else document.body.classList.remove('amoled');
}

export function applyLargeFont(on) {
    if (on) document.body.classList.add('large-font');
    else document.body.classList.remove('large-font');
}

const STREAK_KEY = 'login_streak';
const LAST_VISIT_KEY = 'last_visit_date';

export function updateLoginStreak() {
    const today = new Date().toISOString().slice(0, 10);
    const last = localStorage.getItem(LAST_VISIT_KEY);
    let streak = parseInt(localStorage.getItem(STREAK_KEY) || '0', 10);
    if (!last) {
        streak = 1;
    } else if (last === today) {
        return;
    } else {
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);
        const yesterdayStr = yesterday.toISOString().slice(0, 10);
        if (last === yesterdayStr) streak += 1;
        else streak = 1;
    }
    localStorage.setItem(LAST_VISIT_KEY, today);
    localStorage.setItem(STREAK_KEY, String(streak));
}

export function initTheme() {
    updateLoginStreak();
    recordVisitDate();
    const saved = localStorage.getItem(THEME_KEY) || 'dark';
    applyTheme(saved);
    applyAccent(localStorage.getItem(ACCENT_KEY) || 'blue');
    applyAmoled(localStorage.getItem(AMOLED_KEY) === '1');
    applyLargeFont(localStorage.getItem(LARGE_FONT_KEY) === '1');
    if (saved === 'system' && typeof window !== 'undefined' && window.matchMedia) {
        window.matchMedia('(prefers-color-scheme: light)').addEventListener('change', () => applyTheme('system'));
    }
    if (saved === 'time') {
        setInterval(() => applyTheme('time'), 60 * 1000);
    }
}

const VISIT_HISTORY_KEY = 'visit_history';
const VISIT_HISTORY_DAYS = 90;

function recordVisitDate() {
    const today = new Date().toISOString().slice(0, 10);
    let raw = localStorage.getItem(VISIT_HISTORY_KEY) || '[]';
    let arr = [];
    try {
        arr = JSON.parse(raw);
    } catch (_) {}
    if (!arr.includes(today)) {
        arr.push(today);
        arr.sort();
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - VISIT_HISTORY_DAYS);
        const cutoffStr = cutoff.toISOString().slice(0, 10);
        arr = arr.filter(d => d >= cutoffStr);
        localStorage.setItem(VISIT_HISTORY_KEY, JSON.stringify(arr));
    }
}

export function getVisitHistory() {
    let raw = localStorage.getItem(VISIT_HISTORY_KEY) || '[]';
    try {
        return JSON.parse(raw);
    } catch (_) {
        return [];
    }
}

initTheme();
