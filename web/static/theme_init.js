// Theme Initialization
// Immediately check and apply theme before content loads to prevent flash

export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
    } else {
        document.body.classList.remove('light-mode');
    }
}

// Auto-run on import to ensure it happens ASAP
initTheme();
