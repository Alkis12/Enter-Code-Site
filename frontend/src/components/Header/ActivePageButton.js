import { useHistory } from "react-router-dom";
import { Link } from "react-router-dom";
import { Box, Button, Typography } from "@material-ui/core";
import styled from "styled-components";

const ActivePageButtonProps = ({ route, children, textColor }) => {
  const ActivePageButtonStyle = styled.button`
    color: white;
    border: 3px solid rgb(255, 255, 255);
    background-color: #fa7f2f;
    padding: 10px 20px;
    border-radius: 15px;
    font-size: 16px;
    cursor: pointer;
  `;
  let history = useHistory();

  const navigate = () => {
    history.push(route);
  };

  return (
    <Box>
      <Link to={route} style={{ textDecoration: "none" }}>
        <ActivePageButtonStyle onClick={navigate}>
          <Typography
            variant="h5"
            fontFamily="Open Sans Bold"
            style={{ color: textColor }}
          >
            {children}
          </Typography>
        </ActivePageButtonStyle>
      </Link>
    </Box>
  );
};

export default ActivePageButtonProps;
