import React, { useState } from "react";
import styled from "styled-components";
import { Link, Navigate } from "react-router-dom";

import Header from "../components/Header/Header";
import { isAuthenticated } from "../api/auth";
import { changePassword } from "../api/account";

function ProfileSecurityPage() {
  const authed = isAuthenticated();
  const [form, setForm] = useState({
    old_password: "",
    new_password: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    setMessage("");

    try {
      await changePassword(form);
      setForm({
        old_password: "",
        new_password: "",
      });
      setMessage("Пароль обновлен");
    } catch (err) {
      setError(err.message || "Не удалось обновить пароль");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Page>
      <Header />
      <Content>
        {message && <InfoCard>{message}</InfoCard>}
        {error && <InfoCard $error>{error}</InfoCard>}

        <TopBar>
          <div>
            <Eyebrow>Безопасность</Eyebrow>
            <Title>Сменить пароль</Title>
          </div>
          <BackLink to="/profile">Назад в профиль</BackLink>
        </TopBar>

        <FormCard as="form" onSubmit={handleSubmit}>
          <Field>
            <Label>Текущий пароль</Label>
            <Input
              type="password"
              value={form.old_password}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  old_password: event.target.value,
                }))
              }
              required
            />
          </Field>

          <Field>
            <Label>Новый пароль</Label>
            <Input
              type="password"
              value={form.new_password}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  new_password: event.target.value,
                }))
              }
              required
            />
          </Field>

          <PrimaryButton type="submit" disabled={saving}>
            {saving ? "Обновляю..." : "Обновить пароль"}
          </PrimaryButton>
        </FormCard>
      </Content>
    </Page>
  );
}

export default ProfileSecurityPage;

const Page = styled.div`
  min-height: 100vh;
`;

const Content = styled.main`
  max-width: 840px;
  margin: 0 auto;
  padding: 36px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const TopBar = styled.section`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const Eyebrow = styled.div`
  color: var(--muted);
  font-style: italic;
  margin-bottom: 10px;
`;

const Title = styled.h1`
  font-size: clamp(34px, 5vw, 50px);
`;

const BackLink = styled(Link)`
  text-decoration: none;
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
`;

const FormCard = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Field = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const Label = styled.span`
  font-weight: 700;
`;

const Input = styled.input`
  width: 100%;
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
`;


const PrimaryButton = styled.button`
  border: none;
  border-radius: 12px;
  background: var(--orange);
  color: #fff;
  padding: 14px 18px;
  font-weight: 800;
  cursor: pointer;

  &:disabled {
    opacity: 0.65;
    cursor: wait;
  }
`;

const InfoCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;
