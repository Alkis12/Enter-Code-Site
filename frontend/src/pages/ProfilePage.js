import React from "react";
import styled from "styled-components";
import Header from "../components/Header/Header";
import background from "../assets/LoginAssets/Background.jpg";
import ProfileInfo from "../components/ProfilePageComp/ProfileInfo";

const Image = styled.img`
  display: grid;
  width: 30vh;
  height: 30vh;
  padding: 0px;
  border-radius: 100%;
  grid-column-start: 1;
  justify-self: center;
  align-self: center;
`;

const ProfilePageWrapper = styled.div`
  align-items: start;
  margin: 10vh 0vh;
  width: 100vh;
  display: grid;
  grid-template-columns: 1fr 1fr;
`;

const ProfilePage = () => {
  return (
    <div>
      <Header />
      <ProfilePageWrapper>
        <Image src={background} alt="background" />
        <ProfileInfo />
      </ProfilePageWrapper>
    </div>
  );
};

export default ProfilePage;
