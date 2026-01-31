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
