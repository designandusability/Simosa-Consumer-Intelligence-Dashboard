import "./globals.css";

export const metadata = {
  title: "SIMOSA Consumer Intelligence",
  description: "Google Play review intelligence for product, CX and design teams.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
