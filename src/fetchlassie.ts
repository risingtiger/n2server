import { cars } from "./dummydata.js"


type HttpOptionsT = {
	method?:string
	headers?:Record<string, string>
	body?:Record<string, unknown> | unknown[]
}


export async function FetchLassie(url:string, http_opts:HttpOptionsT = {}, _opts:Record<string, unknown> = {}) {
	const headers = new Headers({ "Content-Type": "application/json" })

	// Server-side fixture stub: no network or local cache. Client FetchLassie and its
	// service worker handle cacheduration (default 0) for browser requests.
	if (http_opts.method && http_opts.method !== "GET") {
		return { headers, status: 405, statusText: "Method Not Allowed", ok: false }
	}

	// The origin is only a parsing base; this fixture stub never makes HTTP requests.
	const pathname = new URL(url, "https://example.invalid/").pathname
	const match = /^\/api\/dummydata\/cars(?:\/([^/]+))?\/?$/.exec(pathname)
	if (!match) return { headers, status: 404, statusText: "Not Found", ok: false }

	const id = match[1] ? decodeURIComponent(match[1]) : null
	const data = id ? cars.filter((car) => car.id === id) : cars.slice(0, 25)

	// Each call gets its own records, so loaders cannot mutate another request's fixture data.
	return { headers, status: 200, statusText: "OK", ok: true, data: structuredClone(data) }
}


declare global {
	var $N: { FetchLassie:typeof FetchLassie }
}

globalThis.$N = { FetchLassie }
