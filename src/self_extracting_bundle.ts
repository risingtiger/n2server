











/*  Is mostly done. 

	niftybuild kicks out a viewloads.js file on 'dist' builds and places it in build directory 
	I need to modify niftybuild to ONLY extract the build functions from views that actually want server side bundling ... MOST will not

	This file imports it, creates a $N.FetchLassie function to allow each view load function to actually load something

	Need to flesh out FetchLassie signature to accept opts etc to match the client side behavior
	FetchLassie should ideally call the internal API without initiaing a fetch to ... ourselves
		
	The bundle was (as of Dec 2025) actually showing up in the browser -- but only the bundled files, NOT the bundled JSON data yet

	import ViewLoads is commented out for now, until I am ready to come back to this
*/






















import { str } from './defs.js'
import fs from "fs"
//import ViewLoads from "./viewloads.js"


// Server-side $N.FetchLassie for viewloads.js load functions
const $N = {
	FetchLassie: async (url: string) => {
		const base_url = 'http://localhost:3004'
		try {
			const response = await fetch(base_url + url)
			const data = await response.json()
			return { ok: response.ok, data }
		} catch {
			return { ok: false, data: null }
		}
	}
};

(globalThis as any).$N = $N;


const BASEPATH = process.cwd() + '/'




const Handle = (viewpath: str, static_dir: str, json_configs: any) => new Promise<{returnstr: string, viewname: str}>(async (resolve, reject) => {

	let indexhtml: string

	try { indexhtml = await fs.promises.readFile(BASEPATH + static_dir + "index.html", 'utf8') }
	catch { reject("Could not read index.html"); return }

	const all_lazyloads = [...json_configs.MAIN.LAZYLOADS, ...json_configs.INSTANCE.LAZYLOADS]

	const this_lazyload = getlazyload(viewpath, all_lazyloads)
	if (!this_lazyload) {reject(`Lazyload not found for path: ${viewpath}`);   return;   }

	const dependency_paths: string[] = []
	get_all_dependency_paths(all_lazyloads, this_lazyload, dependency_paths)

	const view_path = get_view_file_path(this_lazyload)

	// Call load function to get preloaded data
	let preloaded_data_script = ""
	// @ts-ignore
	const load_fn = (ViewLoads as any)[`load_${this_lazyload.name}`]
	if (load_fn) {
		const { pathparams, searchparams } = parse_view_path(viewpath, this_lazyload)
		try {
			const result = await load_fn(pathparams, searchparams)
			const data_obj = Object.fromEntries(result.d)
			preloaded_data_script = `<script id="preloaded_data" type="application/json">${JSON.stringify(data_obj)}</script>\n`
		} catch {
			// Unhandled Case: load function failed, proceed without preloaded data
		}
	}

	let inline_content: string
	try { inline_content = await build_inline_content(static_dir, dependency_paths, view_path) }
	catch (e) { reject(e); return }

	// Prepend preloaded data to inline content
	inline_content = preloaded_data_script + inline_content

	const htmlstr = indexhtml.replace('<!--{--js_css--}-->', () => inline_content) // use function to avoid $ replacement issues

	resolve({ returnstr: htmlstr, viewname: this_lazyload.name })
})




const getlazyload = (path: str, all_lazyloads: any[]) => {

	for (const lazyload of all_lazyloads) {
		if (lazyload.type !== "view") continue
		if (lazyload.urlmatch_regex.test(path)) return lazyload
	}

	return null
}




const get_view_file_path = (lazyload: any): string => {

	let path = ""

	if (lazyload.is_instance) path += "instance/"

	path += "lazy/views/" + lazyload.name + "/" + lazyload.name + ".js"

	return path
}




const get_dependency_file_path = (lazyload: any): string => {

	let path = ""

	if (lazyload.is_instance) path += "instance/"

	switch (lazyload.type) {
		case "component":
			path += "lazy/components/" + lazyload.name + "/" + lazyload.name + ".js"
			break
		case "thirdparty":
			path += "thirdparty/" + lazyload.name + ".js"
			break
		case "view":
			path += "lazy/views/" + lazyload.name + "/" + lazyload.name + ".js"
			break
		case "lib":
			path += "lazy/libs/" + lazyload.name + "/" + lazyload.name + ".js"
			break
	}

	return path
}




