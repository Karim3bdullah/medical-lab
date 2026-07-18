import React, {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { createPortal } from 'react-dom';

const TOUR_STORAGE_KEY = 'labnet.ui.tour.v1';
const TOUR_SCHEMA_VERSION = 1;
const VALID_TOUR_STATUSES = new Set(['completed', 'skipped']);
const Z_INDEX = {
  overlay: 1100,
  highlight: 1101,
  popover: 1110,
};
const VIEWPORT_MARGIN = 16;
const TARGET_GAP = 12;
const TARGET_PADDING = 6;
const MODAL_SELECTOR = [
  '[role="dialog"][aria-modal="true"]',
  '[data-modal-active="true"]',
  '.swal2-container.swal2-shown',
  '.swal2-container[aria-hidden="false"]',
].join(',');

const EMPTY_TOUR_STORE = Object.freeze({
  version: TOUR_SCHEMA_VERSION,
  entries: Object.freeze({}),
});

const canUseDOM = () =>
  typeof window !== 'undefined' && typeof document !== 'undefined';

export const safeStorageGet = (key) => {
  if (!canUseDOM() || !key) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
};

export const safeStorageSet = (key, value) => {
  if (!canUseDOM() || !key) return false;
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
};

const isPlainObject = (value) =>
  Boolean(value) && typeof value === 'object' && !Array.isArray(value);

const sanitizeEntries = (entries) => {
  if (!isPlainObject(entries)) return {};

  return Object.entries(entries).reduce((result, [scope, entry]) => {
    if (!scope || !isPlainObject(entry) || !VALID_TOUR_STATUSES.has(entry.status)) {
      return result;
    }
    result[scope] = { status: entry.status };
    return result;
  }, {});
};

const migrateTourStore = (parsed) => {
  if (!isPlainObject(parsed)) {
    return { store: EMPTY_TOUR_STORE, writable: true };
  }

  if (parsed.version === TOUR_SCHEMA_VERSION) {
    return {
      store: {
        version: TOUR_SCHEMA_VERSION,
        entries: sanitizeEntries(parsed.entries),
      },
      writable: true,
    };
  }

  // Future schemas are read-only to avoid destructive downgrades.
  if (Number(parsed.version) > TOUR_SCHEMA_VERSION) {
    return { store: EMPTY_TOUR_STORE, writable: false };
  }

  return { store: EMPTY_TOUR_STORE, writable: true };
};

const parseTourStore = (rawValue) => {
  if (!rawValue) return { store: EMPTY_TOUR_STORE, writable: true };
  try {
    return migrateTourStore(JSON.parse(rawValue));
  } catch {
    return { store: EMPTY_TOUR_STORE, writable: true };
  }
};

const readTourStore = () => parseTourStore(safeStorageGet(TOUR_STORAGE_KEY));

const getTourStatus = (scope, rawValue) => {
  if (!scope) return null;
  const { store } = rawValue === undefined
    ? readTourStore()
    : parseTourStore(rawValue);
  return store.entries?.[scope]?.status || null;
};

const updateTourStatus = (scope, status) => {
  if (!scope || !VALID_TOUR_STATUSES.has(status)) return false;
  const { store, writable } = readTourStore();
  if (!writable) return false;

  return safeStorageSet(TOUR_STORAGE_KEY, JSON.stringify({
    version: TOUR_SCHEMA_VERSION,
    entries: {
      ...store.entries,
      [scope]: { status },
    },
  }));
};

const clearTourStatus = (scope) => {
  if (!scope) return false;
  const { store, writable } = readTourStore();
  if (!writable) return false;

  const entries = { ...store.entries };
  delete entries[scope];
  return safeStorageSet(TOUR_STORAGE_KEY, JSON.stringify({
    version: TOUR_SCHEMA_VERSION,
    entries,
  }));
};

const isElementVisible = (element) => {
  if (!element?.isConnected || typeof element.getBoundingClientRect !== 'function') {
    return false;
  }

  try {
    const style = window.getComputedStyle(element);
    if (style.display === 'none' || style.visibility === 'hidden') return false;
    const rect = element.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0;
  } catch {
    return false;
  }
};

const resolveVisibleTarget = (selector, tourRoot) => {
  if (!canUseDOM() || typeof selector !== 'string' || !selector.trim()) return null;
  try {
    const candidates = document.querySelectorAll(selector);
    return Array.from(candidates).find(
      (candidate) => !tourRoot?.contains(candidate) && isElementVisible(candidate),
    ) || null;
  } catch {
    return null;
  }
};

const hasExternalModal = (tourRoot) => {
  if (!canUseDOM()) return false;

  try {
    const explicitModal = Array.from(document.querySelectorAll(MODAL_SELECTOR)).find(
      (element) => !tourRoot?.contains(element) && isElementVisible(element),
    );
    if (explicitModal) return true;

    // Several existing legacy dialogs are fixed z-50 overlays without ARIA metadata.
    return Array.from(document.querySelectorAll('.fixed.inset-0')).some((element) => {
      if (tourRoot?.contains(element) || !isElementVisible(element)) return false;
      return /(?:^|\s)z-(?:50|\[1000\]|\[1010\]|\[9998\])(?:\s|$)/.test(element.className);
    });
  } catch {
    return false;
  }
};

const getScrollableAncestors = (element) => {
  if (!canUseDOM() || !element) return [];
  const ancestors = [];
  let current = element.parentElement;

  while (current && current !== document.body && current !== document.documentElement) {
    try {
      const style = window.getComputedStyle(current);
      const overflow = `${style.overflow} ${style.overflowX} ${style.overflowY}`;
      const canScroll = /(auto|scroll|overlay)/.test(overflow)
        && (current.scrollHeight > current.clientHeight || current.scrollWidth > current.clientWidth);
      if (canScroll) ancestors.push(current);
    } catch {
      // Ignore inaccessible style data and continue walking the tree.
    }
    current = current.parentElement;
  }

  return ancestors;
};

const getDirection = (target) => {
  if (!canUseDOM()) return 'ltr';
  try {
    return target
      ? window.getComputedStyle(target).direction || document.documentElement.dir || 'ltr'
      : document.documentElement.dir || 'ltr';
  } catch {
    return document.documentElement.dir || 'ltr';
  }
};

const resolvePhysicalPlacement = (placement, direction) => {
  if (placement === 'start') return direction === 'rtl' ? 'right' : 'left';
  if (placement === 'end') return direction === 'rtl' ? 'left' : 'right';
  return placement || 'bottom';
};

const getReducedMotion = () => {
  if (!canUseDOM() || typeof window.matchMedia !== 'function') return false;
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    return false;
  }
};

