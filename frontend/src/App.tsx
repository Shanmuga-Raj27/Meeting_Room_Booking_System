import React from "react";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { muiTheme } from "./theme/muiTheme";

function App(): React.JSX.Element {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <Box sx={{ p: 4, minHeight: "100vh" }}>
        {/* Entrypoint for components and routing */}
        <h1>Room Booking System</h1>
      </Box>
    </ThemeProvider>
  );
}

export default App;
