import React from "react";
import styled from "styled-components";
import Header from "../components/Header/Header";
import background from "../assets/LoginAssets/Background.jpg";
import ProfileInfo from "../components/ProfilePageComp/ProfileInfo";
import Achievments from "../components/ProfilePageComp/Achievments";
import Settings from "../components/ProfilePageComp/Settings";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";

const ProfilePageWrapper = styled.div`
  margin: 5vh;
`;

const Image = styled.img`
  display: grid;
  width: 30vh;
  height: 30vh;
  padding: 0px;
  border-radius: 100%;
  grid-column-start: 1;
  justify-self: left;
  align-self: center;
`;

const MainInfoWrapper = styled.div`
  align-items: start;
  width: 100%;
  max-width: 1000px;
  margin: 0;
  display: grid;
  grid-template-columns: 1fr 3fr;
`;

const AchievmentsWrapper = styled.div`
  width: 100%;
  max-width: 1000px;
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 0;
  padding: 0;
`;

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: left;
  margin: 4vh 0 10vh 0;
`;

const LogOutButton = styled.button`
  width: 20%;
  padding: 10px 20px;
  background-color: #fa7f2f;
  color: white;
  font-size: 30px;
  border: none;
  border-radius: 10px;
  cursor: pointer;
  box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);

  &:hover {
    background-color: rgb(208, 105, 37);
  }
`;

const ProfilePage = () => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <div>
      <Header />
      <ProfilePageWrapper>
        <MainInfoWrapper>
          <Image src={background} alt="background" />
          <ProfileInfo />
        </MainInfoWrapper>
        <AchievmentsWrapper>
          <Achievments />
        </AchievmentsWrapper>
        <Settings />
        <ButtonWrapper>
          <LogOutButton
            onClick={() => {
              navigate("/login", { replace: true });
            }}
          >
            {t("Profile.logout")}
          </LogOutButton>
        </ButtonWrapper>
      </ProfilePageWrapper>
    </div>
  );
};

export default ProfilePage;
