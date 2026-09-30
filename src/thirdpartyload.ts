import * as path_util from "node:path"
import type { LazyloadT } from "./defs.js"

const _cached_thirdparty_files = new Map<string, string>()


export async function ThirdPartyLoad(name:string, basepath:string, static_dir:string, lazyloads:Set<LazyloadT>, is_prod:boolean):Promise<{returnstr:string}> {
	const thirdparty = [...lazyloads].find((lazyload) => lazyload.type === "thirdparty" && lazyload.name === name)
	if (!thirdparty) throw new Error(`Lazyload thirdparty not found: ${name}`)

	const absolute_prefix = path_util.resolve(basepath, static_dir)
	const file = `${thirdparty.is_instance ? "instance/" : ""}thirdparty/${thirdparty.name}${is_prod ? ".min" : ""}.js`
	const absolute_file = path_util.resolve(absolute_prefix, file)
	const cached = _cached_thirdparty_files.get(absolute_file)
	if (cached !== undefined) return { returnstr: cached }

	const returnstr = await bundle_thirdparty_javascript(absolute_file)
	_cached_thirdparty_files.set(absolute_file, returnstr)
	return { returnstr }
}


const bundle_thirdparty_javascript = async (file:string):Promise<string> => {
	const result = await Bun.build({
		entrypoints: [file],
		target: "browser",
		format: "iife",
		splitting: false,
		minify: false, // build process already minifies on prod and minify not wanted on dev
		env: "disable",
	})

	if (!result.success) throw new AggregateError(result.logs, "Could not bundle thirdparty JavaScript")
	return result.outputs[0].text()
}
