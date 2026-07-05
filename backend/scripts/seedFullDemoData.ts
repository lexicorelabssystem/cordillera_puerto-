/**
 * Carga datos demo para visualizar la plataforma completa.
 *
 * Uso:
 *   DRY_RUN=true npx tsx scripts/seedFullDemoData.ts
 *   npx tsx scripts/seedFullDemoData.ts
 *
 * El run real elimina alumnos no Alexis y deja 45 alumnos demo por curso.
 */

import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";
import "dotenv/config";

const prisma = new PrismaClient();

const DRY_RUN = process.env.DRY_RUN === "true";
const STUDENTS_PER_COURSE = 45;
const DEMO_MARKER = "DEMO_FULL_DATA";
const DEMO_PASSWORD = "Demo2026*";

const FIRST_NAMES = [
  "Alexis",
  "Almendra",
  "Vicente",
  "Franco",
  "Pablo",
  "Dante",
  "Genesis",
  "Debora",
  "Javiera",
  "Javier",
  "Guillermo",
  "Siomara",
  "Gustavo",
  "Ana",
  "Felipe",
  "Renata",
  "Matias",
  "Antonia",
  "Benjamin",
  "Camila",
  "Diego",
  "Emilia",
  "Fernanda",
  "Ignacio",
  "Josefa",
  "Lucas",
  "Martina",
  "Nicolas",
  "Sofia",
  "Tomas",
  "Valentina",
  "Agustin",
  "Catalina",
  "Daniel",
  "Florencia",
  "Isidora",
  "Martin",
  "Rafaela",
  "Sebastian",
  "Trinidad",
  "Amanda",
  "Cristobal",
  "Elisa",
  "Gabriel",
  "Joaquin",
];

const LAST_NAMES = [
  "Bravo Paredes",
  "Abad Lopez",
  "Araya Aguilera",
  "Bascunan Araya",
  "Campos Cortes",
  "Castro Andrade",
  "Dur Busqueno",
  "Fierro Guajardo",
  "Gutierrez Paredes",
  "Huencho Alarcon",
  "Isla Arteaga",
  "Jara Valenzuela",
  "Lara Garrido",
  "Montecinos Leal",
  "Pacheco Garrido",
  "Perez Valdivieso",
  "Quilapan Soto",
  "Rojas Mendez",
  "Salazar Rivas",
  "Tapia Morales",
  "Urrutia Campos",
  "Vargas Herrera",
  "Yanez Molina",
  "Zuniga Fuentes",
];

const OBSERVATION_TYPES = ["POSITIVE", "ACADEMIC", "GENERAL", "BEHAVIOR", "NEGATIVE"] as const;
const ASSESSMENT_TYPES = ["DIAGNOSTICA", "PROCESO", "CIERRE"] as const;

function slug(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ".")
    .replace(/^\.+|\.+$/g, "");
}

function dateFrom2026(month: number, day: number, hour = 12) {
  return new Date(Date.UTC(2026, month - 1, day, hour, 0, 0));
}

function chileanRut(seed: number) {
  const body = String(23_000_000 + seed).replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  const digits = "0123456789K";
  return `${body}-${digits[seed % digits.length]}`;
}

function gradeFor(courseIndex: number, studentIndex: number, assessmentIndex: number) {
  const raw = 4.1 + ((courseIndex * 7 + studentIndex * 5 + assessmentIndex * 9) % 29) / 10;
  return Math.min(7, Math.max(1, Number(raw.toFixed(1))));
}

function scoreFromGrade(grade: number) {
  const percentage = Math.round(((grade - 1) / 6) * 100);
  return {
    score: percentage,
    percentage,
  };
}

function answerPattern(studentIndex: number, questionIndex: number, assessmentIndex: number) {
  return (studentIndex + questionIndex + assessmentIndex) % 4 !== 0;
}

