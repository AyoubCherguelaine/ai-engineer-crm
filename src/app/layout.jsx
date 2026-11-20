import "./globals.css";
import { Toaster } from "@/components/ui/sonner";

export const metadata = {
  title: "Reach — Personal outreach CRM",
  description:
    "Your personal workspace for meaningful connections, collaborations, and part-time opportunities.",
  icons: { icon: "/favicon.svg" },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        {children}
        <Toaster theme="light" position="bottom-right" richColors closeButton />
      </body>
    </html>
  );
}
