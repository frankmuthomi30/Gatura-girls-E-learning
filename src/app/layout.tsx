import type { Metadata, Viewport } from 'next';
import Script from 'next/script';
import { Fraunces, Manrope } from 'next/font/google';
import './globals.css';

const bodyFont = Manrope({
  subsets: ['latin'],
  variable: '--font-body',
});

const headingFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-heading',
});

export const metadata: Metadata = {
  title: 'Gatura Girls Learning Portal',
  description: 'E-Learning platform for Gatura Girls Secondary School',
  manifest: '/manifest.json',
  appleWebApp: {
    statusBarStyle: 'default',
    title: 'Gatura Girls',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#1A6B45',
};

export const dynamic = 'force-dynamic';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`
            (function () {
              try {
                var storedTheme = localStorage.getItem('theme');
                var theme = storedTheme === 'dark' || storedTheme === 'light'
                  ? storedTheme
                  : (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
                document.documentElement.classList.toggle('dark', theme === 'dark');
                document.documentElement.style.colorScheme = theme;
              } catch (error) {
                document.documentElement.classList.remove('dark');
                document.documentElement.style.colorScheme = 'light';
              }
            })();
          `}
        </Script>
      </head>
      <body className={`${bodyFont.variable} ${headingFont.variable} min-h-screen`}>
        {children}
      </body>
    </html>
  );
}
