// use as 2nd parameter for JSON.parse to revive Date instances
export default function dateReviver(_key: string, value: unknown) {
	if (typeof value !== "string") {
		return value;
	}
	const parts =
		/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.(\d*))?(Z|([+-])(\d{2}):(\d{2}))$/.exec(
			value,
		);
	if (!parts) {
		return value;
	}
	return new Date(
		Date.UTC(
			Number.parseInt(parts[1] ?? "0", 10),
			Number.parseInt(parts[2] ?? "0", 10) - 1,
			Number.parseInt(parts[3] ?? "0", 10),
			Number.parseInt(parts[4] ?? "0", 10),
			Number.parseInt(parts[5] ?? "0", 10),
			Number.parseInt(parts[6] ?? "0", 10),
			(parts[7] ? Number.parseInt(parts[7]) : 0) || 0,
		),
	);
}
