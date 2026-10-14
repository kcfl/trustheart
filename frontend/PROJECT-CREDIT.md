# Project credit safeguard

Approved visible wording: **inspired by SSPRO🎀**.

The wording lives in `src/components/ui/project-credit.tsx`, a dedicated, memoized component with no configurable text, HTML or children props. The shared footer renders it on all routes. It is styled as a compact, readable badge and remains accessible text.

## Accidental-removal checks

- A unit test verifies the exact wording and a single dedicated element.
- Browser tests verify it is visible on routes/mobile and that the old visible credit line is absent.
- `npm run check:credit` checks the component, footer integration and application footer mount.
- `npm run build` runs this guard before compilation, then checks for the credit in the generated JavaScript.

These are maintenance safeguards, **not tamper-proof security**. A person or agent with source/build access can edit or delete both the component and its checks. A browser user can alter their local DOM. Obfuscation, disabling developer tools, or continuously re-inserting text would not provide real protection and is not used here.

For enforcement beyond this project, restrict source/deployment permissions, require owner review for these files, and make successful checks mandatory in the repository's protected-branch/deployment settings. Those external controls have not been configured here because no repository or authorized reviewers were supplied.

Future intentional changes should be approved by the project owner. The safeguard does not override authorized future instructions.

Third-party provenance remains in THIRD_PARTY_NOTICES.md, the component source and the existing component documentation. Other model/dataset/license links in the footer/site are unchanged.
