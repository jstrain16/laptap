/** Tiny element builder — enough structure without pulling in a framework. */
export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  props: Partial<{ class: string; text: string; html: string; type: string; title: string }> = {},
  ...children: (Node | string | null | false)[]
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (props.class) node.className = props.class;
  if (props.text) node.textContent = props.text;
  if (props.html) node.innerHTML = props.html;
  if (props.type) node.setAttribute('type', props.type);
  if (props.title) node.title = props.title;
  for (const c of children) {
    if (c) node.append(c);
  }
  return node;
}

export function button(
  label: string,
  onClick: () => void,
  className = 'btn',
): HTMLButtonElement {
  const b = el('button', { class: className, text: label, type: 'button' });
  b.addEventListener('click', onClick);
  return b;
}

const REDUCED = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * MapTap reveals its result lines a character at a time. Resolves when done,
 * and jumps straight to the finished text if the player prefers less motion.
 */
export function typewriter(node: HTMLElement, text: string, msPerChar = 18): Promise<void> {
  node.textContent = '';
  if (REDUCED()) {
    node.textContent = text;
    return Promise.resolve();
  }
  node.classList.add('typing');
  return new Promise((resolve) => {
    let i = 0;
    const tick = () => {
      node.textContent = text.slice(0, ++i);
      if (i < text.length) {
        window.setTimeout(tick, msPerChar);
      } else {
        node.classList.remove('typing');
        resolve();
      }
    };
    window.setTimeout(tick, msPerChar);
  });
}
