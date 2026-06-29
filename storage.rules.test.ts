import {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
  type RulesTestContext,
  type RulesTestEnvironment
} from "@firebase/rules-unit-testing";
import { readFileSync } from "node:fs";

const PROJECT_ID = "firewatch-storage-test";
const BUCKET_URL = `gs://${PROJECT_ID}`;

let testEnv: RulesTestEnvironment;

function imageBytes(size: number): Uint8Array {
  return new Uint8Array(size).fill(1);
}

function uploadObject(
  storage: ReturnType<RulesTestContext["storage"]>,
  path: string,
  size: number,
  contentType: string
): Promise<unknown> {
  const task = storage.ref(path).put(imageBytes(size), { contentType });

  return new Promise((resolve, reject) => {
    task.then((snapshot) => resolve(snapshot), reject);
  });
}

beforeAll(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    storage: {
      rules: readFileSync("storage.rules", "utf8"),
      host: "127.0.0.1",
      port: 9199
    }
  });
});

afterAll(async () => {
  await testEnv.cleanup();
});

describe("storage security rules", () => {
  it("allows authenticated users to upload image files to their own reportImages path", async () => {
    const storage = testEnv.authenticatedContext("user-a").storage(BUCKET_URL);

    await assertSucceeds(
      uploadObject(storage, "reportImages/user-a/own-image.jpg", 1024, "image/jpeg")
    );
  });

  it("blocks unauthenticated report image uploads", async () => {
    const storage = testEnv.unauthenticatedContext().storage(BUCKET_URL);

    await assertFails(
      uploadObject(storage, "reportImages/user-a/unauth-image.jpg", 1024, "image/jpeg")
    );
  });

  it("blocks uploads to another user's reportImages path", async () => {
    const storage = testEnv.authenticatedContext("user-a").storage(BUCKET_URL);

    await assertFails(
      uploadObject(storage, "reportImages/user-b/wrong-owner.jpg", 1024, "image/jpeg")
    );
  });

  it("blocks non-image uploads and over-limit image uploads", async () => {
    const storage = testEnv.authenticatedContext("user-a").storage(BUCKET_URL);

    await assertFails(
      uploadObject(storage, "reportImages/user-a/not-image.pdf", 1024, "application/pdf")
    );

    await assertFails(
      uploadObject(storage, "reportImages/user-a/too-large.jpg", 500 * 1024 + 1, "image/jpeg")
    );
  });

  it("blocks client delete operations for report images", async () => {
    const storage = testEnv.authenticatedContext("user-a").storage(BUCKET_URL);
    const imageRef = storage.ref("reportImages/user-a/delete-blocked.jpg");

    await assertSucceeds(
      uploadObject(storage, "reportImages/user-a/delete-blocked.jpg", 1024, "image/jpeg")
    );

    await assertFails(imageRef.delete());
  });
});
