// Login Page JavaScript
import './theme_init.js';

const loginForm = document.getElementById('login-form');
const telegramIdInput = document.getElementById('telegram-id');
const passwordInput = document.getElementById('password');

loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();

    const telegramId = telegramIdInput.value.trim();
    const password = passwordInput.value.trim();

    if (!telegramId || !password) {
        alert('❌ Введите ID и пароль');
        return;
    }

    // Disable button during request
    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';

    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegram_id: telegramId,
                password: password
            })
        });

        const result = await response.json();

        if (result.success) {
            // Save JWT tokens to localStorage
            localStorage.setItem('access_token', result.access_token);
            localStorage.setItem('refresh_token', result.refresh_token);
            localStorage.setItem('student_id', result.user.telegram_id);
            localStorage.setItem('student_name', result.user.name);

            // Redirect to main page
            window.location.href = '/';
        } else {
            alert('❌ ' + (result.error || 'Ошибка входа'));
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
        }
    } catch (error) {
        console.error('Login error:', error);
        alert('❌ Ошибка подключения к серверу');
        submitBtn.disabled = false;
        submitBtn.textContent = 'Войти';
    }
});

// If already logged in, redirect
// If already logged in, redirect
const token = localStorage.getItem('access_token');
if (token) {
    window.location.replace('/');
}
