import { Module } from "@nestjs/common";
import { ImportsModule } from "./imports/imports.module.js";
import { ExportsModule } from "./exports/exports.module.js";
import { FilesModule } from "./files/files.module.js";

@Module({
  imports: [ImportsModule, ExportsModule, FilesModule],
  exports: [ImportsModule, ExportsModule, FilesModule],
})
export class DataOpsModule {}
