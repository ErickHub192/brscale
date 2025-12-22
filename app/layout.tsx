import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
    title: "Century AI 21",
    description: "AI-powered real estate marketplace",
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.Node;
}>) {
    return (
        <html lang="en">
            <body>{children}</body>
        </html>
    );
}