const clamp = (value, minimum, maximum) =>
  Math.min(Math.max(value, minimum), Math.max(minimum, maximum));

const getFocusableElements = (container) => {
  if (!container) return [];
  try {
    return Array.from(container.querySelectorAll([
      'button:not([disabled])',
      '[href]',
      '[tabindex]:not([tabindex="-1"])',
    ].join(','))).filter(isElementVisible);
  } catch {
    return [];
  }
};

const defaultLabels = {
  previous: 'Back',
  next: 'Next',
  finish: 'Done',
  skip: 'Skip',
  close: 'Close',
  progress: ({ current, total }) => `${current}/${total}`,
};

const GuidedTour = ({
  steps,
  storageScope,
  restartSignal = 0,
  lifecycleKey,
  tourLabel = 'Tour',
  labels,
  autoStart = true,
  onActiveChange,
}) => {
  const normalizedSteps = useMemo(
    () => (Array.isArray(steps)
      ? steps.filter((step) => step && typeof step.id === 'string' && step.id)
      : []),
    [steps],
  );
  const mergedLabels = useMemo(() => ({ ...defaultLabels, ...labels }), [labels]);
  const tourLabelId = useId();
  const titleId = useId();
  const descriptionId = useId();

  const [isActive, setIsActive] = useState(false);
  const [stepIndex, setStepIndex] = useState(0);
  const [announcement, setAnnouncement] = useState('');
  const [waitingForModal, setWaitingForModal] = useState(false);
  const [tourDirection, setTourDirection] = useState('rtl');
  const [motionReduced, setMotionReduced] = useState(() => getReducedMotion());
  const [navigationState, setNavigationState] = useState({ hasPrevious: false, hasNext: false });
  const [completionStatus, setCompletionStatus] = useState(
    () => getTourStatus(storageScope),
  );

  const mountedRef = useRef(false);
  const activeRef = useRef(false);
  const activeNotificationRef = useRef(false);
  const stepIndexRef = useRef(0);
  const storageScopeRef = useRef(storageScope);
  const stepsRef = useRef(normalizedSteps);
  const onActiveChangeRef = useRef(onActiveChange);
  const previousFocusRef = useRef(null);
  const rootRef = useRef(null);
  const popoverRef = useRef(null);
  const highlightRef = useRef(null);
  const currentTargetRef = useRef(null);
  const scrollAncestorsRef = useRef([]);
  const resizeObserverRef = useRef(null);
  const mutationObserverRef = useRef(null);
  const geometryFrameRef = useRef(null);
  const mutationFrameRef = useRef(null);
  const autoStartFrameRef = useRef(null);
  const focusFrameRef = useRef(null);
  const transitionElementRef = useRef(null);
  const isolatedElementsRef = useRef([]);
  const lifecycleGenerationRef = useRef(0);
  const sessionSuppressedRef = useRef(false);
  const autoStartAttemptedRef = useRef(false);
  const pendingExplicitRestartRef = useRef(false);
  const previousLifecycleKeyRef = useRef(lifecycleKey);
  const previousRestartSignalRef = useRef(restartSignal);
  const previousScopeRef = useRef(storageScope);

  stepsRef.current = normalizedSteps;
  storageScopeRef.current = storageScope;
  onActiveChangeRef.current = onActiveChange;
  stepIndexRef.current = stepIndex;

  const cancelFrame = useCallback((frameRef) => {
    if (frameRef.current != null && canUseDOM()) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = null;
  }, []);

  const cleanupTargetBindings = useCallback(() => {
    resizeObserverRef.current?.disconnect();
    resizeObserverRef.current = null;

    scrollAncestorsRef.current.forEach((ancestor) => {
      ancestor.removeEventListener('scroll', scheduleGeometryRef.current);
    });
    scrollAncestorsRef.current = [];

    if (canUseDOM()) {
      window.removeEventListener('resize', scheduleGeometryRef.current);
    }

    if (transitionElementRef.current) {
      transitionElementRef.current.removeEventListener('transitionend', scheduleGeometryRef.current);
      transitionElementRef.current = null;
    }

    currentTargetRef.current = null;
    cancelFrame(geometryFrameRef);
  }, [cancelFrame]);

  const restoreBackgroundIsolation = useCallback(() => {
    isolatedElementsRef.current.forEach(({ element, inert, ariaHidden }) => {
      try {
        if ('inert' in element) element.inert = inert;
        if (ariaHidden == null) element.removeAttribute('aria-hidden');
        else element.setAttribute('aria-hidden', ariaHidden);
      } catch {
        // Detached nodes require no restoration.
      }
    });
    isolatedElementsRef.current = [];
  }, []);

  const restoreFocus = useCallback(() => {
    const previous = previousFocusRef.current;
    previousFocusRef.current = null;
    if (!previous?.isConnected || typeof previous.focus !== 'function') return;
    try {
      previous.focus({ preventScroll: true });
    } catch {
      try {
        previous.focus();
      } catch {
        // Focus restoration is best-effort and must never throw.
      }
    }
  }, []);

  const notifyActiveChange = useCallback((nextActive) => {
    if (nextActive === activeNotificationRef.current) return;
    activeNotificationRef.current = nextActive;
    try {
      onActiveChangeRef.current?.(nextActive);
    } catch {
      // Consumer notification failures must not break the shell.
    }
  }, []);

  const cleanupObservers = useCallback(() => {
    mutationObserverRef.current?.disconnect();
    mutationObserverRef.current = null;
    cancelFrame(mutationFrameRef);
  }, [cancelFrame]);

  const cleanupActiveResources = useCallback(({ restoreUserFocus = true } = {}) => {
    cleanupTargetBindings();
    cleanupObservers();
    cancelFrame(focusFrameRef);
    restoreBackgroundIsolation();
    if (restoreUserFocus) restoreFocus();
  }, [cancelFrame, cleanupObservers, cleanupTargetBindings, restoreBackgroundIsolation, restoreFocus]);

  const exitTour = useCallback(({
    status = null,
    suppressAutoStart = false,
    restoreUserFocus = true,
  } = {}) => {
    const wasActive = activeRef.current;
    lifecycleGenerationRef.current += 1;

    if (status && storageScopeRef.current) {
      updateTourStatus(storageScopeRef.current, status);
      setCompletionStatus(status);
    }

    if (suppressAutoStart) sessionSuppressedRef.current = true;
    pendingExplicitRestartRef.current = false;
    activeRef.current = false;
    cleanupActiveResources({ restoreUserFocus });

    if (mountedRef.current) {
      setIsActive(false);
      setWaitingForModal(false);
    }
    if (wasActive) notifyActiveChange(false);
  }, [cleanupActiveResources, notifyActiveChange]);

  const getValidStepIndex = useCallback((startIndex, direction = 1) => {
    const currentSteps = stepsRef.current;
    for (
      let index = startIndex;
      index >= 0 && index < currentSteps.length;
      index += direction
    ) {
      const step = currentSteps[index];
      if (!step?.optional) return index;
      if (resolveVisibleTarget(step.target, rootRef.current)) return index;
    }
    return -1;
  }, []);

  const startTour = useCallback(({ explicit = false } = {}) => {
    if (!canUseDOM() || activeRef.current || !storageScopeRef.current || !stepsRef.current.length) {
      return false;
    }

    if (hasExternalModal(rootRef.current)) {
      pendingExplicitRestartRef.current = explicit;
      if (mountedRef.current) setWaitingForModal(true);
      return false;
    }

    const firstStepIndex = getValidStepIndex(0, 1);
    if (firstStepIndex < 0) return false;

    lifecycleGenerationRef.current += 1;
    previousFocusRef.current = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    stepIndexRef.current = firstStepIndex;
    activeRef.current = true;
    pendingExplicitRestartRef.current = false;
    autoStartAttemptedRef.current = true;

    if (mountedRef.current) {
      setStepIndex(firstStepIndex);
      setNavigationState({
        hasPrevious: false,
        hasNext: firstStepIndex < stepsRef.current.length - 1,
      });
      setIsActive(true);
      setWaitingForModal(false);
    }
    notifyActiveChange(true);
    return true;
  }, [getValidStepIndex, notifyActiveChange]);

  const scheduleAutoStart = useCallback(() => {
    if (
      !canUseDOM()
      || !autoStart
      || activeRef.current
      || autoStartAttemptedRef.current
      || sessionSuppressedRef.current
      || completionStatus
      || !storageScopeRef.current
      || !stepsRef.current.length
    ) {
      return;
    }

    cancelFrame(autoStartFrameRef);
    autoStartFrameRef.current = window.requestAnimationFrame(() => {
      autoStartFrameRef.current = null;
      if (!mountedRef.current || sessionSuppressedRef.current || completionStatus) return;
      if (hasExternalModal(rootRef.current)) {
        setWaitingForModal(true);
        return;
      }
      autoStartAttemptedRef.current = true;
      startTour({ explicit: false });
    });
  }, [autoStart, cancelFrame, completionStatus, startTour]);

  const measureAndPosition = useCallback(() => {
    if (!activeRef.current || !canUseDOM()) return;
    const popover = popoverRef.current;
    const highlight = highlightRef.current;
    if (!popover || !highlight) return;

    try {
      let target = currentTargetRef.current;
      if (!target?.isConnected || !isElementVisible(target)) {
        const replacement = resolveVisibleTarget(
          stepsRef.current[stepIndexRef.current]?.target,
          rootRef.current,
        );
        if (replacement !== target) {
          currentTargetRef.current = replacement;
          bindCurrentTargetRef.current();
          return;
        }
        target = replacement;
      }

      const popoverRect = popover.getBoundingClientRect();
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;

      if (!target) {
        highlight.style.opacity = '0';
        highlight.style.width = '0px';
        highlight.style.height = '0px';
        popover.style.left = `${clamp(
          (viewportWidth - popoverRect.width) / 2,
          VIEWPORT_MARGIN,
          viewportWidth - popoverRect.width - VIEWPORT_MARGIN,
        )}px`;
        popover.style.top = `${clamp(
          (viewportHeight - popoverRect.height) / 2,
          VIEWPORT_MARGIN,
          viewportHeight - popoverRect.height - VIEWPORT_MARGIN,
        )}px`;
        popover.style.opacity = '1';
        return;
      }

      const targetRect = target.getBoundingClientRect();
      const direction = getDirection(target);
      const preferred = resolvePhysicalPlacement(
        stepsRef.current[stepIndexRef.current]?.placement,
        direction,
      );
      const candidates = [preferred, 'bottom', 'top', 'right', 'left', 'center']
        .filter((value, index, values) => values.indexOf(value) === index);

      const targetLeft = targetRect.left - TARGET_PADDING;
      const targetTop = targetRect.top - TARGET_PADDING;
      const targetWidth = targetRect.width + (TARGET_PADDING * 2);
      const targetHeight = targetRect.height + (TARGET_PADDING * 2);

      highlight.style.left = `${targetLeft}px`;
      highlight.style.top = `${targetTop}px`;
      highlight.style.width = `${targetWidth}px`;
      highlight.style.height = `${targetHeight}px`;
      highlight.style.opacity = '1';

      const positions = {
        bottom: {
          left: targetRect.left + ((targetRect.width - popoverRect.width) / 2),
          top: targetRect.bottom + TARGET_GAP,
        },
        top: {
          left: targetRect.left + ((targetRect.width - popoverRect.width) / 2),
          top: targetRect.top - popoverRect.height - TARGET_GAP,
        },
        right: {
          left: targetRect.right + TARGET_GAP,
          top: targetRect.top + ((targetRect.height - popoverRect.height) / 2),
        },
        left: {
          left: targetRect.left - popoverRect.width - TARGET_GAP,
          top: targetRect.top + ((targetRect.height - popoverRect.height) / 2),
        },
        center: {
          left: (viewportWidth - popoverRect.width) / 2,
          top: (viewportHeight - popoverRect.height) / 2,
        },
      };

      const fitsViewport = ({ left, top }) =>
        left >= VIEWPORT_MARGIN
        && top >= VIEWPORT_MARGIN
        && left + popoverRect.width <= viewportWidth - VIEWPORT_MARGIN
        && top + popoverRect.height <= viewportHeight - VIEWPORT_MARGIN;

      const selected = candidates
        .map((candidate) => positions[candidate])
        .find((position) => position && fitsViewport(position))
        || positions.center;

      popover.style.left = `${clamp(
        selected.left,
        VIEWPORT_MARGIN,
        viewportWidth - popoverRect.width - VIEWPORT_MARGIN,
      )}px`;
      popover.style.top = `${clamp(
        selected.top,
        VIEWPORT_MARGIN,
        viewportHeight - popoverRect.height - VIEWPORT_MARGIN,
      )}px`;
      popover.style.opacity = '1';
    } catch {
      // Positioning failures degrade to the existing centered fallback.
      if (popover) {
        popover.style.left = `${VIEWPORT_MARGIN}px`;
        popover.style.top = `${VIEWPORT_MARGIN}px`;
        popover.style.opacity = '1';
      }
      if (highlight) highlight.style.opacity = '0';
    }
  }, []);

  const scheduleGeometry = useCallback(() => {
    if (!canUseDOM() || !activeRef.current || geometryFrameRef.current != null) return;
    const generation = lifecycleGenerationRef.current;
    geometryFrameRef.current = window.requestAnimationFrame(() => {
      geometryFrameRef.current = null;
      if (!activeRef.current || generation !== lifecycleGenerationRef.current) return;
      measureAndPosition();
    });
  }, [measureAndPosition]);

  const scheduleGeometryRef = useRef(scheduleGeometry);
  scheduleGeometryRef.current = scheduleGeometry;

  const bindCurrentTarget = useCallback(() => {
    cleanupTargetBindings();
    if (!activeRef.current || !canUseDOM()) return;

    const step = stepsRef.current[stepIndexRef.current];
    const target = resolveVisibleTarget(step?.target, rootRef.current);
    currentTargetRef.current = target;
    if (mountedRef.current) setTourDirection(getDirection(target));

    if (!target && step?.optional) {
      const nextIndex = getValidStepIndex(stepIndexRef.current + 1, 1);
      if (nextIndex >= 0 && mountedRef.current) {
        stepIndexRef.current = nextIndex;
        setStepIndex(nextIndex);
      } else {
        exitTour({ status: 'completed' });
      }
      return;
    }

    if (mountedRef.current) {
      setNavigationState({
        hasPrevious: getValidStepIndex(stepIndexRef.current - 1, -1) >= 0,
        hasNext: getValidStepIndex(stepIndexRef.current + 1, 1) >= 0,
      });
    }

    if (target) {
      try {
        target.scrollIntoView({
          block: 'nearest',
          inline: 'nearest',
          behavior: getReducedMotion() ? 'auto' : 'smooth',
        });
      } catch {
        // Scroll support varies; measurement remains sufficient.
      }

      scrollAncestorsRef.current = getScrollableAncestors(target);
      scrollAncestorsRef.current.forEach((ancestor) => {
        ancestor.addEventListener('scroll', scheduleGeometryRef.current, { passive: true });
      });

      transitionElementRef.current = target.closest?.('[data-tour-layout-transition]') || null;
      transitionElementRef.current?.addEventListener('transitionend', scheduleGeometryRef.current);
    }

    window.addEventListener('resize', scheduleGeometryRef.current, { passive: true });

    if (typeof window.ResizeObserver === 'function') {
      resizeObserverRef.current = new window.ResizeObserver(scheduleGeometryRef.current);
      if (target) resizeObserverRef.current.observe(target);
      if (popoverRef.current) resizeObserverRef.current.observe(popoverRef.current);
    }

    scheduleGeometryRef.current();
  }, [cleanupTargetBindings, exitTour, getValidStepIndex]);

  const bindCurrentTargetRef = useRef(bindCurrentTarget);
  bindCurrentTargetRef.current = bindCurrentTarget;

  const applyBackgroundIsolation = useCallback(() => {
    if (!canUseDOM() || !rootRef.current || isolatedElementsRef.current.length) return;

    const isolated = [];
    Array.from(document.body.children).forEach((element) => {
      if (element === rootRef.current || element.contains(rootRef.current)) return;
      if (element.classList?.contains('z-[9999]')) return;

      try {
        const original = {
          element,
          inert: 'inert' in element ? Boolean(element.inert) : false,
          ariaHidden: element.getAttribute('aria-hidden'),
        };
        if ('inert' in element) element.inert = true;
        element.setAttribute('aria-hidden', 'true');
        isolated.push(original);
      } catch {
        // Background isolation is best-effort with a focus-trap fallback.
      }
    });
    isolatedElementsRef.current = isolated;
  }, []);

  const focusPopover = useCallback(() => {
    cancelFrame(focusFrameRef);
    if (!canUseDOM()) return;
    const generation = lifecycleGenerationRef.current;
    focusFrameRef.current = window.requestAnimationFrame(() => {
      focusFrameRef.current = null;
      if (!activeRef.current || generation !== lifecycleGenerationRef.current) return;
      try {
        popoverRef.current?.focus({ preventScroll: true });
      } catch {
        popoverRef.current?.focus?.();
      }
      applyBackgroundIsolation();
    });
  }, [applyBackgroundIsolation, cancelFrame]);

  const moveToStep = useCallback((nextIndex) => {
    if (!activeRef.current || nextIndex < 0 || nextIndex >= stepsRef.current.length) return;
    stepIndexRef.current = nextIndex;
    if (mountedRef.current) setStepIndex(nextIndex);
  }, []);

  const goPrevious = useCallback(() => {
    const previousIndex = getValidStepIndex(stepIndexRef.current - 1, -1);
    if (previousIndex >= 0) moveToStep(previousIndex);
  }, [getValidStepIndex, moveToStep]);

  const goNext = useCallback(() => {
    const nextIndex = getValidStepIndex(stepIndexRef.current + 1, 1);
    if (nextIndex >= 0) moveToStep(nextIndex);
    else exitTour({ status: 'completed' });
  }, [exitTour, getValidStepIndex, moveToStep]);

  const skipTour = useCallback(() => {
    exitTour({ status: 'skipped' });
  }, [exitTour]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      lifecycleGenerationRef.current += 1;
      cancelFrame(autoStartFrameRef);
      cleanupActiveResources({ restoreUserFocus: true });
      activeRef.current = false;

      // Delayed notification distinguishes a real unmount from StrictMode's effect replay.
      Promise.resolve().then(() => {
        if (!mountedRef.current && activeNotificationRef.current) notifyActiveChange(false);
      });
    };
  }, [cancelFrame, cleanupActiveResources, notifyActiveChange]);

  useEffect(() => {
    if (previousScopeRef.current === storageScope) return;
    previousScopeRef.current = storageScope;
    if (activeRef.current) exitTour({ suppressAutoStart: true });
    sessionSuppressedRef.current = false;
    autoStartAttemptedRef.current = false;
    pendingExplicitRestartRef.current = false;
    const nextStatus = getTourStatus(storageScope);
    setCompletionStatus(nextStatus);
  }, [exitTour, storageScope]);

  useEffect(() => {
    if (previousLifecycleKeyRef.current === lifecycleKey) return;
    previousLifecycleKeyRef.current = lifecycleKey;
    if (activeRef.current) {
      exitTour({ suppressAutoStart: true });
    }
  }, [exitTour, lifecycleKey]);

  useEffect(() => {
    if (previousRestartSignalRef.current === restartSignal) return;
    previousRestartSignalRef.current = restartSignal;
    clearTourStatus(storageScopeRef.current);
    setCompletionStatus(null);
    sessionSuppressedRef.current = false;
    autoStartAttemptedRef.current = true;

    if (activeRef.current) exitTour();
    pendingExplicitRestartRef.current = true;
    if (hasExternalModal(rootRef.current)) {
      setWaitingForModal(true);
      return;
    }
    startTour({ explicit: true });
  }, [exitTour, restartSignal, startTour]);

  useEffect(() => {
    scheduleAutoStart();
    return () => cancelFrame(autoStartFrameRef);
  }, [cancelFrame, scheduleAutoStart]);

  useEffect(() => {
    if (!canUseDOM() || typeof window.matchMedia !== 'function') return undefined;
    let mediaQuery;
    try {
      mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    } catch {
      return undefined;
    }

    const handleMotionChange = (event) => setMotionReduced(Boolean(event.matches));
    setMotionReduced(Boolean(mediaQuery.matches));
    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleMotionChange);
      return () => mediaQuery.removeEventListener('change', handleMotionChange);
    }
    mediaQuery.addListener?.(handleMotionChange);
    return () => mediaQuery.removeListener?.(handleMotionChange);
  }, []);

  useEffect(() => {
    if (!canUseDOM()) return undefined;

    const handleStorage = (event) => {
      if (event.key !== TOUR_STORAGE_KEY || !storageScopeRef.current) return;
      const nextStatus = getTourStatus(storageScopeRef.current, event.newValue);
      setCompletionStatus(nextStatus);

      if (nextStatus) {
        sessionSuppressedRef.current = true;
        autoStartAttemptedRef.current = true;
        if (activeRef.current) exitTour({ suppressAutoStart: true });
        return;
      }

      // A restart from another tab must not unexpectedly open this tab's Tour.
      sessionSuppressedRef.current = true;
      autoStartAttemptedRef.current = true;
    };

    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, [exitTour]);

  useEffect(() => {
    if (!isActive) return undefined;
    bindCurrentTargetRef.current();
    focusPopover();

    const currentStep = stepsRef.current[stepIndex];
    const progressFormatter = typeof mergedLabels.progress === 'function'
      ? mergedLabels.progress
      : defaultLabels.progress;
    Promise.resolve().then(() => {
      if (!mountedRef.current || !activeRef.current || stepIndexRef.current !== stepIndex) return;
      setAnnouncement(progressFormatter({
        current: stepIndex + 1,
        total: stepsRef.current.length,
        title: currentStep?.title || '',
      }));
    });

    return () => cleanupTargetBindings();
  }, [bindCurrentTarget, cleanupTargetBindings, focusPopover, isActive, mergedLabels.progress, stepIndex]);

  useEffect(() => {
    if (!canUseDOM() || (!isActive && !waitingForModal)) return undefined;

    const handleMutation = () => {
      if (mutationFrameRef.current != null) return;
      const generation = lifecycleGenerationRef.current;
      mutationFrameRef.current = window.requestAnimationFrame(() => {
        mutationFrameRef.current = null;
        if (!mountedRef.current || generation !== lifecycleGenerationRef.current) return;

        if (hasExternalModal(rootRef.current)) {
          if (activeRef.current) {
            exitTour({ suppressAutoStart: true });
          }
          return;
        }

        if (waitingForModal && !activeRef.current) {
          setWaitingForModal(false);
          if (pendingExplicitRestartRef.current) startTour({ explicit: true });
          else scheduleAutoStart();
          return;
        }

        if (
          activeRef.current
          && (!currentTargetRef.current?.isConnected || !isElementVisible(currentTargetRef.current))
        ) {
          bindCurrentTargetRef.current();
        }
      });
    };

    if (typeof window.MutationObserver !== 'function') return undefined;

    mutationObserverRef.current = new window.MutationObserver(handleMutation);
    mutationObserverRef.current.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'aria-modal', 'aria-hidden', 'data-modal-active', 'open'],
    });

    return cleanupObservers;
  }, [cleanupObservers, exitTour, isActive, scheduleAutoStart, startTour, waitingForModal]);

  useEffect(() => {
    if (!isActive || !canUseDOM()) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skipTour();
        return;
      }

      if (event.key !== 'Tab') return;
      const focusable = getFocusableElements(popoverRef.current);
      if (!focusable.length) {
        event.preventDefault();
        popoverRef.current?.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === popoverRef.current) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      } else if (!popoverRef.current?.contains(document.activeElement)) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown, true);
    return () => document.removeEventListener('keydown', handleKeyDown, true);
  }, [isActive, skipTour]);

  if (!isActive || !canUseDOM() || !document.body) return null;

  const currentStep = normalizedSteps[stepIndex];
  if (!currentStep) return null;

  const isFirstStep = !navigationState.hasPrevious;
  const isLastStep = !navigationState.hasNext;

  return createPortal(
    <div
      ref={rootRef}
      data-testid="guided-tour-root"
      data-tour-layer="root"
      data-tour-step-id={currentStep.id}
      className="fixed inset-0 pointer-events-none"
      style={{ zIndex: Z_INDEX.overlay }}
      dir={tourDirection}
    >
      <div
        data-testid="guided-tour-overlay"
        className="fixed inset-0 pointer-events-auto"
        style={{ zIndex: Z_INDEX.overlay }}
        aria-hidden="true"
      />

      <div
        ref={highlightRef}
        data-testid="guided-tour-highlight"
        className="fixed rounded-xl border-2 border-white pointer-events-none opacity-0"
        style={{
          zIndex: Z_INDEX.highlight,
          boxShadow: '0 0 0 9999px rgba(15, 23, 42, 0.72)',
          transition: motionReduced
            ? 'none'
            : 'left 160ms ease, top 160ms ease, width 160ms ease, height 160ms ease, opacity 120ms ease',
        }}
        aria-hidden="true"
      />

      <section
        ref={popoverRef}
        data-testid="guided-tour-popover"
        className="ui-surface-elevated fixed pointer-events-auto rounded-2xl border p-4 shadow-2xl outline-none sm:p-5"
        style={{
          zIndex: Z_INDEX.popover,
          width: 'min(24rem, calc(100vw - 2rem))',
          maxWidth: 'calc(100vw - 2rem)',
          maxHeight: 'calc(100vh - 2rem)',
          overflowY: 'auto',
          opacity: 0,
          transition: motionReduced ? 'none' : 'opacity 140ms ease',
        }}
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${tourLabelId} ${titleId}`}
        aria-describedby={descriptionId}
        tabIndex={-1}
      >
        <span id={tourLabelId} className="sr-only">{tourLabel}</span>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p
              data-testid="guided-tour-progress"
              className="text-xs font-bold text-[var(--text-muted)]"
              aria-live="polite"
              aria-atomic="true"
            >
              {announcement}
            </p>
            <h2
              id={titleId}
              data-testid="guided-tour-title"
              className="mt-2 text-lg font-black text-[var(--text-primary)]"
            >
              {currentStep.title}
            </h2>
          </div>
          <button
            type="button"
            data-testid="guided-tour-close"
            onClick={skipTour}
            className="btn-ghost flex h-10 w-10 shrink-0 items-center justify-center rounded-xl p-0"
            aria-label={mergedLabels.close}
            title={mergedLabels.close}
          >
            <span className="material-symbols-outlined" aria-hidden="true">close</span>
          </button>
        </div>

        <div
          id={descriptionId}
          data-testid="guided-tour-description"
          className="mt-3 text-sm font-bold leading-7 text-[var(--text-secondary)]"
        >
          {currentStep.description}
        </div>

        <div className="mt-5 flex flex-wrap items-center gap-2">
          {!isFirstStep && (
            <button
              type="button"
              data-testid="guided-tour-previous"
              onClick={goPrevious}
              className="btn-secondary min-w-24 flex-1"
            >
              {mergedLabels.previous}
            </button>
          )}

          <button
            type="button"
            data-testid="guided-tour-skip"
            onClick={skipTour}
            className="btn-ghost min-w-20 flex-1"
          >
            {mergedLabels.skip}
          </button>

          {isLastStep ? (
            <button
              type="button"
              data-testid="guided-tour-finish"
              onClick={() => exitTour({ status: 'completed' })}
              className="btn-primary min-w-24 flex-[2]"
            >
              {mergedLabels.finish}
            </button>
          ) : (
            <button
              type="button"
              data-testid="guided-tour-next"
              onClick={goNext}
              className="btn-primary min-w-24 flex-[2]"
            >
              {mergedLabels.next}
            </button>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
};

export default GuidedTour;
