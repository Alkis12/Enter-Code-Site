import styled from "styled-components";
import { useTranslation } from "react-i18next";
import { useNavigate } from "react-router-dom";

const ProfileInfoWrapper = styled.div`
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 0 5vh;
  padding: 0;
  justify-self: left;
  justify-content: left;
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
  gap: 16px;
  margin-right: 3vh;
`;
const ProfileInfo = ({ info }) => {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const fullName = `${info.name} ${info.surname}`;
  const subscriotionStatus = info.subscription_status;
  const lessonsRemaining = info.lessons_remaining;

  return (
    <ProfileInfoWrapper>
      <h1>{fullName}</h1>
      <h3>{t("Profile.courses")}</h3>
      <p>- CourseTitle</p>
      <ProgressBarWrapper>
        <Progress progress={50} />
      </ProgressBarWrapper>
      <h3>{t("Profile.plan")}</h3>
      <FlexRow>
        <FlexRow>
          <p>{t("Profile.planstatus")}</p>
          <p style={{ color: "rgb(33, 154, 135)" }}>
            {subscriotionStatus ? subscriotionStatus : "-"}
          </p>
        </FlexRow>
        <FlexRow>
          <p>{t("Profile.leftover")}</p>
          <p style={{ color: "rgb(213, 166, 9)" }}>
            {lessonsRemaining ? lessonsRemaining : "-"}
          </p>
        </FlexRow>
      </FlexRow>
    </ProfileInfoWrapper>
  );
};

export default ProfileInfo;
