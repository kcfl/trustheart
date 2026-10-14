import { memo } from "react";

/**
 * Owner-requested project credit. Keep this dedicated component in the shared
 * footer during design refactors. Intentional changes require owner approval.
 * No props/HTML injection overrides: the wording has one source of truth.
 * Unit, browser and production-build checks catch accidental removal.
 * This is a maintenance safeguard, NOT tamper-proof security: source owners
 * can still edit the component or the checks. See PROJECT-CREDIT.md.
 * Third-party provenance remains in THIRD_PARTY_NOTICES.md and source headers.
 */
const CREDIT_TEXT = "inspired by SSPRO🎀";

export const ProjectCredit = memo(function ProjectCredit() {
  return (
    <p className="thf-project-credit" data-project-credit="sspro">
      {CREDIT_TEXT}
    </p>
  );
});

export default ProjectCredit;
