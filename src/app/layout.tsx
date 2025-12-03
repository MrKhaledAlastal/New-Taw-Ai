import type { Metadata } from "next";
import { Inter, Cairo, Space_Grotesk } from "next/font/google";
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from "@/contexts/auth-provider";
import { LanguageProvider } from "@/contexts/language-provider";
import { ThemeProvider } from "@/contexts/theme-provider";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
});

const cairo = Cairo({
  subsets: ["arabic", "latin"],
  variable: "--font-cairo",
});

export const metadata: Metadata = {
  title: "Tawjihi AI",
  description: "A personalized study assistant for Tawjihi students.",
  manifest: "/manifest.webmanifest",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${cairo.variable} ${inter.variable} ${spaceGrotesk.variable}`}
    >
      <head>
        <meta
          name="theme-color"
          content="#1e1e1e"
          media="(prefers-color-scheme: dark)"
        />
        <meta
          name="theme-color"
          content="#ffffff"
          media="(prefers-color-scheme: light)"
        />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
      </head>

      {/* ✔ هنا نخلي Cairo الخط الأساسي */}
      <body className="font-cairo antialiased">
        <ThemeProvider
          attribute="class"
          defaultTheme="dark"
          enableSystem
          disableTransitionOnChange
        >
          <AuthProvider>
            <LanguageProvider>
              <div className="animated-grid-background">{children}</div>
              <Toaster />
            </LanguageProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
