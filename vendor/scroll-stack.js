/* Scroll stack: vanilla port of React Bits "Scroll Stack".
   Source: https://reactbits.dev/components/scroll-stack (JS+CSS).
   Cards pin at a stack position and layer with scale/dim/tilt as you scroll.
   Reduced-motion gating dropped per owner decree (motion always runs).
   Exposes window.ScrollStack(mount, opts) -> { el, schedule, destroy }.
   Mount children are wrapped into sticky slots. */
(function () {
  'use strict';
  var CSS = ".scroll-stack {\n  position: relative;\n  width: 100%;\n}\n\n.scroll-stack--contained {\n  height: 100%;\n  overflow-x: hidden;\n  overflow-y: auto;\n}\n\n.scroll-stack__inner {\n  position: relative;\n  padding-inline: clamp(1rem, 6%, 5rem);\n}\n\n.scroll-stack__slot {\n  position: sticky;\n}\n\n.scroll-stack-card {\n  position: relative;\n  box-sizing: border-box;\n  width: 100%;\n  height: 20rem;\n  padding: 2.5rem;\n  border-radius: 28px;\n  background: light-dark(#ffffff, #18181b);\n  color: light-dark(#18181b, #fafafa);\n  box-shadow:\n    0 0 0 1px light-dark(rgb(0 0 0 / 0.06), rgb(255 255 255 / 0.08)),\n    0 -12px 40px -16px rgb(0 0 0 / 0.35),\n    0 24px 48px -24px rgb(0 0 0 / 0.4);\n  transform-origin: 50% 0;\n  will-change: transform;\n}\n\n.scroll-stack-card__shade {\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n  background: #000;\n  opacity: var(--scroll-stack-dim, 0);\n  pointer-events: none;\n}\n";
  var injected = false;
  function inject() {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    var el = document.createElement('style');
    el.setAttribute('data-scroll-stack', '');
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  function resolveOffset(value, size) {
    if (typeof value === 'number') return value;
    var text = String(value).trim();
    if (text.endsWith('%')) return (parseFloat(text) / 100) * size;
    return parseFloat(text) || 0;
  }
  function toLength(value) { return typeof value === 'number' ? value + 'px' : value; }
  function scrollsInside(node, stop, delta) {
    for (var element = node; element && element !== stop; element = element.parentElement) {
      if (element.scrollHeight <= element.clientHeight + 1) continue;
      var overflow = getComputedStyle(element).overflowY;
      if (overflow !== 'auto' && overflow !== 'scroll') continue;
      if (delta > 0 ? element.scrollTop + element.clientHeight < element.scrollHeight - 1 : element.scrollTop > 0) return true;
    }
    return false;
  }

  window.ScrollStack = function (mount, options) {
    var o = options || {};
    inject();
    var itemDistance = o.itemDistance != null ? o.itemDistance : 100;
    var itemStackDistance = o.itemStackDistance != null ? o.itemStackDistance : 24;
    var stackPosition = o.stackPosition != null ? o.stackPosition : '15%';
    var itemScale = o.itemScale != null ? o.itemScale : 0.05;
    var baseScale = o.baseScale != null ? o.baseScale : 0.8;
    var dimAmount = o.dimAmount != null ? o.dimAmount : 0.2;
    var blurAmount = o.blurAmount != null ? o.blurAmount : 0;
    var tiltAmount = o.tiltAmount != null ? o.tiltAmount : 0;
    var rotationAmount = o.rotationAmount != null ? o.rotationAmount : 0;
    var holdDistance = o.holdDistance != null ? o.holdDistance : 200;
    var smoothScroll = o.smoothScroll !== false;
    var snap = !!o.snap;
    var windowed = o.useWindowScroll !== false;

    var root = document.createElement('div');
    root.className = 'scroll-stack ' + (windowed ? 'scroll-stack--window' : 'scroll-stack--contained') + (o.className ? ' ' + o.className : '');
    var inner = document.createElement('div');
    inner.className = 'scroll-stack__inner';
    root.appendChild(inner);

    var cards = [].slice.call(mount.children);
    cards.forEach(function (card, index) {
      if (index > 0) {
        var gap = itemDistance - (cards.length - index) * itemStackDistance;
        var spacer = document.createElement('div');
        spacer.setAttribute('aria-hidden', 'true');
        spacer.style.height = Math.max(0, gap) + 'px';
        spacer.style.marginTop = Math.min(0, gap) + 'px';
        inner.appendChild(spacer);
      }
      var slot = document.createElement('div');
      slot.setAttribute('data-stack-slot', '');
      slot.className = 'scroll-stack__slot';
      slot.style.top = 'calc(' + toLength(stackPosition) + ' + ' + (index * itemStackDistance) + 'px)';
      slot.style.marginBottom = ((cards.length - 1 - index) * itemStackDistance) + 'px';
      slot.style.zIndex = String(index + 1);
      card.className = ('scroll-stack-card ' + card.className + (o.itemClassName ? ' ' + o.itemClassName : '')).trim();
      var shade = document.createElement('span');
      shade.className = 'scroll-stack-card__shade';
      shade.setAttribute('aria-hidden', 'true');
      card.appendChild(shade);
      slot.appendChild(card);
      inner.appendChild(slot);
    });
    var end = document.createElement('div');
    end.className = 'scroll-stack__end';
    end.setAttribute('aria-hidden', 'true');
    inner.appendChild(end);
    mount.appendChild(root);

    var target = windowed ? window : root;
    var cache = new Map();
    var frame = 0, glide = 0, rest = 0;
    var complete = false, gliding = false, pressed = false;
    var current = 0, goal = 0, written = 0, last = 0;
    var points = [], reach = 0, alive = true;

    var readScroll = function () { return windowed ? window.scrollY : root.scrollTop; };
    var maxScroll = function () {
      return windowed ? document.documentElement.scrollHeight - window.innerHeight : root.scrollHeight - root.clientHeight;
    };
    var writeScroll = function (value) {
      written = value;
      target.scrollTo({ top: value, behavior: 'instant' });
    };
    var write = function (key, value, apply) {
      if (cache.get(key) === value) return false;
      cache.set(key, value);
      apply(value);
      return true;
    };

    function update() {
      frame = 0;
      var slots = Array.prototype.slice.call(inner.children).filter(function (child) { return child.hasAttribute('data-stack-slot'); });
      if (!slots.length) return;
      var viewHeight = windowed ? window.innerHeight : root.clientHeight;
      var viewTop = windowed ? 0 : root.getBoundingClientRect().top + root.clientTop;
      var stackTop = resolveOffset(stackPosition, viewHeight);
      var offset = itemStackDistance;
      var heights = slots.map(function (slot) { return slot.offsetHeight; });
      var tops = slots.map(function (slot) { return slot.getBoundingClientRect().top; });
      var lastPin = stackTop + (slots.length - 1) * offset;
      var padTop = windowed ? 0 : stackTop;
      var endHeight = holdDistance + (windowed ? 0 : Math.max(0, viewHeight - lastPin - heights[heights.length - 1]));

      var moved = write('padTop', padTop, function (value) { inner.style.paddingTop = value + 'px'; });
      moved = write('endHeight', endHeight, function (value) { end.style.height = value + 'px'; }) || moved;

      var flow = inner.getBoundingClientRect().top - viewTop + readScroll() + padTop;
      points = heights.map(function (height, i) {
        var point = flow - stackTop - i * offset;
        flow += height + itemDistance;
        return point;
      });
      reach = Math.max(40, (heights[0] + itemDistance - offset) / 2);

      var depths = slots.map(function () { return 0; });
      var lastCover = 0;
      for (var j = 1; j < slots.length; j++) {
        var pinBefore = viewTop + stackTop + (j - 1) * offset;
        var start = pinBefore + heights[j - 1];
        var span = Math.max(1, start - pinBefore - offset);
        var cover = Math.min(1, Math.max(0, (start - tops[j]) / span));
        for (var i2 = 0; i2 < j; i2++) depths[i2] += cover;
        lastCover = cover;
      }
      var dimStep = Math.min(Math.max(dimAmount, 0), 1);
      slots.forEach(function (slot, i) {
        var card = slot.firstElementChild;
        if (!card) return;
        var depth = depths[i];
        var lean = Math.min(depth, 1);
        var scale = Math.max(Math.min(baseScale, 1), 1 - depth * itemScale);
        var tilt = -lean * tiltAmount;
        var turn = lean * rotationAmount * (i % 2 ? -1 : 1);
        var blur = depth * blurAmount;
        var dim = 1 - Math.pow(1 - dimStep, depth);
        var transform = depth < 0.0005 ? '' :
          'perspective(1200px) rotateX(' + tilt.toFixed(2) + 'deg) rotate(' + turn.toFixed(2) + 'deg) scale(' + scale.toFixed(4) + ')';
        write('transform' + i, transform, function (value) { card.style.transform = value; });
        write('filter' + i, blur > 0.01 ? 'blur(' + blur.toFixed(2) + 'px)' : '', function (value) { card.style.filter = value; });
        write('dim' + i, dim.toFixed(3), function (value) { card.style.setProperty('--scroll-stack-dim', value); });
      });

      var done = slots.length > 1 && lastCover >= 0.999;
      if (done !== complete) {
        complete = done;
        if (done && o.onStackComplete) o.onStackComplete();
      }
      if (moved) schedule();
    }

    function schedule() { if (!frame && alive) frame = requestAnimationFrame(update); }

    function step(now) {
      var dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      if (Math.abs(readScroll() - written) > 2) { gliding = false; glide = 0; settleSoon(); return; }
      current += (goal - current) * (1 - Math.pow(0.9, dt * 60));
      if (Math.abs(goal - current) < 0.5) current = goal;
      writeScroll(current);
      if (current === goal) { gliding = false; glide = 0; settleSoon(); return; }
      glide = requestAnimationFrame(step);
    }

    function glideTo(value) {
      goal = Math.min(Math.max(value, 0), maxScroll());
      if (gliding) return;
      gliding = true;
      current = readScroll();
      written = current;
      last = performance.now();
      glide = requestAnimationFrame(step);
    }

    function settle() {
      rest = 0;
      if (!snap || gliding || pressed || !points.length) return;
      var now = readScroll();
      var nearest = points.reduce(function (best, point) {
        return Math.abs(point - now) < Math.abs(best - now) ? point : best;
      });
      var gap = Math.abs(nearest - now);
      if (gap > 1 && gap < reach) glideTo(nearest);
    }
    function settleSoon() {
      window.clearTimeout(rest);
      rest = window.setTimeout(settle, 140);
    }

    function onScroll() { schedule(); if (!gliding) settleSoon(); }
    function onWheel(event) {
      if (!smoothScroll || event.defaultPrevented || event.ctrlKey) return;
      if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
      var page = windowed ? window.innerHeight : root.clientHeight;
      var delta = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? page : 1);
      if (!delta || scrollsInside(event.target, windowed ? document.body : root, delta)) return;
      var base = gliding ? goal : readScroll();
      if ((delta < 0 && base <= 0) || (delta > 0 && base >= maxScroll() - 0.5)) return;
      event.preventDefault();
      window.clearTimeout(rest);
      glideTo(base + delta);
    }
    function onPress() { pressed = true; window.clearTimeout(rest); }
    function onRelease() { if (!pressed) return; pressed = false; settleSoon(); }

    var observer = new ResizeObserver(schedule);
    observer.observe(root);
    observer.observe(inner);
    target.addEventListener('scroll', onScroll, { passive: true });
    target.addEventListener('wheel', onWheel, { passive: false });
    target.addEventListener('pointerdown', onPress, { passive: true });
    window.addEventListener('pointerup', onRelease, { passive: true });
    window.addEventListener('pointercancel', onRelease, { passive: true });
    window.addEventListener('resize', schedule);
    schedule();
    update();

    return {
      el: root,
      schedule: schedule,
      destroy: function () {
        alive = false;
        cancelAnimationFrame(frame);
        cancelAnimationFrame(glide);
        window.clearTimeout(rest);
        observer.disconnect();
        target.removeEventListener('scroll', onScroll);
        target.removeEventListener('wheel', onWheel);
        target.removeEventListener('pointerdown', onPress);
        window.removeEventListener('pointerup', onRelease);
        window.removeEventListener('pointercancel', onRelease);
        window.removeEventListener('resize', schedule);
        root.remove();
      }
    };
  };
})();
