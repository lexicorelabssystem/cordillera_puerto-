import { PrismaClient } from "@prisma/client";
import { Client as MinioClient } from "minio";
import fs from "node:fs/promises";
import path from "node:path";

const prisma = new PrismaClient();
const dryRun = process.argv.includes("--dry-run");
const force = process.argv.includes("--force");

const documentsBucket = process.env.MINIO_DOCUMENTS_BUCKET || "educacore-documents";
const localUploadsPrefix = "/app/uploads/files/";

function parseBool(value) {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function requireEnv(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function extensionFor(asset) {
  const candidates = [asset.originalName, asset.fileName, asset.storagePath];
  for (const candidate of candidates) {
    const ext = path.extname(candidate || "").toLowerCase();
    if (ext) return ext;
  }
  if (asset.mimeType?.includes("pdf")) return ".pdf";
  if (asset.mimeType?.includes("wordprocessingml")) return ".docx";
  return ".bin";
}

function objectKeyFor(asset, duplicatedTemplateIds) {
  const templateId = asset.entityId;
  const ext = extensionFor(asset);
  if (duplicatedTemplateIds.has(templateId)) {
    return `assessment-templates/${templateId}/${asset.id}${ext}`;
  }
  return `assessment-templates/${templateId}/original${ext}`;
}

async function objectExists(client, bucket, objectKey) {
  try {
    await client.statObject(bucket, objectKey);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (process.env.STORAGE_DRIVER !== "minio") {
    throw new Error("STORAGE_DRIVER must be minio to run this migration");
  }

  const minio = new MinioClient({
    endPoint: requireEnv("MINIO_ENDPOINT"),
    port: Number(process.env.MINIO_PORT || "9000"),
    useSSL: parseBool(process.env.MINIO_USE_SSL),
    accessKey: requireEnv("MINIO_ACCESS_KEY"),
    secretKey: requireEnv("MINIO_SECRET_KEY"),
  });

  const assets = await prisma.fileAsset.findMany({
    where: {
      storageProvider: "local",
      entityType: "assessment-template",
      entityId: { not: null },
      storagePath: { startsWith: localUploadsPrefix },
    },
    orderBy: { createdAt: "asc" },
  });

  const templateCounts = new Map();
  for (const asset of assets) {
    templateCounts.set(asset.entityId, (templateCounts.get(asset.entityId) || 0) + 1);
  }
  const duplicatedTemplateIds = new Set(
    [...templateCounts.entries()].filter(([, count]) => count > 1).map(([templateId]) => templateId),
  );

  console.log(`Assessment template local sources found: ${assets.length}`);
  console.log(`Mode: ${dryRun ? "dry-run" : "migrate"}`);
  console.log(`Bucket: ${documentsBucket}`);
  if (duplicatedTemplateIds.size) {
    console.log(`Templates with multiple local source assets: ${duplicatedTemplateIds.size}`);
  }

  const summary = { migrated: 0, planned: 0, skipped: 0, failed: 0 };

  for (const asset of assets) {
    const objectKey = objectKeyFor(asset, duplicatedTemplateIds);
    const minioUri = `minio://${documentsBucket}/${objectKey}`;
    const label = `${asset.id} template=${asset.entityId} source=${asset.storagePath} target=${minioUri}`;

    try {
      const template = await prisma.assessmentTemplate.findUnique({
        where: { id: asset.entityId },
        select: { id: true, sourceFileId: true, title: true },
      });

      if (!template) {
        summary.skipped += 1;
        console.warn(`SKIP missing template ${label}`);
        continue;
      }

      const stat = await fs.stat(asset.storagePath);
      if (!stat.isFile()) {
        summary.skipped += 1;
        console.warn(`SKIP not a file ${label}`);
        continue;
      }

      if (stat.size !== asset.size) {
        console.warn(`WARN size mismatch asset=${asset.size} disk=${stat.size} ${label}`);
      }

      const exists = await objectExists(minio, documentsBucket, objectKey);
      if (exists && !force) {
        summary.skipped += 1;
        console.warn(`SKIP target exists, pass --force to overwrite ${label}`);
        continue;
      }

      if (dryRun) {
        summary.planned += 1;
        console.log(`PLAN ${label} size=${stat.size} title="${template.title || ""}"`);
        continue;
      }

      const data = await fs.readFile(asset.storagePath);
      await minio.putObject(documentsBucket, objectKey, data, data.length, {
        "Content-Type": asset.mimeType,
      });

      await prisma.fileAsset.update({
        where: { id: asset.id },
        data: {
          storageProvider: "minio",
          bucket: documentsBucket,
          objectKey,
          storagePath: minioUri,
        },
      });

      if (!template.sourceFileId) {
        await prisma.assessmentTemplate.update({
          where: { id: template.id },
          data: { sourceFileId: asset.id },
        });
      }

      summary.migrated += 1;
      console.log(`OK ${label} size=${data.length}`);
    } catch (error) {
      summary.failed += 1;
      console.error(`FAIL ${label}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  console.log("Summary:", summary);
  if (summary.failed > 0) process.exitCode = 1;
}

main()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
