import { Test, TestingModule } from "@nestjs/testing";
import { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module.js";

describe("App (e2e)", () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it("/health (GET) returns ok", async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: "GET",
      url: "/health",
    });
    expect(response.statusCode).toBe(200);
  });

  it("/api/docs (GET) returns swagger spec", async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: "GET",
      url: "/api/docs",
    });
    expect(response.statusCode).toBe(200);
  });

  it("/api/v1/auth/login (POST) rejects empty body", async () => {
    const response = await app.getHttpAdapter().getInstance().inject({
      method: "POST",
      url: "/api/v1/auth/login",
      payload: {},
    });
    expect(response.statusCode).toBe(400);
  });
});
