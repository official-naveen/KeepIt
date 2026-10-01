/**
 * Vercel Speed Insights Integration
 * Initializes Speed Insights for performance monitoring
 */

// Initialize Speed Insights queue
window.si = window.si || function () { (window.siq = window.siq || []).push(arguments); };

// Load Speed Insights script
(function() {
  const script = document.createElement('script');
  script.defer = true;
  script.src = '/_vercel/speed-insights/script.js';
  document.head.appendChild(script);
})();
