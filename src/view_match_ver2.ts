import type { LazyloadT } from "./defs.js"
import { GetLazyloads } from "./lazyloads_ver2.js"


type ParamsT = Record<string, string>
type MatchedViewT = { lazyload:LazyloadT, pathparams:ParamsT, searchparams:ParamsT }




// viewpath is e.g. "car/12?color=red", optionally prefixed with "/" or "/v/". The first matching view wins.
// Only the pathname and search params are read, so any origin works as the parsing base.
export async function MatchViewPath(viewpath:string):Promise<MatchedViewT> {
	const url = new URL(viewpath, "http://localhost/")
	const pathname = url.pathname.replace(/^\/(?:v\/)?/, "")
	const lazyloads = await GetLazyloads()

	for (const lazyload of lazyloads) {
		if (lazyload.type !== "view") continue

		const pathparams = match_urlmatch(pathname, lazyload)
		if (!pathparams) continue

		return { lazyload, pathparams, searchparams: Object.fromEntries(url.searchParams) }
	}

	throw new Error(`Lazyload view not found: ${viewpath}`)
}




// Unhandled Case: a malformed percent-encoding in a path param makes decodeURIComponent throw.
function match_urlmatch(pathname:string, lazyload:LazyloadT):ParamsT | null {
	if (!lazyload.urlmatch) {
		if (!lazyload.urlmatch_regex) return null
		const match = new RegExp(lazyload.urlmatch_regex).exec(pathname)
		return match ? { ...match.groups } : null
	}

	const paramnames:string[] = []
	const pattern = lazyload.urlmatch
		.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
		.replace(/:([a-zA-Z_0-9]+)/g, (_match, name:string) => {
			paramnames.push(name)
			return "([^/]+)"
		})
	const match = new RegExp(`^${pattern}$`).exec(pathname)
	if (!match) return null

	return Object.fromEntries(paramnames.map((name, index) => [name, decodeURIComponent(match[index + 1])]))
}
