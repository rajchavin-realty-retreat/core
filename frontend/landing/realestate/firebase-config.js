// firebase-config.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, GoogleAuthProvider } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-storage.js";

const firebaseConfig = {
  apiKey: "AIzaSyC14nnhMwORfMNdZ4-m2ubCNERz3hN3zBQ",
  authDomain: "realestate-rajchavin.firebaseapp.com",
  projectId: "realestate-rajchavin",
  storageBucket: "realestate-rajchavin.firebasestorage.app",
  messagingSenderId: "619098883430",
  appId: "1:619098883430:web:98e3d0e6bcde4b1a2134a7"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };