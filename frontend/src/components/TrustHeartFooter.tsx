import { useNavigate } from "react-router-dom";
import { ProjectCredit } from "@/components/ui/project-credit";
import {
  ArrowUp,
  Box,
  Database,
  FlaskConical,
  ShieldCheck,
} from "lucide-react";
import BeamWordmarkFooter, {
  type FooterColumn,
  type FooterCredit,
  type FooterSocial,
} from "@/components/ui/beam-wordmark-footer";

const columns: FooterColumn[] = [
  {
    title: "Explore the platform",
    links: [
      { label: "Home", href: "/" },
      { label: "Start analysis", href: "/analysis" },
      { label: "Results", href: "/results" },
      { label: "Model insights", href: "/explainability" },
    ],
  },
  {
    title: "Behind the science",
    links: [
      { label: "Methodology", href: "/methodology" },
      { label: "About the project", href: "/about" },
      {
        label: "Dataset source",
        href: "https://archive.ics.uci.edu/dataset/411/extension+of+z+alizadeh+sani+dataset",
      },
      {
        label: "3D model license",
        href: "https://creativecommons.org/licenses/by/4.0/",
      },
    ],
  },
];
const credits: FooterCredit[] = [
  { label: "More perspective." },
  { lead: "More transparency.", label: "" },
];
// Real project-source shortcuts, not invented social accounts.
const sources: FooterSocial[] = [
  {
    label: "UCI dataset source",
    href: "https://archive.ics.uci.edu/dataset/411/extension+of+z+alizadeh+sani+dataset",
    icon: <Database aria-hidden="true" />,
  },
  {
    label: "Original 3D heart model",
    href: "https://sketchfab.com/3d-models/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089",
    icon: <Box aria-hidden="true" />,
  },
];

export default function TrustHeartFooter() {
  const navigate = useNavigate();
  return (
    <BeamWordmarkFooter
      brand="TrustHeart 3D"
      company="TrustHeart 3D"
      wordmark="TrustHeart"
      columns={columns}
      credits={credits}
      socials={sources}
      background="#100619"
      ink="#fff1f6"
      muted="#bea8c8"
      accent="#f576aa"
      wordTop="#8a365e"
      wordFoot="#220c29"
      wordWeight={600}
      fontSans="Space Grotesk, ui-sans-serif, system-ui, sans-serif"
      cut={0.07}
      className="trustheart-footer"
      onLinkClick={(_label, href, event) => {
        if (
          !event ||
          event.defaultPrevented ||
          event.button !== 0 ||
          event.metaKey ||
          event.ctrlKey ||
          event.shiftKey ||
          event.altKey
        )
          return;
        if (href?.startsWith("/") && !href.startsWith("//")) {
          event.preventDefault();
          navigate(href);
          window.scrollTo({ top: 0, behavior: "instant" });
        }
      }}
    >
      <div className="thf-status-row">
        <span className="thf-demo">
          <FlaskConical size={13} />
          <span>CALIBRATED INFERENCE</span>
        </span>
        <span className="thf-session">No patient data stored</span>
        <button
          className="thf-top"
          aria-label="Back to top"
          onClick={() => {
            window.scrollTo({
              top: 0,
              behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                .matches
                ? "instant"
                : "smooth",
            });
            // Move keyboard focus along with the view instead of stranding it below.
            document
              .querySelector<HTMLAnchorElement>(".site-header .brand")
              ?.focus({ preventScroll: true });
          }}
        >
          Back to top <ArrowUp size={14} />
        </button>
      </div>
      <ProjectCredit />
      <div className="thf-disclaimer">
        <ShieldCheck size={17} />
        <p>
          Decision support only. Probabilities represent per-vessel stenosis risks,
          not lesion locations. Evaluated on a single-centre dataset (303 patients).
          Not a substitute for formal diagnostic angiography or clinical judgement.
        </p>
      </div>
    </BeamWordmarkFooter>
  );
}
