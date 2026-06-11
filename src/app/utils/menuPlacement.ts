export type VerticalMenuPlacement = "up" | "down";

export function verticalMenuPlacementForButton(button: HTMLElement, estimatedMenuHeight = 260): VerticalMenuPlacement {
  const rect = button.getBoundingClientRect();
  const spaceBelow = window.innerHeight - rect.bottom;
  return spaceBelow < estimatedMenuHeight && rect.top > estimatedMenuHeight ? "up" : "down";
}

export function verticalMenuPlacementClass(placement: VerticalMenuPlacement) {
  return placement === "up" ? "bottom-full mb-1" : "top-full mt-1";
}
