
import { ClerkProvider } from "@clerk/nextjs";
import { shadcn } from "@clerk/ui/themes";
import type { Metadata } from "next";
import { Geist_Mono, Inter } from "next/font/google";
import { SiteShell } from "@/components/layout/site-shell";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Orbit Study",
  description:
    "Turn whiteboards and lectures into notes, flashcards, and focused study.",
};

export default function RootLayout({
  children,
}: LayoutProps<"/">) {
  return (
    // `dark` switches the shadcn tokens to the Orbit (Figma) palette in globals.css; without it every
    // page falls back to the default white/black theme.
    <html lang="en" className={`${inter.variable} ${geistMono.variable} dark h-full antialiased`}>
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <ClerkProvider
          appearance={{ theme: shadcn }}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          signInFallbackRedirectUrl="/"
          signUpFallbackRedirectUrl="/"
        >
          <SiteShell>{children}</SiteShell>
        </ClerkProvider>
      </body>
    </html>
  );
}
