-- LTropik: патч v2 — нові таблиці для існуючих баз даних
-- Запуск: psql -U postgres -d ltropik -f patch_v2.sql
-- Якщо вже використовуєте стару init.sql (з PG ENUM для role),
-- цей скрипт додає тільки нові таблиці.

-- ОПЦІЙНО: якщо role колонка ще enum — конвертуємо у varchar
-- ALTER TABLE users ALTER COLUMN role TYPE VARCHAR(20) USING role::text;
-- ALTER TABLE homework_submissions ALTER COLUMN status TYPE VARCHAR(30) USING status::text;
-- ALTER TABLE attendance_and_grades ALTER COLUMN attendance TYPE VARCHAR(30) USING attendance::text;

-- Нові таблиці
CREATE TABLE IF NOT EXISTS parent_students (
    parent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_id, student_id)
);

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

CREATE TABLE IF NOT EXISTS schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    teacher_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    starts_at TIMESTAMPTZ NOT NULL,
    duration_minutes INT NOT NULL DEFAULT 60,
    notes TEXT
);

CREATE TABLE IF NOT EXISTS course_progresses (
    student_id UUID REFERENCES users(id) ON DELETE CASCADE,
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    completed_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (student_id, lesson_id)
);

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

CREATE TABLE IF NOT EXISTS lesson_comments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lesson_id UUID REFERENCES lessons(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE RESTRICT,
    parent_comment_id UUID REFERENCES lesson_comments(id) ON DELETE RESTRICT,
    body TEXT NOT NULL,
    is_deleted BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS question_bank_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    text TEXT NOT NULL,
    type VARCHAR(20) NOT NULL DEFAULT 'Single',
    options JSONB NOT NULL DEFAULT '[]',
    tags VARCHAR(512),
    category VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Rooms (якщо не існує)
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

-- Індекси
CREATE INDEX IF NOT EXISTS idx_app_notifications_user ON app_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedules_starts_at ON schedules(starts_at);
CREATE INDEX IF NOT EXISTS idx_lesson_comments_lesson ON lesson_comments(lesson_id, created_at);

SELECT 'Патч v2 застосовано успішно ✅' AS result;
