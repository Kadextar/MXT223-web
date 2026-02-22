export const SEMESTER_START_DATE = new Date('2026-01-12');
const DAY_INDEX = { monday: 0, tuesday: 1, wednesday: 2, thursday: 3, friday: 4 };

/** Номер недели семестра (1-based) на дату */
export function getWeekNumber(date) {
    const d = typeof date === 'string' ? new Date(date) : date;
    const start = new Date(SEMESTER_START_DATE);
    start.setHours(0, 0, 0, 0);
    const dNorm = new Date(d);
    dNorm.setHours(0, 0, 0, 0);
    const diffMs = dNorm - start;
    const diffDays = Math.floor(diffMs / (24 * 60 * 60 * 1000));
    if (diffDays < 0) return 0;
    return Math.floor(diffDays / 7) + 1;
}

/** Дата занятия: понедельник недели weekNum + dayOfWeek */
function getLessonDate(dayOfWeek, weekNum) {
    const start = new Date(SEMESTER_START_DATE);
    start.setHours(0, 0, 0, 0);
    const dayIdx = DAY_INDEX[dayOfWeek] ?? 0;
    const date = new Date(start);
    date.setDate(start.getDate() + (weekNum - 1) * 7 + dayIdx);
    return date;
}

/**
 * По расписанию считает, сколько занятий по каждому предмету (лекция/семинар) уже прошло до сегодня.
 * Возвращает: { "Название предмета": { lecture: number, seminar: number }, ... }
 */
export function getProgressBySubject() {
    const today = new Date();
    today.setHours(23, 59, 59, 999);
    const result = {};

    scheduleData.forEach(lesson => {
        const [weekStart, weekEnd] = Array.isArray(lesson.weeks) ? lesson.weeks : [1, 18];
        const type = (lesson.type === 'lecture' || lesson.type === 'seminar') ? lesson.type : 'lecture';
        const subject = lesson.subject || '';

        let count = 0;
        for (let w = weekStart; w <= weekEnd; w++) {
            const lessonDate = getLessonDate(lesson.day, w);
            if (lessonDate <= today) count++;
        }
        if (!subject) return;
        if (!result[subject]) result[subject] = { lecture: 0, seminar: 0 };
        result[subject][type] = (result[subject][type] || 0) + count;
    });

    return result;
}

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
    console.log(`🔍 Filtering for day: ${dayOfWeek}, week: ${currentWeek}`);
    console.log(`📊 Total lessons in data: ${scheduleData.length}`);

    const filtered = scheduleData.filter(lesson => {
        // Проверяем день
        if (lesson.day !== dayOfWeek) return false;

        // Проверяем неделю (если задан массив [start, end])
        if (Array.isArray(lesson.weeks)) {
            const [start, end] = lesson.weeks;
            if (currentWeek < start || currentWeek > end) {
                console.log(`❌ Lesson "${lesson.subject}" filtered out: week ${currentWeek} not in range [${start}, ${end}]`);
                return false;
            }
        }

        return true;
    });

    console.log(`✅ Filtered lessons: ${filtered.length}`);
    return filtered;
}

export function getUniqueSubjects() {
    const subjectsMap = {};

    scheduleData.forEach(lesson => {
        if (!subjectsMap[lesson.subject]) {
            subjectsMap[lesson.subject] = {
                name: lesson.subject,
                type: lesson.type, // lecture/seminar (might be mixed)
                teachers: new Set(),
                rooms: new Set()
            };
        }
        if (lesson.teacher) subjectsMap[lesson.subject].teachers.add(lesson.teacher);
        if (lesson.room) subjectsMap[lesson.subject].rooms.add(lesson.room);
    });

    return Object.values(subjectsMap).map(s => ({
        ...s,
        teachers: Array.from(s.teachers),
        rooms: Array.from(s.rooms)
    }));
}
