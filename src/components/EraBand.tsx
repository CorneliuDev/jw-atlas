"use client";

import { useEffect, useState } from "react";

interface Period {
	id: string;
	title: string;
	description: string | null;
	date_sort_start: number;
	date_sort_end: number;
}

const COLORS = [
	"#D8CBB0",
	"#C9BFA5",
	"#D8CBB0",
	"#C9BFA5",
	"#D8CBB0",
	"#C9BFA5",
	"#D8CBB0",
	"#C9BFA5",
];

export default function EraBand() {
	const [periods, setPeriods] = useState<Period[]>([]);

	useEffect(() => {
		fetch("/api/v1/periods")
			.then((res) => res.json())
			.then((data) => setPeriods(data.periods ?? []));
	}, []);

	if (periods.length === 0) return null;

	const overallStart = Math.min(...periods.map((p) => p.date_sort_start));
	const overallEnd = Math.max(...periods.map((p) => p.date_sort_end));
	const totalSpan = overallEnd - overallStart;

	return (
		<div
			style={{
				position: "absolute",
				bottom: 160,
				left: 0,
				right: 0,
				height: 28,
				display: "flex",
				fontFamily: "sans-serif",
				fontSize: 10,
				borderTop: "1px solid #ddd",
				borderBottom: "1px solid #ddd",
			}}
		>
			{periods.map((period, i) => {
				const widthPct =
					((period.date_sort_end - period.date_sort_start) / totalSpan) * 100;
				return (
					<div
						key={period.id}
						title={`${period.title}: ${period.date_sort_start} to ${period.date_sort_end}`}
						style={{
							width: `${widthPct}%`,
							background: COLORS[i % COLORS.length],
							borderRight: "1px solid rgba(0,0,0,0.1)",
							display: "flex",
							alignItems: "center",
							justifyContent: "center",
							overflow: "hidden",
							whiteSpace: "nowrap",
							textOverflow: "ellipsis",
							padding: "0 4px",
							color: "#4A3F2E",
						}}
					>
						{period.title}
					</div>
				);
			})}
		</div>
	);
}
