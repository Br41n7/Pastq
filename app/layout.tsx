import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import { Toaster } from 'react-hot-toast';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'PastQ — Africa\'s Past Questions Marketplace',
  description: 'Buy and sell compiled past questions for WAEC, JAMB, NECO, KCSE and more. AI-powered study insights.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} bg-[#F8F8F8] text-[#111]`}>
        <Toaster position="top-right" />
        {children}
      </body>
    </html>
  );
}
