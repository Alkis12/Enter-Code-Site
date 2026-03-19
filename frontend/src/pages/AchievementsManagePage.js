import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Link, Navigate } from "react-router-dom";

import ImageUploadControl from "../components/ImageUploadControl";
import Header from "../components/Header/Header";
import { getCurrentUserType, isAuthenticated } from "../api/auth";
import {
  listEditableAchievements,
  updateAchievement,
  uploadAchievementAvatar,
} from "../api/achievements";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function AchievementsManagePage() {
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canManageAchievements = userType === "teacher" || userType === "admin";

  const [achievements, setAchievements] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [form, setForm] = useState({
    title: "",
    description: "",
    avatar_url: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectedAchievement = useMemo(
    () => achievements.find((item) => item.id === selectedId) || null,
    [achievements, selectedId]
  );

  const loadAchievements = useCallback(async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const response = await listEditableAchievements();
      setAchievements(response || []);

      let nextSelectedId = "";
      setSelectedId((prev) => {
        nextSelectedId =
          prev && response.some((item) => item.id === prev)
            ? prev
            : response[0]?.id || "";
        return nextSelectedId;
      });

      const selected =
        response.find((item) => item.id === nextSelectedId) || response[0] || null;
      setForm({
        title: selected?.title || "",
        description: selected?.description || "",
        avatar_url: selected?.avatar_url || "",
      });
      setError("");
    } catch (err) {
      setError(err.message || "Не удалось загрузить достижения");
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    if (authed && canManageAchievements) {
      loadAchievements();
    }
  }, [authed, canManageAchievements, loadAchievements]);

  useEffect(() => {
    if (!selectedAchievement) {
      return;
    }
    setForm({
      title: selectedAchievement.title || "",
      description: selectedAchievement.description || "",
      avatar_url: selectedAchievement.avatar_url || "",
    });
  }, [selectedAchievement]);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (!canManageAchievements) {
    return <Navigate to="/profile" replace />;
  }

  const handleSave = async (event) => {
    event.preventDefault();
    if (!selectedAchievement) {
      return;
    }

    setSaving(true);
    setError("");
    setMessage("");
    try {
      await updateAchievement(selectedAchievement.id, {
        title: form.title,
        description: form.description,
        avatar_url: form.avatar_url || null,
      });
      setMessage("Достижение обновлено");
      await loadAchievements({ showLoader: false });
    } catch (err) {
      setError(err.message || "Не удалось сохранить достижение");
    } finally {
      setSaving(false);
    }
  };

  const handleAvatarUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file || !selectedAchievement) {
      return;
    }

    setUploading(true);
    setError("");
    setMessage("");
    try {
      const response = await uploadAchievementAvatar(selectedAchievement.id, file);
      setForm((prev) => ({
        ...prev,
        avatar_url: response.url || "",
      }));
      setMessage("Аватарка загружена");
      await loadAchievements({ showLoader: false });
    } catch (err) {
      setError(err.message || "Не удалось загрузить аватарку");
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

        <HeroCard>
          <HeroCopy>
            <Eyebrow>Редактор достижений</Eyebrow>
            <HeroTitle>Отдельный раздел для ачивок</HeroTitle>
            <HeroText>
              Выберите достижение из списка, поменяйте его название и описание,
              а затем загрузите новую аватарку. Профиль больше не перегружен
              этими настройками.
            </HeroText>
          </HeroCopy>

          <HeroActions>
            <SecondaryLink to="/profile">Назад в профиль</SecondaryLink>
          </HeroActions>
        </HeroCard>

        <SectionCard as="form" onSubmit={handleSave}>
          <SectionHeader>
            <div>
              <SectionTitle>Настройка достижения</SectionTitle>
              <SectionText>
                Доступны только общие достижения и достижения по вашим курсам.
              </SectionText>
            </div>
          </SectionHeader>

          {loading ? (
            <EmptyState>Загрузка достижений...</EmptyState>
          ) : achievements.length === 0 ? (
            <EmptyState>Нет достижений, доступных для редактирования.</EmptyState>
          ) : (
            <>
              <Label>
                Достижение
                <Select
                  value={selectedId}
                  onChange={(event) => setSelectedId(event.target.value)}
                >
                  {achievements.map((achievement) => (
                    <option key={achievement.id} value={achievement.id}>
                      {achievement.title}
                    </option>
                  ))}
                </Select>
              </Label>

              <EditorGrid>
                <PreviewCard>
                  <PreviewAvatar>
                    {form.avatar_url ? (
                      <img
                        src={resolveAssetUrl(form.avatar_url)}
                        alt={form.title || "Achievement"}
                      />
                    ) : (
                      <span>{(form.title || "A").slice(0, 1).toUpperCase()}</span>
                    )}
                  </PreviewAvatar>
                  <PreviewBody>
                    <strong>{form.title || "Без названия"}</strong>
                    <p>{form.description || "Описание пока не заполнено."}</p>
                  </PreviewBody>
                </PreviewCard>

                <FieldsColumn>
                  <Label>
                    Название
                    <Input
                      value={form.title}
                      onChange={(event) =>
                        setForm((prev) => ({ ...prev, title: event.target.value }))
                      }
                      required
                    />
                  </Label>

                  <Label>
                    Описание
                    <Textarea
                      rows={5}
                      value={form.description}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          description: event.target.value,
                        }))
                      }
                    />
                  </Label>

                  <Label>
                    Аватарка
                    <UploadRow>
                      <ImageUploadControl
                        inputId="achievement-avatar-upload"
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
                    </UploadRow>
                  </Label>
                </FieldsColumn>
              </EditorGrid>

              <ActionRow>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? "Сохраняю..." : "Сохранить достижение"}
                </PrimaryButton>
              </ActionRow>
            </>
          )}
        </SectionCard>
      </Content>
    </Page>
  );
}

