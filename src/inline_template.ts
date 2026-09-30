// HTML assets are inserted inside a JavaScript template literal. Keep JavaScript
// interpolation expressions intact, including nested template literals.
export function EscapeTemplateAsset(value:string):string {
	let result = ""

	for (let index = 0; index < value.length; index++) {
		const char = value[index]
		if (char === "$" && value[index + 1] === "{") {
			const start = index
			let depth = 1
			let quote = ""
			index += 2

			for (; index < value.length && depth > 0; index++) {
				const current = value[index]
				if (quote) {
					if (current === "\\") {
						index++
						continue
					}
					if (current === quote) quote = ""
					continue
				}
				if (current === "'" || current === '"') {
					quote = current
					continue
				}
				if (current === "{") depth++
				if (current === "}") depth--
			}

			result += value.slice(start, index)
			index--
			continue
		}
		if (char === "\\" || char === "`") result += "\\"
		result += char
	}

	return result
}
