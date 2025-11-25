import type { Metadata, Viewport } from "next";
import { Toaster } from "@/components/ui/toaster";
import { LanguageProvider } from "@/context/language-provider";
import { ThemeProvider } from "@/components/theme-provider";
import { SearchProvider } from "@/context/search-provider";
import "./globals.css";

const APP_NAME = "MD Business Flow";
const APP_DEFAULT_TITLE = "MD Business Flow";
const APP_TITLE_TEMPLATE = "%s - MD Business Flow";
const APP_DESCRIPTION = "Your modern business management solution.";


export const metadata: Metadata = {
  applicationName: APP_NAME,
  title: {
    default: APP_DEFAULT_TITLE,
    template: APP_TITLE_TEMPLATE,
  },
  description: APP_DESCRIPTION,
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_DEFAULT_TITLE,
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: "#000000",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/icons/favicon.ico" sizes="any" />
        <link rel="icon" href="/icons/icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/apple-touch-icon.png" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Roboto+Mono:wght@500;700&display=swap" rel="stylesheet" />
      </head>
      <body className="antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <LanguageProvider>
            <SearchProvider>
              <Toaster />
              {children}
            </SearchProvider>
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
