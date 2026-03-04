import { Github, Twitter } from "lucide-react";
import { useLocation } from "react-router-dom";

import { Footer as UiFooter } from "../ui/footer.js";

export default function Footer() {
  const location = useLocation();
  const uptimeStatusUrl =
    import.meta.env.VITE_UPTIME_STATUS_URL?.trim() || "https://status.betteratlas.net/status/main";
  const uptimeLabel = import.meta.env.VITE_UPTIME_LABEL?.trim() || "All systems operational";

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
      socialLinks={[
        {
          icon: <Twitter className="h-5 w-5" />,
          href: "https://twitter.com",
          label: "Twitter",
        },
        {
          icon: <Github className="h-5 w-5" />,
          href: "https://github.com",
          label: "GitHub",
        },
      ]}
      mainLinks={[
        { href: "/catalog", label: "Catalog" },
        { href: "/feedback-hub", label: "Feedback" },
        { href: "/faq", label: "FAQ" },
        { href: "/about", label: "About Us" },
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
