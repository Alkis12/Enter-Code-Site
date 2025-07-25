import "./App.css";
import React from "react";
import { Routes, Route } from "react-router-dom";
import LoginPage from "./pages/LoginPage";
import GlobalStyle from "./styles/GlobalStyle";

function App() {
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
      </Routes>
    </>
  );
}

export default App;
