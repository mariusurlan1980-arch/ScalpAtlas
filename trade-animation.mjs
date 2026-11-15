// The caller must supply an independently verified broker receipt.
// Reuse the returned handler for the lifetime of the overlay.
export function createTradeAnimation(panel, gifUrl = new URL('./bancnote.gif', import.meta.url)) {
  const displayedOrders = new Set();

  return ({ account, status, orderId } = {}) => {
    if (account !== 'QT Demo' || status !== 'OPEN_CONFIRMED' ||
        typeof orderId !== 'string' || !orderId.trim() ||
        displayedOrders.has(orderId) || !panel.isConnected) return false;

    const doc = panel.ownerDocument;
    const bounds = panel.getBoundingClientRect();
    const image = doc.createElement('img');
    image.alt = '';
    image.setAttribute('aria-hidden', 'true');
    Object.assign(image.style, {
      position: 'fixed',
      left: `${bounds.left + bounds.width / 2}px`,
      top: `${bounds.top + bounds.height / 2}px`,
      width: 'min(480px, 100vw)',
      transform: 'translate(-50%, -60%)',
      pointerEvents: 'none',
      zIndex: '2147483647',
    });
    image.addEventListener('load', () => {
      displayedOrders.add(orderId);
      setTimeout(() => image.remove(), 1600);
    }, { once: true });
    image.addEventListener('error', () => image.remove(), { once: true });
    // Set a unique URL so the animated resource starts at its first frame.
    const url = new URL(gifUrl, doc.baseURI);
    url.searchParams.set('order-animation', crypto.randomUUID());
    displayedOrders.add(orderId);
    image.addEventListener('error', () => displayedOrders.delete(orderId), { once: true });
    image.src = url.href;
    doc.body.append(image);
    return true;
  };
}
