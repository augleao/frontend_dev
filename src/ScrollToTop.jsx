import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

// Scrolls window to top on every pathname change (ignores hash anchors)
export default function ScrollToTop({ behavior = 'auto' }) {
  const { pathname, hash } = useLocation();

  useEffect(() => {
    // If navigating to an in-page anchor, let the browser handle it
    if (hash && hash.length > 1) return;

    // Force scroll to top for new pages
    try {
      window.scrollTo({ top: 0, left: 0, behavior });
      // Also set both elements for broader compatibility
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    } catch (_) {
      // fallback without options
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;
    }
  }, [pathname, hash, behavior]);

  return null;
}
