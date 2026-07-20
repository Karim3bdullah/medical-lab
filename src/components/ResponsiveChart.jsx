import React, { useCallback, useLayoutEffect, useRef, useState } from 'react';

const toPositivePixel = (value) => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) return 0;
  return Math.max(1, Math.floor(numericValue));
};

const ResponsiveChart = ({ children, className = '', ariaLabel }) => {
  const containerRef = useRef(null);
  const [dimensions, setDimensions] = useState(null);

  const updateDimensions = useCallback((width, height) => {
    const nextWidth = toPositivePixel(width);
    const nextHeight = toPositivePixel(height);

    setDimensions((current) => {
      if (nextWidth === 0 || nextHeight === 0) return null;
      if (current?.width === nextWidth && current?.height === nextHeight) return current;
      return { width: nextWidth, height: nextHeight };
    });
  }, []);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;

    const measure = () => {
      const bounds = element.getBoundingClientRect();
      updateDimensions(bounds.width, bounds.height);
    };

    measure();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', measure);
      return () => window.removeEventListener('resize', measure);
    }

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      updateDimensions(entry.contentRect.width, entry.contentRect.height);
    });

    observer.observe(element);
    return () => observer.disconnect();
  }, [updateDimensions]);

  return (
    <div
      ref={containerRef}
      className={`relative min-w-0 ${className}`.trim()}
      role="img"
      aria-label={ariaLabel}
      aria-busy={!dimensions}
    >
      {dimensions ? children(dimensions) : (
        <div className="ui-surface-muted h-full w-full rounded-2xl" aria-hidden="true" />
      )}
    </div>
  );
};

export default ResponsiveChart;
