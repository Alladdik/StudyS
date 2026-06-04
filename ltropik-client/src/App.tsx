import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { UnauthorizedPage } from './pages/UnauthorizedPage';
import { Toaster } from './components/ui';
import { Onboarding } from './components/Onboarding';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DiaryPage } from './pages/student/DiaryPage';
import { CoursesPage } from './pages/student/CoursesPage';
import { LessonPage } from './pages/student/LessonPage';
import { HomeworkPage } from './pages/student/HomeworkPage';
import { TestPage } from './pages/student/TestPage';
import { AchievementsPage } from './pages/student/AchievementsPage';
import { ReviewPage } from './pages/teacher/ReviewPage';
import { JournalPage } from './pages/teacher/JournalPage';
import { CourseBuilderPage } from './pages/admin/CourseBuilderPage';
import { GradeScalesPage } from './pages/admin/GradeScalesPage';
import { AnalyticsPage } from './pages/admin/AnalyticsPage';
import { UsersPage } from './pages/admin/UsersPage';
import { GroupsPage } from './pages/admin/GroupsPage';
import { QuestionBankPage } from './pages/admin/QuestionBankPage';
import { AdminDashboardPage } from './pages/admin/DashboardPage';
import { RoomsListPage } from './pages/RoomsListPage';
import { RoomPage } from './pages/RoomPage';
import { CalendarPage } from './pages/CalendarPage';
import { ParentDashboardPage } from './pages/parent/DashboardPage';
import { RegisterPage } from './pages/RegisterPage';
import { ProfilePage } from './pages/ProfilePage';
import { ShopPage } from './pages/student/ShopPage';
import { MessengerPage } from './pages/MessengerPage';
import { PublicCoursesPage } from './pages/PublicCoursesPage';
import { TeacherAnalyticsPage } from './pages/admin/TeacherAnalyticsPage';
import { ShopAdminPage } from './pages/admin/ShopAdminPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { AuditLogsPage } from './pages/admin/AuditLogsPage';
import { SystemHealthPage } from './pages/admin/SystemHealthPage';
import { EnrollmentRequestsPage } from './pages/EnrollmentRequestsPage';
import { ForgotPasswordPage } from './pages/ForgotPasswordPage';
import { ResetPasswordPage } from './pages/ResetPasswordPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { GradebookPage } from './pages/teacher/GradebookPage';
import { TeacherDashboardPage } from './pages/teacher/DashboardPage';
import { ManagerDashboardPage } from './pages/manager/DashboardPage';
import { SlotsPage } from './pages/student/SlotsPage';
import { CivGamePage } from './pages/civ/index';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Onboarding />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
        <Route path="/forgot-password" element={<ForgotPasswordPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/verify-email" element={<VerifyEmailPage />} />
        <Route path="/courses" element={<PublicCoursesPage />} />
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />

        {/* Student */}
        <Route path="/student/diary" element={
          <ProtectedRoute roles={['Student']}><DiaryPage /></ProtectedRoute>
        } />
        <Route path="/student/courses" element={
          <ProtectedRoute roles={['Student']}><CoursesPage /></ProtectedRoute>
        } />
        <Route path="/student/lesson/:id" element={
          <ProtectedRoute roles={['Student']}><LessonPage /></ProtectedRoute>
        } />
        <Route path="/student/homework/:id" element={
          <ProtectedRoute roles={['Student']}><HomeworkPage /></ProtectedRoute>
        } />
        <Route path="/student/test/:id" element={
          <ProtectedRoute roles={['Student']}><TestPage /></ProtectedRoute>
        } />
        <Route path="/student/achievements" element={
          <ProtectedRoute roles={['Student']}><AchievementsPage /></ProtectedRoute>
        } />

        {/* Teacher */}
        <Route path="/teacher/dashboard" element={
          <ProtectedRoute roles={['Teacher']}><TeacherDashboardPage /></ProtectedRoute>
        } />
        <Route path="/teacher/review" element={
          <ProtectedRoute roles={['Teacher', 'Admin', 'Manager']}><ReviewPage /></ProtectedRoute>
        } />
        <Route path="/teacher/journal" element={
          <ProtectedRoute roles={['Teacher', 'Admin', 'Manager']}><JournalPage /></ProtectedRoute>
        } />

        {/* Admin */}
        <Route path="/admin" element={
          <ProtectedRoute roles={['Admin']}><AdminDashboardPage /></ProtectedRoute>
        } />
        <Route path="/admin/courses" element={
          <ProtectedRoute roles={['Admin', 'Teacher', 'Manager']}><CourseBuilderPage /></ProtectedRoute>
        } />
        <Route path="/admin/grade-scales" element={
          <ProtectedRoute roles={['Admin', 'Manager']}><GradeScalesPage /></ProtectedRoute>
        } />
        <Route path="/admin/analytics" element={
          <ProtectedRoute roles={['Admin', 'Manager']}><AnalyticsPage /></ProtectedRoute>
        } />
        <Route path="/admin/users" element={
          <ProtectedRoute roles={['Admin', 'Manager']}><UsersPage /></ProtectedRoute>
        } />

        {/* Manager */}
        <Route path="/manager" element={
          <ProtectedRoute roles={['Manager']}><ManagerDashboardPage /></ProtectedRoute>
        } />

        {/* Rooms — all roles */}
        <Route path="/rooms" element={
          <ProtectedRoute><RoomsListPage /></ProtectedRoute>
        } />
        <Route path="/room/:id" element={
          <ProtectedRoute><RoomPage /></ProtectedRoute>
        } />

        {/* Calendar — all roles */}
        <Route path="/calendar" element={
          <ProtectedRoute><CalendarPage /></ProtectedRoute>
        } />

        {/* Parent */}
        <Route path="/parent/dashboard" element={
          <ProtectedRoute roles={['Parent']}><ParentDashboardPage /></ProtectedRoute>
        } />

        {/* Profile — all roles */}
        <Route path="/profile" element={
          <ProtectedRoute><ProfilePage /></ProtectedRoute>
        } />

        {/* Games — all roles */}
        <Route path="/game/slots" element={
          <ProtectedRoute roles={['Student']}><SlotsPage /></ProtectedRoute>
        } />
        <Route path="/game/civ" element={
          <ProtectedRoute><CivGamePage /></ProtectedRoute>
        } />

        {/* Gradebook — teacher + admin + manager */}
        <Route path="/teacher/gradebook" element={
          <ProtectedRoute roles={['Teacher', 'Admin', 'Manager']}><GradebookPage /></ProtectedRoute>
        } />

        {/* Messenger — all roles */}
        <Route path="/messenger" element={
          <ProtectedRoute><MessengerPage /></ProtectedRoute>
        } />

        {/* Student shop */}
        <Route path="/student/shop" element={
          <ProtectedRoute roles={['Student']}><ShopPage /></ProtectedRoute>
        } />

        {/* Enrollment requests — teacher + admin + manager */}
        <Route path="/teacher/requests" element={
          <ProtectedRoute roles={['Teacher', 'Admin', 'Manager']}><EnrollmentRequestsPage /></ProtectedRoute>
        } />
        <Route path="/admin/requests" element={
          <ProtectedRoute roles={['Admin', 'Manager']}><EnrollmentRequestsPage /></ProtectedRoute>
        } />

        {/* Admin + Manager extras */}
        <Route path="/admin/teacher-analytics" element={
          <ProtectedRoute roles={['Admin', 'Manager']}><TeacherAnalyticsPage /></ProtectedRoute>
        } />
        <Route path="/admin/shop" element={
          <ProtectedRoute roles={['Admin', 'Manager']}><ShopAdminPage /></ProtectedRoute>
        } />
        <Route path="/admin/groups" element={
          <ProtectedRoute roles={['Admin', 'Teacher', 'Manager']}><GroupsPage /></ProtectedRoute>
        } />
        <Route path="/admin/question-bank" element={
          <ProtectedRoute roles={['Admin', 'Teacher', 'Manager']}><QuestionBankPage /></ProtectedRoute>
        } />

        {/* Admin-only (sensitive) */}
        <Route path="/admin/settings" element={
          <ProtectedRoute roles={['Admin']}><SettingsPage /></ProtectedRoute>
        } />
        <Route path="/admin/audit-logs" element={
          <ProtectedRoute roles={['Admin']}><AuditLogsPage /></ProtectedRoute>
        } />
        <Route path="/admin/system" element={
          <ProtectedRoute roles={['Admin']}><SystemHealthPage /></ProtectedRoute>
        } />
      </Routes>
    </BrowserRouter>
  );
}
