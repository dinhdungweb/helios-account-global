/**
 * Secure tier checkout through the Shopify App Proxy.
 * The browser only sends variant IDs and quantities. Shopify prices,
 * customer identity and tier discounts are resolved by the backend.
 */

(function () {
  'use strict';

  const CHECKOUT_CONTEXT = window.HELIOS_TIER_CHECKOUT_CONTEXT || {};
  const API_ENDPOINT = CHECKOUT_CONTEXT.endpoint ||
    window.HELIOS_TIER_DRAFT_ORDER_ENDPOINT ||
    '/apps/helios-tier-pricing';
  const PROCESSING_SELECTOR = '[data-tier-checkout-processing="true"]';

  function setupEventListeners() {
    document.addEventListener('tier:create-draft-order', async function (event) {
      try {
        await createDraftOrderCheckout(event.detail);
      } catch (error) {
        console.error('[TierDraftOrder] Error:', error);
        if (event.detail && typeof event.detail.onError === 'function') {
          event.detail.onError(error);
        }
        alert('An error occurred while creating the order. Please try again!');
      }
    });
  }

  function interceptCartCheckout() {
    document.addEventListener('click', async function (event) {
      const checkoutButton = event.target.closest(
        '[name="checkout"], .cart__checkout-button, .cart-drawer__checkout'
      );

      if (!checkoutButton || !shouldUseDraftOrder()) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      setButtonProcessing(checkoutButton);

      try {
        await createDraftOrderCheckout();
      } catch (error) {
        console.error('[TierDraftOrder] Error:', error);
        alert('An error occurred while creating the order. Please try again!');
        resetButtonState(checkoutButton);
      }
    }, true);
  }

  function shouldUseDraftOrder() {
    return CHECKOUT_CONTEXT.customerLoggedIn === true &&
      !!sessionStorage.getItem('helios_customer_tier');
  }

  async function createDraftOrderCheckout(eventDetail) {
    const cart = await loadCart();
    const currency = getActiveCurrency(cart);

    if (!currency) {
      throw new Error('Checkout currency not found');
    }

    let items;
    if (eventDetail && eventDetail.buyNowMode && eventDetail.singleItem) {
      items = [normalizeRequestedItem(eventDetail.singleItem)];
    } else {
      if (!Array.isArray(cart.items) || cart.items.length === 0) {
        throw new Error('Cart is empty');
      }
      items = cart.items.map(normalizeRequestedItem);
    }

    const response = await fetchWithTimeout(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currency,
        country: getActiveCountry(),
        items
      })
    }, 30000);

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create draft order');
    }

    const data = await response.json();
    if (!data.invoice_url) {
      throw new Error('Checkout URL was not returned');
    }

    if (!eventDetail || !eventDetail.buyNowMode) {
      try {
        await clearCart();
      } catch (error) {
        // The checkout URL is already valid. A slow cart clear must not leave
        // the customer stuck on a disabled checkout button.
        console.warn('[TierDraftOrder] Cart could not be cleared:', error);
      }
    }

    window.location.assign(data.invoice_url);
  }

  async function loadCart() {
    const response = await fetchWithTimeout(getCartUrl(), {}, 10000);
    if (!response.ok) {
      throw new Error('Could not load cart');
    }
    return response.json();
  }

  async function clearCart() {
    const response = await fetchWithTimeout(getCartClearUrl(), {
      method: 'POST',
      keepalive: true
    }, 5000);
    if (!response.ok) {
      throw new Error('Could not clear cart');
    }
  }

  async function fetchWithTimeout(url, options, timeout) {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), timeout);

    try {
      return await fetch(url, Object.assign({}, options, {
        signal: controller.signal
      }));
    } finally {
      window.clearTimeout(timer);
    }
  }

  function normalizeRequestedItem(item) {
    return {
      variant_id: Number(item.variant_id || item.id),
      quantity: Number(item.quantity || 1)
    };
  }

  function getRouteRoot() {
    return window.Shopify && window.Shopify.routes && window.Shopify.routes.root
      ? window.Shopify.routes.root
      : '/';
  }

  function getCartUrl() {
    return `${getRouteRoot()}cart.js`;
  }

  function getCartClearUrl() {
    return `${getRouteRoot()}cart/clear.js`;
  }

  function getActiveCurrency(cart) {
    const value = cart && cart.currency ||
      window.Shopify && window.Shopify.currency && window.Shopify.currency.active ||
      CHECKOUT_CONTEXT.currency || '';
    const currency = String(value).trim().toUpperCase();
    return /^[A-Z]{3}$/.test(currency) ? currency : '';
  }

  function getActiveCountry() {
    const value = CHECKOUT_CONTEXT.country ||
      window.Shopify && window.Shopify.country || '';
    const country = String(value).trim().toUpperCase();
    return /^[A-Z]{2}$/.test(country) ? country : 'US';
  }

  function setButtonState(button, disabled, text) {
    button.disabled = disabled;
    if (button.textContent) {
      button.textContent = text;
    } else {
      button.value = text;
    }
  }

  function getButtonText(button) {
    return button.textContent || button.value || 'Checkout';
  }

  function setButtonProcessing(button) {
    button.dataset.tierCheckoutOriginalText = getButtonText(button);
    button.dataset.tierCheckoutProcessing = 'true';
    setButtonState(button, true, 'Processing...');
  }

  function resetButtonState(button) {
    const originalText = button.dataset.tierCheckoutOriginalText || 'Checkout';
    setButtonState(button, false, originalText);
    button.style.opacity = '';
    delete button.dataset.tierCheckoutOriginalText;
    delete button.dataset.tierCheckoutProcessing;
  }

  function resetProcessingButtons() {
    document.querySelectorAll(PROCESSING_SELECTOR).forEach(resetButtonState);
  }

  // Browsers can restore the page from back-forward cache with the exact DOM
  // state that existed during navigation, including disabled buttons.
  window.addEventListener('pagehide', resetProcessingButtons);
  window.addEventListener('pageshow', function (event) {
    resetProcessingButtons();
    if (event.persisted) {
      document.dispatchEvent(new CustomEvent('cart:refresh'));
    }
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setupEventListeners();
      interceptCartCheckout();
    });
  } else {
    setupEventListeners();
    interceptCartCheckout();
  }
})();
