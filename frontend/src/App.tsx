import React, { useEffect } from 'react';
import { AuthProvider } from './context/AuthContext';
import { RouterProvider } from './context/RouterContext';
import { ToastProvider, toast } from './context/ToastContext';
import { AppRouter } from './app/AppRouter';

function GlobalValidationHandler() {
  useEffect(() => {
    let lastToastTime = 0;
    const handleInvalid = (e: Event) => {
      // Prevent browser default HTML5 validation tooltip bubble
      e.preventDefault();

      const target = e.target as HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement;
      if (!target) return;

      // Throttle rapid consecutive invalid events on submit
      const now = Date.now();
      if (now - lastToastTime < 500) return;
      lastToastTime = now;

      // Extract a clean label
      const label = target.labels?.[0]?.textContent || target.getAttribute('placeholder') || target.getAttribute('aria-label') || target.name || '';
      const cleanLabel = label.replace(/[*:]/g, '').trim();

      let msg = target.validationMessage || 'Please fill in this required field';
      if (target.validity.valueMissing) {
        msg = cleanLabel ? `Please enter ${cleanLabel}` : 'Please fill in this required field';
      } else if (target.validity.typeMismatch && target.type === 'email') {
        msg = 'Please enter a valid email address';
      } else if (target.validity.rangeUnderflow) {
        msg = `Value must be at least ${target.getAttribute('min')}`;
      } else if (target.validity.rangeOverflow) {
        msg = `Value cannot exceed ${target.getAttribute('max')}`;
      } else if (target.validity.tooShort) {
        msg = `Text must be at least ${target.getAttribute('minlength')} characters`;
      }

      toast.error(msg);
      target.focus();
    };

    window.addEventListener('invalid', handleInvalid, true);
    return () => {
      window.removeEventListener('invalid', handleInvalid, true);
    };
  }, []);

  return null;
}

export default function App() {
  return (
    <ToastProvider>
      <GlobalValidationHandler />
      <AuthProvider>
        <RouterProvider>
          <AppRouter />
        </RouterProvider>
      </AuthProvider>
    </ToastProvider>
  );
}

