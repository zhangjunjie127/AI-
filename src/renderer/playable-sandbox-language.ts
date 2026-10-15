export function translateSandboxTextNodes(
  root: Node,
  translate: (value: string) => string,
  originals: WeakMap<Text, string>,
): void {
  const document = root.nodeType === Node.DOCUMENT_NODE
    ? root as Document
    : root.ownerDocument!;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node: Node | null;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (
      !parent ||
      parent.closest("script, style, code, pre, textarea, input, [contenteditable]")
    )
      continue;
    const text = node as Text;
    const source = originals.get(text) ?? text.nodeValue ?? "";
    originals.set(text, source);
    const next = translate(source);
    if (text.nodeValue !== next) text.nodeValue = next;
  }
}
