"use client";

import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getFirebasePublicConfig } from "@/lib/firebase/config";

let firebaseApp: FirebaseApp | null = null;

export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebasePublicConfig();
  if (!config) {
    return null;
  }

  firebaseApp ??= initializeApp(config);
  return firebaseApp;
}

export function getFirebaseServices() {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  return {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    storage: getStorage(app)
  };
}

export async function ensureAnonymousSession(): Promise<string | null> {
  const services = getFirebaseServices();
  if (!services) {
    return null;
  }

  if (services.auth.currentUser) {
    return services.auth.currentUser.uid;
  }

  const credential = await signInAnonymously(services.auth);
  return credential.user.uid;
}
