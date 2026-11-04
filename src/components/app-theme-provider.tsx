"use client";

import { CssBaseline } from "@mui/material";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import type { ReactNode } from "react";

const theme = createTheme({
  palette: {
    mode: "dark",
    primary: { main: "#d9b66f" },
    secondary: { main: "#8c3b47" },
    background: { default: "#161415", paper: "#211c1c" },
    text: { primary: "#f8f1e4", secondary: "#c6bdb1" },
  },
  shape: { borderRadius: 12 },
  typography: { fontFamily: "var(--font-noto-sans-thai), sans-serif" },
  components: {
    MuiButton: {
      styleOverrides: { root: { fontWeight: 700, letterSpacing: "0.02em" } },
    },
  },
});

export function AppThemeProvider({ children }: { children: ReactNode }) {
  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      {children}
    </ThemeProvider>
  );
}
