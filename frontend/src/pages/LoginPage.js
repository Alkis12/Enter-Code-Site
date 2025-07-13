import React from "react";
import LoginForm from "../components/LoginPageComp/LoginForm";
import LoginHeader from "../components/LoginPageComp/LoginHeader";
import backGround from "../assets/LoginAssets/Background.jpg";

function LoginPage() {
  return (
    <div
      style={{
        backgroundImage: `url(${backGround})`,
        height: "100vh",
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
      }}
    >
      <LoginHeader />
      <LoginForm />
    </div>
  );
}

export default LoginPage;
