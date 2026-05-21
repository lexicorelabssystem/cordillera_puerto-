export interface OMRRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  row: number;
  col: number;
  expectedMark: string;
}

export interface OMRResult {
  answers: Record<number, string>;
  confidence: number[];
  warnings: string[];
}

function getGrayscalePixel(
  imageData: ImageData,
  x: number,
  y: number
): number {
  const idx = (y * imageData.width + x) * 4;
  const r = imageData.data[idx]!;
  const g = imageData.data[idx + 1]!;
  const b = imageData.data[idx + 2]!;
  return Math.round(0.299 * r + 0.587 * g + 0.114 * b);
}

function computeRegionDarkness(
  imageData: ImageData,
  region: OMRRegion,
  scaleX: number,
  scaleY: number
): number {
  const rx = Math.round(region.x * scaleX);
  const ry = Math.round(region.y * scaleY);
  const rw = Math.round(region.width * scaleX);
  const rh = Math.round(region.height * scaleY);

  let totalBrightness = 0;
  let pixelCount = 0;

  const startX = Math.max(0, rx);
  const startY = Math.max(0, ry);
  const endX = Math.min(imageData.width - 1, rx + rw);
  const endY = Math.min(imageData.height - 1, ry + rh);

  if (endX <= startX || endY <= startY) {
    return 0;
  }

  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      totalBrightness += getGrayscalePixel(imageData, x, y);
      pixelCount++;
    }
  }

  if (pixelCount === 0) {
    return 0;
  }

  const avgBrightness = totalBrightness / pixelCount;
  return 1 - avgBrightness / 255;
}

function groupByRow(regions: OMRRegion[]): Map<number, OMRRegion[]> {
  const groups = new Map<number, OMRRegion[]>();
  for (const region of regions) {
    const existing = groups.get(region.row);
    if (existing) {
      existing.push(region);
    } else {
      groups.set(region.row, [region]);
    }
  }
  for (const [, group] of groups) {
    group.sort((a, b) => a.col - b.col);
  }
  return groups;
}

export function processOMRSheet(
  imageData: ImageData,
  regions: OMRRegion[]
): OMRResult {
  const answers: Record<number, string> = {};
  const confidence: number[] = [];
  const warnings: string[] = [];

  const scaleX = imageData.width / Math.max(...regions.map((r) => r.x + r.width), 1);
  const scaleY = imageData.height / Math.max(...regions.map((r) => r.y + r.height), 1);

  const actualScaleX = imageData.width / Math.max(...regions.map((r) => r.x + r.width), 1);
  const actualScaleY = imageData.height / Math.max(...regions.map((r) => r.y + r.height), 1);

  const rowGroups = groupByRow(regions);
  const sortedRows = Array.from(rowGroups.keys()).sort((a, b) => a - b);

  for (const row of sortedRows) {
    const group = rowGroups.get(row)!;
    const darknessValues = group.map((region) =>
      computeRegionDarkness(imageData, region, actualScaleX, actualScaleY)
    );

    if (darknessValues.length === 0) {
      confidence.push(0);
      warnings.push(`Fila ${row}: sin regiones para evaluar`);
      continue;
    }

    let maxIdx = 0;
    let secondMaxIdx = -1;
    let maxVal = darknessValues[0]!;
    let secondMaxVal = -Infinity;

    for (let i = 1; i < darknessValues.length; i++) {
      const val = darknessValues[i]!;
      if (val > maxVal) {
        secondMaxVal = maxVal;
        secondMaxIdx = maxIdx;
        maxVal = val;
        maxIdx = i;
      } else if (val > secondMaxVal) {
        secondMaxVal = val;
        secondMaxIdx = i;
      }
    }

    const chosenRegion = group[maxIdx]!;
    answers[row] = chosenRegion.expectedMark;

    const conf =
      secondMaxIdx >= 0 && secondMaxVal > 0
        ? maxVal / (maxVal + secondMaxVal)
        : maxVal > 0.35
          ? 0.85
          : maxVal > 0.2
            ? 0.6
            : 0.4;

    confidence.push(conf);

    if (secondMaxIdx >= 0 && secondMaxVal > 0) {
      const diff = maxVal - secondMaxVal;
      if (diff < 0.08) {
        const secondMark = group[secondMaxIdx]!.expectedMark;
        warnings.push(
          `Pregunta ${row}: marcas ambiguas entre "${chosenRegion.expectedMark}" y "${secondMark}" (diferencia: ${(diff * 100).toFixed(1)}%)`
        );
      }
    }

    if (maxVal < 0.15) {
      warnings.push(
        `Pregunta ${row}: marca muy tenue (${(maxVal * 100).toFixed(1)}% de oscurecimiento)`
      );
    }
  }

  return { answers, confidence, warnings };
}

