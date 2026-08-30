import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "TrustShare – Secure File Sharing",
    template: "%s | TrustShare",
  },
  description:
    "TrustShare is a secure, modern file sharing platform with end-to-end encryption and role-based access control.",
  keywords: ["file sharing", "secure", "encrypted", "cloud storage"],
  authors: [{ name: "TrustShare Team" }],
  openGraph: {
    type: "website",
    title: "TrustShare – Secure File Sharing",
    description: "Share files securely with TrustShare.",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link
          rel="preconnect"
          href="https://fonts.gstatic.com"
          crossOrigin="anonymous"
        />
      </head>
      <body>
        <main>{children}</main>
      </body>
    </html>
  );
}
