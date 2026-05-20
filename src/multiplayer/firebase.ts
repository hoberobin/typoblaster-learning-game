import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyC6tE_SpSW7ZJ1lJshVpkmTV-pzmVvf5dA",
  authDomain: "flies-eb316.firebaseapp.com",
  projectId: "flies-eb316",
  storageBucket: "flies-eb316.firebasestorage.app",
  messagingSenderId: "954268433868",
  appId: "1:954268433868:web:226e46fa1d90f336b37169",
};

export const firebaseApp = initializeApp(firebaseConfig);
export const db = getFirestore(firebaseApp);
