function normalizeSubjectName(subjectName: string): string {
  return subjectName
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

export function isSubjectAllowedForGrade(gradeLevel: number, subjectName: string): boolean {
  const normalized = normalizeSubjectName(subjectName);
  const isSchoolGrade = gradeLevel >= 1 && gradeLevel <= 12;

  if (
    normalized === "lenguaje" ||
    normalized === "lengua y literatura" ||
    normalized === "matematica"
  ) {
    return isSchoolGrade;
  }

  if (normalized === "ciencias" || normalized === "ciencias naturales") {
    return isSchoolGrade;
  }

  if (
    normalized === "historia" ||
    normalized === "historia y geografia" ||
    normalized === "historia geografia y ciencias sociales"
  ) {
    return isSchoolGrade;
  }

  return true;
}
