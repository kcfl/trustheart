import { useRef } from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  ScanLine,
  Layers3,
  Fingerprint,
  ShieldCheck,
  Activity,
  MoveUpRight,
  Orbit,
  SlidersHorizontal,
  ChartNoAxesCombined,
} from "lucide-react";
import { Heart, Eyebrow, ButtonLink } from "../components/UI";
import { HorizontalTextReveal } from "@/components/ui/horizontal-text-reveal";
import { useHomeMotion } from "@/hooks/use-home-motion";

export default function Home() {
  const root = useRef<HTMLDivElement>(null);
  const workflowTrack = useRef<HTMLElement>(null);
  useHomeMotion(root);
  return (
    <div ref={root} className="home-page">
      <div className="reading-progress" aria-hidden="true">
        <span className="reading-progress-fill" />
      </div>
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-texture" aria-hidden="true" />
        <div className="hero-copy">
          <Eyebrow>CARDIAC INTELLIGENCE. MADE VISIBLE.</Eyebrow>
          <h1 id="hero-title">
            <span className="hero-line">
              <span className="hero-line-text">See beyond</span>
            </span>
            <span className="hero-line">
              <span className="hero-line-text">
                the <em>prediction.</em>
              </span>
            </span>
          </h1>
          <p className="hero-description">
            A new perspective on cardiac risk.
            <br />
            Explore the signals. Understand the evidence.
            <br />
            See the heart in a whole new dimension.
          </p>
          <div className="hero-buttons">
            <ButtonLink to="/analysis">Start analysis</ButtonLink>
            <Link className="text-link" to="/methodology">
              Explore the science <ArrowUpRight size={16} />
            </Link>
          </div>
          <div className="hero-assurance">
            <ShieldCheck size={15} />
            <span>Decision support only · Per-vessel probability, not lesion location · Single-centre dataset</span>
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-caption">
            <span className="live-dot" /> ANATOMICAL EXPLORER{" "}
            <span>FIG. 01 / 3D</span>
          </div>
          <Heart />
          <div className="glass floating-card coronary-card">
            <span className="card-overline">
              <span className="mini-dot" /> CORONARY NETWORK
            </span>
            <div className="artery-chips">
              <span>LAD</span>
              <span>LCX</span>
              <span>RCA</span>
            </div>
            <div className="micro-line">
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
              <i />
            </div>
            <span className="card-footnote">
              Three arteries. A wider perspective.
            </span>
          </div>
          <div className="anatomy-label anatomy-label-one">
            <span className="pin" />
            <i />
            <span>Anatomical reference</span>
          </div>
          <div className="glass floating-card insight-card">
            <div className="insight-icon">
              <ScanLine size={21} strokeWidth={1.3} />
            </div>
            <div>
              <span className="card-overline">BEYOND A SINGLE SCORE</span>
              <strong>Every signal has a story.</strong>
              <span className="card-footnote">
                Explore what informs a prediction.
              </span>
            </div>
            <ArrowUpRight size={15} />
          </div>
          <div className="anatomy-note">
            ILLUSTRATIVE ANATOMY · NOT A LESION MAP
          </div>
        </div>
        <div className="hero-bottom">
          <a href="#perspective" className="scroll-prompt">
            <span>
              <ArrowDown size={16} />
            </span>
            SCROLL TO DISCOVER
          </a>
          <div className="hero-bottom-right">
            <span className="small-cross">+</span>
            <span>
              THE HUMAN HEART.
              <br />
              <strong>A MORE HUMAN UNDERSTANDING.</strong>
            </span>
          </div>
        </div>
      </section>
      <div className="trust-strip">
        <div>
          <span className="strip-icon">
            <Orbit size={22} />
          </span>
          <p>
            Interactive by nature<span>Explore in three dimensions</span>
          </p>
        </div>
        <div>
          <span className="strip-icon">
            <Fingerprint size={22} />
          </span>
          <p>
            Explainable by design<span>Evidence, not a black box</span>
          </p>
        </div>
        <div>
          <span className="strip-icon">
            <ShieldCheck size={22} />
          </span>
          <p>
            Research, responsibly<span>Clarity about every limitation</span>
          </p>
        </div>
        <div className="demo-pill">
          <span /> SIMULATED DEMO
        </div>
      </div>
      <section id="perspective" className="content-section perspective-section">
        <div className="section-heading">
          <div>
            <Eyebrow number="01">A DIFFERENT PERSPECTIVE</Eyebrow>
            <HorizontalTextReveal
              lines={[
                { text: "One heart." },
                { text: "More ways to understand.", emphasis: true },
              ]}
            />
          </div>
          <p>
            A probability is only the beginning. Bring anatomy,
            <br className="desktop-break" /> model outputs, and their underlying
            evidence
            <br className="desktop-break" /> into one connected experience.
          </p>
        </div>
        <div className="perspective-grid">
          <Link
            to="/results"
            data-scroll-card=""
            className="feature-card feature-anatomy reveal"
          >
            <div className="feature-top">
              <span>01 / VISUALIZE</span>
              <ArrowUpRight size={20} />
            </div>
            <div className="anatomy-graphic" aria-hidden="true">
              <div className="graphic-circle circle-a" />
              <div className="graphic-circle circle-b" />
              <svg viewBox="0 0 300 150">
                <path d="M35 91h58l16-24 15 51 24-87 22 65 15-20 18 15h65" />
                <circle cx="148" cy="31" r="4" />
              </svg>
              <span>ANATOMY × INTELLIGENCE</span>
            </div>
            <h3>See the bigger picture.</h3>
            <p>
              Explore an interactive anatomical heart alongside four prediction
              targets.
            </p>
            <span className="feature-link">
              Explore the dashboard <ArrowRight size={15} />
            </span>
          </Link>
          <Link
            to="/explainability"
            data-scroll-card=""
            className="feature-card reveal"
          >
            <div className="feature-top">
              <span>02 / UNDERSTAND</span>
              <ArrowUpRight size={20} />
            </div>
            <div className="explanation-graphic" aria-hidden="true">
              <div>
                <span>Inputs</span>
                <i />
                <i />
                <i />
              </div>
              <span className="graphic-connector" />
              <div className="model-node">
                <Layers3 size={30} strokeWidth={1} />
                <span>MODEL</span>
              </div>
              <span className="graphic-connector" />
              <div className="output-node">
                <Fingerprint size={35} strokeWidth={1} />
              </div>
            </div>
            <h3>Less black box. More clarity.</h3>
            <p>
              Discover how explanations can connect model features to a
              prediction.
            </p>
            <span className="feature-link">
              Inside the model <ArrowRight size={15} />
            </span>
          </Link>
          <Link
            to="/methodology"
            data-scroll-card=""
            className="feature-card reveal"
          >
            <div className="feature-top">
              <span>03 / QUESTION</span>
              <ArrowUpRight size={20} />
            </div>
            <div className="research-graphic" aria-hidden="true">
              <div className="research-seal">
                <ShieldCheck size={36} strokeWidth={1} />
              </div>
              <span>
                BUILT ON EVIDENCE.
                <br />
                OPEN ABOUT LIMITS.
              </span>
            </div>
            <h3>Trust starts with context.</h3>
            <p>
              Understand the dataset, validation approach, and what the model
              cannot tell you.
            </p>
            <span className="feature-link">
              Read the methodology <ArrowRight size={15} />
            </span>
          </Link>
        </div>
      </section>
      <section
        ref={workflowTrack}
        className="content-section workflow-section horizontal-reveal-track"
      >
        <div className="workflow-intro horizontal-reveal-sticky">
          <Eyebrow number="02">FROM INPUT TO INSIGHT</Eyebrow>
          <HorizontalTextReveal
            scrollTarget={workflowTrack}
            lines={[
              { text: "Complex science." },
              { text: "A clear path.", emphasis: true },
            ]}
          />
          <p>
            A considered workflow that makes room for the important part:
            understanding.
          </p>
          <ButtonLink to="/analysis">Explore a demo analysis</ButtonLink>
        </div>
        <div className="workflow-steps">
          <div className="workflow-line" aria-hidden="true">
            <span className="workflow-line-fill" />
          </div>
          {[
            {
              n: "01",
              icon: SlidersHorizontal,
              title: "Start with the signals",
              text: "Enter and review the parameters in a structured, guided form.",
            },
            {
              n: "02",
              icon: Activity,
              title: "Explore the perspective",
              text: "See CAD, LAD, LCX, and RCA outputs alongside interactive anatomy.",
            },
            {
              n: "03",
              icon: ChartNoAxesCombined,
              title: "Look beneath the surface",
              text: "Inspect available explanations and understand the limits of the model.",
            },
          ].map(({ n, icon: Icon, title, text }) => (
            <div data-scroll-card="" className="workflow-step reveal" key={n}>
              <span className="step-num">{n}</span>
              <span className="step-icon">
                <Icon size={22} strokeWidth={1.3} />
              </span>
              <div>
                <h3>{title}</h3>
                <p>{text}</p>
              </div>
              <ArrowDownRight size={18} />
            </div>
          ))}
        </div>
      </section>
      <section className="research-section content-section reveal">
        <div>
          <Eyebrow number="03">SCIENCE WITH SELF-AWARENESS</Eyebrow>
          <HorizontalTextReveal
            lines={[
              { text: "Transparency isn't a feature." },
              { text: "It's the foundation.", emphasis: true },
            ]}
          />
          <p>
            Small datasets. Real uncertainty. Important limitations.
            <br />
            We believe responsible exploration starts with an honest
            conversation.
          </p>
          <Link className="text-link" to="/methodology">
            Our methodology & limitations <MoveUpRight size={16} />
          </Link>
        </div>
        <div data-scroll-card="" className="research-callout glass">
          <span className="card-overline">THE DATA BEHIND THE PROJECT</span>
          <span className="dataset-number">
            303<span>samples*</span>
          </span>
          <h3>Extension of Z-Alizadeh Sani</h3>
          <p>UCI Machine Learning Repository · Dataset 411</p>
          <div className="subtle-divider" />
          <span className="fine-print">
            *As reported in the supplied project brief. Small-cohort findings do
            not establish clinical generalizability.
          </span>
        </div>
      </section>
      <section className="closing-cta reveal">
        <span className="closing-cross" aria-hidden="true">
          +
        </span>
        <Eyebrow>CHANGE YOUR PERSPECTIVE</Eyebrow>
        <h2>
          A little more insight.
          <br />
          <em>A whole new dimension.</em>
        </h2>
        <ButtonLink to="/analysis">Start your exploration</ButtonLink>
        <span className="fine-print">
          Educational exploration only. Not medical advice.
        </span>
      </section>
    </div>
  );
}
