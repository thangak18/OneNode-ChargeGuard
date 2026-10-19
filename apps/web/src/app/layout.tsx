import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'ChargeGuard — EV Fleet Monitoring & Incident Command Center',
  description:
    'Real-time EV charging station operations, historical telemetry analysis, and incident lifecycle response platform powered by MongoDB Atlas and Datadog.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full dark antialiased`}
      style={{ colorScheme: 'dark' }}
    >
      <head>
        <meta name="theme-color" content="#030712" />
      </head>
      <body className="min-h-full flex flex-col bg-slate-950 text-slate-100">{children}</body>
    </html>
  );
}
