import { Module } from "@nestjs/common";
import { ClassBookController } from "./class-book.controller.js";
import { ClassBookService } from "./class-book.service.js";

@Module({
  controllers: [ClassBookController],
  providers: [ClassBookService],
  exports: [ClassBookService],
})
export class ClassBookModule {}
