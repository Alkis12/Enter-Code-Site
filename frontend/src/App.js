import "./App.css";
import React from "react";
import i18n from "./i18n";
import { useTranslation } from "react-i18next";

import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import GlobalStyle from "./styles/GlobalStyle";
import ProfilePage from "./pages/ProfilePage";

function App() {
  const { i18n } = useTranslation();
  return (
    <>
      <GlobalStyle />
      <Routes>
        <Route
          path="/"
          element={
            <h1 style={{ border: "2px solid red", background: "yellow" }}>
              Home Page
            </h1>
          }
        />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/profile" element={<ProfilePage />} />
      </Routes>
    </>
  );
}

export default App;
