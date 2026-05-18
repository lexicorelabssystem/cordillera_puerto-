import { Module } from "@nestjs/common";
import { QuestionBankController } from "./question-bank.controller.js";
import { QuestionBankService } from "./question-bank.service.js";

@Module({
  controllers: [QuestionBankController],
  providers: [QuestionBankService],
  exports: [QuestionBankService],
})
export class QuestionBankModule {}
