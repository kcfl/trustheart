import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Build-time regression guard. This is not an access-control mechanism.
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const read = (p) => fs.readFileSync(path.join(root, p), "utf8");
const required = "inspired by SSPRO🎀";
const component = read("src/components/ui/project-credit.tsx");
const footer = read("src/components/TrustHeartFooter.tsx");
const app = read("src/App.tsx");
const failures = [];
if (!component.includes(required))
  failures.push("The approved project-credit wording is missing.");
if (!component.includes('data-project-credit="sspro"'))
  failures.push("The project-credit component identifier is missing.");
if (!footer.includes("<ProjectCredit />"))
  failures.push("The shared footer no longer renders ProjectCredit.");
if (!app.includes("<TrustHeartFooter />"))
  failures.push("The application no longer renders the shared footer.");
if (process.argv.includes("--production")) {
  const assets = path.join(root, "dist/assets");
  const scripts = fs.readdirSync(assets).filter((name) => name.endsWith(".js"));
  if (
    !scripts.some((name) =>
      read("dist/assets/" + name).includes("inspired by SSPRO"),
    )
  )
    failures.push("The production JavaScript is missing the project credit.");
}
if (failures.length) {
  console.error(
    "Project credit safeguard failed:\n" +
      failures.map((s) => " - " + s).join("\n"),
  );
  console.error(
    "Restore the credit, or obtain project-owner approval for an intentional change.",
  );
  process.exit(1);
}
console.log("Project credit safeguard passed: " + required);
