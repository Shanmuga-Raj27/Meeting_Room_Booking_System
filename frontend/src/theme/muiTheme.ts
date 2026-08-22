import { createTheme } from "@mui/material/styles";

export const muiTheme = createTheme({
  palette: {
    mode: "light",
    primary: {
      main: "#000000",
      contrastText: "#FFFFFF",
    },
    secondary: {
      main: "#1A1A1A",
      contrastText: "#FFFFFF",
    },
    background: {
      default: "#F9F9F9",
      paper: "#FFFFFF",
    },
    text: {
      primary: "#000000",
      secondary: "#4A4A4A",
    },
    divider: "#E0E0E0",
  },
  typography: {
    fontFamily: [
      "Inter",
      "-apple-system",
      "BlinkMacSystemFont",
      '"Segoe UI"',
      "Roboto",
      '"Helvetica Neue"',
      "Arial",
      "sans-serif",
    ].join(","),
    h1: { fontWeight: 700 },
    h2: { fontWeight: 600 },
    h3: { fontWeight: 600 },
    h4: { fontWeight: 600 },
    h5: { fontWeight: 600 },
    h6: { fontWeight: 600 },
    button: { textTransform: "none", fontWeight: 600 },
  },
  shape: {
    borderRadius: 4, // Sharp, slightly rounded borders
  },
  components: {
    MuiButton: {
      styleOverrides: {
        root: {
          border: "1px solid #000000",
          boxShadow: "none",
          "&:hover": {
            boxShadow: "none",
          },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          border: "1px solid #E0E0E0",
          boxShadow: "none", // Avoid heavy card shadows
        },
      },
    },
    MuiPaper: {
      styleOverrides: {
        elevation1: {
          boxShadow: "none",
          border: "1px solid #E0E0E0",
        },
      },
    },
    MuiDialog: {
      styleOverrides: {
        paper: {
          border: "1px solid #000000",
          boxShadow: "0px 10px 30px rgba(0,0,0,0.1)", // Slight shadow for depth only on modals
        },
      },
    },
    MuiOutlinedInput: {
      styleOverrides: {
        root: {
          "& .MuiOutlinedInput-notchedOutline": {
            borderColor: "#E0E0E0",
          },
          "&:hover .MuiOutlinedInput-notchedOutline": {
            borderColor: "#000000",
          },
          "&.Mui-focused .MuiOutlinedInput-notchedOutline": {
            borderColor: "#000000",
            borderWidth: "1px",
          },
        },
      },
    },
  },
});
