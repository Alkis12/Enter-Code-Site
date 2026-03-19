import React, { useState } from "react";
import styled from "styled-components";
import { Navigate, useNavigate } from "react-router-dom";
import background from "../assets/LoginAssets/Background.jpg";
import logo from "../assets/LoginAssets/logo.png";
import { useAchievementToasts } from "../components/AchievementToastProvider";
import { isAuthenticated, login } from "../api/auth";

function LoginPage() {
  const navigate = useNavigate();
  const { pushAchievements } = useAchievementToasts();
  const [form, setForm] = useState({ tg_username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to="/profile" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      const response = await login(form);
      pushAchievements(response.newly_unlocked_achievements || []);
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err.message || "Не удалось войти");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Page style={{ backgroundImage: `url(${background})` }}>
      <TopBar>
        <img src={logo} alt="Enter Code" />
      </TopBar>
      <Card>
        <Title>ВХОД</Title>
        <Form onSubmit={handleSubmit}>
          <Input
            type="text"
            placeholder="Логин"
            value={form.tg_username}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, tg_username: event.target.value }))
            }
            required
          />
          <Input
            type="password"
            placeholder="Пароль"
            value={form.password}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, password: event.target.value }))
            }
            required
          />
          {error && <ErrorText>{error}</ErrorText>}
          <SubmitButton type="submit" disabled={loading}>
            {loading ? "Загрузка..." : "ВОЙТИ"}
          </SubmitButton>
        </Form>
      </Card>
    </Page>
  );
}

export default LoginPage;

const Page = styled.div`
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-start;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(23, 26, 38, 0.35);
    backdrop-filter: blur(2px);
  }
`;

const TopBar = styled.div`
  position: relative;
  z-index: 1;
  width: 100%;
  background: #ff7f2a;
  padding: 10px 24px;

  img {
    width: 92px;
  }
`;

const Card = styled.div`
  position: relative;
  z-index: 1;
  width: min(440px, calc(100% - 32px));
  margin-top: 92px;
  padding: 34px 32px 26px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.96);
  box-shadow: 0 22px 50px rgba(18, 24, 42, 0.25);
`;

const Title = styled.h1`
  text-align: center;
  font-size: clamp(34px, 4vw, 46px);
  margin-bottom: 24px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Input = styled.input`
  width: 100%;
  border-radius: 10px;
  border: 1px solid #d5d7de;
  background: #ffffff;
  padding: 13px 14px;
  font-size: 15px;
`;

const SubmitButton = styled.button`
  margin-top: 8px;
  border: none;
  border-radius: 10px;
  background: #ff7f2a;
  color: #ffffff;
  padding: 14px 18px;
  font-size: 18px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.7;
    cursor: wait;
  }
`;

const ErrorText = styled.div`
  color: #d53939;
  font-size: 14px;
`;
