/* finale — envelope unseal enhancement (todo 12)
   Progressive: the letter is plain HTML and fully readable
   without this file. This script only adds the sealed-state
   class, the unseal tap handler, and the print trigger. */

(() => {
  'use strict';

  var SECTION_ID = 'finale';

  function fireFinaleConfetti() {
    if (window.Motion) window.Motion.fireworks();
  }

  var wired = false;
  function init() {
    /* personal site: eager — retry until the gated section is connected. */
    var section = document.getElementById(SECTION_ID);
    if (!section || !section.isConnected || wired) {
      if (!wired) window.setTimeout(init, 150);
      return;
    }
    wired = true;

    document.documentElement.classList.add('js-finale');
    if (window.Motion) window.Motion.wireReplay();

    var stage = section.querySelector('[data-finale-stage]');
    var openBtn = section.querySelector('[data-finale-open]');
    var printBtn = section.querySelector('[data-finale-print]');

    if (stage && openBtn) {
      openBtn.addEventListener('click', function () {
        stage.classList.add('is-open');
        fireFinaleConfetti();
        var letter = section.querySelector('[data-finale-letter]');
        if (letter) {
          letter.setAttribute('tabindex', '-1');
          letter.focus({ preventScroll: true });
        }
      });
    }

    if (printBtn) {
      printBtn.addEventListener('click', function () {
        window.print();
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
