importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/11.10.0/firebase-messaging-compat.js');

// Valeurs copiées depuis .env.local — identifiants publics côté client
firebase.initializeApp({
  apiKey:            'AIzaSyC1O7mNjEa2kVdoXGgyp3gxheRluxEDrck',
  authDomain:        'voisinage-v2.firebaseapp.com',
  projectId:         'voisinage-v2',
  storageBucket:     'voisinage-v2.firebasestorage.app',
  messagingSenderId: '990660785356',
  appId:             '1:990660785356:web:48dde2c6e7b3b9f5b73e69',
});

firebase.messaging().onBackgroundMessage(payload => {
  self.registration.showNotification(
    payload.notification?.title ?? 'Voisinage',
    {
      body: payload.notification?.body ?? '',
      icon: '/icon-192.png',
    }
  );
});
