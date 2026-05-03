const WORDS_PER_MINUTE = 220;
const CJK_CHARS_PER_MINUTE = 500;

export function estimateReadingTime(source: string): string {
	const withoutCode = source
		.replace(/```[\s\S]*?```/g, " ")
		.replace(/`[^`]*`/g, " ");
	const latinWords = withoutCode.match(/[A-Za-z0-9]+(?:[-'][A-Za-z0-9]+)*/g)?.length ?? 0;
	const cjkChars = withoutCode.match(/[\u3400-\u9FFF\uF900-\uFAFF]/g)?.length ?? 0;
	const minutes = Math.max(
		1,
		Math.ceil(latinWords / WORDS_PER_MINUTE + cjkChars / CJK_CHARS_PER_MINUTE),
	);

	return `${minutes} min read`;
}
