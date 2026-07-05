import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import ts from "typescript";

const root = process.cwd();
const sourceRoot = path.join(root, "backend", "src");
const baselinePath = path.join(root, "scripts", "pagination-audit-baseline.json");
const updateBaseline = process.argv.includes("--update-baseline");

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return walk(full);
    return entry.isFile() && entry.name.endsWith(".service.ts") ? [full] : [];
  });
}

function enclosingMethod(node) {
  let current = node.parent;
  while (current) {
    if (ts.isMethodDeclaration(current) && current.name) return current.name.getText();
    if (ts.isFunctionDeclaration(current) && current.name) return current.name.getText();
    current = current.parent;
  }
  return "module-scope";
}

function modelName(call) {
  const access = call.expression.expression;
  if (!ts.isPropertyAccessExpression(access)) return "unknown";
  return access.name.getText();
}

function hasTopLevelTake(call) {
  const argument = call.arguments[0];
  if (!argument || !ts.isObjectLiteralExpression(argument)) return false;
  return argument.properties.some((property) =>
    ts.isPropertyAssignment(property) && property.name.getText().replace(/["']/g, "") === "take"
  );
}

function endpointMethodsFor(file) {
  const dir = path.dirname(file);
  const controllers = fs.readdirSync(dir).filter((name) => name.endsWith(".controller.ts"));
  const methods = new Set();
  for (const controller of controllers) {
    const text = fs.readFileSync(path.join(dir, controller), "utf8");
    for (const match of text.matchAll(/this\.[A-Za-z][A-Za-z0-9_]*\.(\w+)\s*\(/g)) methods.add(match[1]);
  }
  return methods;
}

const findings = [];
for (const file of walk(sourceRoot)) {
  const endpointMethods = endpointMethodsFor(file);
  const text = fs.readFileSync(file, "utf8");
  const source = ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS);
  const visit = (node) => {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.name.text === "findMany"
    ) {
      const normalized = node.getText(source).replace(/\s+/g, " ").trim();
      const relativeFile = path.relative(root, file).replaceAll("\\", "/");
      findings.push({
        fingerprint: crypto.createHash("sha256").update(`${relativeFile}:${normalized}`).digest("hex").slice(0, 16),
        file: relativeFile,
        line: source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1,
        method: enclosingMethod(node),
        model: modelName(node),
        bounded: hasTopLevelTake(node),
        endpointFacing: endpointMethods.has(enclosingMethod(node)),
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
}

const allUnbounded = findings.filter((item) => !item.bounded);
const unbounded = allUnbounded.filter((item) => item.endpointFacing);
let baseline = [];
if (fs.existsSync(baselinePath)) baseline = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
const approved = new Set(baseline.map((entry) => entry.fingerprint));
const unknown = unbounded.filter((item) => !approved.has(item.fingerprint));

if (updateBaseline) {
  const previous = new Map(baseline.map((entry) => [entry.fingerprint, entry]));
  const next = unbounded.map((item) => ({
    fingerprint: item.fingerprint,
    file: item.file,
    method: item.method,
    model: item.model,
    reason: previous.get(item.fingerprint)?.reason ?? "Reviewed existing query: constrained lookup, catalog, relation, or aggregate.",
  })).sort((a, b) => a.file.localeCompare(b.file) || a.method.localeCompare(b.method));
  fs.mkdirSync(path.dirname(baselinePath), { recursive: true });
  fs.writeFileSync(baselinePath, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`Pagination baseline updated: ${next.length} reviewed unbounded queries.`);
  process.exit(0);
}

console.log(`Prisma findMany audit: ${findings.length} total, ${findings.filter((item) => item.bounded).length} bounded, ${allUnbounded.length} internal/unbounded.`);
console.log(`Endpoint-facing unbounded queries: ${unbounded.length} reviewed, ${unknown.length} new or changed.`);
if (unknown.length) {
  console.error(`\nFound ${unknown.length} new or changed findMany call(s) without a top-level take:`);
  for (const item of unknown) {
    console.error(`- ${item.file}:${item.line} ${item.method}() -> ${item.model}.findMany()`);
  }
  console.error("\nAdd pagination/take, or review the query and update the baseline with npm run audit:pagination:baseline.");
  process.exit(1);
}
console.log("No new unbounded Prisma queries detected.");