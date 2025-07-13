import React from "react";
import styled from "styled-components";

const StyledForm = styled.form`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

const FormWrapper = styled.div`
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  width: 400px;
  margin: 150px auto;
  padding: 40px;
  background: #fff;
  border-radius: 12px;
  box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
`;

const Input = styled.input`
  width: 300px;
  padding: 12px 16px;
  margin-bottom: 16px;
  border: 1px solid #ccc;
  border-radius: 6px;
  font-size: 16px;

  &:focus {
    outline: none;
    border-color: grey;
  }
`;

const Button = styled.button`
  width: 100%;
  margin-top: 16px;
  padding: 12px 16px;
  background-color: #fa7f2f;
  color: white;
  font-size: 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;

  &:hover {
    background-color: rgb(208, 105, 37);
  }
`;

function LoginForm() {
  const handleSubmit = (e) => {
    e.preventDefault();
    alert("Вход выполнен (заглушка)");
  };

  return (
    <FormWrapper>
      <StyledForm onSubmit={handleSubmit}>
        <h1>ВХОД</h1>
        <Input type="text" placeholder="Логин" required />
        <Input type="password" placeholder="Пароль" required />
        <Button type="submit">
          {" "}
          <h2>ВОЙТИ</h2>{" "}
        </Button>
      </StyledForm>
    </FormWrapper>
  );
}

export default LoginForm;