export function generateOMRGrid(
  questions: number,
  optionsPerQuestion: number,
  pageWidth: number,
  pageHeight: number
): OMRRegion[] {
  const regions: OMRRegion[] = [];

  const marginLeft = pageWidth * 0.12;
  const marginTop = pageHeight * 0.08;

  const contentWidth = pageWidth - marginLeft * 2;
  const contentHeight = pageHeight - marginTop * 2;

  const questionsPerColumn = Math.ceil(questions / 2);
  const columnGap = contentWidth * 0.15;

  const colWidth =
    (contentWidth - columnGap) / (2 * optionsPerQuestion + 0.5);

  const labelMarks = ["A", "B", "C", "D", "E", "F", "G"];

  for (let q = 0; q < questions; q++) {
    const isRightColumn = q >= questionsPerColumn;
    const localQ = isRightColumn ? q - questionsPerColumn : q;

    const col = isRightColumn ? 1 : 0;
    const colOffset = isRightColumn
      ? marginLeft + contentWidth / 2 + columnGap / 2
      : marginLeft;

    const rowHeight = contentHeight / Math.max(questionsPerColumn, 1);
    const rowY = marginTop + localQ * rowHeight + rowHeight * 0.2;
    const regionH = rowHeight * 0.55;

    for (let opt = 0; opt < optionsPerQuestion; opt++) {
      const mark = labelMarks[opt] ?? String.fromCharCode(65 + opt);

      const regionX = colOffset + opt * (colWidth + colWidth * 0.15);
      const regionW = colWidth;

      regions.push({
        x: regionX,
        y: rowY,
        width: regionW,
        height: regionH,
        row: q + 1,
        col: opt,
        expectedMark: mark,
      });
    }
  }

  return regions;
}

export function drawOMROverlay(
  canvas: HTMLCanvasElement,
  imageData: ImageData,
  regions: OMRRegion[],
  result: OMRResult
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  canvas.width = imageData.width;
  canvas.height = imageData.height;

  const tempCanvas = document.createElement("canvas");
  tempCanvas.width = imageData.width;
  tempCanvas.height = imageData.height;
  const tempCtx = tempCanvas.getContext("2d");
  if (!tempCtx) return;

  tempCtx.putImageData(imageData, 0, 0);
  ctx.drawImage(tempCanvas, 0, 0);

  const scaleX = imageData.width / Math.max(...regions.map((r) => r.x + r.width), 1);
  const scaleY = imageData.height / Math.max(...regions.map((r) => r.y + r.height), 1);

  const rowGroups = groupByRow(regions);

  for (const [row, group] of rowGroups) {
    const answer = result.answers[row];
    if (answer === undefined) continue;

    const confIdx = row - 1;
    const conf = result.confidence[confIdx] ?? 0.5;

    let color: string;
    let label: string;

    if (conf >= 0.75) {
      color = "rgba(34, 197, 94, 0.55)";
      label = `${row}: ${answer} (alta)`;
    } else if (conf >= 0.55) {
      color = "rgba(234, 179, 8, 0.55)";
      label = `${row}: ${answer} (media)`;
    } else {
      color = "rgba(239, 68, 68, 0.55)";
      label = `${row}: ${answer} (baja)`;
    }

    for (const region of group) {
      if (region.expectedMark === answer) {
        const rx = Math.round(region.x * scaleX);
        const ry = Math.round(region.y * scaleY);
        const rw = Math.round(region.width * scaleX);
        const rh = Math.round(region.height * scaleY);

        ctx.fillStyle = color;
        ctx.fillRect(rx, ry, rw, rh);

        ctx.strokeStyle = color.replace("0.55", "0.85");
        ctx.lineWidth = 2;
        ctx.strokeRect(rx, ry, rw, rh);

        ctx.fillStyle = "#fff";
        ctx.font = "bold 12px 'Segoe UI', system-ui, sans-serif";
        ctx.textBaseline = "middle";
        ctx.textAlign = "center";

        const textWidth = ctx.measureText(label).width + 12;
        const labelX = rx + rw / 2;
        const labelY = ry - 16;

        ctx.fillStyle = "rgba(0,0,0,0.65)";
        ctx.fillRect(
          labelX - textWidth / 2,
          labelY - 10,
          textWidth,
          20
        );

        ctx.fillStyle = "#fff";
        ctx.fillText(label, labelX, labelY);
      }
    }
  }
}
