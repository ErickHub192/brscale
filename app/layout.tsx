import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "BR SCALE",
    description: "AI-powered real estate marketplace for brokers",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
