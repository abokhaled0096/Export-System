import type { Metadata } from "next";
import { IBM_Plex_Sans_Arabic, Geist } from "next/font/google";
import Nav from "@/components/Nav";
import StaleBuildGuard from "@/components/StaleBuildGuard";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});


// النظام عربي RTL بالأساس في P1 — مفتاح تبديل اللغة الكامل (عربي/إنجليزي) مؤجَّل
// لـPhase 2 (راجع docs/SCOPE-P1.md)، مش محذوف.
const plexArabic = IBM_Plex_Sans_Arabic({
  variable: "--font-plex-arabic",
  subsets: ["arabic", "latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "ELHEIBALAND EXPORT",
  description: "منظومة إدارة التصدير والتجارة الدولية — ELHEIBALAND EXPORT",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ar" dir="rtl" className={cn("h-full", "antialiased", plexArabic.variable, "font-sans", geist.variable)}>
      <body className="min-h-full flex flex-col bg-neutral-50 text-neutral-900 font-sans">
        {/* بيتعافى من ملفات JS بايتة بعد نشر جديد — راجع المكوّن. */}
        <StaleBuildGuard />
        <Nav />
        {children}
      </body>
    </html>
  );
}
