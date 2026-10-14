import { lazy, Suspense } from "react";
import {
  ArrowUpRight,
  Activity,
  FlaskConical,
  Info,
  ArrowRight,
} from "lucide-react";
import { Link } from "react-router-dom";
import type { ReactNode } from "react";
import type { HeartSceneProps } from "./HeartScene";
const Scene = lazy(() => import("./HeartScene"));
export function Heart(props: HeartSceneProps) {
  return (
    <Suspense
      fallback={
        <div className="scene-skeleton">
          <span className="tiny-spinner" /> Preparing 3D anatomy
        </div>
      }
    >
      <Scene {...props} />
    </Suspense>
  );
}
export function Brand() {
  return (
    <Link to="/" className="brand" aria-label="TrustHeart 3D home">
      <span className="brand-mark">
        <Activity size={23} strokeWidth={1.7} />
      </span>
      <span>
        TrustHeart<span className="brand-3d">3D</span>
      </span>
    </Link>
  );
}
export function Eyebrow({
  children,
  number,
}: {
  children: ReactNode;
  number?: string;
}) {
  return (
    <div className="eyebrow">
      {number && <span className="section-number">{number}</span>}
      <span className="eyebrow-dash" />
      {children}
    </div>
  );
}
export function ButtonLink({
  to,
  children,
  secondary = false,
  arrow = true,
}: {
  to: string;
  children: ReactNode;
  secondary?: boolean;
  arrow?: boolean;
}) {
  return (
    <Link
      className={`button ${secondary ? "button-secondary" : "button-primary"}`}
      to={to}
    >
      {children}
      {arrow &&
        (secondary ? <ArrowRight size={16} /> : <ArrowUpRight size={17} />)}
    </Link>
  );
}
export function DemoNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`demo-notice ${compact ? "notice-compact" : ""}`}>
      <FlaskConical size={16} />
      <div>
        <strong>DECISION SUPPORT RESEARCH</strong>
        {!compact && (
          <span>
            {" "}
            Calibrated model prediction backend. Educational and research demonstration only.
          </span>
        )}
      </div>
    </div>
  );
}
export function Notice({ children }: { children: ReactNode }) {
  return (
    <div className="info-notice">
      <Info size={17} />
      <div>{children}</div>
    </div>
  );
}
export function PageHeading({
  number,
  eyebrow,
  title,
  text,
  children,
}: {
  number: string;
  eyebrow: string;
  title: ReactNode;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <Eyebrow number={number}>{eyebrow}</Eyebrow>
        <h1>{title}</h1>
        <p>{text}</p>
      </div>
      {children}
    </div>
  );
}
export function EmptyState({
  title,
  text,
  children,
}: {
  title: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty-state glass">
      <div className="empty-icon">
        <Activity size={30} strokeWidth={1} />
      </div>
      <span className="eyebrow justify-center">A CLEAR START</span>
      <h2>{title}</h2>
      <p>{text}</p>
      {children}
    </div>
  );
}
