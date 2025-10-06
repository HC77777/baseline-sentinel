import postcss from 'postcss';
import { parse } from '@babel/parser';
// CORRECTED IMPORT: Import the module and handle the default export manually.
import _traverse, { NodePath } from '@babel/traverse';
import { isJsPropertyBaseline } from './baseline-engine.js';
import { features } from 'web-features';
import * as parse5 from 'parse5';

const traverse = (_traverse as any).default || _traverse;

// ==================================================================================
// 1. RICH DATA MODELS
// ==================================================================================

export type FeatureType = 'css-property' | 'js-property';
export type FixType =
  | 'add-css-declaration'
  | 'replace-property'
  | 'remove-css-declaration'
  | 'add-comment-warning'
  | 'recommend-polyfill'
  | 'replace-css-declaration'
  | 'TODO';

/**
 * A Fix represents a single, concrete action to be taken to remediate a Finding.
 */
export interface Fix {
  type: FixType;
  description: string;
  payload: any; // e.g., { property: 'background-color', value: 'rgba(0, 0, 0, 0.5)' }
}

/**
 * A Remediation is a collection of one or more Fixes for a given web feature.
 */
export interface Remediation {
  featureId: string;
  fixes: Fix[];
}

/**
 * A Finding represents a single issue found in the source code.
 * It includes a reference to the fix that can resolve it.
 */
export interface Finding {
  featureId: string;
  type: FeatureType;
  message: string;
  line: number;
  column: number;
  endLine: number;
  endColumn: number;
  fixId: string; // Points to a key in the RemediationDatabase
  mdnUrl?: string; // Add a new optional property for the MDN URL
}

// ==================================================================================
// 2. REMEDIATION DATABASE (Expanded)
// ==================================================================================

// Import the large, generated dataset and merge with manual, high-quality overrides.
import { REMEDIATION_DATABASE as GENERATED_REMEDIATIONS } from './remediation-database.js';

