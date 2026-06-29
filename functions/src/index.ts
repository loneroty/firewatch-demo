import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  HttpsError,
  onCall,
  type FunctionsErrorCode
} from "firebase-functions/v2/https";
import { createReportForRequest } from "./createReport";
import { ReportFunctionError } from "./reportValidation";

initializeApp();

function toHttpsError(error: unknown): HttpsError {
  if (error instanceof ReportFunctionError) {
    return new HttpsError(error.code as FunctionsErrorCode, error.message);
  }

  return new HttpsError("internal", "Unable to create report.");
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
