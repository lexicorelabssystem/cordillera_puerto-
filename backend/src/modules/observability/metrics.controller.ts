import { Controller, Get, Header, VERSION_NEUTRAL, Version } from "@nestjs/common";
import { ApiExcludeEndpoint } from "@nestjs/swagger";
import { Public } from "../../common/decorators/public.decorator.js";
import { MetricsService } from "./metrics.service.js";

@Controller()
export class MetricsController {
  constructor(private readonly metrics: MetricsService) {}

  @Public()
  @Version(VERSION_NEUTRAL)
  @Get("metrics")
  @Header("Cache-Control", "no-store")
  @Header("Content-Type", "text/plain; version=0.0.4; charset=utf-8")
  @ApiExcludeEndpoint()
  async metricsEndpoint() {
    return this.metrics.render();
  }
}