const MANUAL_REMEDIATIONS: Record<string, Remediation> = {
  // --- CSS Properties ---

  'css.properties.backdrop-filter': {
    featureId: 'css.properties.backdrop-filter',
    fixes: [
      {
        type: 'add-css-declaration',
        description: "Add a fallback 'background-color' for unsupported browsers.",
        payload: { property: 'background-color', value: 'rgba(0, 0, 0, 0.5)' },
      },
    ],
  },
  'css.properties.animation-timeline': {
    featureId: 'css.properties.animation-timeline',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove non-Baseline 'animation-timeline' property.",
        payload: {},
      },
    ],
  },
  'css.properties.text-wrap': {
    featureId: 'css.properties.text-wrap',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'text-wrap: balance' as it has no fallback.",
        payload: {},
      },
    ],
  },
  'css.properties.color-mix': {
    featureId: 'css.properties.color-mix',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'color-mix()' needs a fallback.",
        payload: {
          message:
            "WARNING: 'color-mix()' is not Baseline. Provide a fallback color. (baseline-disable-next-line css.properties.color-mix)",
        },
      },
    ],
  },
  'css.properties.grid-template-rows': {
    featureId: 'css.properties.grid-template-rows',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'subgrid' has no simple fallback.",
        payload: {
          message: "WARNING: 'subgrid' is not Baseline and has no simple fallback. (baseline-disable-next-line css.properties.grid-template-rows)",
        },
      },
    ],
  },
  'css.properties.scroll-timeline-name': {
    featureId: 'css.properties.scroll-timeline-name',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove scroll-driven animation property, no fallback exists.",
        payload: {},
      },
    ],
  },
  'css.properties.view-transition-name': {
    featureId: 'css.properties.view-transition-name',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'view-transition-name' as it requires a polyfill.",
        payload: {},
      },
    ],
  },
  'css.properties.initial-letter': {
    featureId: 'css.properties.initial-letter',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'initial-letter' as it has no fallback.",
        payload: {},
      },
    ],
  },
  'css.properties.mask-image': {
    featureId: 'css.properties.mask-image',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove CSS masking property as it's not Baseline.",
        payload: {},
      },
    ],
  },
  'css.properties.offset-path': {
    featureId: 'css.properties.offset-path',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'offset-path' as it has no fallback.",
        payload: {},
      },
    ],
  },
  'css.properties.overscroll-behavior': {
    featureId: 'css.properties.overscroll-behavior',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'overscroll-behavior' for strict Baseline compliance.",
        payload: {},
      },
    ],
  },
  'css.properties.accent-color': {
    featureId: 'css.properties.accent-color',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'accent-color' for strict Baseline compliance.",
        payload: {},
      },
    ],
  },
  'css.properties.font-palette': {
    featureId: 'css.properties.font-palette',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'font-palette' as it's not Baseline.",
        payload: {},
      },
    ],
  },
  'css.properties.color-scheme': {
    featureId: 'css.properties.color-scheme',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'color-scheme' for strict Baseline compliance.",
        payload: {},
      },
    ],
  },
  'css.properties.scrollbar-gutter': {
    featureId: 'css.properties.scrollbar-gutter',
    fixes: [
      {
        type: 'remove-css-declaration',
        description: "Remove 'scrollbar-gutter' as it is not Baseline.",
        payload: {},
      },
    ],
  },
  'css.properties.color-adjust': {
    featureId: 'css.properties.color-adjust',
    fixes: [
      {
        type: 'replace-css-declaration',
        description: "Replace deprecated 'color-adjust' with 'print-color-adjust'.",
        payload: {
          newProperty: 'print-color-adjust',
        },
      },
    ],
  },
  'css.properties.aspect-ratio': {
    featureId: 'css.properties.aspect-ratio',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Acknowledge warning for 'aspect-ratio'.",
        payload: {
          message:
            "WARNING: 'aspect-ratio' is not Baseline. For a fallback, consider the 'padding-bottom' trick. (baseline-disable-next-line css.properties.aspect-ratio)",
        },
      },
    ],
  },
  'css.properties.position.sticky': {
      featureId: 'css.properties.position.sticky',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'position: sticky'.",
              payload: {
                  message: "WARNING: 'position: sticky' is not fully Baseline. Test thoroughly. (baseline-disable-next-line css.properties.position.sticky)"
              }
          }
      ]
  },
  'css.properties.mix-blend-mode': {
      featureId: 'css.properties.mix-blend-mode',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'mix-blend-mode'.",
              payload: {
                  message: "WARNING: 'mix-blend-mode' is not Baseline. Provide a fallback. (baseline-disable-next-line css.properties.mix-blend-mode)"
              }
          }
      ]
  },
  'css.properties.filter': {
      featureId: 'css.properties.filter',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for CSS filters.",
              payload: {
                  message: "WARNING: Complex CSS filters are not Baseline and may have performance implications. (baseline-disable-next-line css.properties.filter)"
              }
          }
      ]
  },
  'css.properties.clip-path': {
      featureId: 'css.properties.clip-path',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'clip-path'.",
              payload: {
                  message: "WARNING: 'clip-path' is not Baseline. Consider an SVG fallback. (baseline-disable-next-line css.properties.clip-path)"
              }
          }
      ]
  },
  'css.properties.scroll-snap-type': {
      featureId: 'css.properties.scroll-snap-type',
      fixes: [
          {
              type: 'remove-css-declaration',
              description: "Remove 'scroll-snap-type' as it is not Baseline.",
              payload: {}
          }
      ]
  },
  'css.properties.scroll-behavior': {
      featureId: 'css.properties.scroll-behavior',
      fixes: [
          {
              type: 'remove-css-declaration',
              description: "Remove 'scroll-behavior' as it is not Baseline.",
              payload: {}
          }
      ]
  },
  'css.properties.image-rendering': {
      featureId: 'css.properties.image-rendering',
      fixes: [
          {
              type: 'remove-css-declaration',
              description: "Remove 'image-rendering' as it is not Baseline and behavior varies.",
              payload: {}
          }
      ]
  },

  // --- CSS Functions & At-Rules ---

  'css.functions.oklch': {
    featureId: 'css.functions.oklch',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'oklch()' needs a fallback color.",
        payload: {
          message: "WARNING: 'oklch()' is not Baseline. Provide a fallback `rgba()` color. (baseline-disable-next-line css.functions.oklch)",
        },
      },
    ],
  },
  'css.functions.color-mix': {
    featureId: 'css.functions.color-mix',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'color-mix()' needs a fallback color.",
        payload: {
          message: "WARNING: 'color-mix()' is not Baseline. Provide a fallback color. (baseline-disable-next-line css.functions.color-mix)",
        },
      },
    ],
  },
  'css.functions.sin': {
    featureId: 'css.functions.sin',
    fixes: [
      {
        type: 'add-comment-warning',
        description: 'Warn that CSS trig functions need fallbacks.',
        payload: {
          message: 'WARNING: CSS trig functions are not Baseline. Provide a static fallback. (baseline-disable-next-line css.functions.sin)',
        },
      },
    ],
  },
  'css.functions.conic-gradient': {
      featureId: 'css.functions.conic-gradient',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'conic-gradient()'.",
              payload: {
                  message: "WARNING: 'conic-gradient()' is not Baseline. Provide a fallback image. (baseline-disable-next-line css.functions.conic-gradient)"
              }
          }
      ]
  },
  'css.functions.clamp': {
      featureId: 'css.functions.clamp',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'clamp()'.",
              payload: {
                  message: "WARNING: 'clamp()' is not Baseline. Provide a media query fallback. (baseline-disable-next-line css.functions.clamp)"
              }
          }
      ]
  },
  'css.at-rules.container': {
    featureId: 'css.at-rules.container',
    fixes: [
      {
        type: 'add-comment-warning',
        description: 'Warn that container queries are not Baseline.',
        payload: {
          message: 'WARNING: Container queries are not Baseline and have no fallback. (baseline-disable-next-line css.at-rules.container)',
        },
      },
    ],
  },
  'css.at-rules.property': {
    featureId: 'css.at-rules.property',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that '@property' is not Baseline.",
        payload: {
          message: 'WARNING: @property is not Baseline and has no fallback. (baseline-disable-next-line css.at-rules.property)',
        },
      },
    ],
  },

  // --- CSS Selectors ---

  'css.selectors.has': {
    featureId: 'css.selectors.has',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Acknowledge warning for ':has()' selector.",
        payload: {
          message:
            "WARNING: The :has() selector is not Baseline and has no fallback. (baseline-disable-next-line css.selectors.has)",
        },
      },
    ],
  },
  'css.selectors.focus-visible': {
      featureId: 'css.selectors.focus-visible',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for ':focus-visible'.",
              payload: {
                  message: "WARNING: ':focus-visible' is not Baseline. Consider a polyfill. (baseline-disable-next-line css.selectors.focus-visible)"
              }
          }
      ]
  },

  // --- JavaScript Properties & APIs ---

  'javascript.properties.keyCode': {
    featureId: 'javascript.properties.keyCode',
    fixes: [
      {
        type: 'replace-property',
        description: "Replace deprecated 'keyCode' with modern 'key' property.",
        payload: { old: 'keyCode', new: 'key' },
      },
    ],
  },
  'api.Object.hasOwn': {
    featureId: 'api.Object.hasOwn',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Object.hasOwn'.",
        payload: {
          message: "TIP: 'Object.hasOwn' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Object.hasOwn)",
        },
      },
    ],
  },
  'api.Array.at': {
    featureId: 'api.Array.at',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Array.prototype.at()'.",
        payload: {
          message: "TIP: 'Array.prototype.at()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Array.at)",
        },
      },
    ],
  },
  'api.structuredClone': {
    featureId: 'api.structuredClone',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'structuredClone'.",
        payload: {
          message: "TIP: 'structuredClone' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.structuredClone)",
        },
      },
    ],
  },
  'api.Promise.withResolvers': {
    featureId: 'api.Promise.withResolvers',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Promise.withResolvers'.",
        payload: {
          message: "TIP: 'Promise.withResolvers' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Promise.withResolvers)",
        },
      },
    ],
  },
  'api.Temporal': {
    featureId: 'api.Temporal',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for the 'Temporal' API.",
        payload: {
          message: "TIP: The 'Temporal' API is not Baseline. Consider the 'temporal-polyfill'. (baseline-disable-next-line api.Temporal)",
        },
      },
    ],
  },
  'api.Array.fromAsync': {
    featureId: 'api.Array.fromAsync',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Array.fromAsync'.",
        payload: {
          message: "TIP: 'Array.fromAsync' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Array.fromAsync)",
        },
      },
    ],
  },
  'api.Intl.Segmenter': {
    featureId: 'api.Intl.Segmenter',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Intl.Segmenter'.",
        payload: {
          message: "TIP: 'Intl.Segmenter' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Intl.Segmenter)",
        },
      },
    ],
  },
  'api.ReadableStream': {
    featureId: 'api.ReadableStream',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Web Streams API'.",
        payload: {
          message:
            "TIP: The Web Streams API is not Baseline. Consider a polyfill. (baseline-disable-next-line api.ReadableStream)",
        },
      },
    ],
  },
  'api.WeakRef': {
    featureId: 'api.WeakRef',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'WeakRef'.",
        payload: {
          message: "TIP: 'WeakRef' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.WeakRef)",
        },
      },
    ],
  },
  'api.FinalizationRegistry': {
    featureId: 'api.FinalizationRegistry',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'FinalizationRegistry'.",
        payload: {
          message: "TIP: 'FinalizationRegistry' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.FinalizationRegistry)",
        },
      },
    ],
  },
  'api.Array.findLast': {
    featureId: 'api.Array.findLast',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Array.prototype.findLast()'.",
        payload: {
          message: "TIP: '.findLast()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Array.findLast)",
        },
      },
    ],
  },
  'api.Array.toReversed': {
    featureId: 'api.Array.toReversed',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Array.prototype.toReversed()'.",
        payload: {
          message: "TIP: '.toReversed()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Array.toReversed)",
        },
      },
    ],
  },
  'api.Array.toSorted': {
    featureId: 'api.Array.toSorted',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Array.prototype.toSorted()'.",
        payload: {
          message: "TIP: '.toSorted()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Array.toSorted)",
        },
      },
    ],
  },
  'api.Array.toSpliced': {
    featureId: 'api.Array.toSpliced',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Array.prototype.toSpliced()'.",
        payload: {
          message: "TIP: '.toSpliced()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Array.toSpliced)",
        },
      },
    ],
  },
  'api.Array.with': {
    featureId: 'api.Array.with',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Array.prototype.with()'.",
        payload: {
          message: "TIP: '.with()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Array.with)",
        },
      },
    ],
  },
  'api.Error.cause': {
    featureId: 'api.Error.cause',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Error.cause'.",
        payload: {
          message: "TIP: 'Error.cause' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Error.cause)",
        },
      },
    ],
  },
  'api.Navigator.requestMIDIAccess': {
    featureId: 'api.Navigator.requestMIDIAccess',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'Web MIDI API' requires feature detection.",
        payload: {
          message: 'WARNING: The Web MIDI API is not Baseline. Wrap calls in a feature detection block. (baseline-disable-next-line api.Navigator.requestMIDIAccess)',
        },
      },
    ],
  },
  'api.USB': {
    featureId: 'api.USB',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'WebUSB API' requires feature detection.",
        payload: {
          message:
            'WARNING: The WebUSB API is not Baseline. Wrap calls in a feature detection block. (baseline-disable-next-line api.USB)',
        },
      },
    ],
  },
  'api.Navigator.share': {
    featureId: 'api.Navigator.share',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'Web Share API' requires feature detection.",
        payload: {
          message: 'WARNING: The Web Share API is not Baseline. Wrap calls in a `if (navigator.share)` block. (baseline-disable-next-line api.Navigator.share)',
        },
      },
    ],
  },
  'api.WakeLock': {
    featureId: 'api.WakeLock',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'Screen Wake Lock API' requires feature detection.",
        payload: {
          message: 'WARNING: The Screen Wake Lock API is not Baseline. Wrap calls in a feature detection block. (baseline-disable-next-line api.WakeLock)',
        },
      },
    ],
  },
  'api.Navigator.getDisplayMedia': {
    featureId: 'api.Navigator.getDisplayMedia',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'getDisplayMedia' requires feature detection.",
        payload: {
          message:
            "WARNING: 'getDisplayMedia' is not Baseline. Wrap calls in a feature detection block. (baseline-disable-next-line api.Navigator.getDisplayMedia)",
        },
      },
    ],
  },
  'api.Blob.stream': {
    featureId: 'api.Blob.stream',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'Blob.stream()'.",
        payload: {
          message: "TIP: 'Blob.stream()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Blob.stream)",
        },
      },
    ],
  },
  'api.CompressionStream': {
    featureId: 'api.CompressionStream',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'CompressionStream'.",
        payload: {
          message: "TIP: 'CompressionStream' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.CompressionStream)",
        },
      },
    ],
  },
  'api.CSSContainerRule': {
    featureId: 'api.CSSContainerRule',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'CSS Container Queries API'.",
        payload: {
          message: 'TIP: The CSS Container Queries API is not Baseline. Consider a polyfill. (baseline-disable-next-line api.CSSContainerRule)',
        },
      },
    ],
  },
  'api.EyeDropper': {
    featureId: 'api.EyeDropper',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'EyeDropper API' requires feature detection.",
        payload: {
          message: "WARNING: The 'EyeDropper' API is not Baseline. Wrap in a feature detection block. (baseline-disable-next-line api.EyeDropper)",
        },
      },
    ],
  },
  'api.FileSystemDirectoryHandle': {
    featureId: 'api.FileSystemDirectoryHandle',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'File System Access API' is not Baseline.",
        payload: {
          message: 'WARNING: The File System Access API is not Baseline. Wrap in a feature detection block. (baseline-disable-next-line api.FileSystemDirectoryHandle)',
        },
      },
    ],
  },
  'api.HTMLSelectElement.showPicker': {
    featureId: 'api.HTMLSelectElement.showPicker',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'showPicker()' is not Baseline.",
        payload: {
          message: "WARNING: 'select.showPicker()' is not Baseline. Wrap in a feature detection block. (baseline-disable-next-line api.HTMLSelectElement.showPicker)",
        },
      },
    ],
  },
  'api.IdleDetector': {
    featureId: 'api.IdleDetector',
    fixes: [
      {
        type: 'add-comment-warning',
        description: "Warn that 'Idle Detection API' is not Baseline.",
        payload: {
          message: "WARNING: The 'Idle Detection API' is not Baseline. Wrap in a feature detection block. (baseline-disable-next-line api.IdleDetector)",
        },
      },
    ],
  },
  'api.IntersectionObserver': {
    featureId: 'api.IntersectionObserver',
    fixes: [
      {
        type: 'recommend-polyfill',
        description: "Recommend polyfill for 'IntersectionObserver'.",
        payload: {
          message:
            "TIP: 'IntersectionObserver' is not fully Baseline. Consider a polyfill. (baseline-disable-next-line api.IntersectionObserver)",
        },
      },
    ],
  },
  'api.ResizeObserver': {
      featureId: 'api.ResizeObserver',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'ResizeObserver'.",
              payload: {
                  message: "TIP: 'ResizeObserver' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.ResizeObserver)"
              }
          }
      ]
  },
  'api.globalThis': {
      featureId: 'api.globalThis',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'globalThis'.",
              payload: {
                  message: "TIP: 'globalThis' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.globalThis)"
              }
          }
      ]
  },
  'api.Promise.any': {
      featureId: 'api.Promise.any',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'Promise.any'.",
              payload: {
                  message: "TIP: 'Promise.any' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Promise.any)"
              }
          }
      ]
  },
  'api.Promise.allSettled': {
      featureId: 'api.Promise.allSettled',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'Promise.allSettled'.",
              payload: {
                  message: "TIP: 'Promise.allSettled' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Promise.allSettled)"
              }
          }
      ]
  },
  'api.String.matchAll': {
      featureId: 'api.String.matchAll',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'String.prototype.matchAll'.",
              payload: {
                  message: "TIP: '.matchAll()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.String.matchAll)"
              }
          }
      ]
  },
  'api.String.replaceAll': {
      featureId: 'api.String.replaceAll',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'String.prototype.replaceAll'.",
              payload: {
                  message: "TIP: '.replaceAll()' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.String.replaceAll)"
              }
          }
      ]
  },
  'api.BigInt': {
      featureId: 'api.BigInt',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Acknowledge warning for 'BigInt'.",
              payload: {
                  message: "TIP: 'BigInt' is not Baseline and cannot be polyfilled. Check for browser support. (baseline-disable-next-line api.BigInt)"
              }
          }
      ]
  },
  'api.Object.fromEntries': {
      featureId: 'api.Object.fromEntries',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'Object.fromEntries'.",
              payload: {
                  message: "TIP: 'Object.fromEntries' is not Baseline. Consider a polyfill. (baseline-disable-next-line api.Object.fromEntries)"
              }
          }
      ]
  },
  'api.Array.flat': {
      featureId: 'api.Array.flat',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'Array.prototype.flat()'.",
              payload: {
                  message: "TIP: '.flat()' and '.flatMap()' are not Baseline. Consider a polyfill. (baseline-disable-next-line api.Array.flat)"
              }
          }
      ]
  },
  'api.Symbol': {
      featureId: 'api.Symbol',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'Symbol'.",
              payload: {
                  message: "TIP: 'Symbol' is not fully Baseline. Consider a polyfill. (baseline-disable-next-line api.Symbol)"
              }
          }
      ]
  },
  'api.Map': {
      featureId: 'api.Map',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'Map'.",
              payload: {
                  message: "TIP: 'Map' is not fully Baseline. Consider a polyfill. (baseline-disable-next-line api.Map)"
              }
          }
      ]
  },
  'api.Set': {
      featureId: 'api.Set',
      fixes: [
          {
              type: 'recommend-polyfill',
              description: "Recommend polyfill for 'Set'.",
              payload: {
                  message: "TIP: 'Set' is not fully Baseline. Consider a polyfill. (baseline-disable-next-line api.Set)"
              }
          }
      ]
  },
  'api.navigator.clipboard': {
      featureId: 'api.navigator.clipboard',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Clipboard API'.",
              payload: {
                  message: "WARNING: The Clipboard API is not Baseline. Wrap calls in feature detection and handle permissions. (baseline-disable-next-line api.navigator.clipboard)"
              }
          }
      ]
  },
  'api.navigator.connection': {
      featureId: 'api.navigator.connection',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Network Information API'.",
              payload: {
                  message: "WARNING: The Network Information API is not Baseline. Wrap calls in feature detection. (baseline-disable-next-line api.navigator.connection)"
              }
          }
      ]
  },
  'api.navigator.credentials': {
      featureId: 'api.navigator.credentials',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Credential Management API'.",
              payload: {
                  message: "WARNING: The Credential Management API is not Baseline. Wrap calls in feature detection. (baseline-disable-next-line api.navigator.credentials)"
              }
          }
      ]
  },
  'api.navigator.geolocation': {
      featureId: 'api.navigator.geolocation',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Geolocation API'.",
              payload: {
                  message: "WARNING: The Geolocation API is not Baseline and requires user permission. Handle errors gracefully. (baseline-disable-next-line api.navigator.geolocation)"
              }
          }
      ]
  },
  'api.navigator.mediaDevices': {
      featureId: 'api.navigator.mediaDevices',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'MediaDevices API'.",
              payload: {
                  message: "WARNING: 'navigator.mediaDevices' is not Baseline and requires user permission. Handle errors gracefully. (baseline-disable-next-line api.navigator.mediaDevices)"
              }
          }
      ]
  },
  'api.navigator.serviceWorker': {
      featureId: 'api.navigator.serviceWorker',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Service Worker API'.",
              payload: {
                  message: "WARNING: The Service Worker API is not Baseline. Check for 'serviceWorker' in 'navigator'. (baseline-disable-next-line api.navigator.serviceWorker)"
              }
          }
      ]
  },
  'api.localStorage': {
      featureId: 'api.localStorage',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'localStorage'.",
              payload: {
                  message: "WARNING: 'localStorage' can be disabled by users. Wrap access in a try-catch block. (baseline-disable-next-line api.localStorage)"
              }
          }
      ]
  },
  'api.sessionStorage': {
      featureId: 'api.sessionStorage',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'sessionStorage'.",
              payload: {
                  message: "WARNING: 'sessionStorage' can be disabled by users. Wrap access in a try-catch block. (baseline-disable-next-line api.sessionStorage)"
              }
          }
      ]
  },
  'api.Worker': {
      featureId: 'api.Worker',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Web Workers'.",
              payload: {
                  message: "WARNING: Web Workers are not fully Baseline. Check for 'Worker' on the window object. (baseline-disable-next-line api.Worker)"
              }
          }
      ]
  },
  'api.WebSocket': {
      featureId: 'api.WebSocket',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'WebSockets'.",
              payload: {
                  message: "WARNING: WebSockets are not fully Baseline. Check for 'WebSocket' on the window object. (baseline-disable-next-line api.WebSocket)"
              }
          }
      ]
  },
  'api.PaymentRequest': {
      featureId: 'api.PaymentRequest',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Payment Request API'.",
              payload: {
                  message: "WARNING: The Payment Request API is not Baseline. Check for 'PaymentRequest' on the window object. (baseline-disable-next-line api.PaymentRequest)"
              }
          }
      ]
  },
  'api.RTCPeerConnection': {
      featureId: 'api.RTCPeerConnection',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'WebRTC'.",
              payload: {
                  message: "WARNING: WebRTC is not Baseline. Check for 'RTCPeerConnection' on the window object. (baseline-disable-next-line api.RTCPeerConnection)"
              }
          }
      ]
  },
  'api.Element.requestFullscreen': {
      featureId: 'api.Element.requestFullscreen',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Fullscreen API'.",
              payload: {
                  message: "WARNING: The Fullscreen API is not Baseline. Check for vendor prefixes. (baseline-disable-next-line api.Element.requestFullscreen)"
              }
          }
      ]
  },
  'api.Navigator.vibrate': {
      featureId: 'api.Navigator.vibrate',
      fixes: [
          {
              type: 'add-comment-warning',
              description: "Acknowledge warning for 'Vibration API'.",
              payload: {
                  message: "WARNING: The Vibration API is not Baseline. Check for 'vibrate' in 'navigator'. (baseline-disable-next-line api.Navigator.vibrate)"
              }
          }
      ]
  },
};

