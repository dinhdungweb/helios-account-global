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

      const originalText = checkoutButton.textContent || checkoutButton.value;
      setButtonState(checkoutButton, true, 'Processing...');

      try {
        await createDraftOrderCheckout();
      } catch (error) {
        console.error('[TierDraftOrder] Error:', error);
        alert('An error occurred while creating the order. Please try again!');
        setButtonState(checkoutButton, false, originalText);
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

    const response = await fetch(API_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        currency,
        country: getActiveCountry(),
        items
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to create draft order');
    }

    const data = await response.json();
    if (!data.invoice_url) {
      throw new Error('Checkout URL was not returned');
    }

    if (!eventDetail || !eventDetail.buyNowMode) {
      await clearCart();
    }

    window.location.href = data.invoice_url;
  }

  async function loadCart() {
    const response = await fetch(getCartUrl());
    if (!response.ok) {
      throw new Error('Could not load cart');
    }
    return response.json();
  }

  async function clearCart() {
    const response = await fetch(getCartClearUrl(), { method: 'POST' });
    if (!response.ok) {
      throw new Error('Could not clear cart');
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
