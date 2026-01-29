export const SEMESTER_START_DATE = new Date('2026-02-02');

export const PAIR_TIMES = {
    1: "08:00 - 09:20",
    2: "09:30 - 10:50",
    3: "11:00 - 12:20"
};

// Словарь преподавателей
const TEACHERS = {
    "Качество и безопасность в гостиничной деятельности": {
        lecture: "Махмудова Азиза Пирмаматовна",
        seminar: "Мир-Джафарова Азиза Джавохировна"
    },
    "Стратегический менеджмент в гостиничном хозяйстве": {
        lecture: "Усманова Нигина Маруповна",
        seminar: "Бурхонова Наргиза Миршохидовна"
    },
    "Стратегический менеджмент": { // Сокращенное название, используем тех же
        lecture: "Усманова Нигина Маруповна",
        seminar: "Бурхонова Наргиза Миршохидовна"
    },
    "Мировая экономика и международные экономические отношения": {
        lecture: "Халимов Шахбоз Халимович",
        seminar: "Амриева Шахзода Шухратовна"
    },
    "Мировая экономика": { // Сокращенное
        lecture: "Халимов Шахбоз Халимович",
        seminar: "Амриева Шахзода Шухратовна"
    },
    "Качество и безопасность": { // Сокращенное
        lecture: "Махмудова Азиза Пирмаматовна",
        seminar: "Мир-Джафарова Азиза Джавохировна"
    },
    "Международный гостиничный бизнес": {
        lecture: "Амриддинова Райхона Садриддиновна",
        seminar: "Мейлиев Абдугани Наджмиддинович"
    },
    "Урок просвещения": {
        lecture: "",
        seminar: ""
    }
};

function getTeacher(subject, type) {
    const teach = TEACHERS[subject];
    if (teach) {
        return teach[type] || "";
    }
    // Пробуем найти по частичному совпадению
    for (const key in TEACHERS) {
        if (subject.includes(key)) {
            return TEACHERS[key][type] || "";
        }
    }
    return "";
}