/**
 * HTML-specific manual remediations for deprecated elements and attributes
 */
const HTML_REMEDIATIONS: Record<string, Remediation> = {
  // Deprecated HTML Elements
  'html.elements.marquee': {
    featureId: 'html.elements.marquee',
    fixes: [{
      type: 'add-comment-warning',
      description: 'Marquee element is deprecated',
      payload: { message: 'WARNING: <marquee> is deprecated. Use CSS animations instead. (baseline-disable-next-line html.elements.marquee)' }
    }]
  },
  'html.elements.blink': {
    featureId: 'html.elements.blink',
    fixes: [{
      type: 'add-comment-warning',
      description: 'Blink element is deprecated',
      payload: { message: 'WARNING: <blink> is deprecated. Use CSS animations instead. (baseline-disable-next-line html.elements.blink)' }
    }]
  },
  'html.elements.center': {
    featureId: 'html.elements.center',
    fixes: [{
      type: 'add-comment-warning',
      description: 'Center element is deprecated',
      payload: { message: 'WARNING: <center> is deprecated. Use CSS text-align instead. (baseline-disable-next-line html.elements.center)' }
    }]
  },
  'html.elements.font': {
    featureId: 'html.elements.font',
    fixes: [{
      type: 'add-comment-warning',
      description: 'Font element is deprecated',
      payload: { message: 'WARNING: <font> is deprecated. Use CSS font properties instead. (baseline-disable-next-line html.elements.font)' }
    }]
  },
  
  // Modern HTML Elements (Not Baseline)
  'html.elements.dialog': {
    featureId: 'html.elements.dialog',
    fixes: [{
      type: 'recommend-polyfill',
      description: 'Dialog element polyfill',
      payload: { message: 'Consider using dialog-polyfill for <dialog> support. (baseline-disable-next-line html.elements.dialog)' }
    }]
  },
  
  // HTML Attributes
  'html.global_attributes.popover': {
    featureId: 'html.global_attributes.popover',
    fixes: [{
      type: 'recommend-polyfill',
      description: 'Popover attribute is not Baseline',
      payload: { message: 'WARNING: popover attribute is not Baseline. Consider fallback UI. (baseline-disable-next-line html.global_attributes.popover)' }
    }]
  },
  'html.global_attributes.inert': {
    featureId: 'html.global_attributes.inert',
    fixes: [{
      type: 'recommend-polyfill',
      description: 'Inert attribute polyfill',
      payload: { message: 'Consider using wicg-inert polyfill for inert attribute. (baseline-disable-next-line html.global_attributes.inert)' }
    }]
  },
  'html.elements.input.type_date': {
    featureId: 'html.elements.input.type_date',
    fixes: [{
      type: 'recommend-polyfill',
      description: 'Date input polyfill',
      payload: { message: 'Consider using a date picker polyfill for <input type="date">. (baseline-disable-next-line html.elements.input.type_date)' }
    }]
  },
  'html.elements.input.type_color': {
    featureId: 'html.elements.input.type_color',
    fixes: [{
      type: 'recommend-polyfill',
      description: 'Color input polyfill',
      payload: { message: 'Consider using a color picker polyfill for <input type="color">. (baseline-disable-next-line html.elements.input.type_color)' }
    }]
  },
  
  // Loading attribute
  'html.elements.img.loading': {
    featureId: 'html.elements.img.loading',
    fixes: [{
      type: 'recommend-polyfill',
      description: 'Loading lazy attribute',
      payload: { message: 'Consider using loading="lazy" polyfill or intersection observer. (baseline-disable-next-line html.elements.img.loading)' }
    }]
  },
};

