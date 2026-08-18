// src/firebase.js
import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: 'twcu-9078b.firebaseapp.com',
    projectId: 'twcu-9078b',
    storageBucket: 'twcu-9078b.firebasestorage.app',
    messagingSenderId: '465486138411',
    appId: '1:465486138411:web:afc105a4d80ee885f2ee6e',
    measurementId: 'G-0J64N7C9M9',
};

const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);

// Analytics uygulamanın çalışması için gerekli değil. Statik olarak
// içe aktarıldığında ~200 kB'lık paketi bildirim sayfasının kritik yoluna
// sokuyordu; ayrıca API anahtarının izin verdiği alan adları dışında
// (localhost, önizleme ortamları) her açılışta konsola 403 hatası düşüyordu.
// Bu yüzden yalnızca yayındaki alan adında ve ayrı bir parça olarak yüklenir.
const ANALYTICS_HOSTS = ['antobvb66.github.io'];

if (typeof window !== 'undefined' && ANALYTICS_HOSTS.includes(window.location.hostname)) {
    import('firebase/analytics')
        .then(({ getAnalytics, isSupported }) => isSupported().then((ok) => ok && getAnalytics(app)))
        .catch(() => {});
}