async function findOrCreateQuestion(
  subjectId: string,
  createdBy: string,
  assessmentTitle: string,
  questionIndex: number,
) {
  const statement = `${DEMO_MARKER} | ${assessmentTitle} | Pregunta ${questionIndex + 1}`;
  const existing = await prisma.question.findFirst({
    where: { subjectId, statement },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });

  if (existing) return existing;

  return prisma.question.create({
    data: {
      subjectId,
      type: "MULTIPLE_CHOICE",
      statement,
      explanation: "Respuesta revisada automaticamente desde alternativas.",
      difficulty: 2 + (questionIndex % 2),
      points: 1,
      createdBy,
      options: {
        create: [
          { text: "Alternativa A", isCorrect: questionIndex % 4 === 0, sortOrder: 1 },
          { text: "Alternativa B", isCorrect: questionIndex % 4 === 1, sortOrder: 2 },
          { text: "Alternativa C", isCorrect: questionIndex % 4 === 2, sortOrder: 3 },
          { text: "Alternativa D", isCorrect: questionIndex % 4 === 3, sortOrder: 4 },
        ],
      },
    },
    include: { options: { orderBy: { sortOrder: "asc" } } },
  });
}

async function cleanupDemoData(nonAlexisStudentIds: string[], nonAlexisUserIds: string[]) {
  await prisma.assessment.deleteMany({
    where: {
      OR: [
        { description: { contains: DEMO_MARKER } },
        { description: "Evaluacion de demostracion para completar notas de Alexis." },
      ],
    },
  });
  await prisma.observation.deleteMany({ where: { content: { contains: DEMO_MARKER } } });
  await prisma.classBookEntry.deleteMany({ where: { notes: { contains: DEMO_MARKER } } });
  await prisma.report.deleteMany({ where: { type: { startsWith: DEMO_MARKER } } });
  await prisma.importJob.deleteMany({ where: { entityType: { startsWith: DEMO_MARKER } } });
  await prisma.exportJob.deleteMany({ where: { entityType: { startsWith: DEMO_MARKER } } });
  await prisma.auditLog.deleteMany({ where: { action: { startsWith: DEMO_MARKER } } });

  if (nonAlexisStudentIds.length > 0) {
    await prisma.student.deleteMany({ where: { id: { in: nonAlexisStudentIds } } });
  }
  if (nonAlexisUserIds.length > 0) {
    await prisma.user.deleteMany({ where: { id: { in: nonAlexisUserIds }, role: "STUDENT" } });
  }
}

