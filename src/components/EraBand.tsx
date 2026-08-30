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
	"bg-[#D8CBB0]",
	"bg-[#C9BFA5]",
	"bg-[#D8CBB0]",
	"bg-[#C9BFA5]",
	"bg-[#D8CBB0]",
	"bg-[#C9BFA5]",
	"bg-[#D8CBB0]",
	"bg-[#C9BFA5]",
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
		<div className="absolute bottom-40 left-0 right-0 h-7 flex font-sans text-[10px] border-t border-b border-gray-300">
			{periods.map((period, i) => {
				const widthPct =
					((period.date_sort_end - period.date_sort_start) / totalSpan) * 100;
				return (
					<div
						key={period.id}
						title={`${period.title}: ${period.date_sort_start} to ${period.date_sort_end}`}
						className={`${COLORS[i % COLORS.length]} flex items-center justify-center overflow-hidden whitespace-nowrap text-ellipsis px-1 text-[#4A3F2E] border-r border-black/10`}
						style={{ width: `${widthPct}%` }}
					>
						{period.title}
					</div>
				);
			})}
		</div>
	);
}
