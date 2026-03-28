import React, { useCallback, useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { Navigate } from "react-router-dom";

import Header from "../components/Header/Header";
import ContextBackButton from "../components/ContextBackButton";
import ImageUploadControl from "../components/ImageUploadControl";
import { getCurrentUserType, isAuthenticated } from "../api/auth";
import {
  listAchievementsOverview,
  updateAchievement,
  uploadAchievementAvatar,
} from "../api/achievements";

const API_URL = process.env.REACT_APP_API_URL || "http://localhost:8002";

function resolveAssetUrl(url) {
  if (!url) return "";
  if (url.startsWith("http") || url.startsWith("data:")) return url;
  return `${API_URL}${url.startsWith("/") ? "" : "/"}${url}`;
}

function formatDateTime(value) {
  if (!value) return "Без даты";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function getTypeLabel(item) {
  return item.achievement_type === "course" ? "Курс" : "Общее";
}

function AchievementsManagePage() {
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canManageAchievements = userType === "teacher" || userType === "admin";

  const [items, setItems] = useState([]);
  const [selectedId, setSelectedId] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
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
    () => items.find((item) => item.id === selectedId) || null,
    [items, selectedId]
  );

  const loadAchievements = useCallback(async ({ showLoader = true } = {}) => {
    try {
      if (showLoader) {
        setLoading(true);
      }

      const response = await listAchievementsOverview();
      const nextItems = response || [];
      setItems(nextItems);
      setSelectedId((prev) => {
        if (prev && nextItems.some((item) => item.id === prev)) {
          return prev;
        }
        return nextItems[0]?.id || "";
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

  const openEditor = (item) => {
    setSelectedId(item.id);
    setModalOpen(true);
    setMessage("");
    setError("");
  };

  const closeEditor = () => {
    setModalOpen(false);
    setMessage("");
    setError("");
  };

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
            <Eyebrow>Достижения</Eyebrow>
            <HeroTitle>Компактный редактор ачивок</HeroTitle>
            <HeroText>
              Все доступные достижения собраны в короткие карточки. Нажмите на
              карточку, чтобы сразу открыть редактирование и полную статистику
              по ученикам.
            </HeroText>
          </HeroCopy>

          <HeroActions>
            <BackButton fallbackTo="/profile">Назад</BackButton>
          </HeroActions>
        </HeroCard>

        {loading ? (
          <InfoCard>Загрузка достижений...</InfoCard>
        ) : items.length === 0 ? (
          <EmptyState>Нет достижений, доступных для редактирования.</EmptyState>
        ) : (
          <CardsGrid>
            {items.map((item) => (
              <MiniCard key={item.id} type="button" onClick={() => openEditor(item)}>
                <MiniTop>
                  <MiniAvatar>
                    {item.avatar_url ? (
                      <img src={resolveAssetUrl(item.avatar_url)} alt={item.title} />
                    ) : (
                      <span>{item.title.slice(0, 1).toUpperCase()}</span>
                    )}
                  </MiniAvatar>
                  <MiniStats>
                    <strong>{item.recipient_percent}%</strong>
                    <span>
                      {item.recipient_count}/{item.total_students}
                    </span>
                  </MiniStats>
                </MiniTop>
                <MiniType>{getTypeLabel(item)}</MiniType>
                <MiniTitle>{item.title}</MiniTitle>
                <MiniMeta>{item.course_name || "Все курсы"}</MiniMeta>
              </MiniCard>
            ))}
          </CardsGrid>
        )}
      </Content>

      {modalOpen && selectedAchievement && (
        <Overlay onClick={closeEditor}>
          <ModalCard onClick={(event) => event.stopPropagation()}>
            <ModalHeader>
              <div>
                <ModalTitle>{selectedAchievement.title}</ModalTitle>
                <ModalText>
                  {getTypeLabel(selectedAchievement)} ·{" "}
                  {selectedAchievement.course_name || "Все курсы"}
                </ModalText>
              </div>
              <IconButton type="button" onClick={closeEditor}>
                ×
              </IconButton>
            </ModalHeader>

            <StatsGrid>
              <StatBox>
                <span>Условие</span>
                <strong>{selectedAchievement.condition_text}</strong>
              </StatBox>
              <StatBox>
                <span>Получили</span>
                <strong>
                  {selectedAchievement.recipient_count}/{selectedAchievement.total_students}
                </strong>
              </StatBox>
              <StatBox>
                <span>Процент</span>
                <strong>{selectedAchievement.recipient_percent}%</strong>
              </StatBox>
            </StatsGrid>

            <EditorGrid as="form" onSubmit={handleSave}>
              <PreviewCard>
                <PreviewAvatar>
                  {form.avatar_url ? (
                    <img
                      src={resolveAssetUrl(form.avatar_url)}
                      alt={form.title || selectedAchievement.title}
                    />
                  ) : (
                    <span>{(form.title || "A").slice(0, 1).toUpperCase()}</span>
                  )}
                </PreviewAvatar>
                <PreviewBody>
                  <strong>{form.title || "Без названия"}</strong>
                  <p>{form.description || "Описание пока не заполнено."}</p>
                </PreviewBody>
                <ImageUploadControl
                  inputId={`achievement-avatar-${selectedAchievement.id}`}
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

                <RecipientsBlock>
                  <RecipientsTitle>Статистика по ученикам</RecipientsTitle>
                  {selectedAchievement.recipients.length === 0 ? (
                    <EmptyState>Пока никто не получил это достижение.</EmptyState>
                  ) : (
                    <RecipientsList>
                      {selectedAchievement.recipients.map((recipient) => (
                        <RecipientRow key={`${selectedAchievement.id}-${recipient.user_id}`}>
                          <div>
                            <strong>
                              {recipient.name} {recipient.surname}
                            </strong>
                            <span>@{recipient.tg_username}</span>
                          </div>
                          <small>{formatDateTime(recipient.unlocked_at)}</small>
                        </RecipientRow>
                      ))}
                    </RecipientsList>
                  )}
                </RecipientsBlock>
              </FieldsColumn>

              <ActionRow>
                <SecondaryButton type="button" onClick={closeEditor}>
                  Закрыть
                </SecondaryButton>
                <PrimaryButton type="submit" disabled={saving}>
                  {saving ? "Сохраняю..." : "Сохранить"}
                </PrimaryButton>
              </ActionRow>
            </EditorGrid>
          </ModalCard>
        </Overlay>
      )}
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

const CardsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 14px;
`;

const MiniCard = styled.button`
  border: 1px solid #e3ebef;
  border-radius: 20px;
  background: #fff;
  padding: 16px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 10px;
  box-shadow: var(--shadow);
`;

const MiniTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
`;

const MiniAvatar = styled.div`
  width: 56px;
  height: 56px;
  border-radius: 50%;
  background: linear-gradient(135deg, #18ab8b 0%, #2ad0b0 100%);
  display: grid;
  place-items: center;
  overflow: hidden;
  color: #fff;
  font-size: 24px;
  font-weight: 800;

  img {
    width: 100%;
    height: 100%;
    object-fit: cover;
  }
`;

const MiniStats = styled.div`
  text-align: right;

  strong {
    display: block;
    font-size: 22px;
  }

  span {
    color: var(--muted);
    font-size: 13px;
  }
`;

const MiniType = styled.div`
  color: #23598d;
  font-weight: 800;
  font-size: 13px;
  text-transform: uppercase;
`;

const MiniTitle = styled.h2`
  font-size: 22px;
  line-height: 1.2;
`;

const MiniMeta = styled.div`
  color: var(--muted);
`;

const Overlay = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(20, 25, 37, 0.46);
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  z-index: 60;
`;

const ModalCard = styled.section`
  width: min(1080px, 100%);
  max-height: calc(100vh - 48px);
  overflow: auto;
  background: #fff;
  border-radius: 28px;
  border: 1px solid #e8ebf2;
  box-shadow: 0 28px 80px rgba(19, 24, 34, 0.2);
  padding: 28px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const ModalHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
`;

const ModalTitle = styled.h2`
  font-size: clamp(28px, 4vw, 40px);
`;

const ModalText = styled.p`
  color: var(--muted);
  margin-top: 8px;
`;

const IconButton = styled.button`
  width: 44px;
  height: 44px;
  border: 1px solid #d7dbe4;
  border-radius: 999px;
  background: #fff;
  font-size: 28px;
  line-height: 1;
  cursor: pointer;
`;

const StatsGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const StatBox = styled.div`
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e6ebf2;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 8px;

  span {
    color: var(--muted);
    font-size: 13px;
  }

  strong {
    line-height: 1.5;
  }
`;

const EditorGrid = styled.form`
  display: grid;
  grid-template-columns: 300px minmax(0, 1fr);
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

const Label = styled.label`
  display: flex;
  flex-direction: column;
  gap: 8px;
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

const RecipientsBlock = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const RecipientsTitle = styled.h3`
  font-size: 22px;
`;

const RecipientsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
  max-height: 320px;
  overflow: auto;
`;

const RecipientRow = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;

  span,
  small {
    color: var(--muted);
  }
`;

const ActionRow = styled.div`
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  flex-wrap: wrap;
  grid-column: 1 / -1;
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

const SecondaryButton = styled.button`
  border: 1px solid #d7dbe4;
  border-radius: 12px;
  background: #fff;
  color: var(--text);
  padding: 14px 18px;
  font-weight: 700;
  cursor: pointer;
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
