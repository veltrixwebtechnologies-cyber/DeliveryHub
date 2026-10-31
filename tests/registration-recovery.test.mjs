import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import ts from "typescript";

const register = fs.readFileSync("src/routes/register.tsx", "utf8");
const auth = fs.readFileSync("src/routes/auth.tsx", "utf8");
const tree = ts.createSourceFile(
  "register.tsx",
  register,
  ts.ScriptTarget.Latest,
  true,
  ts.ScriptKind.TSX,
);
const names = new Set(["isValidIndianMobile", "isValidAdultDate", "isFutureDate", "draftPayload"]);
const pure = tree.statements
  .filter(
    (node) =>
      (ts.isFunctionDeclaration(node) && names.has(node.name?.text)) ||
      (ts.isVariableStatement(node) &&
        node.declarationList.declarations.some((d) => d.name.getText(tree) === "AUTOSAVE_FIELDS")),
  )
  .map((node) => node.getText(tree))
  .join("\n");
const js = ts.transpileModule(pure, {
  compilerOptions: { target: ts.ScriptTarget.ES2022 },
}).outputText;
const validators = new Function(
  `${js}; return {isValidIndianMobile,isValidAdultDate,isFutureDate,draftPayload};`,
)();

test("registration rejects missing/invalid mobile and underage DOB", () => {
  assert.equal(validators.isValidIndianMobile(""), false);
  assert.equal(validators.isValidIndianMobile("1234567890"), false);
  assert.equal(validators.isValidIndianMobile("9876543210"), true);
  assert.equal(validators.isValidAdultDate(""), false);
  assert.equal(validators.isValidAdultDate(`${new Date().getFullYear() - 17}-01-01`), false);
  assert.equal(validators.isValidAdultDate("1990-01-01"), true);
  assert.equal(validators.isFutureDate("2000-01-01"), false);
});

test("drafts preserve intentional clears and limit payload to onboarding fields", () => {
  const first = validators.draftPayload({ gender: "female", status: "approved" });
  const changed = validators.draftPayload({ gender: "female", emergency_contact_name: "Parent" });
  const delta = Object.fromEntries(
    Object.entries(changed).filter(([key, value]) => first[key] !== value),
  );
  assert.deepEqual(delta, { emergency_contact_name: "Parent" });
  assert.equal("insurance_expiry" in delta, false);
  assert.equal("status" in first, false);
  assert.equal(validators.draftPayload({ gender: "" }).gender, null);
});

test("recovery code must be verified before password-update flow", () => {
  assert.match(auth, /type: "recovery"/);
  assert.match(auth, /if \(!data.session\)/);
  assert.match(auth, /resetSent \? verifyRecoveryCode : sendResetEmail/);
  assert.match(auth, /supabase.auth.updateUser\(\{ password \}\)/);
  assert.match(register, /Save account details and continue/);
  assert.match(register, /saveQueue.current/);
});

test("database correction submits only after working preferences and preserves approval guard", () => {
  const sql = fs.readFileSync(
    "supabase/migrations/20261007190000_registration_draft_completion.sql",
    "utf8",
  );
  assert.match(sql, /NEW.registration_step >= 10/);
  assert.match(sql, /NEW.status := OLD.status/);
  assert.match(sql, /GRANT UPDATE \(insurance_expiry\)/);
});

test("request deadlines resolve normally, propagate failures, and bound hangs", async () => {
  const source = fs.readFileSync("src/shared/request-timeout.ts", "utf8");
  const output = ts.transpileModule(source, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ES2022 },
  }).outputText;
  const { withRequestTimeout } = await import(
    `data:text/javascript;base64,${Buffer.from(output).toString("base64")}`
  );
  assert.equal(await withRequestTimeout(Promise.resolve("loaded"), 100), "loaded");
  await assert.rejects(
    withRequestTimeout(Promise.reject(new Error("connection failed")), 100),
    /connection failed/,
  );
  await assert.rejects(withRequestTimeout(new Promise(() => {}), 10), /did not respond in time/);
});

test("registration distinguishes pending session from guest and provides recovery UI", () => {
  assert.match(register, /user === undefined, navigate, loadRevision/);
  assert.match(register, /if \(sessionError \|\| loadError\)/);
  assert.match(register, /Retry loading registration/);
  assert.match(register, /zoneResult.error/);
  assert.match(register, /partnerResult.error/);
  assert.match(register, /controller.abort\(\)/);
});

test("existing LocalShore identities require authentication and reuse partner records", () => {
  assert.match(register, /identities\?\.length === 0/);
  assert.match(register, /supabase.auth.signInWithPassword/);
  assert.match(register, /if \(prior && !existingPartner\)/);
  assert.match(register, /onDone\(prior\)/);
  assert.match(register, /Use your existing LocalShore account password/);
});
