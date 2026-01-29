// Exams Page JavaScript

// Load exams from API
async function loadExams() {
    try {
        const response = await fetch('/api/exams');
        if (!response.ok) throw new Error('Failed to load exams');

        const exams = await response.json();

        document.getElementById('loading').classList.add('hidden');

        if (exams.length === 0) {
            document.getElementById('empty-state').classList.remove('hidden');
        } else {
            renderExams(exams);
        }
    } catch (error) {
        console.error('Error loading exams:', error);
        document.getElementById('loading').classList.add('hidden');
        document.getElementById('empty-state').classList.remove('hidden');
    }
}

// Render exams
function renderExams(exams) {
    const container = document.getElementById('exams-grid');
    container.innerHTML = '';

    exams.forEach(exam => {
        const card = createExamCard(exam);
        container.appendChild(card);
    });
}

// Create exam card element
function createExamCard(exam) {
    const card = document.createElement('div');

    // Calculate days until exam
    const examDate = new Date(exam.exam_date);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    examDate.setHours(0, 0, 0, 0);
    const daysUntil = Math.ceil((examDate - today) / (1000 * 60 * 60 * 24));

    // Determine card class
    let cardClass = 'exam-card';
    let countdownClass = 'exam-countdown';
    let countdownText = '';

    if (daysUntil < 0) {
        countdownText = 'Прошёл';
    } else if (daysUntil === 0) {
        countdownText = '🔥 Сегодня!';
        countdownClass += ' today';
        cardClass += ' soon';
    } else if (daysUntil <= 7) {
        countdownText = `⏰ Через ${daysUntil} ${getDaysWord(daysUntil)}`;
        countdownClass += ' soon';
        cardClass += ' soon';
    } else {
        countdownText = `⏳ Через ${daysUntil} ${getDaysWord(daysUntil)}`;
        cardClass += ' upcoming';
    }

    card.className = cardClass;

    // Format date
    const formattedDate = formatDate(examDate);

    // Build HTML
    card.innerHTML = `
        <div class="exam-header">
            <div class="exam-date">
                📅 ${formattedDate}
            </div>
            <div class="exam-time-room">
                ${exam.exam_time ? `<span>⏰ ${exam.exam_time}</span>` : ''}
                ${exam.room ? `<span>🏛️ ${exam.room}</span>` : ''}
            </div>
        </div>
        
        <div class="exam-body">
            <div class="exam-subject">${exam.subject}</div>
            ${exam.teacher ? `<div class="exam-teacher">👨‍🏫 ${exam.teacher}</div>` : ''}
        </div>
        
        <div class="exam-footer">
            ${exam.exam_type ? `<div class="exam-type">📝 ${exam.exam_type}</div>` : '<div></div>'}
            <div class="${countdownClass}">${countdownText}</div>
        </div>
        
        ${exam.notes ? `<div class="exam-notes">💡 ${exam.notes}</div>` : ''}
    `;

    return card;
}

// Format date to Russian
function formatDate(date) {
    const options = { day: 'numeric', month: 'long', year: 'numeric' };
    let str = date.toLocaleDateString('ru-RU', options);
    return str.charAt(0).toUpperCase() + str.slice(1);
}

// Get correct word form for days
function getDaysWord(days) {
    if (days % 10 === 1 && days % 100 !== 11) {
        return 'день';
    } else if ([2, 3, 4].includes(days % 10) && ![12, 13, 14].includes(days % 100)) {
        return 'дня';
    } else {
        return 'дней';
    }
}

// Initialize
loadExams();
