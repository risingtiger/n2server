import type { LazyloadT } from "./defs.js"
import { STATIC_PATH } from "./asset_files_ver2.js"


let _lazyloads:LazyloadT[] | null = null




// main.json is read once per server process, in dev too; a rebuilt main.json needs a restart.
export async function GetLazyloads():Promise<LazyloadT[]> {
	if (_lazyloads) return _lazyloads

	const mainjson = await Bun.file(STATIC_PATH + "main.json").json()
	_lazyloads = [...mainjson.MAIN.LAZYLOADS, ...mainjson.INSTANCE.LAZYLOADS]
	return _lazyloads
}




// Every view, component and thirdparty declares its own dependencies in main.json. These are gathered
// recursively, depth first, so each dependency comes before the entry that declared it and appears once.
// Unhandled Case: a dependency without a main.json entry throws.
// Unhandled Case: a dependency cycle is cut at the repeated entry, so order within the cycle is arbitrary.
export async function GatherDependencies(lazyload:LazyloadT):Promise<LazyloadT[]> {
	const lazyloads = await GetLazyloads()
	const gathered:LazyloadT[] = []
	const seen = new Set<LazyloadT>()

	const gather = (entry:LazyloadT) => {
		for (const dependency of entry.dependencies ?? []) {
			const match = lazyloads.find((item) => item.type === dependency.type && item.name === dependency.name)!
			if (seen.has(match)) continue

			seen.add(match)
			gather(match)
			gathered.push(match)
		}
	}

	gather(lazyload)
	return gathered
}




// The lazyload's .js entry relative to the static dir. asset_request_ver2.ts routes these same path shapes.
export function LazyloadFilePath(lazyload:LazyloadT):string {
	const prefix = lazyload.is_instance ? "instance/" : ""

	if (lazyload.type === "view") return `${prefix}lazy/views/${lazyload.name}/${lazyload.name}.js`
	if (lazyload.type === "component") return `${prefix}lazy/components/${lazyload.name}/${lazyload.name}.js`
	return `${prefix}thirdparty/${lazyload.name}.js`
}
