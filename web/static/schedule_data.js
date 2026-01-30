export const SEMESTER_START_DATE = new Date('2026-01-12');

export const PAIR_TIMES = {
    1: "08:00 - 09:20",
    2: "09:30 - 10:50",
    3: "11:00 - 12:20"
};

// Data will be fetched from API
let scheduleData = [];

export function setScheduleData(data) {
    scheduleData = data || [];
    console.log('📅 Schedule data optimized loaded:', scheduleData.length, 'lessons');
}

export function getLessonsForDay(dayOfWeek, currentWeek) {
    return scheduleData.filter(lesson => {
        // Проверяем день
        if (lesson.day !== dayOfWeek) return false;

        // Проверяем неделю (если задан массив [start, end])
        if (Array.isArray(lesson.weeks)) {
            const [start, end] = lesson.weeks;
            if (currentWeek < start || currentWeek > end) return false;
        }

        return true;
    });
}
