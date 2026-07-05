import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

// Ensure import.meta.env is defined before importing api.ts
vi.stubGlobal("import", { meta: { env: { VITE_API_BASE_URL: "/api/v1", PROD: false } } });

import { api, setSessionExpiredHandler, clearAuthTokens } from "../api";

const API_BASE = "/api/v1";

function mockJsonHeaders() {
  return new Headers({ "content-type": "application/json" });
}

function mockFetchResponse(body: unknown, status = 200, ok = true) {
  mockFetch.mockResolvedValueOnce({
    ok,
    status,
    headers: mockJsonHeaders(),
    json: vi.fn().mockResolvedValue(body),
  });
}

function mockFetchReject(error: Error) {
  mockFetch.mockRejectedValueOnce(error);
}

beforeEach(() => {
  mockFetch.mockClear();
  clearAuthTokens();
});

afterEach(() => {
  vi.clearAllMocks();
});

describe("api", () => {
  describe("login", () => {
    it("llama a fetch con el endpoint correcto y credenciales", async () => {
      const mockUser = { sub: "u1", role: "SUPER_ADMIN", name: "Admin", email: "admin@cordillera.cl", mustChangePassword: false };
      mockFetchResponse({ user: mockUser });

      await api.login({ email: "admin@cordillera.cl", password: "Admin123*" });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${API_BASE}/auth/login`);
      expect(options.method).toBe("POST");
      expect(options.credentials).toBe("include");
      expect(options.body).toBe(JSON.stringify({ email: "admin@cordillera.cl", password: "Admin123*" }));
    });

    it("lanza error con mensaje del servidor cuando credenciales invalidas", async () => {
      mockFetchResponse({ message: "Credenciales invalidas" }, 401, false);

      await expect(
        api.login({ email: "wrong@test.cl", password: "wrong" }),
      ).rejects.toThrow("Credenciales invalidas");
    });

    it("lanza error de servidor para status 500", async () => {
      mockFetchResponse({}, 500, false);

      await expect(
        api.login({ email: "a@b.cl", password: "pw" }),
      ).rejects.toThrow("Servidor no disponible temporalmente");
    });

    it("lanza error generico para status no manejado", async () => {
      mockFetchResponse({}, 403, false);

      await expect(
        api.login({ email: "a@b.cl", password: "pw" }),
      ).rejects.toThrow("Solicitud fallida (403)");
    });

    it("no intenta refrescar sesion en login 401 (login esta en NO_REFRESH)", async () => {
      mockFetchResponse({ message: "Credenciales invalidas" }, 401, false);

      await expect(
        api.login({ email: "t@c.cl", password: "pw" }),
      ).rejects.toThrow("Credenciales invalidas");

      // Solo 1 llamada fetch — no refresh
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });
  });

  describe("listAssessments", () => {
    it("llama con query params correctos cuando se pasa assessmentType", async () => {
      const mockData = [{ assessment_id: "a1", title: "Ensayo 1", assessment_type: "SIMCE" }];
      mockFetchResponse({ data: mockData });

      const result = await api.listAssessments({ assessmentType: "SIMCE" });

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain(`${API_BASE}/assessments`);
      expect(url).toContain("assessmentType=SIMCE");
      expect(result).toEqual(mockData);
    });

    it("llama sin query params cuando no se pasan filtros", async () => {
      const mockData = [
        { assessment_id: "a1", title: "Prueba 1" },
        { assessment_id: "a2", title: "Prueba 2" },
      ];
      mockFetchResponse({ data: mockData });

      const result = await api.listAssessments();

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(`${API_BASE}/assessments`);
      expect(result.length).toBe(2);
    });

    it("omite parametros undefined o vacios", async () => {
      mockFetchResponse({ data: [] });

      await api.listAssessments({ assessmentType: undefined, status: "" });

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(`${API_BASE}/assessments`);
      expect(url).not.toContain("assessmentType=");
      expect(url).not.toContain("status=");
    });

    it("maneja combinacion de filtros", async () => {
      mockFetchResponse({ data: [] });

      await api.listAssessments({ assessmentType: "SIMCE", status: "PUBLISHED" });

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("assessmentType=SIMCE");
      expect(url).toContain("status=PUBLISHED");
    });
  });

  describe("getCourseGradeBook", () => {
    const mockGradeBook = {
      course: { id: "c1", name: "4° Basico A", gradeLevel: 4 },
      subjectId: "s1",
      assessments: [],
      students: [],
      stats: { courseAvg: 5.5, approvalRate: 80, approvedCount: 20, atRiskCount: 2, pendingsCount: 1, totalNotes: 100, totalStudents: 25, totalAssessments: 8, simceCount: 0, appliedCount: 6 },
      oaDescendidos: [],
    };

    it("llama al endpoint del libro de calificaciones con courseId", async () => {
      mockFetchResponse(mockGradeBook);

      const result = await api.getCourseGradeBook("c1");

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(`${API_BASE}/grading/course-book/c1`);
      expect(result.course.id).toBe("c1");
    });

    it("llama con subjectId como query param cuando se proporciona", async () => {
      mockFetchResponse(mockGradeBook);

      await api.getCourseGradeBook("c1", { subjectId: "s1" });

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("subjectId=s1");
    });

    it("devuelve la data completa con estudiantes y estadisticas", async () => {
      mockFetchResponse(mockGradeBook);

      const result = await api.getCourseGradeBook("c1");

      expect(result.stats.courseAvg).toBe(5.5);
      expect(result.stats.totalStudents).toBe(25);
      expect(result.course.name).toBe("4° Basico A");
    });

    it("maneja error cuando el curso no existe", async () => {
      mockFetchResponse({ message: "Curso no encontrado" }, 404, false);

      await expect(
        api.getCourseGradeBook("invalid-id"),
      ).rejects.toThrow("Curso no encontrado");
    });
  });

  describe("getStudent", () => {
    it("llama al endpoint de estudiante con el id correcto", async () => {
      const mockStudent = { id: "s1", first_name: "Juan", last_name: "Perez" };
      mockFetchResponse(mockStudent);

      const result = await api.getStudent("s1");

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(`${API_BASE}/students/s1`);
      expect(result.first_name).toBe("Juan");
    });
  });

  describe("getAttendanceStats", () => {
    it("llama al endpoint de estadisticas de asistencia", async () => {
      const mockStats = { studentId: "s1", total: 40, present: 35, absent: 5, late: 0, justified: 0, excused: 0, attendanceRate: 87.5, absenceRate: 12.5, atRisk: false };
      mockFetchResponse(mockStats);

      const result = await api.getAttendanceStats("s1");

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(`${API_BASE}/attendance/stats/s1`);
      expect(result.attendanceRate).toBe(87.5);
    });
  });

  describe("listObservations", () => {
    it("llama con query params de filtro", async () => {
      const mockObs = [{ id: "o1", title: "Obs 1" }];
      mockFetchResponse(mockObs);

      await api.listObservations({ studentId: "s1", type: "ACADEMIC" });

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("studentId=s1");
      expect(url).toContain("type=ACADEMIC");
    });

    it("llama sin params cuando no se pasan filtros", async () => {
      mockFetchResponse([]);

      await api.listObservations();

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(`${API_BASE}/observations`);
    });
  });

  describe("me", () => {
    it("llama al endpoint auth/me", async () => {
      const mockUser = { user: { sub: "u1", role: "TEACHER", name: "T", email: "t@c.cl", mustChangePassword: false } };
      mockFetchResponse(mockUser);

      const result = await api.me();

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toBe(`${API_BASE}/auth/me`);
      expect(result.user.role).toBe("TEACHER");
    });
  });

  describe("logout", () => {
    it("llama al endpoint de logout", async () => {
      mockFetchResponse(null, 204);

      await api.logout();

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${API_BASE}/auth/logout`);
      expect(options.method).toBe("POST");
    });

    it("no lanza error si el logout falla", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Red no disponible"));

      await expect(api.logout()).resolves.toBeUndefined();
    });
  });

  describe("changePassword", () => {
    it("llama al endpoint de cambio de clave con los datos", async () => {
      const mockUser = { user: { sub: "u1", role: "TEACHER", name: "T", email: "t@c.cl", mustChangePassword: false } };
      mockFetchResponse(mockUser);

      await api.changePassword({ currentPassword: "old", newPassword: "new" });

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${API_BASE}/auth/change-password`);
      expect(options.body).toBe(JSON.stringify({ currentPassword: "old", newPassword: "new" }));
    });
  });

  describe("listUsers", () => {
    it("llama con parametros de paginacion y busqueda", async () => {
      mockFetchResponse({ data: [], total: 0, page: 1, limit: 10 });

      await api.listUsers({ page: 1, limit: 10, role: "TEACHER", search: "juan" });

      const [url] = mockFetch.mock.calls[0] as [string];
      expect(url).toContain("page=1");
      expect(url).toContain("limit=10");
      expect(url).toContain("role=TEACHER");
      expect(url).toContain("search=juan");
    });
  });

  describe("createUser", () => {
    it("llama al endpoint de creacion de usuario", async () => {
      mockFetchResponse({ id: "u1", firstName: "Nuevo", lastName: "User" });

      await api.createUser({
        firstName: "Nuevo",
        lastName: "User",
        email: "nuevo@school.cl",
        temporaryPassword: "Temp123*",
        role: "TEACHER",
        institutionId: "inst-1",
      });

      const [url, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(url).toBe(`${API_BASE}/users`);
      expect(options.method).toBe("POST");
      const body = JSON.parse(options.body as string);
      expect(body.firstName).toBe("Nuevo");
      expect(body.role).toBe("TEACHER");
    });
  });

  describe("setSessionExpiredHandler", () => {
    it("llama al handler cuando la sesion expira y el refresh falla", async () => {
      const onExpired = vi.fn();
      setSessionExpiredHandler(onExpired);

      // me() → 401 → refresh fails → onExpired called
      mockFetchResponse({}, 401, false);
      mockFetchResponse({}, 401, false);

      await expect(api.me()).rejects.toThrow("Sesion expirada");

      expect(onExpired).toHaveBeenCalledTimes(1);
    });
  });

  describe("error handling general", () => {
    it("lanza error con mensaje del servidor cuando response.json tiene message", async () => {
      mockFetchResponse({ message: "Error personalizado del servidor" }, 400, false);

      await expect(api.me()).rejects.toThrow("Error personalizado del servidor");
    });

    it("lanza error generico cuando response.json no tiene message", async () => {
      mockFetchResponse({ error: "algo" }, 422, false);

      await expect(api.me()).rejects.toThrow("Solicitud fallida (422)");
    });

    it("lanza error generico cuando response.json falla", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        headers: mockJsonHeaders(),
        json: vi.fn().mockRejectedValue(new Error("JSON parse error")),
      });

      await expect(api.me()).rejects.toThrow("Solicitud fallida (400)");
    });
  });
});
