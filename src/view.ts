


import { LazyloadT } from "./defs.js"

type ScriptFileT = {
	name:string
	path:string
}

// In-memory cache of the static base files (index.html, main.json, main.js, and base CSS).
// Only used when env !== 'dev' so edits are picked up without a restart during development.
// Assumes static_dir is the same for every call in a process; if it ever varies, key this by static_dir.
type BaseFilesT = {
	indexhtml:string
	all_lazyloads:LazyloadT[]
	mainjs:string
	indexcss:string
	maincss:string
	instancemaincss:string
	iconscss:string
}

let cached_base_files:BaseFilesT | null = null




export const HandleFirstBoot = (viewpath:string, basepath:string, static_dir:string, is_prod:boolean) => new Promise<{returnstr:string,viewname:string}>(async (resolve, reject) => {

	let base_files:BaseFilesT

	try   { base_files = await load_base_files(basepath, static_dir, is_prod) }
	catch { reject(); return; }
	
	const { indexhtml, all_lazyloads } = base_files

	let   this_lazyload            = getlazyload(viewpath, all_lazyloads)

	if (!this_lazyload) {
		reject(`Lazyload not found for path: ${viewpath}`);
		return;
	}

	const view_base_path = getview_base_path(this_lazyload)

	const dependencies_list:ScriptFileT[] = []
	get_all_lazyload_dependencies(all_lazyloads, this_lazyload, dependencies_list)

	const script_files:ScriptFileT[] = [
		{ name: "main", path: "main.js" },
		...dependencies_list,
		{ name: this_lazyload.name, path: view_base_path + ".js" },
	]

	let assets_str:string

	if (!is_prod) {
		assets_str = build_dev_assets(script_files)
	} else {
		try {
			assets_str = await build_production_assets(basepath, static_dir, script_files, base_files)
		} catch {
			reject()
			return
		}
	}

	const htmlstr = indexhtml.replace('<!--{--js_css--}-->', () => assets_str)

	resolve({ returnstr: htmlstr, viewname:this_lazyload.name })	
})




const build_dev_assets = (script_files:ScriptFileT[]):string => {

	const scripts = script_files
		.map((file) => `<script type='module' name='${file.name}' src='/${file.path}'></script>`)
		.join('\n')

	// Separate files let the browser pick up JavaScript and CSS changes without restarting the server.
	const styles = `<link rel="stylesheet" href="/index.css"></link><link rel="stylesheet" href="/instance/icons.css"></link>`

	return scripts + `\n\n\n` + styles
}




const build_production_assets = async (basepath:string, static_dir:string, script_files:ScriptFileT[], base_files:BaseFilesT):Promise<string> => {

	const { mainjs, indexcss, maincss, instancemaincss, iconscss } = base_files

	// main.js comes from the base-file cache; only the view and its dependencies are read here.
	const rest_contents = await Promise.all(script_files.slice(1).map((file) => Bun.file(basepath + static_dir + file.path).text()))
	const script_contents = [mainjs, ...rest_contents]
	const scripts = script_files.map((file, i) => `<script type='module' name='${file.name}'>${script_contents[i]}</script>`).join('\n')

	const styles = `<style name='index'>${indexcss}</style>
					<script>
						const iconsStyleSheet = new CSSStyleSheet()
						iconsStyleSheet.replaceSync(\`${iconscss}\`)
						window.iconscss = iconsStyleSheet
						document.adoptedStyleSheets.push(window.iconscss)
					</script>
					<script>
						const mainStyleSheet = new CSSStyleSheet()
						mainStyleSheet.replaceSync(\`${maincss}\`)
						window.maincss = mainStyleSheet
					</script>
					<script>
						const instanceMainStyleSheet = new CSSStyleSheet()
						instanceMainStyleSheet.replaceSync(\`${instancemaincss}\`)
						window.instancemaincss = instanceMainStyleSheet
					</script>`

	return scripts + `\n\n\n` + styles
}