const REMEDIATION_DATABASE: Record<string, Remediation> = {
  ...GENERATED_REMEDIATIONS,
  ...MANUAL_REMEDIATIONS,
  ...HTML_REMEDIATIONS,
};

// ==================================================================================
// 3. AST-BASED SCANNER
// ==================================================================================

function pushFinding(
  findings: Finding[],
  featureId: string,
  message: string,
  loc?: { start?: { line: number; column: number }; end?: { line: number; column: number } }
) {
    if (!loc?.start) return;
    // Avoid duplicates
    if (findings.some(f => f.featureId === featureId && f.line === loc.start!.line && f.column === loc.start!.column)) {
      return;
    }

    const feature = (features as any)[featureId];
    const mdnUrl = feature?.mdn_url;

    findings.push({
      featureId,
      type: featureId.startsWith('css') ? 'css-property' : 'js-property',
      message,
      line: loc.start.line,
      column: loc.start.column,
      endLine: loc.end?.line || loc.start.line,
      endColumn: loc.end?.column || loc.start.column + 1,
      fixId: featureId,
      mdnUrl: mdnUrl,
    });
}

/**
 * The main scanning function. It delegates to the appropriate language-specific scanner.
 */
export async function scanCode(content: string, language: 'css' | 'javascript' | 'typescript' | 'typescriptreact' | 'html'): Promise<Finding[]> {
  if (language === 'css') {
    return scanCss(content);
  }
  if (language === 'javascript' || language === 'typescript' || language === 'typescriptreact') {
    return scanJs(content);
  }
  if (language === 'html') {
    return scanHtml(content);
  }
  return [];
}

