/* Magic bento grid: vanilla port of React Bits "Magic Bento".
   Source: https://reactbits.dev/components/magic-bento (JS+CSS).
   Spotlight follow, border glow, spring tilt/magnetism, click wave, per-card
   particle stars, staggered intro. The hugeicons visuals are omitted; items
   carry their own HTML content. Motion always runs (owner decree).
   Exposes window.MagicBento(mount, opts) -> { el, sync, destroy }. */
(function () {
  'use strict';
  var CSS = ".magic-bento {\n  --mb-spring: cubic-bezier(0.34, 1.4, 0.64, 1);\n  position: relative;\n  box-sizing: border-box;\n  display: grid;\n  grid-auto-flow: row dense;\n  width: 100%;\n  color: var(--mb-ink);\n  font-feature-settings: 'tnum' 0;\n  -webkit-tap-highlight-color: transparent;\n}\n\n@supports (transition-timing-function: linear(0, 1)) {\n  .magic-bento {\n    --mb-spring: linear(\n      0,\n      0.0603,\n      0.2033,\n      0.3821,\n      0.5633,\n      0.7258,\n      0.8584,\n      0.9574,\n      1.0242,\n      1.0634,\n      1.0809,\n      1.0828,\n      1.0747,\n      1.0613,\n      1.046,\n      1.0313,\n      1.0186,\n      1.0085,\n      1.0012,\n      0.9965,\n      0.994,\n      0.9931,\n      0.9933,\n      0.9941,\n      0.9953,\n      0.9966,\n      0.9978,\n      0.9988,\n      1\n    );\n  }\n}\n\n.magic-bento__cell {\n  position: relative;\n  min-width: 0;\n  min-height: 0;\n  --mb-delay: 0ms;\n}\n\n.magic-bento[data-intro] .magic-bento__cell {\n  opacity: 0;\n  transform: translate3d(0, 16px, 0) scale(0.97);\n}\n\n.magic-bento[data-intro] .magic-bento__cell[data-state='in'] {\n  opacity: 1;\n  transform: none;\n  transition:\n    opacity 420ms cubic-bezier(0.22, 1, 0.36, 1) var(--mb-delay),\n    transform 760ms var(--mb-spring) var(--mb-delay);\n}\n\n.magic-bento__card {\n  position: relative;\n  box-sizing: border-box;\n  display: flex;\n  width: 100%;\n  height: 100%;\n  flex-direction: column;\n  overflow: hidden;\n  border-radius: var(--mb-radius);\n  background: var(--mb-surface);\n  box-shadow: var(--mb-shadow);\n  color: var(--mb-ink);\n  text-decoration: none;\n  isolation: isolate;\n  outline: none;\n  transform: perspective(900px) translate3d(var(--mb-tx, 0px), var(--mb-ty, 0px), 0) rotateX(var(--mb-rx, 0deg))\n    rotateY(var(--mb-ry, 0deg)) scale(var(--mb-press, 1));\n  user-select: none;\n  -webkit-user-select: none;\n}\n\n.magic-bento__card[data-clickable] {\n  cursor: pointer;\n}\n\n.magic-bento__card:focus-visible {\n  box-shadow:\n    var(--mb-shadow),\n    0 0 0 2px var(--mb-focus);\n}\n\n.magic-bento__image {\n  position: absolute;\n  inset: 0;\n  z-index: 0;\n  width: 100%;\n  height: 100%;\n  object-fit: cover;\n  pointer-events: none;\n}\n\n.magic-bento__scrim {\n  position: absolute;\n  inset: 0;\n  z-index: 0;\n  background: linear-gradient(\n    to top,\n    rgba(10, 9, 13, 0.82) 0%,\n    rgba(10, 9, 13, 0.7) 14%,\n    rgba(10, 9, 13, 0.46) 30%,\n    rgba(10, 9, 13, 0.2) 46%,\n    rgba(10, 9, 13, 0.05) 60%,\n    rgba(10, 9, 13, 0) 72%\n  );\n  pointer-events: none;\n}\n\n.magic-bento__light {\n  position: absolute;\n  inset: 0;\n  z-index: 1;\n  border-radius: inherit;\n  background: radial-gradient(\n    var(--mb-spot-size) circle at var(--mb-x, -999px) var(--mb-y, -999px),\n    rgba(var(--mb-glow-rgb), calc(var(--mb-spot-alpha) * var(--mb-hot, 0) * 1)) 0%,\n    rgba(var(--mb-glow-rgb), calc(var(--mb-spot-alpha) * var(--mb-hot, 0) * 0.973)) 15%,\n    rgba(var(--mb-glow-rgb), calc(var(--mb-spot-alpha) * var(--mb-hot, 0) * 0.837)) 30%,\n    rgba(var(--mb-glow-rgb), calc(var(--mb-spot-alpha) * var(--mb-hot, 0) * 0.593)) 45%,\n    rgba(var(--mb-glow-rgb), calc(var(--mb-spot-alpha) * var(--mb-hot, 0) * 0.317)) 60%,\n    rgba(var(--mb-glow-rgb), calc(var(--mb-spot-alpha) * var(--mb-hot, 0) * 0.104)) 75%,\n    rgba(var(--mb-glow-rgb), calc(var(--mb-spot-alpha) * var(--mb-hot, 0) * 0.009)) 90%,\n    rgba(var(--mb-glow-rgb), 0) 100%\n  );\n  pointer-events: none;\n}\n\n.magic-bento__stars {\n  position: absolute;\n  inset: 0;\n  z-index: 1;\n  display: block;\n  width: 100%;\n  height: 100%;\n  pointer-events: none;\n}\n\n.magic-bento__rim {\n  position: absolute;\n  inset: 0;\n  z-index: 3;\n  border-radius: inherit;\n  box-shadow:\n    inset 0 0 0 1px var(--mb-edge),\n    inset 0 1px 0 var(--mb-highlight);\n  pointer-events: none;\n}\n\n.magic-bento__border {\n  position: absolute;\n  inset: 0;\n  z-index: 4;\n  box-sizing: border-box;\n  padding: 1px;\n  border-radius: inherit;\n  background:\n    radial-gradient(\n      var(--mb-border-size) circle at var(--mb-x, -999px) var(--mb-y, -999px),\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-near, 0) * 1)) 0%,\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-near, 0) * 0.973)) 15%,\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-near, 0) * 0.837)) 30%,\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-near, 0) * 0.593)) 45%,\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-near, 0) * 0.317)) 60%,\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-near, 0) * 0.104)) 75%,\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-near, 0) * 0.009)) 90%,\n      rgba(var(--mb-glow-rgb), 0) 100%\n    ),\n    radial-gradient(\n      circle at var(--mb-wx, -999px) var(--mb-wy, -999px),\n      rgba(var(--mb-glow-rgb), 0) calc(var(--mb-wr, 0px) - 110px),\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-wa, 0) * 0.1)) calc(var(--mb-wr, 0px) - 80px),\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-wa, 0) * 0.32)) calc(var(--mb-wr, 0px) - 52px),\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-wa, 0) * 0.68)) calc(var(--mb-wr, 0px) - 28px),\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-wa, 0) * 0.94)) calc(var(--mb-wr, 0px) - 10px),\n      rgba(var(--mb-glow-rgb), calc(var(--mb-glow-alpha) * var(--mb-wa, 0))) calc(var(--mb-wr, 0px) - 3px),\n      rgba(var(--mb-glow-rgb), 0) var(--mb-wr, 0px)\n    );\n  -webkit-mask:\n    linear-gradient(#000 0 0) content-box,\n    linear-gradient(#000 0 0);\n  -webkit-mask-composite: xor;\n  mask:\n    linear-gradient(#000 0 0) content-box exclude,\n    linear-gradient(#000 0 0);\n  pointer-events: none;\n}\n\n.magic-bento__content {\n  position: relative;\n  z-index: 2;\n  box-sizing: border-box;\n  display: flex;\n  min-height: 0;\n  flex: 1;\n  flex-direction: column;\n  gap: 12px;\n  padding: var(--mb-pad);\n}\n\n.magic-bento__header {\n  display: flex;\n  min-width: 0;\n  align-items: center;\n  gap: 8px;\n  color: var(--mb-muted);\n  font-size: 12px;\n  font-weight: 500;\n  line-height: 16px;\n}\n\n.magic-bento__icon {\n  display: grid;\n  width: 16px;\n  height: 16px;\n  flex: none;\n  place-items: center;\n  color: var(--mb-ink);\n}\n\n.magic-bento__label {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.magic-bento__visual {\n  position: relative;\n  display: flex;\n  min-height: 0;\n  flex: 1;\n  flex-direction: column;\n  justify-content: center;\n  container-type: size;\n}\n\n.magic-bento__text {\n  display: flex;\n  flex-direction: column;\n  gap: 4px;\n  margin-top: auto;\n}\n\n.magic-bento__title {\n  margin: 0;\n  color: var(--mb-ink);\n  font-size: 15px;\n  font-weight: 600;\n  letter-spacing: -0.01em;\n  line-height: 20px;\n}\n\n.magic-bento__description {\n  margin: 0;\n  color: var(--mb-muted);\n  font-size: 13px;\n  line-height: 1.45;\n}\n\n.magic-bento[data-autohide] .magic-bento__title,\n.magic-bento[data-autohide] .magic-bento__description {\n  display: -webkit-box;\n  overflow: hidden;\n  -webkit-box-orient: vertical;\n}\n\n.magic-bento[data-autohide] .magic-bento__title {\n  -webkit-line-clamp: 1;\n  line-clamp: 1;\n}\n\n.magic-bento[data-autohide] .magic-bento__description {\n  -webkit-line-clamp: 2;\n  line-clamp: 2;\n}\n\n.magic-bento__card[data-image] .magic-bento__header,\n.magic-bento__card[data-image] .magic-bento__description {\n  color: rgba(244, 244, 245, 0.72);\n}\n\n.magic-bento__card[data-image] .magic-bento__title,\n.magic-bento__card[data-image] .magic-bento__icon {\n  color: #f4f4f5;\n}\n\n.magic-bento__well {\n  position: relative;\n  box-sizing: border-box;\n  border-radius: var(--mb-inner-radius);\n  background: var(--mb-well);\n  box-shadow: inset 0 0 0 1px var(--mb-well-edge);\n}\n\n.magic-bento__tile {\n  position: relative;\n  box-sizing: border-box;\n  border-radius: var(--mb-inner-radius);\n  background: var(--mb-tile);\n  box-shadow: var(--mb-tile-shadow);\n}\n\n.magic-bento__tile::after {\n  content: '';\n  position: absolute;\n  inset: 0;\n  border-radius: inherit;\n  box-shadow:\n    inset 0 0 0 1px var(--mb-tile-edge),\n    inset 0 1px 0 var(--mb-tile-highlight);\n  pointer-events: none;\n}\n\n.magic-bento__chart {\n  display: flex;\n  min-height: 0;\n  flex: 1;\n  flex-direction: column;\n  touch-action: pan-y;\n}\n\n.magic-bento__figure {\n  display: flex;\n  min-width: 0;\n  align-items: baseline;\n  gap: 6px;\n  white-space: nowrap;\n}\n\n.magic-bento__figure-value {\n  color: var(--mb-ink);\n  font-size: 15px;\n  font-variant-numeric: tabular-nums;\n  font-weight: 600;\n  letter-spacing: -0.02em;\n  line-height: 18px;\n}\n\n.magic-bento__figure-note {\n  min-width: 0;\n  overflow: hidden;\n  color: var(--mb-muted);\n  text-overflow: ellipsis;\n  font-size: 11.5px;\n  font-variant-numeric: tabular-nums;\n  line-height: 14px;\n}\n\n.magic-bento__plot {\n  position: relative;\n  min-height: 0;\n  flex: 1;\n  margin-top: 6px;\n}\n\n.magic-bento__plot svg {\n  position: absolute;\n  inset: 0;\n  display: block;\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n}\n\n.magic-bento__chart-area {\n  fill: rgba(var(--mb-accent-rgb), 0.14);\n}\n\n.magic-bento__chart-line {\n  fill: none;\n  stroke: rgb(var(--mb-accent-rgb));\n  stroke-linecap: round;\n  stroke-linejoin: round;\n  stroke-width: 1.6;\n}\n\n.magic-bento__scrub {\n  position: absolute;\n  top: 0;\n  bottom: 0;\n  left: 0;\n  width: 1px;\n  background: linear-gradient(to bottom, rgba(var(--mb-accent-rgb), 0), rgba(var(--mb-accent-rgb), 0.35));\n  opacity: 0;\n  pointer-events: none;\n  transition: opacity 180ms ease;\n}\n\n.magic-bento__scrub-dot {\n  position: absolute;\n  top: 0;\n  left: 0;\n  width: 7px;\n  height: 7px;\n  margin: -3.5px 0 0 -3px;\n  border-radius: 50%;\n  background: rgb(var(--mb-accent-rgb));\n  box-shadow: 0 0 0 3px var(--mb-ring);\n}\n\n.magic-bento__chart[data-scrub] .magic-bento__scrub {\n  opacity: 1;\n}\n\n.magic-bento__bars {\n  display: flex;\n  min-height: 0;\n  flex: 1;\n  flex-direction: column;\n}\n\n.magic-bento__bars-plot {\n  display: flex;\n  min-height: 0;\n  flex: 1;\n  align-items: flex-end;\n  gap: 5px;\n  margin-top: 8px;\n}\n\n.magic-bento__bar {\n  position: relative;\n  height: calc(var(--h) * 100%);\n  min-height: 3px;\n  flex: 1;\n  border-radius: 3px 3px 2px 2px;\n  background: rgba(var(--mb-accent-rgb), 0.18);\n  transform-origin: 50% 100%;\n  transition:\n    background-color 200ms ease,\n    filter 200ms ease;\n}\n\n.magic-bento__bar[data-peak] {\n  background: rgb(var(--mb-accent-rgb));\n}\n\n@media (hover: hover) {\n  .magic-bento__bar:hover {\n    background: rgba(var(--mb-accent-rgb), 0.42);\n  }\n\n  .magic-bento__bar[data-peak]:hover {\n    background: rgb(var(--mb-accent-rgb));\n    filter: brightness(1.1);\n  }\n}\n\n.magic-bento__collab {\n  position: relative;\n  display: flex;\n  min-height: 0;\n  flex-direction: column;\n  overflow: hidden;\n  padding: 16px 16px 22px;\n}\n\n.magic-bento__doc-title {\n  color: var(--mb-ink);\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 18px;\n}\n\n.magic-bento__lines {\n  display: flex;\n  flex-direction: column;\n  gap: 10px;\n  margin-top: 18px;\n}\n\n.magic-bento__line {\n  position: relative;\n  width: var(--w);\n  height: 6px;\n  border-radius: 3px;\n  background: var(--mb-line);\n}\n\n.magic-bento__line--gap {\n  margin-top: 8px;\n}\n\n.magic-bento__selection {\n  position: absolute;\n  top: -4px;\n  bottom: -4px;\n  left: var(--from);\n  width: var(--span);\n  border-radius: 3px;\n  background: rgba(var(--mb-accent-rgb), 0.16);\n}\n\n.magic-bento__caret {\n  position: absolute;\n  top: -5px;\n  right: -1px;\n  bottom: -5px;\n  width: 1.5px;\n  border-radius: 1px;\n  background: rgb(var(--mb-accent-rgb));\n}\n\n.magic-bento__cursor {\n  position: absolute;\n  top: var(--y);\n  left: var(--x);\n  z-index: 2;\n  display: flex;\n  align-items: flex-start;\n  pointer-events: none;\n}\n\n.magic-bento__cursor svg {\n  display: block;\n  flex: none;\n  filter: drop-shadow(0 1px 1.5px rgba(0, 0, 0, 0.35));\n}\n\n.magic-bento__cursor-name {\n  margin: 13px 0 0 -2px;\n  padding: 2px 7px;\n  border-radius: 7px;\n  font-size: 10.5px;\n  font-weight: 600;\n  line-height: 14px;\n  white-space: nowrap;\n}\n\n.magic-bento__cursor--primary svg path {\n  fill: rgb(var(--mb-accent-rgb));\n  stroke: var(--mb-cursor-stroke);\n}\n\n.magic-bento__cursor--primary .magic-bento__cursor-name {\n  background: rgb(var(--mb-accent-rgb));\n  color: var(--mb-accent-ink);\n}\n\n.magic-bento__cursor--secondary svg path {\n  fill: var(--mb-secondary);\n  stroke: var(--mb-cursor-stroke);\n}\n\n.magic-bento__cursor--secondary .magic-bento__cursor-name {\n  background: var(--mb-secondary);\n  color: var(--mb-secondary-ink);\n}\n\n.magic-bento__flow {\n  position: relative;\n  display: flex;\n  min-height: 0;\n  flex-direction: column;\n  gap: 8px;\n}\n\n.magic-bento__flow-trigger {\n  display: flex;\n  align-items: center;\n  gap: 10px;\n  padding: 8px 12px 8px 8px;\n}\n\n.magic-bento__flow-glyph {\n  display: grid;\n  width: 28px;\n  height: 28px;\n  flex: none;\n  place-items: center;\n  border-radius: calc(var(--mb-inner-radius) - 2px);\n  background: var(--mb-well);\n  color: var(--mb-ink);\n}\n\n.magic-bento__flow-copy {\n  display: flex;\n  min-width: 0;\n  flex-direction: column;\n}\n\n.magic-bento__flow-name {\n  overflow: hidden;\n  color: var(--mb-ink);\n  font-size: 13px;\n  font-weight: 600;\n  line-height: 17px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.magic-bento__flow-meta {\n  overflow: hidden;\n  color: var(--mb-muted);\n  font-size: 11.5px;\n  line-height: 15px;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n.magic-bento__flow-hash {\n  font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace;\n  font-size: 11px;\n}\n\n.magic-bento__steps {\n  position: relative;\n  display: flex;\n  flex-direction: column;\n  gap: 2px;\n  margin: 0;\n  padding: 2px 0 0;\n  list-style: none;\n}\n\n.magic-bento__rail {\n  position: absolute;\n  top: 16px;\n  bottom: 16px;\n  left: 21px;\n  width: 1px;\n  background: var(--mb-line);\n}\n\n.magic-bento__rail-fill {\n  position: absolute;\n  inset: 0;\n  background: rgba(var(--mb-accent-rgb), 0.55);\n  transform-origin: 50% 0;\n}\n\n.magic-bento__step {\n  position: relative;\n  display: flex;\n  height: 33px;\n  align-items: center;\n  gap: 10px;\n  padding: 0 12px 0 14px;\n  color: var(--mb-ink);\n  font-size: 13px;\n  line-height: 16px;\n}\n\n.magic-bento__status {\n  position: relative;\n  display: grid;\n  width: 16px;\n  height: 16px;\n  flex: none;\n  place-items: center;\n}\n\n.magic-bento__status > * {\n  grid-area: 1 / 1;\n}\n\n.magic-bento__pending {\n  width: 12px;\n  height: 12px;\n  box-sizing: border-box;\n  border: 1.5px dashed var(--mb-faint);\n  border-radius: 50%;\n  opacity: 0;\n}\n\n.magic-bento__spinner {\n  width: 14px;\n  height: 14px;\n  box-sizing: border-box;\n  border: 1.5px solid rgba(var(--mb-accent-rgb), 0.22);\n  border-top-color: rgb(var(--mb-accent-rgb));\n  border-radius: 50%;\n  opacity: 0;\n}\n\n.magic-bento__done {\n  display: grid;\n  width: 16px;\n  height: 16px;\n  place-items: center;\n  border-radius: 50%;\n  background: rgb(var(--mb-accent-rgb));\n  color: var(--mb-accent-ink);\n}\n\n.magic-bento__step-time {\n  margin-left: auto;\n  color: var(--mb-muted);\n  font-size: 12px;\n  font-variant-numeric: tabular-nums;\n}\n\n.magic-bento__hub {\n  position: relative;\n  width: 100%;\n  max-width: 240px;\n  min-height: 0;\n  flex: 1;\n  margin: 0 auto;\n}\n\n.magic-bento__hub-links {\n  position: absolute;\n  inset: 0;\n  width: 100%;\n  height: 100%;\n  overflow: visible;\n}\n\n.magic-bento__hub-links line {\n  stroke: var(--mb-line);\n  stroke-width: 1;\n  vector-effect: non-scaling-stroke;\n}\n\n.magic-bento__hub-node {\n  --size: min(var(--s), 30cqh);\n  position: absolute;\n  top: var(--y);\n  left: var(--x);\n  display: grid;\n  width: var(--size);\n  height: var(--size);\n  place-items: center;\n  margin: calc(var(--size) * -0.5) 0 0 calc(var(--size) * -0.5);\n  color: var(--mb-ink);\n}\n\n.magic-bento__hub-node.magic-bento__tile {\n  border-radius: calc(var(--size) * 0.3);\n}\n\n.magic-bento__packet {\n  position: absolute;\n  top: var(--y);\n  left: var(--x);\n  width: 4px;\n  height: 4px;\n  margin: -2px 0 0 -2px;\n  border-radius: 50%;\n  background: rgb(var(--mb-accent-rgb));\n  opacity: 0;\n}\n\n.magic-bento__shield {\n  display: flex;\n  width: 100%;\n  max-width: 320px;\n  min-height: 0;\n  flex: 1;\n  flex-direction: column;\n  justify-content: center;\n  gap: 8px;\n}\n\n.magic-bento__setting {\n  display: flex;\n  height: 32px;\n  flex: none;\n  align-items: center;\n  gap: 8px;\n  padding: 0 8px 0 10px;\n  color: var(--mb-ink);\n  font-size: 12.5px;\n  font-weight: 500;\n  line-height: 16px;\n}\n\n.magic-bento__setting-label {\n  overflow: hidden;\n  text-overflow: ellipsis;\n  white-space: nowrap;\n}\n\n@container (max-height: 78px) {\n  .magic-bento__setting ~ .magic-bento__setting {\n    display: none;\n  }\n}\n\n@container (max-height: 60px) {\n  .magic-bento__hub {\n    display: none;\n  }\n}\n\n@container (max-height: 38px) {\n  .magic-bento__shield,\n  .magic-bento__chart,\n  .magic-bento__bars {\n    visibility: hidden;\n  }\n}\n\n.magic-bento__switch {\n  position: relative;\n  width: 26px;\n  height: 16px;\n  flex: none;\n  margin-left: auto;\n  border-radius: 8px;\n  background: rgb(var(--mb-accent-rgb));\n  transition: background-color 220ms ease;\n}\n\n.magic-bento__switch::after {\n  content: '';\n  position: absolute;\n  top: 2px;\n  left: 2px;\n  width: 12px;\n  height: 12px;\n  border-radius: 50%;\n  background: var(--mb-accent-ink);\n  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.3);\n  transform: translateX(10px);\n  transition: transform 320ms var(--mb-spring);\n}\n\n.magic-bento__switch[data-off] {\n  background: var(--mb-line);\n}\n\n.magic-bento__switch[data-off]::after {\n  background: var(--mb-ink);\n  transform: none;\n}\n\n.magic-bento[data-motion] .magic-bento__chart-line {\n  stroke-dasharray: 1;\n  animation: magic-bento-draw 1100ms cubic-bezier(0.65, 0, 0.35, 1) calc(var(--mb-delay) + 220ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__chart-area {\n  animation: magic-bento-fade 700ms ease calc(var(--mb-delay) + 700ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__bar {\n  animation: magic-bento-grow 760ms var(--mb-spring) calc(var(--mb-delay) + 200ms + var(--i) * 55ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__cursor {\n  animation:\n    magic-bento-pop 420ms var(--mb-spring) calc(var(--mb-delay) + 600ms + var(--i) * 160ms) both paused,\n    var(--path) 9s ease-in-out calc(var(--i) * -3s) infinite paused;\n}\n\n.magic-bento[data-motion] .magic-bento__selection {\n  animation: magic-bento-select 900ms cubic-bezier(0.65, 0, 0.35, 1) calc(var(--mb-delay) + 760ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__caret {\n  animation: magic-bento-blink 1.1s steps(1) infinite paused;\n}\n\n.magic-bento[data-motion] .magic-bento__pending {\n  animation: magic-bento-wait 1ms linear calc(var(--mb-delay) + 360ms + var(--i) * 520ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__spinner {\n  animation:\n    magic-bento-run 520ms linear calc(var(--mb-delay) + 360ms + var(--i) * 520ms) both paused,\n    magic-bento-spin 700ms linear infinite paused;\n}\n\n.magic-bento[data-motion] .magic-bento__done {\n  animation: magic-bento-check 420ms var(--mb-spring) calc(var(--mb-delay) + 880ms + var(--i) * 520ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__step-time {\n  animation: magic-bento-fade 300ms ease calc(var(--mb-delay) + 880ms + var(--i) * 520ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__rail-fill {\n  animation: magic-bento-rail calc(var(--n) * 520ms) linear calc(var(--mb-delay) + 360ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__hub-node {\n  animation: magic-bento-pop 520ms var(--mb-spring) calc(var(--mb-delay) + 200ms + var(--i) * 70ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__hub-links line {\n  stroke-dasharray: 1;\n  animation: magic-bento-draw 700ms cubic-bezier(0.65, 0, 0.35, 1) calc(var(--mb-delay) + 360ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__card[data-active] .magic-bento__packet {\n  animation: magic-bento-packet 1.8s cubic-bezier(0.45, 0, 0.55, 1) calc(var(--i) * 0.45s) infinite;\n}\n\n.magic-bento[data-motion] .magic-bento__switch {\n  animation: magic-bento-switch-track 420ms ease calc(var(--mb-delay) + 520ms + var(--i) * 200ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__switch::after {\n  animation: magic-bento-switch-knob 520ms var(--mb-spring) calc(var(--mb-delay) + 520ms + var(--i) * 200ms) both paused;\n}\n\n.magic-bento[data-motion] .magic-bento__switch[data-off],\n.magic-bento[data-motion] .magic-bento__switch[data-off]::after {\n  animation: none;\n}\n\n.magic-bento[data-motion]\n  .magic-bento__cell[data-state='in']\n  :is(\n    .magic-bento__chart-line,\n    .magic-bento__chart-area,\n    .magic-bento__bar,\n    .magic-bento__selection,\n    .magic-bento__pending,\n    .magic-bento__spinner,\n    .magic-bento__done,\n    .magic-bento__step-time,\n    .magic-bento__rail-fill,\n    .magic-bento__hub-node,\n    .magic-bento__hub-links line,\n    .magic-bento__switch\n  ) {\n  animation-play-state: running;\n}\n\n.magic-bento[data-motion] .magic-bento__cell[data-state='in'] .magic-bento__switch::after {\n  animation-play-state: running;\n}\n\n.magic-bento[data-motion] .magic-bento__cell[data-state='in'] .magic-bento__cursor {\n  animation-play-state: running, paused;\n}\n\n.magic-bento[data-motion] .magic-bento__cell[data-state='in'] .magic-bento__card[data-active] .magic-bento__cursor {\n  animation-play-state: running, running;\n}\n\n.magic-bento[data-motion] .magic-bento__card[data-active] .magic-bento__caret {\n  animation-play-state: running;\n}\n\n.magic-bento[data-motion] .magic-bento__cell[data-state='in'] .magic-bento__spinner {\n  animation-play-state: running, running;\n}\n\n@keyframes magic-bento-draw {\n  from {\n    stroke-dashoffset: 1;\n  }\n  to {\n    stroke-dashoffset: 0;\n  }\n}\n\n@keyframes magic-bento-fade {\n  from {\n    opacity: 0;\n  }\n  to {\n    opacity: 1;\n  }\n}\n\n@keyframes magic-bento-grow {\n  from {\n    transform: scaleY(0);\n  }\n  to {\n    transform: scaleY(1);\n  }\n}\n\n@keyframes magic-bento-pop {\n  from {\n    opacity: 0;\n    scale: 0.6;\n  }\n  to {\n    opacity: 1;\n    scale: 1;\n  }\n}\n\n@keyframes magic-bento-select {\n  from {\n    clip-path: inset(0 100% 0 0);\n  }\n  to {\n    clip-path: inset(0 0 0 0);\n  }\n}\n\n@keyframes magic-bento-blink {\n  0% {\n    opacity: 1;\n  }\n  50% {\n    opacity: 0;\n  }\n}\n\n@keyframes magic-bento-wait {\n  from {\n    opacity: 1;\n  }\n  to {\n    opacity: 0;\n  }\n}\n\n@keyframes magic-bento-run {\n  0% {\n    opacity: 0;\n  }\n  1%,\n  92% {\n    opacity: 1;\n  }\n  100% {\n    opacity: 0;\n  }\n}\n\n@keyframes magic-bento-spin {\n  to {\n    rotate: 360deg;\n  }\n}\n\n@keyframes magic-bento-check {\n  from {\n    opacity: 0;\n    scale: 0.4;\n  }\n  to {\n    opacity: 1;\n    scale: 1;\n  }\n}\n\n@keyframes magic-bento-rail {\n  from {\n    transform: scaleY(0);\n  }\n  to {\n    transform: scaleY(1);\n  }\n}\n\n@keyframes magic-bento-packet {\n  0% {\n    top: var(--y);\n    left: var(--x);\n    opacity: 0;\n  }\n  15% {\n    opacity: 1;\n  }\n  80% {\n    opacity: 1;\n  }\n  100% {\n    top: 50%;\n    left: 50%;\n    opacity: 0;\n  }\n}\n\n@keyframes magic-bento-switch-track {\n  from {\n    background-color: var(--mb-line);\n  }\n  to {\n    background-color: rgb(var(--mb-accent-rgb));\n  }\n}\n\n@keyframes magic-bento-switch-knob {\n  from {\n    background: var(--mb-ink);\n    transform: none;\n  }\n  to {\n    background: var(--mb-accent-ink);\n    transform: translateX(10px);\n  }\n}\n\n@keyframes magic-bento-path-a {\n  0%,\n  100% {\n    translate: 0 0;\n  }\n  30% {\n    translate: 46px -18px;\n  }\n  62% {\n    translate: 12px 26px;\n  }\n}\n\n@keyframes magic-bento-path-b {\n  0%,\n  100% {\n    translate: 0 0;\n  }\n  35% {\n    translate: -40px 14px;\n  }\n  70% {\n    translate: -8px -22px;\n  }\n}\n";
  var injected = false;
  function inject() {
    if (injected || typeof document === 'undefined') return;
    injected = true;
    var el = document.createElement('style');
    el.setAttribute('data-magic-bento', '');
    el.textContent = CSS;
    document.head.appendChild(el);
  }

  var THEMES = {"dark": {"--mb-surface": "linear-gradient(180deg, #1a1820 0%, #121116 100%)", "--mb-edge": "rgba(255, 255, 255, 0.07)", "--mb-highlight": "rgba(255, 255, 255, 0.06)", "--mb-shadow": "0 24px 48px -28px rgba(0, 0, 0, 0.85), 0 8px 18px -12px rgba(0, 0, 0, 0.6)", "--mb-tile": "linear-gradient(180deg, #3a3644 0%, #27242f 100%)", "--mb-tile-edge": "rgba(255, 255, 255, 0.07)", "--mb-tile-highlight": "rgba(255, 255, 255, 0.12)", "--mb-tile-shadow": "0 4px 10px -4px rgba(0, 0, 0, 0.7)", "--mb-well": "rgba(255, 255, 255, 0.03)", "--mb-well-edge": "rgba(255, 255, 255, 0.06)", "--mb-ink": "#f4f4f5", "--mb-muted": "rgba(244, 244, 245, 0.6)", "--mb-faint": "rgba(244, 244, 245, 0.3)", "--mb-line": "rgba(244, 244, 245, 0.1)", "--mb-secondary": "#a1a1aa", "--mb-secondary-ink": "#121016", "--mb-cursor-stroke": "rgba(18, 16, 22, 0.9)", "--mb-ring": "rgba(18, 16, 22, 0.85)", "--mb-focus": "rgba(244, 244, 245, 0.5)", "--mb-glow-alpha": 0.85, "--mb-spot-alpha": 0.07}, "light": {"--mb-surface": "linear-gradient(180deg, #ffffff 0%, #f7f7f9 100%)", "--mb-edge": "rgba(24, 24, 27, 0.08)", "--mb-highlight": "rgba(255, 255, 255, 1)", "--mb-shadow": "0 24px 48px -30px rgba(24, 24, 27, 0.28), 0 8px 18px -14px rgba(24, 24, 27, 0.16)", "--mb-tile": "linear-gradient(180deg, #ffffff 0%, #f6f6f8 100%)", "--mb-tile-edge": "rgba(24, 24, 27, 0.08)", "--mb-tile-highlight": "rgba(255, 255, 255, 1)", "--mb-tile-shadow": "0 4px 10px -5px rgba(24, 24, 27, 0.22)", "--mb-well": "rgba(24, 24, 27, 0.025)", "--mb-well-edge": "rgba(24, 24, 27, 0.06)", "--mb-ink": "#18181b", "--mb-muted": "rgba(24, 24, 27, 0.6)", "--mb-faint": "rgba(24, 24, 27, 0.3)", "--mb-line": "rgba(24, 24, 27, 0.08)", "--mb-secondary": "#71717a", "--mb-secondary-ink": "#ffffff", "--mb-cursor-stroke": "#ffffff", "--mb-ring": "#ffffff", "--mb-focus": "rgba(24, 24, 27, 0.4)", "--mb-glow-alpha": 0.5, "--mb-spot-alpha": 0.035}};
  var INK = { dark: [244, 244, 245], light: [24, 24, 27] };
  var MIN_CELL = 150;
  var MIN_PAIR = 200;
  var STAGGER = 80;
  var TILT = 6;
  var MAGNET = 6;
  var REPLAY = new Set(['magic-bento-draw', 'magic-bento-fade', 'magic-bento-grow', 'magic-bento-pop', 'magic-bento-select', 'magic-bento-wait', 'magic-bento-run', 'magic-bento-check', 'magic-bento-rail', 'magic-bento-switch-track', 'magic-bento-switch-knob']);
  var FLOW = new Set(['magic-bento-wait', 'magic-bento-run', 'magic-bento-check', 'magic-bento-rail', 'magic-bento-fade']);

  var clamp = function (value, min, max) { return Math.min(max, Math.max(min, value)); };
  var parseRgb = function (value) {
    if (!value) return null;
    var text = String(value).trim();
    var hex = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(text);
    if (hex) {
      var full = hex[1].length === 3 ? hex[1].replace(/./g, function (d) { return d + d; }) : hex[1];
      return [0, 2, 4].map(function (i) { return parseInt(full.slice(i, i + 2), 16); });
    }
    var numbers = text.match(/[\d.]+/g);
    if (numbers && numbers.length >= 3) return numbers.slice(0, 3).map(function (n) { return Math.round(parseFloat(n)); });
    return null;
  };
  var inkFor = function (rgb) {
    var c = rgb.map(function (v) { return v / 255; });
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2] > 0.55 ? '#121016' : '#ffffff';
  };
  var finite = function (animation) {
    var timing = animation.effect && animation.effect.getTiming ? animation.effect.getTiming() : null;
    return timing ? timing.iterations !== Infinity : false;
  };
  var nameOf = function (animation) { return animation.animationName || ''; };

  window.MagicBento = function (mount, options) {
    var o = options || {};
    inject();
    var items = o.items || [];
    var columns = Math.max(1, Math.round(o.columns != null ? o.columns : 4));
    var cols = columns;
    var rowHeight = o.rowHeight != null ? o.rowHeight : 200;
    var gap = Math.max(0, o.gap != null ? o.gap : 12);
    var radius = o.radius != null ? o.radius : 20;
    var palette = o.theme === 'light' ? 'light' : 'dark';
    var glow = parseRgb(o.glowColor) || INK[palette];
    var accent = parseRgb(o.glowColor) || INK[palette];
    var enableBorderGlow = o.enableBorderGlow !== false;
    var enableSpotlight = o.enableSpotlight !== false;
    var spotlightRadius = Math.max(40, o.spotlightRadius != null ? o.spotlightRadius : 300);
    var enableStars = !!o.enableStars;
    var particleCount = clamp(Math.round(o.particleCount != null ? o.particleCount : 24), 0, 120);
    var enableTilt = o.enableTilt !== false;
    var enableMagnetism = !!o.enableMagnetism;
    var clickEffect = o.clickEffect !== false;
    var intro = o.intro !== false;
    var onItemClick = o.onItemClick || null;
    var textAutoHide = o.textAutoHide !== false;

    var root = document.createElement('div');
    root.className = 'magic-bento' + (o.className ? ' ' + o.className : '');
    if (textAutoHide) root.setAttribute('data-autohide', '');
    root.setAttribute('data-motion', '');
    if (intro) root.setAttribute('data-intro', '');
    var corner = Math.max(0, radius);
    var themeVars = THEMES[palette];
    Object.keys(themeVars).forEach(function (k) { root.style.setProperty(k, themeVars[k]); });
    root.style.setProperty('--mb-glow-rgb', glow.join(', '));
    root.style.setProperty('--mb-accent-rgb', accent.join(', '));
    root.style.setProperty('--mb-accent-ink', inkFor(accent));
    root.style.setProperty('--mb-radius', corner + 'px');
    root.style.setProperty('--mb-inner-radius', Math.round(clamp(corner * 0.5, 6, 12)) + 'px');
    root.style.setProperty('--mb-pad', Math.round(clamp(corner * 0.85, 14, 20)) + 'px');
    root.style.setProperty('--mb-spot-size', Math.max(40, spotlightRadius) + 'px');
    root.style.setProperty('--mb-border-size', Math.round(Math.max(40, spotlightRadius) * 0.75) + 'px');
    function applyGrid() {
      root.style.gridTemplateColumns = 'repeat(' + cols + ', minmax(0, 1fr))';
      root.style.gridAutoRows = cols === 1 ? 'minmax(' + rowHeight + 'px, auto)' : rowHeight + 'px';
      root.style.gap = gap + 'px';
    }
    applyGrid();

    var cellRefs = [], cardRefs = [], starRefs = [];
    items.forEach(function (entry, index) {
      var e = entry || {};
      var cell = document.createElement('div');
      cell.className = 'magic-bento__cell';
      cell.style.gridColumn = 'span ' + Math.min(cols, Math.max(1, Math.round(e.colSpan || 1)));
      cell.style.gridRow = 'span ' + Math.max(1, Math.round(e.rowSpan || 1));
      var clickable = Boolean(e.href || e.onClick || onItemClick);
      var card = document.createElement(e.href ? 'a' : 'div');
      card.className = 'magic-bento__card';
      if (clickable) card.setAttribute('data-clickable', '');
      if (e.href) { card.setAttribute('href', e.href); if (e.target) card.setAttribute('target', e.target); if (e.rel) card.setAttribute('rel', e.rel); }
      else if (clickable) { card.setAttribute('role', 'button'); card.setAttribute('tabindex', '0'); if (e.title) card.setAttribute('aria-label', e.title); }
      if (e.image) {
        var img = document.createElement('img');
        img.className = 'magic-bento__image';
        img.src = e.image; img.alt = ''; img.draggable = false;
        card.appendChild(img);
        var scrim = document.createElement('span');
        scrim.className = 'magic-bento__scrim';
        card.appendChild(scrim);
      }
      if (enableSpotlight) { var light = document.createElement('span'); light.className = 'magic-bento__light'; card.appendChild(light); }
      var star = null;
      if (enableStars) {
        star = document.createElement('canvas');
        star.className = 'magic-bento__stars';
        star.setAttribute('aria-hidden', 'true');
        card.appendChild(star);
        starRefs[index] = star;
      }
      var content = document.createElement('div');
      content.className = 'magic-bento__content';
      if (e.content) content.innerHTML = e.content;
      else {
        var header = '';
        if (e.icon || e.label) {
          header += '<div class="magic-bento__header">' + (e.icon ? '<span class="magic-bento__icon">' + e.icon + '</span>' : '') + (e.label ? '<span class="magic-bento__label">' + e.label + '</span>' : '') + '</div>';
        }
        var text = (e.title || e.description) ?
          '<div class="magic-bento__text">' + (e.title ? '<h3 class="magic-bento__title">' + e.title + '</h3>' : '') + (e.description ? '<p class="magic-bento__description">' + e.description + '</p>' : '') + '</div>' : '';
        content.innerHTML = header + text;
      }
      card.appendChild(content);
      var rim = document.createElement('span'); rim.className = 'magic-bento__rim'; card.appendChild(rim);
      var border = document.createElement('span'); border.className = 'magic-bento__border'; card.appendChild(border);
      cell.appendChild(card);
      root.appendChild(cell);
      cellRefs[index] = cell;
      cardRefs[index] = card;
      card.addEventListener('click', (function (i, en, c) {
        return function (event) {
          if (en.onClick) en.onClick(event);
          if (onItemClick) onItemClick(en, i);
        };
      })(index, e, card));
    });
    mount.appendChild(root);

    // ---- engine ----
    var pointer = { x: -1e5, y: -1e5, inside: false, down: -1 };
    var light = { x: -1e5, y: -1e5, near: 0, ready: false };
    var states = [];
    var wave = { x: 0, y: 0, t: -1, duration: 1.1, reach: 800 };
    var rects = [], bounds = null;
    var dirty = true, raf = 0, last = 0, visible = true;
    var entered = !intro, settleTimer = 0, introTimer = 0;
    var lastFlow = [];
    var alive = true;

    function stateFor(index) {
      if (!states[index]) {
        states[index] = { hot: 0, rx: 0, ry: 0, tx: 0, ty: 0, vrx: 0, vry: 0, vtx: 0, vty: 0, press: 1, vpress: 0, stars: 0, particles: null, active: false, written: {} };
      }
      return states[index];
    }
    function write(element, state, name, value) {
      if (state.written[name] === value) return;
      state.written[name] = value;
      element.style.setProperty(name, value);
    }
    function measure() {
      dirty = false;
      bounds = root.getBoundingClientRect();
      rects = cellRefs.map(function (cell) { return cell ? cell.getBoundingClientRect() : null; });
      var ratio = Math.min(window.devicePixelRatio || 1, 2);
      starRefs.forEach(function (canvas, index) {
        var rect = rects[index];
        if (!canvas || !rect) return;
        var width = Math.max(1, Math.round(rect.width * ratio));
        var height = Math.max(1, Math.round(rect.height * ratio));
        if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      });
    }
    function seed(index, rect) {
      var state = stateFor(index);
      if (state.particles && state.particles.length === particleCount) return state.particles;
      state.particles = Array.from({ length: particleCount }, function () {
        return { x: Math.random() * rect.width, y: Math.random() * rect.height, vx: (Math.random() - 0.5) * 6, vy: -4 - Math.random() * 10, size: 0.6 + Math.random() * 1.1, phase: Math.random() * Math.PI * 2, rate: 1.2 + Math.random() * 2.4 };
      });
      return state.particles;
    }
    function drawStars(index, rect, state, lx, ly, dt, now) {
      var canvas = starRefs[index];
      if (!canvas) return;
      var context = canvas.getContext('2d');
      if (!context) return;
      var ratio = canvas.width / Math.max(1, rect.width);
      context.setTransform(1, 0, 0, 1, 0, 0);
      context.clearRect(0, 0, canvas.width, canvas.height);
      if (state.stars < 0.004) return;
      var reach = spotlightRadius * 0.75;
      var r = glow[0], g = glow[1], b = glow[2];
      context.setTransform(ratio, 0, 0, ratio, 0, 0);
      var particles = seed(index, rect);
      particles.forEach(function (particle) {
        particle.x += particle.vx * dt;
        particle.y += particle.vy * dt;
        if (particle.y < -4) { particle.y = rect.height + 4; particle.x = Math.random() * rect.width; }
        if (particle.x < -4) particle.x = rect.width + 4;
        if (particle.x > rect.width + 4) particle.x = -4;
        var distance = Math.hypot(particle.x - lx, particle.y - ly) / reach;
        if (distance >= 1) return;
        var falloff = 1 - distance * distance * (3 - 2 * distance);
        var twinkle = 0.55 + 0.45 * Math.sin(now * 0.001 * particle.rate + particle.phase);
        var alpha = state.stars * falloff * twinkle;
        if (alpha < 0.01) return;
        context.fillStyle = 'rgba(' + r + ',' + g + ',' + b + ',' + alpha.toFixed(3) + ')';
        context.beginPath();
        context.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        context.fill();
      });
    }
    function replay(card, filter) {
      if (!card.getAnimations) return;
      card.getAnimations({ subtree: true }).forEach(function (animation) {
        if (!filter.has(nameOf(animation)) || !finite(animation)) return;
        var target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
        if (target instanceof Element && target.classList.contains('magic-bento__cursor')) return;
        animation.currentTime = 0;
        animation.play();
      });
    }
    function startWave(x, y, duration) {
      if (!bounds) return;
      wave.x = x; wave.y = y; wave.t = 0; wave.duration = duration;
      wave.reach = Math.max(
        Math.hypot(x - bounds.left, y - bounds.top),
        Math.hypot(x - bounds.right, y - bounds.top),
        Math.hypot(x - bounds.left, y - bounds.bottom),
        Math.hypot(x - bounds.right, y - bounds.bottom)
      ) + 140;
    }

    function frame(now) {
      raf = 0;
      if (!alive) return;
      var dt = Math.min(0.05, (now - last) / 1000 || 0);
      last = now;
      if (dirty) measure();
      var busy = false;
      var margin = spotlightRadius * 0.5;
      var near = pointer.inside && bounds &&
        pointer.x > bounds.left - margin && pointer.x < bounds.right + margin &&
        pointer.y > bounds.top - margin && pointer.y < bounds.bottom + margin ? 1 : 0;
      if (!light.ready && near) { light.x = pointer.x; light.y = pointer.y; light.ready = true; }
      var follow = 1 - Math.exp(-dt / 0.05);
      light.x += (pointer.x - light.x) * follow;
      light.y += (pointer.y - light.y) * follow;
      var fade = 1 - Math.exp(-dt / (near > light.near ? 0.12 : 0.4));
      light.near += (near - light.near) * fade;
      if (Math.abs(near - light.near) < 0.002) light.near = near; else busy = true;
      if (Math.abs(pointer.x - light.x) + Math.abs(pointer.y - light.y) > 0.3) busy = true;

      var waveRadius = 0, waveAlpha = 0;
      if (wave.t >= 0) {
        wave.t += dt;
        var progress = Math.min(1, wave.t / wave.duration);
        waveRadius = wave.reach * (1 - Math.pow(1 - progress, 2.2));
        waveAlpha = Math.pow(1 - progress, 1.3);
        if (progress >= 1) { wave.t = -1; waveAlpha = 0; } else busy = true;
      }

      cardRefs.forEach(function (card, index) {
        var rect = rects[index];
        if (!card || !rect) return;
        var state = stateFor(index);
        var lx = light.x - rect.left;
        var ly = light.y - rect.top;
        var px = pointer.x - rect.left;
        var py = pointer.y - rect.top;
        var inside = pointer.inside && entered && px >= 0 && py >= 0 && px <= rect.width && py <= rect.height;
        if (inside !== state.active) {
          state.active = inside;
          if (inside) {
            card.setAttribute('data-active', '');
            if (now - (lastFlow[index] || -1e9) > 3200 && card.querySelector('.magic-bento__steps')) {
              lastFlow[index] = now;
              replay(card, FLOW);
            }
          } else card.removeAttribute('data-active');
        }
        var hotTarget = inside && enableSpotlight ? 1 : 0;
        state.hot += (hotTarget - state.hot) * (1 - Math.exp(-dt / (hotTarget > state.hot ? 0.14 : 0.32)));
        if (Math.abs(hotTarget - state.hot) < 0.002) state.hot = hotTarget; else busy = true;

        var u = clamp(px / Math.max(1, rect.width), 0, 1) - 0.5;
        var v = clamp(py / Math.max(1, rect.height), 0, 1) - 0.5;
        var tilt = inside && enableTilt;
        var magnet = inside && enableMagnetism;
        var targets = [tilt ? -v * 2 * TILT : 0, tilt ? u * 2 * TILT : 0, magnet ? u * 2 * MAGNET : 0, magnet ? v * 2 * MAGNET : 0];
        var keys = [['rx', 'vrx'], ['ry', 'vry'], ['tx', 'vtx'], ['ty', 'vty']];
        var steps = Math.max(1, Math.ceil(dt / (1 / 240)));
        var h = dt / steps;
        keys.forEach(function (kv, k) {
          for (var step = 0; step < steps; step++) {
            state[kv[1]] += (170 * (targets[k] - state[kv[0]]) - 20 * state[kv[1]]) * h;
            state[kv[0]] += state[kv[1]] * h;
          }
          if (Math.abs(targets[k] - state[kv[0]]) < 0.002 && Math.abs(state[kv[1]]) < 0.01) {
            state[kv[0]] = targets[k]; state[kv[1]] = 0;
          } else busy = true;
        });
        var pressTarget = pointer.down === index && clickEffect ? 0.985 : 1;
        for (var sp = 0; sp < steps; sp++) {
          state.vpress += (420 * (pressTarget - state.press) - 28 * state.vpress) * h;
          state.press += state.vpress * h;
        }
        if (Math.abs(pressTarget - state.press) < 0.0002 && Math.abs(state.vpress) < 0.001) {
          state.press = pressTarget; state.vpress = 0;
        } else busy = true;

        write(card, state, '--mb-x', lx.toFixed(1) + 'px');
        write(card, state, '--mb-y', ly.toFixed(1) + 'px');
        write(card, state, '--mb-near', (enableBorderGlow ? light.near : 0).toFixed(3));
        write(card, state, '--mb-hot', state.hot.toFixed(3));
        write(card, state, '--mb-rx', state.rx.toFixed(3) + 'deg');
        write(card, state, '--mb-ry', state.ry.toFixed(3) + 'deg');
        write(card, state, '--mb-tx', state.tx.toFixed(2) + 'px');
        write(card, state, '--mb-ty', state.ty.toFixed(2) + 'px');
        write(card, state, '--mb-press', state.press.toFixed(4));
        write(card, state, '--mb-wx', (wave.x - rect.left).toFixed(1) + 'px');
        write(card, state, '--mb-wy', (wave.y - rect.top).toFixed(1) + 'px');
        write(card, state, '--mb-wr', waveRadius.toFixed(1) + 'px');
        write(card, state, '--mb-wa', waveAlpha.toFixed(3));

        if (enableStars && starRefs[index]) {
          var starTarget = inside ? 1 : 0;
          state.stars += (starTarget - state.stars) * (1 - Math.exp(-dt / (starTarget ? 0.3 : 0.5)));
          if (state.stars < 0.004 && !starTarget) state.stars = 0;
          if (state.stars > 0 || starTarget) {
            drawStars(index, rect, state, lx, ly, dt, now);
            state.drawn = true;
            busy = true;
          } else if (state.drawn) {
            drawStars(index, rect, state, lx, ly, dt, now);
            state.drawn = false;
          }
        }
      });

      if (busy && visible && alive) raf = requestAnimationFrame(frame);
    }
    function wake() {
      if (raf || !visible || !alive) return;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }

    function cardIndex(target) {
      if (!(target instanceof Element)) return -1;
      var card = target.closest('.magic-bento__card');
      return card instanceof HTMLElement ? cardRefs.indexOf(card) : -1;
    }
    function onPointerMove(event) {
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.inside = true;
      wake();
    }
    function onPointerOut(event) {
      if (event.relatedTarget) return;
      pointer.inside = false; pointer.down = -1;
      wake();
    }
    function onPointerDown(event) {
      pointer.x = event.clientX; pointer.y = event.clientY; pointer.inside = true;
      pointer.down = cardIndex(event.target);
      wake();
    }
    function release() {
      if (pointer.down < 0) return;
      pointer.down = -1;
      wake();
    }
    function activate(index, x, y) {
      var card = cardRefs[index];
      if (!card) return;
      if (clickEffect) {
        if (dirty) measure();
        startWave(x, y, 1.1);
        replay(card, REPLAY);
        lastFlow[index] = performance.now();
      }
      wake();
    }
    function onClick(event) {
      var index = cardIndex(event.target);
      var card = cardRefs[index];
      if (!card) return;
      if (event.detail === 0) {
        var rect = card.getBoundingClientRect();
        activate(index, rect.left + rect.width / 2, rect.top + rect.height / 2);
      } else activate(index, event.clientX, event.clientY);
    }
    function onKeyDown(event) {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      var card = cardRefs[cardIndex(event.target)];
      if (!card || event.target !== card || card.tagName === 'A') return;
      event.preventDefault();
      card.click();
    }
    function onScrollHandler() { dirty = true; wake(); }

    var resizeObserver = new ResizeObserver(function () {
      var width = root.clientWidth;
      var cell = function (count) { return (width - gap * (count - 1)) / count; };
      var next = cell(columns) >= MIN_CELL ? columns : columns >= 2 && cell(2) >= MIN_PAIR ? 2 : 1;
      if (next !== cols) {
        cols = next;
        applyGrid();
        cellRefs.forEach(function (cellEl, index) {
          if (cellEl) cellEl.style.gridColumn = 'span ' + Math.min(cols, Math.max(1, Math.round((items[index] && items[index].colSpan) || 1)));
        });
      }
      dirty = true;
      wake();
    });
    resizeObserver.observe(root);

    function enter() {
      entered = true;
      var order = 0;
      cellRefs.forEach(function (cell) {
        if (!cell) return;
        cell.style.setProperty('--mb-delay', (order++ * STAGGER) + 'ms');
        cell.setAttribute('data-state', 'in');
      });
      if (dirty) measure();
      introTimer = window.setTimeout(function () {
        if (bounds) startWave(bounds.left, bounds.top, 1.7);
        wake();
      }, 260);
      settleTimer = window.setTimeout(function () {
        cellRefs.forEach(function (cell) { if (cell) cell.style.setProperty('--mb-delay', '0ms'); });
      }, order * STAGGER + 2600);
      wake();
    }

    var gate = null;
    if (intro && typeof IntersectionObserver !== 'undefined') {
      gate = new IntersectionObserver(function (entries, observer) {
        if (!entries.some(function (entry) { return entry.isIntersecting; })) return;
        observer.disconnect();
        enter();
      }, { threshold: 0.15 });
      gate.observe(root);
    } else {
      cellRefs.forEach(function (cell) {
        if (!cell) return;
        cell.style.setProperty('--mb-delay', '0ms');
        cell.setAttribute('data-state', 'in');
      });
    }

    var visibility = new IntersectionObserver(function (entries) {
      visible = entries.some(function (entry) { return entry.isIntersecting; });
      if (visible) { dirty = true; wake(); }
    });
    visibility.observe(root);

    window.addEventListener('pointermove', onPointerMove, { passive: true });
    window.addEventListener('pointerdown', onPointerDown, { passive: true });
    window.addEventListener('pointerup', release, { passive: true });
    window.addEventListener('pointercancel', release, { passive: true });
    window.addEventListener('scroll', onScrollHandler, { passive: true, capture: true });
    window.addEventListener('resize', onScrollHandler, { passive: true });
    document.addEventListener('pointerout', onPointerOut);
    root.addEventListener('click', onClick);
    root.addEventListener('keydown', onKeyDown);

    return {
      el: root,
      sync: function () {
        cellRefs.forEach(function (cell) {
          if (!cell || (!entered && intro)) return;
          if (cell.getAttribute('data-state') !== 'in') {
            cell.style.setProperty('--mb-delay', '0ms');
            cell.setAttribute('data-state', 'in');
          }
        });
        dirty = true;
        wake();
      },
      destroy: function () {
        alive = false;
        cancelAnimationFrame(raf);
        window.clearTimeout(settleTimer);
        window.clearTimeout(introTimer);
        if (gate) gate.disconnect();
        visibility.disconnect();
        resizeObserver.disconnect();
        window.removeEventListener('pointermove', onPointerMove);
        window.removeEventListener('pointerdown', onPointerDown);
        window.removeEventListener('pointerup', release);
        window.removeEventListener('pointercancel', release);
        window.removeEventListener('scroll', onScrollHandler, { capture: true });
        window.removeEventListener('resize', onScrollHandler);
        document.removeEventListener('pointerout', onPointerOut);
        root.removeEventListener('click', onClick);
        root.removeEventListener('keydown', onKeyDown);
        root.remove();
      }
    };
  };
})();
