"use client";

import { initializeApp, type FirebaseApp } from "firebase/app";
import {
  ReCaptchaV3Provider,
  getToken,
  initializeAppCheck,
  type AppCheck
} from "firebase/app-check";
import {
  connectAuthEmulator,
  getAuth,
  signInAnonymously,
  type Auth
} from "firebase/auth";
import {
  connectFirestoreEmulator,
  getFirestore,
  type Firestore
} from "firebase/firestore";
import {
  connectFunctionsEmulator,
  getFunctions,
  type Functions
} from "firebase/functions";
import {
  connectStorageEmulator,
  getStorage,
  type FirebaseStorage
} from "firebase/storage";
import {
  getFirebaseAppCheckSiteKey,
  getFirebasePublicConfig,
  shouldUseFirebaseEmulators
} from "@/lib/firebase/config";

let firebaseApp: FirebaseApp | null = null;
let firebaseAppCheck: AppCheck | null = null;
let firebaseEmulatorsConnected = false;

interface FirebaseServices {
  app: FirebaseApp;
  auth: Auth;
  firestore: Firestore;
  functions: Functions;
  storage: FirebaseStorage;
}

export function getFirebaseApp(): FirebaseApp | null {
  const config = getFirebasePublicConfig();
  if (!config) {
    return null;
  }

  firebaseApp ??= initializeApp(config);
  return firebaseApp;
}

function connectEmulators(services: FirebaseServices): void {
  if (!shouldUseFirebaseEmulators() || firebaseEmulatorsConnected) {
    return;
  }

  connectAuthEmulator(services.auth, "http://127.0.0.1:9099", {
    disableWarnings: true
  });
  connectFirestoreEmulator(services.firestore, "127.0.0.1", 8080);
  connectFunctionsEmulator(services.functions, "127.0.0.1", 5001);
  connectStorageEmulator(services.storage, "127.0.0.1", 9199);
  firebaseEmulatorsConnected = true;
}

export function getFirebaseServices(): FirebaseServices | null {
  const app = getFirebaseApp();
  if (!app) {
    return null;
  }

  const services = {
    app,
    auth: getAuth(app),
    firestore: getFirestore(app),
    functions: getFunctions(app, "asia-southeast1"),
    storage: getStorage(app)
  };

  connectEmulators(services);
  return services;
}

export function getFirebaseAppCheck(): AppCheck | null {
  const app = getFirebaseApp();
  const siteKey = getFirebaseAppCheckSiteKey();
  if (!app || !siteKey) {
    return null;
  }

  firebaseAppCheck ??= initializeAppCheck(app, {
    provider: new ReCaptchaV3Provider(siteKey),
    isTokenAutoRefreshEnabled: true
  });

  return firebaseAppCheck;
}

export async function ensureAppCheckToken(): Promise<void> {
  const appCheck = getFirebaseAppCheck();
  if (!appCheck) {
    throw new Error(
      "Firebase App Check is not configured. Add NEXT_PUBLIC_FIREBASE_APPCHECK_SITE_KEY or switch to Local demo mode."
    );
  }

  try {
    await getToken(appCheck);
  } catch (error) {
    const reason = error instanceof Error ? error.message : "unknown error";
    throw new Error(`Firebase App Check could not issue a token: ${reason}`);
  }
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
