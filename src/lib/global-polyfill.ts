// Global polyfill for DOMMatrix required by pdf-parse
import { DOMMatrix, DOMPoint } from 'canvas'

// @ts-ignore
if (typeof globalThis.DOMMatrix === 'undefined') {
  // @ts-ignore
  globalThis.DOMMatrix = DOMMatrix
}

// @ts-ignore
if (typeof globalThis.DOMPoint === 'undefined') {
  // @ts-ignore
  globalThis.DOMPoint = DOMPoint
}

export {}