const load_base_files = async (basepath:string, static_dir:string, is_prod:boolean):Promise<BaseFilesT> => {

	if (is_prod && cached_base_files) return cached_base_files

	const [indexhtml, mainjson] = await Promise.all([
		Bun.file(basepath + static_dir + "instance/index.html").text(),
		Bun.file(basepath + static_dir + "main.json").text(),
	])

	const all_lazyloads = parse_json_configs_lazyloads(JSON.parse(mainjson))

	if (!is_prod) {
		return { indexhtml, all_lazyloads, mainjs: "", indexcss: "", maincss: "", instancemaincss: "", iconscss: "" }
	}

	const [mainjs, indexcss, maincss, instancemaincss, iconscss] = await Promise.all([
		Bun.file(basepath + static_dir + "main.js").text(),
		Bun.file(basepath + static_dir + "index.css").text(),
		Bun.file(basepath + static_dir + "main.css").text(),
		Bun.file(basepath + static_dir + "instance/main.css").text(),
		Bun.file(basepath + static_dir + "instance/icons.css").text(),
	])

	cached_base_files = { indexhtml, all_lazyloads, mainjs, indexcss, maincss, instancemaincss, iconscss }

	return cached_base_files
}





function parse_json_configs_lazyloads(jsonConfigs:any):LazyloadT[] {
	[...jsonConfigs.MAIN.LAZYLOADS, ...jsonConfigs.INSTANCE.LAZYLOADS].forEach((lazyload) => {
		if (!lazyload.urlmatch) return

		const regexPattern = lazyload.urlmatch.replace(/\/:[a-z0-9A-Z_]+/g, '/[a-zA-Z0-9_]+')
		lazyload.urlmatch_regex = new RegExp(regexPattern)
	})

	return [...jsonConfigs.MAIN.LAZYLOADS, ...jsonConfigs.INSTANCE.LAZYLOADS]
}



const getlazyload = (path:string, all_lazyloads:LazyloadT[]) => {

	for (const lazyload of all_lazyloads) {

		if (lazyload.type !== "view") continue;
		
		if (lazyload.urlmatch_regex && lazyload.urlmatch_regex.test(path)) {
			return lazyload;
		}
	}
	
	return null;
}




const getview_base_path = (lazyload:any) => {

	let view_file_path = ""

	if (lazyload.is_instance) view_file_path += "instance/"

	view_file_path += "lazy/views/" + lazyload.name + "/" + lazyload.name

	return view_file_path
}








const get_all_lazyload_dependencies = (all_lazyloads:any, lazyload:LazyloadT, files_list:ScriptFileT[]) => {

	for (const dep of lazyload.dependencies) {

		const dep_lazyload  = all_lazyloads.find((v:any) =>  v.name == dep.name)
		if (!dep_lazyload) {
			console.warn(`Lazyload dependency not found: ${dep.name} in ${lazyload.name}. You probably listed a dependency that does not exist.`);
			throw new Error(`Lazyload dependency not found: ${dep.name} in ${lazyload.name}. You probably listed a dependency that does not exist.`);
		}

		let resofpath = "views/" // default
		switch (dep_lazyload.type) {
			case "view"       : resofpath = "lazy/views/"  + dep_lazyload.name + "/" + dep_lazyload.name + ".js"; break;
			case "component"  : resofpath = "lazy/components/" + dep_lazyload.name + "/" + dep_lazyload.name + ".js"; break;
			case "thirdparty" : resofpath = "thirdparty/" + dep_lazyload.name + ".js"; break;
		}

		const lazyref_path = (dep_lazyload.is_instance ? 'instance/' : '') + resofpath

		const is_already_added = files_list.find((v) => v.path == lazyref_path) ? true : false
		if (is_already_added) continue

		files_list.push({ name: dep_lazyload.name, path: lazyref_path })

		if (dep_lazyload.dependencies && dep_lazyload.dependencies.length > 0) {
			get_all_lazyload_dependencies(all_lazyloads, dep_lazyload, files_list)
		}
	}
}


