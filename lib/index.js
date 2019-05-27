import devq from 'eagle-device-query'
import isTouchDevice from 'is-touch-device'
import emitEvent from './emit-event'
import './polyfill'

// 用于弹出元素的一些元素、属性名称常量
const POPUP_ATTR = 'eagle-popup'
const POPUP_ACTION_ATTR = 'popup-action'
const POPUP_TARGET_ATTR = 'popup-target'

const POPUP_SELECTOR = `[${POPUP_ATTR}]`
const POPUP_OPENED_SELECTOR = `[${POPUP_ATTR}=popup]`

const POPUP_OPEN_EVENT = 'popupopen'
const POPUP_CLOSE_EVENT = 'popupclose'

const POPUP_TRIGGER_EVENT = isTouchDevice() && devq.isMobile ? 'touchend' : 'mouseup'

let registered = false
let globalRegistration = document.__eagle_popup
if (globalRegistration) {
  registered = true
  console.warn('There are more than 1 SparrowPopup instances loaded !')
} else {
  globalRegistration = document.__eagle_popup = {
    activePopups: []
  }
}
const activePopups = globalRegistration.activePopups

function whileParent (el, callbackFn) {
  // this loop will handle the initial el
  while (el && el !== document && el !== document.body) {
    if (callbackFn(el) === false) return false
    el = el.parentNode
  }
}

function isMaskElement (el) {
  return el.matches('.modal-mask, [eagle-popup-mask]')
}

function isPopupElement (el) {
  return el.matches(POPUP_SELECTOR)
}

function getPopupAction (el) {
  return el.getAttribute(POPUP_ACTION_ATTR)
}

function getPopupTarget (el) {
  const selector = el.getAttribute(POPUP_TARGET_ATTR)
  return selector ? document.querySelector(selector) : undefined
}

function getParentGroup (el) {
  if (!el || !el.parentNode) return
  let popupEl = document.body
  whileParent(el, parent => {
    if (parent !== el && isMaskElement(parent)) {
      popupEl = parent
      return false
    }
  })
  return popupEl
}

function setPopupState (el, action, event, skipEmitEvent) {
  const isOpened = el.getAttribute(POPUP_ATTR) === 'popup'
  let popupState
  switch (action) {
    case 'open':
      if (!isOpened) popupState = 'popup'
      break
    case 'close':
      if (isOpened) popupState = ''
      break
    case 'toggle':
      popupState = isOpened ? '' : 'popup'
      break
  }
  if (popupState !== undefined) {
    if (skipEmitEvent || emitEvent(el, popupState === 'popup' ? POPUP_OPEN_EVENT : POPUP_CLOSE_EVENT) !== false) {
      el.setAttribute(POPUP_ATTR, popupState)
      const idx = activePopups.indexOf(el)
      const len = activePopups.length
      const isLastOne = len && idx === len - 1
      if (idx >= 0 && (popupState === '' || !isLastOne)) activePopups.splice(idx, 1)
      if (popupState === 'popup' && !isLastOne) activePopups.push(el)
      if (Object(event).originalTouchEvent) event.originalTouchEvent.preventDefault()
    }
  }
}

function deactiveChildren (popupEl) {
  popupEl.querySelectorAll(POPUP_OPENED_SELECTOR).forEach(childEl => setPopupState(childEl, 'close'))
}

function deactiveSiblings (parentEl, popupEl) {
  parentEl && parentEl.querySelectorAll(POPUP_OPENED_SELECTOR).forEach(sibling => {
    const ignore = whileParent(popupEl, el => el !== sibling) === false
    if (!ignore) setPopupState(sibling, 'close')
  })
}

function popupEventHandler (event) {
  // originalTouchEvent & originalTouchTarget are exported by eagle-claw
  const target = event.originalTouchTarget || event.target

  let action
  let popupEl
  const targetIsMask = isMaskElement(target)
  if (targetIsMask) {
    popupEl = target
    action = getPopupAction(target) || 'close'
  } else {
    whileParent(target, el => {
      if (isPopupElement(el)) {
        popupEl = el
        action = action || getPopupAction(el) || 'none'
      }
      if (!action) {
        action = getPopupAction(el)
        if (action) popupEl = getPopupTarget(el)
      }
      if (popupEl) return false
    })
  }
  targetIsMask ? deactiveChildren(popupEl) : deactiveSiblings(getParentGroup(target), popupEl)
  if (popupEl) setTimeout(() => setPopupState(popupEl, action, event), 10)
}

function isHTMLElement (target) {
  return target instanceof HTMLElement
}

function isString (target) {
  return Object.prototype.toString.call(target).toLowerCase() === '[object string]'
}

function queryTarget (target) {
  return isHTMLElement(target)
    ? target
    : (isString(target) ? document.querySelector(target) : null)
}

if (!registered) {
  document.addEventListener(POPUP_TRIGGER_EVENT, popupEventHandler)
  document.addEventListener('keyup', event => {
    if (event.keyCode === 27 && String(event.target.tagName).toLowerCase() !== 'input') {
      while (activePopups.length) {
        const el = activePopups[activePopups.length - 1]
        if (!el.querySelector(POPUP_OPENED_SELECTOR)) {
          setPopupState(el, 'close')
          return
        }
      }
    }
  })
}

export function show (target, skipEvent) {
  const el = queryTarget(target)
  setPopupState(el, 'open', null, skipEvent)
}

export function hide (target, skipEvent) {
  const el = queryTarget(target)
  setPopupState(el, 'close', null, skipEvent)
}

export function hideParent (el, skipEvent) {
  whileParent(el, pEl => {
    if (isPopupElement(pEl) && pEl.getAttribute(POPUP_ATTR) === 'popup') {
      setPopupState(el, 'close', null, skipEvent)
    }
  })
}

export function toggle (target, skipEvent) {
  const el = queryTarget(target)
  setPopupState(el, 'toggle', null, skipEvent)
}
