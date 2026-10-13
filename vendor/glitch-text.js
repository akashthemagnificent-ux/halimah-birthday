/* Glitch text: vanilla port of React Bits "Glitch Text".
   Source: https://reactbits.dev/text-animations/glitch-text (JS+CSS).
   RGB-split clip-path glitch over a data-text pseudo-element.
   Exposes window.GlitchText(mount, {text, speed, shadows, hover, className}). */
(function () {
  'use strict';
  var CSS = `.glitch {
  color: #fff;
  font-size: clamp(2rem, 10vw, 8rem);
  white-space: nowrap;
  font-weight: 900;
  position: relative;
  margin: 0 auto;
  user-select: none;
  cursor: pointer;
}

.glitch::after,
.glitch::before {
  content: attr(data-text);
  position: absolute;
  top: 0;
  color: #fff;
  background-color: #120F17;
  overflow: hidden;
  clip-path: inset(0 0 0 0);
}

.glitch:not(.enable-on-hover)::after {
  left: 10px;
  text-shadow: var(--after-shadow, -10px 0 red);
  animation: animate-glitch var(--after-duration, 3s) infinite linear alternate-reverse;
}
.glitch:not(.enable-on-hover)::before {
  left: -10px;
  text-shadow: var(--before-shadow, 10px 0 cyan);
  animation: animate-glitch var(--before-duration, 2s) infinite linear alternate-reverse;
}

.glitch.enable-on-hover::after,
.glitch.enable-on-hover::before {
  content: '';
  opacity: 0;
  animation: none;
}

.glitch.enable-on-hover:hover::after {
  content: attr(data-text);
  opacity: 1;
  left: 10px;
  text-shadow: var(--after-shadow, -10px 0 red);
  animation: animate-glitch var(--after-duration, 3s) infinite linear alternate-reverse;
}
.glitch.enable-on-hover:hover::before {
  content: attr(data-text);
  opacity: 1;
  left: -10px;
  text-shadow: var(--before-shadow, 10px 0 cyan);
  animation: animate-glitch var(--before-duration, 2s) infinite linear alternate-reverse;
}

@keyframes animate-glitch {
  0% {
    clip-path: inset(20% 0 50% 0);
  }
  5% {
    clip-path: inset(10% 0 60% 0);
  }
  10% {
    clip-path: inset(15% 0 55% 0);
  }
  15% {
    clip-path: inset(25% 0 35% 0);
  }
  20% {
    clip-path: inset(30% 0 40% 0);
  }
  25% {
    clip-path: inset(40% 0 20% 0);
  }
  30% {
    clip-path: inset(10% 0 60% 0);
  }
  35% {
    clip-path: inset(15% 0 55% 0);
  }
  40% {
    clip-path: inset(25% 0 35% 0);
  }
  45% {
    clip-path: inset(30% 0 40% 0);
  }
  50% {
    clip-path: inset(20% 0 50% 0);
  }
  55% {
    clip-path: inset(10% 0 60% 0);
  }
  60% {
    clip-path: inset(15% 0 55% 0);
  }
  65% {
    clip-path: inset(25% 0 35% 0);
  }
  70% {
    clip-path: inset(30% 0 40% 0);
  }
  75% {
    clip-path: inset(40% 0 20% 0);
  }
  80% {
    clip-path: inset(20% 0 50% 0);
  }
  85% {
    clip-path: inset(10% 0 60% 0);
  }
  90% {
    clip-path: inset(15% 0 55% 0);
  }
  95% {
    clip-path: inset(25% 0 35% 0);
  }
  100% {
    clip-path: inset(30% 0 40% 0);
  }
}
`;
  var injected = false;
  function inject() {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    var el = document.createElement('style');
    el.setAttribute('data-glitch-text', '');
    el.textContent = CSS;
    document.head.appendChild(el);
  }
  window.GlitchText = function (mount, options) {
    var o = options || {};
    inject();
    var speed = o.speed != null ? o.speed : 0.5;
    var el = document.createElement('div');
    el.className = ('glitch' + (o.hover ? ' enable-on-hover' : '') + (o.className ? ' ' + o.className : '')).trim();
    el.textContent = o.text || '';
    el.setAttribute('data-text', o.text || '');
    el.style.setProperty('--after-duration', (speed * 3) + 's');
    el.style.setProperty('--before-duration', (speed * 2) + 's');
    el.style.setProperty('--after-shadow', (o.shadows !== false) ? '-5px 0 red' : 'none');
    el.style.setProperty('--before-shadow', (o.shadows !== false) ? '5px 0 cyan' : 'none');
    mount.appendChild(el);
    return { el: el, destroy: function () { el.remove(); } };
  };
})();
