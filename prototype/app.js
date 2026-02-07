/**
 * Lead CRM Prototype - Common JavaScript
 * Inspired by Zomato, Swiggy, Blinkit, Zepto
 */

// Prevent double-tap zoom on mobile
document.addEventListener('touchend', (e) => {
  e.preventDefault();
}, { passive: false });

// Re-enable normal touch behavior for inputs
document.querySelectorAll('input, textarea, a, button').forEach(el => {
  el.addEventListener('touchend', (e) => {
    e.stopPropagation();
  });
});

// Format currency (Indian style)
function formatCurrency(amount) {
  const num = parseInt(amount.toString().replace(/[^\d]/g, ''), 10);
  if (isNaN(num)) return '';
  return num.toLocaleString('en-IN');
}

// Format phone number
function formatPhone(phone) {
  const digits = phone.replace(/\D/g, '');
  if (digits.length > 5) {
    return digits.slice(0, 5) + ' ' + digits.slice(5, 10);
  }
  return digits;
}

// Haptic feedback (if available)
function haptic(type = 'light') {
  if ('vibrate' in navigator) {
    switch (type) {
      case 'light':
        navigator.vibrate(10);
        break;
      case 'medium':
        navigator.vibrate(20);
        break;
      case 'heavy':
        navigator.vibrate([30, 10, 30]);
        break;
      case 'success':
        navigator.vibrate([10, 50, 10, 50, 10]);
        break;
    }
  }
}

// Add ripple effect to buttons
function addRipple(element) {
  element.addEventListener('click', function(e) {
    const ripple = document.createElement('span');
    const rect = this.getBoundingClientRect();
    const size = Math.max(rect.width, rect.height);
    const x = e.clientX - rect.left - size / 2;
    const y = e.clientY - rect.top - size / 2;

    ripple.style.cssText = `
      position: absolute;
      width: ${size}px;
      height: ${size}px;
      left: ${x}px;
      top: ${y}px;
      background: rgba(255,255,255,0.3);
      border-radius: 50%;
      transform: scale(0);
      animation: ripple 0.6s ease-out;
      pointer-events: none;
    `;

    this.style.position = 'relative';
    this.style.overflow = 'hidden';
    this.appendChild(ripple);

    setTimeout(() => ripple.remove(), 600);
  });
}

// Initialize ripple on buttons
document.querySelectorAll('.btn, .action-button').forEach(addRipple);

// Add CSS for ripple animation
const style = document.createElement('style');
style.textContent = `
  @keyframes ripple {
    to {
      transform: scale(4);
      opacity: 0;
    }
  }
`;
document.head.appendChild(style);

// Handle back button
window.addEventListener('popstate', () => {
  // Add any cleanup here
});

// Service Worker Registration (for PWA capabilities)
if ('serviceWorker' in navigator) {
  // Commented out for prototype
  // navigator.serviceWorker.register('/sw.js');
}

// Prevent pull-to-refresh on mobile
document.body.addEventListener('touchmove', (e) => {
  if (document.body.scrollTop === 0) {
    // Allow normal scroll
  }
}, { passive: false });

// Loading state helper
function setLoading(button, isLoading) {
  if (isLoading) {
    button.dataset.originalText = button.innerHTML;
    button.innerHTML = `
      <svg class="animate-spin" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10" stroke-opacity="0.25"/>
        <path d="M12 2a10 10 0 0 1 10 10" stroke-linecap="round"/>
      </svg>
      Loading...
    `;
    button.disabled = true;
  } else {
    button.innerHTML = button.dataset.originalText;
    button.disabled = false;
  }
}

// Toast notification
function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.style.cssText = `
    position: fixed;
    bottom: 100px;
    left: 50%;
    transform: translateX(-50%);
    padding: 12px 24px;
    background: ${type === 'success' ? '#22c55e' : type === 'error' ? '#ef4444' : '#1e293b'};
    color: white;
    border-radius: 8px;
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0,0,0,0.15);
    z-index: 1000;
    animation: toast-in 0.3s ease;
  `;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'toast-out 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// Add toast animations
const toastStyle = document.createElement('style');
toastStyle.textContent = `
  @keyframes toast-in {
    from { opacity: 0; transform: translate(-50%, 20px); }
    to { opacity: 1; transform: translate(-50%, 0); }
  }
  @keyframes toast-out {
    from { opacity: 1; transform: translate(-50%, 0); }
    to { opacity: 0; transform: translate(-50%, 20px); }
  }
  @keyframes animate-spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }
  .animate-spin {
    animation: animate-spin 1s linear infinite;
  }
`;
document.head.appendChild(toastStyle);

// Console welcome message
console.log('%c Lead CRM Prototype ', 'background: #3b82f6; color: white; padding: 8px 16px; border-radius: 4px; font-weight: bold;');
console.log('Inspired by Zomato, Swiggy, Blinkit, Zepto');
console.log('Designed for sales staff with minimal training');
