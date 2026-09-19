/* On Site Therapy Tallahassee | Vanilla ES6 | Load with <script defer src="app.js"></script> */
(() => {
  'use strict';

  const init = () => {
    // Prevent duplicate event listeners if this file is accidentally loaded twice.
    if (document.documentElement.hasAttribute('data-ost-ready')) return;
    document.documentElement.setAttribute('data-ost-ready', '');

    const visible = element => element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden' && !element.closest('[inert]');
    const focusable = root => Array.from(root.querySelectorAll(
      'a[href], button, input, select, textarea, [tabindex], [contenteditable="true"]'
    )).filter(element => !element.matches(':disabled') && element.tabIndex >= 0 && visible(element));

    // 1. Mobile drawer: focus management, Escape, backdrop, and desktop reset.
    const toggle = document.querySelector('.nav-toggle');
    const drawer = document.querySelector('.mobile-nav');
    const backdrop = document.querySelector('.nav-backdrop');
    if (toggle && drawer) {
      const desktop = window.matchMedia('(min-width: 64rem)');
      let opened = false;
      let previousFocus = null;
      let inertSnapshot = [];

      if (!drawer.id) {
        let suffix = 1;
        while (document.getElementById(`ost-mobile-menu-${suffix}`)) suffix += 1;
        drawer.id = `ost-mobile-menu-${suffix}`;
      }
      toggle.setAttribute('aria-controls', drawer.id);
      drawer.setAttribute('role', 'dialog');
      drawer.setAttribute('aria-modal', 'true');
      if (!drawer.hasAttribute('aria-label') && !drawer.hasAttribute('aria-labelledby')) {
        drawer.setAttribute('aria-label', 'Mobile navigation');
      }
      drawer.setAttribute('tabindex', '-1');

      // Inert sibling branches, keeping the drawer/backdrop and their ancestors usable.
      const isolateDrawer = () => {
        const visit = parent => Array.from(parent.children).forEach(element => {
          if (element === drawer || element === backdrop) return;
          if (element.contains(drawer) || (backdrop && element.contains(backdrop))) {
            visit(element);
          } else {
            inertSnapshot.push([element, element.hasAttribute('inert')]);
            element.setAttribute('inert', '');
          }
        });
        visit(document.body);
      };

      const setOpen = (next, restoreFocus = true) => {
        if (next && desktop.matches) return;
        if (opened === next) return;
        opened = next;
        toggle.setAttribute('aria-expanded', String(next));
        toggle.setAttribute('aria-label', next ? 'Close menu' : 'Open menu');
        document.body.classList.toggle('nav-open', next);
        if (next) {
          previousFocus = document.activeElement;
          drawer.removeAttribute('inert');
          drawer.removeAttribute('aria-hidden');
          (focusable(drawer)[0] || drawer).focus();
          isolateDrawer();
        } else {
          inertSnapshot.forEach(([element, wasInert]) => {
            if (!wasInert) element.removeAttribute('inert');
          });
          inertSnapshot = [];
          if (restoreFocus) {
            const target = previousFocus && previousFocus.isConnected && visible(previousFocus)
              ? previousFocus : toggle;
            if (visible(target)) target.focus();
          } else if (drawer.contains(document.activeElement)) {
            // Desktop resize hides the mobile toggle: move to a visible desktop link.
            const header = document.querySelector('.navbar');
            const target = header && focusable(header)[0];
            if (target) target.focus();
            else document.activeElement.blur();
          }
          drawer.setAttribute('inert', '');
          drawer.setAttribute('aria-hidden', 'true');
        }
      };

      document.body.classList.remove('nav-open');
      toggle.setAttribute('aria-expanded', 'false');
      drawer.setAttribute('inert', '');
      drawer.setAttribute('aria-hidden', 'true');
      toggle.addEventListener('click', () => setOpen(!opened));
      if (backdrop) backdrop.addEventListener('click', () => setOpen(false));
      drawer.addEventListener('click', event => {
        if (event.target.closest('.mobile-nav__close, a[href]')) setOpen(false);
      });
      document.addEventListener('keydown', event => {
        if (!opened) return;
        if (event.key === 'Escape') {
          event.preventDefault();
          setOpen(false);
        } else if (event.key === 'Tab') {
          const items = focusable(drawer);
          const first = items[0];
          const last = items[items.length - 1];
          const active = document.activeElement;
          if (!items.length) {
            event.preventDefault();
            drawer.focus();
          } else if (event.shiftKey && (active === first || !items.includes(active))) {
            event.preventDefault();
            last.focus();
          } else if (!event.shiftKey && (active === last || !items.includes(active))) {
            event.preventDefault();
            first.focus();
          }
        }
      });
      document.addEventListener('focusin', event => {
        if (opened && !drawer.contains(event.target)) (focusable(drawer)[0] || drawer).focus();
      });
      desktop.addEventListener('change', () => {
        if (desktop.matches) setOpen(false, false);
      });
    }

    // 2. Fixed header appearance; passive listener with one update per frame.
    const header = document.querySelector('.navbar');
    if (header) {
      let queued = false;
      const updateHeader = () => {
        header.classList.toggle('is-scrolled', window.scrollY > 16);
        queued = false;
      };
      window.addEventListener('scroll', () => {
        if (!queued) {
          queued = true;
          window.requestAnimationFrame(updateHeader);
        }
      }, { passive: true });
      window.addEventListener('pageshow', updateHeader);
      updateHeader();
    }

    // 3. FAQ / benefit accordions. Native buttons supply Enter and Space behavior.
    document.querySelectorAll('[data-accordion]').forEach(group => {
      const entries = Array.from(group.querySelectorAll('[data-accordion-trigger]'))
        .filter(button => button.closest('[data-accordion]') === group)
        .map(button => ({ button, panel: document.getElementById(button.getAttribute('aria-controls')) }))
        .filter(entry => entry.panel && group.contains(entry.panel));
      const setExpanded = (entry, expanded) => {
        entry.button.setAttribute('aria-expanded', String(expanded));
        entry.panel.hidden = !expanded;
      };
      let hasExpanded = false;
      entries.forEach(entry => {
        const expanded = entry.button.getAttribute('aria-expanded') === 'true' &&
          (!group.hasAttribute('data-accordion-single') || !hasExpanded);
        setExpanded(entry, expanded);
        hasExpanded = hasExpanded || expanded;
        entry.button.addEventListener('click', () => {
          const expand = entry.button.getAttribute('aria-expanded') !== 'true';
          if (expand && group.hasAttribute('data-accordion-single')) {
            entries.forEach(other => { if (other !== entry) setExpanded(other, false); });
          }
          setExpanded(entry, expand);
        });
      });
    });

    // 4. Provider-neutral cart hook. No payment SDK or secret keys belong here.
    // Configure window.OSTCart.addItem(item) to return a Promise from your integration.
    // Without an adapter we announce that checkout is unavailable, never a fake success.
    let status = document.querySelector('[data-cart-status]');
    if (!status) {
      status = document.createElement('p');
      status.className = 'sr-only';
      status.setAttribute('data-cart-status', '');
      document.body.appendChild(status);
    }
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');
    status.setAttribute('aria-atomic', 'true');
    const pendingButtons = new WeakSet();
    document.addEventListener('click', event => {
      const button = event.target.closest('button[data-add-to-cart]');
      if (!button) return;
      event.preventDefault();
      if (button.disabled || button.getAttribute('aria-disabled') === 'true' || pendingButtons.has(button)) return;
      const item = {
        id: (button.dataset.productId || '').trim(),
        quantity: Number(button.dataset.quantity || 1)
      };
      if (!item.id || !Number.isSafeInteger(item.quantity) || item.quantity < 1) {
        status.textContent = 'This product could not be added. Please check its selection.';
        return;
      }
      const adapter = window.OSTCart;
      if (!adapter || typeof adapter.addItem !== 'function') {
        status.textContent = 'Online checkout is not connected yet. Call 1-800-964-2314 for assistance.';
        document.dispatchEvent(new CustomEvent('ost:cart-unavailable', { detail: { item } }));
        return;
      }
      const previousBusy = button.getAttribute('aria-busy');
      pendingButtons.add(button);
      button.disabled = true;
      button.setAttribute('aria-busy', 'true');
      status.textContent = 'Adding item…';
      const restore = () => {
        pendingButtons.delete(button);
        button.disabled = false;
        if (previousBusy === null) button.removeAttribute('aria-busy');
        else button.setAttribute('aria-busy', previousBusy);
      };
      Promise.resolve().then(() => adapter.addItem(item)).then(result => {
        restore();
        status.textContent = 'Item added to your cart.';
        document.dispatchEvent(new CustomEvent('ost:cart-added', { detail: { item, result } }));
      }, error => {
        restore();
        status.textContent = 'Unable to add this item. Please try again.';
        document.dispatchEvent(new CustomEvent('ost:cart-error', { detail: { item, error } }));
      });
    });
  };

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})();
