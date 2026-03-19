import React, { useState } from "react";
import styled from "styled-components";
import { Link, Navigate, useNavigate } from "react-router-dom";
import background from "../assets/LoginAssets/Background.jpg";
import logo from "../assets/LoginAssets/logo.png";
import { isAuthenticated, register } from "../api/auth";

const initialForm = {
  name: "",
  surname: "",
  tg_username: "",
  telegram_id: "",
  phone: "",
  password: "",
  password_repeat: "",
};

function RegisterPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  if (isAuthenticated()) {
    return <Navigate to="/profile" replace />;
  }

  const handleChange = (event) => {
    const { name, value } = event.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");
    try {
      await register({
        ...form,
        user_type: "student",
        telegram_id: form.telegram_id || null,
        phone: form.phone || null,
      });
      navigate("/profile", { replace: true });
    } catch (err) {
      setError(err.message || "Не удалось зарегистрироваться");
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
        <Title>РЕГИСТРАЦИЯ</Title>
        <Form onSubmit={handleSubmit}>
          <Grid>
            <Input
              name="name"
              placeholder="Имя"
              value={form.name}
              onChange={handleChange}
              required
            />
            <Input
              name="surname"
              placeholder="Фамилия"
              value={form.surname}
              onChange={handleChange}
              required
            />
            <Input
              name="tg_username"
              placeholder="Логин"
              value={form.tg_username}
              onChange={handleChange}
              required
            />
            <Input
              name="telegram_id"
              placeholder="TG ID"
              value={form.telegram_id}
              onChange={handleChange}
            />
            <Input
              name="phone"
              placeholder="Телефон"
              value={form.phone}
              onChange={handleChange}
            />
            <Input
              name="password"
              type="password"
              placeholder="Пароль"
              value={form.password}
              onChange={handleChange}
              required
            />
            <WideInput
              as="input"
              name="password_repeat"
              type="password"
              placeholder="Повторите пароль"
              value={form.password_repeat}
              onChange={handleChange}
              required
            />
          </Grid>
          {error && <ErrorText>{error}</ErrorText>}
          <SubmitButton type="submit" disabled={loading}>
            {loading ? "Загрузка..." : "СОЗДАТЬ АККАУНТ"}
          </SubmitButton>
        </Form>
        <MetaText>
          Уже есть аккаунт? <MetaLink to="/login">Войти</MetaLink>
        </MetaText>
      </Card>
    </Page>
  );
}

export default RegisterPage;

const Page = styled.div`
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;

  &::after {
    content: "";
    position: absolute;
    inset: 0;
    background: rgba(23, 26, 38, 0.4);
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
  width: min(660px, calc(100% - 32px));
  margin: 50px 0;
  padding: 30px 30px 24px;
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.97);
  box-shadow: 0 22px 50px rgba(18, 24, 42, 0.25);
`;

const Title = styled.h1`
  text-align: center;
  font-size: clamp(26px, 4vw, 44px);
  margin-bottom: 22px;
`;

const Form = styled.form`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Grid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 640px) {
    grid-template-columns: 1fr;
  }
`;

const Input = styled.input`
  width: 100%;
  border-radius: 10px;
  border: 1px solid #d5d7de;
  background: #ffffff;
  padding: 13px 14px;
  font-size: 15px;
`;

const WideInput = styled(Input)`
  grid-column: 1 / -1;
`;

const SubmitButton = styled.button`
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

const MetaText = styled.p`
  margin-top: 16px;
  text-align: center;
  color: #666a75;
  font-size: 14px;
`;

const MetaLink = styled(Link)`
  color: #ff7f2a;
  font-weight: 700;
  text-decoration: none;
`;
