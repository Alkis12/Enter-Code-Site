import React, { useState } from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const FormWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 400px;
  margin: 150px auto;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
`;

const Input = styled.input`
  width: 300px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 16px;

  &:focus {
    outline: none;
    border-color: grey;
  }
`;

const Button = styled.button`
  width: 100%;
  margin-top: 16px;
  padding: 12px 16px;
  background-color: #fa7f2f;
  color: white;
  font-size: 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background-color: rgb(208, 105, 37);
  }
`;

function LoginForm() {
  const [tgUsername, setTgUsername] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [error, setError] = useState("");

  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    try {
      const response = await fetch("http://localhost:8000/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tg_username: tgUsername, password }),
      });
      const data = await response.json();
      if (response.ok) {
        setToken(data.access_token);
        alert("Token: " + data.access_token);
        // localStorage.setItem("access_token", data.access_token);
      } else {
        // setError(data.detail || "Ошибка входа");
        alert(data.detail || "Ошибка входа");
      }
    } catch (err) {
      // setError("Ошибка сети");
      alert(err.message);
    }
  };

  return (
    <FormWrapper>
      <StyledForm onSubmit={handleLogin}>
        <h1>ВХОД</h1>
        <Input
          type="text"
          placeholder="Логин"
          value={tgUsername}
          onChange={(e) => setTgUsername(e.target.value)}
          required
        />
        <Input
          type="password"
          placeholder="Пароль"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <Button type="submit">
          <h2>ВОЙТИ</h2>
        </Button>
        <br/>
        {/* {token && <div>Ваш токен: {token}</div>} */}
        {error && <div style={{ color: "red" }}>{error}</div>}
      </StyledForm>
    </FormWrapper>
  );
}

export default LoginForm;
