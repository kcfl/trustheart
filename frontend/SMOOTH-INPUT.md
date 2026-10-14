# Smooth Input

## Live integration

The Analysis page uses the reusable `SmoothInput` for Age, Systolic blood pressure and Total cholesterol. Existing labels, units, hints, invalid states, validation focus, controlled values, Fill example, Clear inputs and review/edit behavior are retained. No input is logged, transmitted or persisted by this component.

The component adapts the user-provided Skiper106 example to the project's existing `motion/react` package. `dialkit` is a demo-tuning tool and has not been added to the production interface. No dependencies were added.

## Files and exports

- `src/components/ui/smooth-input.tsx`: `SmoothInput`, `Input`, `SmoothInputProps`, `InputFieldProps`.
- `src/components/ui/smooth-input-demo.tsx`: standalone `Skiper106` comparison demo, not another application route.
- `src/styles.css`: theme-aware control/caret styling and accessibility fallbacks.
- `e2e/smooth-input.spec.ts`: focused browser tests.

```tsx
import { SmoothInput } from "@/components/ui/smooth-input";

<SmoothInput
  aria-label="Example text"
  placeholder="Try typing"
  value={value}
  onChange={(event) => setValue(event.target.value)}
  spring={{ stiffness: 500, damping: 30, mass: 0.5 }}
/>;
```

Standard native input attributes/events and forwarded refs work. Supports `className`, `wrapperClassName`, optional `fontSize`, customizable `spring`, controlled `value` or uncontrolled `defaultValue`, and `type="text" | "password"`. An intentionally empty placeholder remains empty.

## Editing and accessibility

The real browser input owns editing, undo, selection, autofill, keyboard interaction and uncontrolled form-reset state. There is no simulated editor and no fabricated change event. A decorative, pointer-transparent Motion caret follows the measured insertion point. It hides during range selection and blur, and tracks horizontal input scrolling, font changes and resizing. Event-driven animation-frame callbacks are coalesced and cleaned up; no permanent measurement loop is created.

Native caret fallbacks are intentional for passwords, RTL/non-ASCII text, composition, read-only/disabled fields, reduced motion and forced colors. This avoids inaccurate password-glyph heuristics or replacing the browser's text-shaping/IME behavior. Password contents are never copied into the measurement span. No `navigator`, `window` or `document` access occurs at module evaluation, and server rendering is tested.

## Numeric fields

HTML `type="number"` does not expose reliable selectionStart/selectionEnd. The three demo fields therefore use `type="text"` with `inputMode="numeric"`, a decimal-digit pattern and the existing application validation. They are textboxes rather than native spinbuttons; no increment/decrement controls are imitated. Mobile inputs use 16px text to avoid focus zoom in typical iOS configurations.

Validation explicitly rejects non-decimal strings (e.g. hexadecimal and exponent notation), non-whole numbers and out-of-range values. Invalid input is not silently trimmed, truncated or rewritten. Existing demo ranges are unchanged and remain illustrative UI limits, not medical reference ranges.

## Checks for this update

- Production TypeScript/Vite build passes.
- 57 unit tests pass, including server rendering, input attributes and numeric validation.
- 6 smooth-input browser tests pass: caret geometry, focus/selection/editing, controlled example/clear/review flow, long uncontrolled scrolling/reset, IME/non-Latin fallback, password privacy, mobile layout and reduced-motion/forced-colors handling.
- Synthetic composition events were checked in Chromium; this does not claim physical-device IME or cross-browser certification.
- The older full application browser suite was not rerun for this change.
