import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";

export const metadata = {
  title: "TrustShare — Secure File Sharing",
  description: "Secure file-sharing platform with AES-256 encrypted storage.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
