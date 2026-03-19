import "./App.css";
import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";

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

function App() {
  return (
    <AchievementToastProvider>
      <GlobalStyle />
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/admin/events" element={<AdminEventsPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<Navigate to="/login" replace />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/profile/edit" element={<ProfileEditPage />} />
        <Route path="/profile/security" element={<ProfileSecurityPage />} />
        <Route
          path="/achievements/manage"
          element={<AchievementsManagePage />}
        />
        <Route
          path="/achievements/overview"
          element={<AchievementsOverviewPage />}
        />
        <Route path="/students" element={<StudentsPage />} />
        <Route path="/news" element={<NewsPage />} />
        <Route path="/news/:slug" element={<NewsArticlePage />} />
        <Route path="/mycourses" element={<MyCoursesPage />} />
        <Route path="/teaching" element={<TeachingPage />} />
        <Route path="/mycourses/:courseId" element={<CoursePage />} />
        <Route path="/courses/:courseId" element={<PublicCoursePage />} />
        <Route
          path="/mycourses/:courseId/lessons/:lessonId"
          element={<LessonPage />}
        />
        <Route path="/myschedule" element={<MySchedulePage />} />
      </Routes>
    </AchievementToastProvider>
  );
}

export default App;
