// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: "twcu-9078b.firebaseapp.com",
  projectId: "twcu-9078b",
  storageBucket: "twcu-9078b.firebasestorage.app",
  messagingSenderId: "465486138411",
  appId: "1:465486138411:web:afc105a4d80ee885f2ee6e",
  measurementId: "G-0J64N7C9M9"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
export const db = getFirestore(app);