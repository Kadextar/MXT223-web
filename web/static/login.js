// Login Page JavaScript

// Список авторизованных студентов
const AUTHORIZED_STUDENTS = [
    '1748727700', // Робия
    '1427112602', // Сардор
    '1937736219', // Хислатбек
    '207103078',  // Тимур
    '5760110758', // Амир
    '1362668588', // Мухаммад
    '2023499343', // Абдумалик
    '1214641616', // Азамат
    '1020773033'  // Нозима
];

const loginForm = document.getElementById('login-form');
const telegramIdInput = document.getElementById('telegram-id');

loginForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const telegramId = telegramIdInput.value.trim();

    if (!telegramId) {
        alert('❌ Введите ваш Telegram ID');
        return;
    }

    // Проверяем, есть ли студент в списке
    if (AUTHORIZED_STUDENTS.includes(telegramId)) {
        // Сохраняем ID в localStorage
        localStorage.setItem('student_id', telegramId);

        // Перенаправляем на главную страницу
        window.location.href = '/';
    } else {
        alert('❌ Доступ запрещен!\n\nВы не являетесь студентом группы МХТ-223.\nТолько студенты группы могут войти в систему.');
        telegramIdInput.value = '';
    }
});

// Если уже авторизован, перенаправляем
const studentId = localStorage.getItem('student_id');
if (studentId && AUTHORIZED_STUDENTS.includes(studentId)) {
    window.location.href = '/';
}
