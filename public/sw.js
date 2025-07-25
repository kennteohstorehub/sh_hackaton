// Service Worker for StoreHub Queue Management System
// Handles push notifications for queue updates

self.addEventListener('install', event => {
  console.log('Service Worker installing...');
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  console.log('Service Worker activated');
  event.waitUntil(clients.claim());
});

// Handle push notifications
self.addEventListener('push', event => {
  console.log('Push notification received');
  
  let notificationData = {
    title: 'StoreHub Queue Update',
    body: 'You have a queue update',
    icon: '/images/notification-icon.png',
    badge: '/images/notification-badge.png',
    tag: 'queue-notification',
    requireInteraction: true,
    vibrate: [200, 100, 200]
  };

  // Parse the push data if available
  if (event.data) {
    try {
      const data = event.data.json();
      notificationData = {
        title: data.title || notificationData.title,
        body: data.body || notificationData.body,
        icon: data.icon || notificationData.icon,
        badge: data.badge || notificationData.badge,
        tag: data.tag || `queue-${Date.now()}`,
        requireInteraction: true,
        vibrate: [200, 100, 200],
        data: data.data || {},
        actions: data.actions || []
      };
    } catch (e) {
      console.error('Error parsing push data:', e);
    }
  }

  event.waitUntil(
    self.registration.showNotification(notificationData.title, notificationData)
  );
});

// Handle notification clicks
self.addEventListener('notificationclick', event => {
  console.log('Notification clicked');
  event.notification.close();

  // Handle action buttons
  if (event.action === 'view') {
    // Open the queue status page
    event.waitUntil(
      clients.openWindow('/queue-status')
    );
  } else if (event.action === 'dismiss') {
    // Just close the notification
    event.notification.close();
  } else {
    // Default action - open the main page
    event.waitUntil(
      clients.matchAll({ type: 'window' }).then(clientList => {
        // Check if there's already a window open
        for (const client of clientList) {
          if (client.url.includes('/queue') && 'focus' in client) {
            return client.focus();
          }
        }
        // If no window is open, open a new one
        if (clients.openWindow) {
          return clients.openWindow('/');
        }
      })
    );
  }
});

// Background sync for offline capability
self.addEventListener('sync', event => {
  if (event.tag === 'queue-status-sync') {
    event.waitUntil(syncQueueStatus());
  }
});

async function syncQueueStatus() {
  try {
    // This would sync queue status when back online
    console.log('Syncing queue status...');
  } catch (error) {
    console.error('Sync failed:', error);
  }
}