// Theme Initialization + font size + theme by time

export function initTheme() {
    const savedTheme = localStorage.getItem('theme');
    const themeAuto = localStorage.getItem('theme_auto') === 'true';
    const fontLarge = localStorage.getItem('font_large') === 'true';

    if (themeAuto) {
        const hour = new Date().getHours();
        if (hour >= 6 && hour < 21) document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
    } else {
        if (savedTheme === 'light') document.body.classList.add('light-mode');
        else document.body.classList.remove('light-mode');
    }
    if (fontLarge) document.body.classList.add('font-large');
    else document.body.classList.remove('font-large');
}

initTheme();
