import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/space-grotesk/500.css";
import "@fontsource/space-grotesk/600.css";
import "@fontsource/space-grotesk/700.css";
import "./globals.css";
import Nav from "../components/Nav";

export const metadata = {
  title: "Portal do Cliente",
  description: "Gestão de reclamações e garantias — Hera Residences",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt" className="h-full antialiased">
      <body className="min-h-full">
        <div className="app-shell">
          <Nav />
          <div className="app-content">{children}</div>
        </div>
      </body>
    </html>
  );
}