export function formatBytes(
  bytes: number
): string {
  if (!bytes) {
    return "0 B";
  }

  const units = [
    "B",
    "KB",
    "MB",
    "GB",
    "TB",
  ];

  const index = Math.floor(
    Math.log(bytes) / Math.log(1024)
  );

  return `${(
    bytes /
    Math.pow(1024, index)
  ).toFixed(2)} ${units[index]}`;
}

export function formatDate(
  value: string
): string {
  return new Date(
    value
  ).toLocaleString();
}