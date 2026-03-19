import React from "react";
import styled from "styled-components";
import { Link } from "react-router-dom";

import Header from "../components/Header/Header";

function HomePage() {
  return (
    <Page>
      <Header />
      <Content>
        <HeroGrid>
          <HeroCard>
            <Eyebrow>Enter Code</Eyebrow>
            <HeroTitle>Курсы, расписание и обучение без случайного хаоса</HeroTitle>
            <HeroText>
              Здесь все собрано в одном ритме: понятные курсы, живое расписание,
              прогресс по урокам и отдельные рабочие разделы для преподавателей.
            </HeroText>
            <HeroActions>
              <PrimaryLink to="/news">Что нового</PrimaryLink>
              <SecondaryLink to="/events">Открыть расписание</SecondaryLink>
            </HeroActions>
            <HeroStats>
              <StatCard>
                <strong>Курсы</strong>
                <span>Программы с уроками, задачами и прогрессом</span>
              </StatCard>
              <StatCard>
                <strong>Группы</strong>
                <span>Отдельное расписание и состав для каждого потока</span>
              </StatCard>
              <StatCard>
                <strong>Достижения</strong>
                <span>Награды, история и прозрачная аналитика</span>
              </StatCard>
            </HeroStats>
          </HeroCard>

          <PreviewColumn>
            <PreviewCard>
              <PreviewLabel>Мои курсы</PreviewLabel>
              <PreviewTitle>Понятная структура без лишних экранов</PreviewTitle>
              <PreviewText>
                Ученик видит только то, что ему реально нужно: курс, доступные уроки,
                расписание своей группы и прогресс.
              </PreviewText>
            </PreviewCard>
            <PreviewCard $accent>
              <PreviewLabel>Для преподавателя</PreviewLabel>
              <PreviewTitle>Занятия, ручная проверка и посещаемость</PreviewTitle>
              <PreviewText>
                Рабочие инструменты вынесены в отдельный раздел, а не размазаны по
                профилю и случайным блокам.
              </PreviewText>
            </PreviewCard>
          </PreviewColumn>
        </HeroGrid>

        <Section>
          <SectionHeader>
            <SectionTitle>Что уже есть в платформе</SectionTitle>
            <SectionText>
              Все ключевые сценарии собраны вокруг курсов и расписания, а не вокруг
              случайных служебных блоков.
            </SectionText>
          </SectionHeader>
          <FeatureGrid>
            <FeatureCard>
              <strong>Курсы и группы</strong>
              <p>
                Внутри курса можно вести отдельные группы с разными днями и временем
                занятий, а также назначать учеников без лишних экранов.
              </p>
            </FeatureCard>
            <FeatureCard>
              <strong>Уроки и доступ</strong>
              <p>
                Уроки открываются по мере прохождения, а преподаватель может вручную
                управлять доступом и порядком.
              </p>
            </FeatureCard>
            <FeatureCard>
              <strong>Новости и публичные страницы</strong>
              <p>
                Новости открываются как полноценные статьи, а публичные страницы курсов
                помогают записаться без входа в аккаунт.
              </p>
            </FeatureCard>
          </FeatureGrid>
        </Section>

        <Section>
          <Banner>
            <div>
              <BannerTitle>Нужно посмотреть расписание или войти в кабинет?</BannerTitle>
              <BannerText>
                Главные сценарии вынесены на две понятные точки входа без перегруза.
              </BannerText>
            </div>
            <BannerActions>
              <PrimaryLink to="/events">Расписание</PrimaryLink>
              <SecondaryLink to="/login">Войти</SecondaryLink>
            </BannerActions>
          </Banner>
        </Section>
      </Content>
    </Page>
  );
}

export default HomePage;

const Page = styled.div`
  min-height: 100vh;
  background:
    radial-gradient(circle at top right, rgba(255, 127, 42, 0.12), transparent 26%),
    linear-gradient(180deg, #fffaf5 0%, #f7f9fc 100%);
`;

const Content = styled.main`
  max-width: 1240px;
  margin: 0 auto;
  padding: 42px 24px 80px;
  display: flex;
  flex-direction: column;
  gap: 28px;
`;

const HeroGrid = styled.section`
  display: grid;
  grid-template-columns: minmax(0, 1.4fr) minmax(320px, 0.9fr);
  gap: 24px;

  @media (max-width: 980px) {
    grid-template-columns: 1fr;
  }
`;

const HeroCard = styled.section`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 30px;
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const Eyebrow = styled.div`
  color: #23598d;
  font-style: italic;
`;

const HeroTitle = styled.h1`
  font-size: clamp(38px, 5vw, 62px);
  line-height: 0.98;
  max-width: 840px;
`;

const HeroText = styled.p`
  color: var(--muted);
  line-height: 1.75;
  max-width: 720px;
  font-size: 18px;
`;

const HeroActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const HeroStats = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 14px;
  margin-top: 4px;

  @media (max-width: 760px) {
    grid-template-columns: 1fr;
  }
`;

const StatCard = styled.div`
  padding: 16px;
  border-radius: 18px;
  background: #f8fafc;
  border: 1px solid #e7ecf3;
  display: flex;
  flex-direction: column;
  gap: 8px;

  strong {
    font-size: 20px;
  }

  span {
    color: var(--muted);
    line-height: 1.6;
  }
`;

const PreviewColumn = styled.div`
  display: grid;
  gap: 24px;
`;

const PreviewCard = styled.section`
  background: ${(props) => (props.$accent ? "#eef5fb" : "var(--card)")};
  border: 1px solid ${(props) => (props.$accent ? "#d8e6f3" : "var(--border)")};
  border-radius: 28px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;

const PreviewLabel = styled.div`
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 0.08em;
  font-size: 12px;
  font-weight: 800;
`;

const PreviewTitle = styled.h2`
  font-size: clamp(24px, 3vw, 36px);
  line-height: 1.08;
`;

const PreviewText = styled.p`
  color: var(--muted);
  line-height: 1.7;
`;

const Section = styled.section`
  display: flex;
  flex-direction: column;
  gap: 18px;
`;

const SectionHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 8px;
`;

const SectionTitle = styled.h2`
  font-size: clamp(28px, 3vw, 42px);
`;

const SectionText = styled.p`
  color: var(--muted);
  line-height: 1.7;
  max-width: 760px;
`;

const FeatureGrid = styled.div`
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const FeatureCard = styled.article`
  background: var(--card);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--shadow);
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 12px;

  strong {
    font-size: 22px;
  }

  p {
    color: var(--muted);
    line-height: 1.7;
  }
`;

const Banner = styled.div`
  background: linear-gradient(135deg, #ff7f2a 0%, #ff9c53 100%);
  color: #fffaf5;
  border-radius: 28px;
  padding: 28px;
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 20px;
  align-items: center;

  @media (max-width: 900px) {
    grid-template-columns: 1fr;
  }
`;

const BannerTitle = styled.h3`
  font-size: clamp(28px, 4vw, 42px);
  line-height: 1.05;
`;

const BannerText = styled.p`
  margin-top: 10px;
  line-height: 1.7;
  color: rgba(255, 250, 245, 0.86);
`;

const BannerActions = styled.div`
  display: flex;
  gap: 12px;
  flex-wrap: wrap;
`;

const BaseLink = styled(Link)`
  text-decoration: none;
  border-radius: 16px;
  padding: 14px 18px;
  font-weight: 800;
`;

const PrimaryLink = styled(BaseLink)`
  background: #1f2a44;
  color: #fffaf5;
`;

const SecondaryLink = styled(BaseLink)`
  background: #fff;
  color: #1f2a44;
`;