// Типы: 'lecture', 'seminar'
const SCHEDULE = [
    // --- ПОНЕДЕЛЬНИК ---
    {
        day: "monday",
        pair: 1,
        subject: "Качество и безопасность в гостиничной деятельности",
        type: "lecture",
        weeks: [4, 8],
        room: "2/214",
        teacher: getTeacher("Качество и безопасность в гостиничной деятельности", "lecture")
    },
    {
        day: "monday",
        pair: 1,
        subject: "Стратегический менеджмент в гостиничном хозяйстве",
        type: "lecture",
        weeks: [10, 15],
        room: "2/214",
        teacher: getTeacher("Стратегический менеджмент в гостиничном хозяйстве", "lecture")
    },
    {
        day: "monday",
        pair: 2,
        subject: "Стратегический менеджмент в гостиничном хозяйстве",
        type: "lecture",
        weeks: [4, 8],
        room: "2/214",
        teacher: getTeacher("Стратегический менеджмент в гостиничном хозяйстве", "lecture")
    },
    {
        day: "monday",
        pair: 2,
        subject: "Мировая экономика и международные экономические отношения",
        type: "lecture",
        weeks: [10, 15],
        room: "2/214",
        teacher: getTeacher("Мировая экономика и международные экономические отношения", "lecture")
    },
    {
        day: "monday",
        pair: 3,
        subject: "Урок просвещения",
        type: "lecture",
        weeks: [4, 8],
        room: "3/305",
        teacher: ""
    },
    {
        day: "monday",
        pair: 3,
        subject: "Урок просвещения",
        type: "lecture",
        weeks: [10, 12],
        room: "3/305",
        teacher: ""
    },
    {
        day: "monday",
        pair: 3,
        subject: "Урок просвещения",
        type: "lecture",
        weeks: [13, 15],
        room: "3/305",
        teacher: ""
    },

    // --- ВТОРНИК ---
    {
        day: "tuesday",
        pair: 1,
        subject: "Мировая экономика и международные экономические отношения",
        type: "lecture",
        weeks: [4, 10],
        room: "2/214",
        teacher: getTeacher("Мировая экономика и международные экономические отношения", "lecture")
    },
    {
        day: "tuesday",
        pair: 1,
        subject: "Мировая экономика и международные экономические отношения",
        type: "seminar",
        weeks: [11, 15],
        room: "2/214",
        teacher: getTeacher("Мировая экономика и международные экономические отношения", "seminar")
    },
    {
        day: "tuesday",
        pair: 2,
        subject: "Качество и безопасность в гостиничной деятельности",
        type: "lecture",
        weeks: [4, 10],
        room: "2/214",
        teacher: getTeacher("Качество и безопасность в гостиничной деятельности", "lecture")
    },
    {
        day: "tuesday",
        pair: 2,
        subject: "Качество и безопасность в гостиничной деятельности",
        type: "lecture",
        weeks: [11, 15],
        room: "2/214",
        teacher: getTeacher("Качество и безопасность в гостиничной деятельности", "lecture")
    },
    {
        day: "tuesday",
        pair: 3,
        subject: "Международный гостиничный бизнес",
        type: "lecture",
        weeks: [4, 14],
        room: "2/214",
        teacher: getTeacher("Международный гостиничный бизнес", "lecture")
    },

    // --- СРЕДА ---
    {
        day: "wednesday",
        pair: 1,
        subject: "Международный гостиничный бизнес",
        type: "seminar",
        weeks: [4, 15],
        room: "2/214",
        teacher: getTeacher("Международный гостиничный бизнес", "seminar")
    },
    {
        day: "wednesday",
        pair: 2,
        subject: "Качество и безопасность в гостиничной деятельности",
        type: "seminar",
        weeks: [4, 15],
        room: "2/214",
        teacher: getTeacher("Качество и безопасность в гостиничной деятельности", "seminar")
    },
    {
        day: "wednesday",
        pair: 3,
        subject: "Стратегический менеджмент",
        type: "lecture",
        weeks: [10, 10], // Только 10 неделя
        room: "2/214",
        teacher: getTeacher("Стратегический менеджмент", "lecture")
    },
    {
        day: "wednesday",
        pair: 3,
        subject: "Мировая экономика",
        type: "seminar",
        weeks: [15, 15], // Только 15 неделя
        room: "2/214",
        teacher: getTeacher("Мировая экономика", "seminar")
    },

    // --- ЧЕТВЕРГ ---
    {
        day: "thursday",
        pair: 1,
        subject: "Мировая экономика",
        type: "seminar",
        weeks: [4, 15],
        room: "2/214",
        teacher: getTeacher("Мировая экономика", "seminar")
    },
    {
        day: "thursday",
        pair: 2,
        subject: "Стратегический менеджмент",
        type: "lecture",
        weeks: [4, 9],
        room: "2/214",
        teacher: getTeacher("Стратегический менеджмент", "lecture")
    },
    {
        day: "thursday",
        pair: 2,
        subject: "Международный гостиничный бизнес",
        type: "seminar",
        weeks: [10, 10], // Только 10 неделя
        room: "2/214",
        teacher: getTeacher("Международный гостиничный бизнес", "seminar")
    },
    {
        day: "thursday",
        pair: 2,
        subject: "Качество и безопасность",
        type: "seminar",
        weeks: [11, 15],
        room: "2/214",
        teacher: getTeacher("Качество и безопасность", "seminar")
    },
    {
        day: "thursday",
        pair: 3,
        subject: "Стратегический менеджмент",
        type: "seminar",
        weeks: [6, 12],
        room: "2/214",
        teacher: getTeacher("Стратегический менеджмент", "seminar")
    },
    {
        day: "thursday",
        pair: 3,
        subject: "Качество и безопасность",
        type: "seminar",
        weeks: [13, 13], // Только 13 неделя
        room: "2/214",
        teacher: getTeacher("Качество и безопасность", "seminar")
    },

    // --- ПЯТНИЦА ---
    {
        day: "friday",
        pair: 1,
        subject: "Стратегический менеджмент",
        type: "seminar",
        weeks: [4, 9],
        room: "2/214",
        teacher: getTeacher("Стратегический менеджмент", "seminar")
    },
    {
        day: "friday",
        pair: 1,
        subject: "Международный гостиничный бизнес",
        type: "seminar",
        weeks: [11, 15],
        room: "2/214",
        teacher: getTeacher("Международный гостиничный бизнес", "seminar")
    },
    {
        day: "friday",
        pair: 2,
        subject: "Мировая экономика",
        type: "lecture",
        weeks: [4, 8],
        room: "2/214",
        teacher: getTeacher("Мировая экономика", "lecture")
    },
    {
        day: "friday",
        pair: 2,
        subject: "Качество и безопасность",
        type: "lecture",
        weeks: [9, 9],
        room: "3/207",
        teacher: getTeacher("Качество и безопасность", "lecture")
    },
    {
        day: "friday",
        pair: 2,
        subject: "Стратегический менеджмент",
        type: "seminar",
        weeks: [11, 15],
        room: "2/214",
        teacher: getTeacher("Стратегический менеджмент", "seminar")
    },
    {
        day: "friday",
        pair: 3,
        subject: "Международный гостиничный бизнес",
        type: "lecture",
        weeks: [4, 9],
        room: "2/214",
        teacher: getTeacher("Международный гостиничный бизнес", "lecture")
    },
    {
        day: "friday",
        pair: 3,
        subject: "Международный гостиничный бизнес",
        type: "lecture",
        weeks: [11, 11],
        room: "2/214",
        teacher: getTeacher("Международный гостиничный бизнес", "lecture")
    }
];

export function getLessonsForDay(dayOfWeek, currentWeek) {
    return SCHEDULE.filter(lesson => {
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
