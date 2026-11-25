import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-700.css";
import "./globals.css";

export const metadata = {
  title: "Product Intelligence Dashboard",
  description: "Google Play review intelligence for product, CX and design teams.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