/*
const HandlePath_original = (pathparts:str[], static_prefix:str, nodeenv:str) => new Promise<{returnstr:string,viewname:str}>(async (resolve, reject) => {

	const promises:Promise<string>[] = []

	let r = {} as any

	promises.push(fs.promises.readFile(BASEPATH + static_prefix + nodeenv + "index.html", 'utf8'))
	promises.push(fs.promises.readFile(BASEPATH + static_prefix + nodeenv + "main.json", 'utf8'))

	try   { r = await Promise.all(promises) }
	catch { reject(); return; }
	
	const indexhtml                = r[0]
	const json                     = JSON.parse(r[1])

	const all_lazyloads            = [...json.MAIN.LAZYLOADS, ...json.INSTANCE.LAZYLOADS]

	let   this_lazyload            = getlazyload(pathparts, all_lazyloads)
	let   view_base_path		   = getview_base_path(this_lazyload)
	let   view_js_content          = await getview_js_content(view_base_path, nodeenv, static_prefix)

	const paths_list:string[]      = []

	get_all_lazyload_dependencies(all_lazyloads, this_lazyload, static_prefix, paths_list)

	const lazyload_js_paths = paths_list.map((v) => `<script type="module" src="${v}"></script>`).join('\n')
	
	const view_script_js_str = `<script type="module">${view_js_content}</script>`

	const main_js_script_str = `
		<script type="module" src="/assets/main.js"></script>
		${view_script_js_str}
		${lazyload_js_paths}
	`

	const css_link_str       = `<link rel="stylesheet" href="/assets/index.css"></link>`

	const htmlstr = indexhtml.replace('<!--{--js_css--}-->', main_js_script_str + `\n\n\n` + css_link_str)

	resolve({ returnstr: htmlstr, viewname:this_lazyload.name })	
})
*/




/*
const handle_path__view_dev = (view_base_path:str, static_prefix:str) => new Promise<string>(async (resolve, _reject) => {

	const promises:Promise<any>[] = []
	const p = BASEPATH + static_prefix + "dev/" + view_base_path
	promises.push(fs.promises.readFile(p + ".js", 'utf8'))
	promises.push(fs.promises.readFile(p + ".html", 'utf8'))
	const r = await Promise.all(promises)

	let jsstr = r[0].replace("{--html--}", `${r[1]}`)
	jsstr     = jsstr.replace("{--css--}", `<link rel="stylesheet" href="/assets/main.css"></link><link rel="stylesheet" href="/assets/${view_base_path}.css"></link>`)
	const script_jsstr = `<script type="module">${jsstr}</script>`

	resolve(script_jsstr)	
})




const handle_path__view_dist = (view_base_path:str, static_prefix:str) => new Promise<string>(async (resolve, _reject) => {

	const promises:Promise<any>[] = []
	const p = BASEPATH + static_prefix + "dist/" + view_base_path
	promises.push(fs.promises.readFile(p + ".js", 'utf8'))
	const r = await Promise.all(promises)

	const script_jsstr = `<script type="module">${r[0]}</script>`

	resolve(script_jsstr)	
})
*/
/*
const getview_js_content = (basepath:str, nodeenv:str, static_prefix:str) => new Promise <any>(async (resolve, _reject) => {

	const promises:Promise<any>[] = []

	const p = BASEPATH + static_prefix + nodeenv + basepath

	if (nodeenv === "dev/") {
		promises.push(fs.promises.readFile(p + ".js", 'utf8'))
		promises.push(fs.promises.readFile(p + ".html", 'utf8'))
		const r = await Promise.all(promises)

		let jsstr = r[0].replace("{--html--}", `${r[1]}`)
		jsstr     = jsstr.replace("{--css--}", `<link rel="stylesheet" href="/assets/${basepath}.css"></link>`)
		resolve(jsstr)
	}

	else {
		promises.push(fs.promises.readFile(p + ".js", 'utf8'))
		const r = await Promise.all(promises)
		resolve(r[0])
	}
})
*/













