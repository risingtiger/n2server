import { pathToFileURL } from "node:url"
import type { LazyloadT } from "./defs.js"
import "./fetchlassie.js"


type ParamsT = Record<string, string>
type LoadResultT = { d:Map<string, unknown[]>, refreshon:string[] }
type LoadFunctionT = (pathparams:ParamsT, searchparams:ParamsT) => Promise<LoadResultT>
type LoadModuleT = { load?:LoadFunctionT, post_load?:LoadFunctionT }

export type ViewRequestT = {
	lazyload:LazyloadT
	pathparams:ParamsT
	searchparams:ParamsT
}

const cached_lazyloads = new Map<string, LazyloadT[]>()


export async function LoadLazyloads(absolute_prefix:string, is_prod:boolean):Promise<LazyloadT[]> {
	const cached = cached_lazyloads.get(absolute_prefix)
	if (is_prod && cached) return cached

	const configs = await Bun.file(absolute_prefix + "main.json").json()
	const lazyloads:LazyloadT[] = [...configs.MAIN.LAZYLOADS, ...configs.INSTANCE.LAZYLOADS]
	if (is_prod) cached_lazyloads.set(absolute_prefix, lazyloads)
	return lazyloads
}


export function GetViewBasePath(lazyload:LazyloadT):string {
	return (lazyload.is_instance ? "instance/" : "") + `lazy/views/${lazyload.name}/${lazyload.name}`
}


export function IsViewEntry(js_path:string):boolean {
	// Parts, components, and the server-only *_load.js modules are not view entries.
	return /^(?:instance\/)?lazy\/views\/([^/]+)\/\1\.js$/.test(js_path)
}


export function MatchView(viewpath:string, lazyloads:LazyloadT[]):ViewRequestT | null {
	// This origin is only used to parse relative view paths, never for requests.
	const url = new URL(viewpath.replace(/^\/v\//, ""), "https://example.invalid/")
	const pathname = url.pathname.slice(1)
	const views = lazyloads.filter((lazyload) => lazyload.type === "view" && lazyload.urlmatch)
	const specificity = (view:LazyloadT) => view.urlmatch!.replace(/:([a-zA-Z_0-9]+)/g, "").length
	views.sort((a, b) => specificity(b) - specificity(a))

	for (const lazyload of views) {
		const paramnames:string[] = []
		const pattern = lazyload.urlmatch!
			.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
			.replace(/:([a-zA-Z_0-9]+)/g, (_match, name:string) => {
				paramnames.push(name)
				return "([^/?]+)"
			})
		const match = new RegExp(`^${pattern}$`).exec(pathname)
		if (!match) continue

		const pathparams = Object.fromEntries(paramnames.map((name, i) => [name, decodeURIComponent(match[i + 1])]))
		return { lazyload, pathparams, searchparams: Object.fromEntries(url.searchParams) }
	}

	return null
}


export async function LoadViewData(absolute_prefix:string, view:ViewRequestT, is_prod:boolean) {
	const { lazyload, pathparams, searchparams } = view
	const view_base_path = GetViewBasePath(lazyload)
	if (lazyload.type !== "view" || !IsViewEntry(view_base_path + ".js")) return null

	const load_path = absolute_prefix + view_base_path + "_load.js"
	const file = Bun.file(load_path)
	if (!await file.exists()) return null

	const module_url = pathToFileURL(load_path)
	// Version only changed dev modules; production uses the normal ESM module cache.
	// Changes to a loader's imported helpers still require a server restart in dev.
	if (!is_prod) module_url.searchParams.set("v", String(file.lastModified))
	const module:LoadModuleT = await import(module_url.href)

	// Both phases finish before sending the response. Results are never cached between requests.
	const [load, post_load] = await Promise.all([
		module.load?.(pathparams, searchparams) ?? null,
		module.post_load?.(pathparams, searchparams) ?? null,
	])

	return { viewname: lazyload.name, pathparams, searchparams, load, post_load }
}