export default AchievementsManagePage;

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

const HeroCard = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 24px;
  align-items: start;
  background: linear-gradient(135deg, #f2fbf8 0%, #ffffff 55%);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 28px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const HeroCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Eyebrow = styled.div`
  color: var(--green);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const HeroTitle = styled.h1`
  font-size: clamp(32px, 5vw, 52px);
`;

const HeroText = styled.p`
  color: var(--muted);
  line-height: 1.7;
  max-width: 760px;
`;

const HeroActions = styled.div`
  display: flex;
  align-items: flex-start;
`;

const SectionCard = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const SectionHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 14px;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: 30px;
`;

const SectionText = styled.p`
  color: var(--muted);
  line-height: 1.6;
`;

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-weight: 700;
`;

const Select = styled.select`
  width: 100%;
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  padding: 13px 14px;
  background: #fff;
`;

const EditorGrid = styled.div`
  display: grid;
  grid-template-columns: 320px minmax(0, 1fr);
  gap: 24px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const PreviewCard = styled.div`
  border-radius: 24px;
  background: linear-gradient(180deg, #f7fafb 0%, #ffffff 100%);
  border: 1px solid #e4edf0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  align-items: center;
  text-align: center;
`;

const PreviewAvatar = styled.div`
  width: 140px;
  height: 140px;
  border-radius: 50%;
  background: linear-gradient(135deg, #18ab8b 0%, #2ad0b0 100%);
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff;
  font-size: 56px;
  font-weight: 800;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const PreviewBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;

  p {
    color: var(--muted);
    line-height: 1.6;
  }
`;

const FieldsColumn = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
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

const UploadRow = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
  align-items: center;
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

const SecondaryLink = styled(Link)`
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
  text-decoration: none;
`;

const EmptyState = styled.div`
  padding: 16px 18px;
  border-radius: 18px;
  background: #f6f8fb;
  color: var(--muted);
  line-height: 1.6;
`;

const InfoCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;
