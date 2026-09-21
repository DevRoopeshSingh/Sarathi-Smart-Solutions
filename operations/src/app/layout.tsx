import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_SITE_URL || "https://sarathi-smart-solutions.pages.dev")
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem("sarathi_theme");var d=window.matchMedia("(prefers-color-scheme: dark)").matches;var r=t==="dark"||(!t&&d)?"dark":"light";document.documentElement.setAttribute("data-theme",r);if(r==="dark"){document.documentElement.classList.add("dark");}else{document.documentElement.classList.remove("dark");}}catch(e){}})();`
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Manrope:wght@300;400;500;600;700;800&display=swap"
          rel="stylesheet"
        />
        <link rel="icon" type="image/png" href="/01_icon_primary.png" />
      </head>
      <body>{children}</body>
    </html>
  );
}
