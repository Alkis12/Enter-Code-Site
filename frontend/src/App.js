import "./App.css";
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

import { getCurrentUserType, isAuthenticated } from "./api/auth";
import { AchievementToastProvider } from "./components/AchievementToastProvider";
import GlobalStyle from "./styles/GlobalStyle";
import AdminEventsPage from "./pages/AdminEventsPage";
import AchievementsManagePage from "./pages/AchievementsManagePage";
import AchievementsOverviewPage from "./pages/AchievementsOverviewPage";
import CoursePage from "./pages/CoursePage";
import EventsPage from "./pages/EventsPage";
import HomePage from "./pages/HomePage";
import LessonPage from "./pages/LessonPage";
import LoginPage from "./pages/LoginPage";
import MyCoursesPage from "./pages/MyCoursesPage";
import MySchedulePage from "./pages/MySchedulePage";
import NewsArticlePage from "./pages/NewsArticlePage";
import NewsPage from "./pages/NewsPage";
import PublicCoursePage from "./pages/PublicCoursePage";
import ProfileEditPage from "./pages/ProfileEditPage";
import ProfilePage from "./pages/ProfilePage";
import ProfileSecurityPage from "./pages/ProfileSecurityPage";
import StudentsPage from "./pages/StudentsPage";
import TeachingPage from "./pages/TeachingPage";

function RequireAuth({ children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

function RequireRoles({ roles, children }) {
  if (!isAuthenticated()) {
    return <Navigate to="/login" replace />;
  }

  const userType = getCurrentUserType();
  if (!roles.includes(userType)) {
    return <Navigate to="/profile" replace />;
  }

  return children;
}

function App() {
  return (
    <AchievementToastProvider>
      <GlobalStyle />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route
          path="/admin/events"
          element={
            <RequireRoles roles={["admin"]}>
              <AdminEventsPage />
            </RequireRoles>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route
          path="/profile"
          element={
            <RequireAuth>
              <ProfilePage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/edit"
          element={
            <RequireAuth>
              <ProfileEditPage />
            </RequireAuth>
          }
        />
        <Route
          path="/profile/security"
          element={
            <RequireAuth>
              <ProfileSecurityPage />
            </RequireAuth>
          }
        />
        <Route
          path="/achievements/manage"
          element={
            <RequireRoles roles={["teacher", "admin"]}>
              <AchievementsManagePage />
            </RequireRoles>
          }
        />
        <Route
          path="/achievements/overview"
          element={
            <RequireRoles roles={["admin"]}>
              <AchievementsOverviewPage />
            </RequireRoles>
          }
        />
        <Route
          path="/students"
          element={
            <RequireRoles roles={["teacher", "admin"]}>
              <StudentsPage />
            </RequireRoles>
          }
        />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsArticlePage />} />
        <Route
          path="/mycourses"
          element={
            <RequireRoles roles={["student", "teacher", "admin"]}>
              <MyCoursesPage />
            </RequireRoles>
          }
        />
        <Route
          path="/teaching"
          element={
            <RequireRoles roles={["teacher", "admin"]}>
              <TeachingPage />
            </RequireRoles>
          }
        />
        <Route
          path="/mycourses/:courseId"
          element={
            <RequireRoles roles={["student", "teacher", "admin"]}>
              <CoursePage />
            </RequireRoles>
          }
        />
        <Route path="/courses/:courseId" element={<PublicCoursePage />} />
        <Route
          path="/mycourses/:courseId/lessons/:lessonId"
          element={
            <RequireRoles roles={["student", "teacher", "admin"]}>
              <LessonPage />
            </RequireRoles>
          }
        />
        <Route
          path="/myschedule"
          element={
            <RequireRoles roles={["student", "teacher", "admin"]}>
              <MySchedulePage />
            </RequireRoles>
          }
        />
      </Routes>
    </AchievementToastProvider>
  );
}

export default App;
