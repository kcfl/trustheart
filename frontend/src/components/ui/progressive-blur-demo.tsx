import { ProgressiveBlur } from "./progressive-blur";

/** Standalone demo; not a new application route or an extra nested scroll region on the site. */
export function Skiper41() {
  return (
    <section
      className="progressive-blur-demo"
      aria-label="Progressive text reveal demonstration"
    >
      <ProgressiveBlur
        position="top"
        backgroundColor="#100818"
        height="96px"
        blurAmount="4px"
      />
      <ProgressiveBlur
        position="bottom"
        backgroundColor="#100818"
        height="96px"
        blurAmount="4px"
      />
      <div
        className="progressive-blur-demo-content"
        tabIndex={0}
        role="region"
        aria-label="Scroll to reveal the text"
      >
        <p>
          Scroll to reveal the text. At the edges, a soft blur creates depth.
          Move the text toward the centre to read it clearly.
        </p>
        <p>
          The content remains ordinary, selectable text. A masked backdrop
          filter softens only the narrow strips at the top and bottom.
        </p>
        <p>
          This interaction uses CSS rather than a JavaScript scroll listener.
          Four pixels of blur is enough for a subtle effect without using large
          blur radii.
        </p>
        <p>
          Use the arrow keys or Page Down to explore this example. Reduced
          motion and reduced transparency preferences disable the effect.
        </p>
        <p>
          Progressive blur adapted from Skiper UI, inspired by Devouring
          Details. The effect does not change the underlying text or its reading
          order.
        </p>
      </div>
    </section>
  );
}
export default Skiper41;
