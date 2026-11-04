import type { Metadata } from "next";
import { AppRouterCacheProvider } from "@mui/material-nextjs/v16-appRouter";
import { AppThemeProvider } from "@/components/app-theme-provider";
import "./globals.css";

export const metadata: Metadata = {
  title: "โรงแรมปริศนา | เกมสืบสวนออนไลน์",
  description: "เกมสืบสวนและจับฆาตกรออนไลน์ในโรงแรมปริศนา",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="th" suppressHydrationWarning>
      <body>
        <AppRouterCacheProvider options={{ enableCssLayer: true }}>
          <AppThemeProvider>{children}</AppThemeProvider>
        </AppRouterCacheProvider>
      </body>
    </html>
  );
}
