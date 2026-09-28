import type { Metadata } from "next";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.PUBLIC_SITE_URL || "https://sarathi-smart-solutions.pages.dev"),
  icons: {
    icon: [
      {
        url: "/assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light-32.png",
        type: "image/png",
        sizes: "32x32"
      },
      {
        url: "/assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light.svg",
        type: "image/svg+xml"
      },
      {
        url: "/assets/brand/sarathi-cctv-logo-pack/favicon/favicon-dark.svg",
        type: "image/svg+xml",
        media: "(prefers-color-scheme: dark)"
      }
    ],
    apple: [
      {
        url: "/assets/brand/sarathi-cctv-logo-pack/favicon/favicon-light-256.png",
        sizes: "256x256"
      }
    ]
  }
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
      </head>
      <body>{children}</body>
    </html>
  );
}
