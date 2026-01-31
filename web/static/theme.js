// Theme management
const THEME_KEY = 'mxt223-theme';

function getTheme() {
    return localStorage.getItem(THEME_KEY) || 'light';
}

function setTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem(THEME_KEY, theme);
    updateThemeIcon(theme);
}

function updateThemeIcon(theme) {
    const icon = document.querySelector('.theme-icon');
    const text = document.querySelector('.theme-text');
    if (icon) {
        icon.textContent = theme === 'dark' ? '☀️' : '🌙';
    }
    if (text) {
        text.textContent = theme === 'dark' ? 'Светлая тема' : 'Темная тема';
    }
}

function toggleTheme() {
    const current = getTheme();
    const next = current === 'light' ? 'dark' : 'light';
    setTheme(next);
}

// Initialize theme on page load
document.addEventListener('DOMContentLoaded', () => {
    // Set theme immediately to avoid flash
    setTheme(getTheme());

    // Add event listener to toggle button
    const toggleBtn = document.getElementById('theme-toggle-btn');
    if (toggleBtn) {
        toggleBtn.addEventListener('click', toggleTheme);
    }
});

// Also set theme immediately (before DOM ready) to prevent flash
setTheme(getTheme());
