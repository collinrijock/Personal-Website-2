import { useState, useEffect } from 'react';
import { User } from '@firebase/auth';
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as firebaseSignOut, onAuthStateChanged } from '@firebase/auth';

const app = initializeApp({
    apiKey: "AIzaSyBjFT90dkEt-K6PliDtWqqUzDB3reueUCc",
    authDomain: "personalwebsite-c0722.firebaseapp.com",
    projectId: "personalwebsite-c0722",
    storageBucket: "personalwebsite-c0722.appspot.com",
    messagingSenderId: "661056509232",
    appId: "1:661056509232:web:caec6144629cb54eff24f5"
});

const auth = getAuth(app);

const provider = new GoogleAuthProvider();

const signIn = async () => {
  try {
    const result = await signInWithPopup(auth, provider);
    const userEmail = result.user.email;

    if (!userEmail?.endsWith('@lula.is')) {
      alert('Please use a lula.is domain email to sign in.');
      await firebaseSignOut(auth);
    }
  } catch (error: any) {
    if (error?.code === 'auth/popup-closed-by-user') {
      console.log('Popup closed by user.');
    } else {
      console.error('Error signing in:', error);
    }
  }
};

const signOut = () => firebaseSignOut(auth);

const observeAuthState = (callback: (user: User | null) => void) => {
    return onAuthStateChanged(auth, callback);
};

export const useFirebaseAuth = () => {
    const [user, setUser] = useState<User>();

    useEffect(() => {
        const unsubscribe = observeAuthState((user: any) => {
            return setUser(user);
        });

        return () => {
            unsubscribe();
        };
    }, []);

    return { user, signIn, signOut };
};