/**
 * Scans a string of CSS content using PostCSS to find non-baseline features.
 */
export async function scanCss(cssContent: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  const root = postcss.parse(cssContent);

  root.walkDecls(decl => {
    const featureId = `css.properties.${decl.prop}`;

    // If the property exists in our database of non-Baseline features, create a finding.
    if (REMEDIATION_DATABASE[featureId]) {
      // Check for a `baseline-disable-next-line` comment to suppress the warning.
      let prev = decl.prev();
      if (prev && prev.type === 'comment' && prev.text.includes(`baseline-disable-next-line ${featureId}`)) {
        return; // This finding is ignored by a directive.
      }

      // SPECIAL CASE: For backdrop-filter, only show a warning if no background-color fallback is present.
      if (decl.prop === 'backdrop-filter') {
        // Skip over any comments to find the true previous declaration
        let declPrev = decl.prev();
        while (declPrev && declPrev.type === 'comment') {
          declPrev = declPrev.prev();
        }
        if (declPrev && declPrev.type === 'decl' && declPrev.prop === 'background-color') {
          // A fallback exists, so we can skip creating a finding.
          return;
        }
      }

      pushFinding(
        findings,
        featureId,
        `The CSS property '${decl.prop}' is not part of Baseline.`,
        decl.source
      );
    }

    const value = decl.value || '';
    if (value.includes('color-mix(')) {
      pushFinding(
        findings,
        'css.functions.color-mix',
        "The CSS function 'color-mix()' is not part of Baseline.",
        decl.source
      );
    }
    if (/(oklch|oklab)/i.test(value)) {
      pushFinding(
        findings,
        'css.functions.oklch',
        "The color space 'oklch/oklab' is not part of Baseline.",
        decl.source
      );
    }
    if (/(sin|cos|tan)\s*\(/i.test(value)) {
      pushFinding(
        findings,
        'css.functions.sin',
        'CSS trigonometric functions are not part of Baseline.',
        decl.source
      );
    }
  });

  root.walkAtRules(atRule => {
    let featureId: string | null = null;
    if (atRule.name === 'container') {
      featureId = 'css.at-rules.container';
    } else if (atRule.name === 'property') {
      featureId = 'css.at-rules.property';
    }

    if (featureId && REMEDIATION_DATABASE[featureId]) {
      const prev = atRule.prev();
      if (prev && prev.type === 'comment' && prev.text.includes(`baseline-disable-next-line ${featureId}`)) {
        return;
      }
      pushFinding(
        findings,
        featureId,
        `The '@${atRule.name}' rule is not part of Baseline.`,
        atRule.source
      );
    }
  });

  root.walkRules(rule => {
    if (rule.selector && rule.selector.includes(':has(')) {
      const featureId = 'css.selectors.has';
      if (REMEDIATION_DATABASE[featureId]) {
        const prev = rule.prev();
        if (prev && prev.type === 'comment' && prev.text.includes(`baseline-disable-next-line ${featureId}`)) {
          return;
        }
        pushFinding(
          findings,
          featureId,
          "The ':has()' selector is not part of Baseline.",
          rule.source
        );
      }
    }
  });

  return findings;
}

/**
 * Scans a string of JavaScript content using Babel to find deprecated APIs.
 */
export async function scanJs(jsContent: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  try {
    const ast = parse(jsContent, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
      errorRecovery: true, // Attempt to parse through errors
    });

    const checkIdentifier = (path: NodePath<any>, name: string, featureId: string, message: string) => {
      if (path.node.name === name) {
        // Simple check to avoid capturing variable declarations
        if (path.scope.hasBinding(name)) return;

        // Check for disable comments on the parent statement
        const parentStatement = path.getStatementParent();
        if (parentStatement && parentStatement.node.leadingComments) {
            for (const comment of parentStatement.node.leadingComments) {
                if (comment.value.includes(`baseline-disable-next-line ${featureId}`)) {
                    return; // Ignored by directive
                }
            }
        }

        pushFinding(findings, featureId, message, path.node.loc);
      }
    };

    const checkMember = (path: NodePath<any>, propertyName: string, featureId: string, message: string) => {
        if (path.node.property.type === 'Identifier' && path.node.property.name === propertyName) {
            // Check for disable comments on the parent statement
            const parentStatement = path.getStatementParent();
            if (parentStatement && parentStatement.node.leadingComments) {
                for (const comment of parentStatement.node.leadingComments) {
                    if (comment.value.includes(`baseline-disable-next-line ${featureId}`)) {
                        return; // Ignored by directive
                    }
                }
            }
            pushFinding(findings, featureId, message, path.node.property.loc);
        }
    };

    traverse(ast, {
      Identifier(path: NodePath<any>) {
        checkIdentifier(path, 'ResizeObserver', 'api.ResizeObserver', "The 'ResizeObserver' API is not Baseline.");
        checkIdentifier(path, 'globalThis', 'api.globalThis', "The 'globalThis' object is not Baseline.");
        checkIdentifier(path, 'BigInt', 'api.BigInt', "The 'BigInt' primitive is not Baseline.");
        checkIdentifier(path, 'Symbol', 'api.Symbol', "The 'Symbol' primitive is not fully Baseline.");
        checkIdentifier(path, 'Map', 'api.Map', "The 'Map' object is not fully Baseline.");
        checkIdentifier(path, 'Set', 'api.Set', "The 'Set' object is not fully Baseline.");
        checkIdentifier(path, 'Worker', 'api.Worker', "Web Workers are not fully Baseline.");
        checkIdentifier(path, 'WebSocket', 'api.WebSocket', "WebSockets are not fully Baseline.");
        checkIdentifier(path, 'PaymentRequest', 'api.PaymentRequest', "The Payment Request API is not Baseline.");
        checkIdentifier(path, 'RTCPeerConnection', 'api.RTCPeerConnection', "WebRTC is not Baseline.");
      },
      MemberExpression(path: NodePath<any>) {
        // event.keyCode
        checkMember(path, 'keyCode', 'javascript.properties.keyCode', "The 'event.keyCode' property is deprecated. Use 'event.key' instead.");

        // Promise methods
        checkMember(path, 'any', 'api.Promise.any', "'Promise.any()' is not Baseline.");
        checkMember(path, 'allSettled', 'api.Promise.allSettled', "'Promise.allSettled()' is not Baseline.");
        
        // String methods
        checkMember(path, 'matchAll', 'api.String.matchAll', "'String.prototype.matchAll()' is not Baseline.");
        checkMember(path, 'replaceAll', 'api.String.replaceAll', "'String.prototype.replaceAll()' is not Baseline.");

        // Object methods
        checkMember(path, 'fromEntries', 'api.Object.fromEntries', "'Object.fromEntries()' is not Baseline.");
        checkMember(path, 'hasOwn', 'api.Object.hasOwn', "'Object.hasOwn()' is not Baseline.");
        
        // Array methods
        checkMember(path, 'at', 'api.Array.at', "'Array.prototype.at()' is not Baseline.");
        checkMember(path, 'flat', 'api.Array.flat', "'Array.prototype.flat()' is not Baseline.");
        checkMember(path, 'flatMap', 'api.Array.flat', "'Array.prototype.flatMap()' is not Baseline.");
        checkMember(path, 'toReversed', 'api.Array.toReversed', "'Array.prototype.toReversed()' is not Baseline.");
        checkMember(path, 'toSorted', 'api.Array.toSorted', "'Array.prototype.toSorted()' is not Baseline.");
        checkMember(path, 'toSpliced', 'api.Array.toSpliced', "'Array.prototype.toSpliced()' is not Baseline.");

        // Navigator properties
        checkMember(path, 'clipboard', 'api.navigator.clipboard', "The Clipboard API ('navigator.clipboard') is not Baseline.");
        checkMember(path, 'connection', 'api.navigator.connection', "The Network Information API ('navigator.connection') is not Baseline.");
        checkMember(path, 'credentials', 'api.navigator.credentials', "The Credential Management API ('navigator.credentials') is not Baseline.");
        checkMember(path, 'geolocation', 'api.navigator.geolocation', "The Geolocation API ('navigator.geolocation') is not Baseline.");
        checkMember(path, 'mediaDevices', 'api.navigator.mediaDevices', "The MediaDevices API ('navigator.mediaDevices') is not Baseline.");
        checkMember(path, 'serviceWorker', 'api.navigator.serviceWorker', "The Service Worker API ('navigator.serviceWorker') is not Baseline.");
        checkMember(path, 'vibrate', 'api.Navigator.vibrate', "The Vibration API ('navigator.vibrate') is not Baseline.");
        
        // Storage
        checkMember(path, 'localStorage', 'api.localStorage', "The 'localStorage' API may be disabled by the user.");
        checkMember(path, 'sessionStorage', 'api.sessionStorage', "The 'sessionStorage' API may be disabled by the user.");
        
        // Fullscreen API
        checkMember(path, 'requestFullscreen', 'api.Element.requestFullscreen', "The Fullscreen API is not Baseline.");
      },
    });
  } catch (e) {
    console.error('Babel parsing error:', e);
  }
  return findings;
}

