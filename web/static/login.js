// Login Page JavaScript
import './theme_init.js';
import { showToast } from './toast.js';
import { login as apiLogin } from './api/auth.js';

const loginForm = document.getElementById('login-form');
const telegramIdInput = document.getElementById('telegram-id');
const passwordInput = document.getElementById('password');
const passwordToggle = document.getElementById('password-toggle');

// Глазок: показать/скрыть пароль
if (passwordToggle && passwordInput) {
    passwordToggle.addEventListener('click', function () {
        const isPassword = passwordInput.type === 'password';
        passwordInput.type = isPassword ? 'text' : 'password';
        passwordToggle.setAttribute('aria-pressed', isPassword ? 'true' : 'false');
        passwordToggle.setAttribute('title', isPassword ? 'Скрыть пароль' : 'Показать пароль');
        passwordToggle.setAttribute('aria-label', isPassword ? 'Скрыть пароль' : 'Показать пароль');
    });
}

const totpGroup = document.getElementById('totp-group');
const totpCodeInput = document.getElementById('totp-code');
const rememberMeCheckbox = document.getElementById('remember-me');

loginForm.addEventListener('submit', async function (e) {
    e.preventDefault();
    const telegramId = telegramIdInput.value.trim();
    const password = passwordInput.value.trim();
    const totpCode = totpCodeInput ? totpCodeInput.value.trim() : '';
    const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;

    if (!telegramId || !password) {
        showToast('Введите ID и пароль', 'error');
        return;
    }

    const submitBtn = loginForm.querySelector('button[type="submit"]');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Вход...';

    try {
        const payload = { telegram_id: telegramId, password, remember_me: rememberMe };
        if (totpCode) payload.totp_code = totpCode;
        const { status, data: result } = await apiLogin(payload);
        if (status === 429) {
            showToast('Слишком много попыток. Подождите минуту.', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
            return;
        }
        if (result.success) {
            localStorage.setItem('access_token', result.access_token);
            localStorage.setItem('refresh_token', result.refresh_token);
            localStorage.setItem('student_id', result.user.telegram_id);
            localStorage.setItem('student_name', result.user.name);
            window.location.href = '/';
        } else {
            if (result.require_totp && totpGroup) {
                totpGroup.style.display = 'block';
                totpCodeInput && totpCodeInput.focus();
            }
            showToast(result.error || 'Ошибка входа', 'error');
            submitBtn.disabled = false;
            submitBtn.textContent = 'Войти';
        }
    } catch (error) {
        console.error('Login error:', error);
        showToast('Ошибка подключения к серверу', 'error');
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
