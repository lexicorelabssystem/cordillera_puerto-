export function isSubjectAllowedForGrade(gradeLevel: number, subjectName: string): boolean {
  const normalized = subjectName.trim().toLowerCase();

  if (normalized === "lenguaje" || normalized === "matemática" || normalized === "matematica") return true;
  if (normalized === "ciencias" && gradeLevel === 6) return true;
  if (normalized === "historia y geografía" || normalized === "historia y geografia") {
    return gradeLevel === 8;
  }

  return false;
}
