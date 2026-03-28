import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Navigate } from "react-router-dom";

import ContextBackButton from "../components/ContextBackButton";
import ImageUploadControl from "../components/ImageUploadControl";
import Header from "../components/Header/Header";
import { isAuthenticated } from "../api/auth";
import {
  changePassword,
  getProfile,
  updateProfile,
  uploadProfileAvatar,
} from "../api/account";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function getInitials(profile) {
  return (
    `${profile?.name?.[0] || ""}${profile?.surname?.[0] || ""}`.trim() || "EC"
  );
}

function ProfileEditPage() {
  const authed = isAuthenticated();
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        const response = await getProfile();
        setForm({
          name: response.name || "",
          surname: response.surname || "",
          tg_username: response.tg_username || "",
          telegram_id: response.telegram_id || "",
          phone: response.phone || "",
          bio: response.bio || "",
          avatar_url: response.avatar_url || "",
          old_password: "",
          new_password: "",
        });
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить профиль");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  const handleSave = async (event) => {
    event.preventDefault();
    if (!form) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      const response = await updateProfile({
        name: form.name,
        surname: form.surname,
        tg_username: form.tg_username,
        telegram_id: form.telegram_id,
        phone: form.phone,
        bio: form.bio,
        avatar_url: form.avatar_url,
      });
      if (form.old_password || form.new_password) {
        if (!form.old_password || !form.new_password) {
          throw new Error("\u0417\u0430\u043f\u043e\u043b\u043d\u0438\u0442\u0435 \u043e\u0431\u0430 \u043f\u043e\u043b\u044f \u0434\u043b\u044f \u0441\u043c\u0435\u043d\u044b \u043f\u0430\u0440\u043e\u043b\u044f");
        }
        await changePassword({
          old_password: form.old_password,
          new_password: form.new_password,
        });
      }
      setForm({
        name: response.name || "",
        surname: response.surname || "",
        tg_username: response.tg_username || "",
        telegram_id: response.telegram_id || "",
        phone: response.phone || "",
        bio: response.bio || "",
        avatar_url: response.avatar_url || "",
        old_password: "",
        new_password: "",
      });
      setMessage(
        form.old_password || form.new_password
          ? "\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u0438 \u043f\u0430\u0440\u043e\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d\u044b"
          : "\u041f\u0440\u043e\u0444\u0438\u043b\u044c \u043e\u0431\u043d\u043e\u0432\u043b\u0435\u043d"
      );
    } catch (err) {
      setError(err.message || "Не удалось сохранить профиль");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    try {
      const response = await uploadProfileAvatar(file);
      setForm((prev) => ({
        ...prev,
        avatar_url: response.url || "",
      }));
      setMessage("Фото профиля загружено");
    } catch (err) {
      setError(err.message || "Не удалось загрузить фото");
    } finally {
      setUploading(false);
      event.target.value = "";
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
            <Eyebrow>Настройки профиля</Eyebrow>
            <Title>Редактировать профиль</Title>
          </div>
          <BackButton fallbackTo="/profile">Назад</BackButton>
        </TopBar>

        {loading || !form ? (
          <InfoCard>Загрузка профиля...</InfoCard>
        ) : (
          <Grid>
            <PreviewCard>
              <AvatarFrame>
                {form.avatar_url ? (
                  <AvatarImage
                    src={resolveAssetUrl(form.avatar_url)}
                    alt="Фото профиля"
                  />
                ) : (
                  <AvatarFallback>{getInitials(form)}</AvatarFallback>
                )}
              </AvatarFrame>
              <UploadBlock>
                <Label>Фото профиля</Label>
                <ImageUploadControl
                  inputId="profile-avatar-upload"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  hasValue={Boolean(form.avatar_url)}
                  uploading={uploading}
                  onChange={handleAvatarUpload}
                  onRemove={() =>
                    setForm((prev) => ({
                      ...prev,
                      avatar_url: "",
                    }))
                  }
                />
              </UploadBlock>
            </PreviewCard>

            <FormCard as="form" onSubmit={handleSave}>
              <FormGrid>
                <Field>
                  <Label>Имя</Label>
                  <Input
                    value={form.name}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    required
                  />
                </Field>

                <Field>
                  <Label>Фамилия</Label>
                  <Input
                    value={form.surname}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        surname: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <Field>
                  <Label>Логин</Label>
                  <Input
                    value={form.tg_username}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        tg_username: event.target.value,
                      }))
                    }
                    required
                  />
                </Field>

                <Field>
                  <Label>Telegram ID</Label>
                  <Input
                    value={form.telegram_id}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        telegram_id: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field style={{ gridColumn: "1 / -1" }}>
                  <Label>Телефон</Label>
                  <Input
                    value={form.phone}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, phone: event.target.value }))
                    }
                  />
                </Field>

                <Field style={{ gridColumn: "1 / -1" }}>
                  <Label>О себе</Label>
                  <Textarea
                    rows={6}
                    value={form.bio}
                    onChange={(event) =>
                      setForm((prev) => ({ ...prev, bio: event.target.value }))
                    }
                  />
                </Field>

                <Field>
                  <Label>{"\u0422\u0435\u043a\u0443\u0449\u0438\u0439 \u043f\u0430\u0440\u043e\u043b\u044c"}</Label>
                  <Input
                    type="password"
                    value={form.old_password}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        old_password: event.target.value,
                      }))
                    }
                  />
                </Field>

                <Field>
                  <Label>{"\u041d\u043e\u0432\u044b\u0439 \u043f\u0430\u0440\u043e\u043b\u044c"}</Label>
                  <Input
                    type="password"
                    value={form.new_password}
                    onChange={(event) =>
                      setForm((prev) => ({
                        ...prev,
                        new_password: event.target.value,
                      }))
                    }
                  />
                </Field>
              </FormGrid>

              <ActionRow>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? "Сохраняю..." : "Сохранить профиль"}
                </PrimaryButton>
              </ActionRow>
            </FormCard>
          </Grid>
        )}
      </Content>
    </Page>
  );
}

export default ProfileEditPage;

const Page = styled.div`
  min-height: 100vh;
`;

const Content = styled.main`
  max-width: 1240px;
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

const BackButton = styled(ContextBackButton)`
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font: inherit;
  font-weight: 700;
  cursor: pointer;
`;

const Grid = styled.section`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const PreviewCard = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
  align-items: center;
`;

const AvatarFrame = styled.div`
  width: 220px;
  height: 220px;
  border-radius: 50%;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: linear-gradient(145deg, #ececef 0%, #d7d8dc 100%);
`;

const AvatarImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const AvatarFallback = styled.div`
  width: 100%;
  height: 100%;
  display: grid;
  place-items: center;
  color: #fff;
  font-size: 56px;
  font-weight: 800;
  background: linear-gradient(135deg, #ff7f2a 0%, #ffb067 100%);
`;

const UploadBlock = styled.div`
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
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

const FormGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 14px;

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
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

const Textarea = styled.textarea`
  width: 100%;
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
  resize: vertical;
`;

const ActionRow = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
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
