"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const TILT_SELECTOR = "[data-tilt]";
const TILT_VARIABLES = [
  "--tilt-rotate-x",
  "--tilt-rotate-y",
  "--tilt-spot-x",
  "--tilt-spot-y",
] as const;

const clamp = (value: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, value));

function resetTilt(element: HTMLElement) {
  element.style.setProperty("--tilt-rotate-x", "0deg");
  element.style.setProperty("--tilt-rotate-y", "0deg");
  element.style.setProperty("--tilt-spot-x", "50%");
  element.style.setProperty("--tilt-spot-y", "50%");
}

/**
 * A progressively enhanced interaction layer. It only publishes state through
 * classes and CSS variables, leaving presentation and motion to CSS.
 */
export function ScrollFx() {
  const pathname = usePathname();

  useEffect(() => {
    const root = document.documentElement;
    root.classList.add("js-fx");
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const coarsePointer = window.matchMedia("(pointer: coarse), (hover: none)");
    const revealElements = Array.from(
      document.querySelectorAll<HTMLElement>("[data-reveal]"),
    );
    let revealObserver: IntersectionObserver | null = null;

    const revealEverything = () => {
      revealObserver?.disconnect();
      revealObserver = null;
      revealElements.forEach((element) => element.classList.add("in"));
    };

    if (reduceMotion.matches || !("IntersectionObserver" in window)) {
      revealEverything();
    } else {
      revealObserver = new IntersectionObserver(
        (entries) => {
          for (const entry of entries) {
            if (!entry.isIntersecting) continue;
            entry.target.classList.add("in");
            revealObserver?.unobserve(entry.target);
          }
        },
        { rootMargin: "0px 0px -6%", threshold: 0.12 },
      );
      revealElements.forEach((element) => revealObserver?.observe(element));
    }

    let pointerFrame = 0;
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let pointerInside = false;
    let pointerEnabled = false;
    let activeTilt: HTMLElement | null = null;
    let renderedTilt: HTMLElement | null = null;
    const touchedTiltElements = new Set<HTMLElement>();

    const writePointerState = () => {
      pointerFrame = 0;
      root.style.setProperty("--pointer-x", `${pointerX.toFixed(1)}px`);
      root.style.setProperty("--pointer-y", `${pointerY.toFixed(1)}px`);

      const pointedElement = pointerInside
        ? document.elementFromPoint(pointerX, pointerY)
        : null;
      activeTilt = pointedElement?.closest<HTMLElement>(TILT_SELECTOR) ?? null;

      if (renderedTilt && renderedTilt !== activeTilt) {
        resetTilt(renderedTilt);
      }

      renderedTilt = activeTilt;
      if (!activeTilt) return;

      const bounds = activeTilt.getBoundingClientRect();
      if (!bounds.width || !bounds.height) return;

      const localX = clamp((pointerX - bounds.left) / bounds.width);
      const localY = clamp((pointerY - bounds.top) / bounds.height);
      const requestedTilt = Number.parseFloat(activeTilt.dataset.tilt ?? "");
      const maxTilt = Number.isFinite(requestedTilt)
        ? clamp(requestedTilt, 0, 8)
        : 4;

      touchedTiltElements.add(activeTilt);
      activeTilt.style.setProperty(
        "--tilt-rotate-x",
        `${((0.5 - localY) * maxTilt * 2).toFixed(2)}deg`,
      );
      activeTilt.style.setProperty(
        "--tilt-rotate-y",
        `${((localX - 0.5) * maxTilt * 2).toFixed(2)}deg`,
      );
      activeTilt.style.setProperty("--tilt-spot-x", `${(localX * 100).toFixed(1)}%`);
      activeTilt.style.setProperty("--tilt-spot-y", `${(localY * 100).toFixed(1)}%`);
    };

    const requestPointerFrame = () => {
      if (!pointerEnabled || pointerFrame) return;
      pointerFrame = window.requestAnimationFrame(writePointerState);
    };

    const handlePointerMove = (event: PointerEvent) => {
      if (event.pointerType === "touch") return;
      pointerInside = true;
      pointerX = event.clientX;
      pointerY = event.clientY;
      requestPointerFrame();
    };

    const handlePointerExit = (event: PointerEvent) => {
      if (event.relatedTarget) return;
      pointerInside = false;
      pointerX = window.innerWidth / 2;
      pointerY = window.innerHeight / 2;
      activeTilt = null;
      requestPointerFrame();
    };

    const handleWindowBlur = () => {
      pointerInside = false;
      activeTilt = null;
      if (renderedTilt) resetTilt(renderedTilt);
      renderedTilt = null;
    };

    const enablePointerEffects = () => {
      if (pointerEnabled) return;
      pointerEnabled = true;
      window.addEventListener("pointermove", handlePointerMove, { passive: true });
      window.addEventListener("pointerout", handlePointerExit, { passive: true });
      window.addEventListener("blur", handleWindowBlur);
      requestPointerFrame();
    };

    const disablePointerEffects = () => {
      if (!pointerEnabled) return;
      pointerEnabled = false;
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerout", handlePointerExit);
      window.removeEventListener("blur", handleWindowBlur);
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      pointerFrame = 0;
      handleWindowBlur();
      root.style.setProperty("--pointer-x", "50vw");
      root.style.setProperty("--pointer-y", "50vh");
    };

    const syncMotionPreference = () => {
      if (reduceMotion.matches) revealEverything();
      if (reduceMotion.matches || coarsePointer.matches) {
        disablePointerEffects();
      } else {
        enablePointerEffects();
      }
    };

    root.style.setProperty("--pointer-x", "50vw");
    root.style.setProperty("--pointer-y", "50vh");
    syncMotionPreference();

    window.addEventListener("resize", requestPointerFrame, { passive: true });
    reduceMotion.addEventListener("change", syncMotionPreference);
    coarsePointer.addEventListener("change", syncMotionPreference);

    return () => {
      revealObserver?.disconnect();
      window.removeEventListener("resize", requestPointerFrame);
      reduceMotion.removeEventListener("change", syncMotionPreference);
      coarsePointer.removeEventListener("change", syncMotionPreference);
      disablePointerEffects();
      if (pointerFrame) window.cancelAnimationFrame(pointerFrame);
      root.style.removeProperty("--pointer-x");
      root.style.removeProperty("--pointer-y");
      touchedTiltElements.forEach((element) => {
        TILT_VARIABLES.forEach((property) => element.style.removeProperty(property));
      });
    };
  }, [pathname]);

  return null;
}
