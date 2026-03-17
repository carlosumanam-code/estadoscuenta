// Polyfill for DOMMatrix and other DOM APIs required by PDF libraries
import { DOMMatrix } from 'canvas'

// @ts-ignore
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-ignore
  globalThis.DOMMatrix = DOMMatrix
}

export {}
