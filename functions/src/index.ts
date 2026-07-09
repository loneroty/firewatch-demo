import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type FunctionsErrorCode
} from "firebase-functions/v2/https";
import { confirmReportForRequest } from "./confirmReport";
import { createReportForRequest } from "./createReport";
import { flagReportForRequest } from "./flagReport";
import { moderateReportForRequest } from "./moderateReport";
import { ReportFunctionError } from "./reportValidation";

initializeApp();

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof ReportFunctionError) {
    return new HttpsError(error.code as FunctionsErrorCode, error.message);
  }

  return new HttpsError("internal", "Request failed.");
}

function getErrorLogContext(error: unknown): Record<string, string> {
  if (error instanceof ReportFunctionError) {
    return {
      code: error.code,
      message: error.message,
      name: error.name,
      stack: error.stack ?? ""
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      name: error.name,
      stack: error.stack ?? ""
    };
  }

  return {
    message: String(error),
    name: typeof error
  };
}

export const createReport = onCall(
  {
    region: "asia-southeast1",
    enforceAppCheck: true
  },
  async (request) => {
    try {
      return await createReportForRequest(
        {
          authUid: request.auth?.uid ?? null,
          payload: request.data
        },
        {
          db: getFirestore()
        }
      );
    } catch (error) {
      throw toHttpsError(error);
    }
  }
);

export const confirmReport = onCall(
  {
    region: "asia-southeast1",
    enforceAppCheck: true
  },
  async (request) => {
    try {
      return await confirmReportForRequest(
        {
          authUid: request.auth?.uid ?? null,
          payload: request.data
        },
        {
          db: getFirestore()
        }
      );
    } catch (error) {
      throw toHttpsError(error);
    }
  }
);

export const flagReport = onCall(
  {
    region: "asia-southeast1",
    enforceAppCheck: true
  },
  async (request) => {
    try {
      return await flagReportForRequest(
        {
          authUid: request.auth?.uid ?? null,
          payload: request.data
        },
        {
          db: getFirestore()
        }
      );
    } catch (error) {
      console.error("flagReport callable failed", getErrorLogContext(error));
      throw toHttpsError(error);
    }
  }
);

export const moderateReport = onCall(
  {
    region: "asia-southeast1",
    enforceAppCheck: true
  },
  async (request) => {
    try {
      return await moderateReportForRequest(
        {
          authUid: request.auth?.uid ?? null,
          payload: request.data
        },
        {
          db: getFirestore()
        }
      );
    } catch (error) {
      throw toHttpsError(error);
    }
  }
);
