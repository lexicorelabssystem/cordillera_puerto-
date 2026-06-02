import { PrismaClient } from "@prisma/client";
import { axesData } from "../prisma/seeds/modules/03-curriculum.js";

const prisma = new PrismaClient();

const subjectCodes: Record<string, string> = {
  Lenguaje: "LEN",
  Matemática: "MAT",
  Ciencias: "CIE",
  "Historia y Geografía": "HIS",
};

async function main() {
  const subjects: Record<string, string> = {};

  for (const [name, code] of Object.entries(subjectCodes)) {
    const subject = await prisma.subject.upsert({
      where: { name },
      update: { code },
      create: { name, code },
    });
    subjects[name] = subject.id;

    for (let gradeLevel = 1; gradeLevel <= 12; gradeLevel++) {
      await prisma.curriculumRule.upsert({
        where: { subjectId_gradeLevel: { subjectId: subject.id, gradeLevel } },
        update: {},
        create: { subjectId: subject.id, gradeLevel },
      });
    }
  }

  let upserted = 0;
  const axisOrderBySubject: Record<string, number> = {};
  for (let index = 0; index < axesData.length; index++) {
    const axis = axesData[index]!;
    const subjectId = subjects[axis.subjectName];
    if (!subjectId) continue;
    axisOrderBySubject[axis.subjectName] = (axisOrderBySubject[axis.subjectName] ?? 0) + 1;

    await prisma.axis.upsert({
      where: { subjectId_name: { subjectId, name: axis.name } },
      update: { description: axis.description, sortOrder: axisOrderBySubject[axis.subjectName] },
      create: {
        subjectId,
        name: axis.name,
        description: axis.description,
        sortOrder: axisOrderBySubject[axis.subjectName],
      },
    });
    upserted++;
  }

  console.log(`Ejes curriculares actualizados: ${upserted}`);
  console.log("Reglas curriculares verificadas: 1° básico a 4° medio por asignatura.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
