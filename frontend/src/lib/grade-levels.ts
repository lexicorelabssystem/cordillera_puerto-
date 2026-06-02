export const GRADE_LEVELS = [
  { value: 1, label: "1° básico" },
  { value: 2, label: "2° básico" },
  { value: 3, label: "3° básico" },
  { value: 4, label: "4° básico" },
  { value: 5, label: "5° básico" },
  { value: 6, label: "6° básico" },
  { value: 7, label: "7° básico" },
  { value: 8, label: "8° básico" },
  { value: 9, label: "1° medio" },
  { value: 10, label: "2° medio" },
  { value: 11, label: "3° medio" },
  { value: 12, label: "4° medio" },
];

export function formatGradeLevel(gradeLevel?: number | null) {
  if (!gradeLevel) return "-";
  return GRADE_LEVELS.find((level) => level.value === gradeLevel)?.label ?? `${gradeLevel}°`;
}
