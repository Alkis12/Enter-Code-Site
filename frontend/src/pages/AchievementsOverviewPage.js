import React, { useEffect, useState } from "react";
import styled from "styled-components";
import { Link, Navigate, useLocation } from "react-router-dom";

import ContextBackButton from "../components/ContextBackButton";
import Header from "../components/Header/Header";
import { getCurrentUserType, isAuthenticated } from "../api/auth";
import { listAchievementsOverview } from "../api/achievements";

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
  return item.achievement_type === "course" ? "Курсовое" : "Общее";
}

function AchievementsOverviewPage() {
  const location = useLocation();
  const authed = isAuthenticated();
  const userType = getCurrentUserType();
  const canViewOverview = userType === "admin" || userType === "teacher";
  const currentPath = `${location.pathname}${location.search}${location.hash}`;

  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [openedId, setOpenedId] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        const response = await listAchievementsOverview();
        setItems(response || []);
        setOpenedId((response || [])[0]?.id || "");
        setError("");
      } catch (err) {
        setError(err.message || "Не удалось загрузить достижения");
      } finally {
        setLoading(false);
      }
    };

    if (authed && canViewOverview) {
      load();
    }
  }, [authed, canViewOverview]);

  if (!authed) {
    return <Navigate to="/login" replace />;
  }

  if (!canViewOverview) {
    return <Navigate to="/profile" replace />;
  }

  return (
    <Page>
      <Header />
      <Content>
        {error && <StatusCard $error>{error}</StatusCard>}

        <HeroCard>
          <div>
            <Eyebrow>Достижения</Eyebrow>
            <Title>Все ачивки и статистика получения</Title>
            <HeroText>
              Здесь видно тип достижения, реальное условие получения, процент
              получивших и конкретных учеников, которым оно уже открылось.
            </HeroText>
          </div>
          <HeroActions>
            <ActionGroup>
              <SecondaryLink to="/achievements/manage" state={{ from: currentPath }}>
                Редактировать достижения
              </SecondaryLink>
              <BackButton fallbackTo="/profile">Назад</BackButton>
            </ActionGroup>
          </HeroActions>
        </HeroCard>

        {loading ? (
          <StatusCard>Загрузка достижений...</StatusCard>
        ) : (
          <Cards>
            {items.map((item) => {
              const isOpen = openedId === item.id;
              return (
                <Card key={item.id}>
                  <CardButton type="button" onClick={() => setOpenedId(isOpen ? "" : item.id)}>
                    <CardTop>
                      <div>
                        <TypePill>{getTypeLabel(item)}</TypePill>
                        <CardTitle>{item.title}</CardTitle>
                      </div>
                      <PercentBlock>
                        <strong>{item.recipient_percent}%</strong>
                        <span>{item.recipient_count}/{item.total_students}</span>
                      </PercentBlock>
                    </CardTop>
                    <InfoGrid>
                      <InfoBox>
                        <span>Условие</span>
                        <strong>{item.condition_text}</strong>
                      </InfoBox>
                      <InfoBox>
                        <span>Тип триггера</span>
                        <strong>{item.trigger}</strong>
                      </InfoBox>
                      <InfoBox>
                        <span>Курс</span>
                        <strong>{item.course_name || "Все курсы"}</strong>
                      </InfoBox>
                    </InfoGrid>
                    <Description>{item.description}</Description>
                  </CardButton>

                  {isOpen && (
                    <RecipientsBlock>
                      <RecipientsTitle>Получили достижение</RecipientsTitle>
                      {item.recipients.length === 0 ? (
                        <EmptyState>Пока никто не получил это достижение.</EmptyState>
                      ) : (
                        <RecipientsList>
                          {item.recipients.map((recipient) => (
                            <RecipientRow key={`${item.id}-${recipient.user_id}`}>
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
                  )}
                </Card>
              );
            })}
          </Cards>
        )}
      </Content>
    </Page>
  );
}

export default AchievementsOverviewPage;

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
  background: linear-gradient(135deg, #f6fbff 0%, #ffffff 60%);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 28px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const Eyebrow = styled.div`
  color: #23598d;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const Title = styled.h1`
  font-size: clamp(34px, 5vw, 52px);
  margin-top: 10px;
`;

const HeroText = styled.p`
  color: var(--muted);
  line-height: 1.7;
  margin-top: 12px;
  max-width: 760px;
`;

const HeroActions = styled.div`
  display: flex;
  align-items: flex-start;
`;

const ActionGroup = styled.div`
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
  justify-content: flex-end;
`;

const SecondaryLink = styled(Link)`
  text-decoration: none;
  border-radius: 16px;
  padding: 13px 18px;
  font-weight: 800;
  background: #eef5fb;
  color: #23598d;
`;

const BackButton = styled(ContextBackButton)`
  border: 1px solid #d7dbe4;
  border-radius: 16px;
  padding: 13px 18px;
  font: inherit;
  font-weight: 800;
  background: #fff;
  color: var(--text);
  cursor: pointer;
`;

const Cards = styled.div`
  display: grid;
  gap: 16px;
`;

const Card = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  overflow: hidden;
`;

const CardButton = styled.button`
  width: 100%;
  border: none;
  background: transparent;
  padding: 24px;
  text-align: left;
  cursor: pointer;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const CardTop = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 16px;
  align-items: flex-start;
  flex-wrap: wrap;
`;

const TypePill = styled.div`
  display: inline-flex;
  padding: 8px 12px;
  border-radius: 999px;
  background: #eef5fb;
  color: #23598d;
  font-weight: 800;
  margin-bottom: 10px;
`;

const CardTitle = styled.h2`
  font-size: clamp(24px, 3vw, 34px);
`;

const PercentBlock = styled.div`
  min-width: 132px;
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
  text-align: right;

  strong {
    display: block;
    font-size: 28px;
  }

  span {
    color: var(--muted);
  }
`;

const InfoGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 12px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const InfoBox = styled.div`
  padding: 14px;
  border-radius: 18px;
  background: #f8fafc;
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

const Description = styled.p`
  color: var(--muted);
  line-height: 1.7;
`;

const RecipientsBlock = styled.div`
  border-top: 1px solid #e7ecf3;
  padding: 0 24px 24px;
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const RecipientsTitle = styled.h3`
  font-size: 22px;
  margin-top: 20px;
`;

const RecipientsList = styled.div`
  display: flex;
  flex-direction: column;
  gap: 10px;
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

const StatusCard = styled.div`
  border-radius: 18px;
  padding: 16px 18px;
  background: ${(props) => (props.$error ? "#fff1f1" : "#effaf5")};
  color: ${(props) => (props.$error ? "#b94a48" : "#1f7a52")};
  border: 1px solid ${(props) => (props.$error ? "#f2c9c9" : "#cdeedc")};
`;

const EmptyState = styled.div`
  padding: 18px;
  border-radius: 18px;
  background: #f8fafc;
  color: var(--muted);
`;
