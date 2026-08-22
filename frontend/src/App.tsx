import React from "react";
import { ThemeProvider, CssBaseline, Box } from "@mui/material";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { muiTheme } from "./theme/muiTheme";
import Navigation from "./components/Navigation";
import Dashboard from "./pages/Dashboard";
import RoomTimeline from "./pages/RoomTimeline";
import Settings from "./pages/Settings";

function App(): React.JSX.Element {
  return (
    <ThemeProvider theme={muiTheme}>
      <CssBaseline />
      <BrowserRouter>
        <Navigation />
        <Box sx={{ p: 4, minHeight: "100vh" }}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/timeline" element={<RoomTimeline />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Box>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
