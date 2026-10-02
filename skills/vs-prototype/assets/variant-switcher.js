/*
  vs-prototype variant switcher. Drop-in, zero-dep, framework-agnostic.

  Contract:
  - `?variant=<id>` selects the variant; the URL stays shareable.
  - Fixed control: previous / next buttons plus the current label.
  - ArrowLeft / ArrowRight switch variants, except inside inputs, textareas,
    selects, or contenteditable content, and never with a modifier held.
  - Publishes the current variant as `window.prototypeVariant`, as
    `<html data-variant="<id>">`, and as a `prototype:variant` window event
    whose detail is `{ id, label, index }`.

  Variants come from, in order: `init({ variants })`, `window.prototypeVariants`
  set before this script runs, the script tag's `data-variants="a:Label,b:Label"`,
  or `<template data-variant="a" data-label="...">` elements in the page.

  Production gate: this file never ships on its own. Load it only behind the
  project's existing dev flag, e.g. in a Vite app:
    if (import.meta.env.DEV) {
      window.prototypeVariants = [{ id: 'a', label: 'Inline' }, { id: 'b', label: 'Panel' }];
      await import('./variant-switcher.prototype.js');
    }
  React branch:
    const v = useSyncExternalStore(
      (cb) => { addEventListener('prototype:variant', cb); return () => removeEventListener('prototype:variant', cb); },
      () => window.prototypeVariant?.id,
    );
*/
(function () {
  'use strict';
  if (typeof window === 'undefined' || window.prototypeVariantSwitcher) return;

  var scriptTag = document.currentScript;
  var controller = null;
  var state = { variants: [], index: 0 };

  function parseList(raw) {
    return String(raw || '')
      .split(',')
      .map(function (part) {
        var bits = part.split(':');
        var id = bits.shift().trim();
        return id ? { id: id, label: bits.join(':').trim() || id } : null;
      })
      .filter(Boolean);
  }

  function normalize(list) {
    return (list || []).map(function (item) {
      return typeof item === 'string' ? { id: item, label: item } : { id: String(item.id), label: item.label || String(item.id) };
    });
  }

  function discover() {
    if (Array.isArray(window.prototypeVariants)) return normalize(window.prototypeVariants);
    if (scriptTag && scriptTag.dataset.variants) return parseList(scriptTag.dataset.variants);
    return Array.prototype.map.call(document.querySelectorAll('template[data-variant]'), function (t) {
      return { id: t.dataset.variant, label: t.dataset.label || t.dataset.variant };
    });
  }

  // Keys typed into a form control or editable region belong to that control;
  // stealing them would make text fields in the prototype unusable.
  function isEditable(target) {
    if (!target || target.nodeType !== 1) return false;
    var tag = target.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    if (target.isContentEditable) return true;
    var editable = target.closest && target.closest('[contenteditable]');
    return !!editable && editable.getAttribute('contenteditable') !== 'false';
  }

  function writeUrl(id) {
    try {
      var url = new URL(window.location.href);
      url.searchParams.set('variant', id);
      window.history.replaceState(window.history.state, '', url.toString());
    } catch (_) {
      // Some file:// contexts reject replaceState; the variant still renders.
    }
  }

  var label = null;

  function select(index) {
    var count = state.variants.length;
    if (!count) return;
    state.index = ((index % count) + count) % count;
    var current = state.variants[state.index];
    var detail = { id: current.id, label: current.label, index: state.index };
    window.prototypeVariant = detail;
    document.documentElement.setAttribute('data-variant', current.id);
    writeUrl(current.id);
    if (label) label.textContent = current.id.toUpperCase() + ' · ' + current.label + '  (' + (state.index + 1) + '/' + count + ')';
    window.dispatchEvent(new CustomEvent('prototype:variant', { detail: detail }));
  }

  function mount() {
    var host = document.createElement('div');
    host.setAttribute('data-prototype-switcher', '');
    // Shadow root keeps product CSS from restyling the control and vice versa.
    var root = host.attachShadow({ mode: 'open' });
    root.innerHTML =
      '<style>' +
      ':host{position:fixed;left:50%;bottom:16px;transform:translateX(-50%);z-index:2147483647}' +
      '.bar{display:flex;gap:8px;align-items:center;padding:6px 8px;border-radius:999px;background:#111;color:#fff;' +
      'font:500 13px/1.2 system-ui,sans-serif;box-shadow:0 4px 16px rgba(0,0,0,.25)}' +
      'button{all:unset;cursor:pointer;padding:4px 10px;border-radius:999px;background:#333}' +
      'button:hover{background:#555}.tag{opacity:.6;font-size:11px;text-transform:uppercase;letter-spacing:.06em}' +
      '</style>' +
      '<div class="bar"><span class="tag">prototype</span>' +
      '<button data-dir="-1" aria-label="Previous variant">&larr;</button>' +
      '<span class="label" aria-live="polite"></span>' +
      '<button data-dir="1" aria-label="Next variant">&rarr;</button></div>';
    label = root.querySelector('.label');
    root.querySelectorAll('button').forEach(function (button) {
      button.addEventListener(
        'click',
        function () {
          select(state.index + Number(button.dataset.dir));
        },
        { signal: controller.signal },
      );
    });
    document.body.appendChild(host);
    return host;
  }

  var host = null;

  function init(options) {
    destroy();
    var variants = normalize(options && options.variants);
    state.variants = variants.length ? variants : discover();
    if (!state.variants.length) return;
    controller = new AbortController();
    var requested = new URLSearchParams(window.location.search).get('variant');
    var start = state.variants.findIndex(function (v) {
      return v.id === requested;
    });
    window.addEventListener(
      'keydown',
      function (event) {
        if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
        if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return;
        var target = event.composedPath ? event.composedPath()[0] : event.target;
        if (isEditable(target) || isEditable(document.activeElement)) return;
        event.preventDefault();
        select(state.index + (event.key === 'ArrowRight' ? 1 : -1));
      },
      { signal: controller.signal },
    );
    var place = function () {
      host = mount();
      select(start < 0 ? 0 : start);
    };
    if (document.body) place();
    else document.addEventListener('DOMContentLoaded', place, { once: true, signal: controller.signal });
  }

  function destroy() {
    if (controller) controller.abort();
    if (host) host.remove();
    controller = null;
    host = null;
    label = null;
  }

  window.prototypeVariantSwitcher = {
    init: init,
    destroy: destroy,
    select: function (id) {
      var index = state.variants.findIndex(function (v) {
        return v.id === id;
      });
      if (index >= 0) select(index);
    },
    isEditable: isEditable,
  };

  if (scriptTag && scriptTag.dataset.manual !== undefined) return;
  // Templates may sit after this script, so wait for the document to parse.
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { init(); }, { once: true });
  else init();
})();
