import type { ReactNode } from "react";
import { Footer, Layout, Navbar } from "nextra-theme-docs";
import { Head } from "nextra/components";
import { getPageMap } from "nextra/page-map";
import "nextra-theme-docs/style.css";
import "./styles.css";
import { TkStage } from "../../components/telekinesis";

export const metadata = {
  title: { default: "Telekinesis", template: "%s – Telekinesis" },
  description:
    "Cinematic, AI-orchestrated product demo videos — your real app records itself, driven by Playwright and narrated by a timesheet.",
};

const navbar = (
  <Navbar
    logo={
      <span className="tk-logo">
        <span aria-hidden>◑</span> Telekinesis
      </span>
    }
    projectLink="https://github.com/telekinesis/telekinesis"
  />
);

const footer = (
  <Footer>MIT {new Date().getFullYear()} © Telekinesis — this site recorded its own demos.</Footer>
);

export default async function RootLayout({ children }: { children: ReactNode }) {
  const pageMap = await getPageMap();
  return (
    <html lang="en" dir="ltr" suppressHydrationWarning>
      <Head faviconGlyph="◑" />
      <body>
        {/*
          Force Telekinesis demo mode before hydration so every <Frame> registers
          and any section's motion can be played live. Frames render as a
          transparent fragment on the server + first client render, then upgrade
          in a layout effect (no hydration mismatch).
        */}
        <script dangerouslySetInnerHTML={{ __html: "window.__TELEKINESIS_FORCE__=true" }} />
        <TkStage />
        <Layout
          navbar={navbar}
          footer={footer}
          pageMap={pageMap}
          docsRepositoryBase="https://github.com/telekinesis/telekinesis/blob/main/apps/docs"
          editLink="Edit this page"
          sidebar={{ defaultMenuCollapseLevel: 1 }}
        >
          {children}
        </Layout>
      </body>
    </html>
  );
}
