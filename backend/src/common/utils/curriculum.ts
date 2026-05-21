export function isSubjectAllowedForGrade(gradeLevel: number, subjectName: string): boolean {
  const normalized = subjectName.trim().toLowerCase();

  if (normalized === "lenguaje" || normalized === "matemática" || normalized === "matematica") {
    return gradeLevel >= 1 && gradeLevel <= 8;
  }

  if (normalized === "ciencias" || normalized === "ciencias naturales") {
    return gradeLevel === 6;
  }

  if (normalized === "historia y geografía" || normalized === "historia y geografia" || normalized === "historia") {
    return gradeLevel === 8;
  }

  return true;
}