async function main() {
  console.log("=== CARGA DEMO COMPLETA ===");
  if (DRY_RUN) console.log("Modo simulacion: no se escribira en la base de datos.");

  const institution = await prisma.institution.findFirst({ orderBy: { createdAt: "asc" } });
  if (!institution) throw new Error("No encontre una institucion.");

  const recorder = await prisma.user.findFirst({
    where: { role: { in: ["SUPER_ADMIN", "ADMIN", "UTP", "TEACHER"] } },
    orderBy: { createdAt: "asc" },
  });
  if (!recorder)
    throw new Error("No encontre un usuario administrativo/docente para registrar datos.");

  const period = await prisma.period.findFirst({
    where: { status: { in: ["OPEN", "ACTIVE"] } },
    orderBy: { startDate: "asc" },
  });

  const courses = await prisma.course.findMany({
    where: { institutionId: institution.id, isActive: true },
    include: {
      teacherAssignments: {
        include: { teacher: true, subject: true },
        orderBy: { subject: { name: "asc" } },
      },
    },
    orderBy: [{ gradeLevel: "asc" }, { name: "asc" }],
  });

  if (courses.length === 0) throw new Error("No encontre cursos activos.");

  const allStudents = await prisma.student.findMany({
    select: { id: true, userId: true, firstName: true },
  });
  const nonAlexis = allStudents.filter(
    (student) => student.firstName.trim().toLowerCase() !== "alexis",
  );
  const nonAlexisStudentIds = nonAlexis.map((student) => student.id);
  const nonAlexisUserIds = nonAlexis.map((student) => student.userId).filter(Boolean) as string[];

  console.log(`Institucion: ${institution.name}`);
  console.log(`Cursos activos: ${courses.length}`);
  console.log(`Alumnos no Alexis a eliminar: ${nonAlexisStudentIds.length}`);
  console.log(`Meta de alumnos por curso: ${STUDENTS_PER_COURSE}`);

  if (DRY_RUN) {
    const assignments = courses.reduce(
      (total, course) => total + course.teacherAssignments.length,
      0,
    );
    console.log(`Asignaciones docente/asignatura disponibles: ${assignments}`);
    console.log(`Se generarian hasta ${courses.length * STUDENTS_PER_COURSE} matriculas activas.`);
    console.log(
      `Se generarian evaluaciones, notas, intentos online, asistencia, observaciones, libro, reportes e import/export.`,
    );
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  await cleanupDemoData(nonAlexisStudentIds, nonAlexisUserIds);

  let createdUsers = 0;
  let createdStudents = 0;
  let createdEnrollments = 0;
  let createdAssessments = 0;
  let createdGrades = 0;
  let createdAttempts = 0;
  let createdAttendance = 0;
  let createdObservations = 0;
  let createdClassEntries = 0;

  for (let courseIndex = 0; courseIndex < courses.length; courseIndex++) {
    const course = courses[courseIndex]!;
    const assignments = course.teacherAssignments.slice(0, 3);

    let roster = await prisma.enrollment.findMany({
      where: { courseId: course.id, isActive: true },
      include: { student: { include: { user: true } } },
      orderBy: { student: { lastName: "asc" } },
    });

    const hasAlexis = roster.some(
      (enrollment) => enrollment.student.firstName.trim().toLowerCase() === "alexis",
    );
    if (!hasAlexis) {
      const email = `alexis.${slug(course.name)}@demo.cordillera.cl`;
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          institutionId: institution.id,
          email,
          passwordHash,
          firstName: "Alexis",
          lastName: `Demo ${course.name}`,
          role: "STUDENT",
          isActive: true,
        },
        update: { isActive: true },
      });
      createdUsers++;

      const student =
        (await prisma.student.findFirst({ where: { userId: user.id } })) ??
        (await prisma.student.create({
          data: {
            userId: user.id,
            firstName: "Alexis",
            lastName: `Demo ${course.name}`,
            rut: chileanRut(courseIndex + 1),
            gender: courseIndex % 2 === 0 ? "M" : "F",
            birthDate: dateFrom2026(1, 10),
          },
        }));
      createdStudents++;

      await prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
        create: { studentId: student.id, courseId: course.id, isActive: true },
        update: { isActive: true },
      });
      createdEnrollments++;
    }

    roster = await prisma.enrollment.findMany({
      where: { courseId: course.id, isActive: true },
      include: { student: { include: { user: true } } },
      orderBy: { student: { lastName: "asc" } },
    });

    for (let i = 1; roster.length < STUDENTS_PER_COURSE; i++) {
      const firstName = FIRST_NAMES[(i + courseIndex) % FIRST_NAMES.length]!;
      const lastName = LAST_NAMES[(i + courseIndex * 3) % LAST_NAMES.length]!;
      const email = `demo.${slug(course.name)}.${String(i).padStart(2, "0")}@demo.cordillera.cl`;
      const user = await prisma.user.upsert({
        where: { email },
        create: {
          institutionId: institution.id,
          email,
          passwordHash,
          firstName,
          lastName,
          role: "STUDENT",
          isActive: true,
        },
        update: { firstName, lastName, isActive: true },
      });
      createdUsers++;

      const student =
        (await prisma.student.findFirst({ where: { userId: user.id } })) ??
        (await prisma.student.create({
          data: {
            userId: user.id,
            firstName,
            lastName,
            rut: chileanRut(courseIndex * 100 + i),
            gender: i % 2 === 0 ? "F" : "M",
            birthDate: dateFrom2026(1 + (i % 10), 5 + (i % 20)),
          },
        }));
      createdStudents++;

      await prisma.enrollment.upsert({
        where: { studentId_courseId: { studentId: student.id, courseId: course.id } },
        create: { studentId: student.id, courseId: course.id, isActive: true },
        update: { isActive: true },
      });
      createdEnrollments++;

      roster = await prisma.enrollment.findMany({
        where: { courseId: course.id, isActive: true },
        include: { student: { include: { user: true } } },
        orderBy: { student: { lastName: "asc" } },
      });
    }

    const students = roster.slice(0, STUDENTS_PER_COURSE).map((enrollment) => enrollment.student);
    console.log(`- ${course.name}: ${students.length} alumnos`);

    for (let assessmentIndex = 0; assessmentIndex < assignments.length; assessmentIndex++) {
      const assignment = assignments[assessmentIndex]!;
      const title = `Demo N${assessmentIndex + 1} ${assignment.subject.name} ${course.name}`;
      const assessment = await prisma.assessment.create({
        data: {
          courseId: course.id,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
          periodId: period?.id ?? null,
          title,
          description: `${DEMO_MARKER}: evaluacion online con correccion automatica.`,
          assessmentType: ASSESSMENT_TYPES[assessmentIndex % ASSESSMENT_TYPES.length],
          deliveryMode: "ONLINE",
          status: "GRADED",
          semester: assessmentIndex < 2 ? 1 : 2,
          maxScore: 4,
          weight: assessmentIndex === 0 ? 30 : 35,
          timeLimitMin: 45,
          startDate: dateFrom2026(4 + assessmentIndex, 8),
          endDate: dateFrom2026(4 + assessmentIndex, 15),
          createdBy: recorder.id,
          publishedAt: dateFrom2026(4 + assessmentIndex, 1),
          closedAt: dateFrom2026(4 + assessmentIndex, 16),
          gradingStartedAt: dateFrom2026(4 + assessmentIndex, 16, 13),
          gradedAt: dateFrom2026(4 + assessmentIndex, 16, 14),
          reportedAt: dateFrom2026(4 + assessmentIndex, 17),
        },
      });
      createdAssessments++;

      const questions = [];
      for (let questionIndex = 0; questionIndex < 4; questionIndex++) {
        const question = await findOrCreateQuestion(
          assignment.subjectId,
          recorder.id,
          title,
          questionIndex,
        );
        questions.push(question);
        await prisma.assessmentQuestion.upsert({
          where: {
            assessmentId_questionId: { assessmentId: assessment.id, questionId: question.id },
          },
          create: {
            assessmentId: assessment.id,
            questionId: question.id,
            sortOrder: questionIndex + 1,
            points: 1,
          },
          update: { sortOrder: questionIndex + 1, points: 1 },
        });
      }

      for (let studentIndex = 0; studentIndex < students.length; studentIndex++) {
        const student = students[studentIndex]!;
        const grade = gradeFor(courseIndex, studentIndex, assessmentIndex);
        const score = scoreFromGrade(grade);
        await prisma.grade.upsert({
          where: { assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id } },
          create: {
            assessmentId: assessment.id,
            studentId: student.id,
            grade,
            score: score.score,
            percentage: score.percentage,
            comments: `${DEMO_MARKER}: nota demo para libro y reportes.`,
            recordedBy: recorder.id,
          },
          update: {
            grade,
            score: score.score,
            percentage: score.percentage,
            comments: `${DEMO_MARKER}: nota demo para libro y reportes.`,
          },
        });
        createdGrades++;

        if (student.userId && studentIndex < 12 && assessmentIndex === 0) {
          let correctCount = 0;
          const attempt = await prisma.assessmentAttempt.upsert({
            where: {
              assessmentId_studentId: { assessmentId: assessment.id, studentId: student.id },
            },
            create: {
              assessmentId: assessment.id,
              studentId: student.id,
              userId: student.userId,
              status: "COMPLETED",
              startedAt: dateFrom2026(4, 8, 10),
              submittedAt: dateFrom2026(4, 8, 11),
              timeSpentSec: 2100 + studentIndex * 35,
              totalScore: 0,
              percentage: 0,
            },
            update: {
              status: "COMPLETED",
              submittedAt: dateFrom2026(4, 8, 11),
              timeSpentSec: 2100 + studentIndex * 35,
            },
          });
          createdAttempts++;

          for (let questionIndex = 0; questionIndex < questions.length; questionIndex++) {
            const question = questions[questionIndex]!;
            const correctOption = question.options.find((option) => option.isCorrect)!;
            const wrongOption = question.options.find((option) => !option.isCorrect)!;
            const isCorrect = answerPattern(studentIndex, questionIndex, assessmentIndex);
            if (isCorrect) correctCount++;
            await prisma.studentAnswer.upsert({
              where: { attemptId_questionId: { attemptId: attempt.id, questionId: question.id } },
              create: {
                attemptId: attempt.id,
                questionId: question.id,
                selectedOptionId: isCorrect ? correctOption.id : wrongOption.id,
                isCorrect,
                score: isCorrect ? 1 : 0,
                status: isCorrect ? "CORRECT" : "INCORRECT",
                isGraded: true,
              },
              update: {
                selectedOptionId: isCorrect ? correctOption.id : wrongOption.id,
                isCorrect,
                score: isCorrect ? 1 : 0,
                status: isCorrect ? "CORRECT" : "INCORRECT",
                isGraded: true,
              },
            });
          }

          await prisma.assessmentAttempt.update({
            where: { id: attempt.id },
            data: {
              totalScore: correctCount,
              percentage: Math.round((correctCount / questions.length) * 100),
            },
          });
        }
      }
    }

    const attendanceDates = Array.from({ length: 10 }, (_, index) => dateFrom2026(3, 4 + index));
    for (const [dateIndex, attendanceDate] of attendanceDates.entries()) {
      for (let studentIndex = 0; studentIndex < students.length; studentIndex++) {
        const student = students[studentIndex]!;
        const status =
          (studentIndex + dateIndex) % 17 === 0
            ? "ABSENT"
            : (studentIndex + dateIndex) % 11 === 0
              ? "LATE"
              : "PRESENT";
        await prisma.attendance.upsert({
          where: {
            studentId_courseId_date: {
              studentId: student.id,
              courseId: course.id,
              date: attendanceDate,
            },
          },
          create: {
            studentId: student.id,
            courseId: course.id,
            date: attendanceDate,
            status,
            recordedBy: recorder.id,
          },
          update: { status, recordedBy: recorder.id },
        });
        createdAttendance++;
      }
    }

    const mainAssignment = assignments[0];
    if (mainAssignment) {
      for (let i = 0; i < Math.min(6, students.length); i++) {
        await prisma.observation.create({
          data: {
            studentId: students[i]!.id,
            courseId: course.id,
            teacherId: mainAssignment.teacherId,
            type: OBSERVATION_TYPES[i % OBSERVATION_TYPES.length],
            title: `Seguimiento demo ${i + 1}`,
            content: `${DEMO_MARKER}: observacion breve para visualizar ficha del estudiante y reportes.`,
          },
        });
        createdObservations++;
      }
    }

    for (let i = 0; i < Math.min(2, assignments.length); i++) {
      const assignment = assignments[i]!;
      await prisma.classBookEntry.upsert({
        where: {
          courseId_subjectId_date: {
            courseId: course.id,
            subjectId: assignment.subjectId,
            date: dateFrom2026(3, 10 + i),
          },
        },
        create: {
          courseId: course.id,
          subjectId: assignment.subjectId,
          teacherId: assignment.teacherId,
          date: dateFrom2026(3, 10 + i),
          semester: 1,
          classNumber: 12 + i,
          unitName: `Unidad demo ${i + 1}`,
          topic: `Habilidades clave de ${assignment.subject.name}`,
          content: "Trabajo guiado, revision de ejercicios y cierre con ticket de salida.",
          activities: "Inicio diagnostico, desarrollo colaborativo y retroalimentacion.",
          resources: "Guia digital, pauta de correccion y presentacion.",
          notes: `${DEMO_MARKER}: entrada demo para libro de clases.`,
        },
        update: {
          teacherId: assignment.teacherId,
          unitName: `Unidad demo ${i + 1}`,
          topic: `Habilidades clave de ${assignment.subject.name}`,
          notes: `${DEMO_MARKER}: entrada demo para libro de clases.`,
        },
      });
      createdClassEntries++;
    }
  }

  const sampleCourses = courses.slice(0, 8);
  for (const course of sampleCourses) {
    const assessment = await prisma.assessment.findFirst({
      where: { courseId: course.id, description: { contains: DEMO_MARKER } },
      include: { grades: { take: 1, orderBy: { grade: "asc" } } },
    });
    if (assessment?.grades[0]) {
      await prisma.gradeChangeRequest.create({
        data: {
          gradeId: assessment.grades[0].id,
          requestedBy: recorder.id,
          oldGrade: assessment.grades[0].grade,
          newGrade: Math.min(7, Number((assessment.grades[0].grade + 0.3).toFixed(1))),
          reason: `${DEMO_MARKER}: solicitud demo para revisar flujo de cambios de nota.`,
          status: "PENDING",
        },
      });
    }

    await prisma.report.create({
      data: {
        type: `${DEMO_MARKER}_COURSE_PROGRESS`,
        courseId: course.id,
        assessmentId: assessment?.id ?? null,
        status: "COMPLETED",
        format: "PDF",
        filters: { courseName: course.name, source: DEMO_MARKER },
        generatedAt: new Date(),
        generatedBy: recorder.id,
      },
    });
  }

  await prisma.importJob.createMany({
    data: [
      {
        entityType: `${DEMO_MARKER}_GRADES`,
        fileName: "plantilla-notas-demo.xlsx",
        fileSize: 18420,
        status: "COMPLETED",
        totalRows: 135,
        successRows: 132,
        errorRows: 3,
        errorDetails: [{ row: 12, message: "Nota fuera de rango corregida en vista previa" }],
        actorId: recorder.id,
        completedAt: new Date(),
      },
      {
        entityType: `${DEMO_MARKER}_STUDENTS`,
        fileName: "alumnos-demo.csv",
        fileSize: 32750,
        status: "COMPLETED",
        totalRows: STUDENTS_PER_COURSE,
        successRows: STUDENTS_PER_COURSE,
        errorRows: 0,
        actorId: recorder.id,
        completedAt: new Date(),
      },
    ],
  });

  await prisma.exportJob.createMany({
    data: [
      {
        entityType: `${DEMO_MARKER}_GRADEBOOK`,
        format: "XLSX",
        filters: { scope: "course", source: DEMO_MARKER },
        status: "COMPLETED",
        fileUrl: "/exports/demo-libro-calificaciones.xlsx",
        actorId: recorder.id,
        completedAt: new Date(),
      },
      {
        entityType: `${DEMO_MARKER}_REPORTS`,
        format: "PDF",
        filters: { scope: "reports", source: DEMO_MARKER },
        status: "COMPLETED",
        fileUrl: "/exports/demo-reportes.pdf",
        actorId: recorder.id,
        completedAt: new Date(),
      },
    ],
  });

  await prisma.auditLog.create({
    data: {
      institutionId: institution.id,
      actorId: recorder.id,
      action: `${DEMO_MARKER}_SEED_COMPLETED`,
      entityType: "DemoData",
      newValue: {
        studentsPerCourse: STUDENTS_PER_COURSE,
        courses: courses.length,
        automaticReview: true,
      },
      metadata: { script: "seedFullDemoData.ts" },
      ipAddress: "127.0.0.1",
      userAgent: "seed-script",
    },
  });

  console.log("\nResumen:");
  console.log(`  Usuarios demo creados/actualizados: ${createdUsers}`);
  console.log(`  Alumnos demo creados/reutilizados: ${createdStudents}`);
  console.log(`  Matriculas creadas/activadas: ${createdEnrollments}`);
  console.log(`  Evaluaciones demo creadas: ${createdAssessments}`);
  console.log(`  Notas demo creadas/actualizadas: ${createdGrades}`);
  console.log(`  Intentos online con revision automatica: ${createdAttempts}`);
  console.log(`  Asistencias demo: ${createdAttendance}`);
  console.log(`  Observaciones demo: ${createdObservations}`);
  console.log(`  Entradas libro de clases: ${createdClassEntries}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
