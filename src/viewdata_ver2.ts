import { pathToFileURL } from "node:url"
import "./fetchlassie.js"
import { IS_PROD, STATIC_PATH } from "./asset_files_ver2.js"
import { LazyloadFilePath } from "./lazyloads_ver2.js"
import { MatchViewPath } from "./view_match_ver2.js"


type ParamsT = Record<string, string>
type DataT = Record<string, unknown>
type ViewDataT = { data:DataT, refreshon:string[] }
type LoadFunctionT = (pathparams:ParamsT, searchparams:ParamsT) => Promise<DataT>
type LoadModuleT = { load?:LoadFunctionT, post_load?:LoadFunctionT }




// Runs the view's server-only loader, which sits beside the view entry: home.js → home_load.js (dist: home_load.min.js).
// Unhandled Case: a view without a _load file fails the import, so its data (and its cold load page) fails.
export async function LoadViewData(viewpath:string):Promise<ViewDataT> {
	const { lazyload, pathparams, searchparams } = await MatchViewPath(viewpath)
	const load_path = STATIC_PATH + LazyloadFilePath(lazyload).replace(/\.js$/, IS_PROD ? "_load.min.js" : "_load.js")
	const module:LoadModuleT = await import(pathToFileURL(load_path).href)
	const [load_data, post_load_data] = await Promise.all([
		module.load?.(pathparams, searchparams) ?? {},
		module.post_load?.(pathparams, searchparams) ?? {},
	])

	return {
		data: { ...load_data, ...post_load_data },
		refreshon: [],
	}
}

