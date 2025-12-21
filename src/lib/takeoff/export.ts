import { Measurement } from "./types";

const CSV_HEADERS = [
  "label",
  "type",
  "unit",
  "realValue",
  "worldValue",
  "pageIndex",
  "timestamp",
  "points"
];

function sanitizeValue(value: string | number | boolean) {
  const stringValue = String(value ?? "");
  if (stringValue.includes(",") || stringValue.includes("\n") || stringValue.includes("\"")) {
    return `"${stringValue.replace(/"/g, '""')}"`;
  }
  return stringValue;
}

export function exportMeasurementsToCSV(measurements: Measurement[]): string {
  const rows = measurements.map((measurement) => {
    const pointString = measurement.worldPoints
      .map((p) => `${p.x.toFixed(2)}:${p.y.toFixed(2)}`)
      .join("|");

    return [
      sanitizeValue(measurement.label),
      sanitizeValue(measurement.type),
      sanitizeValue(measurement.unit),
      sanitizeValue(measurement.realValue.toFixed(3)),
      sanitizeValue(measurement.worldValue.toFixed(3)),
      sanitizeValue(measurement.pageIndex + 1),
      sanitizeValue(measurement.timestamp instanceof Date ? measurement.timestamp.toISOString() : String(measurement.timestamp)),
      sanitizeValue(pointString)
    ].join(",");
  });

  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export function exportMeasurementsToJSON(measurements: Measurement[]): string {
  return JSON.stringify(
    measurements.map((m) => ({
      ...m,
      timestamp: m.timestamp instanceof Date ? m.timestamp.toISOString() : m.timestamp,
    })),
    null,
    2
  );
}