const get_all_dependency_paths = (all_lazyloads: any[], lazyload: any, paths_list: string[]) => {

	if (!lazyload.dependencies) return

	for (const dep of lazyload.dependencies) {

		const dep_lazyload = all_lazyloads.find((v: any) => v.name === dep.name)
		if (!dep_lazyload) {
			console.warn(`Lazyload dependency not found: ${dep.name} in ${lazyload.name}`)
			continue
		}

		// Recurse into nested dependencies first (depth-first)
		if (dep_lazyload.dependencies && dep_lazyload.dependencies.length > 0) {
			get_all_dependency_paths(all_lazyloads, dep_lazyload, paths_list)
		}

		const dep_path = get_dependency_file_path(dep_lazyload)

		// Skip if already added (deduplication)
		if (paths_list.includes(dep_path)) continue

		paths_list.push(dep_path)
	}
}




const build_inline_content = (static_dir: str, dependency_paths: string[], view_path: string) => new Promise<string>(async (resolve, reject) => {

	const abs_prefix = BASEPATH + static_dir

	// Read CSS files
	let index_css: string, main_css: string
	try {
		[index_css, main_css] = await Promise.all([
			fs.promises.readFile(abs_prefix + "index.css", 'utf8'),
			fs.promises.readFile(abs_prefix + "main.css", 'utf8')
		])
	} catch (e) {
		reject("Could not read CSS files: " + e)
		return
	}

	// Read main.js
	let main_js: string
	try { main_js = await fs.promises.readFile(abs_prefix + "main.js", 'utf8') }
	catch (e) { reject("Could not read main.js: " + e); return }

	// Read all dependency JS files
	const dependency_contents: { path: string, content: string }[] = []
	for (const dep_path of dependency_paths) {
		try {
			const content = await fs.promises.readFile(abs_prefix + dep_path, 'utf8')
			dependency_contents.push({ path: dep_path, content })
		} catch (e) {
			reject(`Could not read dependency file: ${dep_path}: ${e}`)
			return
		}
	}

	// Read the view JS file
	let view_js: string
	try { view_js = await fs.promises.readFile(abs_prefix + view_path, 'utf8') }
	catch (e) { reject("Could not read view file: " + view_path + ": " + e); return }

	// Build the inline content
	let output = ""

	// CSS first
	output += `<style id="index_css">\n${index_css}\n</style>\n`
	output += `<style id="main_css">\n${main_css}\n</style>\n`

	// Main JS - escape </script to prevent premature tag closing
	const escaped_main_js = main_js.replace(/<\/script/gi, '<\\/script')
	output += `<script id="main_js" type="module">${escaped_main_js}</script>\n`


	// // Dependency JS files in order
	for (const dep of dependency_contents) {
		const id = path_to_id(dep.path)
		output += `<script id="${id}" type="module">${dep.content}</script>\n`
	}

	// View JS last
	const view_id = path_to_id(view_path)
	output += `<script id="${view_id}" type="module">${view_js}</script>\n`

	resolve(output)
})




const parse_view_path = (viewpath: string, lazyload: any) => {

	const [path_part, query_part] = viewpath.split('?')

	// Parse search params from query string
	const searchparams: Record<string, string> = {}
	if (query_part) {
		const params = new URLSearchParams(query_part)
		for (const [key, val] of params) {
			searchparams[key] = val
		}
	}

	// TODO: I dont think this actually will pick up on pathparams. need to refer to what the client does and import that code logic here

	// Extract path params using lazyload.urlmatch_regex
	const pathparams: Record<string, string> = {}
	const match = lazyload.urlmatch_regex.exec(path_part)
	if (match?.groups) {
		Object.assign(pathparams, match.groups)
	}

	return { pathparams, searchparams }
}




const path_to_id = (filepath: string): string => {
	// Remove "lazy/" prefix if present
	let id = filepath.replace(/^(instance\/)?lazy\//, '')

	// Remove file extension
	id = id.replace(/\.js$/, '')

	// Replace path separators with double underscore
	id = id.replace(/\//g, '__')

	// Replace any remaining invalid characters
	id = id.replace(/[^a-zA-Z0-9_]/g, '_')

	return id
}




export default { Handle }
