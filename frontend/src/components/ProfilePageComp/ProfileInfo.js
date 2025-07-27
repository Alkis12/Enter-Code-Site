import React from "react";
import styled from "styled-components";
import { useTranslation } from "react-i18next";

const ProfileInfoWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 0;
  padding: 0;
`;

const ProgressBarWrapper = styled.div`
  margin: 10px 0;
  width: 100%;
  height: 20px;
  background-color: #eee;
  border-radius: 10px;
  box-shadow: inset 0 2px 6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
`;

const Progress = styled.div`
  height: 100%;
  background-color: rgb(33, 154, 135);
  width: ${({ progress }) => progress}%;
  border-radius: 10px;
  transition: width 0.3s ease;
`;

const FlexRow = styled.div`
  display: flex;
  gap: 16px; /* расстояние между текстами */
  margin-right: 3vh;
`;

const Heading1 = styled.h1`
  font-size: 50px;
  font-weight: bold;
  margin-bottom: 16px;
`;

const Heading3 = styled.h3`
  font-size: 24px;
  font-weight: bold;
  margin: 8px 0;
`;

const ProfileInfo = () => {
  const { t } = useTranslation();
  return (
    <ProfileInfoWrapper>
      <Heading1>{t("Profile.name")}</Heading1>
      <Heading3>{t("Profile.courses")}</Heading3>
      <p>- CourseTitle</p>
      <ProgressBarWrapper>
        <Progress progress={50} />
      </ProgressBarWrapper>
      <Heading3>{t("Profile.plan")}</Heading3>
      <FlexRow>
        <FlexRow>
          <p>{t("Profile.planstatus")}</p>
          <p style={{ color: "rgb(33, 154, 135)" }}>payed</p>
        </FlexRow>
        <FlexRow>
          <p>{t("Profile.leftover")}</p>
          <p style={{ color: "rgb(213, 166, 9)" }}>3</p>
        </FlexRow>
      </FlexRow>
    </ProfileInfoWrapper>
  );
};

export default ProfileInfo;