/**
 * Scans HTML content for non-Baseline features
 * Checks: HTML elements, attributes, inline styles, and inline scripts
 */
export async function scanHtml(htmlContent: string): Promise<Finding[]> {
  const findings: Finding[] = [];
  
  try {
    const document = parse5.parse(htmlContent, {
      sourceCodeLocationInfo: true
    });
    
    // Traverse the HTML tree
    traverseHtmlNode(document, findings, htmlContent);
    
  } catch (error) {
    console.error('HTML parsing error:', error);
  }
  
  return findings;
}

/**
 * Helper to push HTML findings with correct format
 */
function pushHtmlFinding(
  findings: Finding[],
  featureId: string,
  message: string,
  line: number,
  column: number
) {
  // Avoid duplicates
  if (findings.some(f => f.featureId === featureId && f.line === line && f.column === column)) {
    return;
  }

  const feature = (features as any)[featureId];
  const mdnUrl = feature?.mdn_url;

  findings.push({
    featureId,
    type: 'css-property' as FeatureType, // Reusing existing type
    message,
    line,
    column,
    endLine: line,
    endColumn: column + 10, // Approximate end
    fixId: featureId,
    mdnUrl: mdnUrl || undefined,
  });
}

/**
 * Recursively traverses HTML nodes to find non-Baseline features
 */
