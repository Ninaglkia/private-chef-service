// Minimal service worker — exists only to make the site installable as a PWA.
//
// IMPORTANT: we deliberately do NOT cache anything. This is an admin/booking
// app: the panel must always show fresh bookings, and a stale cache would be a
// bug, not a feature. Offline support adds no value here, so every request is a
// plain network passthrough. The presence of a registered SW + a fetch handler
// is what satisfies the installability criteria on Android/desktop Chrome; iOS
// adds the app to the Home Screen from the manifest + apple-touch-icon alone.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', () => { /* network passthrough; no caching */ });
