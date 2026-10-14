import {
  ArrowUpRight,
  Code2,
  Layers3,
  Activity,
  Users,
  HeartHandshake,
} from "lucide-react";
import { PageHeading, Eyebrow, ButtonLink } from "../components/UI";
export default function About() {
  return (
    <div className="page-container about-page">
      <PageHeading
        number="06"
        eyebrow="THE PROJECT BEHIND THE PERSPECTIVE"
        title={
          <>
            A more human <em>understanding.</em>
          </>
        }
        text="A research prototype at the intersection of cardiac visualization and explainable machine learning."
      />
      <div data-scroll-card="" className="about-intro glass">
        <div className="about-symbol" aria-hidden="true">
          <span />
          <span />
          <Activity size={90} strokeWidth={0.8} />
          <small>TRUSTHEART / 3D</small>
        </div>
        <div>
          <Eyebrow>OUR PRODUCT VISION</Eyebrow>
          <h2>
            Make the complex visible.
            <br />
            <em>Keep the uncertainty visible, too.</em>
          </h2>
          <p>
            TrustHeart 3D brings a structured analysis workflow, interactive
            anatomy, and transparent model context into one considered
            experience.
          </p>
          <p>
            Built as a hackathon / educational prototype, it helps students,
            researchers, and technical reviewers explore how cardiac-risk
            outputs could be understood—not used as a diagnosis.
          </p>
          <ButtonLink to="/analysis">Explore the prototype</ButtonLink>
        </div>
      </div>
      <section className="about-team">
        <div className="section-heading">
          <div>
            <Eyebrow number="01">A MULTIDISCIPLINARY EFFORT</Eyebrow>
            <h2>
              Different skills.
              <br />
              <em>A shared perspective.</em>
            </h2>
          </div>
          <p>
            Team names and affiliations haven't been supplied.
            <br />
            These are the project's contribution areas.
          </p>
        </div>
        <div className="team-grid">
          {[
            {
              icon: Code2,
              title: "Frontend & experience",
              text: "Interface architecture, responsive design, motion, and accessible visualization.",
            },
            {
              icon: Layers3,
              title: "Machine learning & backend",
              text: "Model development, prediction contracts, evaluation, and explanation artifacts.",
            },
            {
              icon: HeartHandshake,
              title: "Research & validation",
              text: "Dataset review, scientific interpretation, and responsible-use boundaries.",
            },
          ].map(({ icon: Icon, title, text }) => (
            <div data-scroll-card="" className="team-card glass" key={title}>
              <Icon size={27} strokeWidth={1.2} />
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="fine-print">
                <Users size={12} /> Contributors to be announced
              </span>
            </div>
          ))}
        </div>
      </section>
      <section className="stack-section">
        <div>
          <Eyebrow number="02">BUILT WITH INTENTION</Eyebrow>
          <h2>
            The technology <em>stack.</em>
          </h2>
        </div>
        <div className="stack-tags">
          {[
            "React",
            "TypeScript",
            "Tailwind CSS",
            "Three.js",
            "GSAP",
            "Motion",
            "Vite",
          ].map((x) => (
            <span key={x}>
              {x}
              <span>↗</span>
            </span>
          ))}
        </div>
      </section>
      <section data-scroll-card="" className="acknowledgements glass">
        <Eyebrow number="03">CREDIT WHERE IT'S DUE</Eyebrow>
        <h2>Acknowledgements</h2>
        <div>
          <article>
            <h3>Anatomical heart model</h3>
            <p>
              “Realistic Human Heart” by neshallads. Extracted from the
              user-supplied HTML viewer. Blue material treatment and scene
              lighting adapted for TrustHeart 3D.
            </p>
            <a
              className="text-link"
              href="https://sketchfab.com/3d-models/realistic-human-heart-3f8072336ce94d18b3d0d055a1ece089"
              target="_blank"
              rel="noreferrer"
            >
              Original asset <ArrowUpRight size={14} />
            </a>
            <a
              className="text-link"
              href="https://creativecommons.org/licenses/by/4.0/"
              target="_blank"
              rel="noreferrer"
            >
              CC BY 4.0 license <ArrowUpRight size={14} />
            </a>
          </article>
          <article>
            <h3>Dataset & project context</h3>
            <p>
              Extension of Z-Alizadeh Sani dataset, UCI Machine Learning
              Repository (ID 411). Project context is based on the supplied
              TrustHeart 3D frontend requirements.
            </p>
            <a
              className="text-link"
              href="https://archive.ics.uci.edu/dataset/411/extension+of+z+alizadeh+sani+dataset"
              target="_blank"
              rel="noreferrer"
            >
              Dataset source <ArrowUpRight size={14} />
            </a>
            <p className="fine-print">
              Safety notice: Decision support only. Predicted probabilities are per-vessel stenosis risks,
              not anatomical lesion locations. Evaluated on a single-centre dataset of 303 angiography-referred patients.
              No institutional affiliation, endorsement, or clinical certification is implied.
            </p>
          </article>
        </div>
      </section>
    </div>
  );
}
