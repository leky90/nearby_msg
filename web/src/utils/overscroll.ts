/**
 * Overscroll behavior utilities
 * Prevents browser pull-to-refresh and other unwanted scroll behaviors
 */

/**
 * Applies overscroll containment to an element
 * @param element - The element to apply overscroll behavior to
 */
export function applyOverscrollContainment(element: HTMLElement): void {
  element.style.overscrollBehaviorY = 'contain';
  element.style.overscrollBehaviorX = 'none';
}

/**
 * Removes overscroll containment from an element
 * @param element - The element to remove overscroll behavior from
 */
export function removeOverscrollContainment(element: HTMLElement): void {
  element.style.overscrollBehaviorY = '';
  element.style.overscrollBehaviorX = '';
}

/**
 * Checks if overscroll behavior is supported
 */
export function isOverscrollBehaviorSupported(): boolean {
  return 'overscrollBehavior' in document.documentElement.style;
}

