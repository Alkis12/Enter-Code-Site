import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header/Header";
import { getWeekEvents } from "../api/events";

function formatDate(date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function formatReadableDate(value) {
  if (!value) return "";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("ru-RU", {
    weekday: "short",
    day: "numeric",
    month: "long",
  }).format(date);
}

function MySchedulePage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const today = useMemo(() => new Date(), []);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        setLoading(true);
        const response = await getWeekEvents(formatDate(today));
        if (active) {
          setEvents(Array.isArray(response) ? response : []);
          setError("");
        }
      } catch (err) {
        if (active) {
          setError(err.message || "Не удалось загрузить расписание");
        }
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [today]);

  const groupedEvents = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const key = event.occurrence_date;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(event);
    });
    return Array.from(map.entries()).sort(([left], [right]) =>
      left.localeCompare(right)
    );
  }, [events]);

  return (
    <Page>
      <Header />
      <Content>
        <HeroCard>
          <div>
            <Eyebrow>Личный кабинет</Eyebrow>
            <Title>Расписание</Title>
            <Description>
              Здесь собраны занятия всех курсов и актуальные события недели.
              Свои занятия можно открыть сразу из карточки.
            </Description>
          </div>
          <TodayCard>
            <span>Сегодня</span>
            <strong>{formatReadableDate(formatDate(today))}</strong>
          </TodayCard>
        </HeroCard>

        {loading && <StatusCard>Загрузка расписания...</StatusCard>}
        {error && <StatusCard $error>{error}</StatusCard>}

        {!loading &&
          !error &&
          groupedEvents.map(([date, dayEvents]) => (
            <DaySection key={date}>
              <DayHeader>
                <SectionTitle>{formatReadableDate(date)}</SectionTitle>
                <SectionMeta>{dayEvents.length} занятий</SectionMeta>
              </DayHeader>
              <Cards>
                {dayEvents.map((event) => (
                  <ScheduleCard
                    key={`${event.id}-${date}`}
                    type="button"
                    $highlight={Boolean(event.is_user_related)}
                    onClick={() => event.target_url && navigate(event.target_url)}
                    disabled={!event.target_url}
                  >
                    <TimeBlock>
                      <strong>{event.start_time}</strong>
                      <span>{event.end_time ? `${event.end_time}` : ""}</span>
                    </TimeBlock>
                    <CardBody>
                      <Row>
                        <CardTitle>{event.title}</CardTitle>
                        <TypeBadge $highlight={Boolean(event.is_user_related)}>
                          {event.source_type === "course_session"
                            ? event.is_user_related
                              ? "Мое занятие"
                              : "Курс"
                            : "Событие"}
                        </TypeBadge>
                      </Row>
                      <CardText>{event.description || "Описание появится позже."}</CardText>
                      <CardFooter>
                        <span>{event.course_name || ""}</span>
                        <OpenLabel>
                          {event.target_url
                            ? event.is_user_related
                              ? "Открыть курс"
                              : "Подробнее"
                            : "Без перехода"}
                        </OpenLabel>
                      </CardFooter>
                    </CardBody>
                  </ScheduleCard>
                ))}
              </Cards>
            </DaySection>
          ))}
      </Content>
    </Page>
  );
}

export default MySchedulePage;

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
  grid-template-columns: minmax(0, 1fr) 280px;
  gap: 20px;
  background: linear-gradient(140deg, #fff7ef 0%, #ffffff 55%);
  border-radius: 28px;
  border: 1px solid var(--border);
  box-shadow: var(--shadow);
  padding: 28px;

  @media (max-width: 860px) {
    grid-template-columns: 1fr;
  }
`;

const Eyebrow = styled.div`
  color: var(--orange);
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  margin-bottom: 8px;
`;

const Title = styled.h1`
  font-size: clamp(36px, 6vw, 60px);
  margin-bottom: 10px;
`;

const Description = styled.p`
  color: var(--muted);
  line-height: 1.7;
  max-width: 720px;
`;

const TodayCard = styled.div`
  padding: 18px 20px;
  border-radius: 22px;
  background: #12161f;
  color: #fff;
  align-self: start;

  span {
    display: block;
    opacity: 0.72;
    margin-bottom: 8px;
  }

  strong {
    font-size: 24px;
    line-height: 1.3;
  }
`;

const DaySection = styled.section`
  display: flex;
  flex-direction: column;
  gap: 16px;
`;

const DayHeader = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`;

const SectionTitle = styled.h2`
  font-size: 30px;
`;

const SectionMeta = styled.div`
  color: var(--muted);
  font-weight: 700;
`;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const ScheduleCard = styled.button`
  width: 100%;
  display: grid;
  grid-template-columns: 140px minmax(0, 1fr);
  gap: 16px;
  text-align: left;
  border: 1px solid ${(props) => (props.$highlight ? "#f7c69d" : "#e7ebf2")};
  border-radius: 24px;
  background: ${(props) => (props.$highlight ? "#fff8f1" : "#fff")};
  box-shadow: var(--shadow);
  padding: 18px;
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};

  @media (max-width: 720px) {
    grid-template-columns: 1fr;
  }
`;

const TimeBlock = styled.div`
  border-radius: 18px;
  background: #12161f;
  color: #fff;
  padding: 18px 16px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  justify-content: center;

  strong {
    font-size: 28px;
  }

  span {
    opacity: 0.7;
  }
`;

const CardBody = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const Row = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;
`;

const CardTitle = styled.h3`
  font-size: 26px;
`;

const TypeBadge = styled.div`
  padding: 8px 12px;
  border-radius: 999px;
  background: ${(props) => (props.$highlight ? "#ff8f3d" : "#edf1f7")};
  color: ${(props) => (props.$highlight ? "#fff" : "#556074")};
  font-weight: 800;
`;

const CardText = styled.p`
  color: var(--muted);
  line-height: 1.6;
`;

const CardFooter = styled.div`
  display: flex;
  justify-content: space-between;
  gap: 12px;
  align-items: center;
  flex-wrap: wrap;

  span {
    color: var(--muted);
  }
`;

const OpenLabel = styled.div`
  font-weight: 800;
  color: var(--orange);
`;

const StatusCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;
