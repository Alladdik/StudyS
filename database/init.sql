-- LTropik: повна схема PostgreSQL (v2 — всі нові таблиці)
-- Запуск: psql -U postgres -d ltropik -f init.sql
-- ВАЖЛИВО: роль зберігається як VARCHAR (не PG ENUM) — сумісність з EF Core

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 1. Користувачі (role як varchar для EF Core EnumToStringConverter)
CREATE TABLE IF NOT EXISTS users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(512) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    role VARCHAR(20) NOT NULL DEFAULT 'Student',
    telegram_id VARCHAR(50),
    telegram_link_code VARCHAR(10),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Динамічні поля профілю
CREATE TABLE IF NOT EXISTS custom_profile_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    field_name VARCHAR(100) NOT NULL,
    field_type VARCHAR(50) NOT NULL,
    is_required BOOLEAN DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS user_custom_values (
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    field_id UUID REFERENCES custom_profile_fields(id) ON DELETE CASCADE,
    field_value TEXT,
    PRIMARY KEY (user_id, field_id)
);

-- 3. Системи оцінювання
CREATE TABLE IF NOT EXISTS grade_scales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS grade_scale_values (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    scale_id UUID REFERENCES grade_scales(id) ON DELETE CASCADE,
    value_string VARCHAR(20) NOT NULL,
    is_passing BOOLEAN DEFAULT TRUE
);

-- 4. Курси, модулі, уроки
CREATE TABLE IF NOT EXISTS courses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    grade_scale_id UUID REFERENCES grade_scales(id),
    status VARCHAR(50) NOT NULL DEFAULT 'Draft',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS course_teachers (
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (course_id, teacher_id)
);

CREATE TABLE IF NOT EXISTS course_students (
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    balance_lessons INT DEFAULT 0,
    subscription_ends_at TIMESTAMPTZ,
    PRIMARY KEY (course_id, student_id)
);

CREATE TABLE IF NOT EXISTS modules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    course_id UUID REFERENCES courses(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL
);

CREATE TABLE IF NOT EXISTS lessons (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    module_id UUID REFERENCES modules(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    sort_order INT NOT NULL,
    content_blocks JSONB NOT NULL DEFAULT '[]'
);

-- 5. Домашні завдання
CREATE TABLE IF NOT EXISTS homeworks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    instruction TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS homework_submissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    homework_id UUID REFERENCES homeworks(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    status VARCHAR(30) NOT NULL DEFAULT 'NotStarted',
    submission_data TEXT,
    ai_feedback_draft TEXT,
    teacher_feedback TEXT,
    grade_value_id UUID REFERENCES grade_scale_values(id),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Журнал та тести
CREATE TABLE IF NOT EXISTS attendance_and_grades (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    attendance VARCHAR(30) NOT NULL DEFAULT 'Present',
    grade_id UUID REFERENCES grade_scale_values(id),
    lesson_date DATE NOT NULL
);

CREATE TABLE IF NOT EXISTS tests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    time_limit_minutes INT DEFAULT 0,
    max_attempts INT DEFAULT 1,
    passing_percentage NUMERIC(5,2) DEFAULT 60,
    questions JSONB NOT NULL DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS test_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    test_id UUID REFERENCES tests(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    score_percentage NUMERIC(5,2) NOT NULL DEFAULT 0,
    passed BOOLEAN NOT NULL DEFAULT FALSE,
    started_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);

-- 7. Фінанси та аудит
CREATE TABLE IF NOT EXISTS payment_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id UUID REFERENCES users(id),
    course_id UUID REFERENCES courses(id),
    amount NUMERIC(10,2) NOT NULL,
    currency VARCHAR(10) NOT NULL DEFAULT 'UAH',
    status VARCHAR(50) NOT NULL,
    external_tx_id VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    action VARCHAR(255) NOT NULL,
    details TEXT NOT NULL,
    ip_address VARCHAR(45),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Гейміфікація
CREATE TABLE IF NOT EXISTS badges (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) NOT NULL,
    description TEXT NOT NULL,
    icon VARCHAR(20) NOT NULL,
    condition VARCHAR(50) NOT NULL,
    condition_value INT NOT NULL,
    coins_reward INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS student_badges (
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    badge_id UUID REFERENCES badges(id) ON DELETE CASCADE,
    earned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (student_id, badge_id)
);

CREATE TABLE IF NOT EXISTS student_streaks (
    student_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    current_streak INT NOT NULL DEFAULT 0,
    max_streak INT NOT NULL DEFAULT 0,
    last_activity_date DATE NOT NULL DEFAULT CURRENT_DATE,
    total_coins INT NOT NULL DEFAULT 0
);

-- 9. Кімнати
CREATE TABLE IF NOT EXISTS rooms (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(255) NOT NULL,
    host_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS room_messages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    room_id UUID REFERENCES rooms(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    sent_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════ НОВІ ТАБЛИЦІ (v2) ════════════════════════════════════════════════

-- 10. Батьки → Студенти
CREATE TABLE IF NOT EXISTS parent_students (
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, student_id)
);

-- 11. In-app сповіщення
CREATE TABLE IF NOT EXISTS app_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    body TEXT NOT NULL,
    is_read BOOLEAN NOT NULL DEFAULT FALSE,
    action_url VARCHAR(512),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. Розклад занять
CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    notes TEXT
);

-- 13. Прогрес проходження уроків
CREATE TABLE IF NOT EXISTS course_progresses (
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (student_id, lesson_id)
);

-- 14. Групи студентів
CREATE TABLE IF NOT EXISTS student_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS group_members (
    group_id UUID REFERENCES student_groups(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (group_id, student_id)
);

-- 15. Коментарі до уроків
CREATE TABLE IF NOT EXISTS lesson_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    parent_comment_id UUID REFERENCES lesson_comments(id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. Банк тестових питань
CREATE TABLE IF NOT EXISTS question_bank_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'Single',
    options JSONB NOT NULL DEFAULT '[]',
    tags VARCHAR(512),
    category VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ════ ІНДЕКСИ ══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_homework_submissions_status ON homework_submissions(status);
CREATE INDEX IF NOT EXISTS idx_homework_submissions_student ON homework_submissions(student_id);
CREATE INDEX IF NOT EXISTS idx_attendance_lesson_date ON attendance_and_grades(lesson_id, lesson_date);
CREATE INDEX IF NOT EXISTS idx_test_attempts_student ON test_attempts(test_id, student_id);
CREATE INDEX IF NOT EXISTS idx_payment_external_id ON payment_transactions(external_tx_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user ON app_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_starts_at ON schedules(starts_at);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson ON lesson_comments(lesson_id, created_at);
