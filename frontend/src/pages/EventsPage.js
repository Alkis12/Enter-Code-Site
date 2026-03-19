import React, { useEffect, useMemo, useState } from "react";
import styled from "styled-components";
import { useNavigate } from "react-router-dom";

import Header from "../components/Header/Header";
import { getWeekEvents } from "../api/events";

function formatDateKey(date) {
  return `${date.getFullYear()}-${`${date.getMonth() + 1}`.padStart(2, "0")}-${`${date.getDate()}`.padStart(2, "0")}`;
}

function getWeekStart(date) {
  const dayIndex = (date.getDay() + 6) % 7;
  const start = new Date(date);
  start.setDate(date.getDate() - dayIndex);
  start.setHours(0, 0, 0, 0);
  return start;
}

const dayLabels = [
  "Понедельник",
  "Вторник",
  "Среда",
  "Четверг",
  "Пятница",
  "Суббота",
  "Воскресенье",
];

function EventsPage() {
  const navigate = useNavigate();
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const weekStart = useMemo(() => getWeekStart(new Date()), []);
  const weekDays = useMemo(
    () =>
      Array.from({ length: 7 }).map((_, index) => {
        const date = new Date(weekStart);
        date.setDate(weekStart.getDate() + index);
        return {
          key: formatDateKey(date),
          label: dayLabels[index],
          short: new Intl.DateTimeFormat("ru-RU", {
            day: "numeric",
            month: "short",
          }).format(date),
        };
      }),
    [weekStart]
  );

  useEffect(() => {
    let active = true;
    const loadEvents = async () => {
      try {
        setLoading(true);
        const data = await getWeekEvents(formatDateKey(new Date()));
        if (active) {
          setEvents(Array.isArray(data) ? data : []);
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

    loadEvents();
    return () => {
      active = false;
    };
  }, []);

  const eventsByDate = useMemo(() => {
    const map = new Map();
    events.forEach((event) => {
      const key = event.occurrence_date;
      if (!key) return;
      if (!map.has(key)) {
        map.set(key, []);
      }
      map.get(key).push(event);
    });
    return map;
  }, [events]);

  return (
    <Page>
      <Header />
      <Content>
        <HeroSection>
          <HeroCopy>
            <Eyebrow>Публичное расписание</Eyebrow>
            <Title>Занятия и события недели</Title>
            <Subtitle>
              Все курсы видны сразу в одном месте. По карточке курса можно
              перейти к подробной информации и оставить заявку.
            </Subtitle>
          </HeroCopy>
          <WeekStrip>
            {weekDays.map((day) => (
              <DayChip key={day.key}>
                <strong>{day.label.slice(0, 2)}</strong>
                <span>{day.short}</span>
              </DayChip>
            ))}
          </WeekStrip>
        </HeroSection>

        {loading && <StatusCard>Загрузка расписания...</StatusCard>}
        {error && <StatusCard $error>{error}</StatusCard>}

        {!loading &&
          !error &&
          weekDays.map((day) => {
            const dayEvents = eventsByDate.get(day.key) || [];
            return (
              <DaySection key={day.key}>
                <DayHeader>
                  <SectionTitle>{day.label}</SectionTitle>
                  <SectionMeta>{day.short}</SectionMeta>
                </DayHeader>
                {dayEvents.length === 0 ? (
                  <EmptyDay>В этот день занятий пока нет.</EmptyDay>
                ) : (
                  <Cards>
                    {dayEvents.map((event) => (
                      <Card
                        key={`${event.id}-${day.key}`}
                        type="button"
                        $accent={event.button_color || "#ff8a3d"}
                        onClick={() => event.target_url && navigate(event.target_url)}
                        disabled={!event.target_url}
                      >
                        <Time>{event.start_time}{event.end_time ? `-${event.end_time}` : ""}</Time>
                        <CardBody>
                          <Row>
                            <CardTitle>{event.title}</CardTitle>
                            <CardType>
                              {event.source_type === "course_session"
                                ? "Курс"
                                : "Событие"}
                            </CardType>
                          </Row>
                          <CardText>
                            {event.description || "Подробности появятся позже."}
                          </CardText>
                          <CardFooter>
                            <span>{event.course_name || ""}</span>
                            <ActionLabel>
                              {event.target_url ? "Открыть" : "Скоро"}
                            </ActionLabel>
                          </CardFooter>
                        </CardBody>
                      </Card>
                    ))}
                  </Cards>
                )}
              </DaySection>
            );
          })}
      </Content>
    </Page>
  );
}

export default EventsPage;

const Page = styled.div`
  min-height: 100vh;
  background:
    radial-gradient(circle at top left, rgba(255, 194, 132, 0.24), transparent 28%),
    linear-gradient(180deg, #f8fbff 0%, #fff7ef 100%);
`;

const Content = styled.main`
  max-width: 1160px;
  margin: 0 auto;
  padding: 36px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 24px;
`;

const HeroSection = styled.section`
  background: #101826;
  color: #fff;
  border-radius: 32px;
  padding: 30px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) 320px;
  gap: 20px;

  @media (max-width: 920px) {
    grid-template-columns: 1fr;
  }
`;

const HeroCopy = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Eyebrow = styled.div`
  color: #ffb36f;
  font-weight: 800;
  text-transform: uppercase;
  letter-spacing: 0.08em;
`;

const Title = styled.h1`
  font-size: clamp(34px, 6vw, 58px);
`;

const Subtitle = styled.p`
  color: rgba(255, 255, 255, 0.78);
  line-height: 1.7;
  max-width: 720px;
`;

const WeekStrip = styled.div`
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 12px;
`;

const DayChip = styled.div`
  border-radius: 18px;
  background: rgba(255, 255, 255, 0.07);
  padding: 14px;

  strong {
    display: block;
    font-size: 22px;
    margin-bottom: 4px;
  }

  span {
    color: rgba(255, 255, 255, 0.72);
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

const EmptyDay = styled.div`
  padding: 18px 20px;
  border-radius: 20px;
  background: #fff;
  border: 1px solid #e7ebf2;
  color: var(--muted);
`;

const Cards = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
`;

const Card = styled.button`
  width: 100%;
  border: 1px solid rgba(18, 24, 38, 0.08);
  border-left: 8px solid ${(props) => props.$accent};
  border-radius: 24px;
  background: #fff;
  box-shadow: 0 18px 34px rgba(17, 24, 39, 0.08);
  padding: 18px 20px;
  display: grid;
  grid-template-columns: 170px minmax(0, 1fr);
  gap: 18px;
  text-align: left;
  cursor: ${(props) => (props.disabled ? "default" : "pointer")};

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const Time = styled.div`
  font-size: 34px;
  font-weight: 800;
  color: #111722;
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

const CardType = styled.div`
  padding: 8px 12px;
  border-radius: 999px;
  background: #f4f6fb;
  color: #586276;
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

const ActionLabel = styled.div`
  font-weight: 800;
  color: var(--orange);
`;

const StatusCard = styled.div`
  padding: 16px 18px;
  border-radius: 16px;
  background: ${(props) => (props.$error ? "#fff0f0" : "#f2f6ff")};
  color: ${(props) => (props.$error ? "#b53d3d" : "#334b7d")};
`;