function traverseHtmlNode(node: any, findings: Finding[], htmlContent: string) {
  // Check if node has children
  if (node.childNodes) {
    for (const child of node.childNodes) {
      // Check element nodes
      if (child.nodeName && child.nodeName !== '#text' && child.nodeName !== '#comment') {
        checkHtmlElement(child, findings, htmlContent);
      }
      
      // Recurse into children
      traverseHtmlNode(child, findings, htmlContent);
    }
  }
}

/**
 * Checks an HTML element for non-Baseline features
 */
function checkHtmlElement(node: any, findings: Finding[], htmlContent: string) {
  const tagName = node.nodeName?.toLowerCase();
  if (!tagName) return;
  
  const location = node.sourceCodeLocation;
  if (!location) return;
  
  // Check deprecated HTML elements
  const deprecatedElements = ['marquee', 'blink', 'center', 'font', 'big', 'strike', 'tt'];
  if (deprecatedElements.includes(tagName)) {
    const featureId = `html.elements.${tagName}`;
    if (REMEDIATION_DATABASE[featureId]) {
      pushHtmlFinding(
        findings,
        featureId,
        `Deprecated HTML element: <${tagName}>`,
        location.startLine || 1,
        location.startCol || 0
      );
    }
  }
  
  // Check modern HTML elements that aren't Baseline
  const modernElements = ['dialog', 'details', 'summary'];
  if (modernElements.includes(tagName)) {
    const featureId = `html.elements.${tagName}`;
    if (REMEDIATION_DATABASE[featureId]) {
      pushHtmlFinding(
        findings,
        featureId,
        `HTML element <${tagName}> is not Baseline`,
        location.startLine || 1,
        location.startCol || 0
      );
    }
  }
  
  // Check attributes
  if (node.attrs) {
    for (const attr of node.attrs) {
      checkHtmlAttribute(attr, tagName, location, findings);
    }
  }
  
  // Check inline styles
  const styleAttr = node.attrs?.find((a: any) => a.name === 'style');
  if (styleAttr && styleAttr.value) {
    checkInlineStyle(styleAttr.value, location.startLine || 1, findings);
  }
  
  // Check inline scripts
  if (tagName === 'script' && node.childNodes) {
    for (const child of node.childNodes) {
      if (child.nodeName === '#text' && child.value) {
        checkInlineScript(child.value, location.startLine || 1, findings);
      }
    }
  }
  
  // Check style blocks
  if (tagName === 'style' && node.childNodes) {
    for (const child of node.childNodes) {
      if (child.nodeName === '#text' && child.value) {
        checkStyleBlock(child.value, location.startLine || 1, findings);
      }
    }
  }
}

