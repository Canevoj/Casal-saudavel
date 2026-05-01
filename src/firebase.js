import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDamSVK3GuRSDG4HRSH9HIT9KlcZ6y3qLI",
  authDomain: "casal-saudavel.firebaseapp.com",
  projectId: "casal-saudavel",
  storageBucket: "casal-saudavel.firebasestorage.app",
  messagingSenderId: "1079757704448",
  appId: "1:1079757704448:web:4e15dce09eea3dac20b7e5",
  measurementId: "G-TP8XB5T094"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
