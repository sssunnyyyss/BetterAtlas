import type { ReactElement } from "react";
import { Github, Twitter } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Footer as UiFooter } from "../ui/footer.js";

export default function Footer() {
  const location = useLocation();
  const uptimeStatusUrl =
    import.meta.env.VITE_UPTIME_STATUS_URL?.trim() || "https://status.betteratlas.net/status/main";
  const uptimeLabel = import.meta.env.VITE_UPTIME_LABEL?.trim() || "All systems operational";
  const xUrl = import.meta.env.VITE_SOCIAL_X_URL?.trim();
  const githubUrl = import.meta.env.VITE_SOCIAL_GITHUB_URL?.trim();
  const socialLinks = [
    xUrl
      ? ({
          icon: <Twitter className="h-5 w-5" />,
          href: xUrl,
          label: "X",
        } satisfies { icon: ReactElement; href: string; label: string })
      : null,
    githubUrl
      ? ({
          icon: <Github className="h-5 w-5" />,
          href: githubUrl,
          label: "GitHub",
        } satisfies { icon: ReactElement; href: string; label: string })
      : null,
  ].filter((link): link is { icon: ReactElement; href: string; label: string } => link !== null);

  // Hide footer on the landing/login page
  if (location.pathname === "/login") return null;

  return (
    <UiFooter
      logo={null}
      brandName="BetterAtlas"
      brandNode={
        <span
          className="text-2xl font-bold tracking-tight"
          style={{ fontFamily: "var(--ba-font-display)", color: "#012169" }}
        >
          BetterAtlas
        </span>
      }
      socialLinks={socialLinks}
      mainLinks={[
        { href: "/catalog", label: "Catalog" },
        { href: "/feedback-hub", label: "Feedback" },
        { href: "/faq", label: "FAQ" },
      ]}
      legalLinks={[
        { href: "/privacy", label: "Privacy Policy" },
        { href: uptimeStatusUrl, label: uptimeLabel },
      ]}
      copyright={{
        text: `© ${new Date().getFullYear()} BetterAtlas`,
        license: "Course selection made simple.",
      }}
    />
  );
}
