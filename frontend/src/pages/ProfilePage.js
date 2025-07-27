import React from "react";
import styled from "styled-components";
import Header from "../components/Header/Header";
import background from "../assets/LoginAssets/Background.jpg";
import ProfileInfo from "../components/ProfilePageComp/ProfileInfo";
import Achievments from "../components/ProfilePageComp/Achievments";

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
  width: 100vh;
  display: grid;
  grid-template-columns: 1fr 3fr;
`;

const AchievmentsWrapper = styled.div`
  width: 100vh;
  display: flex;
  flex-direction: column;
  align-items: left;
  margin: 0;
  padding: 0;
`;

const ProfilePage = () => {
  return (
    <div>
      <Header />
      <MainInfoWrapper>
        <Image src={background} alt="background" />
        <ProfileInfo />
      </MainInfoWrapper>
      <AchievmentsWrapper>
        <Achievments />
      </AchievmentsWrapper>
    </div>
  );
};

export default ProfilePage;