/**
 * Checks HTML attributes for non-Baseline features
 */
function checkHtmlAttribute(attr: any, tagName: string, location: any, findings: Finding[]) {
  const attrName = attr.name.toLowerCase();
  
  // Check global attributes
  const nonBaselineAttrs = ['popover', 'inert', 'enterkeyhint'];
  if (nonBaselineAttrs.includes(attrName)) {
    const featureId = `html.global_attributes.${attrName}`;
    if (REMEDIATION_DATABASE[featureId]) {
      pushHtmlFinding(
        findings,
        featureId,
        `HTML attribute '${attrName}' is not Baseline`,
        location.startLine || 1,
        location.startCol || 0
      );
    }
  }
  
  // Check input types
  if (tagName === 'input' && attrName === 'type') {
    const typeValue = attr.value.toLowerCase();
    const nonBaselineTypes = ['date', 'color', 'datetime-local', 'month', 'week', 'time'];
    if (nonBaselineTypes.includes(typeValue)) {
      const featureId = `html.elements.input.type_${typeValue.replace('-', '_')}`;
      if (REMEDIATION_DATABASE[featureId]) {
        pushHtmlFinding(
          findings,
          featureId,
          `Input type="${typeValue}" is not Baseline`,
          location.startLine || 1,
          location.startCol || 0
        );
      }
    }
  }
  
  // Check loading attribute
  if (attrName === 'loading' && (tagName === 'img' || tagName === 'iframe')) {
    const featureId = `html.elements.${tagName}.loading`;
    if (REMEDIATION_DATABASE[featureId]) {
      pushHtmlFinding(
        findings,
        featureId,
        `loading="${attr.value}" attribute is not Baseline`,
        location.startLine || 1,
        location.startCol || 0
      );
    }
  }
}

/**
 * Checks inline CSS styles for non-Baseline properties
 */
async function checkInlineStyle(styleContent: string, baseLine: number, findings: Finding[]) {
  try {
    // Parse the inline style as CSS
    const cssFindings = await scanCss(styleContent);
    // Adjust line numbers
    for (const finding of cssFindings) {
      finding.line += baseLine;
      findings.push(finding);
    }
  } catch (error) {
    // Ignore CSS parsing errors in inline styles
  }
}

/**
 * Checks inline JavaScript for non-Baseline features
 */
async function checkInlineScript(scriptContent: string, baseLine: number, findings: Finding[]) {
  try {
    // Parse the inline script as JavaScript
    const jsFindings = await scanJs(scriptContent);
    // Adjust line numbers
    for (const finding of jsFindings) {
      finding.line += baseLine;
      findings.push(finding);
    }
  } catch (error) {
    // Ignore JS parsing errors in inline scripts
  }
}

/**
 * Checks CSS in <style> blocks for non-Baseline properties
 */
async function checkStyleBlock(styleContent: string, baseLine: number, findings: Finding[]) {
  try {
    const cssFindings = await scanCss(styleContent);
    // Adjust line numbers
    for (const finding of cssFindings) {
      finding.line += baseLine;
      findings.push(finding);
    }
  } catch (error) {
    // Ignore CSS parsing errors
  }
}

/**
 * A helper function to get a remediation from the database.
 */
export function getRemediation(fixId: string): Remediation | undefined {
  return REMEDIATION_DATABASE[fixId];
}
