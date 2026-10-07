import { HandHeart, MessagesSquare, Search, Tag } from "lucide-react";
import LogoLoop from "@/components/reactbits/LogoLoop";
import { Logo } from "./Logo";

/**
 * The four stages of a case, looping continuously.
 *
 * UniFind has no partner or sponsor logos to show, and inventing university or
 * security-organisation marks would claim affiliations the project does not
 * have. The loop carries the REPORT → MATCH → CONNECT → REUNITE motif from the
 * design direction instead, which is the one thing the footer already said.
 */
const FLOW_STAGES = [
  { icon: Tag, label: "REPORT" },
  { icon: Search, label: "MATCH" },
  { icon: MessagesSquare, label: "CONNECT" },
  { icon: HandHeart, label: "REUNITE" },
];

const FLOW_LOGOS = FLOW_STAGES.map(({ icon: Icon, label }) => ({
  node: (
    <span className="footer-flow-node mono-label">
      <Icon size={15} aria-hidden="true" />
      {label}
      <span className="footer-flow-arrow" aria-hidden="true">
        →
      </span>
    </span>
  ),
  title: label,
  ariaLabel: label,
}));

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="site-footer-inner">
        <div className="footer-brand">
          <Logo />
          <p>The private Lost &amp; Found network for United International University.</p>
        </div>

        <div className="uf-logoloop footer-flow">
          <LogoLoop
            logos={FLOW_LOGOS}
            speed={38}
            direction="left"
            logoHeight={16}
            gap={26}
            pauseOnHover
            fadeOut
            fadeOutColor="var(--chassis)"
            scaleOnHover
            ariaLabel="How a UniFind case moves: report, match, connect, reunite"
          />
        </div>

        <p className="footer-legal mono-label">
          © {new Date().getFullYear()} UNIFIND · UNITED INTERNATIONAL UNIVERSITY
        </p>
      </div>
    </footer>
  );
}
